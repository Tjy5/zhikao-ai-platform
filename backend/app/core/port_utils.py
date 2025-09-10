"""
Port utilities for dynamic port allocation
"""
import socket
from contextlib import closing
import logging

logger = logging.getLogger(__name__)

def find_free_port(start_port: int = 8001, max_attempts: int = 100) -> int:
    """
    Find a free port starting from start_port
    
    Args:
        start_port: Starting port to check
        max_attempts: Maximum number of ports to check
        
    Returns:
        Free port number
        
    Raises:
        RuntimeError: If no free port found within max_attempts
    """
    for port in range(start_port, start_port + max_attempts):
        try:
            with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
                sock.bind(('localhost', port))
                sock.listen(1)
                logger.info(f"Found free port: {port}")
                return port
        except OSError:
            continue
    
    raise RuntimeError(f"No free port found in range {start_port}-{start_port + max_attempts - 1}")

def is_port_in_use(port: int, host: str = 'localhost') -> bool:
    """
    Check if a port is in use
    
    Args:
        port: Port number to check
        host: Host to check (default: localhost)
        
    Returns:
        True if port is in use, False otherwise
    """
    try:
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            return result == 0
    except Exception:
        return False