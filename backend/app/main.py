from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import logging
from app.api.endpoints import auth, writing, settings as settings_routes
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application instance
app = FastAPI(
    title="AI Writing Feedback Platform",
    description="AI Writing Feedback Platform Backend API",
    version="1.0.0"
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler.
    In production (DEBUG=False) returns a generic sanitized payload.
    In debug mode may include diagnostic details.
    """
    error_details = {
        "error": str(exc),
        "error_type": type(exc).__name__,
        "traceback": traceback.format_exc(),
        "request_url": str(request.url),
        "request_method": request.method,
    }

    # Always log full diagnostics server-side
    logger.error(f"Unhandled exception: {error_details}")

    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={
                "detail": "内部服务器错误",
                "error_info": error_details,
            },
        )

    return JSONResponse(
        status_code=500,
        content={"detail": "内部服务器错误"},
    )

from pathlib import Path

def get_cors_origins():
    """Get CORS origins from settings, with optional port-file override."""
    from app.core.config import settings
    origins = list(settings.BACKEND_CORS_ORIGINS)

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

    return list(set(origins))


def get_cors_origin_regex():
    """Allow dynamic local dev ports only when debug mode is enabled."""
    from app.core.config import settings

    if settings.DEBUG:
        return r"^http://(localhost|127\.0\.0\.1):\d+$"

    return None


# Configure CORS middleware
origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include writing grading API routes
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(writing.router, prefix="/api/v1", tags=["writing"])
app.include_router(settings_routes.router, prefix="/api/v1", tags=["settings"])

@app.get("/")
async def root():
    return {"status": "ok", "service": "writing-feedback-backend"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Configuration reload endpoint (development only)
@app.post("/reload-config")
async def reload_config():
    """重载配置文件（仅开发环境使用）"""
    if not settings.DEBUG:
        raise HTTPException(status_code=403, detail="此端点仅在 DEBUG 模式下可用")
    try:
        settings.reload()
        return {"status": "success", "message": "配置已重载"}
    except Exception as e:
        return {"status": "error", "message": f"重载失败: {str(e)}"}
