---
id: weak底层实现原理一
slug: weak底层实现原理一.html
title: 01 | weak底层实现原理(一)：SideTable、weak_table_t、weak_entry_t等数据结构
author: 鲤鱼
description: weak底层实现原理
tag:
  - iOS基础知识
---

## 01、```template <typename T> class DisguisedPtr```

```template <typename T> class DisguisedPtr``` 是在 `objc-private.h` 中定义的一个模板工具类,主要功能是把 `T` 指针(T 类型变量的地址)转化位一个 `unsigned long`，实现指针到证整数的相互映射,起到指针伪装的作用，使指针隐藏于系统工具中(如 leak 工具)。
在 `objc4-master-818.2` 源码中全局搜索 `DisguisedPtr`,发现抽象类型 T，仅作为 `objc_object` 和 `objc_object *`使用。而抽象类型 `T` 是 `objc_object *`时，用于隐藏`__weak`变量的地址。
> ```DisguisedPtr<T>``` acts like pointer type T*, except the stored value is disguised to hide it from tools like `leaks`. nil is disguised as itself so zero-filled memory works as expected, which means 0x80..00 is also disguised as itself but we don't care. Note that weak_entry_t knows about this encoding.
> ​

> ```DisguisedPtr<T>``` 类似于指针类型 T*，只是存储的值被伪装成对 `leaks` 等工具隐藏。 nil 本身是伪装成的，所以 0 值的内存可以按预期工作而不会崩溃，这意味着 0x80..00 本身也伪装了，但我们不在乎。 请注意，weak_entry_t 知道这种编码。

```jsx
template <typename T>
class DisguisedPtr {
    // unsigned long 类型的 value,足够保存转化为整数的内存地址
    uintptr_t value;

    static uintptr_t disguise(T* ptr) { /// 指针隐藏
        /// 把 T 的地址转换成 unsigned long 并取负值
        return -(uintptr_t)ptr;
    }

    static T* undisguise(uintptr_t val) { // 指针显示
        // 把 unsigned long 类型的 val 转换成指针,对应上面的 disguise的函数
        return (T*)-val;
    }

 public:
    DisguisedPtr() { }// 构造防范
    // 初始化列表 ptr, 初始化value 成员变量
    DisguisedPtr(T* ptr) 
        : value(disguise(ptr)) { }
    // 复制构造函数
    DisguisedPtr(const DisguisedPtr<T>& ptr) 
        : value(ptr.value) { }
    // 重载操作符
    // T* 赋值函数,把一个 T 指针赋值给 DisguisedPtr<T> 类型变量时,直接发生地址到整数的转化.
    DisguisedPtr<T>& operator = (T* rhs) {
        value = disguise(rhs);
        return *this;
    }
    // DisguisedPtr<T> 引用赋值函数
    DisguisedPtr<T>& operator = (const DisguisedPtr<T>& rhs) {
        value = rhs.value;
        return *this;
    }
    //
    operator T* () const {
        // unsigned long  value 转回指针
        return undisguise(value);
    }
    T* operator -> () const {
        // unsigned long  value 转回指针
        return undisguise(value);
    }
    T& operator * () const {
        // 转化为指针,并取出指针内容
        return *undisguise(value);
    }
    T& operator [] (size_t i) const {
        // unsigned long value 转回指针,在找到指定下标 i 位置的值
        return undisguise(value)[i];
    }

    // pointer arithmetic operators omitted 
    // because we don't currently use them anywhere
    // 省略的指针算术运算符，因为目前我们不在任何地方使用它。
};

// fixme type id is weird and not identical to objc_object*
// fixme 类型 id 很奇怪，与 objc_object* 不同
static inline bool operator == (DisguisedPtr<objc_object> lhs, id rhs) {
    return lhs == (objc_object *)rhs;
}
static inline bool operator != (DisguisedPtr<objc_object> lhs, id rhs) {
    return lhs != (objc_object *)rhs;
}

```
## 02、```template<typename T> class StripedMap``` 
> ```StripedMap<T>``` is a map of void* -> T, sized appropriately for cache-friendly lock striping.  For example, this may be used as ```StripedMap<spinlock_t>``` or as ```StripedMap<SomeStruct>``` where SomeStruct stores a spin lock.
> ​

> ```​StripedMap<T>``` 是 void* -> T 的映射，大小适合缓存友好的 lock striping。 例如，这可以用作 ```StripedMap<spinlock_t>``` 或 ```StripedMap<SomeStruct>``` ，其中 SomeStruct 存储自旋锁。
> cache-friendly：按照高速缓存的工作原理，可以发现局部性良好的程序,缓存命中的概率更高。从这个意义上来看,程序也会更快。称这样的程序是高速缓存友好的程序。

`template class StripedMap`从数据结构上来看,它作为一个 `key` 是 `void *`，`value` 是`T` 的 `hash` 表来用的。在 `objc4-master-818.2` 的源码中,全局搜索 `StripedMap`，发现 `T` 作为 `SileTable` 和 `spinlock_t` 类型使用。

- `SideTable`类型：`StripedMap<SideTable>`。 `SideTable` 的使用：`SideTable *table = &SideTable()[obj]` 它的作用根据 `objc_object` 的指针计算出哈希值，然后从 `SideTables` 这张全局哈希表中找到 `obj` 对应的`SideTable`。
- `spinlock_t`类型：`StripedMap<spinlock_t> `
   - 当使用 `atomic` 属性时，`objc_getProperty` 函数内部会通过 `PropertyLocks[slot]`获得一把锁并加锁保证` id value = objc_retain(*slot)`的线程安全。
   - 用于提供锁保证 `objc_copyStruct` 函数调用时 `atomic` 参数位 true 时的线程安全。
   - 保证 `objc_copyCppObjectAtmoic`函数调用时的线程安全。



根据下面源码实现 `Lock` 的部分,发现抽象类型 `T` 必须支`lock`、`unlock`、`forceReset`、`lockdebu_lock_precedes_lock` 函数接口。已知 `struct SideTable` 都有提供。
```jsx
template<typename T>
class StripedMap {
#if TARGET_OS_IPHONE && !TARGET_OS_SIMULATOR
    // iphone, 同时也标明 SideTables 中只有 8 张 SideTable
    enum { StripeCount = 8 };
#else
    // mac/simulator 有 64 张 SideTable
    enum { StripeCount = 64 };
#endif

    struct PaddedT {
        // CacheLineSize = 64
        // T value 64 字节对齐
        T value alignas(CacheLineSize);
    };
    // 长度 8/64的 PaddedT 数组, PaddedT 是一个仅有一个成员变量的结构体, 且该成员变量是 64 位对齐的. (即可表示 SideTable 结构体需要是 64 字节对齐,如果把PaddedT舍弃的话,即 array 可直接砍成一个SideTable)
    PaddedT array[StripeCount];

    // hash 函数, 通过指针获取到哈希值. 这里是获得 objc_objcet 指针的哈希值
    static unsigned int indexForPointer(const void *p) {
        // 把指针 p 转换成 unsigned long
        // reinterpret_cast<new_type>(expression): c++ 里面的强制类型转换符
        uintptr_t addr = reinterpret_cast<uintptr_t>(p);
        // addr 右移 4 位的值 与 addr 右移 9 位的值进行异或,然后对结果进行StripeCount取模. 防止数组越界
        return ((addr >> 4) ^ (addr >> 9)) % StripeCount;
    }

 public:
    // hash 取值: 取得对象所在的 SideTable
    T& operator[] (const void *p) { 
        return array[indexForPointer(p)].value; 
    }
    // 原型 const_cast<type_id>(expression)
    // const_cast 该运算符用来修饰 const 或 volatile 属性
    // 除了 const 或 volatile 修饰之外,type_id 和 expression 的类型是一样的
    // 即把一个不可变类型转化为可变类型: const int b => int b
    // - 常量指针被转化为非常量的指针,并且仍然指向原来的对象
    // - 常量引用被转化位非常量的引用,并且仍然指向原来的对象
    // - const_cast 一般用于修饰指针.如果 const char *p
    
    // 把 this 转化为 StripedMap<T>, 然后调用上面的[],得到 T&
    const T& operator[] (const void *p) const {
        return const_cast<StripedMap<T>>(this)[p]; 
    }
    
    // Shortcuts for StripedMaps of locks.
    // 循环给 arry 中的元素 value 加锁.
    // iOS 下, SideTable 为例的话,循环对 8 张 SideTable 加锁
    // struct SideTable 成员变量: spinlock_slock, lock 函数实现是: void lock() { slock.lock()'}
    void lockAll() {
        for (unsigned int i = 0; i < StripeCount; i++) {
            array[i].value.lock();
        }
    }
    // 同上 解锁
    void unlockAll() {
        for (unsigned int i = 0; i < StripeCount; i++) {
            array[i].value.unlock();
        }
    }
    // 同上 重置锁
    void forceResetAll() {
        for (unsigned int i = 0; i < StripeCount; i++) {
            array[i].value.forceReset();
        }
    }
    // 对 arry 中元素的 loick 定义锁顺序?
    void defineLockOrder() {
        for (unsigned int i = 1; i < StripeCount; i++) {
            lockdebug_lock_precedes_lock(&array[i-1].value, &array[i].value);
        }
    }

    void precedeLock(const void *newlock) {
        // assumes defineLockOrder is also called
        // 假定 defineLockOrder 已经被调用过
        lockdebug_lock_precedes_lock(&array[StripeCount-1].value, newlock);
    }

    void succeedLock(const void *oldlock) {
        // assumes defineLockOrder is also called
        // 假定 defineLockOrder 已经被调用过
        lockdebug_lock_precedes_lock(oldlock, &array[0].value);
    }
    
    // T 是 spinlock_t 时,根据指定下标 从 StripedMap<spinlock_t> -> array 中获取spinlock_t
    const void *getLock(int i) {
        if (i < StripeCount) return &array[i].value;
        else return nil;
    }
    
    // 构造函数,在 DEBUG 模式下会验证 T 是否是 64 位对齐
#if DEBUG
    StripedMap() {
        // Verify alignment expectations.
        // 验证 value<T> 是不是按照 CacheLineSize 内存对齐CacheLineSize
        uintptr_t base = (uintptr_t)&array[0].value;
        uintptr_t delta = (uintptr_t)&array[1].value - base;
        ASSERT(delta % CacheLineSize == 0);
        ASSERT(base % CacheLineSize == 0);
    }
#else
    constexpr StripedMap() {}
#endif
};
```
## 03、weak_referrer_t
用于伪装 __weak 变量的地址，即用于伪装 objc_object *的地址。
> The address of a __weak variable.
> These pointers are stored disguised so memory analysis tools don't see lots of interior pointers from the weak table into objects.
> ​

>  __weak 变量的地址(objc_object**)。这些指针被伪装存储,因此内存分析工具不会看到大量从弱引用表(weak table)到对象(objects)的内部指针。

```jsx
// 这里的 T 是 objec_object *, 那么 DisguisedPtr 里的 T* 就是objec_object **, 即为指针的指针.
typedef DisguisedPtr<objc_object *> weak_referrer_t;
```
## 04、PTR_MINUS_2
用于不同平台下标识位域长度.这里是用于 `struct weak_entry_t` 中 `num_refs` 的位域长度.
```jsx
// out_of_line_ness 和 num_refs 两者加在一起共用 64 bit 内存空间
uintptr_t        out_of_line_ness : 2;
uintptr_t        num_refs : PTR_MINUS_2; // 针对不同的平台 num_refs 是高 62 bit 或者高30 bit

```
```jsx
#if __LP64__
#define PTR_MINUS_2 62
#else
#define PTR_MINUS_2 30
#endif
```
## 05、WEAK_INLINE_COUNT
> The internal structure stored in the weak references table. 
> It maintains and stores a hash set of weak references pointing to an object.
> If out_of_line_ness != REFERRERS_OUT_OF_LINE then the set is instead a small inline array.
> ​

> 存储在弱引用表中的内部结构。 它维护和存储指向对象的弱引用哈希(weak_referrer_t)。 如果 out_of_line_ness != REFERRERS_OUT_OF_LINE 则该集合是一个小型内联数组(长度为 4 的weak_referrer_t数组)。

```jsx
#define WEAK_INLINE_COUNT 4
```
## 06、REFERRERS_OUT_OF_LINE
> out_of_line_ness field overlaps with the low two bits of inline_referrers[1].
> inline_referrers[1] is a DisguisedPtr of a pointer-aligned address.
> The low two bits of a pointer-aligned DisguisedPtr will always be 0b00
> (disguised nil or 0x80..00) or 0b11 (any other address).
> Therefore out_of_line_ness == 0b10 is used to mark the out-of-line state.
> ​

> ​out_of_line_ness 字段与 inline_referrers[1] 的低两位内存空间重叠。 inline_referrers[1] 是一个指针对齐地址的 DisguisedPtr。 指针对齐的 DisguisedPtr 的低两位将始终为 0b00(8字节对齐取得的地址的二进制表示的后 2 位始终是 0)（伪装为 nil 或 0x80..00）或 0b11（任何其他地址）。因此 out_of_line_ness == 0b10 用于标记out-of-line,即struct weak_entry_t 内部是使用哈希表存储 weak_referrer_t 而不再使用那个长度为 4 的 weak_referrer_t 数组。。
> out_of_line_ness 和 num_refs 两者加起来一起共用 64bit 的空间

```jsx
#define REFERRERS_OUT_OF_LINE 2 // 二进制表示 0010
```
## 07、struct weak_entry_t 
`weak_entry_t`的功能是保存所有指向某个对象的弱引用变量的地址
​

`weak_entry_t` 的哈希数组内存储的是 `DisguisedPtr<objc_object *> weak_referrer_t`, 实质上是弱引用变量的地址，即 `objc_object **new_referrer`, 通过操作指针的指针，就可以使得弱引用变量在对象析构后指向 `nil`。这里必须保存弱引用变量的地址，才能把它的指向置为 `nil`。
```jsx
struct weak_entry_t {
    // referent 中存放的是化身为整的 objcf_object 实例的地址,下面保存的一众弱引用变量都指向这个 objc_object 实例
    DisguisedPtr<objc_object> referent;
    
    // 当指向 referent 的弱引用个数 <= 4 时使用 inline_referent 数组保存这些弱引用变量的地址.
    // 当指向 referent 的弱引用个数 > 4 的时候用 referents 这个哈希数组来保存
    
    // 共用 32 个字节内存空间的联合体
    union {
        struct {
            weak_referrer_t *referrers; // 保存 weak_referrer_t 的哈希数组
            // out_of_line_ness 和 num_refs 两者加起来一起共用 64bit 的空间
            uintptr_t        out_of_line_ness : 2; // 标记使用哈希数组还是 inline_referent 保存 weak_referrer_t
            uintptr_t        num_refs : PTR_MINUS_2; // 当前 referrers 内保存的 weak_referrer_t的数量
            uintptr_t        mask; // referrers 哈希数组总长度减一,会参数哈希函数计算
            
            // 可能会发生 hash 冲突的最大数,用于判断是否出现了逻辑错误(hash表中冲突次数绝对不会超过该值
            // 该值在新建 weak_referrer_t 和插入新的 weak_referrer_t 时会被更新, 它一直记录的都是最大偏移值
            uintptr_t        max_hash_displacement;
        };
        struct {
            // out_of_line_ness field is low bits of inline_referrers[1]
            // 长度为 4 的 weak_referrer_t 数组
            weak_referrer_t  inline_referrers[WEAK_INLINE_COUNT];
        };
    };
    
    // 返回 true 代表使用 referrers 哈希数组来保存 weak_referrer_t
    // 返回 false 代表使用 inline_referrers 数组来保存 weak_referrer_t
    bool out_of_line() {
        return (out_of_line_ness == REFERRERS_OUT_OF_LINE);
    }
    
    // weak_entry_t 的赋值操作,直接使用 memcpy 函数拷贝 other 内存里面的内容到 this
    // 而不是复制构造函数什么的形式实现,应该也是为了提高效率?
    weak_entry_t& operator=(const weak_entry_t& other) {
        memcpy(this, &other, sizeof(other));
        return *this;
    }
    
    /*
     weak_entry_t 的构造函数
     
     newReferent: 原始对象的指针
     newReferrer: 指向 newReferent 的弱引用变量的指针
     
     初始化列表 referent(newReferent) 会调用:DisguisedPtr(T* ptr) : value(disguise(ptr)) { }构造函数
     调用 disguise 函数把 newReferent 转化为一个整数赋值给 value。
     */
    weak_entry_t(objc_object *newReferent, objc_object **newReferrer)
        : referent(newReferent)
    {
        // 把 newReferrer 放到数组 0 位,也会调用 DisguisedPtr 构造函数, 把 newReferrer 转化为整数保存
        inline_referrers[0] = newReferrer;
        // 循环把 inline_referrers 数组的剩余 3 位都置为 nil
        for (int i = 1; i < WEAK_INLINE_COUNT; i++) {
            inline_referrers[i] = nil;
        }
    }
};
```
`weak_entry_t` 内部之所以使用**定长数组/哈希数组**的切换，应该是考虑到实例对象的弱引用变量个数一般比较少，这时候用定长数组不需要在动态的申请空间(`union` 中两个结构体共用 `32`个字节内存)而是使用`weak_entry_t`初始化时一次分配的一块连续的内存空间，这会使运行效率提高。
## 08、struct weak_table_t 
> The global weak references table. Stores object ids as keys, and weak_entry_t structs as their values.
> ​

> weak_table_t 是全局的保存弱引用的哈希表。 将 object ids 存储为keys，和 weak_entry_t 结构作为它们的value 。

```jsx
struct weak_table_t {
    // 存储 weak_entry_t 的哈希数组
    weak_entry_t *weak_entries;
    size_t    num_entries; // 当前 weak_entries 保存 weak_entry_t 的数量
    uintptr_t mask; // 哈希数组总长度减一,会参数哈希函数计算
    
    // 记录所有项的最大偏移量，即发生 hash 冲突的最大次数，
    // 用于判断是否出现了逻辑错误，hash 表中的冲突次数绝对不会超过这个值。
    // 下面关于 weak_entry_t 的操作函数中会看到这个成员变量的使用，这里先对它有一些了解即可，
    // 因为会有 hash 碰撞的情况，而 weak_table_t 采用了开放寻址法来解决，
    // 所以某个 weak_entry_t 实际存储的位置并不一定是 hash 函数计算出来的位置。
    uintptr_t max_hash_displacement;
};

```
## **09、struct SideTable**
`struct SideTable`定义在 `NSObject.mm` 中。它管理了两块对开发者而言超级重要的内容：

-  一块是 `RefcountMap refcnts` 管理对象的引用计数
- 一块是 `weak_table_t weak_table` 管理对象的弱引用标量

`refents` 涉及的内容,暂时先不关注,着重看一下 `weak_table` 的内容
```jsx
// Template parameters. 模块参数
enum HaveOld { DontHaveOld = false, DoHaveOld = true }; // 是否有旧值
enum HaveNew { DontHaveNew = false, DoHaveNew = true }; // 是否有新值

struct SideTable {
    spinlock_t slock; // 每张SideTable表自带一把锁,而这把锁也对应了上面是抽象类型 T 必须为 StripedMap 提到的一些锁的接口函数
    RefcountMap refcnts; // 管理对象的引用计数
    weak_table_t weak_table; // 以 object ids为 keys,以 weak_entry_t 为 value 的哈希表,如果object ids有弱引用存在,则可从中找到对象的 weak_entry_t.

    // 构造函数,只做一件事,把 weak_table 的空间置为 0
    SideTable() {
        memset(&weak_table, 0, sizeof(weak_table));
    }
    // 析构函数(不能进行析构)
    ~SideTable() {
        // 看到 SideTable 是不能被析构的,如果进行析构则直接终止运行
        _objc_fatal("Do not delete SideTable.");
    }
    // 三个函数正对应了 StripeMap 中模板抽象类型 T 的接口要求,三个函数的内部都是直接调用 slock 的对应函数
    void lock() { slock.lock(); }
    void unlock() { slock.unlock(); }
    void forceReset() { slock.forceReset(); }

    // Address-ordered lock discipline for a pair of side tables.
    
    // HaveOld 和 HaveNew 分别表示 lock1 和 lock2 是否存在
    // 表示__weak 变量是否指向有旧值和目前要指向的新值
    
    // lock1 代表旧值对象所处的 SideTable
    // lock2 代表新值对象所处的 SideTable
    
    // lockTwo 是根据谁有值就调用谁的锁,触发加锁(c++方法重载)
    // 如果两个都有值,那么两个都加锁,并且根据谁低,先给谁加锁,然后另一个后加锁
    template<HaveOld, HaveNew> static void lockTwo(SideTable *lock1, SideTable *lock2);
		// 同上，对 slock 解锁
    template<HaveOld, HaveNew> static void unlockTwo(SideTable *lock1, SideTable *lock2);
};
```
`struct SideTable` 的结构很清晰：

- `spinlock_t slock`：自旋锁,保证操作 `SideTable` 时的线程安全.看前面的两大块 `weak_table_t` 和 `weak_entry_t` 的时候，看到它们所有的操作函数都没有提及加解锁的事情，如果你仔细观察的话会发现它们的函数名后面都有一个 `no_lock`的小微吗，正是用来提醒我们，它们的操作完全并没有涉及到加锁。其实它们是把保证它们线程安全的任务交给了`SideTable`，下面可以看到 `SideTable` 提供的函数都是线程安全的，而这都是由 `slock` 来完成的。
- `RefcountMap refcnts`：以```DisguisedPtr<objc_object>```为 `key`，以 `size_t` 为 `value` 的哈希表，用来存储对象的引用计数。(仅在未使用 `isa` 优化或者 `isa` 优化情况下 `isa_t` 中保存的引用计数溢出时才会用到，这里涉及到 `isa_t` 里 `uintptr has_sidetable_rc` 和 `uintptr extra_rc` 两个字段，以前只是单纯的看 `isa` 的结构，到这里终于被用到了，还有这时候终于知道 `rc` 其实是 `refcount`(引用计数)的缩写)。作为哈希表,它使用的是平安探测法从哈希表中取值，而 `weak_table_t` 则是线性探测(开放寻址法)。
- ```weak_table_t weak_table```：存储对象弱引用的哈希表，是```weak```功能实现的核心数据结构。
## 10、```using spinlock_t = mutex_tt<LOCKDEBUG>```
`spinlock_t` 原本是一个 `uint32_t` 类型的非公平的自选锁,由于其安全问题,目前底层实现已由互斥锁`os_unfair_lock`锁代替，所谓非公平是指：获得锁的顺序和申请锁的顺序无关，也就是说，第一个申请锁的线程有可能会最后一个获得锁,或者刚获得锁的线程会再次立刻获得该锁,造成其他线程忙等(busy_wait)。
​

`os_unfair_lock` 在其成员变量`_os_unfair_lock_opaque`中记录了当前获取它的线程信息，只有获得更该锁的线程才能够解开这把锁。
```jsx
 OS_UNFAIR_LOCK_AVAILABILITY
 typedef struct os_unfair_lock_s {
     uint32_t _os_unfair_lock_opaque;
 } os_unfair_lock, *os_unfair_lock_t;
 
```
## 11、```template <typename Type> classExplicitInit```
> We cannot use a C++ static initializer to initialize certain globals because libc calls us before our C++ initializers run. We also don't want a global pointer to some globals because of the extra indirection.
> ​

> ExplicitInit / LazyInit wrap doing it the hard way.
> ​

> ​我们不能使用 C++ static initializer 来初始化某些全局变量，因为 libc 在 C++ initializers 调用之前调用了我们。
> ​因为额外的间接性,我们也不需要指向某些全局变量的全局指针。ExplicitInit / LazyInit 包装很难做到这一点。

```jsx
template <typename Type>
class ExplicitInit {
    // typedef unsigned char uint8_t 长度为 1 个字符的 int,实际类型是无符号的 char
    
    // alignas(Type) 表示 _storage 内存对齐方式通抽象类型Type
    // _storage 的长度为 sizeof(Type) 的 uint8_t 类型数组
    alignas(Type) uint8_t _storage[sizeof(Type)];

public:
    // 初始化
    template <typename... Ts>
    void init(Ts &&... Args) {
        new (_storage) Type(std::forward<Ts>(Args)...);
    }
    // 把_storage数组起始地址强制转化为Type *
    Type &get() {
        return *reinterpret_cast<Type *>(_storage);
    }
};
```
## 12、```static StripedMap<SideTable>& SideTables()```

`SideTables` 是一个类型是```StripedMap<SideTable>```的静态全局哈希。通过上面`StripedMap`的学习，已知在 `iphone`下，它是固定长度为 `8` 的哈希数组，在 `mac` 下是固定长度为 `64`的哈希数组,自带一个简单的哈希函数，
根据 `void*`入参计算哈希值,然后根据哈希值取得哈希数组中对应的 `T`。
`SideTables`中则是取得的 `T`是 `SideTable`。
```jsx
// ExplicitInit 内部_storage 数组长度是: alignas(Type) uint8_t _storage[sizeof(Type)];
static objc::ExplicitInit<StripedMap<SideTable>> SideTablesMap;

static StripedMap<SideTable>& SideTables() {
    return SideTablesMap.get();
}
```
`SideTables()` 下面定义了多个与锁相关的全局函数,内部实现是调用`StripeMap`的模板抽象类型 T 所支持的函数接口，对应 `SideTables` 的 T 类型是 `SideTable`， 而`SideTable`执行对应的函数时正式调用了它的`spinlock_t slock` 成员变量的函数。这里采用了分离锁的机制,即一张 `SideTable`一把锁，减轻并处理多个对象时阻塞压力。
## 13、weak_entry_for_referent
根据给定的`referent` (对象变量)和`weak_table_t`哈希表,查找其中的`weak_entry_t`(存放所有指向 `referent`的弱引用变量的地址的哈希表)并返回,如果未找到返回 `NULL`
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
## 14、hash_pointer
```
// hash_pointer 哈希函数返回值与 mask 做与操作,防止 index 越界,这里的&mask操作很巧妙,后面会进行详细讲解
size_t begin = hash_pointer(referent) & weak_table->mask;
```
`hash_pointer(referent)`调用通用的指针哈希函数，后面的 `& weak_table->mask`位操作来确保得到的 `begin` 不会越界，同我们日常使用的`取模操作（%）`是一样的功能，只是改为了位操作，提升了效率。
### 14.1 mask & 操作确保 begin 不越界
这里的`与运算`其实很巧妙，首先是 `mask` 的值一直是 `2` 的 `N` 次方减 `1` ，根据 `weak_grow_maybe` 函数，我们会看到哈希数组（`weak_entry_t *weak_entries`）的长度最小是 `64`，即 `2` 的 `6` 次方（`N >= 6`），以后的每次扩容是之前的长度乘以 `2`，即总长度永远是 `2` 的 `N` 次方，然后 `mask` 是 `2` 的 `N`次方减 `1`，转为二进制的话：`mask` 一直是: `0x0111111(64 - 1，N = 6)`、`0x01111111(128 - 1，N = 7)`...., 即 `mask` 的二进制表示中后 `N` 位总是 `1`，之前的位总是 `0`，所以任何数与 `mask` 做与操作的结果总是在 `[0, mask]` 这个区间内。例如任何数与 `0x0111111(64 - 1，N = 6)`做与操作的话结果总是在 `[0, 63]` 这个区间内。而这个正是 `weak_entry_t *weak_entries` 数组的下标范围。
```jsx
// 哈希函数,与 mask 做与操作,防止 index 越界
static inline uintptr_t hash_pointer(objc_object *key) {
    // 把指针强转化为 unsigned long,然后调用 ptr_hash 函数
    return ptr_hash((uintptr_t)key);
}

/*
 ptr_hash 函数区分 64 位和 32 位的情况
 */
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
## 15、添加、移除 referrer（weak 变量的地址）到 weak_entry_t 及 weak 变量指向置为 nil 等函数的声明
`weak_table_t` 下面是四个函数声明，这里我们只要看下它们的作用就好，具体的分析过程在《iOS weak 底层实现原理(二)：objc-weak 函数列表全解析》。
### 15.1 weak_register_no_lock
添加一对(`object`，`weak pointer`)到弱引用表里. 当一个对象存在第一个指向它的 `weak` 变量时,此时会把对象注册进 `weak_table_t` 的哈希表中,同时也会把这第一个 `weak` 变量的地址保存进对象的 `weak_entry_t` 哈希表中,如果这个 `weak`变量不是第一个的话，表明这个对象此时已经存在于 `weak_table_t`哈希表中,此时需要把这个指向它的`weak`变量的地址保存进该对象的`weak_entry_t`哈希表中
```jsx
/// Adds an (object, weak pointer) pair to the weak table.
// 将对象、弱引用指针添加到弱引用表中
id weak_register_no_lock(weak_table_t *weak_table, id referent, 
                         id *referrer, WeakRegisterDeallocatingOptions deallocatingOptions);
```
### 15.2 weak_unregister_no_lock
从弱引用表里移除一对(`object`，` weak pointer`)。(从对象的 `weak_entry_t` 哈希表中移除一个 `weak` 变量的地址)
```jsx
/// Removes an (object, weak pointer) pair from the weak table.
// 从弱引用表中移除一个对象或者弱引用指针
void weak_unregister_no_lock(weak_table_t *weak_table, id referent, id *referrer);
```
### 15.3 weak_is_registered_no_lock
如果一个对象在弱引用表的某处,即该对象被保存都在弱引用表里(该对象存在弱引用),则返回 true
```jsx
#if DEBUG
/// Returns true if an object is weakly referenced somewhere.
// 如果么个对象在某处被弱引用，就返回 true
bool weak_is_registered_no_lock(weak_table_t *weak_table, id referent);
#endif
```
### 15.4 weak_clear_no_lock
当对象销毁的时候该函数会调用。设置所有剩余的`__weak`变量指向`nil`，此处正对应了我们日常挂在嘴边上的：`__weak`变量在它指向的对象被销毁后它便会置为 `nil` 的机制。
```jsx
/// Called on object destruction. Sets all remaining weak pointers to nil.
// 在销毁对象的时候，将所有弱引用指针清空
void weak_clear_no_lock(weak_table_t *weak_table, id referent);
```
## 16、调整 weak_table_t 哈希数组长度
以 `weak_table_t`位参数，调用`weak_grow_maybe`和`weak_compact_maybe`函数，用来当 `weak_table_t`哈希数组过满 或者过空的情况下及时调整其长度,优化内存的使用效率，并提高哈希查找效率。这两个函数通过调用`weak_resize`函数来调整`weak_table_t`哈希数组的长度。
### 16.1 weak_grow_maybe
此函数会在创建`weak_entry_t`和把`new_entry`添加到`weak_table_t`哈希数组之间调用，下面看下它的实现。
```jsx
// 如果给定区域的弱引用表已满,则进行扩展
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
该函数用于扩充 `weak_table`的`weak_entry_t *weak_entries`的长度，扩充条件是`num_entries`超过了 `mask +1`的 3/4。看到 `weak_entries`的初始化长度是 `64`,每次扩充的长度则是 `mask+1`的 `2` 倍，扩充完毕后会把原哈希数组中的 `weak_entry_t`重新哈希化插入到新空间内，并更新 `weak_table_t`各成员变量。占据的内存空间的总容量则是`(mask+1) *size(weak_entry_t)`字节。综上 `mask + 1`总是`2`的`N`次方。(初始时`N`是 `2^6`，以后则是`N>=6`)。
### 16.2 weak_compact_maybe
此函数会在`weak_entry_remove`函数中调用，旨在`weak_entry_t`从`weak_table_t`的哈希数组中移除后，如果哈希数组中占用比较低的话，缩小`weak_entry_t *weak_entries`的长度，优化内存使用，同时提高哈希效率。
```jsx
// Shrink the table if it is mostly empty.
// 即当 weak_table_t 的 weak_entry_t *weak_entries 数组大部分空间为空的情况下,所以 weak_entries 的长度
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
缩小`weak_entry_t *weak_entries`的长度的条件是目前的总长度超过了`1024`，并且容量占用比小于`1/16`，`weak_entries`空间缩小到当前空间的`1/8`。
### 16.3 weak_resize
扩大和缩小空间都会调用`weak_resize`公共函数，入参是`weak_table_t`和一个指定的长度
```jsx
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
### 16.4 weak_entry_insert
把`weak_entry_t`添加到`weak_table_t->weak_entries`中。
```jsx
/** 
 * Add new_entry to the object's table of weak references.
 * 添加 new_entry 到保存对象的 weak 变量地址的哈希表中
 * Does not check whether the referent is already in the table.
 * 不用刚检查引用对象是否已在表中
 */
// 把 weak_entry_t 添加到 weak_table_t -> weak_entries 中
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
### 16.5 总结
综上，`weak_entry_insert`函数可知`weak_resize`函数的整体作用，该函数对哈希数组长度进行扩大和缩小，首先根据`new_size`申请相应大小的内存，`new_entries`指针指向这块新申请的内存。设置 `weak_table`的`mask`为`new_size-1`。此处`mask`的作用记录`weak_table`总容量的内存边界，此外`mask`还用于哈希函数中保证`index`不会发生哈希数组越界。
​

`weak_table_t`的哈希数组可能会发生哈希碰撞，而`weak_table_t`使用了开放寻址法来处理碰撞。如果发生碰撞，将寻找相邻(如果已经到最尾端的话,则从头开始)的下一个空位。`max_hash_displacement`记录当前`weak_table`发生过的最大的偏移值。辞职会在其他地方用到.例如：`weak_entry_for_referent`函数，寻找给定的 referent 的弱引用表中的 entry 时如果在循环过程中 `hash_displacement`的值超过了`weak_table->max_hash_displacement`则表示，不存在要找到的`weak_entry_t`。
​

## 参考链接

- [使用intptr_t和uintptr_t](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2F03b7d56bf80f)
- [Objective-C runtime机制(7)——SideTables, SideTable, weak_table, weak_entry_t](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fu013378438%2Farticle%2Fdetails%2F82790332)
- [iOS管理对象内存的数据结构以及操作算法--SideTables、RefcountMap、weak_table_t-二](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2F8577286af88e)
- [C++11可变参数模板（函数模板、类模板）](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fqq_38410730%2Farticle%2Fdetails%2F105247065%3Futm_medium%3Ddistribute.pc_relevant.none-task-blog-BlogCommendFromMachineLearnPai2-2.channel_param%26depth_1-utm_source%3Ddistribute.pc_relevant.none-task-blog-BlogCommendFromMachineLearnPai2-2.channel_param)
- [C++11新特性之 std::forward(完美转发)](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fwangshubo1989%2Farticle%2Fdetails%2F50485951%3Futm_medium%3Ddistribute.pc_relevant.none-task-blog-BlogCommendFromMachineLearnPai2-3.channel_param%26depth_1-utm_source%3Ddistribute.pc_relevant.none-task-blog-BlogCommendFromMachineLearnPai2-3.channel_param)
- [llvm中的数据结构及内存分配策略 - DenseMap](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fdashuniuniu%2Farticle%2Fdetails%2F80043852)
- [RunTime中SideTables, SideTable, weak_table, weak_entry_t](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2F48a9a9ec8779)
- [iOS weak 底层实现原理(一)：SideTable|s、weak_table_t、weak_entry_t 等数据结构](https://juejin.cn/post/6865468675940417550#heading-7)​
