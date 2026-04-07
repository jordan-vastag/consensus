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

func generatePermalinkID() string {
	const chars = "23456789abcdefghjkmnpqrstuvwxyz"
	id := make([]byte, 10)
	for i := range id {
		id[i] = chars[rand.Intn(len(chars))]
	}
	return string(id)
}

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

	hub.OnAllReady = func(sessionCode string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sessionRepo.UpdateSessionPhase(ctx, sessionCode, "voting"); err != nil {
			log.Printf("phase update: failed to set voting for session %s: %v", sessionCode, err)
		}
	}

	hub.OnMemberSubmitted = func(sessionCode, memberName string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sessionRepo.SetMemberSubmitted(ctx, sessionCode, memberName, true); err != nil {
			log.Printf("member submitted: failed for %s in session %s: %v", memberName, sessionCode, err)
		}
	}

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

		if err := sessionRepo.UpdateSessionPhase(ctx, sessionCode, "results"); err != nil {
			log.Printf("phase update: failed to set results for session %s: %v", sessionCode, err)
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

	hub.OnMemberVoted = func(sessionCode, memberName string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sessionRepo.SetMemberVoted(ctx, sessionCode, memberName, true); err != nil {
			log.Printf("member voted: failed for %s in session %s: %v", memberName, sessionCode, err)
		}
	}

	hub.OnHostDisconnected = func(sessionCode, newHostName string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sessionRepo.TransferHost(ctx, sessionCode, newHostName); err != nil {
			log.Printf("host transfer: failed for session %s to %s: %v", sessionCode, newHostName, err)
		} else {
			log.Printf("host transfer: %s is now host of session %s", newHostName, sessionCode)
		}
	}

	hub.OnAllVoted = func(sessionCode string) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		session, err := sessionRepo.FindSessionByCode(ctx, sessionCode)
		if err != nil {
			log.Printf("ranking: failed to fetch session %s: %v", sessionCode, err)
			return
		}

		scores := make(map[string]int)
		numChoices := len(session.FinalizedChoices)

		if session.Config.VotingMode == "ranked_choice" {
			// Borda count: rank 1 → numChoices points, rank N → 1 point
			for _, c := range session.Choices {
				for _, v := range c.Votes {
					scores[c.Title] += numChoices - v.Value + 1
				}
			}
		} else {
			// yes_no: count yes votes (value == 1)
			for _, c := range session.Choices {
				for _, v := range c.Votes {
					if v.Value == 1 {
						scores[c.Title]++
					}
				}
			}
		}

		choices := make([]models.Choice, len(session.FinalizedChoices))
		copy(choices, session.FinalizedChoices)
		for i := range choices {
			choices[i].Rank = scores[choices[i].Title]
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

		if err := sessionRepo.UpdateSessionPhase(ctx, sessionCode, "final"); err != nil {
			log.Printf("phase update: failed to set final for session %s: %v", sessionCode, err)
		}

		// Generate permalink
		permalinkID := generatePermalinkID()
		if err := sessionRepo.SetPermalink(ctx, sessionCode, permalinkID); err != nil {
			log.Printf("permalink: failed to set for session %s: %v", sessionCode, err)
		}

		// Close the session
		if err := sessionRepo.CloseSession(ctx, sessionCode); err != nil {
			log.Printf("close: failed for session %s: %v", sessionCode, err)
		}

		// Mark session closed so host transfer is skipped on disconnect
		hub.MarkSessionClosed(sessionCode)

		// Broadcast final phase with permalink, then disconnect all clients
		hub.BroadcastToSession(sessionCode, struct {
			Type      string          `json:"type"`
			Phase     string          `json:"phase"`
			Ready     map[string]bool `json:"ready"`
			Choices   []models.Choice `json:"choices"`
			Permalink string          `json:"permalink"`
		}{
			Type:      websocket.TypePhaseChanged,
			Phase:     "final",
			Ready:     hub.GetReadyState(sessionCode),
			Choices:   choices,
			Permalink: permalinkID,
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

	router.GET("/api/results/:id", sessionHandler.GetResultsByPermalink)

	contactHandler := handlers.NewContactHandler()
	router.POST("/api/user-message", contactHandler.SendUserMessage)

	integrationHandler := handlers.NewIntegrationHandler()
	integrationRoutes := router.Group("/api/integrations")
	{
		integrationRoutes.GET("/tmdb/search", integrationHandler.SearchTMDB)
	}

	if err := router.Run(":8080"); err != nil {
		panic(err)
	}
}
