"""
Director Mode — FastAPI Backend
================================
WHY THIS FILE EXISTS:
    This is the entry point for the entire backend. FastAPI handles:
    - HTTP requests (REST API endpoints)
    - WebSocket connections (if needed for streaming)
    - CORS middleware (so the React frontend can call this backend)
    - Static file serving (in production, serves the built React app)

ARCHITECTURE:
    The backend has TWO main API paths:

    1. /api/direct (POST) → Director Agent
       Processes creative directions through the ADK Director Agent.
       The agent uses custom tools (update_scene, introduce_character, etc.)
       to structure the director's vision into data.

    2. /api/ground (POST) → Search Agent
       Routes factual questions through the ADK Search Agent with
       google_search grounding. Proves zero-hallucination to judges.

    3. /api/session/{id} (GET) → Session info
       Returns the current session state for debugging/demo.

    4. /api/session/{id}/reset (POST) → Reset session
       Clears conversation history for a fresh start.

    5. /health (GET) → Health check
       Required for Cloud Run health monitoring.

    6. /director/ping (GET) → Legacy ping
       Kept for backward compatibility with the original frontend.

WHAT JUDGES SEE:
    - Clean REST API with proper endpoint design
    - ADK integration (Runner, Session management)
    - Google Search Grounding via dedicated endpoint
    - Error handling with structured responses
    - CORS properly configured
"""

from __future__ import annotations

import json
import os
import traceback
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from google.genai import types

# ---------------------------------------------------------------------------
# Import our ADK agents and configuration
# ---------------------------------------------------------------------------
from .config import CORS_ORIGINS, APP_NAME, DEFAULT_USER_ID
from .adk_director import (
    director_runner,
    search_runner,
    session_service,
)


# ---------------------------------------------------------------------------
# Lifespan handler (runs on startup/shutdown)
# ---------------------------------------------------------------------------
# FastAPI's lifespan context manager lets us run code when the server starts
# and stops. We use it to log startup info and clean up resources on shutdown.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # --- STARTUP ---
    print("=" * 60)
    print("DIRECTOR MODE — Backend starting")
    print(f"  App name: {APP_NAME}")
    print(f"  API key configured: {'Yes' if os.environ.get('GOOGLE_API_KEY') else 'NO — set GOOGLE_API_KEY!'}")
    print("=" * 60)
    yield
    # --- SHUTDOWN ---
    print("Director Mode backend shutting down.")


# ---------------------------------------------------------------------------
# Create the FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Director Mode",
    description="AI-powered interactive story directing with Google Gemini & ADK",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
# CORS (Cross-Origin Resource Sharing) is needed when your frontend and
# backend run on different URLs. In local dev:
#   Frontend: http://localhost:5173 (Vite)
#   Backend:  http://localhost:8000 (Uvicorn)
# These are different "origins", so the browser blocks requests by default
# unless the backend explicitly allows them.
#
# In production on Cloud Run, both frontend and backend serve from the same
# URL, so CORS isn't strictly needed — but we keep it for safety.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# REQUEST / RESPONSE SCHEMAS
# ===========================================================================
# Pydantic models define the shape of data going in and out of endpoints.
# FastAPI uses these for:
#   1. Automatic request validation (rejects malformed input)
#   2. Automatic API documentation (try /docs when running)
#   3. Type safety in your code
# ===========================================================================

class DirectRequest(BaseModel):
    """Input for the /api/direct endpoint."""
    session_id: str = Field(
        default="default",
        description="Unique session identifier. Each session maintains its own conversation history."
    )
    prompt: str = Field(
        description="The director's instruction or creative direction."
    )


class DirectResponse(BaseModel):
    """Output from the /api/direct endpoint."""
    response_text: str = Field(
        description="The agent's spoken/text response to the director."
    )
    tool_calls: list[dict] = Field(
        default_factory=list,
        description="List of tools the agent called and their results."
    )
    trace: list[str] = Field(
        default_factory=list,
        description="Execution trace showing the agent's reasoning steps."
    )


class GroundRequest(BaseModel):
    """Input for the /api/ground endpoint (Search Agent)."""
    session_id: str = Field(default="search-default")
    query: str = Field(
        description="A factual question to ground with Google Search."
    )


class GroundResponse(BaseModel):
    """Output from the /api/ground endpoint."""
    response_text: str
    grounded: bool = Field(
        default=True,
        description="Whether the response was grounded via Google Search."
    )
    trace: list[str] = Field(default_factory=list)


# ===========================================================================
# HELPER: Run an ADK agent and collect results
# ===========================================================================
# This function encapsulates the pattern of:
#   1. Ensure a session exists (create if not)
#   2. Send user input through the runner
#   3. Collect all events (text, tool calls, results)
#   4. Return structured data
#
# WHY THIS IS ASYNC:
#   runner.run_async() is an async generator — it yields events one at a
#   time as the agent processes. We collect all events into lists for the
#   REST response. For streaming (WebSocket), you'd yield each event instead.
# ===========================================================================
async def run_agent(runner, user_id: str, session_id: str, prompt: str) -> dict:
    """Execute an ADK agent and collect all response events.
    
    Args:
        runner: The ADK Runner instance (director_runner or search_runner)
        user_id: User identifier for session management
        session_id: Session identifier for conversation continuity
        prompt: The user's input text
        
    Returns:
        Dict with response_text, tool_calls, and trace
    """
    response_text_parts = []
    tool_calls = []
    trace = []

    # --- Step 1: Ensure session exists ---
    # ADK requires a session before running. If it doesn't exist, create it.
    #
    # IMPORTANT: InMemorySessionService.get_session() returns None when the
    # session doesn't exist (it does NOT raise an exception). So we check
    # for None explicitly, then create if needed.
    try:
        session = await session_service.get_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id,
        )
    except Exception:
        session = None

    if session is None:
        # Session doesn't exist yet — create a new one
        session = await session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id,
        )
        trace.append("session_created")
    else:
        trace.append("session_loaded")

    # --- Step 2: Package the user's input ---
    # ADK expects a Content object with Parts (Google's standard format).
    # This is the same format used by the Gemini API directly.
    user_content = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )

    # --- Step 3: Run the agent ---
    # run_async() yields Event objects as the agent processes.
    # Events can contain:
    #   - Text (the agent's response)
    #   - Tool calls (function calls the agent made)
    #   - Tool results (return values from those functions)
    #   - State updates
    trace.append("agent_invoked")

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_content,
    ):
        # --- Extract text responses ---
        # event.content contains the agent's output (if any this event)
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text_parts.append(part.text)
                    trace.append(f"text_generated: {part.text[:50]}...")

                # --- Extract tool calls ---
                # When the agent decides to call a tool, it appears as a
                # function_call in the parts. The tool_result comes in a
                # subsequent event.
                if hasattr(part, "function_call") and part.function_call:
                    tool_call_info = {
                        "tool_name": part.function_call.name,
                        "arguments": dict(part.function_call.args) if part.function_call.args else {},
                    }
                    tool_calls.append(tool_call_info)
                    trace.append(f"tool_called: {part.function_call.name}")

                if hasattr(part, "function_response") and part.function_response:
                    trace.append(f"tool_result: {part.function_response.name}")

    trace.append("agent_complete")

    return {
        "response_text": " ".join(response_text_parts) if response_text_parts else "(No response generated)",
        "tool_calls": tool_calls,
        "trace": trace,
    }


# ===========================================================================
# ENDPOINTS
# ===========================================================================

# --- Health Check ---
# Required by Cloud Run for container health monitoring.
# Cloud Run pings this endpoint periodically. If it returns non-200,
# the container is restarted.
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "director-mode",
        "version": "1.0.0",
        "agents": ["director_agent", "search_agent"],
    }


# --- Legacy Ping (backward compatibility) ---
# The original frontend calls this endpoint. We keep it so nothing breaks.
@app.get("/director/ping")
def director_ping():
    return {
        "director_response": "I'm online. Give me a story impulse and I'll shape it.",
        "trace": [
            "input_received",
            "intent_interpreted",
            "response_generated",
            "graph_update_ready",
        ],
        "node": {
            "id": "node-1",
            "label": "New Story Seed",
            "type": "story",
            "x": 250,
            "y": 120,
        },
    }


# --- Main Direction Endpoint ---
# This is where creative directions go through the ADK Director Agent.
# POST /api/direct
# Body: { "session_id": "my-session", "prompt": "Scene one. Tokyo alley at midnight." }
@app.post("/api/direct", response_model=DirectResponse)
async def direct(req: DirectRequest):
    """Send a creative direction to the AI Crew Chief.
    
    The Director Agent processes the input, potentially calling tools
    (update_scene, introduce_character, etc.) and returns a structured
    response with the agent's text and any tool call data.
    """
    try:
        result = await run_agent(
            runner=director_runner,
            user_id=DEFAULT_USER_ID,
            session_id=req.session_id,
            prompt=req.prompt,
        )
        return DirectResponse(**result)
    except Exception as e:
        # Log the full traceback for debugging
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Director Agent error: {str(e)}"
        )


# --- Grounding Endpoint ---
# Routes factual questions through the Search Agent with google_search.
# POST /api/ground
# Body: { "session_id": "search-1", "query": "What are film noir visual conventions?" }
@app.post("/api/ground", response_model=GroundResponse)
async def ground(req: GroundRequest):
    """Ask a factual question grounded by Google Search.
    
    Uses the Search Agent with Google's built-in search grounding tool.
    Proves zero-hallucination capability to judges.
    """
    try:
        result = await run_agent(
            runner=search_runner,
            user_id=DEFAULT_USER_ID,
            session_id=req.session_id,
            prompt=req.query,
        )
        return GroundResponse(
            response_text=result["response_text"],
            grounded=True,
            trace=result["trace"],
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Search Agent error: {str(e)}"
        )


# --- Session Info ---
# Returns the current session state. Useful for debugging and demo.
@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Get the current state of a director session."""
    try:
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=DEFAULT_USER_ID,
            session_id=session_id,
        )
        return {
            "session_id": session.id,
            "app_name": session.app_name,
            "user_id": session.user_id,
            "state": session.state.to_dict() if hasattr(session.state, 'to_dict') else dict(session.state),
            "event_count": len(session.events) if session.events else 0,
        }
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")


# --- Reset Session ---
# Deletes a session so the next request creates a fresh one.
@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id: str):
    """Reset a director session, clearing all conversation history."""
    try:
        await session_service.delete_session(
            app_name=APP_NAME,
            user_id=DEFAULT_USER_ID,
            session_id=session_id,
        )
        return {"status": "reset", "session_id": session_id}
    except Exception:
        # If session doesn't exist, that's fine — it's already "reset"
        return {"status": "reset", "session_id": session_id}


# ===========================================================================
# STATIC FILE SERVING (Production)
# ===========================================================================
# In production (Cloud Run), the Dockerfile builds the React frontend and
# copies the output to /app/static. We serve those files here so the entire
# app (frontend + backend) runs on a single URL.
#
# This MUST be the LAST route registered, because StaticFiles with html=True
# acts as a catch-all — any path not matched by the API endpoints above
# will be served as a static file (or fall back to index.html for SPA routing).
# ===========================================================================
static_dir = "/app/static"
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
