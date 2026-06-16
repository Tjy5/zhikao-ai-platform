# Security Policy

本项目是一个 AI 公考学习平台核心仓库。公开仓库不应包含真实 provider API key、JWT、数据库备份、用户数据、私有内容包或未授权学习材料。

## Supported Versions

当前仅维护默认分支 `main`。安全修复会优先落到 `main`；历史分支和本地实验分支不承诺单独维护。

## Reporting a Vulnerability

请不要在公开 issue、discussion、PR 评论、截图或日志中披露可复现攻击细节、真实密钥、用户数据或数据库内容。

优先使用 GitHub 的 private vulnerability reporting 或 repository security advisory 流程提交报告。如果该入口不可用，请先通过 GitHub 联系维护者 `Tjy5` 建立私密沟通渠道，再发送完整细节。

报告中请尽量包含：

- 受影响的 commit、分支、文件路径、API endpoint 或页面。
- 最小复现步骤和预期影响。
- 是否涉及认证绕过、权限提升、用户数据、provider API key、JWT、数据库、CORS、SSE 或管理后台。
- 你已经采取的避免扩大影响的措施，例如没有公开 PoC、没有访问不属于你的数据、没有保存真实密钥。

## In Scope

- 登录、注册、JWT 签发和校验。
- 用户级 AI provider 设置、API key 加密保存和脱敏返回。
- 写作批改、SSE 批改、历史记录、用户隔离和权限边界。
- 管理员权限、内容审核、学习内容版本管理和回滚。
- CORS、配置默认值、生产密钥要求和部署安全边界。
- 仓库内容治理，包括未授权题库、私有语料或敏感文件误提交。

## Out of Scope

- 没有可利用路径的纯依赖版本建议。
- 本地开发数据库 `dev.db` 中由开发者自行写入的数据。
- 使用者把真实密钥写入本地 `.env`、浏览器存储、截图或第三方平台造成的泄漏。
- AI 评分质量、提示词偏好或内容表达争议，除非它们导致明确安全或隐私问题。

## Secrets And Test Data

- 不要提交真实 `OPENAI_API_KEY`、OpenAI-compatible provider key、JWT、数据库文件、生产 `APP_SECRET_KEY` 或 `MODEL_SETTINGS_ENCRYPTION_KEY`。
- 示例密钥必须保持明显的 fake/dev-only 语义。
- 测试应使用 fake provider、fixture 或离线回归，不应访问真实外部 LLM 服务。
- 如果发现真实 secret 已进入 Git 历史，请先撤销或轮换该 secret，再清理仓库历史并强推受影响分支。
