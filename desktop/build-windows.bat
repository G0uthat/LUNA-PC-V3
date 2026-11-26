@echo off
title Compilar Luma para Windows (.exe)
cd /d "%~dp0"
echo ============================================
echo   Luma Desktop - Generador de Ejecutable PC
echo ============================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js 20+ no esta instalado. Descargalo desde https://nodejs.org/
  pause
  exit /b 1
)
echo [1/2] Instalando dependencias...
call npm install
if %errorlevel% neq 0 pause & exit /b 1

echo [2/2] Compilando instalador y ejecutable portable (.exe)...
call npm run dist:win
if %errorlevel% neq 0 pause & exit /b 1

echo.
echo Listo! Encontraras los ejecutables en: desktop\release\
explorer release
pause
