@echo off
REM 阿里云函数计算 FC 一键部署脚本
REM 前置条件：已安装 Node.js、pnpm、Serverless Devs（s）

echo === 1. 安装依赖 ===
call pnpm install

echo === 2. 构建 Next.js ===
call pnpm next build

echo === 3. 准备部署包 ===
if exist dist rmdir /s /q dist
mkdir dist

REM 复制 standalone 输出
xcopy /E /I /Y .next\standalone\* dist\

REM 复制静态资源
xcopy /E /I /Y public dist\public
xcopy /E /I /Y .next\static dist\.next\static

REM 复制 bootstrap
copy fc\bootstrap dist\bootstrap
copy fc\s.yaml s.yaml

echo === 4. 部署到 FC ===
call s deploy --use-local -y

echo === 部署完成 ===
