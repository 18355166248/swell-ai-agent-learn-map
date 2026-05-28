# 移动端组件库规范

## 概览

团队组件库 `@swell/mobile-ui` v2.3.0，基于 React 19 + TypeScript，覆盖移动端 H5 常见场景。

## 可用组件清单

### 表单与输入

| 组件        | 用途                  | 关键 Props                          |
| ----------- | --------------------- | ----------------------------------- |
| SearchBar   | 搜索栏                | placeholder, onSearch, maxHistory   |
| FormInput   | 通用输入框            | label, required, maxLength, pattern |
| FormSelect  | 下拉选择              | options, value, onChange            |
| DatePicker  | 日期选择              | mode (date/datetime/range)          |
| ImagePicker | 图片选择（拍照/相册） | maxCount, maxSize, onUpload         |

### 展示与反馈

| 组件           | 用途                  | 关键 Props                             |
| -------------- | --------------------- | -------------------------------------- |
| InfiniteScroll | 无限滚动列表          | loadMore, hasMore, threshold           |
| ImageViewer    | 图片预览（缩放/滑动） | images, initialIndex, enableDownload   |
| Toast          | 轻提示                | type (success/error/warning), duration |
| Modal          | 弹窗                  | visible, title, onClose                |
| EmptyState     | 空状态占位            | icon, text, actionLabel                |

### 业务组件

| 组件           | 用途                             | 关键 Props                              |
| -------------- | -------------------------------- | --------------------------------------- |
| PaymentPanel   | 支付面板                         | orderId, amount, onPaySuccess           |
| CouponSelector | 优惠券选择器                     | coupons, selectedIds, onSelect          |
| ShareSheet     | 分享面板（微信/朋友圈/复制链接） | url, title, imageUrl                    |
| BannerCarousel | 轮播 Banner                      | items ({ imageUrl, linkUrl }), autoplay |

## 通用规范

### 主题变量

所有组件支持通过 CSS Variables 定制主题色：

```css
:root {
  --swell-primary: #ff5500;
  --swell-bg: #f5f5f5;
  --swell-text: #333333;
  --swell-radius: 8px;
  --swell-danger: #e74c3c;
  --swell-success: #27ae60;
}
```

### 按需加载

使用 babel-plugin-import 实现按需加载，避免引入整个组件库：

```js
// babel.config.js
plugins: [["import", { libraryName: "@swell/mobile-ui", style: true }]];
```

### SSR 兼容

除 ImageViewer（依赖 Canvas/DOM）外，所有组件均支持 SSR。ImageViewer 需使用 `next/dynamic` 禁用 SSR。

### 版本

当前版本 v2.3.0，最低支持 React 18。
