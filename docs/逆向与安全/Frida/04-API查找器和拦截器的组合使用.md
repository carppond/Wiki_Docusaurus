---
id: API查找器和拦截器的组合使用
slug: API查找器和拦截器的组合使用.html
title: 04 | API查找器和拦截器的组合使用
author: 鲤鱼
tag:
  - 逆向与安全
  - Frida
---


本文是 Frida 系列教程的第四篇，讲解 API查找器和拦截器的组合使用，以及替换 implementation 的方式进行 Hook。
在前面的 Frida 教程中我们讲到了如何使用拦截器（Interceptor）对 Objective-C 方法和 C 函数进行 Hook，这种方式对指定的几个函数进行操作比较方便，但是如果有些情况需要批量 Hook，比如对某一个类的所有方法进行 Hook，或者对某个模块的特定名称的函数进行 Hook，可能我们并不知道准确的名称是什么，只知道大概的关键字，这种情况怎么 Hook 呢？这时就得使用 API查找器（ApiResolver）先把感兴趣函数给找出来，得到地址之后就能 Hook 了。

API查找器支持对 Objective-C 方法和 C 函数的查找，比如我们来写一个找到 NSFileManager 这个类名下的所有方法。新建一个 ApiResolver，如果查找 Objective-C，ApiResolver 参数中填写 objc，如果是查找 C 函数，ApiResolver 参数中填写 module，然后调用 enumerateMatches 枚举函数，每次枚举到一个函数会调用一次 onMatch，回调参数 match 包含 name 和 address 两个属性，分别代表名称和地址。整个枚举过程完成之后会调用 onComplete，代码如下：
```jsx
var resolver = new ApiResolver('objc');
resolver.enumerateMatches('*[NSFileManager *]', {
   onMatch: function(match) {
      console.log(match['name'] + ":" + match['address']);
   },
   onComplete: function() {}
});
```
附加 Safari 浏览器并加载脚本，会打印出 NSFileManager 所有的方法。
```jsx
frida -U -l hook_objc.js "Safari 浏览器"
-[NSFileManager dealloc]:0x1e2324034
-[NSFileManager setDelegate:]:0x1e23b2744
-[NSFileManager delegate]:0x1e2333ab8
-[NSFileManager _info]:0x1e2333ae0
-[NSFileManager removeItemAtURL:error:]:0x1e235583c
-[NSFileManager copyItemAtURL:toURL:error:]:0x1e23b2ab0
-[NSFileManager fileExistsAtPath:isDirectory:]:0x1e2301d50
-[NSFileManager fileExistsAtPath:]:0x1e22e5398
-[NSFileManager setAttributes:ofItemAtPath:error:]:0x1e23180bc
-[NSFileManager removeItemAtPath:error:]:0x1e23336bc
-[NSFileManager enumeratorAtPath:]:0x1e2326024
-[NSFileManager isWritableFileAtPath:]:0x1e23240dc
-[NSFileManager moveItemAtPath:toPath:uniquePath:error:]:0x1ec6f4ec4
-[NSFileManager copyItemAtPath:toPath:uniquePath:error:]:0x1ec6f4ed4
......
```
得到方法名称之后，我们可以把感兴趣的找出来，然后调用拦截器（Interceptor）进行 Hook ，比如我们需要做一个简易的文件监控的功能，监控某个进程操作了哪些文件，文件操作的相关的方法会调用 removeItemAtPath、moveItemAtPath、copyItemAtPath、createFileAtPath、createDirectoryAtPath、enumeratorAtPath、contentsOfDirectoryAtPath，分别代表删除文件、移动文件、复制文件、创建文件、创建目录、枚举目录（包括子目录），枚举目录（不包括子目录），具体代码如下：
```jsx
var resolver = new ApiResolver('objc');
resolver.enumerateMatches('*[NSFileManager *]', {
   onMatch: function(match) {
      var method = match['name'];
      var implementation = match['address'];

      // 过滤需要拦截的方法
      if (//(method.indexOf("fileExistsAtPath") != -1) 
         (method.indexOf("removeItemAtPath") != -1)
        || (method.indexOf("moveItemAtPath") != -1)
        || (method.indexOf("copyItemAtPath") != -1)
        || (method.indexOf("createFileAtPath") != -1)
        || (method.indexOf("createDirectoryAtPath") != -1)
        || (method.indexOf("enumeratorAtPath") != -1)
        || (method.indexOf("contentsOfDirectoryAtPath") != -1)) {

         console.log(match['name'] + ":" + match['address']);
         try {
            Interceptor.attach(implementation, {
               onEnter: function(args) {

                  var className = ObjC.Object(args[0]);
                  var methodName = args[1];
                  var filePath = ObjC.Object(args[2]);

                  console.log("className: " + className.toString());
                  console.log("methodName: " + methodName.readUtf8String());
                  console.log("filePath: " + filePath.toString());
                 
               },
               onLeave: function(retval) {
                  
               }
            });
         } catch (err) {
            console.log("[!] Exception: " + err.message);
         }
      }

   },
   onComplete: function() {
   }
});
```
附加 SpringBoard 并加载脚本，然后我们操作卸载某个应用，此时会打印出相关的文件操作的路径，从下面打印的信息中我们可以看到卸载某个应用时，SpringBoard 进程对文件的操作过程，会删除 /var/mobile/Library/UserNotifications 和应用的沙盒目录。
```jsx
frida -U -l hook_objc.js SpringBoard
[iPhone::SpringBoard]-> 
className: <NSFileManager: 0x282954250>
methodName: removeItemAtPath:error:
filePath: /var/mobile/Library/UserNotifications/com.360buy.jdmobile/Attachments
className: <NSFileManager: 0x282954250>
methodName: filesystemItemRemoveOperation:shouldRemoveItemAtPath:
filePath: <NSFilesystemItemRemoveOperation: 0x283674f40>
className: <NSFileManager: 0x282954250>
methodName: enumeratorAtPath:
filePath: /private/var/mobile/Containers/Data/Application/C8A23CD4-6857-4BF4-876E-7FD104B0E799/Library/Caches/Snapshots/com.360buy.jdmobile
className: <NSFileManager: 0x282954250>
methodName: removeItemAtPath:error:
filePath: /private/var/mobile/Containers/Data/Application/C8A23CD4-6857-4BF4-876E-7FD104B0E799/Library/Caches/Snapshots/com.360buy.jdmobile
className: <NSFileManager: 0x282954250>
methodName: filesystemItemRemoveOperation:shouldRemoveItemAtPath:
filePath: <NSFilesystemItemRemoveOperation: 0x283677e80>
className: <NSFileManager: 0x282954250>
methodName: removeItemAtPath:error:
filePath: /private/var/mobile/Containers/Data/Application/C8A23CD4-6857-4BF4-876E-7FD104B0E799/Library/Caches/Snapshots
className: <NSFileManager: 0x282954250>
methodName: filesystemItemRemoveOperation:shouldRemoveItemAtPath:
filePath: <NSFilesystemItemRemoveOperation: 0x283677e80>
.......
```
比如需要拦截 NSFileManager 类的所有方法，但是排除某些方法，代码可以这样写。
```jsx
var resolver = new ApiResolver('objc');
resolver.enumerateMatches('*[NSFileManager *]', {
   onMatch: function(match) {
      var method = match['name'];
      var implementation = match['address'];

      // 过滤不需要拦截的方法，其他方法全部拦截
      if (method.indexOf("dealloc") == -1) {
         //进行 Hook
         //......
      }
   },
});
```
接下来我们来学习 API 查找器如何查找 C 函数，有 3 种方式，格式参考如下：
```jsx
format is: exports:*!open*, exports:libc.so!* or imports:notepad.exe!*
```
比如我们查找 fopen 函数，代码如下：
```jsx
var resolver = new ApiResolver('module');
resolver.enumerateMatches('exports:*!fopen*', {
    onMatch: function(match) {

         var name = match['name'];
         var address = match['address'];
         console.log(name + ":" + address);

    },
    onComplete: function() {}
});
```
附加 SpringBoard 加载脚本之后，打印如下信息，名称包括了动态库的路径，此时得到函数地址，就可以调用拦截器进行 Hook。
```jsx
frida -U -l hook_objc.js SpringBoard
[iPhone::SpringBoard]-> 
/usr/lib/libSystem.B.dylib!fopen:0x1e145d4d0
/usr/lib/libSystem.B.dylib!fopen$DARWIN_EXTSN:0x1e1495d04
/usr/lib/system/libsystem_c.dylib!fopen$DARWIN_EXTSN:0x1e1495d04
/usr/lib/system/libsystem_c.dylib!fopen:0x1e145d4d0
/usr/lib/libSystem.B.dylib!fopen:0x1e145d4d0
/usr/lib/libSystem.B.dylib!fopen$DARWIN_EXTSN:0x1e1495d04
```
最后给大家再补充一个知识点，Objective-C 除了调用拦截器进行 Hook，还可以使用替换 implementation 的方式，类似于苹果提供的一套  Method Swizzling Hook 的方式，比如 Hook +[NSURL URLWithString:] 的例子如下：
```jsx
var method = ObjC.classes.NSURL['+ URLWithString:'];
var origImp = method.implementation; 
method.implementation = ObjC.implement(method, function  (self, sel, url){  

      console.log("+ [NSURL URLWithString:]");
      var urlString = ObjC.Object(url);
      console.log("url: " + urlString.toString());

      return origImp(self, sel, url);   //调用原方法，如果不调用则原方法得不到执行

                        //替换参数，将 URL 替换成 http://www.ioshacker.net
      //var newUrl = ObjC.classes.NSString.stringWithString_("http://www.ioshacker.net");
      //return origImp(self, sel, newUrl);  

}); 
```
