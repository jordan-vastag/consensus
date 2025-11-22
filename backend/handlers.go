package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func createSession(c *gin.Context) {
	var req CreateSessionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	// TODO: logic

	c.JSON(http.StatusCreated, CreateSessionResponse{
		Msg:  "Session created",
		Code: -1,
	})
}

func joinSession(c *gin.Context) {
	var req JoinSessionRequest
	code := c.Param("code")

	// TODO: logic

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, JoinSessionResponse{
		Msg:      "Session joined",
		MemberID: -1,
		Session:  Session{},
	})
}

func getSession(c *gin.Context) {
	code := c.Param("code")

	// TODO: logic

	c.JSON(http.StatusOK, GetSessionResponse{
		Msg:     "Session retrieved",
		Session: Session{},
	})
}

func updateSessionConfig(c *gin.Context) {
	var req UpdateSessionConfigRequest
	code := c.Param("code")

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, UpdateSessionConfigResponse{
		Msg: "Session modified",
		Old: SessionConfig{},
		New: SessionConfig{},
	})
}

func closeSession(c *gin.Context) {
	var req CloseSessionRequest
	code := c.Param("code")

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, CloseSessionResponse{
		Msg: "Session closed",
	})
}
