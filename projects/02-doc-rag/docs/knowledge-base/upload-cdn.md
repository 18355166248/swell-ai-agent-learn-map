# 图片上传 CDN 流程

## 概述

图片上传 CDN 是内容管理系统中最常用的功能之一。用户在前端选择图片后，图片会经过压缩、格式转换、上传到 CDN 三个步骤。

## 流程图

```
用户选择图片 → 前端压缩 → 请求上传凭证 → 上传到 OSS → CDN 回源 → 返回 CDN URL
```

## 详细步骤

### 1. 前端压缩

用户选择图片后，前端会先用 Canvas 将图片压缩到指定尺寸和 quality。默认参数为最大宽度 1920px，quality 0.85。如果原图小于 1920px 则不缩放，只调整 quality。

### 2. 获取上传凭证

前端调用 `/api/upload/token` 接口获取 OSS 临时上传凭证。该接口返回 `accessKeyId`、`accessKeySecret`、`securityToken` 和 `ossPath`。凭证有效期为 1 小时。

接口定义如下：

```typescript
interface UploadTokenResponse {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  ossPath: string;
  cdnUrl: string;
  expireTime: number;
}
```

### 3. 上传到 OSS

拿到凭证后，前端使用 ali-oss SDK 将压缩后的图片上传到指定 OSS 路径。上传时设置 `Cache-Control: public, max-age=31536000` 以充分利用 CDN 缓存。

### 4. CDN 回源

OSS 上传成功后，CDN 会在用户首次访问时从 OSS 回源拉取图片，并缓存到边缘节点。后续访问直接命中 CDN 缓存，不再回源。

### 5. 返回 URL

上传成功后，前端拿到 CDN URL，可直接用于图片展示。URL 格式为 `https://cdn.example.com/{ossPath}`。

## 异常处理

- 上传失败时自动重试最多 3 次，间隔递增（1s、3s、5s）
- 压缩超时（5 秒）则跳过压缩，直接上传原图
- 凭证过期自动刷新后重试

## 注意事项

1. 图片大小限制为 20MB
2. 支持格式：jpg、png、webp、gif
3. 上传进度通过 `onProgress` 回调实时反馈
