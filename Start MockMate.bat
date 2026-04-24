@echo off
title MockMate Launcher
color 0A
cls

echo ============================================
echo      MockMate - AI Interview Simulator
echo ============================================
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo [1/3] Starting backend...
start "MockMate Backend" cmd /k "cd /d %BACKEND% && venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo [2/3] Starting frontend...
start "MockMate Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo [3/3] Opening browser in 6 seconds...
timeout /t 6 /nobreak > nul

start "" http://localhost:5173

echo.
echo  Both servers are running in separate windows.
echo  Close those windows to stop MockMate.
echo.
pause
