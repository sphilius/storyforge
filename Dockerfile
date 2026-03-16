# ===========================================================================
# Director Mode — Production Dockerfile
# ===========================================================================
#
# WHAT THIS DOES:
#   Builds a single container that serves BOTH the React frontend AND the
#   Python/FastAPI backend. This is the container that runs on Cloud Run.
#
# HOW IT WORKS (two stages):
#   Stage 1 ("build"): Uses Node.js to build the React frontend into
#     static HTML/JS/CSS files in /app/dist.
#   Stage 2 ("runtime"): Uses Python to run the FastAPI backend, which
#     also serves the frontend's static files via FastAPI's StaticFiles.
#
# WHY ONE CONTAINER:
#   Cloud Run charges per container. Running frontend + backend in one
#   container is simpler, cheaper, and means they share the same URL
#   (no CORS issues in production).
#
# PREVIOUS APPROACH (what was there before):
#   The old Dockerfile only built the frontend and served it with nginx.
#   There was NO Python backend running. This new Dockerfile adds the
#   full ADK-powered Python backend.
#
# ===========================================================================

# ---------------------------------------------------------------------------
# STAGE 1: Build the React frontend
# ---------------------------------------------------------------------------
# We use Node.js 20 (Alpine variant for small image size) to:
#   1. Install npm dependencies
#   2. Run the Vite build (npm run build)
#   3. Output static files to /app/dist
#
# These files will be copied into Stage 2 and served by FastAPI.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first (for Docker layer caching).
# If package.json hasn't changed, Docker reuses the cached npm install layer.
COPY frontend/package.json frontend/package-lock.json* frontend/.npmrc* ./
RUN npm install --ignore-scripts

# Copy the rest of the frontend source and build
COPY frontend/ .
RUN npm run build
# Output is now in /app/dist/


# ---------------------------------------------------------------------------
# STAGE 2: Python runtime (FastAPI + ADK)
# ---------------------------------------------------------------------------
# We use Python 3.12 (slim variant for small image) to:
#   1. Install Python dependencies (google-adk, fastapi, uvicorn)
#   2. Copy the backend source code
#   3. Copy the built frontend from Stage 1
#   4. Run uvicorn, which serves both the API and static files
# ---------------------------------------------------------------------------
FROM python:3.12-slim

WORKDIR /app

# --- Install Python dependencies ---
# Copy requirements.txt first (Docker layer caching — if deps haven't
# changed, this layer is reused even if your code changed).
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# --- Copy backend source code ---
# The entire backend/ directory is copied into /app/backend/
COPY backend/ ./backend/

# --- Copy built frontend from Stage 1 ---
# The static files (HTML, JS, CSS) go into /app/static/
# FastAPI's StaticFiles middleware serves these (see main.py, last section).
COPY --from=build /app/dist ./static/

# --- Environment variables ---
# PORT: Cloud Run sets this to 8080 by default. Uvicorn listens on this port.
# GOOGLE_API_KEY: Must be set at deploy time via --set-env-vars.
#   We don't bake it into the image (security).
ENV PORT=8080

# --- Expose the port ---
# This is documentation for humans/Cloud Run. The actual port binding
# is done by uvicorn's --port flag below.
EXPOSE 8080

# --- Run the backend ---
# uvicorn runs our FastAPI app.
#   --host 0.0.0.0: Listen on all interfaces (required for Cloud Run)
#   --port $PORT: Use the PORT env var (Cloud Run sets this to 8080)
#   --workers 1: Single worker is fine for Cloud Run (it scales via containers)
#
# "backend.app.main:app" means:
#   Look in the backend/app/main.py file → use the 'app' variable (our FastAPI instance)
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
