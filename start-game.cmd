@echo off
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm ci --ignore-scripts
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
echo.
echo Open http://127.0.0.1:5173/ in your browser.
echo Press Ctrl+C in this window to stop the local server.
echo.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
pause
