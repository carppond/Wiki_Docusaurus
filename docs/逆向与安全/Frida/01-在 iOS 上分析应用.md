---
id: 在iOS上分析应用
slug: 在iOS上分析应用.html
title: 01 | 在 iOS 上分析应用
author: 鲤鱼
tag:
  - 逆向与安全
  - Frida
---

以 iOS 平台讲解 Frida 的基本使用，后续还会继续分享更多关于 Frida 实战的使用技巧。Frida 是一个跨平台的动态分析工具，支持 iOS、Android、macOS 等主流的操作系统，提供了功能丰富的 Python 和 JavaScript 接口，能够在运行时注入进程，获取进程相关信息、Hook 函数、修改参数、调用指定函数等等，逆向研究人员如果运用好 Frida 这一神兵利器，能够快速定位到关键点，提高分析的效率。
## 安装Frida
```jsx
sudo easy_install pip

pip install --user frida

sudo easy_install --upgrade frida

pip install --user frida-tools
```
然后在 iOS 上打开 Cydia 添加源：[https://build.frida.re](https://build.frida.re/)，如果 iOS 设备是 64 位的安装 Frida，如果是 32 位的安装 Frida for 32-bit devices。需要注意的是由于 Frida 官方源服务器在国外，下载速度可能会非常慢，有时需要半个小时才能完成，我建议大家换成 iOS 安全论坛的源，这样下载会快很多，源地址是[http://apt.ioshacker.net](http://apt.ioshacker.net/)。
## Frida 相关工具
Frida安装完后，打开 /Users/exchen/Library/Python/2.7/bin 目录可以看到分别有 frida、frida-ls-devices、frida-ps、frida-kill、frida-trace、frida-discover 这几个工具，下面我们介绍这些工具的使用方法。
### 1. frida-ls-devices
frida-ls-devices 用于查看当前的设备列表，一般在多个设备连接时会用到，它能显示当前所有连接设备的 Id，这个 Id 实际上就是设备的 UDID，获取的信息如下：
```jsx
$ frida-ls-devices 
Id                                        Type    Name        
----------------------------------------  ------  ------------
local                                     local   Local System
cca1b9055ac2684999cd81e525ac03fe6028b9f9  usb     iPhone      
tcp                                       remote  Local TCP
```
### 2. frida-ps
frida-ps 用于查看设备上当前所有运行的进程，我们来查看它的帮助信息：
```jsx
$ frida-ps -h
Usage: frida-ps [options]

Options:
  --version             show program's version number and exit
  -h, --help            show this help message and exit
  -D ID, --device=ID    connect to device with the given ID
  -U, --usb             connect to USB device
  -R, --remote          connect to remote frida-server
  -H HOST, --host=HOST  connect to remote frida-server on HOST
  -a, --applications    list only applications
  -i, --installed       include all installed applications
```
下面这几个参数是比较重要，使用最多的：
--version 显示版本号。
-D 指定需要连接的设备 UDID，在多个设备连接时才会用到，如果只有一个设备不必用它。
-U 连接 USB 设备。
-a 只显示正在运行的应用。
-i 显示所有已安装的应用。
接下来我们看看实际操作 frida-ps 几个用法：
(1) 查看进程 USB 设备的进程，这里查看到的是所有正在运行的进程，包括 Daemon（守护程序）。
```jsx
$ frida-ps -U 
PID  Name
---  --------------------------------------------------------
1087  Cydia
647  doubleH3lix
229  ReportCrash
39  wifid
......
```
还可以使用 grep 进行过滤，比如只需要查看 Cydia。
```jsx
$ frida-ps -U | grep Cydia
1087  Cydia
```
(2) 查看正在运行的应用。
```jsx
$ frida-ps -U -a
 PID  Name         Identifier               
----  -----------  -------------------------
1161  App Store    com.apple.AppStore       
1087  Cydia        com.saurik.Cydia         
1167  Safari       com.apple.mobilesafari   
......
```
(3) 查看所有安装的应用。
```jsx
frida-ps -U -a -i
PID  Name             Identifier                     
----  ---------------  -------------------------------
1161  App Store        com.apple.AppStore             
1087  Cydia            com.saurik.Cydia               
1167  Safari           com.apple.mobilesafari             
1163  电话               com.apple.mobilephone                   
   -  QQ               com.tencent.mqq                
   -  邮件               com.apple.mobilemail                     
   -  音乐               com.apple.Music                
......
```
(4) 如果有多个设备时，可以指定查看某个设备的进程。
```jsx
frida-ps -D cca1b9055ac2684999cd81e525ac03fe6028b9f9 -a -i
```
### 3. frida-kill
frida-kill 用于结束进程，需要指定应用名称或 PID，比如结束 App Store 进程
```jsx
frida-kill -U "App Store"
```
如果 App Store 进程的 PID 是 1161
```jsx
frida-kill -U 1161
```
### 4. frida-trace
frida-trace 用于跟踪函数或者 Objective-C 方法的调用，frida-trace -h 能够查看它的帮助，最重要的有下面几个参数：
-i 跟踪某个函数，-x 排除某个函数。
-m 跟踪某个 Objective-C 方法，-M 排除某个 Objective-C 方法。
-a 跟踪某一个地址，需要指名模块的名称。
接下来实际操作一下，比如需要跟踪 Cydia 点击关于的操作，输入以下命令，它会在当前目录下生成一个 handlers 目录，然后再生成一个 HomeController_aboutButtonClicked.js 文件，在 Cydia 点击关于时，会输出以下信息，按 Ctrl-C 可以停止跟踪。
```jsx
$ frida-trace -U -m "-[HomeController aboutButtonClicked]" Cydia
Instrumenting functions...                                              
-[HomeController aboutButtonClicked]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_aboutButtonClicked_.js"
Started tracing 1 function. Press Ctrl+C to stop.                       
           /* TID 0x403 */
 91314 ms  -[HomeController aboutButtonClicked]
```
打开 HomeController_aboutButtonClock.js 文件，会看到有两个函数，onEnter 是进入该函数时会执行的代码，onLeave 是该函数执行完离开时会执行的代码，在相应的位置添加 Thread.backrace 这句代码可以打印出调用栈。
```jsx
{
  onEnter: function (log, args, state) {
    log("-[HomeController aboutButtonClicked]");
    log('\tBacktrace:\n\t' + Thread.backtrace(this.context,Backtracer.ACCURATE).map(DebugSymbol.fromAddress).join('\n\t'));
  },

  onLeave: function (log, retval, state) {
  }
}
```
再次执行 frida-trace， HomeController_aboutButtonClicked.js 不会覆盖，会调用刚才我们添加好的代码，打印调用栈信息如下：
```jsx
$ frida-trace -U -m "-[HomeController aboutButtonClicked]" Cydia
Instrumenting functions...                                              
-[HomeController aboutButtonClicked]: Loaded handler at "/Users/exchen/Cydia/__handlers__/__HomeController_aboutButtonClicked_.js"
Started tracing 1 function. Press Ctrl+C to stop.                       
           /* TID 0x403 */
  6701 ms  -[HomeController aboutButtonClicked]
  6701 ms    Backtrace:
  0x19145dc54 UIKit!-[UIApplication sendAction:to:from:forEvent:]
  0x1915ce22c UIKit!-[UIBarButtonItem(UIInternal) _sendAction:withEvent:]
  0x19145dc54 UIKit!-[UIApplication sendAction:to:from:forEvent:]
  0x19145dbd4 UIKit!-[UIControl sendAction:to:forEvent:]
  0x191448148 UIKit!-[UIControl _sendActionsForEvents:withEvent:]
  0x1914482b0 UIKit!-[UIControl _sendActionsForEvents:withEvent:]
  0x19145d4b8 UIKit!-[UIControl touchesEnded:withEvent:]
  0x19145cfd4 UIKit!-[UIWindow _sendTouchesForEvent:]
  0x19145836c UIKit!-[UIWindow sendEvent:]
  0x191428f80 UIKit!-[UIApplication sendEvent:]
  0x191c22a20 UIKit!__dispatchPreprocessedEventFromEventQueue
  0x191c1d17c UIKit!__handleEventQueue
  0x191c1d5a8 UIKit!__handleHIDEventFetcherDrain
  0x18b2a542c CoreFoundation!__CFRUNLOOP_IS_CALLING_OUT_TO_A_SOURCE0_PERFORM_FUNCTION__
  0x18b2a4d9c CoreFoundation!__CFRunLoopDoSources0
  0x18b2a29a8 CoreFoundation!__CFRunLoopRun
```
frida-trace 可以支持通配符，比如我们想跟踪 Home 开头的类，方法名是任意的，可以执行下面的命令：
```jsx
$ frida-trace -U -m "-[Home* *]" Cydia
Instrumenting functions...                                              
-[HomeController navigationURL]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_navigationURL_.js"
-[HomeController aboutButtonClicked]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_aboutButtonClicked_.js"
-[HomeController init]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_init_.js"
-[HomeController dealloc]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_dealloc_.js"
-[HomeController leftButton]: Loaded handler at "/Users/exchen/__handlers__/__HomeController_leftButton_.js"
Started tracing 5 functions. Press Ctrl+C to stop.                      
           /* TID 0x403 */
 20323 ms  -[HomeController aboutButtonClicked]
 22986 ms  -[HomeController navigationURL]
```
**跟踪函数实例**
在上面我们简单地了解 frida-trace 的使用，趁热打铁，我们来做一个实例。很多应用在登录时都会加密数据，我们的目标是获取某个应用的 AES 加密的原文和密钥。AES 加解密一般会调用 CCCrypt 这个函数，该函数原型如下：
```jsx
CCCryptorStatus CCCrypt( 
  CCOperation op, //kCCEncrypt为加密，kCCDecrypt为解密 
  CCAlgorithm alg, //加密方式 kCCAlgorithmAES128为AES加密
  CCOptions options, //增充方式
  const void *key,   //密钥
  size_t keyLength,  //密钥长度
  const void *iv,    // IV
  const void *dataIn, //待加密的原文
  size_t dataInLength, //原文长度
  void *dataOut,       //加密后输出的数据
  size_t dataOutAvailable,  
  size_t *dataOutMoved)
```
尝试对 CCCrypt 进行跟踪，命令如下：
```jsx
$ frida-trace -U -i CCCrypt xxx
Instrumenting functions...                                              
CCCrypt: Auto-generated handler at "/Users/exchen/xxx/__handlers__/xxx/CCCrypt.js"
Started tracing 1 function. Press Ctrl+C to stop.                       
           /* TID 0x1f917 */
 56944 ms  CCCrypt(op=0x1, alg=0x0, options=0x3, key=0x170a5e2a0, keyLength=0x10, iv=0x0, dataIn=0x2826e5830, dataInLength=0x20, dataOut=0x2826e5200, dataOutAvailable=0x30, dataOutMoved=0x170a5e290)
```
在 CCCrypt.js 里添加以下代码：
```jsx
{
  onEnter: function (log, args, state) {
    log("CCCrypt(" +
      "op=" + args[0] +
      ", alg=" + args[1] +
      ", options=" + args[2] +
      ", key=" + args[3] +
      ", keyLength=" + args[4] +
      ", iv=" + args[5] +
      ", dataIn=" + args[6] +
      ", dataInLength=" + args[7] +
      ", dataOut=" + args[8] +
      ", dataOutAvailable=" + args[9] +
      ", dataOutMoved=" + args[10] +
    ")");

    //保存参数
    this.operation   = args[0]
    this.CCAlgorithm = args[1]
    this.CCOptions   = args[2]
    this.keyBytes    = args[3]
    this.keyLength   = args[4]
    this.ivBuffer    = args[5]
    this.inBuffer    = args[6]
    this.inLength    = args[7]
    this.outBuffer   = args[8]
    this.outLength   = args[9]
    this.outCountPtr = args[10]

  //this.operation == 0 代表是加密
    if (this.operation == 0) {
      //打印加密前的原文
        console.log("In buffer:")
        console.log(hexdump(ptr(this.inBuffer), {
            length: this.inLength.toInt32(),
            header: true,
            ansi: true
        }))
        //打印密钥
        console.log("Key: ")
        console.log(hexdump(ptr(this.keyBytes), {
            length: this.keyLength.toInt32(),
            header: true,
            ansi: true
        }))
        //打印 IV
        console.log("IV: ")
        console.log(hexdump(ptr(this.ivBuffer), {
            length: this.keyLength.toInt32(),
            header: true,
            ansi: true
        }))
    }
  },
  onLeave: function (log, retval, state) {
  }
}
```
再次执行 frida-trace 跟踪，在登录时可以发现原文、密钥，IV 都打印出来了，一目了然。
```jsx
$ frida-trace -U -i CCCrypt xxx
Instrumenting functions...                                              
CCCrypt: Loaded handler at "/Users/exchen/xxx/__handlers__/xxx/CCCrypt.js"
Started tracing 1 function. Press Ctrl+C to stop.                       
In buffer:
            0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
10acea400  7B 22 75 73 65 72 69 64 22 3A 22 31 37 37 36 35  {"userid":"17765
10acea410  34 33 22 2C 22 70 61 73 73 77 6F 64 22 3A 22 65  43","passwod":"e
10acea420  31 30 61 64 63 33 39 34 39 62 61 35 39 61 62 62  10adc3949ba59abb 
10acea430  65 35 36 65 30 35 37 66 32 30 66 38 38 33 65 22  e56e057f20f883e" 
10acea440  7D                                               }
Key: 
            0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
16fb969e0  39 36 65 37 39 32 31 38 39 36 35 65 62 37 32 63  96e79218965eb72c 

IV: 
            0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
16fb969c0  39 32 61 35 34 39 64 64 35 61 33 33 30 31 31 32  92a549dd5a330112 
```
通过一个实例我们见证到 Frida 的强大，不需要编译代码，所有的操作都是编写脚本语言进行的，区区十几行 JavaScript 脚本代码即可轻松获取 AES 加密的密钥和相关参数。试想如果没有 Frida，我们的分析方法可能是编写动态库注入，对 CCCrypt 进行 Hook，然后打印相关的参数，或者是使用 LLDB 连接程序给 CCCrypt 添加断点，这些方法都不如使用 Frida 跟踪函数功能的效率高。
Frida 官网：[https://frida.re](https://frida.re/)，Frida 源码：[https://github.com/frida](https://github.com/frida)
