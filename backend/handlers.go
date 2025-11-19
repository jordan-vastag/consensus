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
		Msg:       "Session created",
		SessionID: "",
		Code:      "",
	})
}

func joinSession(c *gin.Context) {
	var req JoinSessionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: err.Error(),
		})
	}

	// TODO: logic

	c.JSON(http.StatusOK, JoinSessionResponse{
		Msg:       "Joined session",
		SessionID: "",
		MemberID:  "",
		MemberIDs: []string{""},
	})
}
