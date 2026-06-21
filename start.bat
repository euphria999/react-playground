@echo off
echo 🚀 启动 React Playground...
echo.
echo 📋 检查环境配置...
if not exist .env (
    echo ❌ .env 文件不存在，请先配置 API Key
    echo 💡 复制 env.example 为 .env 并配置 DEEPSEEK_API_KEY
    pause
    exit /b 1
)

echo ✅ 环境配置检查完成
echo.
echo 🔧 安装依赖...
call npm install

echo.
echo 🚀 启动应用...
call npm run dev:full










