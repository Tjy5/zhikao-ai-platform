# Frontend - 墨评AI

专业的AI写作批改前端应用，基于React 19 + TypeScript + Vite构建。

## 技术栈

- **运行时**: React 19 + React Router v7
- **语言**: TypeScript 6.0 (strict mode)
- **构建工具**: Vite 8
- **样式**: Tailwind CSS 3.4
- **状态管理**: React Context API
- **Markdown渲染**: react-markdown 10

## 项目特性

- 🎨 现代简洁的设计系统（Vermilion + Deep Ink配色）
- 🔐 完整的JWT认证流程（注册/登录/自动登录/记住我）
- ⚙️ AI配置管理（模型发现/连接测试/加密存储）
- ✍️ 写作批改进度UI（SSE连接已实现；后端当前为一次性返回模式）
- 📚 历史记录管理（时间筛选/内容搜索/清空历史）
- 📱 响应式设计（支持移动端/平板/桌面）
- ♿ 可访问性支持（WCAG 2.1 AA标准）

**注意**: SSE进度UI前端已完整实现（进度条、阶段指示器、自动重连），但后端当前为同步执行后一次性返回。待后端改造为真正的流式输出后，前端无需修改即可支持实时进度更新。

## 前置要求

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- 后端API服务运行在 `http://localhost:8080`

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（可选，默认值已配置）：

```bash
# 后端API地址（默认: http://localhost:8080）
VITE_API_URL=http://localhost:8080
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 4. 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录

### 5. 预览生产版本

```bash
npm run preview
```

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口5173） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行ESLint检查 |

## 项目结构

```
frontend/
├── src/
│   ├── app/                      # 页面组件
│   │   ├── page.tsx              # 首页
│   │   ├── login/                # 登录页
│   │   ├── register/             # 注册页
│   │   ├── writing/              # 写作与批改页
│   │   │   ├── page.tsx          # 写作输入页
│   │   │   └── grading/page.tsx  # 批改进度页
│   │   ├── history/              # 历史记录页
│   │   └── settings/             # 设置页
│   ├── components/               # 可复用组件
│   │   ├── ui/                   # 基础UI组件（Button, Input, Toast等）
│   │   └── RequireAuth.tsx       # 路由保护组件
│   ├── contexts/                 # React Contexts
│   │   └── AuthContext.tsx       # 认证状态管理
│   ├── hooks/                    # 自定义Hooks
│   │   ├── useAuth.ts            # 认证hook
│   │   ├── useFormValidation.ts  # 表单验证hook
│   │   ├── useSSE.ts             # SSE连接hook
│   │   └── useToast.ts           # Toast通知hook
│   ├── services/                 # API服务层
│   │   ├── apiClient.ts          # 基础API客户端
│   │   ├── authService.ts        # 认证API
│   │   ├── settingsService.ts    # 设置API
│   │   └── writingService.ts     # 写作批改API
│   ├── types/                    # TypeScript类型定义
│   │   ├── api.ts                # API响应类型
│   │   └── domain.ts             # 领域模型类型
│   ├── utils/                    # 工具函数
│   │   ├── formatRelativeTime.ts # 相对时间格式化
│   │   └── validation.ts         # 表单验证工具
│   ├── styles/
│   │   └── globals.css           # 全局样式（Tailwind配置）
│   ├── App.tsx                   # 根组件
│   └── main.tsx                  # 入口文件
├── public/                       # 静态资源
├── index.html                    # HTML模板
├── vite.config.ts                # Vite配置
├── tailwind.config.js            # Tailwind配置
├── tsconfig.json                 # TypeScript配置
└── package.json                  # 项目依赖
```

## 设计系统

### 颜色系统

| 名称 | 色值 | 用途 |
|------|------|------|
| Deep Ink | `#2C3137` | 主要文本 |
| Vermilion | `#C7432F` | 主色调（批改标记、CTA） |
| Slate Gray | `#5B6B79` | 次要文本 |
| Paper White | `#FAFAF9` | 主背景 |
| Card Cream | `#F5F0E8` | 卡片背景 |
| Success Ink | `#2D5A3D` | 成功状态 |
| Warning Amber | `#D97706` | 警告状态 |
| Error Crimson | `#DC2626` | 错误状态 |

### 字体系统

- **Display（标题）**: Noto Serif SC（思源宋体）
- **Body（正文）**: Inter
- **Mono（代码）**: JetBrains Mono

### 布局系统

- **8px网格系统**: 所有间距为8的倍数
- **圆角**: 4px (sm) / 8px (md) / 12px (lg)
- **最大宽度**: 1120px（内容区）

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VITE_API_URL` | `http://localhost:8080` | 后端API基础地址 |

## API集成

前端通过以下API与后端通信：

### 认证相关
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息

### 设置相关
- `GET /api/v1/settings/writing-ai` - 获取AI配置
- `PUT /api/v1/settings/writing-ai` - 更新AI配置
- `POST /api/v1/settings/writing-ai/models` - 发现可用模型
- `POST /api/v1/settings/writing-ai/test` - 测试连接

### 写作相关
- `POST /api/v1/writings/grade-progressive` - SSE渐进式批改
- `GET /api/v1/writings/history` - 获取历史记录列表
- `GET /api/v1/writings/history/{id}` - 获取历史记录详情
- `DELETE /api/v1/writings/history` - 清空全部历史

所有认证请求自动携带JWT token（存储在localStorage）。

## 浏览器支持

- Chrome/Edge ≥ 90
- Firefox ≥ 88
- Safari ≥ 14
- 移动端浏览器（iOS Safari, Chrome Android）

## 性能指标

- **构建产物大小**: ~420KB JS + ~20KB CSS (gzip后 ~128KB + ~5KB)
- **首屏加载时间**: <2秒（3G网络）
- **运行时性能**: React 19优化，最小重渲染

## 可访问性

- ✅ WCAG 2.1 AA标准
- ✅ 键盘导航支持（Tab/Enter/Escape）
- ✅ 语义化HTML标签
- ✅ ARIA标签完整
- ✅ 焦点可见性（2px vermilion outline）
- ✅ 减少动效支持（prefers-reduced-motion）
- ✅ 移动端触摸目标≥44x44px

## 开发指南

### 添加新页面

1. 在 `src/app/` 创建新目录
2. 添加 `page.tsx` 组件
3. 在 `src/App.tsx` 中配置路由
4. 如需保护路由，使用 `<RequireAuth>` 包裹

### 添加新API服务

1. 在 `src/types/api.ts` 定义响应类型
2. 在 `src/services/` 创建服务文件
3. 使用 `apiClient` 发起请求（自动处理JWT）

### 表单验证

使用 `useFormValidation` hook：

```typescript
const { values, errors, handleChange, validate } = useFormValidation(
  { username: '', password: '' },
  [
    { field: 'username', validate: (v) => !v ? '用户名不能为空' : null },
    { field: 'password', validate: (v) => v.length < 6 ? '密码至少6位' : null },
  ]
);
```

### SSE连接

使用 `useSSE` hook：

```typescript
const { isConnected, error } = useSSE(url, {
  method: 'POST',
  body: { content: '...' },
  onMessage: (data) => {
    // 处理消息
  },
  onError: (error) => {
    // 处理错误
  },
});
```

## 故障排查

### 端口冲突

如果5173端口被占用，Vite会自动使用下一个可用端口。查看终端输出获取实际端口。

### CORS错误

确保后端CORS配置包含前端地址：
- `http://localhost:5173`
- `http://localhost:5174`（备用端口）

### Token过期

前端会自动检测401响应并重定向到登录页。无需手动处理。

### SSE连接中断

`useSSE` hook内置自动重连机制（最多3次，间隔1秒）。

## 部署指南

参见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## License

Proprietary
