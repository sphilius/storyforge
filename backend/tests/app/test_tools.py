import pytest
from unittest.mock import patch
from backend.app.tools import (
    update_scene,
    introduce_character,
    generate_storyboard_prompt,
    generate_image_prompt,
)

@patch('time.time', return_value=1234567.89)
def test_update_scene_basic(mock_time):
    result = update_scene(
        scene_title="Tokyo Alley Chase",
        setting="rain-soaked alley in Shinjuku",
        mood="tense",
        time_of_day="midnight",
        key_elements="neon signs, puddles, steam"
    )

    assert result["status"] == "scene_created"
    assert result["scene"]["title"] == "Tokyo Alley Chase"
    assert result["scene"]["key_elements"] == ["neon signs", "puddles", "steam"]
    assert result["scene"]["created_at"] == 1234567.89
    assert result["scene"]["scene_number"] is None

@patch('time.time', return_value=1234567.89)
def test_introduce_character_basic(mock_time):
    result = introduce_character(
        name="Detective Sato",
        role="protagonist",
        physical_description="tall, lean, mid-40s Japanese man",
        personality_traits="stoic, observant, haunted",
        wardrobe="rumpled trench coat, loosened tie",
        distinguishing_features="scar above left eye"
    )

    assert result["status"] == "character_registered"
    assert result["character"]["name"] == "Detective Sato"
    assert result["character"]["personality_traits"] == ["stoic", "observant", "haunted"]
    assert "scar above left eye" in result["character"]["visual_prompt_fragment"]

@patch('time.time', return_value=1234567.89)
def test_generate_storyboard_prompt_basic(mock_time):
    result = generate_storyboard_prompt(
        scene_description="woman walks toward camera",
        shot_type="wide establishing",
        characters_in_frame="Detective Sato, Mystery Woman",
        lighting="neon-lit",
        camera_angle="low angle"
    )

    assert result["status"] == "storyboard_ready"
    assert result["panel"]["shot_type"] == "wide establishing"
    assert result["panel"]["characters_in_frame"] == ["Detective Sato", "Mystery Woman"]
    assert "low angle" in result["image_prompt"]

@patch('time.time', return_value=1234567.89)
def test_generate_image_prompt_basic(mock_time):
    result = generate_image_prompt(
        subject="Detective Sato character portrait",
        visual_style="photorealistic noir",
        details="rain-wet, dramatic shadows"
    )

    assert result["status"] == "image_prompt_ready"
    assert result["image"]["type"] == "concept_image"
    assert result["image"]["aspect_ratio"] == "16:9"
    assert "photorealistic noir" in result["image_prompt"]
