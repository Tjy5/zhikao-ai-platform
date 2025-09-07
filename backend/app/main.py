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

# Configure CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
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