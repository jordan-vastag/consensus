# Requirements

## Overview

Consensus is a group decision-making application. One user hosts a session from their device, and other users join from their devices via a session code. Participants collaboratively build a list of choices, vote on them, and receive a ranked result.

## Tech Stack

- **Backend**: Go (Gin framework)
- **Frontend**: Next.js (React, plain JS)
- **Database**: MongoDB
- **Package Manager**: Yarn
- **Containerization**: Docker Compose
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Real-time Communication**: WebSockets (Gorilla)
- **Drag-and-Drop**: @dnd-kit (for ranked choice voting)

## Session Flow

```
HOST/JOIN --> LOBBY --> ADD CHOICES --> VOTING --> RESULTS (permalink)
```

### 1. Hosting a Session

A user hosts a session from their device. They are presented with a form to configure the session.

**Required fields:**
- Session title
- Host display name

**Configuration options:**
- Min choices per member (default: 1)
- Max choices per member (default: unlimited)
- Voting mode: yes/no or ranked choice
- Anonymize votes (boolean)
- Grace period before phase transitions (0-30 seconds)
- Allow members with empty choice lists to vote (boolean)

On creation, a unique 6-character session code is generated.

### 2. Joining a Session

Users join by entering the 6-character session code on the landing page. They provide a display name and are added to the session lobby.

- The session phase is validated before allowing a join — users cannot join a session that has moved past the lobby phase
- Session data is persisted in localStorage to allow reconnection if a user is disconnected
- On reconnect, users are returned to the phase they were in, including waiting screens if they had already submitted choices or votes

### 3. Lobby Phase

- All members see the member list with connection and ready status
- Members can toggle their ready status
- Members can change their display name
- The session code can be copied to clipboard; the join link can be shared
- When **all members are ready**, the session automatically transitions to the Add Choices phase
- The host can manually start the next phase at any time
  - If members are actively editing, the host is asked to confirm
  - A configurable grace period countdown runs before the transition

### 4. Add Choices / Create List Phase

- Each member creates their own list of choices
- Choices can be added as plaintext (current implementation)
- Min/max choice constraints are enforced with validation
- Members can edit or remove individual choices, or clear all choices
- Members submit their list when ready
- A waiting room shows submission status for all members
- If a member refreshes after submitting, they return to the waiting screen (not the choice creation screen)
- When **all members have submitted**, individual lists are combined into a single shuffled aggregate list and the session transitions to the Voting phase

### 5. Voting Phase

The combined aggregate list is presented to each member for voting. The presentation and interaction depends on the configured voting mode.

#### Yes/No Voting Mode
- **Carousel view**: Choices are shown one at a time. The member votes thumbs up (yes) or thumbs down (no) and navigates with arrows.
- **Review view**: After voting on all choices, the member sees a list view of all choices with their votes. They can click any choice to change their vote. Unvoted choices are marked with an asterisk.
- Member submits their votes when satisfied.

#### Ranked Choice Voting Mode
- All choices are shown at once in a scrollable list on a single card
- Members reorder choices by dragging via a grip handle, or by entering a rank number in the text input to the right of each choice
- Changing the rank number moves the choice to that position and renumbers all other choices
- A submit button at the bottom submits the ranking (no separate review screen)
- Backend uses Borda count scoring: rank 1 gets N points, rank 2 gets N-1 points, etc.

#### Voting Rules
- A waiting room shows voting status for all members
- If a member refreshes after submitting votes, they return to the waiting screen
- When **all members have submitted votes**, the session transitions to the Results phase
- The host can manually end voting before all members submit (requires confirmation)
  - Unsubmitted votes are not counted

### 6. Results / Final Phase

- The aggregate list is sorted by score (most votes/points to least) and displayed to all members
- A unique permalink is generated (format: `/results/<unique_id>`) and saved to the database
- The session is automatically closed
- All users are redirected to the permalink results page
- The results page includes a share button that copies the permalink to the clipboard
- The ranked list is the final output of the session

### 7. Permalink Access

After the session is complete, the ranked results can be viewed at any future time by visiting the permalink URL (`/results/<id>`). The results page displays the session title, ranked choices with scores, and a share button.

## Choice Sources

Currently, only plaintext choices are supported. Future integrations will allow members to add choices from external sources:

| Source | Capability | Status |
|--------|-----------|--------|
| Plaintext | Manual text entry | Implemented |
| TMDB | Search and add movies | Backend implemented, frontend not integrated |
| Letterboxd | Import choices from a Letterboxd list | Planned |
| Airbnb | Search and add stays/BnBs | Planned |
| Google Maps / Apple Maps / OpenStreetMaps | Add locations from a list or via search | Planned |

Choices added via integration carry metadata (thumbnails, descriptions, ratings, etc.) that is displayed during the voting phase.

Members can add comments/descriptions to any choice regardless of source.

## Non-Functional Requirements

- Application is containerized with Docker Compose
- All errors are logged
- Metrics are emitted (request counts per endpoint, availability)
- Unit tests are written
- WebSocket-based real-time sync for all phase transitions and member state changes
- Session recovery via localStorage on disconnect, respecting current phase and submission state
- Session phase and member submission/voting state persisted to database for crash recovery
