# 智考公考伴侣 - AI驱动的申论批改平台

一个基于AI的公务员考试申论批改平台，提供智能评分、详细反馈和个性化改进建议。

## ✨ 核心功能

- **AI申论批改**: 双阶段智能评分，支持概括题、综合分析题、对策题、应用文写作题
- **题型自动识别**: 增强版AI题型识别，支持推理模型，准确率显著提升
- **专业诊断**: 基于《申论四大题型核心秘籍》的专业批改，内容纯净无prompt泄漏
- **详细反馈**: 评分细则、具体建议和改写示例，智能过滤通用建议
- **实时进度**: 渐进式评分显示，50%诊断 + 100%完整评价
- **用户友好**: 自动清理AI内部指令，确保界面内容专业简洁

## 🚀 快速开始

### 一键启动开发环境

在项目根目录运行以下命令：

```powershell
# 推荐：动态端口分配（自动处理端口占用）
.\dev-fullstack.ps1

# 固定端口开发（稀有端口，避免冲突）
D:\some\run-dev-rare-ports.ps1

# 自定义端口
D:\some\run-dev-rare-ports.ps1 -BackendPort 8004 -FrontendPort 3000
```

### 访问地址

启动后控制台会显示实际访问地址，通常为：
- **前端**: http://localhost:3000 (或动态分配端口)
- **后端API**: http://localhost:8001 (或动态分配端口)
- **API文档**: http://localhost:8001/docs

### 停止开发环境

```powershell
# 在启动窗口按 Ctrl+C 停止服务
# 或使用快速管理工具
.\quick-restart.bat stop
```

## 🏗️ 技术架构

### 前端
- **Next.js 15** + React 19 + TypeScript
- **Tailwind CSS v4** 现代化UI设计
- **Turbopack** 快速开发体验
- **动态端口管理** 自动检测和配置

### 后端  
- **FastAPI** + Python 3.10+
- **PostgreSQL** + SQLAlchemy + Alembic
- **OpenAI API** 双阶段智能批改，支持推理模型
- **申论四大题型核心秘籍** 专业评分标准
- **智能内容过滤** 自动清理prompt指令，确保用户界面纯净
- **增强题型识别** 改进的启发式算法，支持多种AI模型响应格式

### 开发环境
- **Docker** 容器化数据库
- **热重载** 前后端自动更新
- **智能端口管理** 自动处理端口占用
- **端口复用** 智能检测和复用已运行实例

## 📁 项目结构

```
├── dev-fullstack.ps1       # 动态端口全栈启动脚本
├── run-dev-rare-ports.ps1  # 固定端口启动脚本（稀有端口，完整路径：D:\some\run-dev-rare-ports.ps1）
├── quick-restart.bat       # 快速服务管理工具
├── backend/                # FastAPI后端
│   ├── app/               # 应用源码
│   │   ├── api/endpoints/ # API路由
│   │   ├── services/      # AI服务集成
│   │   ├── schemas/       # 数据模型
│   │   └── models/        # 数据库模型
│   ├── alembic/           # 数据库迁移
│   └── dev.ps1            # 后端开发脚本
├── frontend/              # Next.js前端
│   ├── src/app/           # 页面组件
│   ├── src/config/        # API配置
│   ├── start-server.js    # 自定义服务器启动器
│   └── package.json       # 依赖配置
├── tools/                 # 工具脚本
│   ├── safe_cleanup.py    # 安全清理工具
│   └── restore_from_trash.py # 文件恢复工具
└── 申论四大题型核心秘籍.md  # 专业评分标准文档
```

## 🔧 开发指南

### 环境要求
- Python 3.10+
- Node.js 18+
- Docker (可选，用于数据库)

### 配置说明
1. 在 `backend` 目录创建 `.env` 文件：
```env
OPENAI_API_KEY=你的OpenAI密钥
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4o-mini
```

2. 启动开发环境：
```powershell
# 动态端口（推荐）
.\dev-fullstack.ps1

# 固定端口（避免冲突）
D:\some\run-dev-rare-ports.ps1
```

### API 接口
- `POST /api/v1/essays/grade` - 传统评分接口
- `POST /api/v1/essays/grade-progressive` - 渐进式评分接口
- `GET /api/v1/essays/ai-status` - AI服务状态检查

详细的开发指南和配置说明请参考 [CLAUDE.md](CLAUDE.md)。

## 📝 许可证

本项目采用 MIT 许可证。
