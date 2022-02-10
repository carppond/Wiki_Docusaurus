---
id: weak底层实现原理二：objc-weak函数列表全解析
slug: weak底层实现原理二：objc-weak函数列表全解析.html
title: 02 | objc-weak 函数列表全解析
author: 鲤鱼
description: weak底层实现原理
tag:
  - iOS基础知识
---

weak 底层实现原理(二)：objc-weak 函数列表全解析
为了全面解析 `weak` 的实现原理，前面[weak 底层实现原理(一)：SideTable、weak_table_t、weak_entry_t 等数据结构](https://www.yuque.com/u1177479/upp5ho/lor0g9)分析了所有要用到的数据，少量提及相关操作函数。这里把 `objc_weak.mm` 中函数全部分析一遍，从开始到末尾一行行的分析。
## 1. TABLE_SIZE 宏定义
```jsx
#define TABLE_SIZE(entry) (entry->mask ? entry->mask + 1 : 0)

```
用于获取`weak_entry_t`或 `weak_table_t` 的哈希数组当前分配的总容量。


- 在 `weak_entry_t` 中，当对象的弱引用数量不超过 `4` 的时候，就使用 `weak_referrer_t inline_referrers[WEAK_INLINE_COUNT]`这个固定长度为 `4` 的数组存放 `weak_referrer_t`。当长度大于`4` ，就要使用 `weak_referret_t *referrers`这个哈希数组存放 `weak_referent_t` 数据。
- `weak_table_t`的哈希数组初始化长度是 `64`，当存储占比超过 `3/4` 后，哈希数组会扩容为总容量的 `2` 倍，然后会把之前的数据重新哈希化存放到新空间。当一些数据从哈希数组中移除后，为了提高查找效率势必要对哈希数组的总长度做缩小操作，规则是当哈希数组总容量超过 `1024`且已使用部分少于总容量`1/16`时，缩小为总容量的 `1/8`，缩小后同样会把原始数据重新哈希化存储到新空间。(缩小和扩展都是实用`calloc`函数开辟新空间，`cache_t`扩容后是直接忽略旧数据，这里可以比较记忆)。牢记以上只是针对 `weak_table_t`的哈希数组而言。
- `weak_entry_t` 则是首先用固定长度为 `4`的数组，当有新的弱引用进来时，会首先判断当前使用的是定长数组还是哈希数组，如果此时使用的还是定长数据的话要先判断定长数组还有没有空位，如果没有空位的话就会为哈希数组申请长度为 `4` 并用一个循环把定长数组中的数据放在哈希数组，这里看似是按下标循环存放，其实下面会重新进行哈希化，然后是判断是否对哈希数组进行扩容，也就是如果超过总容量的 `3/4`进行扩容为总容量的`2`倍，所以`weak_entry_t`的哈希数组第一次扩容后是`8`。然后下面区别就来了，`weak_entry_t`的哈希数组是没有缩小机制的，移除弱引用的操作其实只是把弱引用的指向置为 `nil`，做移除操作的是判断如果定长数组位空或者哈希数组为空，则会把`weak_table_t`哈希数组中的`weak_entry_t`移除，然后对 `weak_table_t`做一些缩小容量的操作。
-  `weak_entry_t` 和 `weak_table_t` 可以共用 `TABLE_SIZE`，因为它们对 `mask`的使用机制完全一样。这里 `weak_entry_t`之所以不缩小，且起始用固定长度数组，都是对其的优化，因为本来一个对象的弱引用数据就不会太多。



现在想来依然觉着`mask`的值用的很巧妙(前文已经讲过`mask`的全部租用，起始脱离`mask`相关的源码，`objc4`其他地方也采用了这种做法)
```jsx
static void append_referrer(weak_entry_t *entry, objc_object **new_referrer);
```
函数功能如其名，往指定的 `weak_entry_t` 里面添加 `new_referrer`( `weak` 变量的地址)。这里只是声明，具体实现在后面，这个声明只是为了给下面的其他函数的提前调用作的声明。
## 2. objc_weak_error
```jsx
/* Use this for functions that are intended to be breakpoint hooks.
   If you do not, the compiler may optimize them away.
   BREAKPOINT_FUNCTION( void stop_on_error(void) );
#   define BREAKPOINT_FUNCTION(prototype)                             \
    OBJC_EXTERN __attribute__((noinline, used, visibility("hidden"))) \
    prototype { asm(""); }
 */
BREAKPOINT_FUNCTION(
    void objc_weak_error(void)
);
```
参考链接: [GCC扩展 attribute ((visibility("hidden")))](https://www.cnblogs.com/lixiaofei1987/p/3198665.html)
## 3. bad_weak_table
```jsx
static void bad_weak_table(weak_entry_t *entries)
{
    _objc_fatal("bad weak table at %p. This may be a runtime bug or a "
                "memory error somewhere else.", entries);
}
```
`_objc_fatal`用来退出程序或者终止运行并打印原因。这里表示`weak_table_t`中的某个 `weak_entry_t`发生了内部错误，全局搜索发现该函数只会发生在`hash`冲突时`index`持续增加直到和`begin`相等时会被调用。
## 4. hash_pointer 和 w_hash_pointer
```jsx
/** 
 * Unique hash function for object pointers only. 唯一的哈希函数仅适用于对象指针
 * 
 * @param key The object pointer
 * 
 * @return Size unrestricted hash of pointer.
 *
 * 哈希函数,与 mask 做与操作,防止 index 越界
 * hash_pointer(referent) 调用通用的指针哈希函数，后面的 & weak_table->mask 位操作来确保得到的 begin 不会越界，同我们日常使用的取模操作（%）是一样的功能，只是改为了位操作，提升了效率。
 */
static inline uintptr_t hash_pointer(objc_object *key) {
    // 把指针强转化为 unsigned long,然后调用 ptr_hash 函数
    return ptr_hash((uintptr_t)key);
}
```
将一个`objc_object`对象的指针求哈希值，用于从`weak_table_t`哈希表中取得对象对应的 `weak_entry_t`。
```jsx
/** 
 * Unique hash function for weak object pointers only. 
 * 唯一的哈希函数仅适用于弱引用对象指针
 *
 * @param key The weak object pointer. 
 * 
 * @return Size unrestricted hash of pointer.
 */
static inline uintptr_t w_hash_pointer(objc_object **key) {
    return ptr_hash((uintptr_t)key);
}
```
对一个`objc_object`对象指针的指针(此处是指`weak`变量的地址)求哈希值，用于从`weak_entry_t`哈希表中取得`weak_referrer_t`把其保存的弱引用变量的指向置为`nil`或者从哈希表中移除等。
## 5. ptr_hash
> // Pointer hash function.
> // This is not a terrific hash, but it is fast 
> // and not outrageously flawed for our purposes.
> 指针哈希函数。这不是一个了不起的哈希，但是它很快，并且没有为了我们的目的而有过分的缺陷。

```jsx
// Based on principles from http://locklessinc.com/articles/fast_hash/
// and evaluation ideas from http://floodyberry.com/noncryptohashzoo/
#if __LP64__
static inline uint32_t ptr_hash(uint64_t key)
{
    key ^= key >> 4; // key 右移 4 位,然后与原始 key 做异或位操作
    key *= 0x8a970be7488fda55; // xx 与 key 做乘运算
    key ^= __builtin_bswap64(key);// 翻转 64 位数个字节与 key 做异或运算
    return (uint32_t)key; // 把 key 强转为 uint32_t 后返回
}
#else
static inline uint32_t ptr_hash(uint32_t key)
{
    key ^= key >> 4;
    key *= 0x5052acdb;
    key ^= __builtin_bswap32(key);
    return key;
}
#endif
```
`___LP64__`指`long`和`pointer`都占 `64` 位的环境。
`ptr_hash`是指针哈希函数，看到源码中有多处用到了他

- `key` 右移 `4` 位的值做异或操作
- 与`0x8a970be7488fda55`这个值做乘法
- `__builtin_bswap64`翻转`64`位数各字节然后再做一次异或



`__builtin_bswap64`可参考[gcc的__builtin_函数介绍](https://blog.csdn.net/acmdream/article/details/60962021)
## 6. grow_refs_and_insert
对`weak_entry_t`的哈希数组进行扩容，并插入一个新的`new_referrer`，原有数据重新哈希化放在新空间内。
```jsx
/** 
 * Grow the entry's hash table of referrers. Rehashes each
 * of the referrers.
 * 
 * @param entry Weak pointer hash set for a particular object.
 *
 */
__attribute__((noinline, used))
static void grow_refs_and_insert(weak_entry_t *entry, 
                                 objc_object **new_referrer)
{
    // DEBUG 模式下的断言,确保当前 weak_entry_t 使用的是哈希数组
    ASSERT(entry->out_of_line());

    // 新容量是为旧容量的 2 倍
    size_t old_size = TABLE_SIZE(entry);
    size_t new_size = old_size ? old_size * 2 : 8;

    // 记录当前已使用的容量
    size_t num_refs = entry->num_refs;
    // 记录旧哈希数组的起始地址,在最后进行释放
    weak_referrer_t *old_refs = entry->referrers;
    // mask 依然是总容量-1
    entry->mask = new_size - 1;
    
    // 为新哈希数组申请空间
    // 长度为总容量 * sizeof(weak_referrer_t)(8)个字节
    entry->referrers = (weak_referrer_t *)
        calloc(TABLE_SIZE(entry), sizeof(weak_referrer_t));
    
    // 默认为 0
    entry->num_refs = 0;
    entry->max_hash_displacement = 0;
    
    for (size_t i = 0; i < old_size && num_refs > 0; i++) {
        if (old_refs[i] != nil) {
            // 把旧哈希数组里的数据放到新哈希数组里
            append_referrer(entry, old_refs[i]);
            // 旧哈希数组的长度自减
            num_refs--;
        }
    }
    // Insert
    // 然后把入参传入的 new_referrer 插入新的哈希数组中,签名的铺垫都是数据转移
    append_referrer(entry, new_referrer);
    // 释放旧哈希数组
    if (old_refs) free(old_refs);
}
```
## 7. append_referrer
添加给定的`referrer`到`weak_entry_t`的哈希数组(或定长`4`的内部数组)
```jsx
/** 
 * Add the given referrer to set of weak pointers in this entry.
 * 添加给定的 referrer 到 weak_entry_t 的哈希数组(或定长 4 的内部数组)
 * Does not perform duplicate checking (b/c weak pointers are never
 * added to a set twice). 
 * 不执行重复检查,weak 指针永不会添加 2 次
 *
 * @param entry The entry holding the set of weak pointers. 
 * @param new_referrer The new weak pointer to be added.
 *
 * 添加给定的 referrer 到 weak_entry_t 的哈希数组（或定长为 4 的内部数组）。
 */
static void append_referrer(weak_entry_t *entry, objc_object **new_referrer)
{
    if (! entry->out_of_line()) {
        // Try to insert inline.
        // 如果 weak_entry_t 尚未使用哈希数组,走这里
        for (size_t i = 0; i < WEAK_INLINE_COUNT; i++) {
            // 找到空位,把 weak_entry_t 放进去
            if (entry->inline_referrers[i] == nil) {
                entry->inline_referrers[i] = new_referrer;
                return;
            }
        }

        // Couldn't insert inline. Allocate out of line.
        // 如果 inline_referrers 存满了,则要转到 referrers 哈希数组
        // 这里是为哈希数组申请空间
        weak_referrer_t *new_referrers = (weak_referrer_t *)
            calloc(WEAK_INLINE_COUNT, sizeof(weak_referrer_t));
        // This constructed table is invalid, but grow_refs_and_insert
        // will fix it and rehash it.
        // 此构造的 table 无效, grow_refs_and_insert 将修复它并重新哈希
        
        // 把 inline_referrers 内部的数据放进哈希数组
        // 这里看似是直接循环按下标存放,其实后面会进行扩容和哈希化
        for (size_t i = 0; i < WEAK_INLINE_COUNT; i++) {
            new_referrers[i] = entry->inline_referrers[i];
        }
        
        // 给 referrers 赋值
        entry->referrers = new_referrers;
        // 表示目前弱引用是 4
        entry->num_refs = WEAK_INLINE_COUNT;
        // out_of_line_ness 置为 REFERRERS_OUT_OF_LINE
        // 标记 weak_entry_t 开始使用哈希数组保存弱引用的指针
        entry->out_of_line_ness = REFERRERS_OUT_OF_LINE;
        // 看到这里有一个减一的操作
        // mask 赋值,总容量 - 1
        entry->mask = WEAK_INLINE_COUNT-1;
        // 此时哈希冲突偏移为 0
        entry->max_hash_displacement = 0;
    }
    // 对于哈希数组的扩容处理
    // DEBUG 下,断言:此处使用的一定是哈希数组
    ASSERT(entry->out_of_line());

    // #define TABLE_SIZE(entry) (entry->mask ? entry->mask + 1 : 0)
    // mask 又加了 1
    // 如果已存放弱引用数量大于总容量的 3/4
    if (entry->num_refs >= TABLE_SIZE(entry) * 3/4) {
        // weak_entry_t 哈希数组扩容并插入 new_referrer
        return grow_refs_and_insert(entry, new_referrer);
    }
    // 不需要扩容,则进行正常插入
    size_t begin = w_hash_pointer(new_referrer) & (entry->mask);
    size_t index = begin;
    size_t hash_displacement = 0;
    while (entry->referrers[index] != nil) {
        hash_displacement++;
        index = (index+1) & entry->mask;
        
        // 在 index == beigin 之前一定能找到空位置,因为前面有了一个超过 3/4 占用的扩容机制
        if (index == begin) bad_weak_table(entry);
    }
    // 更新最大偏移值
    if (hash_displacement > entry->max_hash_displacement) {
        entry->max_hash_displacement = hash_displacement;
    }
    // 找到空位置插入弱引用指针
    weak_referrer_t &ref = entry->referrers[index];
    ref = new_referrer;
    // 已存弱引用数量自增
    entry->num_refs++;
}
```
## 8. remove_referrer
从`weak_entry_t`的哈希数组（或定长为 `4` 的内部数组）中删除弱引用的地址。
```jsx
/**  
 * Remove old_referrer from set of referrers, if it's present.
 * 如果 old_referrer 存在,从 referrers 中删除它.
 * Does not remove duplicates, because duplicates should not exist. 
 * 不删除重复项,因为这里就不应该存在重复先
 *
 * @todo this is slow if old_referrer is not present. Is this ever the case? 
 * 如果 old_referrer 不存在，这会很慢。 情况是否如此？
 *
 * @param entry The entry holding the referrers.
 * @param old_referrer The referrer to remove. 
 */
static void remove_referrer(weak_entry_t *entry, objc_object **old_referrer)
{
    // 如果目前使用的是定长 4 的内部数组
    if (! entry->out_of_line()) {
        // 循环找到 old_referrer 的位置,把它的原位置放置 nil,表示把old_referrer从数组中删除了
        for (size_t i = 0; i < WEAK_INLINE_COUNT; i++) {
            if (entry->inline_referrers[i] == old_referrer) {
                entry->inline_referrers[i] = nil;
                return;
            }
        }
        // 如果当前 weak_entry_t 不包含传入的old_referrer
        // 则明显发生了错误,执行 objc_weak_error 函数
        _objc_inform("Attempted to unregister unknown __weak variable "
                     "at %p. This is probably incorrect use of "
                     "objc_storeWeak() and objc_loadWeak(). "
                     "Break on objc_weak_error to debug.\n", 
                     old_referrer);
        objc_weak_error();
        return;
    }
    // 从哈希数组中找到 old_referrer,并置为 nil(移除old_referrer)
    size_t begin = w_hash_pointer(old_referrer) & (entry->mask);
    size_t index = begin;
    size_t hash_displacement = 0;
    while (entry->referrers[index] != old_referrer) {
        index = (index+1) & entry->mask;
        if (index == begin) bad_weak_table(entry);
        hash_displacement++;
        if (hash_displacement > entry->max_hash_displacement) {
            _objc_inform("Attempted to unregister unknown __weak variable "
                         "at %p. This is probably incorrect use of "
                         "objc_storeWeak() and objc_loadWeak(). "
                         "Break on objc_weak_error to debug.\n", 
                         old_referrer);
            objc_weak_error();
            return;
        }
    }
    // 把old_referrer所在的位置置为 nil,已存弱引用数量递减
    entry->referrers[index] = nil;
    entry->num_refs--;
}
```
## 9. weak_entry_insert
把`weak_entry_t`添加到`weak_table_t -> weak_entries`中。
```jsx
/** 
 * Add new_entry to the object's table of weak references.
 * 添加 new_entry 到保存对象的 weak 变量地址的哈希表中
 * Does not check whether the referent is already in the table.
 * 不用刚检查引用对象是否已在表中
 */
static void weak_entry_insert(weak_table_t *weak_table, weak_entry_t *new_entry)
{
    // 哈希数组中的起始地址
    weak_entry_t *weak_entries = weak_table->weak_entries;
    ASSERT(weak_entries != nil);
    // 调用 hash_pointer 函数找到 new_entry 在 weak_table_t 的哈希数组中位置,可能会发生哈希冲突,&mask 的原理同上
    size_t begin = hash_pointer(new_entry->referent) & (weak_table->mask);
    size_t index = begin;
    size_t hash_displacement = 0;
    while (weak_entries[index].referent != nil) {
        // 如果发生哈希冲突,+1,继续向下探测
        index = (index+1) & weak_table->mask;
        // 如果 index 每次+1 加到值 == begin,还没有找到空位置,就触发bad_weak_table
        if (index == begin) bad_weak_table(weak_entries);
        
        // 记录偏移,用于更新 max_hash_displacemen
        hash_displacement++;
    }
    // new_entry 放入哈希数组
    weak_entries[index] = *new_entry;
    // 更新 num_entries
    weak_table->num_entries++;
    
    // 此操作正记录 weak_table_t 哈希数组发生哈希冲突时的最大偏移值
    if (hash_displacement > weak_table->max_hash_displacement) {
        weak_table->max_hash_displacement = hash_displacement;
    }
 }
```
因为此函数内部不存在函数嵌套调用，所以实现也比较简单。首先解释一下 为什么不检查`referent`是否存在`weak_table_t`中，全局搜索可以发现只有两个地方用到了此函数：

- `weak_table_t`调整了哈希数组的大小以后，要进行重新哈希化，此时`weak_entry_t`是一定不在哈希数组里的
- `weak_register_no_lock`函数内部在调用`weak_entry_insert`之前已经调用 `weak_entry_for_referent`判断没有对应的`weak_entry_t`存在，所以`weak_entry_insert`函数中不需要再重复判断。(新建一个 weak_entry_t 添加 weak_table_t 哈希数组)。

​

这里还有一个需要注意的，在函数最后会更新`weak_table_t`的`max_hash_displacement`，记录哈希冲突时的最大偏移值
## 10. weak_resize
调整`weak_table_t`哈希数组的容量大小，并把原始哈希数组里面的`weak_entry_t`重新哈希化放进新空间内。
```jsx
// 扩大和缩小空间都会调用weak_resize公共函数,入参是 weak_table_t 和一个指定的长度
static void weak_resize(weak_table_t *weak_table, size_t new_size)
{
    // 这里是取得当前哈希数组的总长度
    // #define TABLE_SIZE(entry) (entry->mask ? entry->mask + 1 : 0)
    size_t old_size = TABLE_SIZE(weak_table);

    // 获取旧的 weak_entries 哈希数组的起始地址
    weak_entry_t *old_entries = weak_table->weak_entries;
    // 为新的 weak_entries 哈希数组申请指定长度的空间,并把起始地址返回
    // 内存空间总量为: nnew_size, sizeof(weak_entry_t)
    weak_entry_t *new_entries = (weak_entry_t *)
        calloc(new_size, sizeof(weak_entry_t));
    
    // 更新 mask
    weak_table->mask = new_size - 1;
    // 更新 hash 数组的起始地址
    weak_table->weak_entries = new_entries;
    // 最大哈希冲突偏移,默认 0
    weak_table->max_hash_displacement = 0;
    // 当前哈希数组的占用数量,默认 0
    weak_table->num_entries = 0;  // restored by weak_entry_insert below
    
    // 下面是把旧哈希数组中的数据重新哈希化放进新空间
    // 然后上面的默认 0 的 weak_table_t 的两个成员变量会在下面的 weak_entery_insert 函数中更新
    
    // 如果有旧的 weak_entry_t 需要更新,放到新的空间中
    if (old_entries) {
        weak_entry_t *entry;
        // 旧哈希数组的末尾
        weak_entry_t *end = old_entries + old_size;
        // 循环调用 weak_entry_insert 把旧哈希数组中的 weak_entry_t 插入到新的哈希数组中
        for (entry = old_entries; entry < end; entry++) {
            if (entry->referent) {
                weak_entry_insert(weak_table, entry);
            }
        }
        // 释放旧哈希数组的内存空间
        free(old_entries);
    }
}
```
## 11. weak_grow_maybe
对`weak_table_t`的哈希数组进行容量扩展。
```jsx
static void weak_grow_maybe(weak_table_t *weak_table)
{
    // 这里是取得当前哈希数组的总长度
    // #define TABLE_SIZE(entry) (entry->mask ? entry->mask + 1 : 0)
    // mask + 1 表示当前 weak_table 哈希数组的总长度
    size_t old_size = TABLE_SIZE(weak_table);

    // Grow if at least 3/4 full.
    // 如果目前哈希数组存储的 weak_entry_t 的数量超过了总长度的 3/4,则进行扩展
    if (weak_table->num_entries >= old_size * 3 / 4) {
        // 如果 weak_table的哈希数组总长度是 0,则初始化哈希数组的总长度位 64,如果不是,则扩容到之前长度的两倍(old_size*2)
        weak_resize(weak_table, old_size ? old_size*2 : 64);
    }
}
```
此函数比较清晰,明确了 3 点:

-  当`weak_table_t`哈希数组已占用元素超过总容量的 `3/4`则进行扩容
- `weak_table_t`哈希数组初始化容量是 `64`
- `weak_table_t`扩容时,容量是直接扩容位之前容量的`2`倍

​

最后调用`weak_resize`
## 12. weak_compact_maybe
如果`weak_table_t`哈希数组大部分空间是空着的，则缩小哈希数组。
```jsx
static void weak_compact_maybe(weak_table_t *weak_table)
{
    // 这里是取得当前哈希数组的总长度
    // #define TABLE_SIZE(entry) (entry->mask ? entry->mask + 1 : 0)
    size_t old_size = TABLE_SIZE(weak_table);

    // Shrink if larger than 1024 buckets and at most 1/16 full.
    // old_size 超过了 1024 并低于 1/16 的空间占用比率则进行缩小
    if (old_size >= 1024  && old_size / 16 >= weak_table->num_entries) {
        // 缩小容量位 old_size的 1/8
        weak_resize(weak_table, old_size / 8);
        // 缩小为 1/8 和上面的空间占用小余 1/16,两个条件合并到一起,保证缩小后的容量占用比小余 1/2
        // leaves new table no more than 1/2 full
    }
}
```
缩小`weak_entry_t *weak_entries`的长度的条件是目前的总长度超过了`1024`,并且容量占用比小余 `1/16`，`weak_entries`空间缩小到当前空间的`1/8`。缩小后占用量仍不超过总量的 `1/2`。
## 13. weak_entry_remove
从`weak_table_t`的哈希数组中删除指定的`weak_entry_t`。
```jsx
static void weak_entry_remove(weak_table_t *weak_table, weak_entry_t *entry)
{
    // remove entry
    // 如果 weak_entry_t 当前使用的是哈希数组,则释放其内存
    if (entry->out_of_line()) free(entry->referrers);
    // 把从 entry 开始的sizeof(*entry)个字节空间置为 0
    bzero(entry, sizeof(*entry));
    // num_entries 自减
    weak_table->num_entries--;
    // 缩小 weak_table_t 的哈希数组容量
    weak_compact_maybe(weak_table);
}
```
## 14. weak_entry_for_referent
从`weak_table_t`的哈希数组中找到`referent 的 weak_entry_t`，如果未找到则返回`NULL`。
```jsx
/** 
 * Return the weak reference table entry for the given referent. 
 * If there is no entry for referent, return NULL. 
 * Performs a lookup. 根据给定的 referent (对象变量)和weak_table_t 哈希表,查找其中的 weak_entry_t(存放所有指向 referent 的弱引用变量的地址的哈希表)并返回,如果未找到返回 NULL
 *
 *
 * @param weak_table 通过&SideTables()[referent] 可以从全局的 SideTables 中找到 referent 所处的 SideTable ->weak_table_t
 * @param referent The object. Must not be nil. 对象必须不能是 nil
 * 
 * @return The table of weak referrers to this object.  返回值是 weak_entry_t 指针,weak_entry_t 中保存了 referent 的所有弱引用变量的地址
 */
static weak_entry_t *
weak_entry_for_referent(weak_table_t *weak_table, objc_object *referent)
{
    ASSERT(referent);
    // weak_table_t 中哈希函数的入口
    weak_entry_t *weak_entries = weak_table->weak_entries;

    if (!weak_entries) return nil;
    // hash_pointer 哈希函数返回值与 mask 做与操作,防止 index 越界,这里的&mask操作很巧妙,后面会进行详细讲解
    size_t begin = hash_pointer(referent) & weak_table->mask;
    size_t index = begin;
    size_t hash_displacement = 0;
    
    // 如果未发生哈希冲突的话,这里 weak_table->weak_entries[index] 就是要找的weak_entry_t了
    while (weak_table->weak_entries[index].referent != referent) {
        // 如果发生了哈希冲突,+1 继续往下探测(开放寻址法
        index = (index+1) & weak_table->mask;
        // 如果 index 每次加 1 加到值等于 begin,还没有找到 weak_entry_t,则触发 bad_weak_table
        if (index == begin) bad_weak_table(weak_table->weak_entries);
        // 触发探测偏移了多远
        hash_displacement++;
        // 如果探测偏移超过 了weak_table 的 max_hash_displacement
        // 说明在 weak_table 中没有 referent 的 weak_entry_t,则直接返回nil
        if (hash_displacement > weak_table->max_hash_displacement) {
            return nil;
        }
    }
    // 到这里找到了 weak_entry_t,然后取出它 333 的地址并返回
    return &weak_table->weak_entries[index];
}
```
## 15. weak_unregister_no_lock
> Unregister an already-registered weak reference.
> This is used when referrer's storage is about to go away, but referent isn't dead yet. (Otherwise, zeroing referrer later would be a bad memory access.)
> Does nothing if referent/referrer is not a currently active weak reference.
> Does not zero referrer.
> ​

> 注销以前注册的弱引用。该方法用于 referrer 的存储即将消失，但是 referent 还正常存在。（否则，referrer 被释放后，可能会造成一个错误的内存访问，即对象还没有释放，但是 weak 变量已经释放了，这时候再去访问 weak 变量会导致野指针访问。）如果  referent/referrer 不是当前有效的弱引用，则不执行任何操作。

当前需要传递旧的引用值。 如果`referrer`被释放了，则从其对应的`weak_entry_t`的哈希数组（或定长为`4`的内部数组）删除`referrer`应该是自动进行。
​

从`referent`对应的`weak_entry_t`哈希数组(或定长为`4`的内部数组）中注销指定的弱引用。
```jsx
void
weak_unregister_no_lock(weak_table_t *weak_table, id referent_id, 
                        id *referrer_id)
{
    // id 转化为 objc_objec * 对象的指针
    objc_object *referent = (objc_object *)referent_id;
    // referrer_id 指向 weak 变量的地址,所以这里是**
    objc_object **referrer = (objc_object **)referrer_id;

    weak_entry_t *entry;

    if (!referent) return;

    // 从 weak_table_t 中找到 referent 的 weak_entry_t
    if ((entry = weak_entry_for_referent(weak_table, referent))) {
        // 找到了这个 entry,则删除 weak_entry_t 的哈希数组(或定长为 4 的内部数组)中的 referrer
        remove_referrer(entry, referrer);
        bool empty = true;
        
        // 注销 referrer 以后判断是否需要删除对应的 weak_entry_t
        // 如果 weak_entry_t 目前使用哈希数组,且num_refs不为0
        // 表示此时哈希数组还不为空,不需要删除
        if (entry->out_of_line()  &&  entry->num_refs != 0) {
            empty = false;
        }
        else {
            // 循环判断 weak_entry_t 内部定长位 4 的数组是否还有weak_referrer_t
            for (size_t i = 0; i < WEAK_INLINE_COUNT; i++) {
                if (entry->inline_referrers[i]) {
                    empty = false; 
                    break;
                }
            }
        }
        // 如果 entry 中的弱引用地址已经被清空了,则连带也删除这个 entry,类似数组已经空了,把数组也删了
        if (empty) {
            weak_entry_remove(weak_table, entry);
        }
    }

    // Do not set *referrer = nil. objc_storeWeak() requires that the 
    // value not change.
}
```
## 16. weak_register_no_lock
把一个对象和对象的弱引用的指针注册到`weak_table_t`的`weak_entry_t`中。
```jsx
/** 
 * Registers a new (object, weak pointer) pair. Creates a new weak
 * object entry if it does not exist.
 * 注册一个新的(对象,weak 指针)对.创建一个新的 weak object entry(weak_entry_t),如果它不存在的话
 *
 * @param weak_table The global weak table. 所处的全局 weak_table_t 表
 * @param referent The object pointed to by the weak reference. weak弱引用指向的对象
 * @param referrer The weak pointer address. weak 地址地址
 *
 * 添加一对(object, weak pointer)到弱引用表里. 当一个对象存在第一个指向它的 weiak 变量时,此时会把对象注册进 weak_table_t 的哈希表中,同时也会把这第一个 weak 变量的地址保存进对象的 weak_entry_t 哈希表中,如果这个 weak 变量不是第一个的话,表明这个对象此时已经存在于 weak_table_t 哈希表中,此时需要把这个指向它的 weak 变量的地址保存进该对象的 weak_entry_t 哈希表中
 */
id 
weak_register_no_lock(weak_table_t *weak_table, id referent_id, 
                      id *referrer_id, WeakRegisterDeallocatingOptions deallocatingOptions)
{
    // id 转化为 objc_objec * 对象的指针.这里是对象指针
    objc_object *referent = (objc_object *)referent_id;
    // referrer_id 指向 weak 变量的地址,所以这里是**.这里是 weak 变量的地址
    objc_object **referrer = (objc_object **)referrer_id;

    // 如果对象不存在或者是一个 Tagged Pointer 的话,直接返回对象
    if (referent->isTaggedPointerOrNil()) return referent_id;

    // ensure that the referenced object is viable
     
    // 判断对象是否正在进行释放操作,dealloc
    if (deallocatingOptions == ReturnNilIfDeallocating ||
        deallocatingOptions == CrashIfDeallocating) {
        bool deallocating;
        if (!referent->ISA()->hasCustomRR()) {
            deallocating = referent->rootIsDeallocating();
        }
        else {
            // Use lookUpImpOrForward so we can avoid the assert in
            // class_getInstanceMethod, since we intentionally make this
            // callout with the lock held.
            // 判断如蝉对象是否能进行 weak 引用 allowsWeakReference
            auto allowsWeakReference = (BOOL(*)(objc_object *, SEL))
            lookUpImpOrForwardTryCache((id)referent, @selector(allowsWeakReference),
                                       referent->getIsa());
            if ((IMP)allowsWeakReference == _objc_msgForward) {
                return nil;
            }
            // 通过函数指针指向喊函数
            deallocating =
            ! (*allowsWeakReference)(referent, @selector(allowsWeakReference));
        }
        // 如果对象正在进行释放或者对象不能进行 weak 引用,且 CrashIfDeallocating 为 true,则抛出 crash
        if (deallocating) {
            if (deallocatingOptions == CrashIfDeallocating) {
                _objc_fatal("Cannot form weak reference to instance (%p) of "
                            "class %s. It is possible that this object was "
                            "over-released, or is in the process of deallocation.",
                            (void*)referent, object_getClassName((id)referent));
            } else {
                return nil;
            }
        }
    }

    // now remember it and where it is being stored
    weak_entry_t *entry;
    // 在 weak_table 中找 referent 对应的 weak_entry_t
    if ((entry = weak_entry_for_referent(weak_table, referent))) {
        // 如果找到了,调用append_referrer,把__weak变量的地址放进哈希数组
        append_referrer(entry, referrer);
    } 
    else {
        // 如果没有找到 weak_entry_t,则创建一个新的
        weak_entry_t new_entry(referent, referrer);
        // 判断 weak_table 是否需要扩容
        weak_grow_maybe(weak_table);
        // 把 weak_entry_t 插入到 weak_table_t 的哈希数组中
        weak_entry_insert(weak_table, &new_entry);
    }

    // Do not set *referrer. objc_storeWeak() requires that the
    // value not change. objc_storeWeak() 要求值不变
    // 不设置*referrer.
    
    // 返回对象
    return referent_id;
}
```
流程超长,但是每个步骤都很清晰

- 1. 首先判断`referent`是否是`Tagged Pointer`或者`nil`，如果不是则执行接下来的流程。`Tagged Pointer`不支持弱引用。
- 2. 判断对象是否释放和对象是否支持弱引用。继承自`NSObject`类默认支持，`NSObject.mm`文件中找到`allowsWeakReference`函数，看到类方法默认返回`YES`，实例方法,如果对象没有释放则返回`YES`。
```jsx
- (BOOL)_isDeallocating {
	return _objc_rootIsDeallocating(self);
}


+ (BOOL)allowsWeakReference {
	return YES;
}


- (BOOL)allowsWeakReference {
	return ! [self _isDeallocating];
}
```

-  3. 根据`deallocating`(对象是否正在释放的标志和对象是否支持弱引用)和`CrashIfDeallocating`判断是否终止程序运行。
-  4. 在`weak_table_t`中找`referent`对象的`weak_entry_t`，如果找到`entry`，就调用 `append_referrer`函数把对象弱引用指针`referrer`插入到`weak_entry_t`的哈希表(或定长为`4`的内部数组)中
-  5. 如果在`weak_table_t`根据`referent`中没有找到`weak_entry_t`，则首先创建一个`new_entry`，然后执行`weak_grow_maybe`，处理是否需要扩容等，再调用`weak_entry_insert`把创`new_entry`插入`weak_table_t`的哈希数组中
## 17. weak_is_registered_no_lock
`DEBUG`模式下调用的函数。判断一个对象是否注册在`weak_table_t`中，是否注册可以理解为一个对象是否存在弱引用。（已注册 = 存在弱引用，未注册 = 不存在弱引用，当对象存在弱引用时，系统一定会把它注册到`weak_table_t`中，即能在`weak_table_t`的哈希数组中找到`weak_entry_t`）。
```jsx
#if DEBUG
bool
weak_is_registered_no_lock(weak_table_t *weak_table, id referent_id) 
{
    // 调用 weak_entry_for_referent 判断对象是否存在对应的 entry
    return weak_entry_for_referent(weak_table, (objc_object *)referent_id);
}
#endif

```
此函数借助`weak_entry_for_referent`判断一个对象是否注册到`weak_table_t`中。
## 18. weak_clear_no_lock
当对象的`dealloc`函数执行时会调用此函数，主要功能是当对象被释放废弃时，把该对象的弱引用指针全部指向`nil`。
```jsx
/** 
 * Called by dealloc; nils out all weak pointers that point to the 
 * provided object so that they can no longer be used.
 * 当对象的 dealloc 函数执行时会调用此函数，主要功能是当对象被释放废弃时，把该对象的弱引用指针全部指向 nil
 *
 * @param weak_table 
 * @param referent The object being deallocated.
 *
 * 当对象销毁的时候该函数会调用.设置所有剩余的__weak 变量指向 nil,此处正对应了我们日常挂在嘴边上的:__weak 变量在它指向的对象被销毁后它便会置为 nil 的机制
 */
void 
weak_clear_no_lock(weak_table_t *weak_table, id referent_id) 
{
    // 获取对象的指针
    objc_object *referent = (objc_object *)referent_id;
    // 从 weak_table_t 的哈希数组中找到referent 对应的 weak_entry_t
    weak_entry_t *entry = weak_entry_for_referent(weak_table, referent);
    // 如果 entry 不存在,就返回
    if (entry == nil) {
        /// XXX shouldn't happen, but does with mismatched CF/objc
        //printf("XXX no entry for clear deallocating %p\n", referent);
        return;
    }

    // zero out references
    // 用于记录 weak_referrer_t,DisguisedPtr<objc_object *>
    weak_referrer_t *referrers;
    size_t count;
    
    // 如果目前 weak_entry_t 使用的是哈希数组
    if (entry->out_of_line()) {
        // 记录哈希数组入口
        referrers = entry->referrers;
        // 记录总长度
        count = TABLE_SIZE(entry);
    } 
    else {
        // 如果目前对象弱引用的数量不超过 4,则使用inline_referrers数组记录弱引用的指针
        
        // 记录inline_referrers的入口
        referrers = entry->inline_referrers;
        // count = 4
        count = WEAK_INLINE_COUNT;
    }
    
    // 循环把inline_referrers数组或者哈希数组中的 weak 变量指向 nil
    for (size_t i = 0; i < count; ++i) {
        // weak 变量的指针的指针
        objc_object **referrer = referrers[i];
        if (referrer) {
            // 如果 weak 变量指向 referent,则把其指向置为nil
            if (*referrer == referent) {
                *referrer = nil;
            }
            else if (*referrer) {
                // 如果 weak_entry_t 里面存放的 weak 变量指向的对象不是 referent,可能是错误调用 objc_storeWeak 和 objc_loadWeak 函数导致.
                // 执行 objc_weak_error
                _objc_inform("__weak variable at %p holds %p instead of %p. "
                             "This is probably incorrect use of "
                             "objc_storeWeak() and objc_loadWeak(). "
                             "Break on objc_weak_error to debug.\n", 
                             referrer, (void*)*referrer, (void*)referent);
                objc_weak_error();
            }
        }
    }
    
    // 最后把entry 从 weak_table_t 哈希数组中移除
    weak_entry_remove(weak_table, entry);
}
```
该函数流程很长，但是思路很清晰。

- 当对象执行`dealloc`时会调用该函数，首先根据入参`referent_id`找到其在`weak_table`哈希数组中的`weak_entry_t`。
- 然后遍历`weak_entry_t`的哈希数据(或定长为`4`的内部数组`inline_referrers`)通过里面存储的`weak`变量地址，把`weak`变量指向置为`nil`。
- 最后把 `weak_entry_t`从`weak_table`哈希数组中移除。



## 参考

- [Objective-C runtime机制(6)——weak引用的底层实现原理](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fu013378438%2Farticle%2Fdetails%2F82767947)
- [RunTime中SideTables, SideTable, weak_table, weak_entry_t](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2F48a9a9ec8779)
- [weak 底层实现原理(二)：objc-weak 函数列表全解析](https://juejin.cn/post/6865975454822563853#heading-0)​
