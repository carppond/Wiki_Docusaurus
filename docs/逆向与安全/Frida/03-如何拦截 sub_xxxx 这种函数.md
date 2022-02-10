---
id: 如何拦截sub_xxxx这种函数
slug: 如何拦截sub_xxxx这种函数.html
title: 03 | 如何拦截 sub_xxxx 这种函数
author: 鲤鱼
tag:
  - 逆向与安全
  - Frida
---


本文是 Frida 实战系列教程的第三篇，讲解如何拦截 sub_xxxx 这种函数，以及如何替换和调用原始函数。
在 IDA 里看到的 sub_xxxx 这种类型的函数是因为没有符号，所以 IDA 解析时就显示 sub_xxxx，其中 xxxx 是 IDA 读取到的函数地址。在第二篇教程中，我们初步学习了拦截器(Interceptor)的使用，知道了怎么拦截函数，但是如果是自定义函数，去掉符号信息可能就没有名称，我们该怎么拦截呢？下面我们来实际操作，自定义一个静态函数，名称是 add，功能就是将第一个参数和第二个参数相加，返回相加的结果，然后调用 add 函数时第一个参数和第二个参数都传入 1，执行之后会打印出 “1 + 1 = 2"，具体代码如下：
```jsx
static int add(int num1, int num2){
 
    int sum = num1 + num2;
    return sum;
}
 
int sum = add(1, 1);
NSLog(@"1 + 1 = %d", sum);
 
```
编译成功之后，执行下面的命令即可去掉符号。这时使用 IDA 查看可执行文件只会显示 sub_xxxx 这类名称，没有函数的真实名称。
```jsx
strip -x .../Products/Debug-iphoneos/CrackMe.app/CrackMe
```
接下来开始编写 frida 脚本，get_func_addr 是我们定义的一个函数用来获取函数地址的，需要传入两个参数，第一个参数是模块的名称，第二个参数是在 IDA 里看到的函数地址。查看这个地址的方法，我一般是在 IDA 里将基址设为 0，然后定位到目标函数，此时的地址就是函数地址。得到地址之后就可以使用 Interceptor.attach() 拦截函数。
```jsx
function get_func_addr(module, offset) {
 
   var base_addr = Module.findBaseAddress(module);
   console.log("base_addr: " + base_addr);
 
   console.log(hexdump(ptr(base_addr), {
            length: 16,
            header: true,
            ansi: true
        }))
 
   var func_addr = base_addr.add(offset);
   if (Process.arch == 'arm')
      return func_addr.add(1);  //如果是32位地址+1
   else
      return func_addr;
}
 
var func_addr = get_func_addr('CrackMe', 0x6684);
console.log('func_addr: ' + func_addr);
 
console.log(hexdump(ptr(func_addr), {
            length: 16,
            header: true,
            ansi: true
        }))
 
Interceptor.attach(ptr(func_addr), {
   onEnter: function(args) {
 
      console.log("onEnter");
      var num1 = args[0];
      var num2 = args[1];
 
      console.log("num1: " + num1);
      console.log("num2: " + num2);
 
   },
   onLeave: function(retval) {
 
      console.log("onLeave");
      retval.replace(3);  //返回值替换成3
   }
});
```
执行 frida 附加进程并加载 test.js 脚本
```jsx
frida -U -l test.js CrackMe
```
有时候目标函数是在进程启动后马上就触发，使用附加的方式可能来不及注入脚本，函数就已经触发了。这种情况可以先退出进程，使用 -f 参数直接启动进程，可以在启动时马上注入脚本。需要注意的是进程名称填写的是包名。
```jsx
frida -U -l test.js -f net.ioshacker.CrackMe
```
此时进入交互模式，然后输入 %resume，让进程继续运行，不然过一会进程会被强制退出，如果不想每次都输入 %resume，就添加 --no-pause 参数，这样在运行进程时不会暂停。
```jsx
frida -U -l test2.js -f net.ioshacker.CrackMe --no-pause
```
脚本执行后会打印出基址、基址内存中的数据、add 函数地址、add 函数内存中的数据，信息如下：
```jsx
base_addr: 0x100a14000
            0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
100a14000  cf fa ed fe 0c 00 00 01 00 00 00 00 02 00 00 00  ................
func_addr: 0x100a1a684
            0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0123456789ABCDEF
100a1a684  ff 43 00 d1 e0 0f 00 b9 e1 0b 00 b9 e0 0f 40 b9  .C............@.
 
```
为什么要将可执行文件的基址数据和 add 函数内存中数据打印出来呢？这是为了验证我们获取到的地址是否正确，比如基址内存中的数据是 cf fa ed fe，说明是 Mach-O 头部，确实是可执行文件。打印出 add 函数内存中的数据也是为了验证结果，查看函数内存中的数据与 IDA 里看到的十六进制机器码对比是否一致，如果不一致说明获取到的函数地址是错误的，如果一致代表正确。IDA 里看到的十六进制机器码数据如下图所示，图中的原本是显示的函数名是 sub_6684，为了演示方便，我没有去掉符号，所以显示是函数原始名称 add。
当 add 函数触发时，在调用 add 函数时会打印出 “1 + 1 = 3”，因为返回值被替换成 3。
Interceptor.attach() 拦截到相应的函数时不能阻止原始函数的执行，比如有些情况，我们不想执行原始函数，或者是判断参数达到某个条件时才执行原始函数，否则不执行，这种情况可以使用 Interceptor.replace() 来替换原始函数，比如下面这段代码可以替换掉 add 函数， NativeFunction 里有三个 int，分别代表是返回值、第一个参数、第二个参数。
```jsx
var addPtr = get_func_addr('CrackMe', 0x6684);
var add = new NativeFunction(addPtr, 'int', ['int', 'int']);
 
// 进行替换
Interceptor.replace(add, new NativeCallback(function(num1, num2) {
 
    if((num1 == 1) && (num2 == 1)){
        console.log("1+1");
    }
    // 调用原函数
    return add(num1, num2);
    //return add(2, 3); //将参数替换掉
}, 'int', ['int', 'int']));
 
```
有些情况我们需要拦截系统的函数，比如要拦截 open 函数，可以使用下面的代码。
```jsx
var openPtr = Module.getExportByName(null, 'open');
var open = new NativeFunction(openPtr, 'int', ['pointer', 'int']);
 
Interceptor.replace(openPtr, new NativeCallback(function (pathPtr, flags) {
  var path = pathPtr.readUtf8String();
  console.log('Opening "' + path + '"');
  var fd = open(pathPtr, flags);
  console.log('Got fd: ' + fd);
  return fd;
}, 'int', ['pointer', 'int']));
```
