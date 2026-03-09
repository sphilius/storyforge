import logging
import os
from functools import lru_cache
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv() -> None:
        return None

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from google import genai
except ImportError:
    genai = None

load_dotenv()

logger = logging.getLogger("storyforge.director")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


class DirectorNode(BaseModel):
    id: str
    label: str
    type: str
    x: int
    y: int


class DirectorResponse(BaseModel):
    director_response: str
    trace: list[str]
    node: DirectorNode


class DirectorRespondRequest(BaseModel):
    user_input: str = Field(min_length=1)


@lru_cache(maxsize=1)
def get_genai_client() -> Any:
    if genai is None:
        raise RuntimeError("google-genai SDK is not installed.")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    return genai.Client(api_key=api_key)


def build_node(user_input: str, director_response: str) -> DirectorNode:
    cleaned_input = user_input.strip()
    seed_text = cleaned_input if cleaned_input else director_response.strip()
    if not seed_text:
        seed_text = "story idea"

    excerpt = seed_text[:60]
    checksum = sum(ord(char) for char in seed_text)

    return DirectorNode(
        id=f"node-{checksum % 10000}",
        label=f"Beat: {excerpt}",
        type="story",
        x=180 + (checksum % 220),
        y=100 + ((checksum // 3) % 220),
    )


def build_director_payload(
    user_input: str,
    director_response: str,
    trace: list[str],
) -> DirectorResponse:
    return DirectorResponse(
        director_response=director_response,
        trace=trace,
        node=build_node(user_input=user_input, director_response=director_response),
    )


def build_ping_payload() -> DirectorResponse:
    ping_input = "New Story Seed"
    ping_response = "Director: Ready. Share a story impulse and I will draft the next beat."

    return DirectorResponse(
        director_response=ping_response,
        trace=[
            "ping_received",
            "director_ready",
        ],
        node=build_node(user_input=ping_input, director_response=ping_response),
    )


def generate_director_response(user_input: str) -> tuple[str, list[str]]:
    cleaned_input = user_input.strip()
    if not cleaned_input:
        cleaned_input = "story idea"

    trace = ["input_received", "model_call_started"]
    logger.info("model_call_started")

    try:
        model_name = os.getenv("GEMINI_TEXT_MODEL", "").strip()
        if not model_name:
            raise RuntimeError("GEMINI_TEXT_MODEL is not configured.")

        prompt = (
            "You are StoryForge Director, a concise story beat assistant. "
            "Given a creator input, return 1-2 short sentences that suggest the next beat. "
            "Stay concrete and cinematic.\n\n"
            f"Creator input: {cleaned_input}"
        )

        result = get_genai_client().models.generate_content(
            model=model_name,
            contents=prompt,
        )
        model_text = (result.text or "").strip()
        if not model_text:
            raise RuntimeError("Gemini returned an empty response.")

        trace.extend(["model_call_completed", "response_generated", "graph_update_ready"])
        logger.info("model_call_completed")
        return model_text, trace
    except Exception:
        logger.exception("model_call_failed")
        fallback_excerpt = cleaned_input[:60]
        fallback_response = (
            f"Director: Let's anchor the next beat around '{fallback_excerpt}' "
            "with a clear action and consequence."
        )
        trace.extend(["model_call_failed", "response_generated", "graph_update_ready"])
        return fallback_response, trace


app = FastAPI(title="StoryForge Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "storyforge-backend"}

@app.get("/director/ping", response_model=DirectorResponse)
def director_ping() -> DirectorResponse:
    return build_ping_payload()


@app.post("/director/respond", response_model=DirectorResponse)
def director_respond(payload: DirectorRespondRequest) -> DirectorResponse:
    director_response, trace = generate_director_response(payload.user_input)
    return build_director_payload(
        user_input=payload.user_input,
        director_response=director_response,
        trace=trace,
    )
