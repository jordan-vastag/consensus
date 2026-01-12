package main

// Data models e.g. session, vote, choice, etc.

type Session struct {
	Code      int
	SessionID string
	MemberIDs []string
	Config    SessionConfig
}

type SessionConfig struct {
	Anonymity          bool   `json:"anonymity"`
	VotingMode         string `json:"voting_mode" binding:"required,oneof=yes_no ranked_choice"`
	MinChoices         int    `json:"min_choices" binding:"min=0"`
	MaxChoices         int    `json:"max_choices" binding:"required,gtefield=MinChoices"`
	GracePeriodSeconds int    `json:"grace_period_seconds" binding:"min=5,max=300"`
	AllowEmptyVoters   bool   `json:"allow_empty_voters"`
}

// TODO: update Member and Session so host status is held in Session instead of in each member e.g. "Host: string" where the value is a member name
type Member struct {
	MemberID    string
	SessionID   string
	DisplayName string
	DoneVoting  bool
	IsHost      bool
}

type Choice struct {
	ChoiceID    string
	SessionID   string // Session to which this choice belongs
	Creator     string // MemberID of the creator
	Name        string
	Description string // Optional
}
