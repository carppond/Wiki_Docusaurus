---
id: category01-底层实现
title: 04 | Category 底层实现原理(一)：概念与数据结构
tag:
  - runtime
  - Category
---

提到 `category` 不免要和 `extension` 进行比较，那先分析 `extension`。

## 1. extension 延展

`extension` 和 `category` 不同， `extension` 可以声明方法、属性、成员变量，但是一般是私有方法、私有属性、私有成员变量。

### 1.1 extension 存在形式

`category ` 拥有 `.h` 和 `.m` 文件，`extension` 则不然， `extension` 只存在一个 `.h` 文件，或者只能 ‘’寄生“ 在 `.m`  中(这也是最常见的方式)。

- ”寄生“ 形式

  比如，在 `BaseViewController.m` 文件中，可能会直接下一个 `extension` ：

  ```jsx
  @interface BaseViewController () {
  // 此处可定义私有成员变量
  // ...
  }
  
  // 此处可定义私有属性
  // ...
  // 此处可定义私有方法
  // ...
  @end
  ```

- 定义 `.h` 文件形式

  可以单独创建一个 `extension` 文件，`command` + `N` -> `Objective-C File`，`File Type` 选择 `Extension`，`Class` 输入要创建 `extension` 的类名，`File` 输入 `extension` 的名字，点击 `next` 后就会生成一个名字是 `类名+xxx.h` 的 `.h` 文件。

  下面示例是我们以 `.h` 文件的形式使用 `extension`。`CusObject+extension.h` 文件：

  ```jsx
  #import <Foundation/Foundation.h>
  #import "CusObject.h"
  
  NS_ASSUME_NONNULL_BEGIN
  
  @interface CusObject () {
      // 通过 extension 添加成员变量
      NSString *name;
  }
  
  // 通过 extension 添加属性和方法
  @property (nonatomic, copy) NSString *nameTwo;
  - (void)testMethod_Extension;
  
  @end
  
  NS_ASSUME_NONNULL_END
  ```

  在 `CusObject.m` 中引入 `#import "CusObject+extension.h"`：

  ```jsx
  #import "CusObject.h"
  #import "CusObject+extension.h"
  
  @implementation CusObject
  
  // 实现在 extension 中添加的方法，
  // 并能正常访问成员变量和属性
  -(void)testMethod_Extension {
      NSLog(@"%@", name);
      NSLog(@"%@", self.nameTwo);
  }
  
  - (void)dealloc {
      NSLog(@"🍀🍀🍀 CusObject deallocing");
  }
  
  @end
  ```

  如果把 `#import "CusObject+extension.h"` 引入放在 `CusObject.m` 中，则 `extension` 中的成员变量、属性、方法只能在类内部使用。

  > 注意：把 `#import "CusObject+extension.h"` 引入放在 `CusObject.h` 最上面，会直接报错，这里有一个定义先后的问题，此时 `CusObject+extension.h` 处于 `CusObject` 类定义前面，`CusObject` 定义还没完成，`extension` 必然无法找到 `CusObject`。

  可以把  `#import "CusObject+extension.h"` 放到下面，如下：

  ```jsx
  #import <Foundation/Foundation.h>
  
  NS_ASSUME_NONNULL_BEGIN
  
  @interface CusObject : NSObject
  
  @end
  
  NS_ASSUME_NONNULL_END
  
  #import "CusObject+extension.h"
  ```

  注意：

  - 在 `.m` 中引入 `extension` ，其中定义的成员变量、属性、方法只能在类内部使用。

  - 在 `.h` 中引入 `extension`， 属性和方法是公开的，成员变量默认是私有的，可以在前面添加 `@public` 可以变为公开，访问时要先用 `->`。(`.` 和 `->` 的使用在 `C/C++` 和 `OC` 中有一些区别，`OC` 是 `C` 的超集，但是并没有和 `C` 完全相同。)

  - 在 `.m` 中给类定义直接添加成员变量，在外部访问时会报错成员变量是 `protected`。 同样也可以添加 `@public` 公开。

    ```jsx
    object->array = @[@(1), @(2)]; ❌❌ // Instance variable 'array' is protected
    objc->name = @"chm"; ❌❌ // Instance variable 'name' is private
    ```

### 1.2 extension 和  category 的区别

- `extension` 可以添加成员变量，`category` 不能添加成员变量。运行时加载类到内存后，才会加载分类，这时类的内存布局已经确定，如果再去添加成员变量就会破坏类的内存布局。各个成员变量的访问地址是在编译时确定的，每个成员变量的地址偏移是固定的。
- `extension` 在编译期决议，`category` 在运行期决议。`extension` 在编译期和头文件里的 `@interface` 以及实现文件里的 `@implement` 一起形成一个完整的类，`extension` 伴随类的产生而产生，亦随着一起消亡。`category` 中的方法在运行期决议，没有实现也可以运行，而 `extension` 中的方法是在编译期检查的，没有实现会报错。
- `extension` 一般用来隐藏类的私有信息，无法直接为系统的类扩展，但是可以先创建系统类的子类再添加 `extension`。
- `category` 可以给系统类添加分类
- `extension` 和 `category` 都可以添加属性，但是 `category` 中的属性不能生成对应的成员变量以及 `setter` 和 `getter` 方法的实现。
- `extension` 不能像 `category` 那也拥有独立的实现部分(`@implementation`)，`extension` 所声明的方法必须依托对应类的实现部分完成。

## 2. category

`category` 可以在不改变或者不继承原类的情况下，动态的给类添加方法。除此之外还有一些应用场景。

- 可以把类的实现分开在不同的文件夹里。这要做有几点好处：
  - 可以减少单个文件的体积。
  - 可以把不同的功能组织到不同的 `category` 里。
  - 可以由多个开发者共同完成一个类。
  - 可以按需加载想要的 `category`。
  - 声明私有方法。
- 模拟多继承
- 把 `framework` 的私有方法公开。

### 2.1 category 特点

- `category` 只能给某个已有的类扩充方法，不能扩容成员变量。
- `category` 中也可以添加属性，只不过 `@property` 只会生成 `setter` 和 `getter` 的声明，不会生成其实现以及成员变量。
- 如果 `category` 中的方法和类中的方法同名，运行时会优先调用 `category` 中的方法，也就是说 `category` 中的方法会覆盖原有类中的方法。
- 如果多个  `category` 中存在同名的方法，运行时到底调用哪个，由编译器决定，最后一个参与编译的方法会被调用。可以在 `Compile Source` 拖动不同的分类顺序来测试。
- 调用优先级：`category` > 本类 > 父类。即先调用 `category` 中的方法，在调用本类方法，最后调用父类方法。

注意：

**`category` 是在运行时添加的，不能在编译时。**

注意：

- `category` 中的方法并没有 ”完全替换掉“ 原来类中已有的方法，也就是说如果 `category` 和原类中都有 `mehtodA`，那么 `category` 附加完成后，类的方法列表里就会有两个 `methodA`。
- `category` 中方法被放在新方法列表列表的前面，而原来类的方法会放到新方法列表的后面，这样也就是我们平常所说的 `category` 的方法会 “覆盖” 掉原来类的同名方法，这是因为运行时在查找方法的时候是顺着方法列表的顺序查找的，它只要一找到对应名字的方法，就会罢休，殊不知后面可能还有一样名字的方法。

### 2.2 为什么category 不能添加成员变量？

`Objective-C` 中类是由 `Class` 类型来表示的，它实际上是一个指向 `objc_class` 结构体的指针，如下:

```jsx
// objc_class

struct objc_class : objc_object {
// Class ISA;
Class superclass;
cache_t cache;             // formerly cache pointer and vtable
class_data_bits_t bits;    // class_rw_t * plus custom rr/alloc flags

class_rw_t *data() const {
    return bits.data();
}

...
};

// class_data_bits_t

struct class_data_bits_t {
    friend objc_class;

    // Values are the FAST_ flags above.
    uintptr_t bits;
    ...
public:

    class_rw_t* data() const {
        return (class_rw_t *)(bits & FAST_DATA_MASK);
    }
    ...

    // Get the class's ro data, even in the presence of concurrent realization.
    // fixme this isn't really safe without a compiler barrier at least
    // and probably a memory barrier when realizeClass changes the data field
    const class_ro_t *safe_ro() {
        class_rw_t *maybe_rw = data();
        if (maybe_rw->flags & RW_REALIZED) {
            // maybe_rw is rw
            return maybe_rw->ro();
        } else {
            // maybe_rw is actually ro
            return (class_ro_t *)maybe_rw;
        }
    }
    ...
};

// class_rw_t

struct class_rw_t {
    // Be warned that Symbolication knows the layout of this structure.
    uint32_t flags;
    uint16_t witness;
#if SUPPORT_INDEXED_ISA
    uint16_t index;
#endif

    explicit_atomic<uintptr_t> ro_or_rw_ext;

    Class firstSubclass;
    Class nextSiblingClass;
    ...

public:
    ...

    const method_array_t methods() const {
        auto v = get_ro_or_rwe();
        if (v.is<class_rw_ext_t *>()) {
            return v.get<class_rw_ext_t *>()->methods;
        } else {
            return method_array_t{v.get<const class_ro_t *>()->baseMethods()};
        }
    }

    const property_array_t properties() const {
        auto v = get_ro_or_rwe();
        if (v.is<class_rw_ext_t *>()) {
            return v.get<class_rw_ext_t *>()->properties;
        } else {
            return property_array_t{v.get<const class_ro_t *>()->baseProperties};
        }
    }

    const protocol_array_t protocols() const {
        auto v = get_ro_or_rwe();
        if (v.is<class_rw_ext_t *>()) {
            return v.get<class_rw_ext_t *>()->protocols;
        } else {
            return protocol_array_t{v.get<const class_ro_t *>()->baseProtocols};
        }
    }
};

// class_ro_t

struct class_ro_t {
    uint32_t flags;
    uint32_t instanceStart;
    uint32_t instanceSize;
#ifdef __LP64__
    uint32_t reserved;
#endif

    const uint8_t * ivarLayout;
    
    const char * name;
    method_list_t * baseMethodList;
    protocol_list_t * baseProtocols;
    const ivar_list_t * ivars;

    const uint8_t * weakIvarLayout;
    property_list_t *baseProperties;

    ...

    method_list_t *baseMethods() const {
        return baseMethodList;
    }
    ...
};
```

在上面一连串的数据结构定义中，`ivars` 是 `const ivar_list_t *`。在 `runtime` 中， `objc_class` 结构体大小是固定的，不可能往这个结构体中添加数据。且这里加了 `const` 修饰符，所以 `ivars` 指向一个固定的区域，不能修改成员变量值，也不能增加成员变量个数。

### 2.3 category 中能添加属性吗？

`category` 不能添加成员变量（`instance variables`），那到底能不能添加属性（`@property`）呢？
从 `category` 的结构体开始分析:  `category_t` 定义:

```jsx
// classref_t is unremapped class_t*
typedef struct classref * classref_t;
```

```jsx
struct category_t {
    const char *name;
    classref_t cls;
    struct method_list_t *instanceMethods;
    struct method_list_t *classMethods;
    struct protocol_list_t *protocols;
    struct property_list_t *instanceProperties;
    // Fields below this point are not always present on disk.
    struct property_list_t *_classProperties;

    method_list_t *methodsForMeta(bool isMeta) {
        if (isMeta) return classMethods;
        else return instanceMethods;
    }

    property_list_t *propertiesForMeta(bool isMeta, struct header_info *hi);
    
    protocol_list_t *protocolsForMeta(bool isMeta) {
        if (isMeta) return nullptr;
        else return protocols;
    }
};
```

从 `category` 定义中可以看出 `category` 可以添加实例方法、类方法甚至可以实现协议、添加属性，同时也看到不能添加成员变量。 那为什么说不能添加属性呢？实际上，`category` 允许添加属性，可以使用 `@property` 添加，但是能添加 `@property` 不代表可以添加 “完整版的” 属性，通常我们说的添加属性是指编译器为我们生成了对应的成员变量和对应的 `setter` 和 `getter` 方法来存取属性。在 `category` 中虽说可以书写 `@property`，但是不会生成 _成员变量，也不会生成所添加属性的 `getter` 和 `setter` 方法的实现，所以尽管添加了属性，也无法使用点语法调用 `setter` 和 `getter` 方法。（实际上，点语法可以写，只不过在运行时调用到这个方法时会报找不到方法的错误: `unrecognized selector sent to instance ....`）。我们此时可以通过 `associated object` 来为属性手动实现 `setter` 和 `getter` 存取方法。

### 2.4 从 clang 编译文件来验证上面两个问题

我们先用 `clang` 编译文件（这里建议大家在 `xcode` 和终端上自己试一下）。首先定义如下类 `CustomObject` 只声明一个属性:

```jsx
// CustomObject.h
#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
@interface CustomObject : NSObject

@property (nonatomic, copy) NSString *customProperty;

@end
NS_ASSUME_NONNULL_END

// CustomObject.m
#import "CustomObject.h"
@implementation CustomObject
@end
```

然后打开终端进入到 `CustomObject.m` 文件所在文件夹，执行 `clang -rewrite-objc CustomObject.m` 指令，然后生成 `CustomObject.cpp` 文件，查看它：
`struct CustomObject_IMPL` 定义：

```jsx
extern "C" unsigned long OBJC_IVAR_$_CustomObject$_customProperty;
struct CustomObject_IMPL {
    struct NSObject_IMPL NSObject_IVARS;
    NSString * _Nonnull _customProperty;
};

// @property (nonatomic, copy) NSString *customProperty;

/* @end */
```

看到为我们增加了 `_customProperty` 成员变量，`NSObject_IVARS` 是每个继承自 `NSObject` 都会有的成员变量。 `@implementation CustomObject` 部分：

```jsx
// @implementation CustomObject

static NSString * _Nonnull _I_CustomObject_customProperty(CustomObject * self, SEL _cmd) { return (*(NSString * _Nonnull *)((char *)self + OBJC_IVAR_$_CustomObject$_customProperty)); }
extern "C" __declspec(dllimport) void objc_setProperty (id, SEL, long, id, bool, bool);

static void _I_CustomObject_setCustomProperty_(CustomObject * self, SEL _cmd, NSString * _Nonnull customProperty) { objc_setProperty (self, _cmd, __OFFSETOFIVAR__(struct CustomObject, _customProperty), (id)customProperty, 0, 1); }
// @end
```

看到我们的 `customProperty` 的 `setter` 和 `getter` 方法，到这里可印证：**类中添加属性编译器自动生成了成员变量和对应的 setter 和 getter 方法。**（这里刚好可以和 `category` 中不会生成作对比）  接下来看 `getter` 函数的实现:

```jsx
return (*(NSString * _Nonnull *)((char *)self + OBJC_IVAR_$_CustomObject$_customProperty));
```

`self` 是我们的入参 `CustomObject * self`，然后它做了一个指针加法。这个 `OBJC_IVAR_$_CustomObject$_customProperty` 是 `_customProperty` 相对于 `self` 的指针偏移。

```jsx
// 1 定义，其实它是一个 unsigned long 
extern "C" unsigned long OBJC_IVAR_$_CustomObject$_customProperty;

// 2 _customProperty 成员变量位置相对 struct CustomObject 的偏移
#define __OFFSETOFIVAR__(TYPE, MEMBER) ((long long) &((TYPE *)0)->MEMBER)
extern "C" unsigned long int OBJC_IVAR_$_CustomObject$_customProperty __attribute__ ((used, section ("__DATA,__objc_ivar"))) =
__OFFSETOFIVAR__(struct CustomObject, _customProperty);

// 3 成员变量列表，看到只有我们的 _customProperty
static struct /*_ivar_list_t*/ {
    unsigned int entsize;  // sizeof(struct _prop_t)
    unsigned int count;
    struct _ivar_t ivar_list[1];
} _OBJC_$_INSTANCE_VARIABLES_CustomObject __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_ivar_t),
    1,
    {{(unsigned long int *)&OBJC_IVAR_$_CustomObject$_customProperty, "_customProperty", "@\"NSString\"", 3, 8}}
};

// _ivar_t 定义
struct _ivar_t {
    // 指向 ivar 偏移位置的指针
    unsigned long int *offset;  // pointer to ivar offset location
    const char *name;
    const char *type;
    unsigned int alignment;
    unsigned int  size;
};
```

看到成员变量的访问是通过指针偏移来做的，而偏移距离都是结构体内存布局已经死死固定的。当 `category` 整合到它对应的类时，类的布局已固定，自然就不能再给它添加新的成员变量了。

下面我们 `clang` 编译 `category` 文件：`NSObject+customCategory.h` 文件：

```jsx
#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
@interface NSObject (customCategory)

@property (nonatomic, copy) NSString *categoryProperty_one;
@property (nonatomic, strong) NSMutableArray *categoryProperty_two;

- (void)customInstanceMethod_one;
- (void)customInstanceMethod_two;
+ (void)customClassMethod_one;
+ (void)customClassMethod_two;

@end
NS_ASSUME_NONNULL_END
```

`NSObject+customCategory.m` 文件：

```jsx
#import "NSObject+customCategory.h"
@implementation NSObject (customCategory)
- (void)customInstanceMethod_one {
    NSLog(@"🧑‍🍳 %@ invokeing", NSStringFromSelector(_cmd));
}
- (void)customInstanceMethod_two {
    NSLog(@"🧑‍🍳 %@ invokeing", NSStringFromSelector(_cmd));
}
+ (void)customClassMethod_one {
    NSLog(@"🧑‍🍳 %@ invokeing", NSStringFromSelector(_cmd));
}
+ (void)customClassMethod_two {
    NSLog(@"🧑‍🍳 %@ invokeing", NSStringFromSelector(_cmd));
}
@end
```

浏览摘录 `NSObject+customCategory.cpp` 文件:

```jsx
// @implementation NSObject (customCategory)
static void _I_NSObject_customCategory_customInstanceMethod_one(NSObject * self, SEL _cmd) {
    NSLog((NSString *)&__NSConstantStringImpl__var_folders_24_5w9yv8jx63bgfg69gvgclmm40000gn_T_NSObject_customCategory_740f85_mi_0, NSStringFromSelector(_cmd));
}
static void _I_NSObject_customCategory_customInstanceMethod_two(NSObject * self, SEL _cmd) {
    NSLog((NSString *)&__NSConstantStringImpl__var_folders_24_5w9yv8jx63bgfg69gvgclmm40000gn_T_NSObject_customCategory_740f85_mi_1, NSStringFromSelector(_cmd));
}
static void _C_NSObject_customCategory_customClassMethod_one(Class self, SEL _cmd) {
    NSLog((NSString *)&__NSConstantStringImpl__var_folders_24_5w9yv8jx63bgfg69gvgclmm40000gn_T_NSObject_customCategory_740f85_mi_2, NSStringFromSelector(_cmd));
}
static void _C_NSObject_customCategory_customClassMethod_two(Class self, SEL _cmd) {
    NSLog((NSString *)&__NSConstantStringImpl__var_folders_24_5w9yv8jx63bgfg69gvgclmm40000gn_T_NSObject_customCategory_740f85_mi_3, NSStringFromSelector(_cmd));
}
// @end
```

看到只有我们的两个实例方法和两个类方法，没有添加成员变量也没有任何属性的 `setter` 和 `getter`方法。这里即可印证：**category 不能添加属性。**

```jsx
// 两个实例方法
static struct /*_method_list_t*/ {
    unsigned int entsize;  // sizeof(struct _objc_method)
    unsigned int method_count;
    struct _objc_method method_list[2];
} _OBJC_$_CATEGORY_INSTANCE_METHODS_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_objc_method),
    2,
    {{(struct objc_selector *)"customInstanceMethod_one", "v16@0:8", (void *)_I_NSObject_customCategory_customInstanceMethod_one},
    {(struct objc_selector *)"customInstanceMethod_two", "v16@0:8", (void *)_I_NSObject_customCategory_customInstanceMethod_two}}
};

// 两个类方法
static struct /*_method_list_t*/ {
    unsigned int entsize;  // sizeof(struct _objc_method)
    unsigned int method_count;
    struct _objc_method method_list[2];
} _OBJC_$_CATEGORY_CLASS_METHODS_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_objc_method),
    2,
    {{(struct objc_selector *)"customClassMethod_one", "v16@0:8", (void *)_C_NSObject_customCategory_customClassMethod_one},
    {(struct objc_selector *)"customClassMethod_two", "v16@0:8", (void *)_C_NSObject_customCategory_customClassMethod_two}}
};

// 两个属性
static struct /*_prop_list_t*/ {
    unsigned int entsize;  // sizeof(struct _prop_t)
    unsigned int count_of_properties;
    struct _prop_t prop_list[2];
} _OBJC_$_PROP_LIST_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_prop_t),
    2,
    {{"categoryProperty_one","T@\"NSString\",C,N"},
    {"categoryProperty_two","T@\"NSMutableArray\",&,N"}}
};
```

看到类方法、实例方法和属性的结构体：

```
static struct _category_t _OBJC_$_CATEGORY_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = 
{
    "NSObject",
    0, // &OBJC_CLASS_$_NSObject,
    (const struct _method_list_t *)&_OBJC_$_CATEGORY_INSTANCE_METHODS_NSObject_$_customCategory,
    (const struct _method_list_t *)&_OBJC_$_CATEGORY_CLASS_METHODS_NSObject_$_customCategory,
    0,
    (const struct _prop_list_t *)&_OBJC_$_PROP_LIST_NSObject_$_customCategory,
};
```

以上三者构成 `_category_t` 结构体实例。

## 3. category 原理

> 即使我们不引入 `category` 的头文件，`category` 中的方法也会被添加进主类中，我们可以通 `performSelector:` 等方式对 `category` 中的方法进行调用:

- 将 `category` 和它的主类(或元类) 注册到哈希表中，形成映射关系。
- 如果主类(或元类)已实现，那么重建它的方法列表。

## 4. category 相关数据结构

到这里突然有些茫然，不知道从哪里入手，已知 `category` 是在 `runtime` 初始化时开始加载的，这里涉及到 `runtime` 的加载流程，暂且不说。我们还是先来一层一层剥开相关的数据结构。
可绘制这样一个关系图： 

![category_01](../../assets/iOS源码分析/category_01.png)

### 4.1 category_t

```jsx
// 声明 struct category_t * 的别名为Category
typedef struct category_t *Category;

struct category_t {
    // 分类的名字
    const char *name;
    // 所属的类
    classref_t cls;
    // 实例方法列表
    WrappedPtr<method_list_t, PtrauthStrip> instanceMethods;
    // 类方法列表
    WrappedPtr<method_list_t, PtrauthStrip> classMethods;
    // 协议列表
    struct protocol_list_t *protocols;
    // 实例属性列表
    struct property_list_t *instanceProperties;
    // Fields below this point are not always present on disk.
    // 类属性列表?
    struct property_list_t *_classProperties;

    // 返回实例方法列表或者类方法列表
    // 从这里也可以看出,类方法类别存在元类里
    method_list_t *methodsForMeta(bool isMeta) {
        if (isMeta) return classMethods;
        else return instanceMethods;
    }
    //
    property_list_t *propertiesForMeta(bool isMeta, struct header_info *hi);
    // 协议列表,元类没有协议列表
    protocol_list_t *protocolsForMeta(bool isMeta) {
        if (isMeta) return nullptr;
        else return protocols;
    }
};

/***********************************************************************
* category_t::propertiesForMeta
* Return a category's instance or class properties.
* 返回类或者实例类的属性
* hi is the image containing the category.
* hi 是包含 category 的镜像
**********************************************************************/
property_list_t *
category_t::propertiesForMeta(bool isMeta, struct header_info *hi)
{
    // 如果当前类不是元类,直接返回实例属性类别
    if (!isMeta) return instanceProperties;
    // 如果当前类是元类,就返回类的属性列表
    else if (hi->info()->hasCategoryClassProperties()) return _classProperties;
    else return nil;
}
```

### 4.2 method_t

```jsx
struct method_t {
    // 小法列表标志
    static const uint32_t smallMethodListFlag = 0x80000000;

    method_t(const method_t &other) = delete;

    // The representation of a "big" method. This is the traditional
    // representation of three pointers storing the selector, types
    // and implementation.
    // “大”方法的结构体。 包含3个字段：方法名、类型和实现。
    // "big" 传统意义上的方法信息
    struct big {
        SEL name; // 类名
        const char *types; // 类型
        MethodListIMP imp;// 方法实现
    };

private:
    // 是否是小方法
    // 通过当前类的指针 & 1 获取是否是 1 来判断当前类是否是 1
    bool isSmall() const {
        return ((uintptr_t)this & 1) == 1;
    }

    // The representation of a "small" method. This stores three
    // relative offsets to the name, types, and implementation.
    // "small" 方法结构体，存的是name/types/imp 的相对偏移量
    struct small {
        // The name field either refers to a selector (in the shared
        // cache) or a selref (everywhere else).
        // name 字段要么引用selector（在共享缓存中），要么引用 selref（其他任何地方）
        RelativePointer<const void *> name; // name的相对偏移
        RelativePointer<const char *> types; // 方法类型的相对偏移
        RelativePointer<IMP> imp;// 方法实现的相对偏移
        
        // 当前类是否在共享缓存中
        bool inSharedCache() const {
            return (CONFIG_SHARED_CACHE_RELATIVE_DIRECT_SELECTORS &&
                    objc::inSharedCache((uintptr_t)this));
        }
    };
    
    // 获取small 信息
    small &small() const {
        ASSERT(isSmall());
        return *(struct small *)((uintptr_t)this & ~(uintptr_t)1);
    }
    // 根据是否加锁获取要替换的 imp
    IMP remappedImp(bool needsLock) const;
    //  替换 imp/存储 im 到smallMethodIMPMap中
    void remapImp(IMP imp);
    // 获取 small 方法的信息: 方法名和参数类型
    objc_method_description *getSmallDescription() const;

public:
    // big size
    static const auto bigSize = sizeof(struct big);
    // small size
    static const auto smallSize = sizeof(struct small);

    // The pointer modifier used with method lists. When the method
    // list contains small methods, set the bottom bit of the pointer.
    // We use that bottom bit elsewhere to distinguish between big
    // and small methods.
    // 与方法列表一起使用的指针修饰符。 当方法列表包含小方法时，设置指针的底部位。 我们在别处使用底部位来区分大小方法。
    struct pointer_modifier {
        template <typename ListType>
        static method_t *modify(const ListType &list, method_t *ptr) {
            if (list.flags() & smallMethodListFlag)
                return (method_t *)((uintptr_t)ptr | 1);
            return ptr;
        }
    };
    // 获取 big 信息
    big &big() const {
        ASSERT(!isSmall());
        return *(struct big *)this;
    }
    
    // 获取方法
    SEL name() const {
        // 如果当前方法是 small 方法
        if (isSmall()) {
            /// 通过偏移计算,获取方法
            return (small().inSharedCache()
                    ? (SEL)small().name.get()
                    : *(SEL *)small().name.get());
        } else {
            // 从 big 中获取方法
            return big().name;
        }
    }
    // 获取方法参数类型
    const char *types() const {
        // 如果是方法是 small 类型,通过偏移计算出参数类型
        // 如果方法是 big 类型,之火获取参数类型
        return isSmall() ? small().types.get() : big().types;
    }
    // 获取方法实现
    IMP imp(bool needsLock) const {
        // 如果是 small 类型
        if (isSmall()) {
            // 加锁,从 smallMethodIMPMap 中获取方法的实现
            IMP imp = remappedImp(needsLock);
            if (!imp)
                /*
                 https://opensource.apple.com/source/xnu/xnu-4903.241.1/EXTERNAL_HEADERS/ptrauth.h.auto.html
                 ptrauth_sign_unauthenticated:
                    使用特定键为给定的指针值添加签名，使用给定的额外数据作为签名过程的盐。
                 
                    此操作不验证原始值，因此，如果攻击者可能控制该值。

                    该值必须是指针类型的表达式。键必须是 ptrauth_key 类型的常量表达式。
                    额外数据必须是指针或整数类型的表达式；如果是整数，它将被强制转换为 ptrauth_extra_data_t。
                    结果将具有与原始值相同的类型。
                 
                 ptrauth_key_function_pointer
                    用于签署 C 函数指针的密钥。额外数据始终为 0
                 */
                // 从 small 中获取imp, 并用 ptrauth_key_function_pointer 给 imp 签名
                imp = ptrauth_sign_unauthenticated(small().imp.get(),
                                                   ptrauth_key_function_pointer, 0);
            return imp;
        }
        // 从 big 中获取 imp
        return big().imp;
    }
    // 将small name 设为 SEL
    SEL getSmallNameAsSEL() const {
        // 如果不在共享缓存中,断言
        ASSERT(small().inSharedCache());
        // 从偏移中取出 name,并转成 sel
        return (SEL)small().name.get();
    }
    // 将small name 设为 SEL 引用
    SEL getSmallNameAsSELRef() const {
        ASSERT(!small().inSharedCache());
        return *(SEL *)small().name.get();
    }
    // 设置 big/small 的 name
    void setName(SEL name) {
        // small 类型
        if (isSmall()) {
            // 已经在缓存中,断言
            ASSERT(!small().inSharedCache());
            // 设置 small 的 name
            *(SEL *)small().name.get() = name;
        } else {
            // 设置 big 的 name
            big().name = name;
        }
    }
    // 设置 big/small 的 imp
    void setImp(IMP imp) {
        // small 类型
        if (isSmall()) {
            // 存储 imp 到 smallMethodIMPMap 中
            remapImp(imp);
        } else {
            // 存储 imp 到 big
            big().imp = imp;
        }
    }
    // 获取 method 信息
    objc_method_description *getDescription() const {
        // 如果当前是 small 类型,就从 getSmallDescription 中获取 method 信息
        // 如果是 big 类型,就直接把当前对象转成 objc_method_description
        return isSmall() ? getSmallDescription() : (struct objc_method_description *)this;
    }
    
    // 将 sel 按地址排序
    struct SortBySELAddress :
    public std::binary_function<const struct method_t::big&,
                                const struct method_t::big&, bool>
    {
        bool operator() (const struct method_t::big& lhs,
                         const struct method_t::big& rhs)
        { return lhs.name < rhs.name; }
    };
    // 赋值操作,将 other 的信息赋值给当前method_t,并返回
    method_t &operator=(const method_t &other) {
        ASSERT(!isSmall());
        big().name = other.name();
        big().types = other.types();
        big().imp = other.imp(false);
        return *this;
    }
};
```

### 4.3 entsize_list_tt

下面先看一下超长的 `entsize_list_tt`，它可理解为一个数据容器，拥有自己的迭代器用于遍历所有元素。（`ent` 应该是 `entry` 的缩写）。

```jsx
/***********************************************************************
* entsize_list_tt<Element, List, FlagMask, PointerModifier>
* Generic implementation of an array of non-fragile structs.
* entsize_list_tt<Element, List, FlagMask, PointerModifier> 非脆弱结构数组的通用实现。
*
* Element is the struct type (e.g. method_t)
* Element 是结构体类型，如: method_t
*
* List is the specialization of entsize_list_tt (e.g. method_list_t)
* List 是 entsize_list_tt 指定类型，如: method_list_t
*
* FlagMask is used to stash extra bits in the entsize field
*   (e.g. method list fixup markers)
* 标记位 FlagMask 用于将多余的位藏匿在 entsize 字段中, 如: 方法列表修复标记
* PointerModifier is applied to the element pointers retrieved from
* the array.
* PointerModifier 应用于从数组中检索到的元素指针。
**********************************************************************/
template <typename Element, typename List, uint32_t FlagMask, typename PointerModifier = PointerModifierNop>
struct entsize_list_tt {
    // entsize（entry 的大小） 和 Flags 以掩码形式保存在 entsizeAndFlags 中
    uint32_t entsizeAndFlags;
    // entsize_list_tt 的容量
    uint32_t count;
    // 元素的大小
    uint32_t entsize() const {
        return entsizeAndFlags & ~FlagMask;
    }
    // 从 entsizeAndFlags 中取出 flags
    uint32_t flags() const {
        return entsizeAndFlags & FlagMask;
    }
    // 根据索引返回指定元素的的引用，这 i 可以等于 count
    // 意思是可以返回最后一个元素的后面
    Element& getOrEnd(uint32_t i) const {
        // 断言, i 不能超过 count
        ASSERT(i <= count);
        // 首先获取当前对象的大小加上i*entsize()
        // 然后把当前对象转成 uint8_t *) 加上上一步的结果, 转化为 Element指针
        // 然后取出 Element 指针指向的内容返回
        return *PointerModifier::modify(*this, (Element *)((uint8_t *)this + sizeof(*this) + i*entsize()));
    }
    // 在索引返回内返回 Element 引用
    Element& get(uint32_t i) const { 
        ASSERT(i < count);
        return getOrEnd(i);
    }
    // 容器占用的的内存总大小,以字节为单位
    size_t byteSize() const {
        return byteSize(entsize(), count);
    }
    // entsize 单个元素的内存大小, count 元素个数,这里是获取所有元素的内存大小
    static size_t byteSize(uint32_t entsize, uint32_t count) {
        // 首先算出 entsize_list_tt 的大小
        // uint32_t entsizeAndFlags  + uint32_t count;
        // 两个成员变量的总长度 + count*entsize 个元素的长度
        return sizeof(entsize_list_tt) + count*entsize;
    }
    // 自定义迭代器声明,实现在下面
    struct iterator;
    
    const iterator begin() const {
        // static_cast 是一个 c++运算符,功能是把一个表达式转换为某种类型
        // 但是没有运行时类型检查来保证转换的安全性
        // 把 this 强制转化为 const List*
        // 0 通过下面 iterator 的构造函数实现可知, 把 element 指向第一个元素
        
        // 返回指向容器第一个元素的迭代器
        return iterator(*static_cast<const List*>(this), 0); 
    }
    
    // 同上,少了 2 个 const 修饰, 前面的 const 表示函数返回值为 const 不可变
    // 后面的 const 表示函数执行过程中不改变原始对象的内容
    iterator begin() { 
        return iterator(*static_cast<const List*>(this), 0); 
    }
    
    // 即返回指向容器最后一个元素后面的迭代器
    // 注意这里不是指向最后一个元素,而是指向最后一个的后面
    const iterator end() const { 
        return iterator(*static_cast<const List*>(this), count); 
    }
    
    // 同上,去掉两个 const 的限制
    iterator end() { 
        return iterator(*static_cast<const List*>(this), count); 
    }

    // 自定义迭代器
    struct iterator {
        // 每个元素的带下
        uint32_t entsize;
        // 当前迭代器的索引
        uint32_t index;  // keeping track of this saves a divide in operator-
        // 元素指针
        Element* element;

        // 类型定义
        typedef std::random_access_iterator_tag iterator_category;
        typedef Element value_type;
        typedef ptrdiff_t difference_type;
        typedef Element* pointer;
        typedef Element& reference;
        // 构造函数
        iterator() { }

        // 构造函数
        iterator(const List& list, uint32_t start = 0)
            : entsize(list.entsize())
            , index(start)
            , element(&list.getOrEnd(start))
        { }

        // 重载操作符
        const iterator& operator += (ptrdiff_t delta) {
            // 指针偏移
            element = (Element*)((uint8_t *)element + delta*entsize);
            // 更新 index
            index += (int32_t)delta;
            // 返回 *this
            return *this;
        }
        // 重载操作符
        const iterator& operator -= (ptrdiff_t delta) {
            // 指针偏移
            element = (Element*)((uint8_t *)element - delta*entsize);
            // 更新 index
            index -= (int32_t)delta;
            // 返回 *this
            return *this;
        }
        // 以下都是重载操作符, 都是 -= 和 += 的运算
        const iterator operator + (ptrdiff_t delta) const {
            return iterator(*this) += delta;
        }
        const iterator operator - (ptrdiff_t delta) const {
            return iterator(*this) -= delta;
        }

        iterator& operator ++ () { *this += 1; return *this; }
        iterator& operator -- () { *this -= 1; return *this; }
        iterator operator ++ (int) {
            iterator result(*this); *this += 1; return result;
        }
        iterator operator -- (int) {
            iterator result(*this); *this -= 1; return result;
        }
        
        // 两个迭代器之间的距离
        ptrdiff_t operator - (const iterator& rhs) const {
            return (ptrdiff_t)this->index - (ptrdiff_t)rhs.index;
        }

        // 返回元素指针或引用
        Element& operator * () const { return *element; }
        Element* operator -> () const { return element; }

        operator Element& () const { return *element; }

        // 等于判断
        bool operator == (const iterator& rhs) const {
            return this->element == rhs.element;
        }
        
        // 不等
        bool operator != (const iterator& rhs) const {
            return this->element != rhs.element;
        }

        // 小于比较
        bool operator < (const iterator& rhs) const {
            return this->element < rhs.element;
        }
        // 大于比较
        bool operator > (const iterator& rhs) const {
            return this->element > rhs.element;
        }
    };
};
```

### 4.4 method_list_t

```jsx
// Two bits of entsize are used for fixup markers.
// 两位 entsize 用于修正标记
// Reserve the top half of entsize for more flags. We never
// need entry sizes anywhere close to 64kB.
// 为更多标志保留 entsize 的上半部分.永远不需要接近64KB 条目大小
// Currently there is one flag defined: the small method list flag,
// method_t::smallMethodListFlag. Other flags are currently ignored.
// (NOTE: these bits are only ignored on runtimes that support small
// method lists. Older runtimes will treat them as part of the entry
// size!)
// 目前定义了一个标志:  small 方法列表标志 method_t::smallMethodListFlag.当前忽略其他标志.
// 注意: 这些位仅在支持 small 方法列表时被忽略.较旧的运行时会把它们视为条目的一部分
//
struct method_list_t : entsize_list_tt<method_t, method_list_t, 0xffff0003, method_t::pointer_modifier> {
    // 是否是唯一的
    bool isUniqued() const;
    // 是否是固定的
    bool isFixedUp() const;
    // 设置固定
    void setFixedUp();

    // 返回 meth 的 index(指针距离/元素大小)
    uint32_t indexOfMethod(const method_t *meth) const {
        uint32_t i = 
            (uint32_t)(((uintptr_t)meth - (uintptr_t)this) / entsize());
        ASSERT(i < count);
        return i;
    }

    // 是否是 small 方法列表
    bool isSmallList() const {
        // flag & smallMethodListFlag = 0x80000000;
        return flags() & method_t::smallMethodListFlag;
    }
    
    // 是否达到预期大小
    bool isExpectedSize() const {
        // 如果是small方法列表
        if (isSmallList())
            // 元素大小 == struct small 的大小
            return entsize() == method_t::smallSize;
        else
            // 元素大小 == struct  big 的大小
            return entsize() == method_t::bigSize;
    }
    
    // 复制一份 method_list_t
    method_list_t *duplicate() const {
        // 临时变量
        method_list_t *dup;
        // 如果是small 方法列表
        if (isSmallList()) {
            // 申请大小 byteSize(method_t::bigSize, count) 的空间,用于储存 method_list_t
            dup = (method_list_t *)calloc(byteSize(method_t::bigSize, count), 1);
            // 设置 entsizeAndFlags
            dup->entsizeAndFlags = method_t::bigSize;
        } else { // 如果big 方法列表
            // 申请大小为 this->byteSize() 的空间,存储 method_list_t
            dup = (method_list_t *)calloc(this->byteSize(), 1);
            // // 设置 entsizeAndFlags
            dup->entsizeAndFlags = this->entsizeAndFlags;
        }
        // 设置容量
        dup->count = this->count;
        // 原数据从 begin() 到 end() 复制一份到以dup->begin()为起始地址的空间内
        std::copy(begin(), end(), dup->begin());
        return dup;
    }
};
```

在 `objc-runtime-new.mm` 看下 `method_list_t` 的函数实现:

```jsx
// static const uint32_t uniqued_method_list = 1;
// 通过标志的最后一位是否为 1,来判断当前对象是否是唯一的
bool method_list_t::isUniqued() const {
    return (flags() & uniqued_method_list) != 0;
}
// static const uint32_t fixed_up_method_list = 3;
// 如果标志 & 3 == 3, 就说明是固定的
bool method_list_t::isFixedUp() const {
    // Ignore any flags in the top bits, just look at the bottom two.
    // 忽略顶部的任何标志，只看底部的两个。
    return (flags() & 0x3) == fixed_up_method_list;
}

// 设置固定
void method_list_t::setFixedUp() {
    // 加锁
    runtimeLock.assertLocked();
    // 如果当前已经是固定的,断言
    ASSERT(!isFixedUp());
    // 通过容器大小 | 3 设置是否是固定的
    entsizeAndFlags = entsize() | fixed_up_method_list;
}
```

```jsx
/*
  Low two bits of mlist->entsize is used as the fixed-up marker.
  method_list_t 的低两位用作固定标记
    Method lists from shared cache are 1 (uniqued) or 3 (uniqued and sorted).
    来自 shared cache的 method lists 为 1(唯一) 或者  3 (唯一且已排序)
    (Protocol method lists are not sorted because of their extra parallel data)
    Runtime fixed-up method lists get 3.
    指 method_list_t 继承 entsize_list_tt 的模版参数 FlagMask hardcode 是 0x3

  High two bits of protocol->flags is used as the fixed-up marker.
  protocol->flags 的高两位用作固定标记
  PREOPTIMIZED VERSION: // 预优化版本
    Protocols from shared cache are 1<<30.
    // 来自 shared cache 的 Protocols 是 1<<30.
    Runtime fixed-up protocols get 1<<30.
    // Runtime fixed-up protocols 得到 1 << 30
  UN-PREOPTIMIZED VERSION: 未预优化版本
  Protocols from shared cache are 1<<30.
 // 来自 shared cache 的 Protocols 是 1<<30.
    Shared cache's fixups are not trusted.
    Shared cache的修正不受信任。
    Runtime fixed-up protocols get 3<<30.
 // Runtime fixed-up protocols 得到 3 << 30
*/

static const uint32_t fixed_up_method_list = 3;
static const uint32_t uniqued_method_list = 1;
static uint32_t fixed_up_protocol = PROTOCOL_FIXED_UP_1;
static uint32_t canonical_protocol = PROTOCOL_IS_CANONICAL;
```

`method_list_t` 的 `FlagMask` 是 `0x3`，即二进制: `0b11`，`FlagMask` 会在把 `category` 的方法追加到类前调用 `prepareMethodLists` 函数里面用到，用于判断是否需要把方法列表调整为 `uniqued and sorted`。

### 4.5 protocol_list_t

```jsx
struct protocol_list_t {
    // count is pointer-sized by accident.
    uintptr_t count; // 指针长度/大小
    
    // 此处虽然数组长度用的是 0,不过它是运行期可变的
    // 其实 C99 的一种写法,允许在运行期动态的申请内存
    protocol_ref_t list[0]; // variable-size

    // 字节容量
    size_t byteSize() const {
        // 首先获取数组的大小,在和指针长度相乘
        // 上一步结果加上当前对象的大小
        return sizeof(*this) + count*sizeof(list[0]);
    }
    
    // 复制函数
    protocol_list_t *duplicate() const {
        return (protocol_list_t *)memdup(this, this->byteSize());
    }

    // 类型定义
    typedef protocol_ref_t* iterator;
    typedef const protocol_ref_t* const_iterator;

    // begin 指针
    const_iterator begin() const {
        return list;
    }
    // 可变的 begin 指针
    iterator begin() {
        return list;
    }
    // 不可变的结束指针位置
    const_iterator end() const {
        return list + count;
    }
    iterator end() {
        return list + count;
    }
};
```

### 4.6 property_list_t

```jsx

struct property_list_t : entsize_list_tt<property_t, property_list_t, 0> {
};
```

继承自 `entsize_list_tt`，它的 `FlagMask` `hardcode` 是 `0`。

### 4.7 property_t

```jsx
struct property_t {
    const char *name; // 属性名称
    const char *attributes; // 属性的类型 type encoding
};
```

### 4.8 locstamped_category_t

```jsx
struct locstamped_category_t {
    category_t *cat;
    // header 数据
    struct header_info *hi;
};
```

### 4.9 category_list

```jsx
// class nocopy_t 构造函数和析构函数使用编译器默认生成的，删除复制构造函数和赋值函数
class category_list : nocopy_t {
    // 共同体/联合体
    union {
        // lc 与 下面的 struct 共用内存空间
        // is_array 表示一个数组还是只是一个 locstamped_category_t
        locstamped_category_t lc;
        struct {
            // locstamped_category_t指针
            locstamped_category_t *array;
            
            // 根据数据量切换不同的存储形态。类似 weak_entry_t 的数据结构，
            // 开始先用定长为 4 的数组保存弱引用指针，然后大于 4 以后切换为哈希数组保存，
            // 也类似 class_rw_ext_t 中的方法列表，是保存一个方法列表指针，
            // 还是保存一个数组每个数组元素都是一个方法列表指针
            // this aliases with locstamped_category_t::hi
            // which is an aliased pointer
            // 位域
            uint32_t is_array :  1;
            uint32_t count    : 31;
            uint32_t size     : 32;
        };
    } _u;

public:
    // 构造函数
    // _u 初始化列表 lc 和 struct 都为 nullptr
    category_list() : _u{{nullptr, nullptr}} { }
    // _u 初始化
    category_list(locstamped_category_t lc) : _u{{lc}} { }
    // 入参 category_list &&
    category_list(category_list &&other) : category_list() {
        std::swap(_u, other._u);
    }
    // 析构函数
    ~category_list()
    {
        if (_u.is_array) {
            free(_u.array);
        }
    }
    // 表示 category_t 的数量
    uint32_t count() const
    {
        // 如果共同体的 is_array 是 1,就返回 _u.count
        if (_u.is_array) return _u.count;
        // 如果 cat 存在就返回 1,否则 0
        return _u.lc.cat ? 1 : 0;
    }
    // 内存容量
    // locstamped_category_t 根据其结构应该是 16
    uint32_t arrayByteSize(uint32_t size) const
    {
        return sizeof(locstamped_category_t) * size;
    }
    // locstamped_category_t 指针
    const locstamped_category_t *array() const
    {
        return _u.is_array ? _u.array : &_u.lc;
    }
    // 拼接
    void append(locstamped_category_t lc)
    {
        // 如果是以数组的形式保存
        if (_u.is_array) {
            // 如果容量已经存满
            if (_u.count == _u.size) {
                // 如果已经存满了
                // 扩容
                // Have a typical malloc growth:
                // - size <=  8: grow by 2
                // - size <= 16: grow by 4
                // - size <= 32: grow by 8
                // ... etc
                _u.size += _u.size < 8 ? 2 : 1 << (fls(_u.size) - 2);
                // 重新申请内存空间
                _u.array = (locstamped_category_t *)reallocf(_u.array, arrayByteSize(_u.size));
            }
            _u.array[_u.count++] = lc;
        } else if (_u.lc.cat == NULL) { // 如果 lc.cat 为空
            // 如果还没有保存任何数据，使用 lc 成员变量
            _u.lc = lc;
        } else {
            // 由原始的一个 locstamped_category_t lc 转变为指针数组存储 locstamped_category_t
            locstamped_category_t *arr = (locstamped_category_t *)malloc(arrayByteSize(2));
            arr[0] = _u.lc;
            arr[1] = lc;

            _u.array = arr;
            _u.is_array = true;
            _u.count = 2;
            _u.size = 2;
        }
        /*
         通过当前函数可以发现:
         1. 先使用 lc 的存储
         2. lc 已存储的情况下,在已数组的形式存储.
            - 数组存储时,把 lc 当做数组的第一个元素
            - 第二个元素是用数组存储时的 cat
         */
    }
    // 擦除,只需要清除内容,并不需要释放原始的 16 字节空间
    void erase(category_t *cat)
    {
        if (_u.is_array) {
            // 如果是以数组的形式保存
            for (int i = 0; i < _u.count; i++) {
                if (_u.array[i].cat == cat) {
                    // shift entries to preserve list order
                    // 移动数组,删除 cat
                    memmove(&_u.array[i], &_u.array[i+1], arrayByteSize(_u.count - i - 1));
                    return;
                }
            }
        } else if (_u.lc.cat == cat) { // 以 lc 的形式保存
            // 此时只有一个 cat,都置为nil
            _u.lc.cat = NULL;
            _u.lc.hi = NULL;
        }
    }
};
```

### 4.10 UnattachedCategories

```jsx
// unattachedCategories 是一个静态全局变量，隶属于 namespace objc，存放未追加到类的分类数据。
static UnattachedCategories unattachedCategories;
```

```jsx
// 公开继承 ExplicitInitDenseMap<Class, category_list> 的类
// 抽象超参数分别是 Class, category_list
// 可以理解成 Class 是 key, category_list 是 value 的哈希表
class UnattachedCategories : public ExplicitInitDenseMap<Class, category_list>
{
public:
    // 向指定的类添加 locstamped_category_t
    void addForClass(locstamped_category_t lc, Class cls)
    {
        // 加锁
        runtimeLock.assertLocked();
        //
        if (slowpath(PrintConnecting)) {
            _objc_inform("CLASS: found category %c%s(%s)",
                         cls->isMetaClassMaybeUnrealized() ? '+' : '-',
                         cls->nameForLogging(), lc.cat->name);
        }
        // 向 UnattachedCategories 中添加 <Class, category_list>
        auto result = get().try_emplace(cls, lc);
        if (!result.second) {
            // 如果cls已经存在 category_list,则吧 lc 添加到 category_list 的数组中
            // 这里 append 是 category_list 的 append 函数
            // result.first->second 即是 cls 对应的 category_list
            result.first->second.append(lc);
        }
    }
    // 把 previously 的 categories 添加到 cls 上
    void attachToClass(Class cls, Class previously, int flags)
    {   // 加锁
        runtimeLock.assertLocked();
        ASSERT((flags & ATTACH_CLASS) ||
               (flags & ATTACH_METACLASS) ||
               (flags & ATTACH_CLASS_AND_METACLASS));

        auto &map = get();
        auto it = map.find(previously);

        if (it != map.end()) {
            category_list &list = it->second;
            if (flags & ATTACH_CLASS_AND_METACLASS) {
                int otherFlags = flags & ~ATTACH_CLASS_AND_METACLASS;
                // attachCategories 函数追加分类内容到类中去，下篇详细解析此函数
                attachCategories(cls, list.array(), list.count(), otherFlags | ATTACH_CLASS);
                attachCategories(cls->ISA(), list.array(), list.count(), otherFlags | ATTACH_METACLASS);
            } else {
                attachCategories(cls, list.array(), list.count(), flags);
            }
            map.erase(it);
        }
    }

    void eraseCategoryForClass(category_t *cat, Class cls)
    {
        runtimeLock.assertLocked();

        auto &map = get();
        auto it = map.find(cls);
        if (it != map.end()) {
            category_list &list = it->second;
            // 移除 category_list 中保存的 cat
            list.erase(cat);
            if (list.count() == 0) {
                // 如果 category_list 空了,把 <Class, category_list> 也移除
                map.erase(it);
            }
        }
    }

    void eraseClass(Class cls)
    {   // 加锁
        runtimeLock.assertLocked();
        // 删除指定 cls 的 <Class, category_list>
        get().erase(cls);
    }
};
```

到这里 `category_t` 相关的数据结构基本看完了，并不复杂。

## 5. 其他结构

在之前我们用 `clang` 编译我们的类文件和分类文件的时候，已经看到生成的 `_category_t` 结构体，下面我们再解读一下 `clang` 后的 `.cpp` 文件内容：

### 5.1 _OBJC__CATEGORY_INSTANCE_METHODS_NSObject__customCategory

编译器生成实例方法列表保存在 **DATA段的** `objc_const` `section` 里（`struct /*_method_list_t*/`）。

```jsx
static struct /*_method_list_t*/ {
    unsigned int entsize;  // sizeof(struct _objc_method)
    unsigned int method_count;
    struct _objc_method method_list[2];
} _OBJC_$_CATEGORY_INSTANCE_METHODS_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_objc_method),
    2,
    {{(struct objc_selector *)"customInstanceMethod_one", "v16@0:8", (void *)_I_NSObject_customCategory_customInstanceMethod_one},
    {(struct objc_selector *)"customInstanceMethod_two", "v16@0:8", (void *)_I_NSObject_customCategory_customInstanceMethod_two}}
};
```

### 5.2 _OBJC__CATEGORY_CLASS_METHODS_NSObject__customCategory

编译器生成类方法列表保存在 **DATA段的** `objc_const` `section` 里（`struct /*_method_list_t*/`）

```jsx
static struct /*_method_list_t*/ {
    unsigned int entsize;  // sizeof(struct _objc_method)
    unsigned int method_count;
    struct _objc_method method_list[2];
} _OBJC_$_CATEGORY_CLASS_METHODS_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_objc_method),
    2,
    {{(struct objc_selector *)"customClassMethod_one", "v16@0:8", (void *)_C_NSObject_customCategory_customClassMethod_one},
    {(struct objc_selector *)"customClassMethod_two", "v16@0:8", (void *)_C_NSObject_customCategory_customClassMethod_two}}
};
```

### 5.3 _OBJC__PROP_LIST_NSObject__customCategory

编译器生成属性列表保存在 **DATA段的** `objc_const` `section` 里（`struct /*_prop_list_t*/`）。

```jsx
static struct /*_prop_list_t*/ {
    unsigned int entsize;  // sizeof(struct _prop_t)
    unsigned int count_of_properties;
    struct _prop_t prop_list[2];
} _OBJC_$_PROP_LIST_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = {
    sizeof(_prop_t),
    2,
    {{"categoryProperty_one","T@\"NSString\",C,N"},
    {"categoryProperty_two","T@\"NSMutableArray\",&,N"}}
};
```

还有一个需要注意到的事实就是 `category` 的名字用来给各种列表以及后面的 `category` 结构体本身命名，而且有 `static` 来修饰，所以在同一个编译单元里我们的 `category` 名不能重复，否则会出现编译错误。

### 5.4 _OBJC__CATEGORY_NSObject__customCategory

编译器生成 `_category_t` 本身 `_OBJC_$_CATEGORY_NSObject_$_customCategory` 并用前面生成的实例方法、类方法、属性列表来初始化。还用 `OBJC_CLASS_$_NSObject` 来动态指定 `_OBJC_$_CATEGORY_NSObject_$_customCategory` 所属的类。

```jsx
extern "C" __declspec(dllimport) struct _class_t OBJC_CLASS_$_NSObject;

static struct _category_t _OBJC_$_CATEGORY_NSObject_$_customCategory __attribute__ ((used, section ("__DATA,__objc_const"))) = 
{
    "NSObject",
    0, // &OBJC_CLASS_$_NSObject,
    (const struct _method_list_t *)&_OBJC_$_CATEGORY_INSTANCE_METHODS_NSObject_$_customCategory,
    (const struct _method_list_t *)&_OBJC_$_CATEGORY_CLASS_METHODS_NSObject_$_customCategory,
    0,
    (const struct _prop_list_t *)&_OBJC_$_PROP_LIST_NSObject_$_customCategory,
};

// 设置 cls
static void OBJC_CATEGORY_SETUP_$_NSObject_$_customCategory(void ) {
    _OBJC_$_CATEGORY_NSObject_$_customCategory.cls = &OBJC_CLASS_$_NSObject;
}

#pragma section(".objc_inithooks$B", long, read, write)
__declspec(allocate(".objc_inithooks$B")) static void *OBJC_CATEGORY_SETUP[] = {
    (void *)&OBJC_CATEGORY_SETUP_$_NSObject_$_customCategory,
};
```

### 5.5 L_OBJC_LABEL_CATEGORY_$

最后，编译器在 **DATA段下的** `objc_catlist` `section` 里保存了一个长度为 1 的 `struct _category_t *` 数组 `L_OBJC_LABEL_CATEGORY_$`，如果有多个 `category`，会生成对应长度的数组，用于运行期 `category` 的加载，到这里编译器的工作就接近尾声了。

```jsx
static struct _category_t *L_OBJC_LABEL_CATEGORY_$ [1] __attribute__((used, section ("__DATA, __objc_catlist,regular,no_dead_strip")))= {
    &_OBJC_$_CATEGORY_NSObject_$_customCategory,
};
```

这时我们大概会有一个疑问，这些准备好的的 `_category_t` 数据什么时候附加到类上去呢？或者是存放在内存哪里等着我们去调用它里面的实例函数或类函数呢？**已知分类数据是会全部追加到类本身上去的。** 不是类似 `weak`机制或者 `associated object` 机制等，再另外准备哈希表存放数据，然后根据对象地址去查询处理数据等这样的模式。

下面我们就开始研究分类的数据是如何追加到本类上去的。

## 参考

- [结合 category 工作原理分析 OC2.0 中的 runtime](https://link.juejin.cn/?target=http%3A%2F%2Fwww.cocoachina.com%2Farticles%2F17293)
- [深入理解Objective-C：Category](https://link.juejin.cn/?target=https%3A%2F%2Ftech.meituan.com%2F2015%2F03%2F03%2Fdiveintocategory.html)
- [iOS 捋一捋Category加载流程及+load](https://link.juejin.cn/?target=https%3A%2F%2Fwww.jianshu.com%2Fp%2Ffd176e806cf3)
- [iOS开发之runtime（17）：_dyld_objc_notify_register方法介绍](https://link.juejin.cn/?target=https%3A%2F%2Fxiaozhuanlan.com%2Ftopic%2F6453890217)
- [iOS开发之runtime(27): _read_images 浅析](https://link.juejin.cn/?target=https%3A%2F%2Fxiaozhuanlan.com%2Ftopic%2F1452730698)

