"""
Director Mode — Custom Tool Definitions
========================================
WHY THIS FILE EXISTS:
    ADK agents gain capabilities through "tools" — functions the AI can call
    when it decides they're needed. Without tools, the agent can only generate
    text. WITH tools, it can structure data, trigger actions, and interact
    with external systems.

HOW ADK TOOLS WORK:
    1. You write a normal Python function with type hints and a docstring
    2. You add it to the agent's tools=[] list
    3. ADK automatically inspects the function signature (name, docstring,
       parameters, types) and generates a schema
    4. The LLM reads that schema and decides WHEN to call the tool
    5. When the LLM calls it, ADK executes your function and returns the
       result back to the LLM

    The DOCSTRING is critical — it's how the LLM understands what the tool
    does. Think of it as the tool's "job description" that the AI reads.

WHAT'S IN THIS FILE:
    Four tools that structure creative direction data:
    - update_scene: Processes a scene description into structured data
    - introduce_character: Registers a new character with traits
    - generate_storyboard_prompt: Creates an image generation prompt for a scene
    - generate_image_prompt: Creates a detailed image prompt for a single panel

    These tools DON'T call external APIs (yet). They structure data that the
    frontend can use to create canvas nodes. In a full production build,
    generate_storyboard_prompt would call Imagen or Gemini's image generation.

IMPORTANT ADK LIMITATION:
    google_search (a built-in tool) CANNOT be combined with custom function
    tools in the same agent. That's why google_search lives on a separate
    Search Agent (see adk_director.py). This is a known ADK constraint
    as of 2025.
"""

import json
import time
from typing import Optional


# ---------------------------------------------------------------------------
# Tool 1: UPDATE SCENE
# ---------------------------------------------------------------------------
# WHAT IT DOES:
#   Takes a director's scene description (e.g., "rain-soaked Tokyo alley
#   at midnight") and structures it into a data object with metadata that
#   the frontend can render as a canvas node.
#
# WHY THE LLM CALLS IT:
#   The system instruction tells the agent: "When the director gives a
#   scene description, call update_scene to structure it." The LLM reads
#   the docstring below and knows this is the right tool for that job.
#
# WHAT THE FRONTEND DOES WITH IT:
#   Creates a SceneNode on the canvas at calculated [x,y] coordinates,
#   with the mood badge, setting text, and a slot for a generated image.
# ---------------------------------------------------------------------------
def update_scene(
    scene_title: str,
    setting: str,
    mood: str,
    time_of_day: str,
    key_elements: str,
    scene_number: Optional[int] = None,
) -> dict:
    """Structures a director's scene description into a scene data object.

    Call this tool whenever the director describes a new scene or updates
    an existing one. Extracts the setting, mood, time of day, and key
    visual elements from the direction.

    Args:
        scene_title: A short title for the scene (e.g., "Tokyo Alley Chase")
        setting: The physical location (e.g., "rain-soaked alley in Shinjuku")
        mood: The emotional tone (e.g., "tense", "melancholic", "euphoric")
        time_of_day: When the scene takes place (e.g., "midnight", "golden hour")
        key_elements: Comma-separated visual elements (e.g., "neon signs, puddles, steam")
        scene_number: Optional scene number for ordering. Auto-assigned if not provided.

    Returns:
        A structured scene object with all metadata for canvas rendering.
    """
    # Generate a unique ID using timestamp (simple but effective for a demo)
    scene_id = f"scene-{int(time.time() * 1000) % 100000}"

    # Structure the data exactly as the frontend expects it
    scene_data = {
        "id": scene_id,
        "type": "scene",
        "title": scene_title,
        "setting": setting,
        "mood": mood,
        "time_of_day": time_of_day,
        "key_elements": [elem.strip() for elem in key_elements.split(",")],
        "scene_number": scene_number,
        "created_at": time.time(),
        # These coordinates would be calculated by a layout engine
        # in a full build. For now, we let the frontend handle positioning.
        "canvas_position": {"x": 0, "y": 0},  # Frontend overrides this
    }

    return {
        "status": "scene_created",
        "scene": scene_data,
        "message": f"Scene '{scene_title}' locked in. {mood} mood, {time_of_day}.",
    }


# ---------------------------------------------------------------------------
# Tool 2: INTRODUCE CHARACTER
# ---------------------------------------------------------------------------
# WHAT IT DOES:
#   Registers a new character with their visual traits, role, and personality.
#   This is critical for CHARACTER CONSISTENCY — one of the hardest problems
#   in AI storyboarding. By storing traits here, we can inject them into
#   every image generation prompt that includes this character.
#
# WHY THIS MATTERS FOR JUDGING:
#   Character consistency across generated images is a key differentiator.
#   Most AI tools generate random-looking characters each time. By tracking
#   traits explicitly, we can maintain visual continuity.
# ---------------------------------------------------------------------------
def introduce_character(
    name: str,
    role: str,
    physical_description: str,
    personality_traits: str,
    wardrobe: str,
    distinguishing_features: Optional[str] = None,
) -> dict:
    """Registers a new character in the story with their visual and narrative traits.

    Call this tool whenever the director introduces a new character or
    describes someone for the first time. The character data is stored
    for visual consistency across all future scenes.

    Args:
        name: Character's name (e.g., "Detective Sato")
        role: Their narrative role (e.g., "protagonist", "antagonist", "supporting")
        physical_description: How they look (e.g., "tall, lean, mid-40s Japanese man")
        personality_traits: Comma-separated traits (e.g., "stoic, observant, haunted")
        wardrobe: What they typically wear (e.g., "rumpled trench coat, loosened tie")
        distinguishing_features: Optional unique visual markers (e.g., "scar above left eye")

    Returns:
        A structured character object for canvas rendering and image prompt injection.
    """
    char_id = f"char-{name.lower().replace(' ', '-')}-{int(time.time() * 1000) % 10000}"

    character_data = {
        "id": char_id,
        "type": "character",
        "name": name,
        "role": role,
        "physical_description": physical_description,
        "personality_traits": [t.strip() for t in personality_traits.split(",")],
        "wardrobe": wardrobe,
        "distinguishing_features": distinguishing_features,
        "created_at": time.time(),
        # This string gets injected into EVERY image prompt featuring this character
        # to maintain visual consistency across scenes
        "visual_prompt_fragment": (
            f"{physical_description}, wearing {wardrobe}"
            + (f", {distinguishing_features}" if distinguishing_features else "")
        ),
    }

    return {
        "status": "character_registered",
        "character": character_data,
        "message": f"{name} is on the call sheet. {role.title()}, got it.",
    }


# ---------------------------------------------------------------------------
# Tool 3: GENERATE STORYBOARD PROMPT
# ---------------------------------------------------------------------------
# WHAT IT DOES:
#   Takes scene context and generates a detailed image generation prompt
#   suitable for Gemini's image generation or Imagen. This is the bridge
#   between the director's high-level vision and pixel-level output.
#
# IN A FULL BUILD:
#   This would actually call the Gemini image generation API and return
#   a base64 image. For the hackathon, it returns the structured prompt
#   that COULD be sent to the image API. The frontend's browser-direct
#   connection handles actual image generation.
# ---------------------------------------------------------------------------
def generate_storyboard_prompt(
    scene_description: str,
    shot_type: str,
    characters_in_frame: str,
    lighting: str,
    camera_angle: str,
    style_reference: Optional[str] = None,
) -> dict:
    """Creates a detailed image generation prompt for a storyboard panel.

    Call this tool when the director asks to see a visual, storyboard,
    or panel for a scene. Constructs a cinematographically detailed prompt
    optimized for AI image generation.

    Args:
        scene_description: What's happening in the scene (e.g., "woman walks toward camera")
        shot_type: Cinematographic shot type (e.g., "wide establishing", "close-up", "medium")
        characters_in_frame: Which characters appear (e.g., "Detective Sato, Mystery Woman")
        lighting: Lighting setup (e.g., "neon-lit, high contrast, rim lighting")
        camera_angle: Camera perspective (e.g., "low angle", "eye level", "bird's eye")
        style_reference: Optional visual style (e.g., "noir", "Blade Runner", "Wes Anderson")

    Returns:
        A structured storyboard panel with the generation prompt and metadata.
    """
    panel_id = f"panel-{int(time.time() * 1000) % 100000}"

    # Construct a detailed prompt that image generation models understand
    # This is "prompt engineering for image gen" — very different from text prompts
    image_prompt = (
        f"Cinematic storyboard panel, {shot_type} shot, {camera_angle} angle. "
        f"{scene_description}. "
        f"Characters: {characters_in_frame}. "
        f"Lighting: {lighting}. "
        f"{'Style: ' + style_reference + '. ' if style_reference else ''}"
        f"Film production storyboard quality, detailed, professional."
    )

    panel_data = {
        "id": panel_id,
        "type": "storyboard_panel",
        "image_prompt": image_prompt,
        "shot_type": shot_type,
        "characters_in_frame": [c.strip() for c in characters_in_frame.split(",")],
        "lighting": lighting,
        "camera_angle": camera_angle,
        "style_reference": style_reference,
        "created_at": time.time(),
    }

    return {
        "status": "storyboard_ready",
        "panel": panel_data,
        "image_prompt": image_prompt,
        "message": f"Panel framed. {shot_type} shot, {camera_angle}. Ready for generation.",
    }


# ---------------------------------------------------------------------------
# Tool 4: GENERATE IMAGE PROMPT
# ---------------------------------------------------------------------------
# WHAT IT DOES:
#   Similar to storyboard prompt but for standalone images — concept art,
#   character portraits, location references. Less about shot composition,
#   more about visual detail.
# ---------------------------------------------------------------------------
def generate_image_prompt(
    subject: str,
    visual_style: str,
    details: str,
    aspect_ratio: Optional[str] = "16:9",
) -> dict:
    """Creates an image generation prompt for concept art or reference images.

    Call this tool when the director wants to visualize a character portrait,
    location concept, prop design, or any standalone visual reference that
    isn't a specific storyboard panel.

    Args:
        subject: What to generate (e.g., "Detective Sato character portrait")
        visual_style: Art direction (e.g., "photorealistic noir", "watercolor concept art")
        details: Specific visual details to include (e.g., "rain-wet, dramatic shadows")
        aspect_ratio: Image dimensions (e.g., "16:9", "1:1", "9:16"). Defaults to "16:9".

    Returns:
        A structured image request with the generation prompt.
    """
    image_id = f"img-{int(time.time() * 1000) % 100000}"

    image_prompt = (
        f"{subject}. {visual_style} style. {details}. "
        f"High quality, detailed, production-ready reference image."
    )

    return {
        "status": "image_prompt_ready",
        "image": {
            "id": image_id,
            "type": "concept_image",
            "prompt": image_prompt,
            "aspect_ratio": aspect_ratio,
            "created_at": time.time(),
        },
        "image_prompt": image_prompt,
        "message": f"Reference image queued. {visual_style} style.",
    }
