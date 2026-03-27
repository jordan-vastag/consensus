package websocket

import "consensus/models"

// Message types
const (
	// Outbound (server → client)
	TypeMemberJoined    = "member_joined"
	TypeMemberLeft      = "member_left"
	TypeMemberReady     = "member_ready"
	TypePhaseChanged    = "phase_changed"
	TypeConnectedUsers  = "connected_users"
	TypeMemberSubmitted = "member_submitted"
	TypeMemberVoted     = "member_voted"
	TypeSessionClosed   = "session_closed"
	TypeConfigUpdated   = "config_updated"
	TypeHostChanged          = "host_changed"
	TypeForceStartCountdown = "force_start_countdown"

	// Inbound (client → server)
	TypeSetReady         = "set_ready"
	TypeSubmitChoices    = "submit_choices"
	TypeSubmitVotes      = "submit_votes"
	TypeForceStart       = "force_start"
	TypeCancelForceStart = "cancel_force_start"
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

type MemberSubmittedMsg struct {
	Type       string `json:"type"`
	MemberName string `json:"memberName"`
}

type MemberVotedMsg struct {
	Type       string `json:"type"`
	MemberName string `json:"memberName"`
}

type SessionClosedMsg struct {
	Type string `json:"type"`
}

type ConfigUpdatedMsg struct {
	Type   string              `json:"type"`
	Config models.SessionConfig `json:"config"`
}

type HostChangedMsg struct {
	Type    string `json:"type"`
	NewHost string `json:"newHost"`
}

type ForceStartCountdownMsg struct {
	Type      string `json:"type"`
	Countdown int    `json:"countdown"`
	Cancelled bool   `json:"cancelled,omitempty"`
}

// Inbound messages

type InboundMessage struct {
	Type  string `json:"type"`
	Ready bool   `json:"ready,omitempty"` // for set_ready
}
