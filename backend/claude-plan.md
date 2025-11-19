# Implementation Plan

Drafted by Claude Code

## Data Models

### Session/Lobby

- ID, code (unique), question
- Host user ID
- Configuration:
  - Anonymity mode (bool)
  - Voting mode: yes_no or ranked_choice
  - Min/max choices per user
  - Grace period length
  - Allow empty-listers to vote (bool)
- State: lobby, grace_period, voting, completed
- Timestamps, grace period start time

### User/Member

- ID, session ID
- Display name (editable)
- Ready status, has voted status
- Is actively editing (for host confirmations)

### Choice

- ID, session ID, submitted by user ID
- Content/title
- Source: manual, tmdb, letterboxd, gmaps
- Metadata (JSON - varies by source, includes thumbnails)
- User comment
- Vote count (yes/no mode) or weighted score (ranked mode)

### List (user's collection of choices)

- User ID, session ID
- Saved/draft status
- Last saved timestamp

### Vote

- User ID, choice ID
- Value: bool (yes/no mode) or int rank (ranked mode)
- Submitted status

## Core API Endpoints

### Session Management

- POST /sessions - Create session with config options
- POST /sessions/:code/join - Join session
- GET /sessions/:code - Get session details, state, config
- PATCH /sessions/:code/config - Update config (host only, lobby phase only)
- DELETE /sessions/:code - End session (host only)

### Lobby Phase

- PATCH /sessions/:code/members/:id/name - Update display name
- POST /sessions/:code/choices - Add choice (manual or via integration)
- PATCH /sessions/:code/choices/:id - Edit choice/comment
- DELETE /sessions/:code/choices/:id - Remove choice
- POST /sessions/:code/lists/save - Save list (auto-ready)
- POST /sessions/:code/lists/edit - Start editing (auto-unready)
- PATCH /sessions/:code/members/:id/ready - Toggle ready status
- POST /sessions/:code/start-voting - Host starts voting (with confirmation)
- POST /sessions/:code/cancel-grace - Cancel grace period (host only)

### Integration Endpoints

- GET /integrations/tmdb/search?q=... - Search TMDB
- GET /integrations/letterboxd/:list_id - Import Letterboxd list
- GET /integrations/gmaps/:list_id - Import Google Maps list

### Voting Phase

- GET /sessions/:code/aggregate-choices - Get combined list
- POST /sessions/:code/votes - Submit/update votes
- POST /sessions/:code/votes/submit - Finalize vote submission
- POST /sessions/:code/end-voting - Host ends voting early (with confirmation)
- GET /sessions/:code/results - Get sorted results

### Post-Voting

- GET /sessions/:code/results - View results with code (public after completion)

## Key Implementation Considerations

### Real-time Updates (Critical)

- WebSockets for: member join/leave, ready status, grace period countdown, phase transitions, active editing status
- SSE alternative

### Grace Period System

- Background timer/goroutine per session
- Cancelable by host
- Triggered by: all ready OR host manual start

### State Validation

- Enforce phase transitions
- Validate list saving (unsaved/empty lists excluded from aggregate)
- Check active editing before host starts voting

### Integration APIs

- TMDB API for movies
- Letterboxd scraping/API
- Google Maps API for lists
- Cache metadata/thumbnails

### Storage

- In-memory for MVP (with proper concurrency controls)
- Redis for production (session expiration, distributed locks)
- Postgres for persistence and post-voting access

### Non-functional Requirements

- Docker/docker-compose setup
- Structured logging (logrus/zap)
- Metrics middleware (prometheus - requests/endpoint, uptime)

### Security/Session Management

- JWT or session tokens per user-session pair
- Validate host privileges for protected actions
