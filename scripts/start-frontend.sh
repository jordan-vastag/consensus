#!/bin/bash
# Run from root of the project

# Kill existing frontend process if running
pkill -f "next dev" 2>/dev/null
lsof -ti:3000 | xargs kill 2>/dev/null

cd frontend && yarn run dev