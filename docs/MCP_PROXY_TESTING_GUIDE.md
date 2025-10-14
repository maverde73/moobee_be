# MCP Auth Proxy - Testing Guide

**Date**: 13 October 2025, 22:35 CEST
**Status**: ✅ Implementation Complete - Ready for Testing

---

## 🎯 Testing Overview

This guide provides manual testing instructions for the MCP Auth Proxy with different user roles.

### Prerequisites

1. ✅ Server running on `http://localhost:3000`
2. ✅ MCP Server configured and accessible
3. ✅ Valid user credentials for each role (HR_MANAGER, PM, EMPLOYEE)

---

## 🔧 Quick Health Check

```bash
curl http://localhost:3000/api/mcp/health | jq
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "MCP Auth Proxy",
  "version": "1.0.0",
  "config": {
    "mcp_server_url": "https://mcpjson2data-production.up.railway.app/mcp",
    "mcp_auth_token_configured": true,
    "tables": {
      "tenant_tables": 51,
      "shared_tables": 33,
      "total": 84
    },
    "roles": {
      "defined": 4,
      "names": ["HR_MANAGER", "PM", "EMPLOYEE", "SUPER_ADMIN"]
    }
  }
}
```

---

## 📝 Step-by-Step Testing

### Step 1: Get JWT Token

Login as a specific user to get an access token:

```bash
# Login (replace with actual credentials)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_EMAIL@domain.com",
    "password": "YOUR_PASSWORD"
  }' | jq

# Save token to variable
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | jq -r '.accessToken')

echo "Token: $TOKEN"
```

### Step 2: Test MCP Proxy Query

```bash
# Query employees table (tenant-isolated)
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "execute_query",
      "arguments": {
        "json_query": "{\"table\":\"employees\",\"select\":[\"id\",\"first_name\",\"last_name\",\"email\"],\"limit\":10}"
      }
    }
  }'
```

**Note**: Response will be in SSE format (Server-Sent Events):
```
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"id,first_name,last_name,email\n1,John,Doe,john@example.com\n..."}]}}
```

---

## 🧪 Test Scenarios by Role

### TEST 1: HR_MANAGER - Full Access

**Expected Behavior**:
- ✅ Can query ALL tenant tables (employees, employee_skills, projects, assessments)
- ✅ Automatic `tenant_id` filter injected
- ✅ Can query shared tables (skills, roles)

**Test Queries**:

```bash
# 1. Query employees (should succeed with tenant filter)
JSON_QUERY='{"table":"employees","select":["id","first_name","last_name"],"limit":10}'

# 2. Query assessments (should succeed - HR only)
JSON_QUERY='{"table":"assessments","select":["id","assessment_type_id","employee_id"],"limit":10}'

# 3. Query skills (shared table - no tenant filter)
JSON_QUERY='{"table":"skills","select":["id","name","category"],"limit":10}'

# Run query (replace JSON_QUERY with one from above)
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"execute_query\",
      \"arguments\": {
        \"json_query\": \"$JSON_QUERY\"
      }
    }
  }"
```

---

### TEST 2: PM - Limited Access

**Expected Behavior**:
- ✅ Can query employees, projects, employee_skills
- ✅ Can query shared tables (skills, roles)
- 🚫 CANNOT query assessments (403 Forbidden)
- 🚫 CANNOT query engagement tables (403 Forbidden)

**Test Queries**:

```bash
# 1. Query employees (should succeed)
JSON_QUERY='{"table":"employees","select":["id","first_name","last_name"],"limit":10}'

# 2. Query projects (should succeed)
JSON_QUERY='{"table":"projects","select":["id","name","start_date"],"limit":10}'

# 3. Query assessments (should FAIL with 403)
JSON_QUERY='{"table":"assessments","select":["id"],"limit":10}'

# 4. Query engagement_responses (should FAIL with 403)
JSON_QUERY='{"table":"engagement_responses","select":["id"],"limit":10}'

# 5. Query skills (shared - should succeed)
JSON_QUERY='{"table":"skills","select":["id","name"],"limit":10}'
```

**Expected Error for Forbidden Tables**:
```json
{
  "error": "Forbidden",
  "message": "Role 'PM' cannot access table 'assessments'"
}
```

---

### TEST 3: EMPLOYEE - Own Data Only

**Expected Behavior**:
- ✅ Can query own employee record (filtered to own `employee_id`)
- ✅ Can query own skills (filtered to own `employee_id`)
- ✅ Can see projects where assigned (subquery filter)
- ✅ Can query shared tables (skills, roles)
- 🚫 CANNOT query assessments or engagement tables
- 🚫 Queries to `employees` table return ONLY own record

**Test Queries**:

```bash
# 1. Query employees (should return ONLY own record)
JSON_QUERY='{"table":"employees","select":["id","first_name","last_name","email"],"limit":100}'

# 2. Query own skills (should return only employee_id=X where X is your ID)
JSON_QUERY='{"table":"employee_skills","select":["employee_id","skill_id","proficiency_level"],"limit":10}'

# 3. Query projects (should return only assigned projects)
JSON_QUERY='{"table":"projects","select":["id","name"],"limit":10}'

# 4. Query assessments (should FAIL with 403)
JSON_QUERY='{"table":"assessments","select":["id"],"limit":10}'

# 5. Query skills (shared - should succeed)
JSON_QUERY='{"table":"skills","select":["id","name"],"limit":10}'
```

**Expected Filter Transformation**:

Original query:
```json
{"table":"employees","select":["id","first_name","last_name"]}
```

Transformed query (for EMPLOYEE):
```json
{
  "table":"employees",
  "select":["id","first_name","last_name"],
  "where":{
    "id": 74,           // Employee's own ID
    "tenant_id": "ABC"  // Tenant ID
  }
}
```

---

## 🔍 Verifying Tenant Isolation

### Test Cross-Tenant Protection

1. Login as User A (Tenant 1)
2. Query employees table
3. Note the `tenant_id` in results (should all be Tenant 1)
4. Login as User B (Tenant 2)
5. Query employees table
6. Verify you see DIFFERENT data (Tenant 2 only)

**Verification Query** (check logs for injected WHERE clause):

```bash
# Server logs should show transformation:
# Original query: {"table":"employees","select":["*"]}
# Transformed query: {"table":"employees","select":["*"],"where":{"tenant_id":"ABC-123"}}
```

---

## 📊 Query Transformation Examples

### Example 1: HR_MANAGER Query

**User Context**:
```json
{
  "userId": 123,
  "tenantId": "ABC-123",
  "role": "HR_MANAGER"
}
```

**Input Query**:
```json
{
  "table": "employees",
  "select": ["id", "first_name", "last_name"]
}
```

**Transformed Query** (automatic):
```json
{
  "table": "employees",
  "select": ["id", "first_name", "last_name"],
  "where": {
    "tenant_id": "ABC-123"  // ← Injected automatically
  }
}
```

---

### Example 2: EMPLOYEE Query

**User Context**:
```json
{
  "userId": 74,
  "tenantId": "ABC-123",
  "role": "EMPLOYEE",
  "employeeId": 74
}
```

**Input Query**:
```json
{
  "table": "employee_skills",
  "select": ["skill_id", "proficiency_level"]
}
```

**Transformed Query** (automatic):
```json
{
  "table": "employee_skills",
  "select": ["skill_id", "proficiency_level"],
  "where": {
    "employee_id": 74,        // ← Employee-specific filter
    "tenant_id": "ABC-123"
  }
}
```

---

### Example 3: Shared Table (No Filter)

**Input Query**:
```json
{
  "table": "skills",
  "select": ["id", "name"]
}
```

**Transformed Query**:
```json
{
  "table": "skills",
  "select": ["id", "name"]
  // ← NO tenant_id filter (shared table)
}
```

---

## 🐛 Troubleshooting

### Error: "Unauthorized"

```json
{
  "error": "Unauthorized",
  "message": "User context not found"
}
```

**Solution**: Ensure you're passing a valid JWT token in the Authorization header.

---

### Error: "Forbidden - Cannot access table"

```json
{
  "error": "Forbidden",
  "message": "Role 'PM' cannot access table 'assessments'"
}
```

**Solution**: This is expected behavior. The role doesn't have permission to access this table. Check `config/mcp-rbac-rules.json`.

---

### Error: "MCP Server Error"

```json
{
  "error": "MCP Server Error",
  "message": {...},
  "details": {
    "status": 500,
    "mcp_url": "https://..."
  }
}
```

**Solution**: The MCP server itself returned an error. Check:
1. MCP Server is running
2. Query syntax is correct
3. Table/field names exist in database

---

### No Results Returned

If query succeeds but returns empty CSV:

1. **Check tenant_id**: Verify the user's tenant has data in that table
2. **Check employee_id filter**: For EMPLOYEE role, verify employeeId is correct
3. **Check database**: Query the database directly to confirm data exists

---

## 📝 Configuration Files

### Modify Table Categories

Edit `/home/mgiurelli/sviluppo/moobee/BE_nodejs/config/mcp-tables.json`:

```json
{
  "tenant_tables": {
    "tables": ["employees", "employee_skills", ...]
  },
  "shared_tables": {
    "tables": ["skills", "roles", ...]
  }
}
```

### Modify RBAC Rules

Edit `/home/mgiurelli/sviluppo/moobee/BE_nodejs/config/mcp-rbac-rules.json`:

```json
{
  "roles": {
    "PM": {
      "allowed_tables": [...],
      "forbidden_tables": ["assessments*", "engagement*"]
    }
  }
}
```

### Hot-Reload Configuration

After modifying config files:

```bash
curl -X POST http://localhost:3000/api/mcp/reload-config \
  -H "Authorization: Bearer $TOKEN"
```

**Note**: Requires SUPER_ADMIN role.

---

## ✅ Success Criteria

- [ ] Health endpoint returns 200 OK
- [ ] HR_MANAGER can query all tenant tables
- [ ] PM cannot query assessments/engagement (403 Forbidden)
- [ ] EMPLOYEE sees only own data (1 record in employees query)
- [ ] Tenant isolation works (users see only their tenant's data)
- [ ] Shared tables accessible to all roles
- [ ] Audit logs show query transformations
- [ ] Configuration hot-reload works

---

## 📚 Related Documentation

- `docs/MCP_AUTH_PROXY_ARCHITECTURE.md` - Architecture diagrams
- `docs/MCP_AUTH_PROXY_IMPLEMENTATION_COMPLETE.md` - Implementation details
- `config/mcp-tables.json` - Table categorization
- `config/mcp-rbac-rules.json` - RBAC rules
- `src/routes/mcpProxyRoutes.js` - Proxy endpoints

---

## 🎉 Next Steps

1. **Test with Real Users**: Get actual credentials for each role
2. **Frontend Integration**: Update frontend to call `/api/mcp` instead of Railway MCP directly
3. **Monitoring Dashboard**: Create admin dashboard for audit logs
4. **Performance Testing**: Test with 1000+ queries
5. **Production Deployment**: Deploy to Railway with environment variables

---

**Last Updated**: 13 October 2025, 22:35 CEST
**Author**: Claude Code (Sonnet 4.5)
