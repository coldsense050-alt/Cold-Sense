import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Carrega as variáveis de ambiente
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Recupera as credenciais
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SECRET_KEY")

if not url or not key:
    raise ValueError("Credenciais do Supabase não encontradas.")

# Cria o cliente
supabase = create_client(url, key)