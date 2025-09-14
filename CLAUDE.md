# CLAUDE.md - Moobee Backend

This file provides guidance to Claude Code (claude.ai/code) when working with the Moobee backend codebase.

## Project Overview
Moobee is an HR management platform built with Node.js, Express, Prisma ORM, and PostgreSQL. The system manages employees, roles, skills, assessments, and engagement surveys.

## Quick Start Commands

### Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with test data
npm run prisma:seed

# Start development server
npm run dev

# Start production server
npm start
```

### Database Management
```bash
# Open Prisma Studio (GUI)
npm run prisma:studio

# Create new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Pull schema from existing database
npx prisma db pull

# Push schema changes without migration
npx prisma db push

# Validate schema
npx prisma validate
```

## Authentication System

### JWT Dual-Token Architecture
- **Access Token**: 15 minutes expiry, used for API requests
- **Refresh Token**: 7 days expiry, used to obtain new access tokens
- Tokens stored in: `Authorization: Bearer <token>` header

### Test Credentials
After running seed:
- **John Doe** (Developer): john.doe@example.com / Password123!
- **Jane Smith** (HR): jane.smith@example.com / Password123!
- **Bob Johnson** (Sales): bob.johnson@example.com / Password123!

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh tokens
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token validity

### Employees
- `GET /api/employees` - List all employees (paginated)
- `GET /api/employees/:id` - Get employee details
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/employees/:id/skills` - Get employee skills
- `POST /api/employees/:id/skills` - Add skill to employee

### Roles
- `GET /api/roles` - List all roles
- `GET /api/roles/:id` - Get role details
- `GET /api/roles/:id/skills` - Get skills for role
- `GET /api/roles/sub-roles/all` - List all sub-roles
- `GET /api/roles/hierarchy/tree` - Get role hierarchy

### Health Check
- `GET /health` - Server health status
- `GET /api` - API information

## Database Schema

### Key Tables
- `employees` - Employee records
- `departments` - Company departments
- `roles` - Professional roles
- `sub_roles` - Role specializations
- `role_sub_role` - Role to sub-role mappings
- `skills` - Technical and soft skills
- `employee_skills` - Employee skill mappings
- `employee_roles` - Employee role assignments
- `projects` - Company projects
- `assessments` - Performance assessments
- `engagement_surveys` - Monthly engagement data

### Important Views
- `v_roles_with_subroles` - Complete role hierarchy
- `v_role_hierarchy` - Structured role tree
- `v_role_sub_role_full` - Full role relationships
- `v_employee_roles_complete` - Employee role details
- `v_role_skill_requirements` - Role skill mappings
- `v_role_statistics` - Role analytics

## Environment Variables

Required in `.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT Secrets
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# JWT Expiry (optional)
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=development

# CORS (optional)
CORS_ORIGIN="http://localhost:3001"
```

## Project Structure

```
BE_nodejs/
├── src/
│   ├── config/         # App configuration
│   ├── controllers/    # Route controllers
│   ├── middlewares/    # Express middlewares
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   └── server.js       # Server entry point
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.js         # Seed script
├── tests/              # Test files
├── .env                # Environment variables
├── package.json        # Dependencies
└── README.md           # Documentation
```

## Development Guidelines

### Code Style
- Use ESLint for code linting: `npm run lint`
- Prettier for formatting: `npm run format`
- Follow RESTful conventions for API endpoints
- Use async/await for asynchronous operations
- Implement proper error handling with try/catch

### Database Modifications
1. Always use Prisma migrations for schema changes
2. Test migrations locally before deploying
3. Create meaningful migration names
4. Document breaking changes

### API Development
1. Validate input with express-validator
2. Use middleware for authentication
3. Implement proper pagination
4. Return consistent error responses
5. Document endpoints with comments

### Security Best Practices
- Never commit `.env` files
- Use bcrypt for password hashing (min 10 rounds)
- Implement rate limiting on auth endpoints
- Validate and sanitize all inputs
- Use parameterized queries (Prisma handles this)
- Keep dependencies updated

## Testing

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"Password123!"}'

# Get employees (with auth)
curl http://localhost:3000/api/employees \
  -H "Authorization: Bearer <access_token>"
```

### Automated Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Common Issues & Solutions

### Database Connection Issues
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify network connectivity to database host
- Check for SSL requirements in production

### Prisma Issues
- Run `npx prisma generate` after schema changes
- Clear Prisma cache: `rm -rf node_modules/.prisma`
- Ensure schema.prisma matches database structure

### Authentication Issues
- Verify JWT secrets are set in .env
- Check token expiry times
- Ensure Authorization header format is correct
- Clear expired refresh tokens from database

## Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up logging
- [ ] Configure rate limiting
- [ ] Run database migrations
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Document API endpoints

## Support & Documentation

- Prisma Docs: https://www.prisma.io/docs
- Express.js: https://expressjs.com
- JWT: https://jwt.io
- Node.js: https://nodejs.org

## Contributors
- Moobee Team - 2024

---
*Last updated: January 2025*