@echo off
REM Inicia a API da Freezer AI (Windows). Dê dois cliques ou rode no terminal.
cd /d %~dp0
if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat
python -m uvicorn api:app --reload --port 8000
pause
