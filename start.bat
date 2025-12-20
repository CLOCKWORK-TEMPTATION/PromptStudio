@echo off
setlocal enabledelayedexpansion

echo 🚀 PromptStudio Quick Start
echo ==========================

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file and add your OpenAI API key
    echo    OPENAI_API_KEY=your-api-key-here
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Start Docker services
echo 🐳 Starting Docker services...
docker-compose -f docker-compose.dev.yml up -d postgres redis

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo 🗄️  Running database migrations...
call npx prisma migrate dev --name init

REM Generate Prisma client
echo 🔧 Generating Prisma client...
call npx prisma generate

REM Start the application
echo 🎯 Starting PromptStudio...
echo.
echo Backend will be available at: http://localhost:3001
echo Frontend will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start backend and frontend concurrently
start "PromptStudio Backend" cmd /c "npm run backend:dev"
timeout /t 5 /nobreak >nul
start "PromptStudio Frontend" cmd /c "npm run dev"

echo 🎉 PromptStudio is starting up!
echo Check the opened terminal windows for logs.
echo.
pause