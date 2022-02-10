---
id: Hook大法，拦截器的使用
slug: Hook大法，拦截器的使用.html
title: 02 | Hook 大法，拦截器的使用
author: 鲤鱼
tag:
  - 逆向与安全
  - Frida
---


拦截器（Interceptor）是 Frida 很重要的一个功能，它能够帮助我们 Hook C 函数、Objective-C 方法，在第一篇使用 frida-trace 跟踪 CCCrypt 函数的实例中，frida-trace 实际上也用到了拦截器。
## Objective-C 数据类型的处理
在学习使用拦截器（Interceptor）之前，有必要了解在 frida 脚本里如何对 Objective-C 的数据类型进行处理，比如像 NSString、NSData、NSArray、NSDictionary 都是很常见的类型，我们必须要知道这些类型在 frida 脚本中该怎么读取内容。下面通过一个实例来看看 NSString 如何读取内容并输出。应用在发送 HTTP 请求时，通常都会调用 [NSURL URLWithString:] 这个方法来初始化 URL 地址，我们对这个方法进行跟踪，执行下面的命令，xxx 代表目标进程的名称。
```jsx
frida-trace -U -m "+[NSURL URLWithString:]" xxx
```
然后在 handlers 找到 NSURL_URLWithString.js 文件，可以看到 UTF8String 这个函数是 NSString，我们调用 UTF8String 即可得到字符串。
```jsx
onEnter: function (log, args, state) {
    log("+[NSURL URLWithString:" + args[2] + "]");
    var objcHttpUrl = ObjC.Object(args[2]);  //获取 Objective-C 对象 NSString
    var strHttpUrl = objcHttpUrl.UTF8String(); 
    log("httpURL: " + strHttpUrl);    

  },
```
然后我们来做第二个实例，了解如何获取 NSData 的字符串。应用发送 HTTP 请求，通常会调用 [NSURLRequest setHTTPBody:] 设置 HTTPBody，需要注意的是除了 NSURLRequest，可能还会有一个 NSMutableURLRequest，对这两个方法进行跟踪。
```jsx
frida-trace -U -m "-[NSURLRequest setHTTPBody:]" -m "-[NSMutableURLRequest setHTTPBody:]" xxx
```
找到 NSMutableURLRequest_setHTTPBody.js 修改成如下代码，可以看到调用 NSData 的 bytes 函数得到内存地址，然后再调用 readUtf8String 读取内存中的数据，即可得到字符串。
```jsx
onEnter: function (log, args, state) {
    log("-[NSMutableURLRequest setHTTPBody:" + args[2] + "]");

    var objcData = ObjC.Object(args[2]);  //NSData
    var strBody = objcData.bytes().readUtf8String(objcData.length()); //NSData 转换成 string
    log("HTTPBody: " + strBody);
    
  },
```
遍历NSDictionary的代码如下：
```jsx
var dict = new ObjC.Object(args[2]);
var enumerator = dict.keyEnumerator();
var key;
while ((key = enumerator.nextObject()) !== null) {
  var value = dict.objectForKey_(key);
}
```
遍历 NSArray 的代码如下：
```jsx
var array = new ObjC.Object(args[2]);
var count = array.count().valueOf();
for (var i = 0; i !== count; i++) {
  var element = array.objectAtIndex_(i);
}
```
## 拦截 C 函数
下面我们学习如何使用拦截器编写一个 Hook fopen 的功能。了解一下 fopen 函数的原型和功能，原型如下：
```jsx
FILE *fopen(const char *filename, const char *mode)
```
其功能是使用给定的模式 mode 打开 filename 所指向的文件。文件如果打开成功，会返回一个指针，相当于句柄。如果文件打开失败则返回 0。新建一个文件 fopen.js，添加下面的代码，其中 Interceptor.attach() 是我们添加的拦截器，拦截 fopen 函数，onEnter 是进入 fopen 函数时要执行的代码，打印出 fopen 的第一个参数，也就是 fopen 准备操作的文件路径，onLeave 是离开 fopen 函数时要执行的代码，打印返回值，并将返回值替换成 0, 这样 fopen 打开文件就会失败。
```jsx
Interceptor.attach(Module.findExportByName(null, "fopen"), {
    
        onEnter: function(args) {
            if (args[0].isNull()) return;
            var path = args[0].readUtf8String();
            console.log("fopen " + path);
    
        },
            onLeave: function(retval) {
                    console.log("\t[-] Type of return value: " + typeof retval);
                    console.log("\t[-] Original Return Value: " + retval);
                    retval.replace(0);  //将返回值替换成0
                    console.log("\t[-] New Return Value: " + retval);
            },
    })
```
然后在计算机上执行命令 frida -U -l /Users/exchen/frida/fopen.js xxx，-l 参数表示加载指定的脚本文件，xxx 是你要操作的应用名称。此时我们看到原本 fopen 能操作的文件，使用拦截器修改返回值之后，就不能则会打开失败。还有一种加载脚本的方法，是先进入交互模式，比如执行 frida -U xxx，注入 xxx 应用的进程，再调用 %load 命令加载脚本。如果想退出frida，保持应用在前台，然后在计算机上按 control+D 即可。
```jsx
[iPhone::iDevice]-> %load /Users/exchen/frida/fopen.js
```
除了系统库自带的函数，我们还可以拦截自定义的函数，比如我们自定义一个 getStr 函数，返回的参数是一个字符串指针，我们在 onLeave 函数中添加下面的代码，新建一个变量 string，分配内存并填充字符串 4567789, 然后将返回值替换变量 string。
```jsx
Interceptor.attach(Module.findExportByName(null, "getStr"), {

    onEnter: function(args) {
        console.log("getStr");

    },
        onLeave: function(retval) {
                console.log("\t[-] Type of return value: " + typeof retval);
                console.log("\t[-] Original Return Value: " + retval.readUtf8String());

                var string = Memory.allocUtf8String("456789");  //分配内存
                retval.replace(string); //替换

                console.log("\t[-] New Return Value: " + retval.readUtf8String());
        },
})
```
## 拦截 OC 方法
frida 不仅可以拦截 C 函数，还可以拦截 Objective-C 方法，比如我们编写脚本对 +[NSURL URLWithString:] 进行拦截，代码如下，其中 onEnter 调用 ObjC.classes.NSString.stringWithString_ 给 NSString 传递新的值，这样相当于替换原本的 URL。
```jsx
var className = "NSURL";
var funcName = "+ URLWithString:";
var hook = eval('ObjC.classes.' + className + '["' + funcName + '"]');
Interceptor.attach(hook.implementation, {
        onLeave: function(retval) {

                console.log("[*] Class Name: " + className);
                console.log("[*] Method Name: " + funcName);
                console.log("\t[-] Type of return value: " + typeof retval);
                console.log("\t[-] Original Return Value: " + retval);
        },

        onEnter: function(args){

                var className = ObjC.Object(args[0]);
                var methodName = args[1];
                var urlString = ObjC.Object(args[2]);

                console.log("className: " + className.toString());
                console.log("methodName: " + methodName.readUtf8String());
                console.log("urlString: " + urlString.toString());
                console.log("-----------------------------------------");

                urlString = ObjC.classes.NSString.stringWithString_("http://www.baidu.com")
                console.log("newUrlString: " + urlString.toString());
                console.log("-----------------------------------------");

        }
});
```
有时候被拦截的函数调用的次数较多，打印的信息也会较多，我们需要保存成文件，方便以后慢慢查看，可以使用下面的代码将有用的信息保存成文件。
```jsx
var file = new File("/var/mobile/log.txt","a+");//a+表示追加内容，和c语言的fopen函数模式类似
file.write("logInfo");
file.flush();
file.close();
```
