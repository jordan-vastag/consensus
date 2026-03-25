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
	OnAllSubmitted func(sessionCode string)
	OnAllVoted     func(sessionCode string)
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
			if _, alreadyTracked := h.submitted[client.sessionCode][client.memberName]; !alreadyTracked {
				h.submitted[client.sessionCode][client.memberName] = false
			}
			if _, alreadyTracked := h.voted[client.sessionCode][client.memberName]; !alreadyTracked {
				h.voted[client.sessionCode][client.memberName] = false
			}
			h.mu.Unlock()
			log.Printf("client registered: %s in session %s", client.memberName, client.sessionCode)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.sessions[client.sessionCode]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.send)

					// Broadcast member left
					h.broadcastToSessionLocked(client.sessionCode, MemberLeftMsg{
						Type:       TypeMemberLeft,
						MemberName: client.memberName,
					})

					// Clean up ready, submitted, and voted state
					delete(h.ready[client.sessionCode], client.memberName)
					delete(h.submitted[client.sessionCode], client.memberName)
					delete(h.voted[client.sessionCode], client.memberName)

					// Clean up empty session
					if len(clients) == 0 {
						delete(h.sessions, client.sessionCode)
						delete(h.ready, client.sessionCode)
						delete(h.submitted, client.sessionCode)
						delete(h.voted, client.sessionCode)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("client unregistered: %s from session %s", client.memberName, client.sessionCode)
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
	defer h.mu.Unlock()

	if _, ok := h.ready[sessionCode]; !ok {
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
	if h.allReadyLocked(sessionCode) {
		h.broadcastToSessionLocked(sessionCode, PhaseChangedMsg{
			Type:  TypePhaseChanged,
			Phase: "voting",
			Ready: h.copyReadyMapLocked(sessionCode),
		})
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
