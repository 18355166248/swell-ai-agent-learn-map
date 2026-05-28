# 支付业务流程

## 概述

平台使用微信支付 + 支付宝双通道，服务端通过 `/api/payment/order` 统一下单。

## 支付流程

```
用户点击购买
  → 选择优惠券（可选）
  → POST /api/payment/order  创建订单
  → 调起支付 SDK（微信/支付宝）
  → 用户完成支付
  → 轮询 POST /api/payment/status（间隔 2s，最多 30 次）
  → 支付成功 → 跳转结果页
  → 支付失败/取消 → 展示失败原因
```

## 优惠券使用规则

1. 每笔订单只能使用 1 张优惠券
2. 优惠券类型：满减券（满 X 减 Y）、折扣券（打 Z 折）、兑换券（直接兑换商品）
3. 优惠券有效期以 `expireTime` 为准，过期券不可用
4. 通过 `/api/payment/coupons` 获取可用优惠券列表，参数传入 `productId` 和 `amount`

## 支付渠道

| 渠道      | 标识       | 适用场景    | 限额            |
| --------- | ---------- | ----------- | --------------- |
| 微信支付  | wechat_pay | 微信内 H5   | 单笔 ≤ 5000 元  |
| 支付宝    | alipay     | 支付宝内 H5 | 单笔 ≤ 10000 元 |
| Apple IAP | apple_iap  | iOS App     | 按 Apple 定价   |

## 支付状态

| 状态      | 含义     | 前端展示        |
| --------- | -------- | --------------- |
| pending   | 等待支付 | 支付中...       |
| success   | 支付成功 | 支付成功，跳转  |
| failed    | 支付失败 | 支付失败 + 原因 |
| cancelled | 用户取消 | 已取消          |
| refunding | 退款中   | 退款处理中      |
| refunded  | 已退款   | 已退款          |

## 支付安全

1. 订单创建后 15 分钟内未支付自动取消
2. 重复支付保护：同一 `productId` + `userId` 5 秒内不允许重复下单
3. 支付金额前后端同时校验，不一致则拒绝
4. 异常退款需人工审核

## 埋点要求

支付相关页面必须上报：

- `payment_start`：发起支付（orderId, amount, payChannel）
- `payment_success`：支付成功（orderId, amount, transactionId）
- `payment_fail`：支付失败（orderId, errorCode, errorMsg）
- 优惠券选择：`coupon_select`（couponId, discountAmount）
