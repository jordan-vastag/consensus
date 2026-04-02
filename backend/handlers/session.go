package handlers

import (
	"consensus/models"
	"consensus/repository"
	"consensus/websocket"
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	repo *repository.SessionRepository
	hub  *websocket.Hub
}

func NewSessionHandler(repo *repository.SessionRepository, hub *websocket.Hub) *SessionHandler {
	return &SessionHandler{
		repo: repo,
		hub:  hub,
	}
}

func generateSessionCode(ctx context.Context, repo *repository.SessionRepository) (string, error) {
	generate := func() string {
		const codeLength = 6
		characterSet := "23456789abcdefghhjkmnqrstuvwxyz"
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

	if len([]rune(req.Name)) > MAX_NAME_LENGTH {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: fmt.Sprintf("Name must be %d characters or fewer", MAX_NAME_LENGTH),
		})
		return
	}

	if len([]rune(req.Title)) > MAX_TITLE_LENGTH {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: fmt.Sprintf("Title must be %d characters or fewer", MAX_TITLE_LENGTH),
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

	host := models.Member{
		Code: sessionCode,
		Name: req.Name,
		Host: true,
	}

	newSession := models.Session{
		Code:    sessionCode,
		Members: []models.Member{host},
		Title:   req.Title,
		Phase:   "lobby",
		Config:  req.Config,
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
	code := strings.ToLower(c.Param("code"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if len([]rune(req.Name)) > MAX_NAME_LENGTH {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: fmt.Sprintf("Name must be %d characters or fewer", MAX_NAME_LENGTH),
		})
		return
	}

	session, err := h.repo.FindSessionByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if !session.ClosedAt.IsZero() {
		c.JSON(http.StatusGone, models.ErrorResponse{
			Error: "Session is closed",
		})
		return
	}

	if session.Phase != "" && session.Phase != "lobby" {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: "Session is no longer accepting new members",
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

	joinee := models.Member{
		Code: code,
		Name: req.Name,
		Host: false,
	}

	err = h.repo.AddMemberToSession(ctx, code, joinee)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	// Broadcast to connected WebSocket clients
	h.hub.BroadcastToSession(code, websocket.MemberJoinedMsg{
		Type:       websocket.TypeMemberJoined,
		MemberName: joinee.Name,
		Host:       joinee.Host,
	})

	session.Members = append(session.Members, joinee)

	c.JSON(http.StatusOK, models.JoinSessionResponse{
		Msg:     "Session joined",
		Session: *session,
	})
}

func (h *SessionHandler) LeaveSession(c *gin.Context) {
	var req models.LeaveSessionRequest
	code := strings.ToLower(c.Param("code"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	session, err := h.repo.FindSessionByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Session not found",
		})
		return
	}

	if !session.ClosedAt.IsZero() {
		c.JSON(http.StatusGone, models.ErrorResponse{
			Error: "Session is closed",
		})
		return
	}

	// Find the member to check if they exist and if they're the host
	var memberExists bool
	var isHost bool
	for _, member := range session.Members {
		if member.Name == req.Name {
			memberExists = true
			isHost = member.Host
			break
		}
	}

	if !memberExists {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Member not found in session",
		})
		return
	}

	err = h.repo.RemoveMemberFromSession(ctx, code, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	// Broadcast to connected WebSocket clients
	h.hub.BroadcastToSession(code, websocket.MemberLeftMsg{
		Type:       websocket.TypeMemberLeft,
		MemberName: req.Name,
	})

	// If host left, reassign to another member
	if isHost {
		// Re-fetch session to find remaining members
		updatedSession, fetchErr := h.repo.FindSessionByCode(ctx, code)
		if fetchErr == nil && len(updatedSession.Members) > 0 {
			newHost := updatedSession.Members[0].Name
			if transferErr := h.repo.TransferHost(ctx, code, newHost); transferErr != nil {
				log.Printf("host transfer on leave: failed for session %s: %v", code, transferErr)
			} else {
				h.hub.BroadcastToSession(code, websocket.HostChangedMsg{
					Type:    websocket.TypeHostChanged,
					NewHost: newHost,
				})
			}
		}
	}

	c.JSON(http.StatusOK, models.MsgResponse{
		Msg: "Left session",
	})
}

func (h *SessionHandler) GetSession(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))

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
	code := strings.ToLower(c.Param("code"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	oldConfig, err := h.repo.UpdateSessionConfig(ctx, code, &req.NewConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	h.hub.BroadcastToSession(code, websocket.ConfigUpdatedMsg{
		Type:   websocket.TypeConfigUpdated,
		Config: req.NewConfig,
	})

	c.JSON(http.StatusOK, models.UpdateSessionConfigResponse{
		Msg: "Session updated",
		Old: *oldConfig,
		New: req.NewConfig,
	})
}

func (h *SessionHandler) CloseSession(c *gin.Context) {
	// TODO: check if session is active
	var req models.CloseSessionRequest
	code := strings.ToLower(c.Param("code"))

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

	h.hub.MarkSessionClosed(code)
	h.hub.BroadcastToSession(code, websocket.SessionClosedMsg{
		Type: websocket.TypeSessionClosed,
	})

	c.JSON(http.StatusOK, models.MsgResponse{
		Msg: "Session closed",
	})

}

func (h *SessionHandler) UpdateMember(c *gin.Context) {
	var req models.UpdateMemberRequest
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if len([]rune(req.NewName)) > MAX_NAME_LENGTH {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: fmt.Sprintf("Name must be %d characters or fewer", MAX_NAME_LENGTH),
		})
		return
	}

	session, err := h.repo.FindSessionByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	if !session.ClosedAt.IsZero() {
		c.JSON(http.StatusGone, models.ErrorResponse{
			Error: "Session is closed",
		})
		return
	}

	for _, member := range session.Members {
		if member.Name == req.NewName {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Error: "Name already exists in this session",
			})
			return
		}
	}

	err = h.repo.UpdateMember(ctx, code, name, req.NewName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	h.hub.UpdateMemberName(code, name, req.NewName)

	c.JSON(http.StatusOK, models.UpdateMemberResponse{
		Msg:     "Member updated",
		OldName: name,
		NewName: req.NewName,
	})

}

func (h *SessionHandler) GetMember(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
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
	code := strings.ToLower(c.Param("code"))

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

// Choice operations

func (h *SessionHandler) AddMemberChoice(c *gin.Context) {
	var req models.AddChoiceRequest
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	choice := models.Choice{
		MemberName:    name,
		Title:         req.Title,
		Integration:   req.Integration,
		IntegrationID: req.IntegrationID,
		Description:   req.Description,
	}

	err := h.repo.AddChoice(ctx, code, choice)
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

func (h *SessionHandler) GetMemberChoices(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	choices, err := h.repo.FindChoicesByMemberName(ctx, code, name)
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

func (h *SessionHandler) UpdateMemberChoice(c *gin.Context) {
	var req models.UpdateChoiceRequest
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")
	title := c.Param("title")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	updatedChoice := models.Choice{
		MemberName:    name,
		Title:         req.Title,
		Integration:   req.Integration,
		IntegrationID: req.IntegrationID,
		Description:   req.Description,
	}

	err := h.repo.UpdateChoice(ctx, code, name, title, &updatedChoice)
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

func (h *SessionHandler) RemoveMemberChoice(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")
	title := c.Param("title")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	err := h.repo.RemoveChoice(ctx, code, name, title)
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

func (h *SessionHandler) SubmitMemberVotes(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")
	var req models.SubmitVotesRequest

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	for _, v := range req.Votes {
		vote := models.Vote{MemberName: name, Value: v.Value}
		if err := h.repo.AddVote(ctx, code, v.ChoiceTitle, vote); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"msg": "Votes submitted"})
}

func (h *SessionHandler) ClearMemberChoices(c *gin.Context) {
	code := strings.ToLower(c.Param("code"))
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	err := h.repo.RemoveAllChoicesByMemberName(ctx, code, name)
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

func (h *SessionHandler) GetResultsByPermalink(c *gin.Context) {
	permalink := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), REQUEST_TIMEOUT_SECONDS*time.Second)
	defer cancel()

	session, err := h.repo.FindSessionByPermalink(ctx, permalink)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: "Results not found",
		})
		return
	}

	c.JSON(http.StatusOK, models.GetResultsResponse{
		Msg:           "Results retrieved",
		Title:         session.Title,
		RankedChoices: session.RankedChoices,
		VotingMode:    session.Config.VotingMode,
		Permalink:     session.Permalink,
		CreatedAt:     session.CreatedAt,
	})
}
