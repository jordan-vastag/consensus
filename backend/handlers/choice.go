package handlers

import (
	"consensus/models"
	"consensus/repository"
	"consensus/websocket"
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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

func (h *ChoiceHandler) AddMemberChoice(c *gin.Context) {
	var req models.AddChoiceRequest
	code := strings.ToLower(c.Param("code"))
	member := c.Param("member")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	choice := models.Choice{
		Code:          code,
		Member:        member,
		Name:          req.Name,
		Integration:   req.Integration,
		IntegrationID: req.IntegrationID,
		Description:   req.Description,
		Rank:          req.Rank,
	}

	err := h.repo.CreateChoice(ctx, &choice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.AddChoiceResponse{
		Msg:    "Choice added",
		Choice: choice,
	})
}

func (h *ChoiceHandler) GetMemberChoices(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	member := c.Param("member")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	choices, err := h.repo.FindChoicesByMember(ctx, code, member)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.GetChoicesResponse{
		Msg:     "Choices retrieved",
		Choices: choices,
	})
}

func (h *ChoiceHandler) UpdateMemberChoice(c *gin.Context) {
	var req models.UpdateChoiceRequest
	code := strings.ToLower(c.Param("code"))
	member := c.Param("member")
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	updatedChoice := models.Choice{
		Code:          code,
		Member:        member,
		Name:          req.Name,
		Integration:   req.Integration,
		IntegrationID: req.IntegrationID,
		Description:   req.Description,
		Rank:          req.Rank,
	}

	err := h.repo.UpdateChoice(ctx, code, member, name, &updatedChoice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.UpdateChoiceResponse{
		Msg:    "Choice updated",
		Choice: updatedChoice,
	})
}

func (h *ChoiceHandler) RemoveMemberChoice(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	member := c.Param("member")
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	err := h.repo.RemoveChoice(ctx, code, member, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.MsgResponse{
		Msg: "Choice removed",
	})
}

func (h *ChoiceHandler) ClearMemberChoices(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	member := c.Param("member")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	err := h.repo.RemoveAllChoicesByMember(ctx, code, member)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.MsgResponse{
		Msg: "Choices cleared",
	})
}
