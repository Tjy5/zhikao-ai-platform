# 墨评AI - 写作反馈平台

墨评AI 是一个基于 React、Vite、Spring Boot 和 OpenAI-compatible LLM 的写作反馈应用。当前产品面聚焦注册/登录、提交写作作答、保存自己的模型设置、回看历史记录和校验公开内容包。

本仓库正在向可开源的公考学习平台核心演进。公开仓库不保存未授权题库、真题解析、培训资料或本地私有语料；知识点、原创练习和写作任务通过可审计的内容包机制逐步加入。

## 简历项目定位

这个仓库适合按 **AI 应用工程 / 全栈 AI 产品工程** 项目展示，而不是按普通 CRUD 项目展示。核心亮点是：

- 端到端产品闭环：注册登录、用户级模型配置、写作提交、SSE 批改、历史复盘和设置管理。
- AI 应用工程边界：OpenAI-compatible provider、模型发现、provider 测试、JSON 兜底开关、失败分类和离线输出合同回归。
- 安全和隐私边界：BCrypt 密码哈希、HS256 JWT、用户隔离、provider API key 加密保存和响应脱敏。
- 工程质量证据：Spring Boot contract tests、前端 Vitest 流程测试、内容包治理测试、离线写作反馈 eval fixture、GitHub Actions CI。

可以在简历中概括为：

```text
构建 React + Spring Boot 全栈 AI 写作反馈平台，支持 JWT 登录、用户级 OpenAI-compatible 模型配置、API key 加密保存、SSE 渐进式批改、历史复盘、内容包治理和离线 LLM 输出合同回归；通过 JUnit/MockMvc、Vitest 和 GitHub Actions 覆盖核心质量门禁。
```

## 核心功能

- **首页**：展示墨评AI产品入口、写作反馈入口、历史记录入口和设置入口。
- **账号与设置**：注册/登录后保存每个账号自己的 OpenAI-compatible 模型配置，API key 加密保存并以脱敏状态返回。
- **写作反馈**：支持传统评分接口和渐进式 SSE 评分接口，生产请求需要登录并使用当前账号的模型设置。
- **历史记录**：保存当前账号的批改请求与结果，支持列表、筛选、详情和清空。
- **AI 状态检查**：展示当前账号的非秘密 LLM 配置状态，不暴露用户 provider API key。
- **内容治理**：通过内容包 manifest、来源声明、许可证声明和 Java 后端校验器管理公开示例内容。
- **离线 AI 回归**：用原创写作任务和确定性 Markdown fixture 校验反馈结构、rubric 覆盖和可执行建议，不依赖真实 LLM key。

## 快速开始

需要 Java 21 和 Node。所有端口、密钥、CORS、数据库路径在 `application.yml` 与前端 `apiClient.ts` 都有 dev 默认值，开箱即用，无需任何环境变量或 `.env` 文件。

启动后端（Java 21 + Spring Boot，默认 `:8001`）：

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

另开一个终端启动前端（Vite，默认 `:5173`）：

```bash
cd frontend
npm install                   # 仅首次
npm run dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8001`
- 健康检查：`http://localhost:8001/health`

默认值互通：后端 CORS 已含 `localhost:5173`，前端 API baseURL 默认 `http://localhost:8001`，所以两侧都无需额外配置即可联调。如需改端口，后端用 `BACKEND_PORT`、`BACKEND_CORS_ORIGINS`，前端用 `VITE_API_URL`（指向后端）覆盖默认值。

## 技术栈

- 前端：React 19、Vite、TypeScript、React Router、Tailwind CSS。
- 后端：Java 21、Spring Boot 3.5、Spring Security、Spring JDBC、Flyway、SQLite、Xerial SQLite JDBC、Auth0 Java JWT。
- AI provider：小型 OpenAI-compatible HTTP wrapper，支持 `/chat/completions` 和 `/models`。
- 测试：Vitest、Testing Library、JUnit 5、Spring Boot Test、MockMvc。

## 架构和请求流

```text
React/Vite SPA
  ├─ AuthProvider + RequireAuth 管理登录态和受保护页面
  ├─ apiClient 统一封装 REST API，SSE 批改保留 raw Response
  └─ writing/history/settings 页面消费用户级 API
        │
        ▼
Spring Boot API (/api/v1)
  ├─ auth: 注册、登录、/me、JWT 签发和校验
  ├─ settings: 用户级 provider base URL、模型名、API key 加密保存
  ├─ writing: 同步批改、SSE 批改、AI 状态、历史列表和详情
  ├─ ai: OpenAI-compatible HTTP provider、prompt builder、失败分类
  ├─ content: 公开内容包校验器和 CLI
  └─ data: JdbcClient repositories + SQLite/Flyway schema
        │
        ▼
SQLite dev.db
  ├─ users
  ├─ user_ai_model_settings
  └─ history
```

核心流程：

1. **登录认证**：前端提交 `/api/v1/auth/login`，后端签发 HS256 JWT，前端通过 `authSession` 自动附加 `Authorization: Bearer <token>`。
2. **模型配置**：用户在 `/settings` 保存 OpenAI-compatible base URL、模型名和 API key。后端只保存 AES-GCM 加密后的 key，并返回 `has_api_key` 和 `api_key_hint`。
3. **SSE 批改**：写作页调用 `/api/v1/writings/grade-progressive`，后端加载当前用户配置，调用 provider，成功时发送一个最终 `text/event-stream` 事件，失败时发送带 `classification` 和 `retryable` 的错误事件。
4. **历史复盘**：批改成功后写入 `history`，历史页只查询当前登录用户的数据，避免跨用户泄漏。
5. **内容治理**：公开示例内容必须通过 manifest、来源策略、许可证和审查状态校验，避免仓库混入真实试题、私有语料或培训材料。

## 项目结构

```text
writing-feedback-platform/
├── frontend/                  # React + Vite 前端应用
│   ├── src/App.tsx            # SPA 路由入口
│   ├── src/app/page.tsx       # 首页
│   ├── src/pages/             # 写作反馈、历史、登录和设置页面
│   ├── src/auth/              # 登录态和 token 管理
│   └── src/services/          # 本地会话存储和辅助服务
├── backend/                   # Java + Spring Boot 后端应用
│   ├── pom.xml                # Maven 构建配置
│   ├── mvnw / mvnw.cmd        # Maven wrapper
│   ├── src/main/java/         # API、服务、数据访问、安全和内容校验
│   ├── src/main/resources/    # application.yml 和 Flyway 迁移
│   └── src/test/              # JUnit / MockMvc / 离线 AI 输出合同回归测试
├── .github/workflows/ci.yml   # 后端和前端质量门禁
├── content-samples/           # 原创/官方来源示例内容包，不含真题或网课材料
└── docs/                      # 当前保留文档
```

## 后端配置

后端 `.env` 可参考 `backend/.env.example`：

```env
BACKEND_PORT=8001
JDBC_DATABASE_URL=jdbc:sqlite:./dev.db
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
APP_SECRET_KEY=dev-only-change-me
ACCESS_TOKEN_EXPIRE_MINUTES=60
MODEL_SETTINGS_ENCRYPTION_KEY=dev-only-model-settings-key-change-me
OPENAI_API_KEY=
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4o-mini
WRITING_LLM_JSON_FALLBACK=true
DEBUG=false
```

生产环境必须单独配置 `APP_SECRET_KEY` 和 `MODEL_SETTINGS_ENCRYPTION_KEY`。前者用于签发登录令牌，后者用于加密保存每个用户的模型 API key；两个值都不要提交到仓库。

前端 `.env.local` 可参考 `frontend/.env.example`：

```env
PORT=3000
VITE_API_URL=http://localhost:8001
VITE_FRONTEND_URL=http://localhost:3000
VITE_DEBUG=false
```

## API 摘要

- `POST /api/v1/auth/register`：注册账号。
- `POST /api/v1/auth/login`：登录并获取 Bearer token。
- `GET /api/v1/auth/me`：返回当前登录用户。
- `GET /api/v1/settings/writing-ai`：读取当前账号的模型设置。
- `PUT /api/v1/settings/writing-ai`：保存当前账号的模型设置。
- `POST /api/v1/settings/writing-ai/models`：发现 OpenAI-compatible provider 模型列表。
- `POST /api/v1/settings/writing-ai/test`：显式测试当前账号的 provider 能力。
- `POST /api/v1/writings/grade`：传统评分接口，返回 `{ "content": "...", "contentFormat": "markdown" }`。
- `POST /api/v1/writings/grade-progressive`：SSE 渐进式评分接口，成功时发送单个最终事件。
- `GET /api/v1/writings/ai-status`：AI 服务状态。
- `GET /api/v1/writings/history`：批改历史列表。
- `GET /api/v1/writings/history/{id}`：批改历史详情。
- `DELETE /api/v1/writings/history`：清空批改历史。
- `GET /health`：健康检查。

受保护接口包括 `/api/v1/auth/me`、`/api/v1/writings/**` 和 `/api/v1/settings/writing-ai/**`。这些接口都需要 `Authorization: Bearer <token>`。

## AI 工程证据

本项目刻意把 AI 能力放在可测试边界内，而不是只在前端包一层模型调用。

- **Provider 抽象**：`AiProvider` 定义写作批改和模型发现接口，生产实现是 `OpenAiCompatibleAiProvider`，测试使用 `FakeAiProvider`，避免测试访问真实外部服务。
- **失败分类**：provider 错误被归类为 `unavailable`、`authentication`、`timeout`、`rate_limit`、`refusal`、`malformed_output`、`provider_error` 和 `unknown`，同步接口和 SSE 接口都返回安全的用户可读结果。
- **离线输出合同回归**：`backend/src/test/resources/eval/writing-feedback-benchmark.json` 保存原创写作任务的正负样例，`WritingFeedbackEvalTests` 校验 Markdown 反馈必须包含任务类型、综合评价、亮点、改进建议、参考优化、rubric 维度和可执行建议。
- **密钥治理**：用户 provider API key 不进入前端持久化配置，不以明文落库，不在响应中返回。

离线 eval 的边界是输出合同回归，不声称真实模型评分准确率。它证明项目已经定义“什么样的 AI 反馈算可用”，并能在 CI 中阻止明显退化的反馈格式。

## 内容治理

公开内容必须遵守：

- [CONTENT_POLICY.md](CONTENT_POLICY.md)：公开内容边界、禁止内容、官方来源和许可证依据。
- [CONTRIBUTING_CONTENT.md](CONTRIBUTING_CONTENT.md)：内容贡献格式、来源策略和审核状态。
- [ATTRIBUTIONS.md](ATTRIBUTIONS.md)：公开内容和许可证归属记录。
- [TAKEDOWN.md](TAKEDOWN.md)：权利投诉和移除流程。

本仓库的公开 demo 内容位于 `content-samples/`，只包含原创示例和基于官方来源的原创说明，不包含真实试题、官方答案解析、网上题库、培训课程材料或旧本地私有内容。

校验内容包：

```powershell
cd backend
.\mvnw.cmd -q '-DskipTests' 'exec:java' '-Dexec.args=..\content-samples'
```

```bash
cd backend
./mvnw -q -DskipTests exec:java -Dexec.args="../content-samples"
```

新增内容包时必须提供 `manifest.json`，并为每个内容项声明 `license`、`origin_policy`、`review_status`、`source_refs` 或 `originality_declaration`。

## 常用命令

```powershell
# 后端测试
Push-Location backend; .\mvnw.cmd test; Pop-Location

# 后端离线 LLM 输出合同回归，已包含在 test 内
Push-Location backend; .\mvnw.cmd -Dtest=WritingFeedbackEvalTests test; Pop-Location

# 后端开发启动
Push-Location backend; .\mvnw.cmd spring-boot:run; Pop-Location

# 后端打包
Push-Location backend; .\mvnw.cmd package; Pop-Location

# 内容包校验
Push-Location backend; .\mvnw.cmd -q '-DskipTests' 'exec:java' '-Dexec.args=..\content-samples'; Pop-Location
```

```bash
# 后端测试
(cd backend && ./mvnw test)

# 后端离线 LLM 输出合同回归，已包含在 test 内
(cd backend && ./mvnw -Dtest=WritingFeedbackEvalTests test)

# 后端开发启动
(cd backend && ./mvnw spring-boot:run)

# 后端打包
(cd backend && ./mvnw package)

# 内容包校验
(cd backend && ./mvnw -q -DskipTests exec:java -Dexec.args="../content-samples")
```

```bash
# 前端
(cd frontend && npm install)
(cd frontend && npm run dev)
(cd frontend && npm run lint)
(cd frontend && npm run test)
(cd frontend && npm run build)
```

## 质量门禁和 CI

本地质量门禁：

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm run lint
npm test
npm run build
```

GitHub Actions workflow 位于 `.github/workflows/ci.yml`，包含两个 secret-free job：

- **Backend tests**：Ubuntu runner + Java 21 + Maven wrapper + `./mvnw test`。这会同时运行 MockMvc contract tests、内容包测试和离线写作反馈 eval。
- **Frontend checks**：Ubuntu runner + Node 20 + `npm ci` + `npm run lint` + `npm test` + `npm run build`。

CI 不依赖真实 provider API key，不会访问 OpenAI-compatible 外部服务。

## 数据库

数据库仅使用 SQLite。默认开发库为 `backend/dev.db`，连接字符串为 `jdbc:sqlite:./dev.db`。Schema 由 Flyway 管理，迁移文件位于 `backend/src/main/resources/db/migration/`。本项目不再使用 SQLAlchemy 或 Alembic。

本次 Java 迁移不保留旧 Python 本地 `backend/dev.db` 数据。开发环境可从空 SQLite 文件自动创建 schema，用户需要重新注册并重新填写 provider API key。

## 部署要求

- 使用 Java 21 运行后端。
- 使用 `.\mvnw.cmd package` 或 `./mvnw package` 构建 jar。
- 用 `java -jar target/zhikao-backend-1.0.0.jar` 启动生产包，并通过环境变量传入端口、SQLite 路径、CORS origin、JWT secret、模型设置加密 secret 和默认 provider 配置。
- `APP_SECRET_KEY` 每个部署环境必须独立设置；更换该值会让已签发 token 失效。
- `MODEL_SETTINGS_ENCRYPTION_KEY` 必须和数据库备份一起纳入密钥备份流程；丢失后，已保存的用户 provider API key 无法解密，只能让用户重新填写。
- 用户 provider API key 只应通过 `/settings` 保存，不要写入前端 `.env.local`、浏览器存储或提交到仓库。

## 面试讲法

可以重点讲这些工程问题：

- **为什么用 SSE**：写作批改可能耗时较长，SSE 给前端保留渐进式反馈通道；当前实现先发送单个最终事件，未来可以扩展为多阶段进度事件而不改变页面入口。
- **怎么避免薄 LLM wrapper**：项目把 provider 配置、密钥加密、失败分类、模型发现、provider 测试、历史记录和离线输出合同回归纳入系统边界。
- **怎么做用户隔离**：后端从 JWT principal 获取 `user_id`，settings/history 查询都按当前用户过滤，客户端不能传入任意用户 ID 访问数据。
- **怎么处理 AI 失败**：provider failure 被映射为分类、HTTP 状态、retryable 标记和用户消息，SSE 错误事件不会被前端误当成成功结果。
- **怎么处理公开内容风险**：内容包要求 manifest、许可证、来源策略和审查状态，校验器阻止真实试题、私有语料和旧本地痕迹进入公开 demo。
- **下一步如何演进**：可以继续加 token/cost/latency 观测、请求限流、eval 报告趋势、线上部署和更细的学习进度模型。

诚实限制：

- 当前没有公开生产部署和真实用户数据，不能在简历中写用户数、可用性或真实延迟指标。
- 离线 eval 只校验输出结构和基本可用性，不代表真实模型评分准确率。
- SQLite 适合本地开发和轻量 demo，生产多人高并发场景需要重新评估数据库和连接池策略。
- 当前 SSE 成功路径发送一个最终事件，不是完整 token-by-token 流式输出。

## 维护说明

- 仓库只保留本文件作为唯一 `README.md` 入口，避免多个 README 内容分叉。
- 后端依赖升级通过 `backend/pom.xml` 管理，升级后运行 `.\mvnw.cmd test` 或 `./mvnw test`。
- API 合同需要保持与 `frontend/src/utils/apiClient.ts` 兼容，尤其是 `/api/v1/...` 路径、Bearer token、snake_case 字段和 `contentFormat` 字段。
- 新增公开学习内容前，先运行内容包校验，确认没有缺失来源声明、未知许可证、私有路径或旧内容痕迹。
- 确需新增长期文档时再创建 `docs/`，并从本 README 链接；临时调研和阶段报告默认不入库。

## 本地验收

1. 按「快速开始」启动前后端（后端 `:8001`、前端 `:5173`）。
2. 访问 `http://localhost:5173`，注册新账号并自动登录。
3. 打开 `/app/settings`，保存自己的模型 base URL、模型名、JSON 兜底和 API key。
4. 用当前登录账号的 Bearer token 调用 `GET /api/v1/writings/ai-status`，确认只返回当前账号的非秘密状态。
5. 打开 `/app/writing`，提交一篇样例写作并生成评分。
6. 打开 `/app/history`，确认只看到当前账号的记录并可查看详情。
7. 退出登录后再访问 `/app/writing`、`/app/history` 和 `/app/settings`，应回到登录流程。

**最后更新**：2026-06-10
