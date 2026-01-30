Backend WebSocket Implementation Plan

---
Phase Transition Logic

When ALL members have ready=true, transition from lobby → voting immediately.
No grace period.

---
Message Types

Outbound (server → client):
- member_joined      { type, member }
- member_left        { type, memberName }
- member_ready       { type, memberName, ready }
- phase_changed      { type, phase, members }

Inbound (client → server):
- set_ready          { type, ready }

---
Architecture

1. Client (client.go)
   Server-side representation of a connected WebSocket user.
   - conn *websocket.Conn
   - send chan []byte
   - hub *Hub
   - sessionCode string
   - memberName string
   - readPump() - reads from conn, handles messages
   - writePump() - writes from send channel to conn

2. Hub (hub.go)
   Central connection manager. Single instance for the server.
   - sessions map[string]map[*Client]bool  (sessionCode → clients)
   - register chan *Client
   - unregister chan *Client
   - Run() - main loop processing register/unregister
   - BroadcastToSession(sessionCode, message)
   - GetSessionClients(sessionCode) []*Client

3. Messages (messages.go)
   Type definitions for all WebSocket messages.
   - OutboundMessage interface
   - MemberJoinedMsg, MemberLeftMsg, MemberReadyMsg, PhaseChangedMsg
   - InboundMessage with Type field for routing

4. Handler (handler.go)
   HTTP upgrade endpoint: GET /api/session/:code/ws?name=memberName
   - Validate session exists and is active
   - Validate member is in session
   - Upgrade connection
   - Create Client, register with Hub
   - Start readPump/writePump

---
Integration Points

Modify existing handlers to broadcast:
- JoinSession → broadcast member_joined
- (future) LeaveSession → broadcast member_left
- (future) SetReady → broadcast member_ready, check all ready → phase_changed

The Hub will be instantiated in main.go and passed to handlers that need it.

---
Implementation Order

1. messages.go - Define message structs
2. client.go - Rewrite as server-side client
3. hub.go - Simplify to session-based management
4. handler.go - WebSocket upgrade endpoint
5. main.go - Initialize hub, add route
6. session.go - Add broadcast calls to JoinSession
