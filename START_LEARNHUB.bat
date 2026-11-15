@echo off
cd /d "%~dp0"
echo ========================================
echo             LEARNHUB
 echo        React + Flask + SQLite
 echo ========================================
where python >nul 2>&1
if errorlevel 1 (
    echo Python was not found. Install Python and enable PATH.
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js LTS and reopen CMD.
    pause
    exit /b 1
)
start "LearnHub Flask" "%~dp0RUN_BACKEND.bat"
start "LearnHub React" "%~dp0RUN_FRONTEND.bat"
echo.
echo Two windows are starting. The first launch installs dependencies.
echo Wait for BOTH running messages, then open:
echo     http://127.0.0.1:5173/
echo.
echo Keep both server windows open while using LearnHub.
echo.
pause
