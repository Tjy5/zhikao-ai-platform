# 智考公考伴侣 - AI驱动的公考备考平台

一个智能化的公务员考试备考平台，提供AI申论批改、行测练习和个性化学习指导。

## ✨ 核心功能

- **AI申论批改**: 智能评分和详细反馈，支持概括题、综合分析题、对策题、应用文写作题
- **智能题库**: 海量行测题目，支持按模块和知识点练习
- **个性化学习**: 基于能力诊断的个性化学习计划
- **实时反馈**: 即时的解题分析和改进建议

## 🚀 快速开始

### 一键启动开发环境

双击运行以下脚本启动完整开发环境：

```bash
# Windows - 智能启动(自动处理端口占用)
smart-start.bat

# 跨平台 PowerShell
./dev-fullstack.ps1
```

### 访问地址

- **前端**: http://localhost:3000 (或自动分配端口)
- **后端API**: http://localhost:8001 (或自动分配端口) 
- **API文档**: http://localhost:8001/docs

### 停止开发环境

```bash
# 智能停止
smart-stop.bat

# 快速重载工具
quick-reload.bat [config|backend|frontend|cache|all|status]
```

## 🏗️ 技术架构

### 前端
- **Next.js 15** + React 19 + TypeScript
- **Tailwind CSS v4** 现代化UI设计
- **Turbopack** 快速开发体验

### 后端  
- **FastAPI** + Python 3.10+
- **PostgreSQL** + SQLAlchemy + Alembic
- **OpenAI API** 智能批改集成

### 开发环境
- **Docker** 容器化数据库
- **热重载** 前后端自动更新
- **智能端口管理** 自动处理端口占用

## 📁 项目结构

```
├── smart-start.bat         # 智能启动脚本
├── smart-stop.bat          # 智能停止脚本  
├── quick-reload.bat        # 快速重载工具
├── dev-fullstack.ps1       # PowerShell启动脚本
├── backend/                # FastAPI后端
│   ├── app/               # 应用源码
│   ├── alembic/           # 数据库迁移
│   └── dev.ps1            # 后端开发脚本
├── frontend/              # Next.js前端
│   ├── src/               # 源码目录
│   └── package.json       # 依赖配置
└── tools/                 # 工具脚本
    ├── safe_cleanup.py    # 安全清理工具
    └── restore_from_trash.py # 文件恢复工具
```

## 🔧 开发指南

详细的开发指南和配置说明请参考 [CLAUDE.md](CLAUDE.md)。

## 📝 许可证

本项目采用 MIT 许可证。
