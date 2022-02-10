---
id: AVPlayer截取视频流的当前帧
slug: AVPlayer截取视频流的当前帧.html
title: AVPlayer截取视频流的当前帧
author: 鲤鱼
tag:
  - AVPlayer
---

不限于本地视频还是网络视频.
### 声明所需属性
```jsx
@interface ViewController ()
{
    AVPlayer *_player;
    AVPlayerItemVideoOutput *_videoOutPut;
    AVAVPlayerLayer *_playerLayer;
}
@end
```
### 实例化
```jsx
//初始化输出流
_videoOutPut = [[AVPlayerItemVideoOutput alloc] init];
//初始化播放地址
AVPlayerItem *item = [AVPlayerItem playerItemWithURL:[NSURL URLWithString:@"视频地址"]];
//添加输出流
[item addOutput:_videoOutPut];
//初始化播放器
_player = [[AVPlayer alloc] initWithPlayerItem:item];
//展示播放器到视图上。。。。
_playerLayer = [AVPlayerLayer playerLayerWithPlayer:_player];
[xxxView.layer addSublayer:_playerLayer];

//0.1秒监听一次播放进度
id timeOb = [_player addPeriodicTimeObserverForInterval:CMTimeMake(1, 10) queue:dispatch_get_main_queue() usingBlock:^(CMTime time) {
	[self saveImgWithTime:time];
}];
```
### 获取关键帧
```jsx
- (void)saveImgWithTime:(CMTime)time {
    CVPixelBufferRef pixelBuffer = [_output copyPixelBufferForItemTime:time itemTimeForDisplay:nil];
    CIImage *ciImage = [CIImage imageWithCVPixelBuffer:pixelBuffer];
    CIContext *temporaryContext = [CIContext contextWithOptions:nil];
    CGImageRef videoImage = [temporaryContext
                             createCGImage:ciImage
                             fromRect:CGRectMake(0, 0,
                                                 CVPixelBufferGetWidth(pixelBuffer),
                                                 CVPixelBufferGetHeight(pixelBuffer))];
    //当前帧的画面
    UIImage *currentImage = [UIImage imageWithCGImage:videoImage];
    if (currentImage) {
        static int idx = 0;
        NSData *data = UIImagePNGRepresentation(currentImage);
        NSString *path = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
        NSString *newPath = [path stringByAppendingPathComponent:@"mp4"];
        NSString *imgName = [NSString stringWithFormat:@"%d.png",idx];
        NSString *image_path = [newPath stringByAppendingPathComponent:imgName];
        [KHFileTool creatDirectoryWithPath:newPath];
        BOOL ret = [data writeToFile:image_path atomically:YES];
        if (ret) {
            idx++;
            printf("\n22222222222\n");
        }

    }
}
```
### 其他的一些相关内容：
#### CVPixelBufferRef UIImage 转换
```jsx
- (CVPixelBufferRef) pixelBufferFromCGImage: (CGImageRef) image
{
    NSDictionary *options = @{
                              (NSString*)kCVPixelBufferCGImageCompatibilityKey : @YES,
                              (NSString*)kCVPixelBufferCGBitmapContextCompatibilityKey : @YES,
                              (NSString*)kCVPixelBufferIOSurfacePropertiesKey: [NSDictionary dictionary]
                              };
    CVPixelBufferRef pxbuffer = NULL;
    
    CGFloat frameWidth = CGImageGetWidth(image);
    CGFloat frameHeight = CGImageGetHeight(image);
    
    CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault,
                                          frameWidth,
                                          frameHeight,
                                          kCVPixelFormatType_32BGRA,
                                          (__bridge CFDictionaryRef) options,
                                          &pxbuffer);
    
    NSParameterAssert(status == kCVReturnSuccess && pxbuffer != NULL);
    
    CVPixelBufferLockBaseAddress(pxbuffer, 0);
    void *pxdata = CVPixelBufferGetBaseAddress(pxbuffer);
    NSParameterAssert(pxdata != NULL);
    
    CGColorSpaceRef rgbColorSpace = CGColorSpaceCreateDeviceRGB();
    
    CGContextRef context = CGBitmapContextCreate(pxdata,
                                                 frameWidth,
                                                 frameHeight,
                                                 8,
                                                 CVPixelBufferGetBytesPerRow(pxbuffer),
                                                 rgbColorSpace,
                                                 (CGBitmapInfo)kCGImageAlphaNoneSkipFirst);
    NSParameterAssert(context);
    CGContextConcatCTM(context, CGAffineTransformIdentity);
    CGContextDrawImage(context, CGRectMake(0,
                                           0,
                                           frameWidth,
                                           frameHeight),
                       image);
    CGColorSpaceRelease(rgbColorSpace);
    CGContextRelease(context);
    
    CVPixelBufferUnlockBaseAddress(pxbuffer, 0);
    
    return pxbuffer;
}




//other

- (UIImage *)convert:(CVPixelBufferRef)pixelBuffer {
    CIImage *ciImage = [CIImage imageWithCVPixelBuffer:pixelBuffer];

    CIContext *temporaryContext = [CIContext contextWithOptions:nil];
    CGImageRef videoImage = [temporaryContext
        createCGImage:ciImage
             fromRect:CGRectMake(0, 0, CVPixelBufferGetWidth(pixelBuffer), CVPixelBufferGetHeight(pixelBuffer))];

    UIImage *uiImage = [UIImage imageWithCGImage:videoImage];
    CGImageRelease(videoImage);

    return uiImage;
}

```
#### CVPixelBufferRef UIImage 转换2
```jsx
//
//  ViewController.m
//  test_image_covert_data_01
//
//  Created by jeffasd on 2016/9/30.
//  Copyright © 2016年 jeffasd. All rights reserved.
//
 
#import "ViewController.h"
 
#define RETAINED_BUFFER_COUNT 4
 
@interface ViewController ()
 
@property (nonatomic, assign) CVPixelBufferPoolRef pixelBufferPool;
 
@end
 
@implementation ViewController
 
#pragma CVPixelBufferRef与UIImage的互相转换
 
- (void)viewDidLoad {
    [super viewDidLoad];
    
    self.pixelBufferPool = NULL;
    
    UIImage *image = [UIImage imageNamed:@"atlastest"];
    CVPixelBufferRef pixelBuffer = [self CVPixelBufferRefFromUiImage:image];
    //CVPixelBufferRef pixelBuffer = [self pixelBufferFasterFromImage:image];
    //CVPixelBufferRef pixelBuffer = [[self class] pixelBufferFromCGImage:image.CGImage];
    //UIImage *covertImage = [[self class] imageFromCVPixelBufferRef0:pixelBuffer];
    //UIImage *covertImage = [[self class] imageFromCVPixelBufferRef1:pixelBuffer];
    //UIImage *covertImage = [[self class] imageFromCVPixelBufferRef2:pixelBuffer];
//    covertImage = nil;
//    
    UIImage *decodeImage = [[self class] decodeImageWithImage:image];
    decodeImage = nil;
    
    CVPixelBufferRef pixelBuffer1 = [self pixelBufferFromImageWithPool:NULL image:image];
    pixelBuffer1 = nil;
    
    //covertImage = nil;
}
 
static OSType inputPixelFormat(){
    //注意CVPixelBufferCreate函数不支持 kCVPixelFormatType_32RGBA 等格式 不知道为什么。
    //支持kCVPixelFormatType_32ARGB和kCVPixelFormatType_32BGRA等 iPhone为小端对齐因此kCVPixelFormatType_32ARGB和kCVPixelFormatType_32BGRA都需要和kCGBitmapByteOrder32Little配合使用
    //注意当inputPixelFormat为kCVPixelFormatType_32BGRA时bitmapInfo不能是kCGImageAlphaNone，kCGImageAlphaLast，kCGImageAlphaFirst，kCGImageAlphaOnly。
    //注意iPhone的大小端对齐方式为小段对齐 可以使用宏 kCGBitmapByteOrder32Host 来解决大小端对齐 大小端对齐必须设置为kCGBitmapByteOrder32Little。
    //return kCVPixelFormatType_32RGBA;//iPhone不支持此输入格式!!!
    return kCVPixelFormatType_32BGRA;
    //return kCVPixelFormatType_32ARGB;
}
 
static uint32_t bitmapInfoWithPixelFormatType(OSType inputPixelFormat){
    /*
     CGBitmapInfo的设置
     uint32_t bitmapInfo = CGImageAlphaInfo | CGBitmapInfo;
     
     当inputPixelFormat=kCVPixelFormatType_32BGRA CGBitmapInfo的正确的设置 只有如下两种正确设置
     uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Host;
     uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Host;
     
     typedef CF_ENUM(uint32_t, CGImageAlphaInfo) {
     kCGImageAlphaNone,                For example, RGB.
     kCGImageAlphaPremultipliedLast,   For example, premultiplied RGBA
     kCGImageAlphaPremultipliedFirst,  For example, premultiplied ARGB
     kCGImageAlphaLast,                For example, non-premultiplied RGBA
     kCGImageAlphaFirst,               For example, non-premultiplied ARGB
     kCGImageAlphaNoneSkipLast,        For example, RBGX.
     kCGImageAlphaNoneSkipFirst,       For example, XRGB.
     kCGImageAlphaOnly                 No color data, alpha data only
     };
     
     当inputPixelFormat=kCVPixelFormatType_32ARGB CGBitmapInfo的正确的设置 只有如下两种正确设置
     uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Big;
     uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Big;
     */
    if (inputPixelFormat == kCVPixelFormatType_32BGRA) {
        //uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Host;
        //此格式也可以
        uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Host;
        return bitmapInfo;
    }else if (inputPixelFormat == kCVPixelFormatType_32ARGB){
        uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Big;
        //此格式也可以
        //uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Big;
        return bitmapInfo;
    }else{
        NSLog(@"不支持此格式");
        return 0;
    }
}
 
static CVPixelBufferPoolRef createPixelBufferPoolInner( int32_t width, int32_t height, OSType pixelFormat, int32_t maxBufferCount )
{
    CVPixelBufferPoolRef outputPool = NULL;
    
    NSDictionary *sourcePixelBufferOptions = @{ (id)kCVPixelBufferPixelFormatTypeKey : @(pixelFormat),
                                                (id)kCVPixelBufferWidthKey : @(width),
                                                (id)kCVPixelBufferHeightKey : @(height),
                                                //(id)kCVPixelFormatOpenGLESCompatibility : @(YES),
                                                (id)kCVPixelBufferIOSurfacePropertiesKey : @{ /*empty dictionary*/ } };
    
    NSDictionary *pixelBufferPoolOptions = @{ (id)kCVPixelBufferPoolMinimumBufferCountKey : @(maxBufferCount) };
    
    CVPixelBufferPoolCreate( kCFAllocatorDefault, (__bridge CFDictionaryRef)pixelBufferPoolOptions, (__bridge CFDictionaryRef)sourcePixelBufferOptions, &outputPool );
    
    return outputPool;
}
 
static CVPixelBufferPoolRef createCVPixelBufferPoolRef(int32_t imageWidth, int32_t imageHeight){
    OSType pixelFormat = inputPixelFormat();
    int32_t maxRetainedBufferCount = RETAINED_BUFFER_COUNT;
    CVPixelBufferPoolRef bufferPool = createPixelBufferPoolInner( imageWidth, imageHeight, pixelFormat, maxRetainedBufferCount );
    if ( ! bufferPool ) {
        NSLog( @"Problem initializing a buffer pool." );
    }
    NSLog( @"success initializing a buffer pool." );
    return bufferPool;
}
 
- (CVPixelBufferRef)pixelBufferFromImageWithPool:(CVPixelBufferPoolRef)pixelBufferPool image:(UIImage *)image
{
    CVPixelBufferRef pxbuffer = NULL;
    
    NSDictionary *options = [NSDictionary dictionaryWithObjectsAndKeys:
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGImageCompatibilityKey,
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGBitmapContextCompatibilityKey,
                             nil];
    
    size_t width =  CGImageGetWidth(image.CGImage);
    size_t height = CGImageGetHeight(image.CGImage);
    size_t bytesPerRow = CGImageGetBytesPerRow(image.CGImage);
#if 0
    CGBitmapInfo bitmapInfo = CGImageGetBitmapInfo(image.CGImage);
#endif
    void *pxdata = NULL;
    
    if (pixelBufferPool == NULL){
        NSLog(@"pixelBufferPool is null!");
        CVPixelBufferPoolRef bufferPool = createCVPixelBufferPoolRef((int32_t)width, (int32_t)height);
        self.pixelBufferPool = bufferPool;
        pixelBufferPool = bufferPool;
    }
    
    CVReturn status = CVPixelBufferPoolCreatePixelBuffer (NULL, pixelBufferPool, &pxbuffer);
    if (pxbuffer == NULL) {
        status = CVPixelBufferCreate(kCFAllocatorDefault, width,
                                     height, inputPixelFormat(), (__bridge CFDictionaryRef) options,
                                     &pxbuffer);
    }
    
    NSParameterAssert(status == kCVReturnSuccess && pxbuffer != NULL);
    CVPixelBufferLockBaseAddress(pxbuffer, 0);
    pxdata = CVPixelBufferGetBaseAddress(pxbuffer);
    NSParameterAssert(pxdata != NULL);
    
#if 1 - 此去掉alpha通道效率更高
    CGColorSpaceRef rgbColorSpace = CGColorSpaceCreateDeviceRGB();
    
    CGBitmapInfo bitmapInfo = kCGBitmapByteOrder32Host;
    
    //对于生成CVPixelBufferRef无法使用此方法但是对于解码图片可以使用此方法
//    CGImageAlphaInfo alphaInfo = CGImageGetAlphaInfo(image.CGImage);
//    if (alphaInfo == kCGImageAlphaNone || alphaInfo == kCGImageAlphaOnly) {
//        alphaInfo = kCGImageAlphaNoneSkipFirst;
//    } else if (alphaInfo == kCGImageAlphaFirst) {
//        alphaInfo = kCGImageAlphaPremultipliedFirst;
//    } else if (alphaInfo == kCGImageAlphaLast) {
//        alphaInfo = kCGImageAlphaPremultipliedLast;
//    }
//    bitmapInfo |= alphaInfo;
    
    bitmapInfo = bitmapInfoWithPixelFormatType(inputPixelFormat());
    
    size_t bitsPerComponent = CGImageGetBitsPerComponent(image.CGImage);
    
    CGContextRef context = CGBitmapContextCreate(pxdata, width,
                                                 height,bitsPerComponent,bytesPerRow, rgbColorSpace,
                                                 bitmapInfo);
    NSParameterAssert(context);
    CGContextConcatCTM(context, CGAffineTransformMakeRotation(0));
    CGContextDrawImage(context, CGRectMake(0, 0, width,height), image.CGImage);
    CGColorSpaceRelease(rgbColorSpace);
    CGContextRelease(context);
#else //- 此方法获取的图片可能无法还原真实的图片
    CFDataRef  dataFromImageDataProvider = CGDataProviderCopyData(CGImageGetDataProvider(image.CGImage));
    GLubyte  *imageData = (GLubyte *)CFDataGetBytePtr(dataFromImageDataProvider);
    #if 0
    CFIndex length = CFDataGetLength(dataFromImageDataProvider);
    memcpy(pxdata,imageData,length);
    #else
    CVPixelBufferCreateWithBytes(kCFAllocatorDefault,width,height,inputPixelFormat(),imageData,bytesPerRow,NULL,NULL,(__bridge CFDictionaryRef)options,&pxbuffer);
    #endif
    CFRelease(dataFromImageDataProvider);
#endif
    
    return pxbuffer;
}
 
/** UIImage covert to CVPixelBufferRef */
//方法1 此方法能还原真实的图片
- (CVPixelBufferRef)CVPixelBufferRefFromUiImage:(UIImage *)img {
    CGSize size = img.size;
    CGImageRef image = [img CGImage];
    
    NSDictionary *options = [NSDictionary dictionaryWithObjectsAndKeys:
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGImageCompatibilityKey,
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGBitmapContextCompatibilityKey, nil];
    CVPixelBufferRef pxbuffer = NULL;
    CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault, size.width, size.height, inputPixelFormat(), (__bridge CFDictionaryRef) options, &pxbuffer);
    
    NSParameterAssert(status == kCVReturnSuccess && pxbuffer != NULL);
    
    CVPixelBufferLockBaseAddress(pxbuffer, 0);
    void *pxdata = CVPixelBufferGetBaseAddress(pxbuffer);
    NSParameterAssert(pxdata != NULL);
    
    CGColorSpaceRef rgbColorSpace = CGColorSpaceCreateDeviceRGB();
    
    //CGBitmapInfo的设置
    //uint32_t bitmapInfo = CGImageAlphaInfo | CGBitmapInfo;
    
    //当inputPixelFormat=kCVPixelFormatType_32BGRA CGBitmapInfo的正确的设置
    //uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Host;
    //uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Host;
    
    //当inputPixelFormat=kCVPixelFormatType_32ARGB CGBitmapInfo的正确的设置
    //uint32_t bitmapInfo = kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Big;
    //uint32_t bitmapInfo = kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Big;
    
    uint32_t bitmapInfo = bitmapInfoWithPixelFormatType(inputPixelFormat());
    
    CGContextRef context = CGBitmapContextCreate(pxdata, size.width, size.height, 8, 4*size.width, rgbColorSpace, bitmapInfo);
    NSParameterAssert(context);
    
    CGContextDrawImage(context, CGRectMake(0, 0, CGImageGetWidth(image), CGImageGetHeight(image)), image);
    CVPixelBufferUnlockBaseAddress(pxbuffer, 0);
    
    CGColorSpaceRelease(rgbColorSpace);
    CGContextRelease(context);
    
    return pxbuffer;
}
 
/** UIImage covert to CVPixelBufferRef */
//方法2 注意此方法在处理某些图片时可能无法还原真实的图片
- (CVPixelBufferRef)pixelBufferFasterFromImage:(UIImage *)image{
    
    CVPixelBufferRef pxbuffer = NULL;
    NSDictionary *options = [NSDictionary dictionaryWithObjectsAndKeys:
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGImageCompatibilityKey,
                             [NSNumber numberWithBool:YES], kCVPixelBufferCGBitmapContextCompatibilityKey,
                             nil];
    
    size_t width =  CGImageGetWidth(image.CGImage);
    size_t height = CGImageGetHeight(image.CGImage);
    size_t bytesPerRow = CGImageGetBytesPerRow(image.CGImage);
    
    CFDataRef  dataFromImageDataProvider = CGDataProviderCopyData(CGImageGetDataProvider(image.CGImage));
    GLubyte  *imageData = (GLubyte *)CFDataGetBytePtr(dataFromImageDataProvider);
    
    //kCGImageAlphaNoneSkipLast,       /* For example, RBGX. */
    
    CGColorSpaceRef colorspace = CGImageGetColorSpace(image.CGImage);
    CGImageAlphaInfo alphainfo = CGImageGetAlphaInfo(image.CGImage);
    CGBitmapInfo bitmapInfo = CGImageGetBitmapInfo(image.CGImage);
    const CGFloat *decode = CGImageGetDecode(image.CGImage);
    NSString *str = CGImageGetUTType(image.CGImage);
    
//    kCVPixelFormatType_32ARGB         = 0x00000020, /* 32 bit ARGB */
//    kCVPixelFormatType_32BGRA         = 'BGRA',     /* 32 bit BGRA */
//    kCVPixelFormatType_32ABGR         = 'ABGR',     /* 32 bit ABGR */不能使用
//    kCVPixelFormatType_32RGBA         = 'RGBA',     /* 32 bit RGBA */不能使用
    
    //CVPixelBufferCreateWithBytes这里是很耗时的，要重新创建。
    //此方法获取的CVPixelBufferRef不一定正确 如原始图片的CGImageAlphaInfo为kCGImageAlphaNoneSkipLast由于pixelFormatType没有RBGX类型的格式就没法还原原始的图片。
    CVPixelBufferCreateWithBytes(kCFAllocatorDefault,width,height,kCVPixelFormatType_32BGRA,imageData,bytesPerRow,NULL,NULL,(__bridge CFDictionaryRef)options,&pxbuffer);
    CFRelease(dataFromImageDataProvider);
    CVPixelBufferRetain(pxbuffer);
    
    return pxbuffer;
}
 
+ (CVPixelBufferRef) pixelBufferFromCGImage: (CGImageRef) image
{
    CGSize frameSize = CGSizeMake(CGImageGetWidth(image), CGImageGetHeight(image));
    NSDictionary *options = [NSDictionary dictionaryWithObjectsAndKeys:
                             [NSNumber numberWithBool:NO], kCVPixelBufferCGImageCompatibilityKey,
                             [NSNumber numberWithBool:NO], kCVPixelBufferCGBitmapContextCompatibilityKey,
                             nil];
    CVPixelBufferRef pxbuffer = NULL;
    CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault, frameSize.width,
                                          frameSize.height,  kCVPixelFormatType_32BGRA, (__bridge CFDictionaryRef) options,
                                          &pxbuffer);
    NSParameterAssert(status == kCVReturnSuccess && pxbuffer != NULL);
    CVPixelBufferLockBaseAddress(pxbuffer, 0);
    void *pxdata = CVPixelBufferGetBaseAddress(pxbuffer);
    CGColorSpaceRef rgbColorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(pxdata, frameSize.width,
                                                 frameSize.height, 8, 4*frameSize.width, rgbColorSpace,
                                                 kCGBitmapByteOrder32Little | kCGImageAlphaNoneSkipFirst);
    CGContextDrawImage(context, CGRectMake(0, 0, CGImageGetWidth(image),
                                           CGImageGetHeight(image)), image);//这个站CPU 相当高
    CGColorSpaceRelease(rgbColorSpace);
    CGContextRelease(context);
    CVPixelBufferUnlockBaseAddress(pxbuffer, 0);
    return pxbuffer;
}
 
//CVPixelBufferRef 是 CMSampleBufferRef 解码后的数据
 
/** UIImage covert to CMSampleBufferRef */
 
/** CVPixelBufferRef covert to UIImage */
+ (UIImage *)imageFromCVPixelBufferRef0:(CVPixelBufferRef)pixelBuffer{
    // MUST READ-WRITE LOCK THE PIXEL BUFFER!!!!
    CVPixelBufferLockBaseAddress(pixelBuffer, 0);
    CIImage *ciImage = [CIImage imageWithCVPixelBuffer:pixelBuffer];
    CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
    CIContext *temporaryContext = [CIContext contextWithOptions:nil];
    CGImageRef videoImage = [temporaryContext
                             createCGImage:ciImage
                             fromRect:CGRectMake(0, 0,
                                                 CVPixelBufferGetWidth(pixelBuffer),
                                                 CVPixelBufferGetHeight(pixelBuffer))];
    
    UIImage *uiImage = [UIImage imageWithCGImage:videoImage];
    CGImageRelease(videoImage);
    CVPixelBufferRelease(pixelBuffer);
    return uiImage;
}
 
static OSStatus CreateCGImageFromCVPixelBuffer(CVPixelBufferRef pixelBuffer, CGImageRef *imageOut)
{
    OSStatus err = noErr;
    OSType sourcePixelFormat;
    size_t width, height, sourceRowBytes;
    void *sourceBaseAddr = NULL;
    CGBitmapInfo bitmapInfo;
    CGColorSpaceRef colorspace = NULL;
    CGDataProviderRef provider = NULL;
    CGImageRef image = NULL;
    sourcePixelFormat = CVPixelBufferGetPixelFormatType( pixelBuffer );
    if ( kCVPixelFormatType_32ARGB == sourcePixelFormat )
        bitmapInfo = kCGBitmapByteOrder32Big | kCGImageAlphaNoneSkipFirst;
    else if ( kCVPixelFormatType_32BGRA == sourcePixelFormat )
        bitmapInfo = kCGBitmapByteOrder32Little | kCGImageAlphaNoneSkipFirst;
    else
        return -95014; // only uncompressed pixel formats
    sourceRowBytes = CVPixelBufferGetBytesPerRow( pixelBuffer );
    width = CVPixelBufferGetWidth( pixelBuffer );
    height = CVPixelBufferGetHeight( pixelBuffer );
    CVPixelBufferLockBaseAddress( pixelBuffer, 0 );
    sourceBaseAddr = CVPixelBufferGetBaseAddress( pixelBuffer );
    colorspace = CGColorSpaceCreateDeviceRGB();
    CVPixelBufferRetain( pixelBuffer );
    provider = CGDataProviderCreateWithData( (void *)pixelBuffer, sourceBaseAddr, sourceRowBytes * height, ReleaseCVPixelBuffer);
    image = CGImageCreate(width, height, 8, 32, sourceRowBytes, colorspace, bitmapInfo, provider, NULL, true, kCGRenderingIntentDefault);
    if ( err && image ) {
        CGImageRelease( image );
        image = NULL;
    }
    if ( provider ) CGDataProviderRelease( provider );
    if ( colorspace ) CGColorSpaceRelease( colorspace );
    *imageOut = image;
    return err;
}
 
static void ReleaseCVPixelBuffer(void *pixel, const void *data, size_t size)
{
    CVPixelBufferRef pixelBuffer = (CVPixelBufferRef)pixel;
    CVPixelBufferUnlockBaseAddress( pixelBuffer, 0 );
    CVPixelBufferRelease( pixelBuffer );
}
 
+(UIImage *)imageFromCVPixelBufferRef1:(CVPixelBufferRef)pixelBuffer{
    UIImage *image;
    @autoreleasepool {
        CGImageRef cgImage = NULL;
        CVPixelBufferRef pb = (CVPixelBufferRef)pixelBuffer;
        CVPixelBufferLockBaseAddress(pb, kCVPixelBufferLock_ReadOnly);
        OSStatus res = CreateCGImageFromCVPixelBuffer(pb,&cgImage);
        if (res == noErr){
            image= [UIImage imageWithCGImage:cgImage scale:1.0 orientation:UIImageOrientationUp];
        }
        CVPixelBufferUnlockBaseAddress(pb, kCVPixelBufferLock_ReadOnly);
        CGImageRelease(cgImage);
    }
    return image;
}
//第二种
+(UIImage *)imageFromCVPixelBufferRef2:(CVPixelBufferRef)pixelBuffer{
    CVPixelBufferRef pb = (CVPixelBufferRef)pixelBuffer;
    CVPixelBufferLockBaseAddress(pb, kCVPixelBufferLock_ReadOnly);
    int w = CVPixelBufferGetWidth(pb);
    int h = CVPixelBufferGetHeight(pb);
    int r = CVPixelBufferGetBytesPerRow(pb);
    int bytesPerPixel = r/w;
    unsigned char *buffer = CVPixelBufferGetBaseAddress(pb);
    UIGraphicsBeginImageContext(CGSizeMake(w, h));
    CGContextRef c = UIGraphicsGetCurrentContext();
    unsigned char *data = CGBitmapContextGetData(c);
    if (data != NULL) {
        int maxY = h;
        for(int y = 0; y<maxY; y++) {
            for(int x = 0; x<w; x++) {
                int offset = bytesPerPixel*((w*y)+x);
                data[offset] = buffer[offset];     // R
                data[offset+1] = buffer[offset+1]; // G
                data[offset+2] = buffer[offset+2]; // B
                data[offset+3] = buffer[offset+3]; // A
            }
        }
    }
    UIImage *img = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    CVPixelBufferUnlockBaseAddress(pb, kCVPixelBufferLock_ReadOnly);
    return img;
}
 
/** CMSampleBufferRef covert to UIImage */
 
/** CMSampleBufferRef covert to CVPixelBufferRef */
 
/** decode compress image to bitmap iamge */
+ (UIImage *)decodeImageWithImage:(UIImage *)imageToPredraw
{
    // Always use a device RGB color space for simplicity and predictability what will be going on.
    CGColorSpaceRef colorSpaceDeviceRGBRef = CGColorSpaceCreateDeviceRGB();
    // Early return on failure!
    if (!colorSpaceDeviceRGBRef) {
        NSLog(@"Failed to `CGColorSpaceCreateDeviceRGB` for image %@", imageToPredraw);
        return imageToPredraw;
    }
    
    // "In iOS 4.0 and later, and OS X v10.6 and later, you can pass NULL if you want Quartz to allocate memory for the bitmap." (source: docs)
    void *data = NULL;
    size_t width = imageToPredraw.size.width;
    size_t height = imageToPredraw.size.height;
    size_t bitsPerComponent = CHAR_BIT;//一个像素的单个组成部分的位数 如RGBA 此值指定R,G,B,A,每个分量占的位数为8bit。
    
#if 1
    // Even when the image doesn't have transparency, we have to add the extra channel because Quartz doesn't support other pixel formats than 32 bpp/8 bpc for RGB:
    // kCGImageAlphaNoneSkipFirst, kCGImageAlphaNoneSkipLast, kCGImageAlphaPremultipliedFirst, kCGImageAlphaPremultipliedLast
    // (source: docs "Quartz 2D Programming Guide > Graphics Contexts > Table 2-1 Pixel formats supported for bitmap graphics contexts")
    size_t numberOfComponents = CGColorSpaceGetNumberOfComponents(colorSpaceDeviceRGBRef) + 1; // 4: RGB + A
    size_t bitsPerPixel = (bitsPerComponent * numberOfComponents);//一个像素点占用的位数 如RGBA=8*4
    size_t bytesPerPixel = (bitsPerPixel / BYTE_SIZE);//一个像素点占用的字节数
    size_t bytesPerRow = (bytesPerPixel * width);//一行的全部像素占用的字节数
#else
    size_t bytesPerRow = 0;//对于CGBitmapContextCreate函数当bytesPerRow=0系统不仅会为我们自动计算，而且还会进行 cache line alignment 的优化
#endif
    
    CGBitmapInfo bitmapInfo = kCGBitmapByteOrder32Host;
    
    CGImageAlphaInfo alphaInfo = CGImageGetAlphaInfo(imageToPredraw.CGImage);
    // If the alpha info doesn't match to one of the supported formats (see above), pick a reasonable supported one.
    // "For bitmaps created in iOS 3.2 and later, the drawing environment uses the premultiplied ARGB format to store the bitmap data." (source: docs)
    if (alphaInfo == kCGImageAlphaNone || alphaInfo == kCGImageAlphaOnly) {
        alphaInfo = kCGImageAlphaNoneSkipFirst;
    } else if (alphaInfo == kCGImageAlphaFirst) {
        alphaInfo = kCGImageAlphaPremultipliedFirst;
    } else if (alphaInfo == kCGImageAlphaLast) {
        alphaInfo = kCGImageAlphaPremultipliedLast;
    }
    // "The constants for specifying the alpha channel information are declared with the `CGImageAlphaInfo` type but can be passed to this parameter safely." (source: docs)
    bitmapInfo |= alphaInfo;
    
    // Create our own graphics context to draw to; `UIGraphicsGetCurrentContext`/`UIGraphicsBeginImageContextWithOptions` doesn't create a new context but returns the current one which isn't thread-safe (e.g. main thread could use it at the same time).
    // Note: It's not worth caching the bitmap context for multiple frames ("unique key" would be `width`, `height` and `hasAlpha`), it's ~50% slower. Time spent in libRIP's `CGSBlendBGRA8888toARGB8888` suddenly shoots up -- not sure why.
    //data为NULL系统自动分配内存空间
    CGContextRef bitmapContextRef = CGBitmapContextCreate(data, width, height, bitsPerComponent, bytesPerRow, colorSpaceDeviceRGBRef, bitmapInfo);
    CGColorSpaceRelease(colorSpaceDeviceRGBRef);
    // Early return on failure!
    if (!bitmapContextRef) {
        NSLog(@"Failed to `CGBitmapContextCreate` with color space %@ and parameters (width: %zu height: %zu bitsPerComponent: %zu bytesPerRow: %zu) for image %@", colorSpaceDeviceRGBRef, width, height, bitsPerComponent, bytesPerRow, imageToPredraw);
        return imageToPredraw;
    }
    
    // Draw image in bitmap context and create image by preserving receiver's properties.
    CGContextDrawImage(bitmapContextRef, CGRectMake(0.0, 0.0, imageToPredraw.size.width, imageToPredraw.size.height), imageToPredraw.CGImage);
    CGImageRef predrawnImageRef = CGBitmapContextCreateImage(bitmapContextRef);
    UIImage *predrawnImage = [UIImage imageWithCGImage:predrawnImageRef scale:imageToPredraw.scale orientation:imageToPredraw.imageOrientation];
    CGImageRelease(predrawnImageRef);
    CGContextRelease(bitmapContextRef);
    
    // Early return on failure!
    if (!predrawnImage) {
        NSLog(@"Failed to `imageWithCGImage:scale:orientation:` with image ref %@ created with color space %@ and bitmap context %@ and properties and properties (scale: %f orientation: %ld) for image %@", predrawnImageRef, colorSpaceDeviceRGBRef, bitmapContextRef, imageToPredraw.scale, (long)imageToPredraw.imageOrientation, imageToPredraw);
        return imageToPredraw;
    }
    
    return predrawnImage;
}
 
- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}
 
@end
```
