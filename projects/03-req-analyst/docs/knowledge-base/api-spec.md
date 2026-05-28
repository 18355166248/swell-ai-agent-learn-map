# 接口调用规范

## 基础信息

- API 网关地址：`https://api-gateway.example.com`
- 认证方式：JWT Bearer Token（access_token 15min + refresh_token 7d）
- 请求头统一携带：`Authorization: Bearer <token>`、`X-Request-Id`（UUID）
- 所有接口使用 HTTPS POST，Content-Type: application/json

## 通用响应格式

```typescript
interface ApiResponse<T> {
  code: number; // 0 表示成功
  message: string;
  data: T;
  serverTime: number;
}
```

错误码规范：

| code | 含义       | 前端处理              |
| ---- | ---------- | --------------------- |
| 0    | 成功       | -                     |
| 1001 | token 过期 | 自动刷新 token 后重试 |
| 1002 | token 无效 | 跳转登录页            |
| 2001 | 参数错误   | 展示错误提示          |
| 3001 | 权限不足   | 提示无权限            |
| 5000 | 服务器错误 | 提示稍后重试          |

## 常用接口清单

### 用户模块

| 接口               | 说明         | 关键参数                      |
| ------------------ | ------------ | ----------------------------- |
| /api/auth/login    | 登录         | phone, smsCode                |
| /api/auth/refresh  | 刷新 token   | refreshToken                  |
| /api/user/profile  | 获取用户信息 | -                             |
| /api/user/settings | 更新用户设置 | nickname, avatar, preferences |

### 内容模块

| 接口                | 说明     | 关键参数                         |
| ------------------- | -------- | -------------------------------- |
| /api/content/album  | 专辑详情 | albumId                          |
| /api/content/list   | 内容列表 | categoryId, page, pageSize       |
| /api/content/search | 搜索     | keyword, type (album/voice/user) |

### 支付模块

| 接口                 | 说明           | 关键参数                      |
| -------------------- | -------------- | ----------------------------- |
| /api/payment/order   | 创建订单       | productId, amount, payChannel |
| /api/payment/status  | 查询支付状态   | orderId                       |
| /api/payment/coupons | 获取可用优惠券 | productId, amount             |

### 上传模块

| 接口                 | 说明         | 关键参数                     |
| -------------------- | ------------ | ---------------------------- |
| /api/upload/token    | 获取上传凭证 | fileType (image/audio/video) |
| /api/upload/callback | 上传完成回调 | ossPath, fileSize, duration  |

### 分享模块

| 接口              | 说明         | 关键参数             |
| ----------------- | ------------ | -------------------- |
| /api/share/config | 获取分享配置 | shareType, contentId |
| /api/share/report | 上报分享结果 | shareType, success   |

## 调用约定

1. 列表接口统一使用 `page`（从 1 开始）+ `pageSize`（默认 20，最大 50）分页
2. 文件上传先调 `/api/upload/token` 获取 OSS 凭证，前端直传 OSS 后调 `/api/upload/callback` 通知服务端
3. 支付流程：创建订单 → 调起支付 → 轮询 /api/payment/status（间隔 2s，最多 30 次）
4. 并发请求需携带 `X-Request-Id` 去重，避免重复提交
