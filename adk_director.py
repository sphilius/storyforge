from google.adk.agents import LlmAgent
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.adk.tools import google_search  # ← This is your grounding fix too

director_mode_agent = LlmAgent(
    model="gemini-3.1-pro-preview",  # or your current model string
    name="director_mode_agent",
    description="An AI cinematographer that converts voice directions into storyboards",
    instruction=ENHANCED_SYSTEM_INSTRUCTION,  # your existing persona prompt
    tools=[
        generate_image,        # wrap existing as FunctionTool
        generate_storyboard,
        update_scene,
        introduce_character,
        google_search,         # ← grounding, 30% criterion solved
    ]
)

session_service = InMemorySessionService()
runner = Runner(agent=director_mode_agent, session_service=session_service)