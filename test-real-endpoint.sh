#!/bin/bash

TENANT_ID="f5eafcce-26af-4699-aa97-dd8829621406"
API_URL="http://localhost:3000/api/assessments/tenant/${TENANT_ID}/selections"

echo "=== TESTING REAL ENDPOINT ==="
echo "URL: $API_URL"
echo ""

# Test with empty array (like when no new selections)
echo "1. Testing with empty array..."
curl -X PUT "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"templateIds": []}' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "2. Testing with already selected template (14)..."
curl -X PUT "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"templateIds": ["14"]}' \
  2>/dev/null | python3 -m json.tool

