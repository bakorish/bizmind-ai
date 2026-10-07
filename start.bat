@echo off
title BizMind AI - Launcher
echo ============================================
echo   BizMind AI - Starting all services...
echo ============================================

REM AI/ML service (Python FastAPI) - port 8001
start "BizMind AI - AI Service (8001)" cmd /k "cd /d D:\bizmind-ai\ai-service && python -m uvicorn app.main:app --port 8001"

REM Backend API (Node/Express) - port 5000
start "BizMind AI - API (5000)" cmd /k "cd /d D:\bizmind-ai\backend && npm run dev"

REM Frontend (React/Vite) - port 5173
start "BizMind AI - Web (5173)" cmd /k "cd /d D:\bizmind-ai\frontend && npm run dev"

echo.
echo 3 windows opened:
echo   [1] AI Service   - http://localhost:8001
echo   [2] API Server   - http://localhost:5000
echo   [3] Web App      - http://localhost:5173
echo.
echo Closing a window stops that service.
echo Opening browser in 6 seconds...
timeout /t 6 >nul
start http://localhost:5173
echo Done.
timeout /t 3 >nul
