#!/bin/bash
# Test Campaign Assignment Endpoints
# Created: 2025-09-26 16:20

echo "Testing Campaign Assignment Endpoints"
echo "======================================"

# You need to get a valid token first by logging in
# For testing, you can use a token from localStorage after logging in
TOKEN="YOUR_TOKEN_HERE"

# Test endpoint
CAMPAIGN_ID="ee0122a9-b645-4178-bff3-db12a813840a"
API_BASE="http://localhost:3000"

echo ""
echo "1. Testing GET /api/campaign-assignments/:id"
echo "   Campaign: $CAMPAIGN_ID"
echo "   Type: assessment"
echo ""

curl -X GET "$API_BASE/api/campaign-assignments/$CAMPAIGN_ID?type=assessment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  2>/dev/null | python3 -m json.tool

echo ""
echo "2. Testing GET /api/campaign-assignments/:id/statistics"
echo ""

curl -X GET "$API_BASE/api/campaign-assignments/$CAMPAIGN_ID/statistics?type=assessment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  2>/dev/null | python3 -m json.tool

echo ""
echo "======================================"
echo "Note: If you see 'No token provided', you need to:"
echo "1. Login to the app"
echo "2. Get the token from localStorage (access_token or tenant_access_token)"
echo "3. Replace YOUR_TOKEN_HERE with the actual token"
echo ""