# StoryForge PRD

## One-line product definition
A live spatial-temporal storytelling system that lets creators talk through ideas, inspect narrative structure, interview characters, and generate visual story artifacts.

## Target demo goal
Deliver one coherent, legible, technically credible live demo loop for the Gemini Live Agent Challenge.

## Demo loop
1. User speaks an idea or request
2. Director responds in voice
3. Trace View shows what the system is doing
4. Story graph updates on the canvas
5. Story Sentinel surfaces compact continuity/logic warnings, including soft three-clue suggestions
6. User selects a beat and edits title/summary/notes + lore anchors in the right panel
7. User triggers storyboard generation for a selected beat
8. Storyboard frames appear asynchronously
9. User interrupts, revises, and continues

## Primary users
- visually minded writers
- worldbuilders
- game writers
- directors
- system thinkers

## Must-ship features
- Live voice + interruption
- React Flow scene graph
- Selected beat inspection + editing in right panel (frontend-only for now)
- Gemini-backed Director text response in backend (`/director/respond`)
- Story Sentinel warning layer (lightweight heuristic checks + visible right-panel warnings)
- Flexible lore pool per beat (character, setting, event, theme, backstory, prop)
- Soft three-clue rule support (suggestive connective-richness checks, not hard blocking)
- Beat -> storyboard request initiation from selected beat context
- Async storyboard generation
- Trace View
- Character Interview Mode (1 active character)
- Story Sentinel
- Import flow
- Flexible lore pool + soft three-clue rule

## Non-goals for hackathon build
- backend beat edit persistence or edit endpoints
- full persona authoring UI
- multi-character simultaneous live conversation
- full 2.5D diorama simulation
- true model interpretability tooling
