# Frontend - 成公

成公（智能公考学习平台）的申论写作 AI 结构化批阅前端，基于 React 19 + TypeScript + Vite 构建。视觉方向为锁定的「成公」设计系统（OKLCH token、深色顶栏、纯无衬线、oxblood CTA、朱砂强调）。

## 技术栈

- **运行时**: React 19 + React Router v7
- **语言**: TypeScript（strict mode）
- **构建工具**: Vite 8
- **样式**: Tailwind CSS（OKLCH 设计 token，无 CSS 模块 / styled-components）
- **状态管理**: React Context（AuthContext / SettingsContext）
- **Markdown 渲染**: 自研 5 段报告组件（`components/grading/`），无第三方 markdown 库

## 项目特性

- 🎨 锁定的成公设计系统（OKLCH token + 深色顶栏 + 纯无衬线 + oxblood CTA + 朱砂批改标记）
- 🔐 完整 JWT 认证流程（注册 / 登录 / 自动登录 / 记住我 / 401→登录跳转）
- ⚙️ AI 配置管理（模型发现 / 连接测试 / API key 加密保存 + 脱敏返回 / 5-min 缓存）
- ✍️ 申论写作 + SSE 结构化批阅（5 段报告；SSE 卸载 abort + **禁自动重连**，计费安全）
- 📚 历史记录管理（时间筛选 / 内容搜索 / 单删 / 批删 / 清空）
- 📱 响应式（375 / 768 / 1024 / 1440）
- ♿ 可访问性（WCAG 2.1 AA 对比度；键盘焦点；跳转链接；reduced-motion）

## 前置要求

- Node.js ≥ 18
- 后端 API 运行在 `http://localhost:8001`

## 快速开始

```bash
cd frontend
npm install      # 仅首次
npm run dev      # http://localhost:5173
```

默认值开箱互通：前端 API baseURL 默认 `http://localhost:8001`，后端 CORS 已含 `localhost:5173`，无需 `.env`。如需改后端地址，设 `VITE_API_URL`。

```bash
npm run build    # 生产构建（tsc -b + vite build）
npm run preview  # 预览生产构建
npm run lint     # ESLint（基线 0 problems）
```

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 5173） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 检查（基线 0） |

## 设计系统

权威来源：`.trellis/tasks/06-14-frontend-rebuild/design.md` §2 + 根 `DESIGN.md`。token 在 `tailwind.config.js` 定义、`globals.css` 镜像为 CSS 变量。

### 颜色（OKLCH）

| 名称 | 值 | 用途 |
|------|------|------|
| `shell` | `oklch(0.235 0.016 262)` | 深色顶栏背景 |
| `shell-txt` | `oklch(0.92 0.006 250)` | 顶栏文本 |
| `paper` | `oklch(0.985 0.003 240)` | 工作区主背景（近白，非米色） |
| `panel` | `oklch(0.965 0.005 240)` | 卡片 / 面板背景 |
| `ink` | `oklch(0.24 0.02 262)` | 主要文本 |
| `mute` | `oklch(0.47 0.014 262)` | 次要 / 信息性文本（过 AA） |
| `faint` | `oklch(0.60 0.012 262)` | **仅装饰**（分隔符 / 占位 / aria-hidden 图标） |
| `oxblood` | `oklch(0.42 0.12 25)` | CTA 主操作色 |
| `mark` | `oklch(0.56 0.17 32)` | 朱砂强调（批改标记 / 状态，非通用 CTA） |
| `ok` | `oklch(0.50 0.11 155)` | 成功 / 就绪 |
| `warn` | `oklch(0.54 0.13 60)` | 警告（已加深过 AA） |
| `line` | `oklch(0.90 0.006 240)` | 分隔线 |

> 旧 cream / paper-white / slate-gray / deep-ink / vermilion-as-CTA 配色（墨评AI / 墨韵方向）已**全部移除**，禁止重新引入。

### 字体（纯无衬线）

- **sans（正文 + 标题）**: Inter + Noto Sans SC（**无衬线体**——Noto Serif SC 已删除）
- **mono**: JetBrains Mono

## 项目结构

```
frontend/
├── src/
│   ├── app/                      # 页面
│   │   ├── page.tsx              # 落地页 /
│   │   ├── login/ register/      # 认证页
│   │   ├── dashboard/            # 概览 /app
│   │   ├── writing/              # 写作台 + 批阅 /app/writing(/grading)
│   │   ├── history/              # 批改历史 /app/history
│   │   └── settings/             # AI 配置 /app/settings
│   ├── components/
│   │   ├── ui/                   # 基础组件（Button/Input/Pin/Toast/ConfirmDialog/EmptyState/Skeleton）
│   │   ├── grading/              # 批阅（StageTrace/GradingReport/StructuredReport）
│   │   ├── CommandBar.tsx        # 顶栏（app/public 变体）
│   │   ├── AppLayout.tsx         # /app 外壳
│   │   ├── RequireAuth.tsx       # 路由保护
│   │   └── ApiClientSync.tsx     # 401→登录路由桥
│   ├── contexts/                 # AuthContext / SettingsContext
│   ├── hooks/                    # useAuth / useSettings / useSSE / useFormValidation
│   ├── services/                 # apiClient / auth / settings / writing
│   ├── types/                    # api.ts / domain.ts
│   └── utils/                    # parseFeedback / feedbackDisplay / formatRelativeTime / structuredScoringPref
├── index.html
├── tailwind.config.js            # 设计 token（唯一真源）
└── vite.config.ts
```

## API 集成

通过 `apiClient`（自动注入 JWT、统一错误分类、401 钩子）调用：

### 认证
- `POST /api/v1/auth/register` · `POST /api/v1/auth/login` · `GET /api/v1/auth/me`

### AI 配置
- `GET /api/v1/settings/writing-ai` · `PUT /api/v1/settings/writing-ai`
- `POST /api/v1/settings/writing-ai/models`（发现）· `POST /api/v1/settings/writing-ai/test`（测试）

### 写作 / 历史
- `POST /api/v1/writings/grade-progressive`（SSE 批阅）
- `GET /api/v1/writings/history[?limit]` · `GET /api/v1/writings/history/{id}`
- `DELETE /api/v1/writings/history`（清空）· `DELETE /api/v1/writings/history/{id}`（单删）

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_URL` | `http://localhost:8001` | 后端 API 基础地址 |

## SSE 批阅（计费关键）

`useSSE` hook 用 `fetch` + `ReadableStream`（POST，非 EventSource）。两条硬约束：

- **卸载 abort**：组件卸载即 `abort()` 在途请求，无卸载后状态更新。
- **禁自动重连**：`reconnect` 默认 `false`，批阅页显式传 `false`。重连 = 重复调用 LLM = 重复计费。重试仅由用户显式触发（remount）。

```typescript
useSSE({
  url: '/api/v1/writings/grade-progressive',
  method: 'POST',
  body,
  reconnect: false,            // 计费关键，勿开
  onMessage, onComplete,
  onError: (e) => {            // e.status 可用时携带 HTTP 状态
    if (e.status === 401) apiClient.notifyUnauthorized();
  },
});
```

## 可访问性

- ✅ WCAG 2.1 AA 对比度（信息性文本用 `mute`，`faint` 仅装饰）
- ✅ 键盘导航（Tab/Enter/Esc）+ 全局焦点环（`outline:2px var(--mark)`）
- ✅ 语义化 HTML + ARIA + 跳转链接
- ✅ `prefers-reduced-motion` 降级
- 触摸目标：button h-9/h-10/h-11（36/40/44px），过 WCAG 2.2 AA（24px）；≥44px（AAA）未追求（与锁定设计冲突）

## 性能

- **构建产物**: ~338 KB JS + ~23 KB CSS（gzip 后 ~102 KB + ~5.7 KB）
- React 19 + Vite，按页面拆分状态机（loading/empty/error/ready）

## 故障排查

### 端口冲突
5173 被占用时 Vite 自动顺延；看终端输出取实际端口。

### CORS
后端 CORS 须含前端 origin（默认配置已含 `localhost:5173/5174`）。

### Token 过期
`apiClient` 检测 401 → 清 auth + 路由跳 `/login?from=`（经 `ApiClientSync`，**无 `window.location`**）。批阅 SSE 流中的 401 由 `useSSE.onError` 携带状态 → `notifyUnauthorized()`。

### SSE 连接中断
**不会自动重连**（计费设计）。失败显示分类错误 + 手动重试按钮（remount）。卸载即 abort，无泄漏。

## 部署

参见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## License

Proprietary
