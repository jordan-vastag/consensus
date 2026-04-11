package websocket

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestRESTLeaveBroadcastsToWebSocket(t *testing.T) {
	sessionCode := "jht9xv"

	// Add a guest first
	joinReq := map[string]string{"name": "Leaver"}
	body, _ := json.Marshal(joinReq)
	resp, err := http.Post("http://localhost:8080/api/session/"+sessionCode+"/join", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("join failed: %v", err)
	}
	resp.Body.Close()
	t.Log("Leaver joined via REST")

	// Connect Host via WebSocket
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/api/session/" + sessionCode + "/ws", RawQuery: "name=Host"}
	host, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer host.Close()
	t.Log("Host connected via WebSocket")

	time.Sleep(100 * time.Millisecond)

	// Leave via REST
	leaveReq := map[string]string{"name": "Leaver"}
	body, _ = json.Marshal(leaveReq)
	resp, err = http.Post("http://localhost:8080/api/session/"+sessionCode+"/leave", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("leave failed: %v", err)
	}
	resp.Body.Close()
	t.Log("Leaver left via REST")

	// Host should receive member_left
	host.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := host.ReadMessage()
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}

	var msg map[string]any
	json.Unmarshal(data, &msg)
	t.Logf("Host received: %v", msg)

	if msg["type"] != "member_left" {
		t.Errorf("expected member_left, got %s", msg["type"])
	}
	if msg["memberName"] != "Leaver" {
		t.Errorf("expected Leaver, got %s", msg["memberName"])
	}

	t.Log("REST leave successfully broadcast to WebSocket client!")
}

func TestRESTJoinBroadcastsToWebSocket(t *testing.T) {
	sessionCode := "6hq4ve"

	// Connect Host via WebSocket
	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/api/session/" + sessionCode + "/ws", RawQuery: "name=Host"}
	host, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer host.Close()
	t.Log("Host connected via WebSocket")

	// Give it a moment
	time.Sleep(100 * time.Millisecond)

	// Join via REST as Guest
	joinReq := map[string]string{"name": "Guest"}
	body, _ := json.Marshal(joinReq)
	resp, err := http.Post("http://localhost:8080/api/session/"+sessionCode+"/join", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("REST join failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("REST join returned %d", resp.StatusCode)
	}
	t.Log("Guest joined via REST")

	// Host should receive member_joined
	host.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := host.ReadMessage()
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}

	var msg map[string]any
	json.Unmarshal(data, &msg)
	t.Logf("Host received: %v", msg)

	if msg["type"] != "member_joined" {
		t.Errorf("expected member_joined, got %s", msg["type"])
	}
	if msg["memberName"] != "Guest" {
		t.Errorf("expected Guest, got %s", msg["memberName"])
	}

	t.Log("REST join successfully broadcast to WebSocket client!")
}
