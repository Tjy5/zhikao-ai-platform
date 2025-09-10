from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import logging
from app.api.endpoints import essay

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application instance
app = FastAPI(
    title="AI Public Exam Platform",
    description="AI Public Exam Platform Backend API",
    version="1.0.0"
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    全局异常处理器，捕获所有未处理的异常并返回详细错误信息
    """
    error_details = {
        "error": str(exc),
        "error_type": type(exc).__name__,
        "traceback": traceback.format_exc(),
        "request_url": str(request.url),
        "request_method": request.method
    }
    
    # 记录错误日志
    logger.error(f"Unhandled exception: {error_details}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "内部服务器错误",
            "error_info": error_details
        }
    )

import os
from pathlib import Path

def get_cors_origins():
    """Get CORS origins dynamically based on frontend port"""
    origins = [
        "http://localhost:3000",  # Default frontend port
        "http://127.0.0.1:3000",
    ]
    
    # Try to read frontend port from file
    try:
        frontend_port_file = Path(__file__).parent.parent.parent / "frontend_port.txt"
        if frontend_port_file.exists():
            frontend_port = frontend_port_file.read_text().strip()
            origins.extend([
                f"http://localhost:{frontend_port}",
                f"http://127.0.0.1:{frontend_port}",
            ])
    except Exception:
        pass
    
    # Add common development ports for localhost
    for port in range(3000, 3010):
        origins.extend([
            f"http://localhost:{port}",
            f"http://127.0.0.1:{port}",
        ])
    
    # Add support for local network IP address
    import socket
    try:
        # Get local IP address
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        # Add local IP origins for common frontend ports
        for port in [3000, 3001, 3002, 3003]:
            origins.append(f"http://{local_ip}:{port}")
    except Exception:
        pass
    
    return list(set(origins))  # Remove duplicates

# Configure CORS middleware with dynamic origins
cors_origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include essay grading API routes
app.include_router(essay.router, prefix="/api/v1", tags=["essay"])

# Root path health check
@app.get("/")
async def root():
    return {"message": "AI Public Exam Platform Backend API is running"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Configuration reload endpoint (development only)
@app.post("/reload-config")
async def reload_config():
    """重载配置文件（仅开发环境使用）"""
    try:
        from app.core.config import settings
        settings.reload()
        return {"status": "success", "message": "配置已重载"}
    except Exception as e:
        return {"status": "error", "message": f"重载失败: {str(e)}"}