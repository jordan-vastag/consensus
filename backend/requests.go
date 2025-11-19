package main

type SessionConfigRequest struct {
	Anonymity          bool   `json:"anonymity"`
	VotingMode         string `json:"voting_mode" binding:"required,oneof=yes_no ranked_choice"`
	MinChoices         int    `json:"min_choices" binding:"min=0"`
	MaxChoices         int    `json:"max_choices" binding:"required,gtefield=MinChoices"`
	GracePeriodSeconds int    `json:"grace_period_seconds" binding:"min=5,max=300"`
	AllowEmptyVoters   bool   `json:"allow_empty_voters"`
}

type CreateSessionRequest struct {
	Name   string               `json:"name" binding:"required"`
	Title  string               `json:"title" binding:"required"`
	Config SessionConfigRequest `json:"config"`
}

type JoinSessionRequest struct {
	SessionId string `json:"sessionId" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Code      string `json:"code" binding:"required"`
}
