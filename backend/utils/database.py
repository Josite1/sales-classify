"""
Supabase database client and utilities.
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_SUPABASE_URL: str | None = None
_SUPABASE_KEY: str | None = None
_CLIENT: Client | None = None


def get_supabase_url() -> str:
    global _SUPABASE_URL
    if _SUPABASE_URL is None:
        _SUPABASE_URL = os.getenv("COZE_SUPABASE_URL") or ""
    if not _SUPABASE_URL:
        raise RuntimeError("COZE_SUPABASE_URL not configured")
    return _SUPABASE_URL


def get_supabase_key() -> str:
    global _SUPABASE_KEY
    if _SUPABASE_KEY is None:
        _SUPABASE_KEY = os.getenv("COZE_SUPABASE_ANON_KEY") or ""
    if not _SUPABASE_KEY:
        raise RuntimeError("COZE_SUPABASE_ANON_KEY not configured")
    return _SUPABASE_KEY


def get_supabase_client() -> Client:
    global _CLIENT
    if _CLIENT is None:
        url = get_supabase_url()
        key = get_supabase_key()
        _CLIENT = create_client(url, key)
    return _CLIENT