"""
Vercel serverless entry point for the FastAPI backend.
Routes all /api/records, /api/aliases, /api/excel, /api/compute requests
through the same FastAPI app used on Railway.
"""

import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app  # noqa: E402

# Vercel looks for the `app` object
