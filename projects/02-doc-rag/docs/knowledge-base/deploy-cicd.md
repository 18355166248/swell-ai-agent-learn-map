# 前端部署与 CI/CD 流程

## 概述

项目使用 GitHub Actions 作为 CI/CD 工具，部署目标为阿里云 OSS + CDN。所有合并到 main 分支的代码自动触发构建和部署。

## 流水线阶段

```
git push main
  → lint & test (5 min)
  → build (3 min)
  → deploy to OSS staging (2 min)
  → smoke test (1 min)
  → deploy to production CDN (2 min)
```

## 构建配置

### 环境变量

构建时通过 GitHub Secrets 注入以下变量：

| 变量名            | 说明         |
| ----------------- | ------------ |
| `VITE_API_BASE`   | API 网关地址 |
| `VITE_CDN_HOST`   | CDN 域名     |
| `VITE_SENTRY_DSN` | 错误监控 DSN |

### 构建产物

```
dist/
├── index.html
├── assets/
│   ├── index-<hash>.js      # 主入口，含路由懒加载
│   ├── vendor-<hash>.js     # react/react-dom/antd 等第三方库
│   └── index-<hash>.css
└── favicon.ico
```

## 部署策略

### 灰度发布

1. 先在 staging 环境部署，跑冒烟测试
2. 生产环境按 10% → 50% → 100% 逐步放量
3. 每次放量间隔 5 分钟，观察 Sentry 错误率和关键指标
4. 错误率超过 0.5% 自动回滚到上一版本

### 回滚方案

OSS 保留最近 5 个版本的构建产物，回滚只需修改 CDN 回源指向：

```bash
# 回滚到上一版本
npm run deploy:rollback
```

## CDN 配置

- 静态资源缓存 1 年（文件名含 hash，无更新冲突）
- HTML 文件缓存 5 分钟（确保用户能获取到最新版本）
- 开启 Gzip/Brotli 压缩
- CDN 加速区域：中国大陆 + 海外

## 监控告警

| 指标         | 阈值   | 通知方式           |
| ------------ | ------ | ------------------ |
| JS 错误率    | > 0.5% | 企业微信 + 邮件    |
| 首屏加载时间 | > 3s   | 企业微信           |
| API 超时率   | > 1%   | 邮件               |
| 构建失败     | 每次   | 企业微信 @相关人员 |
