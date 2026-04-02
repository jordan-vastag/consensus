#!/bin/bash
# Run from root of the project

# Kill existing backend process if running
pkill -f "go run main.go" 2>/dev/null
lsof -ti:8080 | xargs kill 2>/dev/null

cd backend && go run main.go