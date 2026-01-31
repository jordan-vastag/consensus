package handlers

import (
	"consensus/repository"
	"consensus/websocket"
)

type ChoiceHandler struct {
	repo *repository.ChoiceRepository
	hub  *websocket.Hub
}

func NewChoiceHandler(repo *repository.ChoiceRepository, hub *websocket.Hub) *ChoiceHandler {
	return &ChoiceHandler{
		repo: repo,
		hub:  hub,
	}
}

// TODO
// POST AddMemberChoice
// GET GetMemberChoices
// PUT UpdateMemberChoice
// DELETE RemoveMemberChoice
// DELETE ClearMemberChoices
// GET Aggregate
