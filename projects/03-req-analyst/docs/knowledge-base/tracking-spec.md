# 埋点规范

## 埋点体系

统一使用公司自研埋点 SDK `@swell/tracker` v3.0，基于曝光+点击+事件三层模型。

## 埋点类型

### 1. 页面曝光（page_view）

每个页面进入时上报，包含页面级参数。

```typescript
tracker.pageView({
  pageId: "album_detail",
  pageName: "专辑详情页",
  params: {
    albumId: "12345",
    from: "home_recommend",
  },
});
```

必填字段：`pageId`、`pageName`
选填字段：`from`（来源页面）、`contentId`（内容 ID）

### 2. 元素曝光（element_exposure）

模块/组件进入可视区时上报。使用 IntersectionObserver 自动检测，threshold 默认 0.5（元素 50% 可见时触发）。

```typescript
<ExposureTracker moduleId="recommend_section" params={{ position: 1 }}>
  <RecommendCard />
</ExposureTracker>
```

### 3. 元素点击（element_click）

用户交互时上报。

```typescript
tracker.click({
  moduleId: "play_button",
  elementId: "play_btn",
  params: {
    albumId: "12345",
    playMode: "sequential",
  },
});
```

必填字段：`moduleId`、`elementId`

### 4. 业务事件（biz_event）

关键业务流程节点上报。常见事件类型：

| 事件名          | 含义     | 必带参数                        |
| --------------- | -------- | ------------------------------- |
| payment_start   | 发起支付 | orderId, amount, payChannel     |
| payment_success | 支付成功 | orderId, amount, transactionId  |
| payment_fail    | 支付失败 | orderId, errorCode, errorMsg    |
| share_click     | 点击分享 | shareType (wechat/moments/copy) |
| login_start     | 发起登录 | loginType (sms/wechat/phone)    |
| upload_start    | 开始上传 | fileType, fileSize              |
| upload_success  | 上传成功 | fileType, fileSize, duration    |

## 命名规范

- `pageId`：snake_case，如 `album_detail`、`user_profile`
- `moduleId`：snake_case，如 `recommend_section`、`payment_panel`
- `elementId`：snake_case，如 `play_btn`、`close_icon`

## 埋点自查清单

每个需求上线前需确认：

1. 所有新增页面有 `pageView` 埋点
2. 新增运营位/模块有 `exposure` + `click` 埋点
3. 关键业务流程有 `biz_event` 埋点（支付、分享、登录等）
4. 埋点参数包含必要的业务 ID（albumId、orderId 等）
5. `from` 参数填写正确，能串联用户路径
