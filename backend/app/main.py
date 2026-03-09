import logging
import os
import re
import time
from collections import deque
from difflib import SequenceMatcher
from functools import lru_cache
from typing import Any, Literal

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv() -> None:
        return None

from fastapi import FastAPI, HTTPException
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


class StorySentinelWarning(BaseModel):
    code: str
    message: str


class StorySentinelResult(BaseModel):
    warnings: list[StorySentinelWarning]


class LorePool(BaseModel):
    character: list[str] = Field(default_factory=list)
    setting: list[str] = Field(default_factory=list)
    event: list[str] = Field(default_factory=list)
    theme: list[str] = Field(default_factory=list)
    backstory: list[str] = Field(default_factory=list)
    prop: list[str] = Field(default_factory=list)


class DirectorNode(BaseModel):
    id: str
    label: str
    type: str
    x: int
    y: int
    lore_pool: LorePool = Field(default_factory=LorePool)


class DirectorResponse(BaseModel):
    director_response: str
    trace: list[str]
    node: DirectorNode
    story_sentinel: StorySentinelResult | None = None


class DirectorRespondRequest(BaseModel):
    user_input: str = Field(min_length=1)


class StoryboardRequestPayload(BaseModel):
    beat_id: str = Field(min_length=1)
    beat_label: str = ""
    beat_title: str = ""
    beat_summary: str = ""
    beat_notes: str = ""
    lore_pool: LorePool = Field(default_factory=LorePool)


class StoryboardRequestResponse(BaseModel):
    job_id: str
    beat_id: str
    status: Literal["requested", "generating"]
    trace: list[str]
    message: str


SENTINEL_RECENT_INPUTS: deque[str] = deque(maxlen=10)
SENTINEL_RECENT_GENERIC_FLAGS: deque[bool] = deque(maxlen=8)
SENTINEL_RECENT_LORE_TERMS: deque[set[str]] = deque(maxlen=8)


@lru_cache(maxsize=1)
def get_genai_client() -> Any:
    if genai is None:
        raise RuntimeError("google-genai SDK is not installed.")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    return genai.Client(api_key=api_key)


def is_live_director_enabled() -> bool:
    raw_value = os.getenv("USE_LIVE_DIRECTOR")
    if raw_value is None:
        # Backward-compatible typo guard for older local env files.
        raw_value = os.getenv("USE_LIVE_DIRECTO", "false")
    raw_value = raw_value.strip().lower()
    return raw_value in {"1", "true", "yes", "on"}


def build_node(
    user_input: str,
    director_response: str,
    lore_pool: LorePool | None = None,
) -> DirectorNode:
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
        lore_pool=lore_pool if lore_pool is not None else LorePool(),
    )


def build_director_payload(
    user_input: str,
    director_response: str,
    trace: list[str],
    story_sentinel: StorySentinelResult | None = None,
    lore_pool: LorePool | None = None,
) -> DirectorResponse:
    return DirectorResponse(
        director_response=director_response,
        trace=trace,
        node=build_node(
            user_input=user_input,
            director_response=director_response,
            lore_pool=lore_pool,
        ),
        story_sentinel=story_sentinel,
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


def build_director_prompt(cleaned_input: str) -> str:
    return (
        "You are StoryForge Director, a concise story beat assistant. "
        "Given a creator input, return 1-2 short sentences that suggest the next beat. "
        "Stay concrete and cinematic.\n\n"
        f"Creator input: {cleaned_input}"
    )


def normalize_for_sentinel(text: str) -> str:
    collapsed = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    return " ".join(collapsed.split())


def run_story_sentinel(user_input: str, director_response: str) -> tuple[StorySentinelResult, list[str]]:
    cleaned_input = user_input.strip() or director_response.strip() or "story idea"
    normalized_input = normalize_for_sentinel(cleaned_input)
    words = normalized_input.split()
    warnings: list[StorySentinelWarning] = []

    if normalized_input:
        for previous in SENTINEL_RECENT_INPUTS:
            ratio = SequenceMatcher(a=previous, b=normalized_input).ratio()
            if ratio >= 0.92:
                warnings.append(
                    StorySentinelWarning(
                        code="duplicate_or_near_duplicate_intent",
                        message="This beat intent looks very similar to a recent beat.",
                    )
                )
                break

    generic_titles = {
        "beat",
        "scene",
        "story",
        "next",
        "continue",
        "idea",
        "moment",
    }
    if len(words) <= 2 or normalized_input in generic_titles:
        warnings.append(
            StorySentinelWarning(
                code="likely_vague_beat_title",
                message="Beat intent may be too vague. Add a concrete subject or action.",
            )
        )

    context_keywords = {
        "who",
        "where",
        "when",
        "because",
        "after",
        "before",
        "during",
        "inside",
        "outside",
        "city",
        "room",
        "forest",
        "ship",
        "king",
        "detective",
    }
    has_context_signal = bool(re.search(r"\d", cleaned_input)) or any(
        keyword in words for keyword in context_keywords
    )
    if len(words) < 4 or not has_context_signal:
        warnings.append(
            StorySentinelWarning(
                code="likely_missing_context_signal",
                message="Beat may be missing context. Add who/where/when details.",
            )
        )

    generic_patterns = {
        "continue",
        "next beat",
        "something happens",
        "move forward",
        "keep going",
        "what happens next",
    }
    is_generic_pattern = any(pattern in normalized_input for pattern in generic_patterns)
    recent_generic = list(SENTINEL_RECENT_GENERIC_FLAGS)
    if is_generic_pattern and len(recent_generic) >= 3 and sum(recent_generic[-3:]) >= 2:
        warnings.append(
            StorySentinelWarning(
                code="likely_escalation_flatness",
                message="Recent beats look structurally similar. Consider a sharper escalation.",
            )
        )

    if normalized_input:
        SENTINEL_RECENT_INPUTS.append(normalized_input)
    SENTINEL_RECENT_GENERIC_FLAGS.append(is_generic_pattern)

    trace = ["story_sentinel_checked"]
    if warnings:
        trace.append("story_sentinel_warning_added")
    else:
        trace.append("story_sentinel_clear")

    return StorySentinelResult(warnings=warnings), trace


LORE_ANCHOR_FIELDS = ("character", "setting", "event", "theme", "backstory", "prop")
LORE_PATTERN = re.compile(
    r"(?:^|[,;])\s*(character|setting|event|theme|backstory|prop)\s*:\s*([^,;]+)",
    re.IGNORECASE,
)


def extract_lore_pool(user_input: str) -> LorePool:
    anchors: dict[str, list[str]] = {field: [] for field in LORE_ANCHOR_FIELDS}

    for anchor_type, raw_value in LORE_PATTERN.findall(user_input):
        anchor_key = anchor_type.strip().lower()
        anchor_value = raw_value.strip()
        if not anchor_value:
            continue
        if anchor_value not in anchors[anchor_key]:
            anchors[anchor_key].append(anchor_value)

    return LorePool(**anchors)


def normalize_lore_term(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9 ]", " ", value.lower())
    return " ".join(collapsed.split())


def get_lore_term_set(lore_pool: LorePool) -> set[str]:
    terms: set[str] = set()
    for anchor_type in LORE_ANCHOR_FIELDS:
        for item in getattr(lore_pool, anchor_type):
            normalized_item = normalize_lore_term(item)
            if normalized_item:
                terms.add(normalized_item)
    return terms


def run_three_clue_rule(lore_pool: LorePool) -> tuple[list[StorySentinelWarning], list[str]]:
    trace = ["three_clue_check_started"]
    suggestions: list[StorySentinelWarning] = []

    populated_anchor_count = sum(
        1 for anchor_type in LORE_ANCHOR_FIELDS if getattr(lore_pool, anchor_type)
    )
    hard_anchor_count = sum(
        1 for anchor_type in ("character", "setting", "event") if getattr(lore_pool, anchor_type)
    )

    current_terms = get_lore_term_set(lore_pool)
    recent_term_sets = list(SENTINEL_RECENT_LORE_TERMS)
    has_recent_lore = len(recent_term_sets) > 0
    overlap_found = bool(current_terms) and any(
        bool(current_terms.intersection(previous_terms)) for previous_terms in recent_term_sets
    )

    if populated_anchor_count <= 1:
        suggestions.append(
            StorySentinelWarning(
                code="three_clue_underconnected",
                message="This beat may be underconnected. Consider adding another connective clue.",
            )
        )

    if hard_anchor_count == 0:
        suggestions.append(
            StorySentinelWarning(
                code="three_clue_missing_hard_anchor",
                message="Consider adding a character, setting, or event anchor.",
            )
        )

    if has_recent_lore and not overlap_found:
        suggestions.append(
            StorySentinelWarning(
                code="three_clue_low_overlap",
                message="This beat has low overlap with recent lore. Add a connective anchor for continuity.",
            )
        )

    if current_terms:
        SENTINEL_RECENT_LORE_TERMS.append(current_terms)

    if suggestions:
        trace.append("three_clue_rule_suggestion_added")
    else:
        trace.append("three_clue_rule_clear")

    return suggestions, trace


def extract_live_text(live_event: Any) -> str:
    event_text = getattr(live_event, "text", None)
    if isinstance(event_text, str) and event_text.strip():
        return event_text.strip()

    server_content = getattr(live_event, "server_content", None)
    model_turn = getattr(server_content, "model_turn", None)
    parts = getattr(model_turn, "parts", None) or []

    collected_parts: list[str] = []
    for part in parts:
        part_text = getattr(part, "text", None)
        if isinstance(part_text, str) and part_text.strip():
            collected_parts.append(part_text.strip())
    return " ".join(collected_parts).strip()


def generate_standard_director_response(user_input: str) -> tuple[str, list[str]]:
    cleaned_input = user_input.strip()
    if not cleaned_input:
        cleaned_input = "story idea"

    trace = ["input_received", "model_call_started"]
    logger.info("model_call_started")

    try:
        model_name = os.getenv("GEMINI_TEXT_MODEL", "").strip()
        if not model_name:
            raise RuntimeError("GEMINI_TEXT_MODEL is not configured.")

        prompt = build_director_prompt(cleaned_input)

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


def generate_live_director_response(user_input: str) -> tuple[str, list[str]]:
    cleaned_input = user_input.strip()
    if not cleaned_input:
        cleaned_input = "story idea"

    trace = ["input_received", "live_session_started"]
    logger.info("live_session_started")

    try:
        live_model = os.getenv("GEMINI_LIVE_MODEL", "").strip()
        if not live_model:
            raise RuntimeError("GEMINI_LIVE_MODEL is not configured.")

        prompt = build_director_prompt(cleaned_input)
        client = get_genai_client()

        if not hasattr(client, "live"):
            raise RuntimeError("Google Gen AI client does not support live sessions.")

        response_text_parts: list[str] = []
        with client.live.connect(
            model=live_model,
            config={"response_modalities": ["TEXT"]},
        ) as session:
            session.send_client_content(
                turns=[{"role": "user", "parts": [{"text": prompt}]}],
                turn_complete=True,
            )
            trace.append("live_input_sent")
            logger.info("live_input_sent")

            for live_event in session.receive():
                event_text = extract_live_text(live_event)
                if event_text:
                    response_text_parts.append(event_text)

        response_text = " ".join(response_text_parts).strip()
        if not response_text:
            raise RuntimeError("Live session returned an empty response.")

        trace.extend(
            [
                "live_output_received",
                "live_session_closed",
                "response_generated",
                "graph_update_ready",
            ]
        )
        logger.info("live_output_received")
        logger.info("live_session_closed")
        return response_text, trace
    except Exception:
        logger.exception("live_session_failed")
        trace.extend(["live_session_failed", "live_fallback_to_standard"])
        standard_response, standard_trace = generate_standard_director_response(cleaned_input)
        trace.extend(
            event for event in standard_trace if event not in {"input_received"}
        )
        return standard_response, trace


def generate_director_response(user_input: str) -> tuple[str, list[str]]:
    if is_live_director_enabled():
        return generate_live_director_response(user_input)
    return generate_standard_director_response(user_input)


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
    lore_pool = extract_lore_pool(payload.user_input)
    story_sentinel, sentinel_trace = run_story_sentinel(
        user_input=payload.user_input,
        director_response=director_response,
    )
    three_clue_suggestions, three_clue_trace = run_three_clue_rule(lore_pool)
    combined_warnings = [*story_sentinel.warnings, *three_clue_suggestions]
    normalized_sentinel_trace = [
        event
        for event in sentinel_trace
        if event not in {"story_sentinel_warning_added", "story_sentinel_clear"}
    ]
    normalized_sentinel_trace.append(
        "story_sentinel_warning_added" if combined_warnings else "story_sentinel_clear"
    )
    return build_director_payload(
        user_input=payload.user_input,
        director_response=director_response,
        trace=[*trace, *normalized_sentinel_trace, *three_clue_trace],
        story_sentinel=StorySentinelResult(warnings=combined_warnings),
        lore_pool=lore_pool,
    )


@app.post("/storyboard/request", response_model=StoryboardRequestResponse)
def storyboard_request(payload: StoryboardRequestPayload) -> StoryboardRequestResponse:
    try:
        beat_id = payload.beat_id.strip()
        if not beat_id:
            raise ValueError("beat_id is required.")

        context_seed = "|".join(
            [
                beat_id,
                payload.beat_label.strip(),
                payload.beat_title.strip(),
                payload.beat_summary.strip(),
                ",".join(payload.lore_pool.character),
                ",".join(payload.lore_pool.setting),
                ",".join(payload.lore_pool.event),
            ]
        )
        checksum = sum(ord(char) for char in context_seed)
        job_id = f"storyboard-{checksum % 100000}-{int(time.time())}"

        logger.info("storyboard_generation_started beat_id=%s", beat_id)
        return StoryboardRequestResponse(
            job_id=job_id,
            beat_id=beat_id,
            status="requested",
            trace=["storyboard_generation_started"],
            message="Storyboard request accepted (mock).",
        )
    except ValueError as err:
        logger.warning("storyboard_request_failed: %s", err)
        raise HTTPException(
            status_code=400,
            detail={"message": str(err), "trace": ["storyboard_request_failed"]},
        ) from err
    except Exception as err:
        logger.exception("storyboard_request_failed")
        raise HTTPException(
            status_code=500,
            detail={"message": "Storyboard request failed.", "trace": ["storyboard_request_failed"]},
        ) from err
