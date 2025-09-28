#!/bin/bash

echo "Testing unified login endpoint..."

# Test super admin
echo -e "\n1. Testing Super Admin login:"
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"superadmin@moobee.com\",\"password\":\"SuperAdmin123!\"}" | jq

# Test admin
echo -e "\n2. Testing Admin login:"
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@moobee.com\",\"password\":\"Admin123!\"}" | jq

# Test HR
echo -e "\n3. Testing HR login:"
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"hr@moobee.com\",\"password\":\"HR123!\"}" | jq

# Test Employee
echo -e "\n4. Testing Employee login:"
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"employee@moobee.com\",\"password\":\"Employee123!\"}" | jq