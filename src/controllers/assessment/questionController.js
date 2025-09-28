const prisma = require('../../config/database');

/**
 * Question Controller - Handles all question management operations
 * Giurelli Standards compliant - Max 50 lines per function
 */
class QuestionController {
  /**
   * Add question to template
   */
  async addQuestion(req, res) {
    try {
      const { id } = req.params;
      const { text, type, category, orderIndex, isRequired, options } = req.body;

      const template = await prisma.assessment_templates.findUnique({
        where: { id },
        include: { assessment_questions: true }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      const maxOrder = Math.max(...template.assessment_questions.map(q => q.order), -1);

      const question = await prisma.assessment_questions.create({
        data: {
          templateId: id,
          text,
          type: type || 'likert',
          category,
          order: orderIndex ?? (maxOrder + 1),
          isRequired: isRequired ?? true,
          assessment_options: {
            create: (options || []).map((opt, index) => ({
              text: opt.text,
              value: opt.value,
              orderIndex: opt.orderIndex ?? index
            }))
          }
        },
        include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
      });

      res.status(201).json({ success: true, data: question });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update question
   */
  async updateQuestion(req, res) {
    try {
      const { id } = req.params;
      const { text, type, category, orderIndex, isRequired } = req.body;

      const data = {};
      if (text !== undefined) data.text = text;
      if (type !== undefined) data.type = type;
      if (category !== undefined) data.category = category;
      if (orderIndex !== undefined) data.order = orderIndex;
      if (isRequired !== undefined) data.isRequired = isRequired;

      const question = await prisma.assessment_questions.update({
        where: { id },
        data,
        include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
      });

      if (req.body.options) {
        await this._updateQuestionOptions(id, req.body.options);
      }

      const updatedQuestion = await prisma.assessment_questions.findUnique({
        where: { id },
        include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
      });

      res.json({ success: true, data: updatedQuestion });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Question not found'
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete question
   */
  async deleteQuestion(req, res) {
    try {
      const { id } = req.params;

      const question = await prisma.assessment_questions.findUnique({
        where: { id },
        include: { assessment_templates: { include: { assessment_questions: true } } }
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          error: 'Question not found'
        });
      }

      await prisma.assessment_questions.delete({ where: { id } });

      // Reindex remaining questions
      const remainingQuestions = question.assessment_templates.assessment_questions
        .filter(q => q.id !== id)
        .sort((a, b) => a.order - b.order);

      await Promise.all(
        remainingQuestions.map((q, index) =>
          prisma.assessment_questions.update({
            where: { id: q.id },
            data: { order: index }
          })
        )
      );

      res.json({
        success: true,
        message: 'Question deleted and order updated'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reorder questions within template
   */
  async reorderQuestions(req, res) {
    try {
      const { templateId, questionOrders } = req.body;

      if (!templateId || !Array.isArray(questionOrders)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data'
        });
      }

      const template = await prisma.assessment_templates.findUnique({
        where: { id: templateId },
        include: { assessment_questions: true }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      await Promise.all(
        questionOrders.map(({ questionId, orderIndex }) =>
          prisma.assessment_questions.update({
            where: { id: questionId },
            data: { order: orderIndex }
          })
        )
      );

      const updatedQuestions = await prisma.assessment_questions.findMany({
        where: { templateId },
        orderBy: { order: 'asc' },
        include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
      });

      res.json({ success: true, data: updatedQuestions });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk update questions
   */
  async bulkUpdateQuestions(req, res) {
    try {
      const { templateId, questions } = req.body;

      if (!templateId || !Array.isArray(questions)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data'
        });
      }

      const template = await prisma.assessment_templates.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Delete existing questions
      await prisma.assessment_questions.deleteMany({
        where: { templateId }
      });

      // Create new questions
      const createdQuestions = await Promise.all(
        questions.map((q, index) =>
          prisma.assessment_questions.create({
            data: {
              templateId,
              text: q.text,
              type: q.type || 'likert',
              category: q.category,
              order: q.orderIndex ?? index,
              isRequired: q.isRequired ?? true,
              assessment_options: {
                create: (q.options || []).map((opt, optIndex) => ({
                  text: opt.text,
                  value: opt.value,
                  orderIndex: opt.orderIndex ?? optIndex
                }))
              }
            },
            include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
          })
        )
      );

      res.json({ success: true, data: createdQuestions });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Helper: Update question options
   */
  async _updateQuestionOptions(questionId, options) {
    await prisma.assessment_options.deleteMany({
      where: { questionId }
    });

    if (options && options.length > 0) {
      await prisma.assessment_options.createMany({
        data: options.map((opt, index) => ({
          questionId,
          text: opt.text,
          value: opt.value,
          orderIndex: opt.orderIndex ?? index
        }))
      });
    }
  }
}

module.exports = new QuestionController();