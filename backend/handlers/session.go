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
		characterSet := "23456789abcdefghhijkmnqrstuvwxyz"
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

	return "", fmt.Errorf("Failed to generate unique session code after 5 attempts")
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

	currentTime := time.Now()
	host := models.Member{
		Code:      sessionCode,
		Name:      req.Name,
		Host:      true,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
	}
	members := []models.Member{host}

	newSession := models.Session{
		Code:      sessionCode,
		Members:   members,
		Config:    req.Config,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
		ClosedAt:  time.Time{},
	}

	err = h.repo.CreateSession(ctx, &newSession)
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
	code := c.Param("code")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	session, err := h.repo.FindSessionByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if !time.Time.Equal(session.ClosedAt, time.Time{}) {
		c.JSON(http.StatusGone, models.ErrorResponse{
			Error: "Session is closed",
		})
		return
	}

	for _, member := range session.Members {
		if member.Name == req.Name {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Error: "Name already exists in this session",
			})
			return
		}
	}

	currentTime := time.Now()
	joinee := models.Member{
		Code:      code,
		Name:      req.Name,
		Host:      false,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
	}

	err = h.repo.AddMemberToSession(ctx, code, joinee)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.MsgResponse{
		Msg: "Session joined",
	})
}

func (h *SessionHandler) GetSession(c *gin.Context) {
	code := c.Param("code")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	session, err := h.repo.FindSessionByCode(ctx, code)
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

func (h *SessionHandler) GetSessions(c *gin.Context) {
	status := c.Query("status")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	var sessions []models.Session
	var err error
	var msg string

	switch status {
	case "active":
		sessions, err = h.repo.FindActiveSessions(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		msg = "Active sessions retrieved"
	default:
		sessions, err = h.repo.FindAllSessions(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		msg = "All sessions retrieved"
	}

	c.JSON(http.StatusOK, models.GetSessionsResponse{
		Msg:      msg,
		Sessions: sessions,
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

	oldConfig, err := h.repo.UpdateSessionConfig(ctx, &req.NewConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.UpdateSessionConfigResponse{
		Msg: "Session updated",
		Old: *oldConfig,
		New: req.NewConfig,
	})
}

func (h *SessionHandler) CloseSession(c *gin.Context) {
	var req models.CloseSessionRequest
	code := c.Param("code")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	requestor, err := h.repo.FindMember(ctx, code, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if !requestor.Host {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: "Non host members are not authorized to close sessions",
		})
		return
	}

	err = h.repo.CloseSession(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.CloseSessionResponse{
		Msg: "Session closed",
	})

}

func (h *SessionHandler) UpdateMember(c *gin.Context) {
	var req models.UpdateMemberRequest
	code := c.Param("code")
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	err := h.repo.UpdateMember(ctx, code, name, req.NewName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.UpdateMemberResponse{
		Msg:     "Member updated",
		OldName: name,
		NewName: req.NewName,
	})

}

func (h *SessionHandler) GetMember(c *gin.Context) {
	code := c.Param("code")
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	member, err := h.repo.FindMember(ctx, code, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.GetMemberResponse{
		Msg:    "Member retrieved",
		Member: *member,
	})
}

func (h *SessionHandler) GetMembers(c *gin.Context) {
	code := c.Param("code")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	members, err := h.repo.FindAllMembers(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.GetMembersResponse{
		Msg:     "Members retrieved",
		Members: members,
	})
}
