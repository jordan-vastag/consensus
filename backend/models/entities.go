package models

import (
	"time"
)

type Session struct {
	Code      string        `json:"code" bson:"code"`
	Members   []Member      `json:"members" bson:"members"`
	Title     string        `json:"title" bson:"title"`
	Config    SessionConfig `json:"config" bson:"config"`
	CreatedAt time.Time     `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time     `json:"updatedAt" bson:"updatedAt"`
	ClosedAt  time.Time     `json:"closedAt" bson:"closedAt"`
}

type SessionConfig struct {
	Anonymity          bool      `json:"anonymity" bson:"anonymity"`
	VotingMode         string    `json:"voting_mode" binding:"required,oneof=yes_no ranked_choice" bson:"votingMode"`
	MinChoices         int       `json:"min_choices" binding:"min=0" bson:"minChoices"`
	MaxChoices         int       `json:"max_choices" binding:"required,gtefield=MinChoices" bson:"maxChoices"`
	GracePeriodSeconds int       `json:"grace_period_seconds" binding:"min=0,max=30" bson:"gracePeriodSeconds"`
	AllowEmptyVoters   bool      `json:"allow_empty_voters" bson:"allowEmptyVoters"`
	CreatedAt          time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt" bson:"updatedAt"`
}

type Member struct {
	Code      string    `json:"code" bson:"code"`
	Name      string    `json:"name" bson:"name"`
	Host      bool      `json:"host" bson:"host"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
}

type Choice struct {
	Code          string    `json:"code" bson:"code"`
	Member        string    `json:"member" bson:"member"` // Name of member. Nil means that the choice is for whole session e.g. is aggregate list
	Name          string    `json:"name" bson:"name"`
	Integration   string    `json:"integration" bson:"integration"`
	IntegrationID string    `json:"integrationID" bson:"integrationID"`
	Description   string    `json:"description" bson:"description"`
	Rank          int       `json:"rank" bson:"rank"`
	CreatedAt     time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt" bson:"updatedAt"`
}
