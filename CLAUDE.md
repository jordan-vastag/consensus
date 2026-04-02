# CLAUDE.md

## Project Overview

Consensus — a group decision-making web app. See REQUIREMENTS.md for full product requirements.

## Tech Stack

- **Backend**: Go 1.25, Gin framework, Gorilla WebSocket, MongoDB driver
- **Frontend**: Next.js 16, React 19, plain JS (no TypeScript), shadcn/ui, Tailwind CSS 4, @dnd-kit (drag-and-drop)
- **Database**: MongoDB 8 (collection: `session`, database: `dev`)
- **Package Manager**: Yarn (frontend)
- **Containerization**: Docker Compose (backend:8080, frontend:3000, mongo:27017)

## Running Locally

```bash
# Run mongo via Docker, backend and frontend directly
docker compose up mongo

# Backend
cd backend && go run main.go

# Frontend
cd frontend && yarn dev
```

## Project Structure

```
backend/
  main.go              # Entry point, routes, WebSocket callbacks
  handlers/
    session.go         # Session, member, choice, vote, results HTTP handlers
    integrations.go    # TMDB search handler
    constants.go       # Handler constants
  models/
    entities.go        # Session, Member, Choice, Vote, SessionConfig
    requests.go        # HTTP request models
    responses.go       # HTTP response models
  repository/
    repository.go      # MongoDB data access layer
  websocket/
    hub.go             # Connection hub, state management, callbacks
    handler.go         # WebSocket upgrade handler (restores submitted/voted from DB)
    client.go          # Individual client read/write pumps
    messages.go        # Inbound/outbound message type definitions
  database/
    db.go              # MongoDB connection
  integrations/
    tmdb.go            # TMDB API client

frontend/
  app/
    page.jsx           # Landing page (host/join forms, session phase check on join)
    api.js             # API client functions (hardcoded localhost:8080)
    s/[code]/page.jsx  # Main session page (all phases except final results)
    results/[id]/page.jsx  # Permalink results page
    layout.jsx         # Root layout, Sonner toasts
  hooks/
    useSessionWebSocket.js  # WebSocket hook with auto-reconnect
  components/ui/       # shadcn/ui components
```

## Key Patterns

- **WebSocket callbacks**: Hub triggers callbacks (OnAllReady, OnMemberSubmitted, OnAllSubmitted, OnMemberVoted, OnAllVoted) wired in main.go to perform business logic (phase transitions, choice aggregation, vote ranking, session close)
- **Phase state machine**: lobby -> voting -> submitted -> results -> submitted_votes -> final (redirect to permalink)
- **Persistent state**: Session phase, member submitted/voted flags, and permalink are persisted to MongoDB. On reconnect, the WebSocket handler restores submitted/voted state from DB onto the client, and the hub uses it during registration.
- **Frontend phases**: Single page component (`s/[code]/page.jsx`) renders different UI based on `sessionState.phase`. Final results live at `/results/[id]`.
- **Voting modes**: Yes/no (carousel + review) and ranked choice (drag-and-drop sortable list with rank number inputs). Backend uses Borda count scoring for ranked choice.
- **User badge**: All session cards show the current user's name + icon in the top-right via `UserBadge` component.

## API Routes

```
POST   /api/session                              # Create session
GET    /api/session/:code                         # Get session
POST   /api/session/:code/join                    # Join session (lobby phase only)
POST   /api/session/:code/leave                   # Leave session
PUT    /api/session/:code/config                  # Update config
POST   /api/session/:code/close                   # Close session
GET    /api/session/:code/member/:name            # Get member
PUT    /api/session/:code/member/:name            # Update member
GET    /api/session/:code/members                 # Get all members
POST   /api/session/:code/member/:name/choice     # Add choice
GET    /api/session/:code/member/:name/choice     # Get member choices
PUT    /api/session/:code/member/:name/choice     # Update choice
DELETE /api/session/:code/member/:name/choice/:title  # Remove choice
DELETE /api/session/:code/member/:name/choice     # Clear choices
POST   /api/session/:code/member/:name/votes      # Submit votes
GET    /api/session/:code/ws?name=memberName      # WebSocket
GET    /api/results/:id                           # Get results by permalink
GET    /api/integrations/tmdb/search?q=&page=     # TMDB search
```

## WebSocket Messages

**Inbound** (client -> server): `set_ready`, `submit_choices`, `submit_votes`
**Outbound** (server -> client): `member_joined`, `member_left`, `member_ready`, `phase_changed` (includes `permalink` on final), `connected_users`, `member_submitted`, `member_voted`

## Current State

### Implemented
- Full session lifecycle: create, join, lobby, choices, voting, results, permalink
- Yes/no voting with carousel + review UI
- Ranked choice voting with drag-and-drop sortable list (@dnd-kit) and rank number inputs
- Borda count scoring for ranked choice (rank 1 = N points, rank N = 1 point)
- WebSocket real-time sync for all state transitions
- Session phase persisted to DB (lobby, voting, results, final)
- Member submitted/voted flags persisted to DB and restored on WebSocket reconnect
- Permalink generated on session completion, results accessible at `/results/:id`
- Session auto-closed when all votes are in
- Join blocked for sessions past lobby phase (backend + frontend validation)
- Session recovery via localStorage on disconnect (respects current phase)
- User badge on all session cards
- Copy join code button in lobby
- Share button on results page (copies permalink)
- TMDB search backend endpoint

### Known TODOs
- Dark mode (WIP)
- Restrict length of names and titles (validation)
- On join session card, show session title & code instead of only the code
- Cancel button on join should work immediately (not wait for name check request)
- Anonymize votes option (config exists, not enforced in UI)
- Allow non-choice adders to vote (config exists, not enforced)
- Asynchronous mode
- Responsive UI
- Share session modal
- Comments on choices (restricted length, viewable on results page)
- Choice integrations: TMDB (backend done, frontend not integrated), Map (OpenStreetMaps/Google Maps), Letterboxd, Airbnb
- Information modal
- About page
- Member name URL params should be query params (special char issues)
- UpdateSessionConfig / CloseSession should validate session is active
- WebSocket CheckOrigin should restrict to allowed origins
- Grace period countdown UI not implemented
- Structured logging and metrics not implemented
- Deployment config

## Testing

- Bruno collection in `test/` directory for manual API testing
- WebSocket tests in `backend/websocket/ws_test.go` and `integration_test.go`
- Run backend tests: `cd backend && go test ./...`

## Conventions

- Commit messages use conventional format: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`
- Frontend uses plain JS (not TypeScript) with JSX
- SVG icons stored in `frontend/public/`
- UI components from shadcn (in `frontend/components/ui/`)
- After backend changes, kill and restart with `cd backend && go run main.go`
