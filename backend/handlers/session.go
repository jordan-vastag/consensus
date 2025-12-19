package handlers

import (
	"consensus/models"
	"consensus/repository"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	repo *repository.SessionRepository
}

func NewSessionHandler(repo *repository.SessionRepository) *SessionHandler {
	return &SessionHandler{
		repo: repo,
	}
}

func (h *SessionHandler) CreateSession(c *gin.Context) {
	var req models.CreateSessionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.CreateSessionResponse{
		Msg:  "Session created",
		Code: -1,
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
	// code := c.Param("code")

	// TODO: logic

	c.JSON(http.StatusOK, models.GetSessionResponse{
		Msg:     "Session retrieved",
		Session: models.Session{},
	})
}

func (h *SessionHandler) UpdateSessionConfig(c *gin.Context) {
	var req models.UpdateSessionConfigRequest
	// code := c.Param("code")

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, models.UpdateSessionConfigResponse{
		Msg: "Session modified",
		Old: models.SessionConfig{},
		New: models.SessionConfig{},
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
