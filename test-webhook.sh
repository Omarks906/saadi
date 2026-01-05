#!/bin/bash
# Test VAPI webhook endpoint

BASE_URL="https://saadi-production.up.railway.app"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CALL_ID="test-call-$(date +%s)"

echo "Testing webhook endpoint: $BASE_URL/api/webhooks/vapi"
echo "Call ID: $CALL_ID"
echo ""

# Test health check first
echo "1. Testing health check (GET)..."
curl -s "$BASE_URL/api/webhooks/vapi" | jq '.' || echo "Health check failed"
echo ""

# Test call.started event
echo "2. Testing call.started event (POST)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/vapi" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"call.started\",
    \"call\": {
      \"id\": \"$CALL_ID\",
      \"phoneNumber\": \"+46700000000\",
      \"customerId\": \"test-customer-001\"
    },
    \"startedAt\": \"$TIMESTAMP\"
  }")

echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
echo ""

# Wait a moment
sleep 2

# Check if it appears in dashboard API (requires ADMIN_TOKEN)
echo "3. Checking if call appears in dashboard..."
echo "Note: This requires ADMIN_TOKEN to be set. Check dashboard manually at:"
echo "$BASE_URL/dashboard"
