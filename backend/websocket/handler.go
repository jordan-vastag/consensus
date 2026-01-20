package websocket

import (
	"consensus/repository"
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: restrict to allowed origins in production
		return true
	},
}

type Handler struct {
	hub  *Hub
	repo *repository.SessionRepository
}

func NewHandler(hub *Hub, repo *repository.SessionRepository) *Handler {
	return &Handler{
		hub:  hub,
		repo: repo,
	}
}

// HandleWebSocket handles GET /api/session/:code/ws?name=memberName
func (h *Handler) HandleWebSocket(c *gin.Context) {
	sessionCode := strings.ToLower(c.Param("code"))
	memberName := c.Query("name")

	if memberName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name query parameter required"})
		return
	}

	// Validate session exists and is active
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	session, err := h.repo.FindSessionByCode(ctx, sessionCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	if !session.ClosedAt.IsZero() {
		c.JSON(http.StatusGone, gin.H{"error": "session is closed"})
		return
	}

	// Validate member is in session
	memberFound := false
	for _, member := range session.Members {
		if member.Name == memberName {
			memberFound = true
			break
		}
	}

	if !memberFound {
		c.JSON(http.StatusForbidden, gin.H{"error": "member not in session"})
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client := NewClient(h.hub, conn, sessionCode, memberName)
	h.hub.Register(client)

	// Start pumps
	go client.writePump()
	go client.readPump()
}
