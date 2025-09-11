# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered public examination platform (智考公考伴侣) that provides intelligent essay grading for Chinese civil service exam preparation. The system features enhanced AI integration with reasoning model support, improved question type recognition, and intelligent content filtering for optimal user experience.

- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwindcss v4
- **Backend**: FastAPI with Python 3.10+, PostgreSQL, SQLAlchemy, and Alembic
- **AI Integration**: Enhanced OpenAI integration with support for reasoning models and robust fallback mechanisms
- **Architecture**: Microservices with containerized deployment using Docker

## Development Commands

### 🚀 Quick Start (Recommended)

#### Full Stack Development (One Command)
```powershell
# Start both frontend and backend with dynamic port allocation
.\dev-fullstack.ps1

# Features:
# - Automatic port conflict resolution
# - Real-time service status monitoring  
# - Displays actual service URLs
# - Safe shutdown with Ctrl+C
# - Won't interfere with other applications

# Fixed Port Development (with reuse functionality)
.\run-dev-rare-ports.ps1

# Features:
# - Fixed rare ports (backend: 65123, frontend: 65124) to avoid conflicts
# - Automatic reuse of existing services if ports are occupied
# - No "port already in use" errors - intelligently reuses running instances
# - Writes port files for other tools to read
# - Custom port support: -BackendPort 8004 -FrontendPort 3000
# - Skip database: -NoDB
```

#### Development Management Scripts
```bash
# Quick operations and status checks
quick-restart.bat status       # Check service status
quick-restart.bat start        # Start both services
quick-restart.bat restart      # Restart services
quick-restart.bat stop         # Quick stop
quick-restart.bat safe-stop    # Safe stop with confirmation

# Features:
# - Dynamic port support (reads from backend_port.txt/frontend_port.txt)
# - Precise process termination (no accidental kills)
# - Service status monitoring
# - Safe confirmation prompts
```

### Frontend (Next.js)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                   # Start development server with turbopack (dynamic port)
npm run build                 # Build for production with turbopack  
npm run start                 # Start production server
npm run lint                  # Run ESLint
```

### Backend (FastAPI)
```bash
cd backend
# One-click development (recommended) - handles venv, deps, DB, migrations
.\dev.ps1                     # Windows PowerShell (auto-setup + dynamic port)

# Manual development setup
python -m venv .venv          # Create virtual environment
.venv\Scripts\activate        # Activate venv (Windows)
pip install -r requirements.txt # Install dependencies
uvicorn app.main:app --reload --port 8001 # Start development server
pytest                       # Run all tests
pytest -v                    # Run tests with verbose output
pytest tests/test_specific.py # Run specific test file
```

### Database
```bash
cd backend
alembic revision --autogenerate -m "description" # Generate migration
alembic upgrade head          # Apply migrations
```

### Docker
```bash
docker-compose up -d db      # Start PostgreSQL database (detached)
docker-compose up            # Start all services
```

### Database Connection
- **Host**: localhost:5432
- **Database**: mydb
- **Username**: myuser
- **Password**: mypassword

## Architecture

### Backend Structure
- `app/main.py` - FastAPI application entry point with CORS and global exception handling
- `app/api/endpoints/` - API route handlers
- `app/schemas/` - Pydantic models for request/response validation
- `app/models/` - SQLAlchemy database models
- `app/services/` - Business logic and AI service integration
  - `ai_service.py` - Enhanced OpenAI integration with reasoning model support, improved question type recognition, and intelligent content filtering
  - `prompt_service.py` - Prompt template management with essay grading manual
  - `prompt_service_simple.py` - Simplified prompt service for question type dimensions with clean output
- `app/db/` - Database configuration and connection management
- `app/core/` - Core configuration and utilities
- `alembic/` - Database migration files
- `dev.ps1` / `dev.sh` - One-click development setup scripts

### Frontend Structure
- `src/app/` - Next.js App Router pages and layouts
- `src/app/page.tsx` - Main essay grading interface with progress tracking
- `src/config/api.ts` - Dynamic API configuration (auto-generated)
- `start-server.js` - Custom server launcher with port detection
- Uses client-side form handling for essay submission
- Dynamically integrates with backend API (reads from `backend_port.txt`)
- Runs on dynamic ports starting from 3000 in development

### Development Environment
- **Frontend**: Next.js dev server with dynamic port allocation (starts from port 3000)
- **Backend**: FastAPI with dynamic port allocation (starts from port 8001) 
- **Database**: PostgreSQL on port 5432 (via Docker)
- **Port Management**: 
  - Services automatically find free ports if defaults are occupied
  - Port information saved to `backend_port.txt` and `frontend_port.txt`
  - Scripts read actual ports from these files for accurate operations
- **One-click setup**: `dev-fullstack.ps1` handles complete environment setup
- **Fixed Port Development**: `run-dev-rare-ports.ps1` uses rare ports (65123/65124) with intelligent reuse

### Key Features
- **Essay Grading**: AI-powered analysis of Chinese civil service exam essays
- **Question Types**: Supports 概括题, 综合分析题, 对策题, 应用文写作题
- **Real-time Feedback**: Provides scoring, detailed feedback, and improvement suggestions
- **Responsive UI**: Modern interface built with Tailwind CSS

### Recent Enhancements (Latest Update)

#### AI Service Improvements
- **Reasoning Model Support**: Enhanced `ai_service.py` to handle reasoning models (e.g., `openai/gpt-oss-120b`) that store responses in `reasoning_content` field
- **Question Type Recognition**: Fixed operator precedence bug and improved heuristic logic for accurate question type identification
- **Content Filtering**: Implemented intelligent prompt instruction filtering to ensure clean, user-friendly interface without internal AI prompts
- **Fallback Mechanisms**: Added robust error handling with heuristic fallbacks when AI services fail

#### User Experience Enhancements  
- **Clean Interface**: Automatic removal of AI internal instructions like "作为资深申论阅卷专家'悟道'" from user-facing content
- **Smart Suggestions**: Optimized improvement suggestions logic to avoid generic recommendations when specific feedback is available
- **Consistent Scoring**: Improved score consistency between overall score and detailed scoring rubrics
- **Error Resilience**: Enhanced service stability with better 403 error handling and service recovery

#### Technical Improvements
- **Token Management**: Increased token limits from 50 to 200 to prevent response truncation  
- **Response Parsing**: Added `extract_answer_from_reasoning()` function for parsing reasoning model outputs
- **Content Cleaning**: Enhanced `clean_ai_thinking_patterns()` with multiple prompt leakage detection patterns
- **Exception Handling**: Improved fallback logic in exception scenarios to maintain service availability

### API Endpoints
- `POST /api/v1/essays/grade` - Submit essay for AI grading (traditional single response)
- `POST /api/v1/essays/grade-progressive` - Submit essay for progressive AI grading (streaming response)
- `GET /api/v1/essays/ai-status` - Check AI service status and configuration
- `GET /health` - Health check endpoint
- `GET /` - Root endpoint with service status
- `POST /reload-config` - Reload configuration (development only)

## Development Notes

- Backend uses automatic API documentation via FastAPI (available at `http://localhost:<backend_port>/docs`)
- Frontend uses Next.js App Router with TypeScript and Tailwind CSS v4
- Database migrations managed through Alembic
- AI essay grading service integrates with OpenAI API using dual-stage diagnosis
- CORS is configured to dynamically allow frontend origins based on port files
- Global exception handling provides detailed error information in Chinese
- Project includes Chinese documentation in markdown files
- Frontend uses custom `start-server.js` for dynamic port allocation
- Backend supports both traditional and progressive (streaming) essay grading

### AI Service Implementation Details

#### Question Type Recognition (`ai_service.py`)
- **Dual Recognition**: Combines AI-based recognition with heuristic fallback for reliability
- **Operator Precedence Fix**: Corrected logic bug that caused comprehensive analysis questions to be misidentified as summary questions
- **Enhanced Keywords**: Expanded keyword detection for comprehensive analysis questions (分析, 理解, 谈谈, 评价, 说明, 如何, 为什么, 关系, 作用, 意义, 影响, 原因)
- **Multi-layer Requirements**: Detects complex question patterns requiring both explanation and analysis

#### Reasoning Model Support
- **Content Field Handling**: Processes both `content` and `reasoning_content` response fields
- **Token Management**: Increased limits to accommodate reasoning model response patterns
- **Answer Extraction**: Implements `extract_answer_from_reasoning()` for parsing reasoning model outputs
- **Fallback Logic**: Graceful degradation when reasoning models return empty content fields

#### Content Filtering System
- **Prompt Leakage Prevention**: Removes internal AI instructions from user-facing content using regex patterns
- **Multiple Pattern Detection**: Handles various forms of prompt instruction leakage
- **User-friendly Output**: Ensures clean, professional interface without exposing AI internal prompts
- **Suggestion Optimization**: Replaces generic suggestions with specific, actionable feedback when available

### Development Workflow

#### 🌟 Recommended: One-Click Full Stack Development
1. **Start Everything**: Run `.\dev-fullstack.ps1`
   - Automatically starts backend (with venv, deps, DB, migrations)
   - Automatically starts frontend with turbopack
   - Finds free ports if defaults are occupied
   - Displays actual service URLs when ready
   - Monitors service health continuously

2. **Fixed Port Development**: Run `.\run-dev-rare-ports.ps1`
   - Uses rare ports (backend: 65123, frontend: 65124) to avoid conflicts
   - Intelligently reuses existing services if ports are occupied
   - No "port already in use" errors - automatically detects and reuses running instances
   - Custom port support: `-BackendPort 8004 -FrontendPort 3000`
   - Skip database: `-NoDB`
   - Perfect for multiple development sessions without port conflicts

#### Alternative: Individual Service Management  
1. **Backend**: Use `.\dev.ps1` in `backend/` directory for complete auto-setup
   - Automatically creates Python virtual environment
   - Installs all dependencies
   - Starts PostgreSQL via Docker Compose
   - Applies database migrations
   - Starts FastAPI server with hot reload on available port
2. **Frontend**: Use `npm run dev` in `frontend/` directory for Next.js development
   - Automatically finds available port starting from 3000
   - Updates API configuration to match backend port
3. **Database**: Managed automatically by backend dev script or manually via `docker-compose up -d db`

#### 🛠️ Development Operations
- **Status Check**: `quick-restart.bat status` - See all running services
- **Quick Restart**: `quick-restart.bat restart` - Restart both services  
- **Safe Shutdown**: `quick-restart.bat safe-stop` - Stop with confirmation
- **Port Conflicts**: All scripts automatically handle port conflicts

### Testing
- Backend tests can be run with `pytest` from the `backend/` directory
- Use `pytest -v` for verbose test output
- Run specific tests with `pytest tests/test_filename.py`
- Multiple test files exist for various components and integration testing

### Utility Tools
- `tools/safe_cleanup.py` - Safely move unwanted files to .trash folder based on cleanup_candidates.txt
- `tools/restore_from_trash.py` - Restore files from .trash folder  
- Backend generates log files: `backend.log`, `backend_debug.log`, `backend_final.log`, etc.
- `quick-restart.bat` - Quick service management (start/stop/restart/status)

### 🔧 Development Scripts Features

#### `dev-fullstack.ps1` - Full Stack Management
- **Safe Operation**: Won't interfere with Claude Code or other applications
- **Dynamic Ports**: Automatically resolves port conflicts
- **Health Monitoring**: Continuous service status monitoring
- **Clean Shutdown**: Proper cleanup when stopped with Ctrl+C
- **Informative Output**: Shows actual service URLs and status

#### `run-dev-rare-ports.ps1` - Fixed Port Development with Reuse
- **Rare Ports**: Uses uncommon ports (65123/65124) to avoid conflicts with other applications
- **Intelligent Reuse**: Automatically detects and reuses existing services if ports are occupied
- **No Port Conflicts**: Never shows "port already in use" errors - intelligently reuses running instances
- **Custom Ports**: Support for `-BackendPort` and `-FrontendPort` parameters
- **Database Control**: `-NoDB` flag to skip PostgreSQL startup
- **Port File Management**: Writes `backend_port.txt` and `frontend_port.txt` for other tools
- **Perfect for Multiple Sessions**: Ideal when running multiple development environments simultaneously

#### `quick-restart.bat` - Quick Operations
- **Precise Termination**: Only stops development servers (port-based targeting)
- **Dynamic Port Aware**: Reads actual ports from generated files
- **Safety Features**: `safe-stop` command with confirmation prompts
- **Status Monitoring**: Real-time service health checks
- **No Accidental Kills**: Won't terminate Claude Code or other important processes

#### Port Management System
- **Backend Port**: Saved to `backend_port.txt` (starts from 8001)
- **Frontend Port**: Saved to `frontend_port.txt` (starts from 3000)  
- **Automatic Detection**: Scripts read actual ports for accurate operations
- **Conflict Resolution**: Services automatically find available ports
- **Clean Shutdown**: Port files cleaned up when services stop

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.