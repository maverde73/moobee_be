const authService = require('./src/services/authService');

const access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NTcyZDQyLWJmYTQtNDBmZS05ZmVjLWFjMjk0N2ZmOGE5YSIsImVtYWlsIjoicm1haWVsbG9AbmV4YWRhdGEuaXQiLCJyb2xlIjoiaHJfbWFuYWdlciIsInRlbmFudElkIjoiZjVlYWZjY2UtMjZhZi00Njk5LWFhOTctZGQ4ODI5NjIxNDA2IiwidGVuYW50Ijp7ImlkIjoiZjVlYWZjY2UtMjZhZi00Njk5LWFhOTctZGQ4ODI5NjIxNDA2Iiwic2x1ZyI6Im5leGFkYXRhIiwibmFtZSI6Ik5leGEgZGF0YSBzcmwiLCJjb21wYW55TmFtZSI6bnVsbCwiZG9tYWluIjoibmV4YWRhdGEuaXQiLCJlbWFpbCI6IiIsInBob25lIjoiIiwidmF0X251bWJlciI6IiIsInRheF9jb2RlIjoiIiwiYWRkcmVzc19zdHJlZXQiOiIiLCJhZGRyZXNzX2NpdHkiOiIiLCJhZGRyZXNzX3N0YXRlIjoiIiwiYWRkcmVzc196aXAiOiIiLCJhZGRyZXNzX2NvdW50cnkiOiIiLCJzdWJzY3JpcHRpb25fcGxhbiI6ImJhc2ljIiwic3Vic2NyaXB0aW9uX3N0YXR1cyI6ImFjdGl2ZSIsIm1heF9lbXBsb3llZXMiOjUwLCJpc19hY3RpdmUiOnRydWUsImNyZWF0ZWRfYnkiOm51bGwsInVwZGF0ZWRfYnkiOm51bGwsImFkZHJlc3MiOm51bGwsImNpdHkiOm51bGwsImNvdW50cnkiOm51bGwsImlzQWN0aXZlIjp0cnVlLCJpc19kZWxldGVkIjpmYWxzZSwicGxhbiI6ImZyZWUiLCJtYXhVc2VycyI6MTAsImNyZWF0ZWRBdCI6IjIwMjUtMDktMjBUMTc6Mjc6NTIuMzk3WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDktMjRUMTU6Mzg6MTMuMDQ1WiJ9LCJlbXBsb3llZUlkIjoxMTgsImlhdCI6MTc1OTc3NjkwNywiZXhwIjoxNzU5NzgwNTA3LCJpc3MiOiJtb29iZWUtdW5pZmllZCJ9.vkpJ4zVRyFmcAKvIvWJIbYVzd1hPISoKnYtRYkNlk-8";

const tenant_access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc5LCJlbWFpbCI6InRlc3RAbmV4YWRhdGEuaXQiLCJyb2xlIjoiSFJfTUFOQUdFUiIsInRlbmFudElkIjoiZjVlYWZjY2UtMjZhZi00Njk5LWFhOTctZGQ4ODI5NjIxNDA2IiwiaWF0IjoxNzU5MDk0MDg2LCJleHAiOjE3NTk2OTg4ODZ9.tqKPVyy4pEOPs84gHOCqjBqvyn_ngNInCG6E9vN5dVw";

console.log('=== Testing access_token ===');
try {
  const decoded1 = authService.verifyAccessToken(access_token);
  console.log('✅ access_token VALID');
  console.log('User:', decoded1.email);
  console.log('Role:', decoded1.role);
  console.log('Exp:', new Date(decoded1.exp * 1000).toISOString());
} catch (error) {
  console.log('❌ access_token INVALID:', error.message);
}

console.log('\n=== Testing tenant_access_token ===');
try {
  const decoded2 = authService.verifyAccessToken(tenant_access_token);
  console.log('✅ tenant_access_token VALID');
  console.log('User:', decoded2.email);
  console.log('Role:', decoded2.role);
  console.log('Exp:', new Date(decoded2.exp * 1000).toISOString());
} catch (error) {
  console.log('❌ tenant_access_token INVALID:', error.message);
}
