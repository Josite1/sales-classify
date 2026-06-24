#!/bin/bash
# Railway combined start script
# Runs FastAPI backend on port 8001 (background) and Next.js frontend on PORT (foreground)

set -e

echo "[railway] Starting FastAPI backend on port 8001..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "[railway] Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo "[railway] Backend is ready!"
    break
  fi
  sleep 1
done

echo "[railway] Starting Next.js frontend on port ${PORT:-3000}..."
node node_modules/.bin/next start -p "${PORT:-3000}" &
FRONTEND_PID=$!

# Forward signals to both processes
cleanup() {
  echo "[railway] Shutting down..."
  kill $FRONTEND_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  wait
  echo "[railway] Shutdown complete."
}
trap cleanup SIGTERM SIGINT

# Wait for frontend to exit
wait $FRONTEND_PID
