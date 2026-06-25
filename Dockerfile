# Railway Dockerfile
# Multi-stage build: Node.js 22 + Python 3.11 for FastAPI backend

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y python3 python3-pip --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Install Node dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Install Python dependencies
COPY backend/requirements.txt backend/
RUN cd backend && pip3 install --break-system-packages -r requirements.txt

# Copy source
COPY . .

# Build Next.js
RUN pnpm build

# Single start command
EXPOSE 3000
CMD ["bash", "start.sh"]
