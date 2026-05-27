# 移动端组件库使用指南

## 概述

团队基于 Ant Design Mobile 封装了一套业务组件库 `@swell/mobile-ui`，覆盖移动端 H5 常见场景。组件均支持按需加载和 Tree Shaking。

## 核心组件

### SearchBar - 搜索栏

搜索栏支持实时联想、历史记录和语音输入。联想结果通过 `/api/search/suggest` 获取。

```tsx
import { SearchBar } from "@swell/mobile-ui";

<SearchBar
  placeholder="搜索专辑、声音、用户"
  onSearch={(keyword) => fetchResults(keyword)}
  maxHistory={10}
  enableVoice
/>;
```

关键参数：

- `maxHistory`: 最大历史记录条数，默认 8
- `enableVoice`: 是否启用语音输入，默认 false
- `debounceMs`: 联想去抖间隔，默认 300ms
- `onSearch`: 确认搜索回调

### InfiniteScroll - 无限滚动

基于 IntersectionObserver 实现，比传统 scroll 事件性能更好。列表触底时自动加载下一页。

```tsx
import { InfiniteScroll } from "@swell/mobile-ui";

<InfiniteScroll
  loadMore={fetchNextPage}
  hasMore={pageInfo.hasMore}
  loader={<LoadingSpinner />}
  threshold={100} // 距底部 100px 触发加载
>
  {items.map((item) => (
    <Card key={item.id} data={item} />
  ))}
</InfiniteScroll>;
```

### ImageViewer - 图片预览

支持双指缩放、滑动切换、长按保存。内部使用 Canvas 做手势计算。

```tsx
import { ImageViewer } from "@swell/mobile-ui";

<ImageViewer
  images={imageUrls}
  initialIndex={0}
  onClose={() => setVisible(false)}
  enableDownload
/>;
```

## 主题定制

组件库基于 CSS Variables 实现主题切换：

```css
:root {
  --swell-primary: #ff5500;
  --swell-bg: #f5f5f5;
  --swell-text: #333333;
  --swell-radius: 8px;
}
```

## 常见问题

### 按需加载体积过大

检查是否引入了一整个组件库而非单个组件。建议使用 babel-plugin-import：

```javascript
// babel.config.js
plugins: [["import", { libraryName: "@swell/mobile-ui", style: true }]];
```

### SSR 兼容性

除 `ImageViewer`（依赖 Canvas/DOM）外所有组件均支持 SSR。`ImageViewer` 需使用 `next/dynamic` 禁用 SSR：

```tsx
const ImageViewer = dynamic(() => import("@swell/mobile-ui").then((m) => m.ImageViewer), {
  ssr: false,
});
```

## 版本发布

| 版本   | 变更内容                                 | 发布日期   |
| ------ | ---------------------------------------- | ---------- |
| v2.3.0 | 新增 SearchBar 语音输入                  | 2026-04-15 |
| v2.2.0 | InfiniteScroll 改用 IntersectionObserver | 2026-03-01 |
| v2.1.0 | 支持 CSS Variables 主题定制              | 2026-01-20 |
| v2.0.0 | 迁移至 React 19，移除 prop-types         | 2025-12-10 |
