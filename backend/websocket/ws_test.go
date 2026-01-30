package websocket

import (
	"encoding/json"
	"net/url"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func connect(t *testing.T, sessionCode, memberName string) *websocket.Conn {
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/api/session/" + sessionCode + "/ws", RawQuery: "name=" + memberName}
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("dial failed for %s: %v", memberName, err)
	}
	return conn
}

func readMsg(t *testing.T, conn *websocket.Conn) map[string]any {
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	var msg map[string]any
	json.Unmarshal(data, &msg)
	return msg
}

func TestPhaseTransition(t *testing.T) {
	sessionCode := "nqgj7e" // Session with Alice and Bob

	// Connect both clients
	alice := connect(t, sessionCode, "Alice")
	defer alice.Close()
	t.Log("Alice connected")

	bob := connect(t, sessionCode, "Bob")
	defer bob.Close()
	t.Log("Bob connected")

	// Alice receives Bob's member_joined
	msg := readMsg(t, alice)
	t.Logf("Alice received: %v", msg)

	// Alice sets ready
	alice.WriteJSON(map[string]any{"type": "set_ready", "ready": true})
	t.Log("Alice set ready")

	// Alice receives her own member_ready
	msg = readMsg(t, alice)
	t.Logf("Alice received: %v", msg)
	if msg["type"] != "member_ready" {
		t.Errorf("expected member_ready, got %s", msg["type"])
	}

	// Bob receives Alice's member_ready
	msg = readMsg(t, bob)
	t.Logf("Bob received: %v", msg)
	if msg["type"] != "member_ready" {
		t.Errorf("expected member_ready, got %s", msg["type"])
	}

	// Bob sets ready
	bob.WriteJSON(map[string]any{"type": "set_ready", "ready": true})
	t.Log("Bob set ready")

	// Both should receive member_ready for Bob, then phase_changed
	msg = readMsg(t, alice)
	t.Logf("Alice received: %v", msg)

	msg = readMsg(t, alice)
	t.Logf("Alice received: %v", msg)
	if msg["type"] != "phase_changed" {
		t.Errorf("expected phase_changed, got %s", msg["type"])
	}
	if msg["phase"] != "voting" {
		t.Errorf("expected voting phase, got %s", msg["phase"])
	}

	t.Log("Phase transition to voting successful!")
}

func TestRESTJoinBroadcast(t *testing.T) {
	// This test requires a fresh session - create via REST
	// For now, use an existing session code (update as needed)
	sessionCode := "test01"

	t.Log("This test requires manual setup:")
	t.Log("1. Start server: go run main.go")
	t.Log("2. Create session: curl -X POST localhost:8080/api/session/ -H 'Content-Type: application/json' -d '{\"name\":\"Host\",\"title\":\"Test\",\"config\":{\"voting_mode\":\"yes_no\",\"max_choices\":1}}'")
	t.Log("3. Update sessionCode in this test")
	t.Log("4. Run test")
	t.Skip("Manual test - see instructions above")

	// Connect as host via WebSocket
	host := connect(t, sessionCode, "Host")
	defer host.Close()
	t.Log("Host connected via WebSocket")

	// Now someone joins via REST API (simulated by another process)
	// The host should receive member_joined via WebSocket

	msg := readMsg(t, host)
	t.Logf("Host received: %v", msg)

	if msg["type"] != "member_joined" {
		t.Errorf("expected member_joined, got %s", msg["type"])
	}
}
