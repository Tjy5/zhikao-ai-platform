"""
自定义异常类模块
定义业务逻辑相关的异常类型
"""

from typing import Any, Dict, Optional


class BaseCustomException(Exception):
    """自定义异常基类"""
    
    def __init__(
        self, 
        message: str, 
        code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)
    
    def __str__(self) -> str:
        return self.message
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details
        }


class ValidationException(BaseCustomException):
    """数据验证异常"""
    pass


class BusinessException(BaseCustomException):
    """业务逻辑异常"""
    pass


class AIServiceException(BaseCustomException):
    """AI服务异常"""
    pass


class DatabaseException(BaseCustomException):
    """数据库异常"""
    pass


class ConfigurationException(BaseCustomException):
    """配置异常"""
    pass


class RateLimitException(BaseCustomException):
    """频率限制异常"""
    pass


class AuthenticationException(BaseCustomException):
    """认证异常"""
    pass


class AuthorizationException(BaseCustomException):
    """授权异常"""
    pass


class NotFoundException(BaseCustomException):
    """资源未找到异常"""
    pass


class FileProcessingException(BaseCustomException):
    """文件处理异常"""
    pass


class NetworkException(BaseCustomException):
    """网络异常"""
    pass


# ===== 异常处理装饰器 =====

import functools
import logging
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar('F', bound=Callable[..., Any])


def handle_service_exceptions(fallback_value: Any = None) -> Callable[[F], F]:
    """
    服务异常处理装饰器
    
    Args:
        fallback_value: 发生异常时的回退值
    
    Returns:
        装饰器函数
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except BaseCustomException as e:
                logger.error(f"业务异常 in {func.__name__}: {e.message}", extra=e.details)
                if fallback_value is not None:
                    return fallback_value
                raise
            except Exception as e:
                logger.error(f"未知异常 in {func.__name__}: {str(e)}")
                if fallback_value is not None:
                    return fallback_value
                raise BaseCustomException(f"服务异常: {str(e)}")
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except BaseCustomException as e:
                logger.error(f"业务异常 in {func.__name__}: {e.message}", extra=e.details)
                if fallback_value is not None:
                    return fallback_value
                raise
            except Exception as e:
                logger.error(f"未知异常 in {func.__name__}: {str(e)}")
                if fallback_value is not None:
                    return fallback_value
                raise BaseCustomException(f"服务异常: {str(e)}")
        
        # 根据函数类型返回对应的wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def handle_database_exceptions(func: F) -> F:
    """数据库异常处理装饰器"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"数据库异常 in {func.__name__}: {str(e)}")
            raise DatabaseException(f"数据库操作失败: {str(e)}")
    return wrapper


import asyncio


