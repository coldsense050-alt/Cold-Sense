#!/usr/bin/env bash
# Inicia a API da Freezer AI (Linux/Mac)
cd "$(dirname "$0")"
[ -f .venv/bin/activate ] && source .venv/bin/activate
python -m uvicorn api:app --reload --port 8000
