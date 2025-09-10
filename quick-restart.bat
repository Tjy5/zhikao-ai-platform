@echo off
chcp 65001 >nul

echo 🔄 智考AI开发环境管理器
echo ========================

:: 检查参数，默认为restart
if "%1"=="" goto restart_all

if "%1"=="start" goto start_all
if "%1"=="restart" goto restart_all  
if "%1"=="stop" goto stop_all
if "%1"=="safe-stop" goto safe_stop_all
if "%1"=="status" goto show_status
if "%1"=="help" goto usage
goto usage

:start_all
echo 🚀 启动开发环境...
cd /d "%~dp0backend"
start "Backend" cmd /k "npm run dev"
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npm run dev"
echo ✅ 开发环境已启动
goto show_info

:restart_all
echo 🔄 重启开发环境...
echo 🛑 停止现有进程...
call :stop_dev_servers
echo 🚀 重新启动...
cd /d "%~dp0backend"
start "Backend" cmd /k "npm run dev"
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npm run dev"
echo ✅ 开发环境已重启
goto show_info

:stop_all
echo 🛑 停止开发环境...
call :stop_dev_servers
echo ✅ 已停止所有服务
goto end

:safe_stop_all
echo ⚠️  安全停止模式
echo.
echo 📊 当前运行的服务:

:: 获取动态端口或使用默认端口
set BACKEND_PORT=8001
set FRONTEND_PORT=3000

if exist "backend_port.txt" (
    for /f "delims=" %%i in (backend_port.txt) do set BACKEND_PORT=%%i
)
if exist "frontend_port.txt" (
    for /f "delims=" %%i in (frontend_port.txt) do set FRONTEND_PORT=%%i
)

:: 显示将要停止的服务
netstat -ano | findstr ":%BACKEND_PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ 后端服务 - 端口 %BACKEND_PORT%
) else (
    echo   ❌ 后端服务未运行
)

netstat -ano | findstr ":%FRONTEND_PORT%" | findstr "LISTENING" >nul 2>&1  
if %errorlevel% equ 0 (
    echo   ✅ 前端服务 - 端口 %FRONTEND_PORT%
) else (
    echo   ❌ 前端服务未运行
)

echo.
echo 🚨 确定要停止这些服务吗? (y/N)
set /p "choice=请选择: "
if /i "%choice%"=="y" (
    call :stop_dev_servers
    echo ✅ 已停止所有服务
) else (
    echo ℹ️  操作已取消
)
goto end

:stop_dev_servers
echo 🔍 查找开发服务器进程...

:: 获取动态端口或使用默认端口
set BACKEND_PORT=8001
set FRONTEND_PORT=3000

:: 尝试从端口文件读取实际端口
if exist "backend_port.txt" (
    for /f "delims=" %%i in (backend_port.txt) do set BACKEND_PORT=%%i
)
if exist "frontend_port.txt" (
    for /f "delims=" %%i in (frontend_port.txt) do set FRONTEND_PORT=%%i
)

:: 安全终止后端服务进程
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%" ^| findstr "LISTENING"') do (
    echo 🛑 终止后端服务 (PID: %%p, Port: %BACKEND_PORT%)
    taskkill /pid %%p /f >nul 2>&1
)

:: 安全终止前端服务进程  
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%FRONTEND_PORT%" ^| findstr "LISTENING"') do (
    echo 🛑 终止前端服务 (PID: %%p, Port: %FRONTEND_PORT%)
    taskkill /pid %%p /f >nul 2>&1
)

:: 清理端口文件
if exist "backend_port.txt" del "backend_port.txt" >nul 2>&1
if exist "frontend_port.txt" del "frontend_port.txt" >nul 2>&1

goto :eof

:show_status
echo 📊 检查服务状态...

:: 获取动态端口或使用默认端口
set BACKEND_PORT=8001
set FRONTEND_PORT=3000

if exist "backend_port.txt" (
    for /f "delims=" %%i in (backend_port.txt) do set BACKEND_PORT=%%i
)
if exist "frontend_port.txt" (
    for /f "delims=" %%i in (frontend_port.txt) do set FRONTEND_PORT=%%i
)

curl -s http://localhost:%BACKEND_PORT%/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 后端服务正常 (http://localhost:%BACKEND_PORT%)
) else (
    echo ❌ 后端服务未运行
)

curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1  
if %errorlevel% equ 0 (
    echo ✅ 前端服务正常 (http://localhost:%FRONTEND_PORT%)
) else (
    echo ❌ 前端服务未运行
)
goto end

:usage
echo 使用方法:
echo   quick-restart.bat ^<command^>
echo.
echo 命令:
echo   start      - 启动开发环境
echo   restart    - 重启开发环境
echo   stop       - 快速停止所有服务
echo   safe-stop  - 安全停止 (显示确认提示)
echo   status     - 检查服务状态
echo.
echo 示例:
echo   quick-restart.bat start       # 启动
echo   quick-restart.bat restart     # 重启  
echo   quick-restart.bat safe-stop   # 安全停止
echo   quick-restart.bat status      # 状态
echo.
echo 💡 提示:
echo   - 支持动态端口分配，避免端口冲突
echo   - 使用精确的进程终止，不会影响其他程序
echo   - 推荐日常开发使用 dev-fullstack.ps1
goto end

:show_info
echo.

:: 获取动态端口或使用默认端口
set BACKEND_PORT=8001
set FRONTEND_PORT=3000

if exist "backend_port.txt" (
    for /f "delims=" %%i in (backend_port.txt) do set BACKEND_PORT=%%i
)
if exist "frontend_port.txt" (
    for /f "delims=" %%i in (frontend_port.txt) do set FRONTEND_PORT=%%i
)

echo 🌐 服务地址:
echo   前端: http://localhost:%FRONTEND_PORT%
echo   后端: http://localhost:%BACKEND_PORT%
echo   API文档: http://localhost:%BACKEND_PORT%/docs
echo.
echo 💡 提示: 浏览器按 Ctrl+Shift+R 强制刷新

:end
pause