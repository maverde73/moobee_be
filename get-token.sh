#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"Password123"}' | jq -r '.accessToken')

echo "Token: $TOKEN"

# Test AI providers endpoint
echo -e "\n\nTesting AI providers endpoint:"
curl -s "http://localhost:3000/api/assessments/ai/providers" \
  -H "Authorization: Bearer $TOKEN" | jq '.'