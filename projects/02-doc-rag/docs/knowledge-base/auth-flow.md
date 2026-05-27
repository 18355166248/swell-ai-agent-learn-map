# 用户认证与授权流程

## 概述

系统使用 JWT (JSON Web Token) 作为身份认证机制，结合 RBAC (Role-Based Access Control) 实现权限控制。

## 登录流程

```
用户输入账号密码 → POST /api/auth/login → 服务端校验
  → 生成 access_token (15min) + refresh_token (7d)
  → 返回 token 对
```

### access_token

- 有效期 15 分钟，过期后使用 refresh_token 续期
- 存储于内存中，不持久化到 localStorage
- 每次请求通过 `Authorization: Bearer <token>` 携带

### refresh_token

- 有效期 7 天，存储于 httpOnly Cookie
- 仅用于调用 `/api/auth/refresh` 换取新的 access_token
- 一旦 refresh_token 被使用，服务端立即签发新 token 对并作废旧 token

## 权限模型

### 角色定义

| 角色       | 标识        | 权限范围             |
| ---------- | ----------- | -------------------- |
| 超级管理员 | super_admin | 全部权限             |
| 内容编辑   | editor      | 文章增删改、图片上传 |
| 普通用户   | user        | 仅查看               |

### 权限校验

前端路由通过 `authGuard` 中间件拦截未登录用户，API 层通过 JWT payload 中的 `role` 字段做二次校验。

```typescript
interface JwtPayload {
  userId: string;
  role: "super_admin" | "editor" | "user";
  iat: number;
  exp: number;
}
```

## 异常场景处理

- access_token 过期 → 拦截器自动用 refresh_token 续期，无感知
- refresh_token 过期 → 跳转登录页，清除用户状态
- 并发续期冲突 → 使用队列锁，确保同一时刻只有一个续期请求
- 异地登录检测 → 签发 token 时记录设备指纹，不一致则强制下线

## 安全注意事项

1. 禁止在 URL 参数中传递 token
2. access_token 不持久化，页面刷新后必须用 refresh_token 换取
3. 所有 API 请求强制 HTTPS
4. 敏感操作（删除、权限变更）需二次验证
