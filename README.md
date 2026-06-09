# 墨评AI - 写作反馈平台

墨评AI 是一个基于 React、Vite、Spring Boot 和 OpenAI-compatible LLM 的写作反馈应用。当前产品面聚焦注册/登录、提交写作作答、保存自己的模型设置、回看历史记录和校验公开内容包。

本仓库正在向可开源的公考学习平台核心演进。公开仓库不保存未授权题库、真题解析、培训资料或本地私有语料；知识点、原创练习和写作任务通过可审计的内容包机制逐步加入。

## 核心功能

- **首页**：展示墨评AI产品入口、写作反馈入口、历史记录入口和设置入口。
- **账号与设置**：注册/登录后保存每个账号自己的 OpenAI-compatible 模型配置，API key 加密保存并以脱敏状态返回。
- **写作反馈**：支持传统评分接口和渐进式 SSE 评分接口，生产请求需要登录并使用当前账号的模型设置。
- **历史记录**：保存当前账号的批改请求与结果，支持列表、筛选、详情和清空。
- **AI 状态检查**：展示当前账号的非秘密 LLM 配置状态，不暴露用户 provider API key。
- **内容治理**：通过内容包 manifest、来源声明、许可证声明和 Java 后端校验器管理公开示例内容。

## 快速开始

```powershell
.\run-dev-rare-ports.ps1
```

默认端口是：

- 前端：`http://localhost:65124`
- 后端 API：`http://localhost:65123`
- 健康检查：`http://localhost:65123/health`

指定常用端口：

```powershell
.\run-dev-rare-ports.ps1 -BackendPort 8001 -FrontendPort 3000
```

根启动脚本会运行 Java 后端测试，启动 Spring Boot 后端，再启动 Vite 前端。前端 API 地址通过 `frontend/.env.local` 写入 `VITE_API_URL`。

## 技术栈

- 前端：React 19、Vite、TypeScript、React Router、Tailwind CSS。
- 后端：Java 21、Spring Boot 3.5、Spring Security、Spring JDBC、Flyway、SQLite、Xerial SQLite JDBC、Auth0 Java JWT。
- AI provider：小型 OpenAI-compatible HTTP wrapper，支持 `/chat/completions` 和 `/models`。
- 测试：Vitest、Testing Library、JUnit 5、Spring Boot Test、MockMvc。

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
│   └── src/test/java/         # JUnit / MockMvc 回归测试
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
cd backend
.\mvnw.cmd test

# 后端开发启动
cd backend
.\dev.ps1 -Port 8001

# 后端打包
cd backend
.\mvnw.cmd package

# 内容包校验
cd backend
.\mvnw.cmd -q '-DskipTests' 'exec:java' '-Dexec.args=..\content-samples'
```

```bash
# 后端测试
cd backend
./mvnw test

# 后端开发启动
cd backend
./dev.sh

# 后端打包
cd backend
./mvnw package

# 内容包校验
cd backend
./mvnw -q -DskipTests exec:java -Dexec.args="../content-samples"
```

```bash
# 前端
cd frontend
npm install
npm run dev
npm run test
npm run build
```

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

## 维护说明

- 仓库只保留本文件作为唯一 `README.md` 入口，避免多个 README 内容分叉。
- 后端依赖升级通过 `backend/pom.xml` 管理，升级后运行 `.\mvnw.cmd test` 或 `./mvnw test`。
- API 合同需要保持与 `frontend/src/utils/apiClient.ts` 兼容，尤其是 `/api/v1/...` 路径、Bearer token、snake_case 字段和 `contentFormat` 字段。
- 新增公开学习内容前，先运行内容包校验，确认没有缺失来源声明、未知许可证、私有路径或旧内容痕迹。
- 确需新增长期文档时再创建 `docs/`，并从本 README 链接；临时调研和阶段报告默认不入库。

## 本地验收

1. 运行 `.\run-dev-rare-ports.ps1 -BackendPort 8001 -FrontendPort 3000` 启动前后端。
2. 注册新账号并登录。
3. 打开 `/settings`，保存自己的模型 base URL、模型名、JSON 兜底和 API key。
4. 用当前登录账号的 Bearer token 调用 `GET /api/v1/writings/ai-status`，确认只返回当前账号的非秘密状态。
5. 打开 `/writing`，提交一篇样例写作并生成评分。
6. 打开 `/history`，确认只看到当前账号的记录并可查看详情。
7. 退出登录后再访问 `/writing`、`/history` 和 `/settings`，应回到登录流程。

**最后更新**：2026-06-09
