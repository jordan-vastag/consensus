package websocket

// Message types
const (
	// Outbound (server → client)
	TypeMemberJoined   = "member_joined"
	TypeMemberLeft     = "member_left"
	TypeMemberReady    = "member_ready"
	TypePhaseChanged   = "phase_changed"
	TypeConnectedUsers = "connected_users"

	// Inbound (client → server)
	TypeSetReady = "set_ready"
)

// Outbound messages

type MemberJoinedMsg struct {
	Type       string `json:"type"`
	MemberName string `json:"memberName"`
	Host       bool   `json:"host"`
}

type MemberLeftMsg struct {
	Type       string `json:"type"`
	MemberName string `json:"memberName"`
}

type MemberReadyMsg struct {
	Type       string `json:"type"`
	MemberName string `json:"memberName"`
	Ready      bool   `json:"ready"`
}

type PhaseChangedMsg struct {
	Type  string          `json:"type"`
	Phase string          `json:"phase"`
	Ready map[string]bool `json:"ready"` // memberName → ready status
}

type ConnectedUsersMsg struct {
	Type    string   `json:"type"`
	Members []string `json:"members"` // list of currently connected member names
}

// Inbound messages

type InboundMessage struct {
	Type  string `json:"type"`
	Ready bool   `json:"ready,omitempty"` // for set_ready
}
