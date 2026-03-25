# CLAUDE.md

## Project Overview

Consensus — a group decision-making web app. See REQUIREMENTS.md for full product requirements.

## Tech Stack

- **Backend**: Go 1.25, Gin framework, Gorilla WebSocket, MongoDB driver
- **Frontend**: Next.js 16, React 19, plain JS (no TypeScript), shadcn/ui, Tailwind CSS 4
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
    session.go         # Session, member, choice, vote HTTP handlers
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
    handler.go         # WebSocket upgrade handler
    client.go          # Individual client read/write pumps
    messages.go        # Inbound/outbound message type definitions
  database/
    db.go              # MongoDB connection
  integrations/
    tmdb.go            # TMDB API client

frontend/
  app/
    page.jsx           # Landing page (host/join forms)
    api.js             # API client functions (hardcoded localhost:8080)
    s/[code]/page.jsx  # Main session page (~1060 lines, all phases)
    layout.jsx         # Root layout, Sonner toasts
  hooks/
    useSessionWebSocket.js  # WebSocket hook with auto-reconnect
  components/ui/       # shadcn/ui components
```

## Key Patterns

- **WebSocket callbacks**: Hub triggers callbacks (OnAllReady, OnAllSubmitted, OnAllVoted) that are wired in main.go to perform business logic (phase transitions, choice aggregation, vote ranking)
- **Phase state machine**: lobby -> voting -> submitted -> results -> submitted_votes -> final
- **Session state**: WebSocket hub holds ephemeral state (ready, submitted, voted maps); MongoDB persists durable state
- **Frontend phases**: Single page component (`s/[code]/page.jsx`) renders different UI based on `sessionState.phase`

## API Routes

```
POST   /api/session                              # Create session
GET    /api/session/:code                         # Get session
POST   /api/session/:code/join                    # Join session
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
GET    /api/integrations/tmdb/search?q=&page=     # TMDB search
```

## WebSocket Messages

**Inbound** (client -> server): `set_ready`, `submit_choices`, `submit_votes`
**Outbound** (server -> client): `member_joined`, `member_left`, `member_ready`, `phase_changed`, `connected_users`, `member_submitted`, `member_voted`

## Current State

### Implemented
- Full session lifecycle: create, join, lobby, choices, voting, results
- Yes/no voting with carousel + review UI
- WebSocket real-time sync for all state transitions
- TMDB search backend endpoint
- Session recovery via localStorage

### Known TODOs (in code)
- Member name URL params should be query params (special char issues)
- JoinSession should check session phase is "lobby"
- UpdateSessionConfig / CloseSession should validate session is active
- WebSocket CheckOrigin should restrict to allowed origins
- Ranked choice voting UI not implemented
- Grace period countdown UI not implemented
- TMDB integration not exposed in frontend choice creation
- Structured logging and metrics not implemented

## Testing

- Bruno collection in `test/` directory for manual API testing
- WebSocket tests in `backend/websocket/ws_test.go` and `integration_test.go`
- Run backend tests: `cd backend && go test ./...`

## Conventions

- Commit messages use conventional format: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`
- Frontend uses plain JS (not TypeScript) with JSX
- SVG icons stored in `frontend/public/`
- UI components from shadcn (in `frontend/components/ui/`)
