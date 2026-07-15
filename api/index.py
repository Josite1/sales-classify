"""
Vercel serverless entry point for the FastAPI backend.
Uses Mangum as the ASGI adapter for AWS Lambda / Vercel serverless.
"""

import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app  # noqa: E402
from mangum import Mangum  # noqa: E402

# Mangum adapts FastAPI/Starlette ASGI apps to the AWS Lambda / Vercel event format.
# It correctly preserves the original request path from the Vercel event payload,
# so FastAPI routes match regardless of Vercel internal rewrites.
handler = Mangum(app, lifespan="off")
