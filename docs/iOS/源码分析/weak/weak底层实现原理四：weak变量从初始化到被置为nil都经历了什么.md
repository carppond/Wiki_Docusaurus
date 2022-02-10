---
id: weak底层实现原理四：weak变量从初始化到被置为nil都经历了什么
slug: weak底层实现原理四：weak变量从初始化到被置为nil都经历了什么.html
title: 04 | weak变量从初始化到被置为nil都经历了什么
author: 鲤鱼
description: weak底层实现原理
tag:
  - iOS基础知识
---

## 1. 寻找 weak 变量初始化入口
在`main.m`中编写如下代码，在函数最后打断点，并打开汇编模式：
```jsx
#import <UIKit/UIKit.h>

int main(int argc, char * argv[]) {
    @autoreleasepool {
     
        id obj = [NSObject new];
        id obj2 = [NSObject new];
        printf("start tag\n");
        {
            __weak id weakPtr = obj; // 调用 objc_initWeak 进行 weak 变量初始化
            weakPtr = obj2; // 修改 weak 变量指向
        }
        // 除了这个右括号调用 objc_destroyWeak 函数进行 weak 销毁
        // 这里是 weak 变量销毁,并时不时 weak 变量指向的对象销毁
        
        printf("end tag\n"); //  ⬅️ 断点打在这里
    }
    return 0;
    
}
```
运行后，会进入断点，这里我们只关注`start tag`和`end tag`之间的部分，汇编反应如下：
```jsx
  ....
  0x102c39f14 <+84>:  bl     0x102c3a464               ; symbol stub for: printf
  0x102c39f18 <+88>:  ldr    x1, [sp, #0x18]
  0x102c39f1c <+92>:  add    x0, sp, #0x8              ; =0x8 
  0x102c39f20 <+96>:  bl     0x102c3a404               ; symbol stub for: objc_initWeak
  weak 变量的初始化
  0x102c39f24 <+100>: ldr    x1, [sp, #0x10]
  0x102c39f28 <+104>: add    x0, sp, #0x8              ; =0x8 
  0x102c39f2c <+108>: bl     0x102c3a458               ; symbol stub for: objc_storeWeak
  修改 weak 变量指向
  0x102c39f30 <+112>: add    x0, sp, #0x8              ; =0x8 
  0x102c39f34 <+116>: bl     0x102c3a3f8               ; symbol stub for: objc_destroyWeak
  // 销毁 weak 变量
  0x102c39f38 <+120>: adrp   x0, 1
  0x102c39f3c <+124>: add    x0, x0, #0x5f7            ; =0x5f7 
  0x102c39f40 <+128>: bl     0x102c3a464               ; symbol stub for: printf
  ...
```
`br`指令表示函数调用，看到与`weak`变量相关函数是：`objc_initWeak`、`objc_storeWeak`、`objc_destroyWeak`，它们分别表示初始化`weak`变量、`weak`变量赋值(修改指向)、销毁`weak`变量。
​

下面分析下`weak`变量初始化函数，在`objc4-818`中全局搜索`objc_initWeak`，在`objc-internal.h` 文件中，可以看到 `objc_initWeak`函数声明如下：
```jsx
OBJC_EXPORT id _Nullable 
objc_initWeak(id _Nullable * _Nonnull location, id _Nullable val)
    OBJC_AVAILABLE(10.7, 5.0, 9.0, 1.0, 2.0);
```
可以看出是从`iOS 5.0`后出现的，这里联想到 `ARC`、`weak`关键字等都是`iOS 5.0`后推出的。在 `NSObject.mm`文件中找到了`objc_initWeak`函数实现。
## 2. objc_initWeak
> Initialize a fresh weak pointer to some object location. It would be used for code like: 
> 初始化指向某个对象位置的新的 weak pointer（当旧 weak pointer 发生赋值（修改指向）时：首先对当前的指向进行清理工作）：
> ​

> (The nil case) 
> __weak id weakPtr;
> (The non-nil case) 
> NSObject *o = ...;
> __weak id weakPtr = o;
> ​

>  This function IS NOT thread-safe with respect to concurrent modifications to the weak variable. (Concurrent weak clear is safe.)
> 对于 weak 变量的并发修改，此函数不是线程安全的。（并发进行 weak clear 是线程安全的（概念上可以理解为是并发读操作是线程安全的））

```jsx
// Template parameters. 模块参数
enum HaveOld { DontHaveOld = false, DoHaveOld = true }; // 是否有旧值
enum HaveNew { DontHaveNew = false, DoHaveNew = true }; // 是否有新值
```
牢记这几个枚举值：

- `HaveOld
   - `HaveOld`如果是`true`，表示`__weak`变量目前有指向一个对象。
   - `HaveOld`如果是`false`，表示`__weak`变量暂没有指向，当前对象是刚才创建的
      - `DontHaveOld`：HaveOld = false` 
      - `DoHaveOld`：`HaveOld = true`
- `HaveNew`
   - `HaveNew`如果是`true`，表示`__weak`变量赋值的右侧对象是有值的。`newObj`有值
   - `HaveNew`如果是`false`，表示`__weak`变量赋值的右侧对象是无值的。`newObj`没有值，`__weak`变量会被指向`nil`
      - `DontHaveNew`：`HaveNew = false`
      - `DoHaveNew`：`HaveNew = true`
```jsx
/*
 * @param location Address of __weak ptr.
 * __weak 变量的地址 (objc_object **) (ptr 是 pointer 的缩写，id 是 struct objc_object *)
 *
 * @param newObj Object ptr.  对象实例指针
 */
id
objc_initWeak(id *location, id newObj)
{
    // 如果对象不存在
    if (!newObj) {
        // 看到这个赋值用的是 *location,表示把__weak变量指向 nil,然后直接 return nil
        *location = nil;
        return nil;
    }
    /*
     storeWeak是一个模板函数,DontHaveOld表示没有旧值,表示这里是新初始化__weak变量.
     DoHaveNew表示有新值,新值即为newObj
     DoCrashIfDeallocating如果 newObj 的 isa 已经被标记为 deallocating 或者 newObj 所属的类不支持弱引用,则crash
     */
    return storeWeak<DontHaveOld, DoHaveNew, DoCrashIfDeallocating>
        (location, (objc_object*)newObj);
}
```
`objc_initWeak`函数接收两个参数:

-  `id *location`: `__weak`变量的地址，即示例代码中`weak`变量取地址：`&weakPt`r`，它是一个指针的指针，之所以要存储指针的指针，是因为`weak`变量指向的对象释放后。要把`weak`变量指向置为 `nil`，如果仅存指针(即`weak`变量所指向的地址值)的话，是不能够完成这个设置的。
> 这里联想到对链表做一些操作时，函数入参会使链表头指针的指针。

> 这里如果对指针不是特别熟悉的话，可能会有一些迷糊，为什么用指针的指针，我们直接在函数内修改参数的指向时，不是同样也修改了外部指针的指向吗？其实非然！一定要理清，当函数形参是指针时，实参传入的是一个地址，然后在函数内部创建一个临时指针变量，这个临时指针变量指向的地址是实参传入的地址，此时如果你修改指向的话，修改的只是函数内部的临时指针变量的指向。外部的指针变量是与它无关的，有关的只是初始时它们两个指向的地址是一样的。而我们对这个地址里面内容的所有操作，都是可反应到指向该地址的指针变量那里的。这个地址是指针指向的地址，如果没有`const`限制，我们可以对该地址里面的内容做任何操作即使把内容置空放0，这些操作都是对这个地址的内存做的，不管怎样这块内存都是存在的，它地址一直都在这里，而我们的原始指针一直就是指向它，此时我们需要的是修改原始指针的指向，那我们只有知道指针自身的地址才行，我们把指针自身的地址的内存空间里面放`0x0`, 才能表示把我们的指针指向置为了 `nil`！

- `id newObj`：所用的的对象,即示例代码中的` obj`

​

该方法有一个返回值，返回的是`storeWeak`函数的返回值：返回的其实还是`obj`，但是已经对`obj`的 `isa(isa_t)`的`weakly_referenced`位设置为`1`，标识该对象有弱引用存在，当该对象销毁时，要处理指向它的那些弱引用，`weak`变量被置为`nil`的机制就是从这里实现的。
​

看`objc_initWeak`函数的实现可知，它内部是调用`storeWeak`函数，且执行时的模板参数是`DontHaveOld`(没有旧值)，这里实质`weakPtr`之前没有指向任何对象，我们的`weakPtr`是刚刚初始化的，自然没有指向旧值。这里涉及到的是，当`weak`变量改变指向时，要把该`weak`变量地址从它之前指向对象的`weak_entry_t`哈希数组中移除。`DoHaveNew`表示有新值。


`**storeWeak**`**函数实现的核心功能如下:**

- 将`weak`变量的地址`location`存入`obj`对应的`weak_entry_t`哈希数组(或定长为`4`的内部数组)中，用于在`obj`析构时，通过该`weak_entry_t`哈希数组(或定长为`4`的内部数组)找到其所有的`weak`变量地址，将`weak`变量指向地址(`*location`)置为`nil`。
- 如果启用了`isa`优化，则将`obj`的`isa_t`的`weakly_referenced`位置为 `1`，置为`1`的作用是标记该`obj`存在`weak`引用。当对象`dealloc`时，`runtime`会根据 `weakly_referenced`标志位来判断是否需要查找`weak_entry_t`，并将它的所有弱引用置为`nil`。

​

`__weak id weakPtr = obj`一句完整的白话理解就是:拿着`weakPtr`的地址和`obj`，调用 `objc_initWeak`函数，把`weakPtr`的地址添加到`objc`的弱引用哈希表`weak_entry_t`的哈希数数组中。并把`obj`的地址赋给`*location(*location = (id)newObj)`，然后把`obj`的`isa`的`weakly_referenced`字段置为 `1`，最后返回`obj`。
​

从`storeWeak`函数实现就要和前几篇内容连起来了，激动~~~
## 3. storeWeak
分析`storeWeak`函数源码实现：
> Update a weak variable.If HaveOld is true, the variable has an existing value that needs to be cleaned up. This value might be nil. If HaveNew is true, there is a new value that needs to be  assigned into the variable. This value might be nil.  If CrashIfDeallocating is true, the process is halted if newObj is deallocating or newObj's class does not support weak references.  If CrashIfDeallocating is false, nil is stored instead.
> ​

> ​更新一个 weak 变量.如果HaveOld为 true,则该 weak 变量需要清除现有值.该值可能为 nil.如果HaveNew为 true,则需要将一个新值分配给 weak
> ​变量.该值可能为 nil.如果CrashIfDeallocating为 true,如果 newObj 的 isa 已经被标记为deallocating或 newObj所有的类不支持弱引用,
> ​程序将 crash;如果CrashIfDeallocating为 false,则发生以上问题只是在 weak 变量中存入 nil 的时候

```jsx
enum CrashIfDeallocating { // 所属的类不支持弱引用，函数执行时会 crash，
    DontCrashIfDeallocating = false, DoCrashIfDeallocating = true
};

// 模板参数
enum HaveOld { DontHaveOld = false, DoHaveOld = true }; // 是否有旧值
enum HaveNew { DontHaveNew = false, DoHaveNew = true }; // 是否有新值

template <HaveOld haveOld, HaveNew haveNew,
          enum CrashIfDeallocating crashIfDeallocating>
          
static id 
storeWeak(id *location, objc_object *newObj)
{
    // 如果haveOld为假且haveNew也为假,表示没有新值也没有旧值,则执行断言
    ASSERT(haveOld  ||  haveNew);
    
    // 如果一开始就标识没有新值,切你的 newObj == nil 确实没有新值,则能正常执行函数,否则直接断言
    if (!haveNew) ASSERT(newObj == nil);

    // 指向 objc_class 的指针,指向 newObj的 Class,标记 newObj 的 Class 已经完成初始化
    Class previouslyInitializedClass = nil;
    // __weak 变量之前指向的旧对象
    id oldObj;
    
    // 这里有个疑问,对象是在什么时候放进 SideTable 中的
    
    // 旧值所处的 SideTable
    SideTable *oldTable;
    // 新值所处的 SideTable
    SideTable *newTable;

    // Acquire locks for old and new values.
    // Order by lock address to prevent lock ordering problems. 
    // Retry if the old value changes underneath us.
    
    // 取得旧值和新值所处的 SideTable 里面的spinlock_t.(SideTable->slock)
    // 根据上面两个锁的锁地址进行排序,以防止出现加锁时出现锁排序问题
    // 重试,如果旧值在下面函数执行过程中发生了改变
    // 这里用到 C 语言的 goto 语句,goto 语句可以直接跳到指定位置执行.(直接修改函数执行顺序)
 retry:
    if (haveOld) {
        // 如果有旧值,这个旧值表示是传进来的 weak 变量目前指向的对象
        // 解引用(*location)赋给oldObj
        oldObj = *location;
        // 取得旧值所处的SideTable
        oldTable = &SideTables()[oldObj];
    } else {
        // 如果 weak ptr 目前没有指向其他对象,则给oldTable赋值 nil
        oldTable = nil;
    }
    if (haveNew) {
        // 取得 newObj 所处的newTable
        newTable = &SideTables()[newObj];
    } else {
        // 没有新值,newObj 位 nil,newTable也赋值 nil
        newTable = nil;
    }
    // 这里根据haveOld和 haveNew 两个值,判断是否对 oldTable 和 newTable 这两个 SideTable 加锁
    
    // 加锁擦咯做,防止多线程中竞争冲突
    SideTable::lockTwo<haveOld, haveNew>(oldTable, newTable);

    // 此处*location 应该与 oldObj 保持一致,如果不同,说明在加锁之前*location 已被其他线程修改
    if (haveOld  &&  *location != oldObj) {
        // 解锁,跳转到 retry 处再重新执行函数
        SideTable::unlockTwo<haveOld, haveNew>(oldTable, newTable);
        goto retry;
    }

    // Prevent a deadlock between the weak reference machinery
    // and the +initialize machinery by ensuring that no 
    // weakly-referenced object has an un-+initialized isa.
    
    // 确保没有弱引用的对象具有未初始化的 isa
    // 防止 weak reference machinery 和 +initialize machinery 之间出现死锁
    
    // 有新值 haveNew 并且 newObj 不为 nil,判断 newObj 所属的类有没有初始化,如果没有初始化就进行初始化
    if (haveNew  &&  newObj) {
        // newObj所处的类
        Class cls = newObj->getIsa();
        // previouslyInitializedClass 记录正在进行初始化的类防止重复进入
        // 如果当前类没有初始化就初始化
        if (cls != previouslyInitializedClass  &&  
            !((objc_class *)cls)->isInitialized()) 
        {
            // 如果 cls 还没有初始化,先初始化,在尝试设置 weak
            
            // 解锁
            SideTable::unlockTwo<haveOld, haveNew>(oldTable, newTable);
            // 调用对象所在类(不是元类)的初始化方法,即调用的是[newObj initlize] 类方法
            class_initialize(cls, (id)newObj);

            // If this class is finished with +initialize then we're good.
            // 如果这个 class 完成了 +initialize初始化,这对我们而言是一个好结果
            
            // If this class is still running +initialize on this thread 
            // (i.e. +initialize called storeWeak on an instance of itself)
            // then we may proceed but it will appear initializing and 
            // not yet initialized to the check above.
            // 如果这个类在这个线程中完成了+initialize的任务,那么这很好
            // 如果这个类还在这个线程中继续执行着+initialize任何,(比如这个类的实例在调用 storeWeak 方法,而 storeWeak 方法调用了+initialize).这样我们可以继续执行,但是上面它将进行初始化和尚未初始化的检查
            // 相反,在重试时设置previouslyInitializedClass位 newObj 的 class 来识别它
            // Instead set previouslyInitializedClass to recognize it on retry.
            //这里记录一下previouslyInitializedClass,防止该 if 分支再次进入
            previouslyInitializedClass = cls;

            goto retry;
        }
    }

    // Clean up old value, if any.
    // 清理旧值,如果有旧值,就进行weak_unregister_no_lock操作
    if (haveOld) {
        // 把 location 从 oldObj的 weak_entry_t 的哈希数组中移除
        weak_unregister_no_lock(&oldTable->weak_table, oldObj, location);
    }

    // Assign new value, if any.
    // 如果有新值,则执行weak_register_no_lock操作
    
    if (haveNew) {
        // 调用weak_register_no_lock方法把 weak ptr 的地址记录到 newObj 的 weak_entry_t 的哈希数组中
        // 如果newObj 的 isa 已经被标记为 deallocating 或 newObj 所属的类不支持弱引用,则weak_register_no_lock中会 crash
        newObj = (objc_object *)
            weak_register_no_lock(&newTable->weak_table, (id)newObj, location, 
                                  crashIfDeallocating ? CrashIfDeallocating : ReturnNilIfDeallocating);
        // weak_register_no_lock returns nil if weak store should be rejected

        // Set is-weakly-referenced bit in refcount table.
        
        /*
         设置一个对象有弱引用分为两种情况
         - 当对象的 isa 是有优化的 isa 时,更新 newObj 的 isa 的 weakly_referenced 标识位
         - 如果对象的 isa 是原始 class 指针时,它的引用计数和弱引用标识等信息都是在 refcount 中引用计数内.(不同的标识不同的信息)
            - 需要从 refcount 中找到对象的引用计数值(类型是 size_t),该引用计数值的第一位标识标识该对象是否有弱引用(SIDE_TABLE_WEAKLY_REFERENCED)
         
         */
        if (!newObj->isTaggedPointerOrNil()) {
            // 终于找到了,设置 struct objc_object 的 isa(isa_t)中 uintptr weakly_referenced : 1
            // 如果 isa 是原始指针时,设置 isa 最后一位是 1
            newObj->setWeaklyReferenced_nolock();
        }

        // Do not set *location anywhere else. That would introduce a race.
        // 请勿在其他地方设置*location,可能会引起竞争
        // *location 赋值,weak ptr 直接指向 newObj,可以看到这里并没有将 newObj 的引用计数+1
        *location = (id)newObj;
    }
    else {
        // No new value. The storage is not changed.
        // 没有新值,不发生改变
    }
    
    // 解锁,其他线程可以访问haveOld, haveNew了
    SideTable::unlockTwo<haveOld, haveNew>(oldTable, newTable);

    // This must be called without the locks held, as it can invoke
    // arbitrary code. In particular, even if _setWeaklyReferenced
    // is not implemented, resolveInstanceMethod: may be, and may
    // call back into the weak reference machinery.
    // 返回 new,此时的 newObj 与传入时相比,weakly_referenced 位被置为 1(如果开始就是 1,不发生改变)
    callSetWeaklyReferenced((id)newObj);

    return (id)newObj;
}
```
storeWeak 的流程图如下：
![image.png](https://cdn.nlark.com/yuque/0/2022/png/1424701/1643198355135-479143ea-b095-4836-addc-b7fb27ed63cd.png#clientId=u6590fabb-7957-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=2183&id=ue6f8e2f6&margin=%5Bobject%20Object%5D&name=image.png&originHeight=2183&originWidth=1470&originalType=binary&ratio=1&rotation=0&showTitle=false&size=731457&status=done&style=none&taskId=u90b43736-f742-41d2-be56-a5308900146&title=&width=1470)
`storeWeak`实际上接收`5`个参数，其中`HaveOld haveOld`、`HaveNew haveNew`、`CrashIfDeallocating crashIfDeallocating`这三个参数是以模板枚举的方式传入的，其实这是三个 `bool`参数，具体到`objc_initweak`函数，这三个值分别为`false`、`true`、`true`。因为是初始化`weak`变量必然有新值,没有旧值。
## 4. objc_storeWeak
`__weak`变量赋一个新值时，调用了`objc_storeWeak`，那么看一下`objc_storeWeak`函数的源码。
> This function stores a new value into a __weak variable. It would be used anywhere a __weak variable is the target of an assignment.
> ​

> 此函数将新值存储到 __weak 变量中。 它将用于任何 __weak 变量是赋值目标的地方。

```jsx
/* 
 * @param location The address of the weak pointer itself 弱指针本身的地址
 * @param newObj The new object this weak ptr should now point to 这个弱指针现在应该指向的新对象
 * 
 * @return \e newObj
 */
id
objc_storeWeak(id *location, id newObj)
{
    // DoHaveOld 有旧值
    // DoHaveNew 有新值
    return storeWeak<DoHaveOld, DoHaveNew, DoCrashIfDeallocating>
        (location, (objc_object *)newObj);
}
```
内部也是直接对`storeWeak`的调用，`DoHaveOld`和`DoHaveNew`都为`true`，表示这次我们要先处理`__weak`变量当前的指向(`weak_unregister_no_lock`)，然后`__weak`变量指向新的对象(`weak_register_no_lock`)。
​

到这里我们就已经很清晰了，`objc_initWeak`用于`__weak`变量的初始化，内部只需要 `weak_register_no_lock`相关的调用，然后当对`__weak`变量赋值时，则是先处理它对旧值的指向(`weak_unregister_no_lock`)，然后再处理它的新指向(`weak_register_no_lock`)。
## 5. objc_destroyWeak
示例代码中作为局部变量的`__weak`变量出了右边花括号它的作用域就结束了，必然会进行释放销毁，汇编代码中我们看到了`objc_destroyWeak`函数被调用，看名字它应该是`__weak`变量销毁时所调用的函数。如果`__weak`变量比它所指向的对象更早销毁，那么它所指向的对象的`weak_entry_t`的哈希数组中存放该`__weak`变量的地址要怎么处理呢？那么一探`objc_destroyWeak`函数的究竟应该你能找到答案。
> Destroys the relationship between a weak pointer and the object it is referencing in the internal weak table. If the weak pointer is not referencing anything,  there is no need to edit the weak table. 
> ​

> 销毁弱指针和它在内部弱表中引用的对象之间的关系。（对象的`weak_entry_t`的哈希数组中保存着该对象的所有弱引用的地址，这里意思是把指定的弱引用的地址从`weak_entry_t`的哈希数组中移除。） 如果 `weak pointer`未指向任何内容，则无需编辑`weak_entry_t`的哈希数组。
> ​

> This function IS NOT thread-safe with respect to concurrent  modifications to the weak variable. (Concurrent weak clear is safe.)
> ​

> 对于弱引用的并发修改，此函数不是线程安全的。 （并发进行`weak clear`是线程安全的）

```jsx
/*
 * @param location The weak pointer address. 弱指针地址。
 */
void
objc_destroyWeak(id *location)
{
    // 看到内部直接调用 storeWeak 函数,参数如下:
    // DoHaveOld 有旧值
    // DontHaveNew 没有新值
    // DontCrashIfDeallocating false
    // location weak 变量的地址
    // newObj nil
    (void)storeWeak<DoHaveOld, DontHaveNew, DontCrashIfDeallocating>
        (location, nil);
}
```
可以看出函数内部直接调用`storeWeak`函数，且模板参数直接标明`DoHaveOld`有旧值，`DontHaveNew` 没有新值，`DontCrashIfDeallocating`不需要`crash`，`newObj`为`nil`，参数只有`location`要销毁的弱引用地址，回忆上面详细分析的`storeWeak`函数。
```jsx
 ...
 // Clean up old value, if any.
 // 如果有旧值，则进行 weak_unregister_no_lock 操作
 if (haveOld) {
     // 把 location 从 oldObj 对应的 weak_entry_t 的哈希数组中移除
     weak_unregister_no_lock(&oldTable->weak_table, oldObj, location);
 }
 ...
```
到这里也很清晰了，和上面`__weak`变量的初始化和赋值操作相比，这里是做销毁操作，只需要处理旧值，调用`weak_unregister_no_lock`函数就可以了。
​

weak_unregister_no_lock请看[objc-weak 函数列表全解析](https://www.yuque.com/u1177479/upp5ho/srtyhs)
​

顺着`NSObject.mm`文件的`storeWeak`函数往下浏览，发现两个只是参数不同内部完全调用`storeWeak` 的工厂函数。
## 6. objc_storeWeakOrNil
> This function stores a new value into a __weak variable. If the new object is deallocating or the new object's class does not support weak references, stores nil instead.
> ​

> 此函数将新值存储到`__weak`变量中。 如果`newObj`已经被标记为`deallocating`或`newObj`的类不支持弱引用，则`__weak`变量指向`nil`。

```jsx
 /*
 * @param location The address of the weak pointer itself 弱指针本身的地址
 * @param newObj The new object this weak ptr should now point to 这个弱指针现在应该指向的新对象
 * 
 * @return The value stored (either the new object or nil) 存储的值（新对象或 nil）
 */
id
objc_storeWeakOrNil(id *location, id newObj)
{
    return storeWeak<DoHaveOld, DoHaveNew, DontCrashIfDeallocating>
        (location, (objc_object *)newObj);
}
```
与`objc_storeWeak`区别只是`DontCrashIfDeallocating`，如果`newObj`的`isa`已经被标记为`deallocating`或者`newObj`所属的类不支持弱引用，则` __weak`变量指向`nil`，不发生 `crash`。
## 7. objc_initWeakOrNil
```jsx
id
objc_initWeakOrNil(id *location, id newObj)
{
    if (!newObj) {
        // 如果新值不存在,直接把__weak 变量指向 nil
        *location = nil;
        return nil;
    }

    return storeWeak<DontHaveOld, DoHaveNew, DontCrashIfDeallocating>
        (location, (objc_object*)newObj);
}

```
与`objc_initWeak`的 区别就是`DontCrashIfDeallocating`，如果`newObj`的`isa`已经被标记为 `deallocating`或`newObj`所属的类不支持弱引用，则`__weak`变量指向`nil`，不发生`crash`。
## 8. weak 变量被置为 nil
当对象释放销毁后它的所有弱引用都会被置为`nil`。  大概是我们听了无数遍的一句话，那么它的入口在哪呢？既然是对象销毁后，那么入口就应该在对象的`dealloc`函数。
​

 当对象引用计数为`0`的时候会执行 dealloc 函数，我们可以在 dealloc 中去看具体的销毁过程：
dealloc->_objc_rootDealloc->rootDealloc->object_dispose->objc_destructInstance->clearDeallocating->clearDeallocating_slow，下面我们顺着源码看下这一路的函数实现。
### 8.1 dealloc
```jsx
// Replaced by CF (throws an NSException)
+ (void)dealloc {
    // 类对象是不能销毁的,只有实例对象才可以被销毁
}

// Replaced by NSZombies
- (void)dealloc {
    // 直接调用了 _objc_rootDealloc 函数。
    _objc_rootDealloc(self);
}

```
### 8.2 _objc_rootDealloc
```jsx
void
_objc_rootDealloc(id obj)
{
    ASSERT(obj);
    // 直接调用 rootDealloc 函数销毁
    obj->rootDealloc();
}
```
### 8.3 rootDealloc
rootDealloc函数分两种情况:

- 类的`isa`是经过优化的
- 类的`isa`未被优化过。
#### 8.3.1 类的isa是经过优化的：SUPPORT_NONPOINTER_ISA = 1
```jsx
inline void
objc_object::rootDealloc()
{
    // 如果是 TaggedPointer 直接 return,感觉不是很有必要,难搞TaggedPointer类型的对象不走这里的流程了吗?
    if (isTaggedPointer()) return;  // fixme necessary?

    // 这一步的判断比较多,符合条件的话可以直接调用 free,快速释放对象
    
    // 1. isa 非指针类型,即优化的 isa_t 类型,除了类对象地址还包括了更多信息
    // 2. 没有弱引用
    // 3. 没有关联对象
    // 4. 没有自定义的 C++析构函数
    // 5, SideTable中不存储引用技术,即引用计数全部放在 extra_rc 中
    
    // 满足以上 5 个条件,直接快速释放对象
    if (fastpath(isa.nonpointer                     &&
                 !isa.weakly_referenced             &&
                 !isa.has_assoc                     &&
#if ISA_HAS_CXX_DTOR_BIT
                 !isa.has_cxx_dtor                  &&
#else
                 !isa.getClass(false)->hasCxxDtor() &&
#endif
                 !isa.has_sidetable_rc))
    {
        assert(!sidetable_present());
        free(this);
    } 
    else {
        // 调用 object_dispose 释放
        object_dispose((id)this);
    }
}
```
rootDealloc 函数流程如下:

- 判断`object`是否是`TaggedPointer`类型，如果是，则不进行任何析构，直接返回。关于这一点，我们可以看出`TaggedPointer`对象，是不走这个析构流程的(其实并不是说`TaggedPointer`的内存不会进行释放，其实`TaggedPointer`的内存在栈区由系统进行释放，而我们这些普通的对象变量是在堆区，它们才需要这个释放流程)
- 接下来判断对象是否能够快速释放(`free(this)` C函数释放内存)。首先判断对象是否采用了优化了`isa` 计数方式(`isa.nonpointer`)。如果是接下来进行判断对象不存在`weak`引用(`!isa.weakly_referenced`)，没有关联对象(`!isa.has_assoc`)，没有自定义的`C++`析构函数(`!isa.has_cxx_dtor`)，没有用到`SideTable`的`refcnts`存放引用计数(`!isa.has_sidetable_rc`)。
- 其他情况进入`object_dispose((id)this)`分支进行慢速释放。



#### 8.3..2 类的isa未被优化过：SUPPORT_NONPOINTER_ISA = 0
```jsx
// isa 指针未被优化,还是个类指针
inline void
objc_object::rootDealloc()
{
    // 如果是 Tagged Pointer 类型,直接 return
    if (isTaggedPointer()) return;
    // 调用 object_dispose 函数,销毁
    object_dispose((id)this);
}
```
这种情况就比较简单，流程如下：

- 首先判断类是否是`TaggedPointer`类型，如果是，则不进行任何析构，直接返回。
- 接下来调用`object_dispose`函数进行慢速释放。

​

### 8.4 object_dispose
`obj`存在弱引用则进入`object_dispose((id)this)`分支, 下面是`object_dispose`函数，
`object_dispose`方法中，会先调用`objc_destructInstance(obj)`（可以理解为`free`前的清理工作）来析构`obj`，再用`free(obj)`来释放内存空间：
```jsx
id 
object_dispose(id obj)
{
    // 对象不存在直接返回
    if (!obj) return nil;
    // 可以理解为 free 前的清理工作
    objc_destructInstance(obj);
    // 释放对象
    free(obj);
    
    return nil;
}
```
### 8.5 objc_destructInstance
> objc_destructInstance Destroys an instance without freeing memory.
> 在不释放内存的情况下销毁实例。
> ​

> Calls C++ destructors.调用 C++ 析构函数。
> Calls ARC ivar cleanup.调用 ARC ivar 清理。
> Removes associative references.删除关联引用。
> Returns `obj`. Does nothing if `obj` is nil.返回`obj`。 如果 `obj` 为 `nil`，则不执行任何操作。

```jsx
void *objc_destructInstance(id obj) 
{
    if (obj) {
        // Read all of the flags at once for performance.
        // 一次读取所有标志以提高性能
        bool cxx = obj->hasCxxDtor();
        bool assoc = obj->hasAssociatedObjects();

        // This order is important.
        // 此顺序很重要
        // C++析构
        if (cxx) object_cxxDestruct(obj);
        // 移除所有的关联对象,并将其自身从 Association Manager 的 map 中移除
        if (assoc) _object_remove_assocations(obj, /*deallocating*/true);
        
        // 到这里还没有看到对象的弱引用被置为 nil,应该在clearDeallocating函数内
        obj->clearDeallocating();
    }

    return obj;
}
```
### 8.6 clearDeallocating
```jsx
inline void 
objc_object::clearDeallocating()
{
    if (slowpath(!isa.nonpointer)) {
        // Slow path for raw pointer isa.
        // 对象的 isa 指针是原始类型,调用这里
        sidetable_clearDeallocating();
    }
    else if (slowpath(isa.weakly_referenced  ||  isa.has_sidetable_rc)) {
        // Slow path for non-pointer isa with weak refs and/or side table data.
        // 对象的 isa 是优化后的 isa_t 调用
        clearDeallocating_slow();
    }

    assert(!sidetable_present());
}
```
在函数内分为两种情况：

- 类的`isa`是经过优化的
- 类的`isa`未被优化过。
#### 8.6.1 clearDeallocating_slow：类的isa是经过优化的
> Slow path of clearDeallocating()  for objects with nonpointer isa that were ever weakly referenced or whose retain count ever overflowed to the side table.
> ​

> `clearDeallocating()`函数的慢速路径，用于曾经存在弱引用或保留计数溢出到`SideTable`中且具有非指针`isa`的对象。（这里`ever`其实藏了一个细节，在上面`objc_initWeak`中我们看到当创建指向对象的弱引用时会把对象的`isa`的`weakly_referenced`字段置为`true`，然后 `weakly_referenced`以后就一直不会再被置为`false`了，即使以后该对象没有任何弱引用了，这里可能是处于性能的考虑。不过当曾经有弱引用的对象的弱引用全部都不存在以后，会把该对象的`weak_entry_t`从`weak_table_t`的哈希数组中移除。）（还有这里把`isa.weakly_referenced || isa.has_sidetable_rc`放在一起，是因为同时也需要把对象从 `SideTable->refcnts`的哈希数组中移除。）

```jsx
NEVER_INLINE void
objc_object::clearDeallocating_slow()
{
    ASSERT(isa.nonpointer  &&  (isa.weakly_referenced || isa.has_sidetable_rc));
    
    // 在全局的 SideTables 中,以 this 为 key,找到对应的 SideTable 表
    SideTable& table = SideTables()[this];
    // 加锁
    table.lock();
    // 如果对象被弱引用
    if (isa.weakly_referenced) {
        // 在 SideTable 的 weak_table中对 this 进行清理功能
        weak_clear_no_lock(&table.weak_table, (id)this);
    }
    // 如果引用计数溢出到 SideTable->refcnts 中保存
    if (isa.has_sidetable_rc) {
        // 在 SideTable 的引用计数哈希表中移除 this
        table.refcnts.erase(this);
    }
    // 解锁
    table.unlock();
}
```
#### 8.6.2 sidetable_clearDeallocating：类的isa未被优化过
```jsx
void 
objc_object::sidetable_clearDeallocating()
{
    // 在全局的 SideTables 中,以 this 为 key,找到对应的 SideTable 表
    SideTable& table = SideTables()[this];

    // clear any weak table items
    // 清除所有弱引用项（把弱引用置为 nil）
    // clear extra retain count and deallocating bit
    // 清除 SideTable 中的引用计数以及 deallocating 位
    // (fixme warn or abort if extra retain count == 0 ?)
    // (fixme 如果额外保留计数== 0，则发出警告或中止 ?)
    
    // 加锁
    table.lock();
    // 从 refcnts 中取出 this 对应的 BucketT（由 BucketT 构建的迭代器)
    // 直白点就是从散列表SideTable中找到对应的引用计数表RefcountMap，拿到要释放的对象的引用计数
    RefcountMap::iterator it = table.refcnts.find(this);
    // 如果找到了
    if (it != table.refcnts.end()) {
        // ->second 取出 ValueT，最后一位是有无弱引用的标志位
        // 如果要释放的对象被弱引用了，通过weak_clear_no_lock函数将指向该对象的弱引用指针置为nil
        if (it->second & SIDE_TABLE_WEAKLY_REFERENCED) {
            // 在 SideTable 的 weak_table中对 this 进行清理功能
            weak_clear_no_lock(&table.weak_table, (id)this);
        }
        // 把 this 对应的 BucketT "移除"（标记为移除）
        table.refcnts.erase(it);
    }
    // 解锁
    table.unlock();
}
```
### 8.7 weak_clear_no_lock
> Called by dealloc; nils out all weak pointers that point to the provided object so that they can no longer be used.
> ​

> 当对象的`dealloc`函数执行时会调用此函数，主要功能是当对象被释放废弃时，把该对象的弱引用指针全部指向 nil。

这里调用了`weak_clear_no_lock`来做`weak_table`的清理工作，将该对象的所有弱引用置为`nil`。
```jsx
void 
weak_clear_no_lock(weak_table_t *weak_table, id referent_id) 
{
    // 获取要销毁对象的指针
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
    // 用于记录 weak_referrer_t,DisguisedPtr<objc_object *>，
    // 记录 weak_entry_t 的哈希数组(或定长为4的固定数组)的起始地址，
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
    
    // 由于 referent 要被释放了，因此 referent 的 weak_entry_t 
    // 也要从 weak_table 的哈希数组中移除。确保哈希表的性能以及查找效率。 
    weak_entry_remove(weak_table, entry);
}
```
## 总结
当第一次创建某个对象的弱引用时，会以该对象的指针和弱引用的地址创建一个`weak_entry_t`，并放在该对象所处的`SideTable`的`weak_table_t`中，然后以后所有指向该对象的弱引用的地址都会保存在该对象的`weak_entry_t`的哈希数组中，当该对象要析构时，遍历`weak_entry_t`中保存的弱引用的地址，将弱引用指向`nil`，最后将`weak_entry_t`从`weak_table`中移除。
​

## 参考

- [Objective-C runtime机制(6)——weak引用的底层实现原理](https://link.juejin.cn/?target=https%3A%2F%2Fblog.csdn.net%2Fu013378438%2Farticle%2Fdetails%2F82767947)
- [iOS底层-- weak修饰对象存储原理](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2Fbd4cc82e09c5)
- [RunTime中SideTables, SideTable, weak_table, weak_entry_t](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2F48a9a9ec8779)

​

