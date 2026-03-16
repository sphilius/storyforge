from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/director/ping")
def director_ping():
    return {
        "director_response": "I’m online. Give me a story impulse and I’ll shape it.",
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