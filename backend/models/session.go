package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Session struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Code      string             `json:"code" bson:"code"`
	MemberIDs []string           `json:"memberIds" bson:"memberIds"`
	Config    SessionConfig      `json:"config" bson:"config"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
	ClosedAt  time.Time          `json:"closedAt" bson:"closedAt"`
}

type SessionConfig struct {
	Anonymity          bool   `json:"anonymity" bson:"anonymity"`
	VotingMode         string `json:"voting_mode" binding:"required,oneof=yes_no ranked_choice" bson:"votingMode"`
	MinChoices         int    `json:"min_choices" binding:"min=0" bson:"minChoices"`
	MaxChoices         int    `json:"max_choices" binding:"required,gtefield=MinChoices" bson:"maxChoices"`
	GracePeriodSeconds int    `json:"grace_period_seconds" binding:"min=5,max=300" bson:"gracePeriodSeconds"`
	AllowEmptyVoters   bool   `json:"allow_empty_voters" bson:"allowEmptyVoters"`
}
