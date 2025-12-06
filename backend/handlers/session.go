package handlers

import (
	"consensus/models"
	"consensus/repository"
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const REQUEST_TIMEOUT_SECONDS = 5

type SessionHandler struct {
	repo *repository.SessionRepository
}

func NewSessionHandler(repo *repository.SessionRepository) *SessionHandler {
	return &SessionHandler{
		repo: repo,
	}
}

func generateSessionCode(ctx context.Context, repo *repository.SessionRepository) (string, error) {
	generate := func() string {
		const codeLength = 6
		characterSet := "23456789abcdefghhijkmnoqrstuvwxyz"
		code := ""
		for range codeLength {
			character := string(characterSet[rand.Intn(len(characterSet))])
			code = code + character
			characterSet = strings.ReplaceAll(characterSet, character, "")
		}
		return code
	}

	activeSessions, err := repo.FindActiveSessions(ctx)
	if err != nil {
		return "", err
	}

	activeCodes := make(map[string]bool)
	for _, session := range activeSessions {
		activeCodes[session.Code] = true
	}

	for range 5 {
		code := generate()
		if !activeCodes[code] {
			return code, nil
		}
	}

	return "", fmt.Errorf("failed to generate unique session code after 5 attempts")
}

func (h *SessionHandler) CreateSession(c *gin.Context) {
	var req models.CreateSessionRequest
	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	sessionCode, err := generateSessionCode(ctx, h.repo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	members := []string{req.DisplayName}
	currentTime := time.Now()

	newSession := models.Session{
		Code:      sessionCode,
		Members:   members,
		Config:    req.Config,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
		ClosedAt:  time.Time{},
	}

	err = h.repo.Create(ctx, &newSession)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.CreateSessionResponse{
		Msg:  "Session created",
		Code: sessionCode,
	})
}

func (h *SessionHandler) JoinSession(c *gin.Context) {
	var req models.JoinSessionRequest
	// code := c.Param("code")

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, models.JoinSessionResponse{
		Msg:      "Session joined",
		MemberID: -1,
		Session:  models.Session{},
	})
}

func (h *SessionHandler) GetSession(c *gin.Context) {
	code := c.Param("code")
	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	session, err := h.repo.FindByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.GetSessionResponse{
		Msg:     "Session retrieved",
		Session: *session,
	})
}

func (h *SessionHandler) UpdateSessionConfig(c *gin.Context) {
	var req models.UpdateSessionConfigRequest
	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	oldConfig, err := h.repo.Update(ctx, &req.NewConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.UpdateSessionConfigResponse{
		Msg: "Session modified",
		Old: *oldConfig,
		New: req.NewConfig,
	})
}

func (h *SessionHandler) CloseSession(c *gin.Context) {
	var req models.CloseSessionRequest
	// code := c.Param("code")

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, models.CloseSessionResponse{
		Msg: "Session closed",
	})
}
