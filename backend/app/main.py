from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


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


def build_director_payload(user_input: str) -> DirectorResponse:
    cleaned_input = user_input.strip()
    if not cleaned_input:
        cleaned_input = "story idea"
    excerpt = cleaned_input[:60]
    checksum = sum(ord(char) for char in cleaned_input)

    return DirectorResponse(
        director_response=f"Director: Building the next beat from '{excerpt}'.",
        trace=[
            "input_received",
            "intent_interpreted",
            "response_generated",
            "graph_update_ready",
        ],
        node=DirectorNode(
            id=f"node-{checksum % 10000}",
            label=f"Beat: {excerpt}",
            type="story",
            x=180 + (checksum % 220),
            y=100 + ((checksum // 3) % 220),
        ),
    )

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
    return build_director_payload("New Story Seed")


@app.post("/director/respond", response_model=DirectorResponse)
def director_respond(payload: DirectorRespondRequest) -> DirectorResponse:
    return build_director_payload(payload.user_input)
