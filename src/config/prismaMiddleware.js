/**
 * Prisma Middleware per convertire automaticamente gli ID string in integer
 * Questo risolve il problema degli endpoint che ricevono ID come parametri string dalla URL
 */

function setupPrismaMiddleware(prisma) {
  // Middleware per convertire string ID in integer
  prisma.$use(async (params, next) => {
    // Lista dei modelli che usano ID integer
    const modelsWithIntId = [
      'assessmentTemplate',
      'assessmentQuestion',
      'assessmentOption',
      'assessment_generation_logs',
      'tenant_assessment_selections',
      'question_soft_skill_mappings',
      'assessment_template_soft_skill'
    ];

    // Se il modello usa ID integer
    if (modelsWithIntId.includes(params.model)) {
      // Converti ID string in integer nelle clausole where
      if (params.args?.where?.id && typeof params.args.where.id === 'string') {
        const parsedId = parseInt(params.args.where.id, 10);
        if (!isNaN(parsedId)) {
          params.args.where.id = parsedId;
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

      // Gestisci anche i dati in create/update
      if (params.args?.data) {
        if (params.args.data.id && typeof params.args.data.id === 'string') {
          const parsedId = parseInt(params.args.data.id, 10);
          if (!isNaN(parsedId)) {
            params.args.data.id = parsedId;
          }
        }
        if (params.args.data.templateId && typeof params.args.data.templateId === 'string') {
          const parsedId = parseInt(params.args.data.templateId, 10);
          if (!isNaN(parsedId)) {
            params.args.data.templateId = parsedId;
          }
        }
        if (params.args.data.questionId && typeof params.args.data.questionId === 'string') {
          const parsedId = parseInt(params.args.data.questionId, 10);
          if (!isNaN(parsedId)) {
            params.args.data.questionId = parsedId;
          }
        }
      }
    }

    // Esegui la query
    const result = await next(params);
    return result;
  });

  console.log('✅ Prisma middleware configured for automatic ID type conversion');
}

module.exports = { setupPrismaMiddleware };