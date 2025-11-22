package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	r.POST("/session", createSession)
	r.POST("/session/:code/join", joinSession)
	r.GET("/session/:code", getSession)
	r.PUT("/session/:code/config", updateSessionConfig)
	r.DELETE("/session/:code", closeSession)

	r.Run() // listen on 0.0.0.0:8080 (localhost:8080 on Windows)
}
