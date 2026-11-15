@echo off
cd /d "%~dp0client"
echo.
echo ====================================
echo LearnHub React App (port 5173)
echo ====================================
echo.
call npm install
if errorlevel 1 (
    echo.
    echo npm install failed. Check Node.js and internet access.
    pause
    exit /b 1
)
call npm run dev
echo.
echo React app stopped.
pause
