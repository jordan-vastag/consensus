package main

import (
	"context"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"time"

	"consensus/database"
	"consensus/handlers"
	"consensus/models"
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

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	hub.OnAllSubmitted = func(sessionCode string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		session, err := sessionRepo.FindSessionByCode(ctx, sessionCode)
		if err != nil {
			log.Printf("finalize: failed to fetch session %s: %v", sessionCode, err)
			return
		}

		choices := make([]models.Choice, len(session.Choices))
		copy(choices, session.Choices)
		rand.Shuffle(len(choices), func(i, j int) { choices[i], choices[j] = choices[j], choices[i] })

		if err := sessionRepo.SaveFinalizedChoices(ctx, sessionCode, choices); err != nil {
			log.Printf("finalize: failed to save for session %s: %v", sessionCode, err)
			return
		}

		hub.BroadcastToSession(sessionCode, struct {
			Type    string          `json:"type"`
			Phase   string          `json:"phase"`
			Ready   map[string]bool `json:"ready"`
			Choices []models.Choice `json:"choices"`
		}{
			Type:    websocket.TypePhaseChanged,
			Phase:   "results",
			Ready:   hub.GetReadyState(sessionCode),
			Choices: choices,
		})
	}

	hub.OnAllVoted = func(sessionCode string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		session, err := sessionRepo.FindSessionByCode(ctx, sessionCode)
		if err != nil {
			log.Printf("ranking: failed to fetch session %s: %v", sessionCode, err)
			return
		}

		// Build yes-vote count map from session.Choices (where AddVote stores them)
		voteCounts := make(map[string]int)
		for _, c := range session.Choices {
			for _, v := range c.Votes {
				if v.Value == 1 {
					voteCounts[c.Title]++
				}
			}
		}

		choices := make([]models.Choice, len(session.FinalizedChoices))
		copy(choices, session.FinalizedChoices)
		for i := range choices {
			choices[i].Rank = voteCounts[choices[i].Title]
		}
		sort.Slice(choices, func(i, j int) bool {
			if choices[i].Rank != choices[j].Rank {
				return choices[i].Rank > choices[j].Rank
			}
			return choices[i].Title < choices[j].Title
		})

		if err := sessionRepo.SaveRankedChoices(ctx, sessionCode, choices); err != nil {
			log.Printf("ranking: failed to save for session %s: %v", sessionCode, err)
			return
		}

		hub.BroadcastToSession(sessionCode, struct {
			Type    string          `json:"type"`
			Phase   string          `json:"phase"`
			Ready   map[string]bool `json:"ready"`
			Choices []models.Choice `json:"choices"`
		}{
			Type:    websocket.TypePhaseChanged,
			Phase:   "final",
			Ready:   hub.GetReadyState(sessionCode),
			Choices: choices,
		})
	}

	sessionHandler := handlers.NewSessionHandler(sessionRepo, hub)
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

		sessionRoutes.POST("/:code/member/:name/choice", sessionHandler.AddMemberChoice)
		sessionRoutes.GET("/:code/member/:name/choice", sessionHandler.GetMemberChoices)
		sessionRoutes.PUT("/:code/member/:name/choice/:title", sessionHandler.UpdateMemberChoice)
		sessionRoutes.DELETE("/:code/member/:name/choice/:title", sessionHandler.RemoveMemberChoice)
		sessionRoutes.DELETE("/:code/member/:name/choice", sessionHandler.ClearMemberChoices)
		sessionRoutes.POST("/:code/member/:name/votes", sessionHandler.SubmitMemberVotes)
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
