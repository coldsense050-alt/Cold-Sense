@echo off
setlocal EnableExtensions
title Cold Sense - Site publico (Cloudflare Tunnel)

cd /d "%~dp0"
set "PORTA=5173"
set "ORIGEM=http://127.0.0.1:%PORTA%"
set "CLOUDFLARED="

echo.
echo === [1/4] Verificando cloudflared ===
call :localizar_cloudflared
if defined CLOUDFLARED (
    echo cloudflared ja instalado: "%CLOUDFLARED%"
    goto frontend
)

echo cloudflared nao encontrado. Instalando via winget...
where winget >nul 2>&1
if not errorlevel 1 (
    winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements
    call :localizar_cloudflared
)

if not defined CLOUDFLARED (
    echo winget indisponivel ou falhou. Baixando o executavel direto do GitHub...
    if not exist "%LOCALAPPDATA%\cloudflared" mkdir "%LOCALAPPDATA%\cloudflared"
    curl -L --fail -o "%LOCALAPPDATA%\cloudflared\cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    call :localizar_cloudflared
)

if not defined CLOUDFLARED (
    echo.
    echo [ERRO] Nao foi possivel instalar o cloudflared.
    echo Instale manualmente: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    pause
    exit /b 1
)
echo cloudflared instalado: "%CLOUDFLARED%"

:frontend
echo.
echo === [2/4] Verificando o frontend ===
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js/npm nao encontrado. Instale em https://nodejs.org e rode de novo.
    pause
    exit /b 1
)

if not exist "frontend\.env.local" if not exist "frontend\.env" (
    echo [AVISO] frontend\.env.local nao existe. Sem ele o site abre com erro
    echo         ^(VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY^).
    echo         Copie frontend\.env.example para frontend\.env.local e preencha.
    echo.
)

if not exist "frontend\node_modules" (
    echo Instalando dependencias do frontend ^(npm install^)...
    pushd frontend
    call npm install
    if errorlevel 1 (
        popd
        echo [ERRO] npm install falhou.
        pause
        exit /b 1
    )
    popd
)

echo.
echo === [3/4] Iniciando o servidor local ===
curl -s -o nul "%ORIGEM%" >nul 2>&1
if not errorlevel 1 (
    echo O site ja esta rodando em %ORIGEM%.
    goto tunel
)

REM Libera os enderecos *.trycloudflare.com no Vite sem alterar o vite.config.ts
set "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.trycloudflare.com"
start "Cold Sense - Frontend" /D "%~dp0frontend" cmd /k npm run dev -- --host 127.0.0.1 --port %PORTA% --strictPort

echo Aguardando o Vite subir em %ORIGEM% ...
set /a TENTATIVAS=0
:esperar
timeout /t 2 /nobreak >nul
curl -s -o nul "%ORIGEM%" >nul 2>&1
if not errorlevel 1 goto tunel
set /a TENTATIVAS+=1
if %TENTATIVAS% GEQ 45 (
    echo [ERRO] O Vite nao respondeu em 90 s. Veja a janela "Cold Sense - Frontend".
    pause
    exit /b 1
)
goto esperar

:tunel
echo.
echo === [4/4] Criando o endereco temporario ===
set "LOG=%TEMP%\coldsense_tunel.log"
set "URL="
call :parar_tunel
if exist "%LOG%" del /f /q "%LOG%" >nul 2>&1

REM Roda o cloudflared nesta mesma janela, em segundo plano, gravando o log
REM num arquivo para podermos ler o endereco gerado.
start "" /b cmd /c ""%CLOUDFLARED%" tunnel --no-autoupdate --url %ORIGEM% --http-host-header localhost > "%LOG%" 2>&1"

echo Aguardando a Cloudflare gerar o endereco...
set /a TENTATIVAS=0
:esperar_url
timeout /t 2 /nobreak >nul
if not defined URL call :ler_url
if defined URL (
    findstr /c:"Registered tunnel connection" "%LOG%" >nul 2>&1
    if not errorlevel 1 goto mostrar_url
)
set /a TENTATIVAS+=1
if %TENTATIVAS% GEQ 40 (
    if defined URL goto mostrar_url
    echo.
    echo [ERRO] O cloudflared nao gerou um endereco em 80 s. Ultimas linhas do log:
    powershell -NoProfile -Command "Get-Content -LiteralPath $env:LOG -Tail 15"
    call :parar_tunel
    pause
    exit /b 1
)
goto esperar_url

:mostrar_url
echo %URL%| clip
cls
echo.
echo  ==================================================================
echo   SITE NO AR - envie este link ^(ja copiado para a area de transferencia^):
echo.
echo     %URL%
echo.
echo   O link muda a cada execucao e funciona enquanto esta janela
echo   estiver aberta.
echo  ==================================================================
echo.
echo  QR code ^(aponte a camera do celular^):
echo.
call npx -y qrcode-terminal "%URL%"
if errorlevel 1 echo  [AVISO] Nao foi possivel gerar o QR code. Use o link acima.
echo.
echo  Pressione qualquer tecla para ENCERRAR o link publico...
pause >nul
call :parar_tunel
echo Tunel encerrado.
echo Feche a janela "Cold Sense - Frontend" para parar o site local.
timeout /t 3 >nul
exit /b 0


REM --------------------------------------------------------------------------
:ler_url
for /f "delims=" %%U in ('powershell -NoProfile -Command "$m = Select-String -LiteralPath $env:LOG -Pattern 'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($m) { $m.Matches[0].Value }"') do set "URL=%%U"
exit /b 0

REM --------------------------------------------------------------------------
:parar_tunel
REM Encerra apenas o cloudflared que aponta para o site deste projeto
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe'\" | Where-Object { $_.CommandLine -like '*%ORIGEM%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
exit /b 0


REM --------------------------------------------------------------------------
:localizar_cloudflared
set "CLOUDFLARED="
for /f "delims=" %%I in ('where cloudflared 2^>nul') do if not defined CLOUDFLARED set "CLOUDFLARED=%%I"
if defined CLOUDFLARED exit /b 0
for %%P in (
    "%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
    "%ProgramFiles%\cloudflared\cloudflared.exe"
    "%LOCALAPPDATA%\cloudflared\cloudflared.exe"
    "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"
) do if not defined CLOUDFLARED if exist %%P set "CLOUDFLARED=%%~P"
if defined CLOUDFLARED exit /b 0
for /f "delims=" %%I in ('dir /s /b "%LOCALAPPDATA%\Microsoft\WinGet\Packages\cloudflared.exe" 2^>nul') do if not defined CLOUDFLARED set "CLOUDFLARED=%%I"
exit /b 0
