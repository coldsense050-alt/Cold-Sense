@echo off
setlocal EnableExtensions
title Cold Sense - Backend (ESP32 -^> Supabase)

cd /d "%~dp0firmware"

if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"

where python >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale em https://www.python.org e rode de novo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERRO] firmware\.env nao encontrado.
    echo Copie firmware\.env.example para firmware\.env e preencha as credenciais.
    pause
    exit /b 1
)

python -c "import serial, supabase, dotenv" >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias ^(pyserial, supabase, python-dotenv^)...
    python -m pip install pyserial supabase python-dotenv
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar as dependencias.
        pause
        exit /b 1
    )
)

echo.
echo Iniciando o backend... ^(Ctrl+C para encerrar^)
echo.
python -m backend.main

echo.
pause
