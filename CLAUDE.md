# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered public examination platform (智考公考伴侣) that provides intelligent essay grading for Chinese civil service exam preparation. The system consists of:

- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwindcss v4
- **Backend**: FastAPI with Python 3.10+, PostgreSQL, SQLAlchemy, and Alembic
- **Architecture**: Microservices with containerized deployment using Docker

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                   # Start development server with turbopack
npm run build                 # Build for production with turbopack  
npm run start                 # Start production server
npm run lint                  # Run ESLint
```

### Backend (FastAPI)
```bash
cd backend
# One-click development (recommended) - handles venv, deps, DB, migrations
npm run dev                   # Windows PowerShell (auto-setup everything)
npm run dev:sh                # Unix/bash (auto-setup everything)

# Manual development setup
python -m venv .venv          # Create virtual environment
.venv\Scripts\activate        # Activate venv (Windows)
pip install -r requirements.txt # Install dependencies
uvicorn app.main:app --reload --port 8001 # Start development server
pytest                       # Run tests
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
- `app/db/` - Database configuration and connection management
- `app/crud/` - Database operations layer
- `app/core/` - Core configuration and utilities
- `alembic/` - Database migration files

### Frontend Structure
- `src/app/` - Next.js App Router pages and layouts
- `src/app/page.tsx` - Main essay grading interface
- Uses client-side form handling for essay submission
- Integrates with backend API at `http://localhost:8001/api/v1/`
- Runs on `http://localhost:3000` in development

### Development Environment
- **Frontend**: Next.js dev server on port 3000 (turbopack enabled)
- **Backend**: FastAPI with auto-reload on port 8001
- **Database**: PostgreSQL on port 5432 (via Docker)
- **One-click setup**: Backend dev scripts handle complete environment setup

### Key Features
- **Essay Grading**: AI-powered analysis of Chinese civil service exam essays
- **Question Types**: Supports 概括题, 综合分析题, 对策题, 应用文写作题
- **Real-time Feedback**: Provides scoring, detailed feedback, and improvement suggestions
- **Responsive UI**: Modern interface built with Tailwind CSS

### API Endpoints
- `POST /api/v1/essays/grade` - Submit essay for AI grading
- `GET /api/v1/essays/ai-status` - Check AI service status
- `GET /health` - Health check endpoint

## Development Notes

- Backend uses automatic API documentation via FastAPI (available at `http://localhost:8001/docs`)
- Frontend uses Next.js App Router with TypeScript
- Database migrations managed through Alembic
- AI essay grading service integrates with OpenAI API
- CORS is configured to allow all origins for development
- Global exception handling provides detailed error information
- Project includes Chinese documentation in markdown files

### Development Workflow
1. **Backend**: Use `npm run dev` in `backend/` directory for complete auto-setup
   - Automatically creates Python virtual environment
   - Installs all dependencies
   - Starts PostgreSQL via Docker Compose
   - Applies database migrations
   - Starts FastAPI server with hot reload
2. **Frontend**: Use `npm run dev` in `frontend/` directory for Next.js development
3. **Database**: Managed automatically by backend dev script or manually via `docker-compose up -d db`

### Testing
- Backend tests can be run with `pytest` from the `backend/` directory
- Multiple test files exist for various components and integration testing

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.