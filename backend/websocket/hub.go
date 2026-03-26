package websocket

import (
	"encoding/json"
	"log"
	"maps"
	"sync"
)

type Hub struct {
	sessions       map[string]map[*Client]bool // sessionCode → clients
	ready          map[string]map[string]bool  // sessionCode → memberName → ready
	submitted      map[string]map[string]bool  // sessionCode → memberName → submitted
	voted          map[string]map[string]bool  // sessionCode → memberName → voted
	register       chan *Client
	unregister     chan *Client
	mu             sync.RWMutex
	OnAllReady          func(sessionCode string)
	OnMemberSubmitted   func(sessionCode, memberName string)
	OnAllSubmitted      func(sessionCode string)
	OnMemberVoted       func(sessionCode, memberName string)
	OnAllVoted          func(sessionCode string)
	OnHostDisconnected  func(sessionCode, newHostName string)
}

func NewHub() *Hub {
	return &Hub{
		sessions:   make(map[string]map[*Client]bool),
		ready:      make(map[string]map[string]bool),
		submitted:  make(map[string]map[string]bool),
		voted:      make(map[string]map[string]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.sessions[client.sessionCode] == nil {
				h.sessions[client.sessionCode] = make(map[*Client]bool)
				h.ready[client.sessionCode] = make(map[string]bool)
				h.submitted[client.sessionCode] = make(map[string]bool)
				h.voted[client.sessionCode] = make(map[string]bool)
			}
			h.sessions[client.sessionCode][client] = true
			h.ready[client.sessionCode][client.memberName] = false
			// Restore submitted/voted from DB state carried on the client
			if client.submitted {
				h.submitted[client.sessionCode][client.memberName] = true
			} else if _, alreadyTracked := h.submitted[client.sessionCode][client.memberName]; !alreadyTracked {
				h.submitted[client.sessionCode][client.memberName] = false
			}
			if client.voted {
				h.voted[client.sessionCode][client.memberName] = true
			} else if _, alreadyTracked := h.voted[client.sessionCode][client.memberName]; !alreadyTracked {
				h.voted[client.sessionCode][client.memberName] = false
			}
			h.mu.Unlock()
			log.Printf("client registered: %s in session %s", client.memberName, client.sessionCode)

		case client := <-h.unregister:
			var newHost string
			sessionCode := client.sessionCode

			h.mu.Lock()
			if clients, ok := h.sessions[sessionCode]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.send)

					// Broadcast member left
					h.broadcastToSessionLocked(sessionCode, MemberLeftMsg{
						Type:       TypeMemberLeft,
						MemberName: client.memberName,
					})

					// If host disconnected and there are remaining clients, reassign host
					if client.host && len(clients) > 0 {
						for c := range clients {
							newHost = c.memberName
							c.host = true
							break
						}
						h.broadcastToSessionLocked(sessionCode, HostChangedMsg{
							Type:    TypeHostChanged,
							NewHost: newHost,
						})
					}

					// Clean up ready, submitted, and voted state
					delete(h.ready[sessionCode], client.memberName)
					delete(h.submitted[sessionCode], client.memberName)
					delete(h.voted[sessionCode], client.memberName)

					// Clean up empty session
					if len(clients) == 0 {
						delete(h.sessions, sessionCode)
						delete(h.ready, sessionCode)
						delete(h.submitted, sessionCode)
						delete(h.voted, sessionCode)
					}
				}
			}
			h.mu.Unlock()

			if newHost != "" && h.OnHostDisconnected != nil {
				go h.OnHostDisconnected(sessionCode, newHost)
			}

			log.Printf("client unregistered: %s from session %s", client.memberName, sessionCode)
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) BroadcastToSession(sessionCode string, msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	h.broadcastToSessionLocked(sessionCode, msg)
}

// Must hold at least read lock
func (h *Hub) broadcastToSessionLocked(sessionCode string, msg any) {
	clients, ok := h.sessions[sessionCode]
	if !ok {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("failed to marshal message: %v", err)
		return
	}

	for client := range clients {
		select {
		case client.send <- data:
		default:
			// Buffer full, skip
			log.Printf("client buffer full, skipping: %s", client.memberName)
		}
	}
}

func (h *Hub) SetReady(sessionCode, memberName string, ready bool) {
	h.mu.Lock()

	if _, ok := h.ready[sessionCode]; !ok {
		h.mu.Unlock()
		return
	}

	h.ready[sessionCode][memberName] = ready

	// Broadcast ready status change
	h.broadcastToSessionLocked(sessionCode, MemberReadyMsg{
		Type:       TypeMemberReady,
		MemberName: memberName,
		Ready:      ready,
	})

	// Check if all members are ready
	allReady := h.allReadyLocked(sessionCode)
	if allReady {
		h.broadcastToSessionLocked(sessionCode, PhaseChangedMsg{
			Type:  TypePhaseChanged,
			Phase: "voting",
			Ready: h.copyReadyMapLocked(sessionCode),
		})
	}
	h.mu.Unlock()

	if allReady && h.OnAllReady != nil {
		go h.OnAllReady(sessionCode)
	}
}

// Must hold lock
func (h *Hub) allReadyLocked(sessionCode string) bool {
	readyMap, ok := h.ready[sessionCode]
	if !ok || len(readyMap) == 0 {
		return false
	}

	for _, ready := range readyMap {
		if !ready {
			return false
		}
	}
	return true
}

// Must hold lock
func (h *Hub) copyReadyMapLocked(sessionCode string) map[string]bool {
	copy := make(map[string]bool)
	maps.Copy(copy, h.ready[sessionCode])
	return copy
}

func (h *Hub) GetReadyState(sessionCode string) map[string]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.copyReadyMapLocked(sessionCode)
}

func (h *Hub) SubmitChoices(sessionCode, memberName string) {
	h.mu.Lock()

	if _, ok := h.submitted[sessionCode]; !ok {
		h.mu.Unlock()
		return
	}

	h.submitted[sessionCode][memberName] = true

	h.broadcastToSessionLocked(sessionCode, MemberSubmittedMsg{
		Type:       TypeMemberSubmitted,
		MemberName: memberName,
	})

	allDone := h.allSubmittedLocked(sessionCode)
	h.mu.Unlock()

	if h.OnMemberSubmitted != nil {
		go h.OnMemberSubmitted(sessionCode, memberName)
	}
	if allDone && h.OnAllSubmitted != nil {
		go h.OnAllSubmitted(sessionCode)
	}
}

// Must hold lock
func (h *Hub) allSubmittedLocked(sessionCode string) bool {
	submittedMap, ok := h.submitted[sessionCode]
	if !ok || len(submittedMap) == 0 {
		return false
	}
	for _, s := range submittedMap {
		if !s {
			return false
		}
	}
	return true
}

func (h *Hub) SubmitVotes(sessionCode, memberName string) {
	h.mu.Lock()

	if _, ok := h.voted[sessionCode]; !ok {
		h.mu.Unlock()
		return
	}

	h.voted[sessionCode][memberName] = true

	h.broadcastToSessionLocked(sessionCode, MemberVotedMsg{
		Type:       TypeMemberVoted,
		MemberName: memberName,
	})

	allDone := h.allVotedLocked(sessionCode)
	h.mu.Unlock()

	if h.OnMemberVoted != nil {
		go h.OnMemberVoted(sessionCode, memberName)
	}
	if allDone && h.OnAllVoted != nil {
		go h.OnAllVoted(sessionCode)
	}
}

// Must hold lock
func (h *Hub) allVotedLocked(sessionCode string) bool {
	votedMap, ok := h.voted[sessionCode]
	if !ok || len(votedMap) == 0 {
		return false
	}
	for _, v := range votedMap {
		if !v {
			return false
		}
	}
	return true
}

// DisconnectSession closes all client connections for a session and cleans up state
func (h *Hub) DisconnectSession(sessionCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients, ok := h.sessions[sessionCode]
	if !ok {
		return
	}

	for client := range clients {
		close(client.send)
		client.conn.Close()
	}

	delete(h.sessions, sessionCode)
	delete(h.ready, sessionCode)
	delete(h.submitted, sessionCode)
	delete(h.voted, sessionCode)
}

// GetConnectedMembers returns a list of member names currently connected to a session
func (h *Hub) GetConnectedMembers(sessionCode string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.sessions[sessionCode]
	if !ok {
		return []string{}
	}

	members := make([]string, 0, len(clients))
	for client := range clients {
		members = append(members, client.memberName)
	}
	return members
}
