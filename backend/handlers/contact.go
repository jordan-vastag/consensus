package handlers

import (
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

type ContactHandler struct{}

func NewContactHandler() *ContactHandler {
	return &ContactHandler{}
}

type UserMessageRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func (h *ContactHandler) SendUserMessage(c *gin.Context) {
	var req UserMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "invalid request"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Message = strings.TrimSpace(req.Message)

	if req.Name == "" || req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "required argument is empty"})
		return
	}
	if req.Email != "" && !emailRegex.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "invalid email format"})
		return
	}

	gmailEmail := os.Getenv("GMAIL_EMAIL")
	gmailPassword := os.Getenv("GMAIL_APP_PASSWORD")
	recipient := os.Getenv("RECIPIENT_EMAIL")
	if recipient == "" {
		recipient = gmailEmail
	}
	if gmailEmail == "" || gmailPassword == "" {
		log.Println("contact: Gmail credentials not configured")
		c.JSON(http.StatusInternalServerError, gin.H{"msg": "Email service not configured"})
		return
	}

	emailLine := req.Email
	if emailLine == "" {
		emailLine = "(not provided)"
	}
	subject := "Consensus: User Message"
	body := fmt.Sprintf("Name: %s\nEmail: %s\n\nMessage:\n%s", req.Name, emailLine, req.Message)
	msg := fmt.Appendf(nil, "From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		gmailEmail, recipient, subject, body)

	auth := smtp.PlainAuth("", gmailEmail, gmailPassword, "smtp.gmail.com")
	if err := smtp.SendMail("smtp.gmail.com:587", auth, gmailEmail, []string{recipient}, msg); err != nil {
		log.Printf("contact: failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"msg": "Failed to send email"})
		return
	}

	log.Printf("contact: message sent from %s (%s)", req.Name, req.Email)
	c.JSON(http.StatusOK, gin.H{"msg": "ok"})
}
