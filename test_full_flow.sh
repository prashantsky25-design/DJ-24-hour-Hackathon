#!/bin/bash
#
# ARES Full Flow Test Script
# Tests: Frontend → Orchestrator → Sandbox → Frontend
#

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ARES Full Flow Integration Test      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if backend services are running
echo -e "${YELLOW}[1/6] Checking backend services...${NC}"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Orchestrator (port 8000) is running${NC}"
else
    echo -e "${RED}✗ Orchestrator not running. Start with: cd backend/orchestrator && uvicorn main:app --reload${NC}"
    exit 1
fi

if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Sandbox (port 8001) is running${NC}"
else
    echo -e "${RED}✗ Sandbox not running. Start with: cd backend/sandbox && uvicorn main:app --reload --port 8001${NC}"
    exit 1
fi

# Step 2: Check environment variables
echo -e "\n${YELLOW}[2/6] Checking environment configuration...${NC}"

if [ -f "backend/orchestrator/.env" ]; then
    echo -e "${GREEN}✓ Orchestrator .env exists${NC}"
else
    echo -e "${YELLOW}⚠ Orchestrator .env not found. Copy from .env.example${NC}"
fi

if [ -f "backend/sandbox/.env" ]; then
    echo -e "${GREEN}✓ Sandbox .env exists${NC}"
else
    echo -e "${RED}✗ Sandbox .env not found. Copy from .env.example and fill in API keys!${NC}"
    exit 1
fi

# Step 3: Test orchestrator API health
echo -e "\n${YELLOW}[3/6] Testing orchestrator API endpoints...${NC}"

HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
echo -e "${GREEN}✓ GET /health: ${HEALTH_RESPONSE}${NC}"

# Step 4: Submit a test research query
echo -e "\n${YELLOW}[4/6] Submitting test research query...${NC}"

RESEARCH_PAYLOAD='{
  "research_brief": "Test KAN vs MLP on MNIST classification",
  "paper_url": "https://arxiv.org/abs/2404.19756"
}'

RESPONSE=$(curl -s -X POST http://localhost:8000/api/orchestrate \
  -H "Content-Type: application/json" \
  -d "$RESEARCH_PAYLOAD")

SESSION_ID=$(echo $RESPONSE | grep -o '"session_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
    echo -e "${RED}✗ Failed to create session. Response: ${RESPONSE}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Session created: ${SESSION_ID}${NC}"

# Step 5: Poll session status
echo -e "\n${YELLOW}[5/6] Polling session status...${NC}"

MAX_ATTEMPTS=12  # 1 minute total (5s interval)
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATUS_RESPONSE=$(curl -s http://localhost:8000/api/status/${SESSION_ID})
    STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    ACTIVE_AGENT=$(echo $STATUS_RESPONSE | grep -o '"active_agent":"[^"]*' | cut -d'"' -f4)
    TASK_INDEX=$(echo $STATUS_RESPONSE | grep -o '"current_task_index":[0-9]*' | cut -d':' -f2)
    
    echo -e "  Status: ${STATUS} | Agent: ${ACTIVE_AGENT} | Task: ${TASK_INDEX}"
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "stopped" ] || [ "$STATUS" = "error" ]; then
        echo -e "${GREEN}✓ Pipeline reached terminal state: ${STATUS}${NC}"
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    sleep 5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${YELLOW}⚠ Status check timed out (pipeline may still be running)${NC}"
fi

# Step 6: Fetch execution logs
echo -e "\n${YELLOW}[6/6] Fetching execution logs...${NC}"

LOGS_RESPONSE=$(curl -s http://localhost:8000/api/logs/${SESSION_ID})
echo "$LOGS_RESPONSE" | python3 -m json.tool | head -n 50

# Summary
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Test Summary                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo -e "Session ID: ${SESSION_ID}"
echo -e "Final Status: ${STATUS}"
echo -e ""
echo -e "View full results:"
echo -e "  • Orchestrator logs: ${YELLOW}backend/orchestrator logs${NC}"
echo -e "  • Sandbox logs: ${YELLOW}backend/sandbox logs${NC}"
echo -e "  • Frontend UI: ${YELLOW}http://localhost:5173${NC}"
echo -e ""
echo -e "${GREEN}✓ Integration test complete!${NC}"
