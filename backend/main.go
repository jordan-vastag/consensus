package main

import (
	"log"
	"net/http"
	"os"

	"consensus/database"
	"consensus/handlers"
	"consensus/repository"
	"consensus/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const DB_NAME = "dev"

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}
	log.Println("Loaded environment variables from .env")

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		log.Println("MONGO_URI environment variable not found. Using default value")
		mongoURI = "mongodb://localhost:27017"
	}

	if err := database.Connect(mongoURI); err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	router := gin.Default()
	router.Use(CORSMiddleware())

	router.GET("/api/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	sessionRepo := repository.NewSessionRepository(DB_NAME)
	choiceRepo := repository.NewChoiceRepository(DB_NAME)

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()
	sessionHandler := handlers.NewSessionHandler(sessionRepo, hub)
	choiceHandler := handlers.NewChoiceHandler(choiceRepo, hub)
	wsHandler := websocket.NewHandler(hub, sessionRepo)
	sessionRoutes := router.Group("/api/session")
	{
		sessionRoutes.POST("/", sessionHandler.CreateSession)
		sessionRoutes.GET("/", sessionHandler.GetSessions)
		sessionRoutes.POST("/:code/join", sessionHandler.JoinSession)
		sessionRoutes.POST("/:code/leave", sessionHandler.LeaveSession)
		sessionRoutes.GET("/:code", sessionHandler.GetSession)
		sessionRoutes.PUT("/:code/config", sessionHandler.UpdateSessionConfig)
		sessionRoutes.PUT("/:code/close", sessionHandler.CloseSession)

		sessionRoutes.GET("/:code/member", sessionHandler.GetMembers)
		sessionRoutes.GET("/:code/member/:name", sessionHandler.GetMember)    // TODO: convert name from path param to query param
		sessionRoutes.PUT("/:code/member/:name", sessionHandler.UpdateMember) // TODO: convert name from path param to query param
		sessionRoutes.GET("/:code/ws", wsHandler.HandleWebSocket)

		sessionRoutes.POST("/:code/member/:name/choice", choiceHandler.AddMemberChoice)
		sessionRoutes.GET("/:code/member/:name/choice", choiceHandler.GetMemberChoices)
		sessionRoutes.PUT("/:code/member/:name/choice/:title", choiceHandler.UpdateMemberChoice)
		sessionRoutes.DELETE("/:code/member/:name/choice/:title", choiceHandler.RemoveMemberChoice)
		sessionRoutes.DELETE("/:code/member/:name/choice", choiceHandler.ClearMemberChoices)
	}

	integrationHandler := handlers.NewIntegrationHandler()
	integrationRoutes := router.Group("/api/integrations")
	{
		integrationRoutes.GET("/tmdb/search", integrationHandler.SearchTMDB)
	}

	if err := router.Run(":8080"); err != nil {
		panic(err)
	}
}
