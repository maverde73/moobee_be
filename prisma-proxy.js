/**
 * Proxy automatico per Prisma Client che gestisce la conversione degli ID
 *
 * Questo file viene caricato automaticamente tramite NODE_OPTIONS
 * per intercettare le chiamate a Prisma e convertire gli ID string in int
 */

const Module = require('module');
const originalRequire = Module.prototype.require;

// Override require per intercettare @prisma/client
Module.prototype.require = function(id) {
  const module = originalRequire.apply(this, arguments);

  // Se è @prisma/client, wrappa PrismaClient
  if (id === '@prisma/client') {
    const OriginalPrismaClient = module.PrismaClient;

    class PrismaClientWithAutoConversion extends OriginalPrismaClient {
      constructor(options) {
        super(options);

        // Applica il middleware per la conversione automatica
        this.$use(async (params, next) => {
          // Lista dei modelli che usano ID integer
          const modelsWithIntId = [
            'assessmentTemplate',
            'assessmentQuestion',
            'assessmentOption'
          ];

          // Se il modello usa ID integer
          if (modelsWithIntId.includes(params.model)) {
            // Converti ID string in integer nelle clausole where
            if (params.args?.where?.id && typeof params.args.where.id === 'string') {
              const parsedId = parseInt(params.args.where.id, 10);
              if (!isNaN(parsedId)) {
                params.args.where.id = parsedId;
                console.log(`[Prisma Proxy] Converted ID "${params.args.where.id}" to ${parsedId} for ${params.model}`);
              }
            }

            // Converti templateId string in integer
            if (params.args?.where?.templateId && typeof params.args.where.templateId === 'string') {
              const parsedId = parseInt(params.args.where.templateId, 10);
              if (!isNaN(parsedId)) {
                params.args.where.templateId = parsedId;
              }
            }

            // Converti questionId string in integer
            if (params.args?.where?.questionId && typeof params.args.where.questionId === 'string') {
              const parsedId = parseInt(params.args.where.questionId, 10);
              if (!isNaN(parsedId)) {
                params.args.where.questionId = parsedId;
              }
            }
          }

          // Esegui la query
          return next(params);
        });

        console.log('✅ [Prisma Proxy] Auto-conversion middleware installed');
      }
    }

    // Sostituisci PrismaClient con la versione wrappata
    module.PrismaClient = PrismaClientWithAutoConversion;
  }

  return module;
};

console.log('✅ [Prisma Proxy] Loaded - will auto-convert string IDs to integers');