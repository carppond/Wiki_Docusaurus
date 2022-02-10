---
id: 远程过程调用RPC的使用方法
slug: 远程过程调用RPC的使用方法.html
title: 05 | 远程过程调用（RPC）的使用方法
author: 鲤鱼
tag:
  - 逆向与安全
  - Frida
---

本文是 Frida 实战系列教程的第五篇，讲解远程过程调用（RPC）的使用方法，也就是将应用进程中的 Objective-C 方法或 C 函数导出，提供给 Python 使用。
远程过程调用（RPC）对于应用逆向起到了很便捷的作用，比如目标应用有一个加解密的函数内部实现非常复杂，想分析整个加解密的实现过程的工作量较大，此时可以使用 frida 的 RPC 功能，只要知道加解密函数的名称或地址，还有相应的参数，即可直接调用得到加解密后的结果。
下面我们来做一个实例，编写一个 CrackMe 程序，定义一个 coreClass 类，里面有 4 个比较重要的方法，分别是 getDeviceId、httpPost、encrypt、decrypt，从它们的名称可以看出大概的意思，具体的定义如下：
```jsx
@interface coreClass : NSObject
@end

@implementation coreClass

- (NSString*)getDeviceId{
    return @"e10adc3949ba59abbe56e057f20f883e";
}

+(NSString*)httpPost:(NSString*)url{
    NSLog(@"URL: %@", url);
    return @"test";
}

- (NSString*)encrypt:(NSData*)data :(NSString*)key{
    
    NSLog(@"data: %@", data);
    NSLog(@"key: %@", key);
    return @"encrypt successed!";
}

- (NSString*)decrypt:(NSString*)str :(NSString*)key{
    NSLog(@"str: %@", str);
    NSLog(@"key: %@", key);
    return @"decrypt successed!";
}
@end
```
下面我们要做的事情是在 JS 脚本里去调用这 4 个方法。Objective-C 方法有两种，一种是 - 号开头，称为对象方法，还有一种是 + 号开头，称为类方法，前者需要初始化一个实例才能调用，后者不需要初始化实例，可以直接调用。先来看看对象方法在 JS 脚本里如何调用，比如我们要调用 -[coreClass getDeviceId] 方法，调用的代码如下
```jsx
var coreClass = ObjC.classes.coreClass.alloc();
var deviceId = coreClass['- getDeviceId'].call(coreClass);
console.log("deviceId: " + deviceId.toString());
```
再来看看 +[coreClass httpPost:] 方法的调用，从下面的代码可以看出，类方法是不需要初始化实例，在方法名称后面加上一个 _ 号就可以调用了。
```jsx
var coreClass = ObjC.classes.coreClass;
var url = ObjC.classes.NSURL.URLWithString_("http://www.ioshacker.net");
var retString =  coreClass.httpPost_(url);
console.log("retString: " + retString);
```
-[coreClass encrypt::] 的调用代码如下，输入的参数有两个，一个参数是 NSData 类型的，一个是 NSString 类型。
```jsx
var coreClass = ObjC.classes.coreClass.alloc();
var str = ObjC.classes.NSString.stringWithString_("test");

//NSData *data = [@"data" dataUsingEncoding:NSUTF8StringEncoding];
var data = str.dataUsingEncoding_(4);
var key = ObjC.classes.NSString.stringWithString_("key");

var encryptString = coreClass['- encrypt::'].call(coreClass, data, key);
console.log("encryptString: " + encryptString);
```
-[coreClass decrypt::] 的调用代码如下，两个参数都是 NSString 类型。
```jsx
var coreClass = ObjC.classes.coreClass.alloc();
var str = ObjC.classes.NSString.stringWithString_("test");
var key = ObjC.classes.NSString.stringWithString_("key");
var decryptString = coreClass['- decrypt::'].call(coreClass, str, key);
console.log("decryptString: " + decryptString);
```
在上面我们已经学会如何在 JS 脚本里调用目标应用的 Objective-C 方法，接下面要做的就是将功能代码导出提供给 Python 使用。在 JS 代码里定义4个函数，分别是 getDeviceId、httpPost、encrypt、decrypt，这 4 个函数分别代表了调用目标进程的 4 个 Objective-C 方法，然后再使用 rpc.exports 将这 4 个函数导出，代码如下：
```jsx
function getDeviceId(){
        var coreClass = ObjC.classes.coreClass.alloc();
        var deviceId = coreClass['- getDeviceId'].call(coreClass);
        console.log("deviceId: " + deviceId.toString());
        console.log("--------------------");
}

function httpPost(inputurl){
        var coreClass = ObjC.classes.coreClass;
        var url = ObjC.classes.NSURL.URLWithString_(inputurl);
        var retString =  coreClass.httpPost_(url);
        console.log("retString: " + retString);
        console.log("--------------------");
}

function encrypt(inputstr, inputkey){
        var coreClass = ObjC.classes.coreClass.alloc();
        var str = ObjC.classes.NSString.stringWithString_(inputstr);

        //NSData *data = [@"data" dataUsingEncoding:NSUTF8StringEncoding];
        var data = str.dataUsingEncoding_(4);
        var key = ObjC.classes.NSString.stringWithString_(inputkey);

        var encryptString = coreClass['- encrypt::'].call(coreClass, data, key);
        console.log("encryptString: " + encryptString);
        console.log("--------------------");
}

function decrypt(inputstr, inputkey){
        var coreClass = ObjC.classes.coreClass.alloc();
        var str = ObjC.classes.NSString.stringWithString_(inputstr);
        var key = ObjC.classes.NSString.stringWithString_(inputkey);
        var decryptString = coreClass['- decrypt::'].call(coreClass, str, key);
        console.log("decryptString: " + decryptString);
        console.log("--------------------");
}

//getDeviceId();
//httpPost("http://www.ioshacker.net");
//encrypt("123", "456");
//decrypt("123", "456");

// 导出RPC函数
rpc.exports = {
    deviceid: function () {
        getDeviceId();
    },
    httppost: function(urlstr) {
        httpPost(urlstr);
    },
    encrypt: function (inputstr, inputkey) {
        encrypt(inputstr, inputkey);
    },
    decrypt: function(inputstr, inputkey) {
        decrypt(inputstr, inputkey);
    },
};
```
接着我们再编写 python 代码，首先调用 get_usb_device().attach 附加到目标进程，附加成功会返回一个 Session 实例，然后读取 call.js 文件里的内容，这里的内容就是上面我们编写的 JS 代码，然后调用 session.create_script 创建脚本，再调用 load 加载脚本，最后调用 script.exports 获取 JS 导出的 RPC 函数，此时就可以调用 RPC 函数，代码如下：
```jsx
# -*- coding: utf-8 -*-
import codecs
import frida

if __name__ == '__main__':
        #附加到目标进程
        session = frida.get_usb_device().attach(u'CrackMe')

        #读取JS脚本
        with codecs.open('./call.js', 'r', 'utf-8') as f:
            source = f.read()

        script = session.create_script(source)
        script.load()

        rpc = script.exports

        #调用导出的函数
        rpc.deviceid()
        rpc.httpPost("http://www.ioshacker.net")
        rpc.encrypt("123", "456")
        rpc.decrypt("123", "456")
        session.detach()
```
上面我们讲到了如何将 Objective-C 方法导出给 Python 使用，那如何导出 C 函数呢？比如调用 NSHomeDirectory 这个系统提供的函数，知道它所在的模块是 Foundation，找到它的地址在 JS 脚本里就可以调用，然后在 rpc.exports 里添加一个导出函数，这样 Python 就可以调用了。代码如下：
```jsx
function getHomeDir(){
        var NSHomeDirectory = new NativeFunction(ptr(Module.findExportByName("Foundation", "NSHomeDirectory")), 'pointer', []);
        var path = new ObjC.Object(NSHomeDirectory());
        console.log('homeDir: ' + path);
}

// 导出RPC函数
rpc.exports = {
    //......
    homedir: function(){
            getHomeDir();
    }
};
```
