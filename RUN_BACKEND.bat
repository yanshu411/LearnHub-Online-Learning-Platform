@echo off
cd /d "%~dp0server"
echo.
echo ====================================
echo LearnHub Flask API (port 5000)
echo ====================================
echo.
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Dependency installation failed. Check Python and internet access.
    pause
    exit /b 1
)
python app.py
echo.
echo Server stopped.
pause
