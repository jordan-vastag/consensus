package main

import (
	"log"
	"net/http"

	"consensus/database"
	"consensus/handlers"
	"consensus/repository"

	"github.com/gin-gonic/gin"
)

const DB_NAME = "dev"

func main() {
	mongoURI := "mongodb://localhost:27017"
	if err := database.Connect(mongoURI); err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	router := gin.Default()

	router.GET("/api/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	sessionHandler := handlers.NewSessionHandler(repository.NewSessionRepository(DB_NAME))
	sessionRoutes := router.Group("/api/session")
	{
		sessionRoutes.POST("/", sessionHandler.CreateSession)
		sessionRoutes.POST("/:code/join", sessionHandler.JoinSession)
		sessionRoutes.GET("/:code", sessionHandler.GetSession)
		sessionRoutes.PUT("/:code/config", sessionHandler.UpdateSessionConfig)
		sessionRoutes.DELETE("/:code", sessionHandler.CloseSession)
	}

	if err := router.Run(":8080"); err != nil {
		panic(err)
	}
}
