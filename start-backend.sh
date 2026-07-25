#!/bin/bash
# Railway backend-only start script
# Only runs FastAPI on port 8001

set -e

echo "[railway-backend] Starting FastAPI backend on port ${PORT:-8001}..."
cd backend
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
