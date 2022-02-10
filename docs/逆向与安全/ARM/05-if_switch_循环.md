---
id: if_switch_循环
slug: if_switch_循环.html
title: 05 | if_switch_循环
author: 鲤鱼
description: ARM汇编知识
tag:
  - 逆向与安全
  - ARM
  - 具体指令使用细节
---

涉及的指令说明：

- cmp：比较指令，类似于 sub。区别在于不存储返回值，只会更改 cpsr 中的状态标志。一般 cmp 判断后会进行跳转，后面通常紧跟 B 指令。
- BL label：跳转到 label 处执行
- B.LT  label：比较结果是小于 < (less than)，跳转到 label 处执行，否则不跳转
- B.LE  label：比较结果小于等于 <= (less than or equal to)，跳转到 label 处执行，否则不跳转
- B.GT  label：比较结果大于 > (greater than)，跳转到 label 处执行，否则不跳转
- B.GE  label：比较结果大于等于 >=  (greater than or equal to)，跳转到 label 处执行，否则不跳转
- B.EQ  label：比较结果等于 = ( equal to)，跳转到 label 处执行，否则不跳转
- B.HI  label：比较结果无符号大于 <= (less than or equal to)，跳转到 label 处执行，否则不跳转1.
## 1. if
代码如下：
```jsx
int main(int argc, char * argv[]) {
    int a = 1;
    if (a >= 1) {
        printf("111111111");
    } else {
        printf("呵呵哈哈哈");
    }
    return 0;
}
```
汇编如下：
```jsx
test`main:
    0x100ad621c <+0>:  sub    sp, sp, #0x30             ; =0x30 
    开辟 48 个字节的空间
    0x100ad6220 <+4>:  stp    x29, x30, [sp, #0x20]
    fp、lr 存储到 sp + 36 字节处
    0x100ad6224 <+8>:  add    x29, sp, #0x20            ; =0x20 
    fp 存储到 sp + 36
    0x100ad6228 <+12>: stur   wzr, [x29, #-0x4]
    wzr 存储到 x29 - 4 个字节处。其实就是 0 存入到 sp + 16 处
    0x100ad622c <+16>: stur   w0, [x29, #-0x8]
    把 w0 写入到 x29 - 8 处。
    0x100ad6230 <+20>: str    x1, [sp, #0x10]
    把 x1 写入打到 sp + 16 处
    0x100ad6234 <+24>: mov    w8, #0x1
    把 立即数 1 存入 w8
->  0x100ad6238 <+28>: str    w8, [sp, #0xc]
    把 w8 存入到 sp + 12 处
    0x100ad623c <+32>: ldr    w8, [sp, #0xc]
    从 sp + 12 处取出数据存入到 w8

    0x100ad6240 <+36>: subs   w8, w8, #0x1              ; =0x1 
    w8 = w8 - 1；w8 = 1- 1 = 0；不保存结果，更改 CPSR 的状态值
    0x100ad6244 <+40>: b.lt    0x100ad6258              ; <+60> at main.m

    // 如果上面结果小于，就跳转到 0x100ad6258，否则继续执行
    0x100ad6248 <+44>: adrp   x0, 1
    取出 1 所在的基地址页
    0x100ad624c <+48>: add    x0, x0, #0xf8f            ; =0xf8f 
    上面获取的基地址+0xf8f， 获取到新地址，这里其实是获取打印的数据。结合代码，这里打印”111111111“
    0x100ad6250 <+52>: bl     0x100ad6570               ; symbol stub for: printf
    打印
    0x100ad6254 <+56>: b      0x100ad6264               ; <+72> at main.m
    打印完跳转到 0x100ad6264

    
    0x100ad6258 <+60>: adrp   x0, 1
    取出 1 所在的基地址页
    0x100ad625c <+64>: add    x0, x0, #0xf99            ; =0xf99 
    上面获取的基地址+0xf99 获取到新地址，这里其实是获取打印的数据。结合代码，这里打印”呵呵哈哈哈“
    0x100ad6260 <+68>: bl     0x100ad6570               ; symbol stub for: printf
    打印
    0x100ad6264 <+72>: mov    w0, #0x0
    打印完执行，把 0 复制给 w0，作为当前函数的返回值
    0x100ad6268 <+76>: ldp    x29, x30, [sp, #0x20]
    还原 fp、lr
    0x100ad626c <+80>: add    sp, sp, #0x30             ; =0x30 
    释放开辟的空间
    0x100ad6270 <+84>: ret 
```
## 2. do..while
代码如下：
```jsx
int main(int argc, char * argv[]) {
    int nSum = 0;
    int i = 0;
    do {
        i++;
        nSum = nSum + i;
    } while (i < 100);
    //    cpsrFunc();
    return 0;
}
```
汇编如下：
```jsx
test`main:
    0x1041fe250 <+0>:  sub    sp, sp, #0x20             ; =0x20 
    0x1041fe254 <+4>:  str    wzr, [sp, #0x1c]
    0x1041fe258 <+8>:  str    w0, [sp, #0x18]
    0x1041fe25c <+12>: str    x1, [sp, #0x10]
->  0x1041fe260 <+16>: str    wzr, [sp, #0xc]
    0x1041fe264 <+20>: str    wzr, [sp, #0x8]
    0x1041fe268 <+24>: ldr    w8, [sp, #0x8]
    0x1041fe26c <+28>: add    w8, w8, #0x1              ; =0x1 
    0x1041fe270 <+32>: str    w8, [sp, #0x8]
    0x1041fe274 <+36>: ldr    w8, [sp, #0xc]
    0x1041fe278 <+40>: ldr    w9, [sp, #0x8]
    0x1041fe27c <+44>: add    w8, w8, w9
    0x1041fe280 <+48>: str    w8, [sp, #0xc]
    0x1041fe284 <+52>: ldr    w8, [sp, #0x8]
    0x1041fe288 <+56>: subs   w8, w8, #0x64             ; =0x64 
    0x1041fe28c <+60>: b.lt   0x1041fe268               ; <+24> at main.m:42:10
    0x1041fe290 <+64>: mov    w0, #0x0
    0x1041fe294 <+68>: add    sp, sp, #0x20             ; =0x20 
    0x1041fe298 <+72>: ret    
```
去掉开辟堆栈、fp/lr 存入还原等其他无关汇编，如下：
```jsx
    0x1041fe258 <+8>:  str    w0, [sp, #0x18]
    0x1041fe25c <+12>: str    x1, [sp, #0x10]
->  0x1041fe260 <+16>: str    wzr, [sp, #0xc]                    把 0 寄存器存入到 sp + 12
    0x1041fe264 <+20>: str    wzr, [sp, #0x8]                    把 0 寄存器存入到 sp + 8
    0x1041fe268 <+24>: ldr    w8, [sp, #0x8]                     从 sp + 8 处取数据存入 w8；w8 = 0
    0x1041fe26c <+28>: add    w8, w8, #0x1              ; =0x1   w8 = w8 + 1; w8 = 0 + 1; w8 = 1
    0x1041fe270 <+32>: str    w8, [sp, #0x8]                     把 w8 存入到 sp + 8。把 1 存入到 sp + 8
    0x1041fe274 <+36>: ldr    w8, [sp, #0xc]                     从 sp + 12 处取数据存入 w8；w8 = 0
    0x1041fe278 <+40>: ldr    w9, [sp, #0x8]                     从 sp + 8 处取数据存入 w9；w9 = 1
    0x1041fe27c <+44>: add    w8, w8, w9                         w8 = w9 + w8 = 1+0 = 1 
    0x1041fe280 <+48>: str    w8, [sp, #0xc]                     把 w8 存入到 sp + 12。把 1 存入到 sp + 12
    0x1041fe284 <+52>: ldr    w8, [sp, #0x8]                     从 sp + 8 处取数据存入 w8；w8 = 1
    0x1041fe288 <+56>: subs   w8, w8, #0x64             ; =0x64  比较 w8 - 100；结果根据 cpsr 来看
    0x1041fe28c <+60>: b.lt   0x1041fe268               ; <+24> at main.m:42:10 如果结果 w8 < 100 就跳转到 0x1041fe268
```
## 3. while
代码如下：
```jsx
int main(int argc, char * argv[]) {
    int nSum = 0;
    int i = 0;
    while (i < 100){
        i++;
        nSum = nSum + i;
    }
    return 0;
}

```
汇编如下：
```jsx
->  0x10424a25c <+16>: str    wzr, [sp, #0xc]
    0x10424a260 <+20>: str    wzr, [sp, #0x8]
    0x10424a264 <+24>: ldr    w8, [sp, #0x8]
    0x10424a268 <+28>: subs   w8, w8, #0x64             ; =0x64 
    0x10424a26c <+32>: b.ge   0x10424a290               ; <+68> at main.m
    0x10424a270 <+36>: ldr    w8, [sp, #0x8]
    0x10424a274 <+40>: add    w8, w8, #0x1              ; =0x1 
    0x10424a278 <+44>: str    w8, [sp, #0x8]
    0x10424a27c <+48>: ldr    w8, [sp, #0xc]
    0x10424a280 <+52>: ldr    w9, [sp, #0x8]
    0x10424a284 <+56>: add    w8, w8, w9
    0x10424a288 <+60>: str    w8, [sp, #0xc]
    0x10424a28c <+64>: b      0x10424a264               ; <+24> at main.m:41:12
```
汇编与 do...while 差不多
## 4. for
代码如下：
```jsx
int main(int argc, char * argv[]) {
    for (int i = 0; i < 100; i++) {
        printf("hello");
    }
    return 0;
}
```
汇编如下
```jsx
test`main:
    0x1022b2234 <+0>:  sub    sp, sp, #0x30             ; =0x30 
    0x1022b2238 <+4>:  stp    x29, x30, [sp, #0x20]
    0x1022b223c <+8>:  add    x29, sp, #0x20            ; =0x20 
    0x1022b2240 <+12>: stur   wzr, [x29, #-0x4]
    0x1022b2244 <+16>: stur   w0, [x29, #-0x8]
    0x1022b2248 <+20>: str    x1, [sp, #0x10]
    
    =========================================================================
->  0x1022b224c <+24>: str    wzr, [sp, #0xc]
    0x1022b2250 <+28>: ldr    w8, [sp, #0xc]
    0x1022b2254 <+32>: subs   w8, w8, #0x64             ; =0x64 
    0x1022b2258 <+36>: b.ge   0x1022b2278               ; <+68> at main.m
    0x1022b225c <+40>: adrp   x0, 1
    0x1022b2260 <+44>: add    x0, x0, #0xfa3            ; =0xfa3 
    0x1022b2264 <+48>: bl     0x1022b2584               ; symbol stub for: printf
    0x1022b2268 <+52>: ldr    w8, [sp, #0xc]
    0x1022b226c <+56>: add    w8, w8, #0x1              ; =0x1 
    0x1022b2270 <+60>: str    w8, [sp, #0xc]
    0x1022b2274 <+64>: b      0x1022b2250               ; <+28> at main.m:36:21
    =========================================================================

    0x1022b2278 <+68>: mov    w0, #0x0
    0x1022b227c <+72>: ldp    x29, x30, [sp, #0x20]
    0x1022b2280 <+76>: add    sp, sp, #0x30             ; =0x30 
    0x1022b2284 <+80>: ret    
```
汇编与 do...while 差不多
## 5. switch
### 5.1 switch 分支少于 4 的情况
代码如下：
```jsx
void func(int a) {
	switch (a) {
        case 1:
            printf("1");
            break;
        case 2:
            printf("2");
            break;
        case 3:
            printf("3");
            break;
        default:
            printf("4");
            break;
    }
}
int main(int argc, char * argv[]) {
    func(1);
    return 0;
}
```
汇编如下：
```jsx
test`func:
    0x100a0a1cc <+0>:   sub    sp, sp, #0x20             ; =0x20 
    0x100a0a1d0 <+4>:   stp    x29, x30, [sp, #0x10]
    0x100a0a1d4 <+8>:   add    x29, sp, #0x10            ; =0x10 

    =====================================================
    0x100a0a1d8 <+12>:  stur   w0, [x29, #-0x4] 把 w0 存入到 sp + 12 处。其实是把参数 a 存入。
->  0x100a0a1dc <+16>:  ldur   w8, [x29, #-0x4] 把参数 a 取出来存到 w8
    0x100a0a1e0 <+20>:  str    w8, [sp, #0x8]   把参数 a 存入到  sp + 8
    0x100a0a1e4 <+24>:  subs   w8, w8, #0x1              ; =0x1   比较参数 a 和 1 的大小
    0x100a0a1e8 <+28>:  b.eq   0x100a0a208               ; <+60> at main.m 如果 a == 1 跳转到 0x100a0a208

    0x100a0a1ec <+32>:  ldr    w8, [sp, #0x8]  把参数 a 取出来存到 w8
    0x100a0a1f0 <+36>:  subs   w8, w8, #0x2              ; =0x2    比较参数 a 和 2 的大小 
    0x100a0a1f4 <+40>:  b.eq   0x100a0a218               ; <+76> at main.m 如果 a == 2 跳转到 0x100a0a218

    0x100a0a1f8 <+44>:  ldr    w8, [sp, #0x8]  把参数 a 取出来存到 w8
    0x100a0a1fc <+48>:  subs   w8, w8, #0x3              ; =0x3    比较参数 a 和 3 的大小 
    0x100a0a200 <+52>:  b.eq   0x100a0a228               ; <+92> at main.m  如果 a == 3 跳转到 0x100a0a228
    0x100a0a204 <+56>:  b      0x100a0a238               ; <+108> at main.m 如果都不等于跳转到  0x100a0a238

    0x100a0a208 <+60>:  adrp   x0, 1
    0x100a0a20c <+64>:  add    x0, x0, #0xfa3            ; =0xfa3   
    0x100a0a210 <+68>:  bl     0x100a0a584               ; symbol stub for: printf  打印 1 跳转到 0x100a0a244
    0x100a0a214 <+72>:  b      0x100a0a244               ; <+120> at main.m:51:1 
    
    0x100a0a218 <+76>:  adrp   x0, 1
    0x100a0a21c <+80>:  add    x0, x0, #0xfa5            ; =0xfa5 
    0x100a0a220 <+84>:  bl     0x100a0a584               ; symbol stub for: printf  打印 2 跳转到 0x100a0a244
    0x100a0a224 <+88>:  b      0x100a0a244               ; <+120> at main.m:51:1
   
    0x100a0a228 <+92>:  adrp   x0, 1
    0x100a0a22c <+96>:  add    x0, x0, #0xfa5            ; =0xfa5 
    0x100a0a230 <+100>: bl     0x100a0a584               ; symbol stub for: printf 打印 3 跳转到 0x100a0a244
    0x100a0a234 <+104>: b      0x100a0a244               ; <+120> at main.m:51:1
    
    0x100a0a238 <+108>: adrp   x0, 1
    0x100a0a23c <+112>: add    x0, x0, #0xfa7            ; =0xfa7 
    0x100a0a240 <+116>: bl     0x100a0a584               ; symbol stub for: printf  打印 4 跳转到 0x100a0a244
    =====================================================

    0x100a0a244 <+120>: ldp    x29, x30, [sp, #0x10]
    0x100a0a248 <+124>: add    sp, sp, #0x20             ; =0x20 
    0x100a0a24c <+128>: ret    
```
### 5.2 switch 分支大于 4 的情况
代码如下：
```jsx
void func(int a) {
	switch (a) {
        case 1:
            printf("1");
            break;
        case 2:
            printf("2");
            break;
        case 3:
            printf("3");
            break;
		case 4:
            printf("4");
            break;   
        default:
            printf("5");
            break;
    }
}
int main(int argc, char * argv[]) {
    func(1);
    return 0;
}
```
汇编如下：
```jsx
test`func:
    0x1008e2198 <+0>:   sub    sp, sp, #0x20             ; =0x20 
    0x1008e219c <+4>:   stp    x29, x30, [sp, #0x10]
    0x1008e21a0 <+8>:   add    x29, sp, #0x10            ; =0x10 


    0x1008e21a4 <+12>:  stur   w0, [x29, #-0x4]  参数 a 入栈
->  0x1008e21a8 <+16>:  ldur   w8, [x29, #-0x4]  取出参数 a 到 w8
    0x1008e21ac <+20>:  subs   w8, w8, #0x1              ; =0x1  w8 = a - 1;，影响 cprs
    0x1008e21b0 <+24>:  str    x8, [sp]                  把 w8 的结果存入到 sp
    0x1008e21b4 <+28>:  subs   x8, x8, #0x3              ; =0x3  x8 = a - 1 - 3，这里其实是先判断 a - 4 的结果，先处理 default 分支
    0x1008e21b8 <+32>:  b.hi   0x1008e2218               ; <+128> at main.m 如果结果大于 0(无符号)，跳转到 0x1008e2218
    0x1008e21bc <+36>:  ldr    x11, [sp]                 从 sp 处取出存入的 w8，月就是 a - 1，存入到 x11       
    0x1008e21c0 <+40>:  adrp   x10, 0                    
    0x1008e21c4 <+44>:  add    x10, x10, #0x230          ; =0x230   从 0 所在的基地址表获取数据，存到 x 10 
    0x1008e21c8 <+48>:  adr    x8, #0x0                  ; <+48> at main.m:36:5  x8 = 0
    0x1008e21cc <+52>:  ldrsw  x9, [x10, x11, lsl #2]    将存储器地址为 x10 + x11 * 2 的字符数据读取存入到 x9 中。并将新地址 x10 + x11 * 2  写入 x9
                            
    0x1008e21d0 <+56>:  add    x8, x8, x9                通过x8 的基地址和 x9 的地址相加，获取新地址赋值到 x8，
    0x1008e21d4 <+60>:  br     x8                        跳转到 x8 地址对应的执行，这里相当于与 switch jump
    0x1008e21d8 <+64>:  adrp   x0, 1
    0x1008e21dc <+68>:  add    x0, x0, #0xf93            ; =0xf93 
    0x1008e21e0 <+72>:  bl     0x1008e2574               ; symbol stub for: printf
    0x1008e21e4 <+76>:  b      0x1008e2224               ; <+140> at main.m:53:1
    0x1008e21e8 <+80>:  adrp   x0, 1
    0x1008e21ec <+84>:  add    x0, x0, #0xf95            ; =0xf95 
    0x1008e21f0 <+88>:  bl     0x1008e2574               ; symbol stub for: printf
    0x1008e21f4 <+92>:  b      0x1008e2224               ; <+140> at main.m:53:1
    0x1008e21f8 <+96>:  adrp   x0, 1
    0x1008e21fc <+100>: add    x0, x0, #0xf97            ; =0xf97 
    0x1008e2200 <+104>: bl     0x1008e2574               ; symbol stub for: printf
    0x1008e2204 <+108>: b      0x1008e2224               ; <+140> at main.m:53:1
    0x1008e2208 <+112>: adrp   x0, 1
    0x1008e220c <+116>: add    x0, x0, #0xf99            ; =0xf99 
    0x1008e2210 <+120>: bl     0x1008e2574               ; symbol stub for: printf
    0x1008e2214 <+124>: b      0x1008e2224               ; <+140> at main.m:53:1
    0x1008e2218 <+128>: adrp   x0, 1
    0x1008e221c <+132>: add    x0, x0, #0xf9b            ; =0xf9b                  default 分支，打印 5 然后跳转到 0x1008e2224
    0x1008e2220 <+136>: bl     0x1008e2574               ; symbol stub for: printf


    0x1008e2224 <+140>: ldp    x29, x30, [sp, #0x10]
    0x1008e2228 <+144>: add    sp, sp, #0x20             ; =0x20 
    0x1008e222c <+148>: ret    
```
在 switch 分支比较多的情况下，在编译的时候会生成一个跳转表。跳转表每个地址 4 个字节，总结如下：

- 先判断是否是 default 分支。  b.hi   0x1008e2218
- 获取 x8 的地址：
```jsx
0x1008e21c0 <+40>:  adrp   x10, 0                    
0x1008e21c4 <+44>:  add    x10, x10, #0x230          ; =0x230   从 0 所在的基地址表获取数据，存到 x 10 
0x1008e21c8 <+48>:  adr    x8, #0x0                  ; <+48> at main.m:36:5  x8 = 0
0x1008e21cc <+52>:  ldrsw  x9, [x10, x11, lsl #2]    将存储器地址为 x10 + x11 * 2 的字符数据读取存入到 x9 中。并将新地址 x10 + x11 * 2  写入 x9

0x1008e21d0 <+56>:  add    x8, x8, x9                通过x8 的基地址和 x9 的地址相加，获取新地址赋值到 x8，
0x1008e21d4 <+60>:  br     x8                        跳转到 x8 地址对应的执行，这里相当于与 switch jump
```

   - 通过这一系列的运行最后得到即将要跳转地址值X8，这种方式的计算效率非常高，只需要一次算法，就能找到 X8 的地址。
> **ADRP + ADD表示取值，常用于取常量和全局变量的值，但是这里取的是地址值。**





