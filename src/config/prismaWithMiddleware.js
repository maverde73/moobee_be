/**
 * Prisma client con middleware per conversione automatica degli ID
 * Usa questo invece di database.js per avere la conversione automatica string->int
 */
const { PrismaClient } = require('@prisma/client');
const { setupPrismaMiddleware } = require('./prismaMiddleware');

// Crea una nuova istanza di Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

// Applica il middleware
setupPrismaMiddleware(prisma);

// Test database connection
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected with ID conversion middleware');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });

module.exports = prisma;