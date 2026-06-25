"""
Supabase database client and utilities.
"""
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

_SUPABASE_URL: str | None = None
_SUPABASE_KEY: str | None = None
_CLIENT: 'Client | None' = None


def get_supabase_url() -> str:
    '''Get Supabase URL from environment.'''
    global _SUPABASE_URL
    if _SUPABASE_URL is None:
        _SUPABASE_URL = os.getenv("COZE_SUPABASE_URL") or ""
    if not _SUPABASE_URL:
        raise RuntimeError("COZE_SUPABASE_URL not configured")
    return _SUPABASE_URL


def get_supabase_key() -> str:
    '''Get Supabase key from environment.'''
    global _SUPABASE_KEY
    if _SUPABASE_KEY is None:
        _SUPABASE_KEY = os.getenv("COZE_SUPABASE_ANON_KEY") or ""
    if not _SUPABASE_KEY:
        raise RuntimeError("COZE_SUPABASE_ANON_KEY not configured")
    return _SUPABASE_KEY


def get_supabase_client():
    '''Get or create Supabase client.'''
    from supabase import create_client
    from dotenv import load_dotenv
    load_dotenv()

    global _CLIENT
    if _CLIENT is None:
        url = get_supabase_url()
        key = get_supabase_key()
        _CLIENT = create_client(url, key)
    return _CLIENT
