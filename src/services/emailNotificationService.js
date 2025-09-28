/**
 * Email Notification Service
 * Gestisce invio notifiche email per assessment system
 * @module services/emailNotificationService
 */

const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

class EmailNotificationService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Inizializza transporter email
   */
  initializeTransporter() {
    // Configurazione per sviluppo con Mailtrap o servizio SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: process.env.SMTP_PORT || 2525,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'demo',
        pass: process.env.SMTP_PASS || 'demo'
      }
    });

    // Verifica configurazione
    this.transporter.verify((error) => {
      if (error) {
        console.error('Email transporter configuration error:', error);
      } else {
        console.log('Email service ready');
      }
    });
  }

  /**
   * Carica template email
   */
  async loadTemplates() {
    const templateNames = [
      'assessment-invitation',
      'assessment-reminder',
      'assessment-completed',
      'assessment-expired',
      'weekly-report',
      'team-progress'
    ];

    for (const name of templateNames) {
      try {
        const templatePath = path.join(__dirname, '..', 'templates', 'email', `${name}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf-8').catch(() => this.getDefaultTemplate(name));
        this.templates.set(name, handlebars.compile(templateContent));
      } catch (error) {
        console.error(`Error loading template ${name}:`, error);
        this.templates.set(name, handlebars.compile(this.getDefaultTemplate(name)));
      }
    }
  }

  /**
   * Template di default per email
   */
  getDefaultTemplate(templateName) {
    const templates = {
      'assessment-invitation': `
        <h2>Nuovo Assessment Assegnato</h2>
        <p>Ciao {{userName}},</p>
        <p>Ti è stato assegnato un nuovo assessment: <strong>{{assessmentName}}</strong></p>
        <p>Tipo: {{assessmentType}}</p>
        <p>Scadenza: {{dueDate}}</p>
        <p>Tempo stimato: {{estimatedTime}} minuti</p>
        <a href="{{assessmentUrl}}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">
          Inizia Assessment
        </a>
        <p>Grazie,<br>Il Team HR</p>
      `,
      'assessment-reminder': `
        <h2>Promemoria Assessment</h2>
        <p>Ciao {{userName}},</p>
        <p>Ti ricordiamo che hai un assessment in sospeso: <strong>{{assessmentName}}</strong></p>
        <p>Scade il: {{dueDate}} ({{daysRemaining}} giorni rimanenti)</p>
        <p>Progresso attuale: {{progress}}%</p>
        <a href="{{assessmentUrl}}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">
          {{buttonText}}
        </a>
        <p>Grazie,<br>Il Team HR</p>
      `,
      'assessment-completed': `
        <h2>Assessment Completato</h2>
        <p>Ciao {{userName}},</p>
        <p>Hai completato con successo l'assessment: <strong>{{assessmentName}}</strong></p>
        <p>Data completamento: {{completedDate}}</p>
        <p>Tempo impiegato: {{timeTaken}} minuti</p>
        <p>I risultati saranno disponibili a breve nel tuo profilo.</p>
        <p>Grazie per la partecipazione!</p>
        <p>Il Team HR</p>
      `,
      'assessment-expired': `
        <h2>Assessment Scaduto</h2>
        <p>Ciao {{userName}},</p>
        <p>L'assessment <strong>{{assessmentName}}</strong> è scaduto senza essere completato.</p>
        <p>Data scadenza: {{expiredDate}}</p>
        <p>Per favore contatta il tuo manager o HR per ulteriori informazioni.</p>
        <p>Il Team HR</p>
      `,
      'weekly-report': `
        <h2>Report Settimanale Assessment</h2>
        <p>Ciao {{managerName}},</p>
        <p>Ecco il riepilogo settimanale degli assessment del tuo team:</p>
        <ul>
          <li>Assessment completati: {{completed}}</li>
          <li>Assessment in corso: {{inProgress}}</li>
          <li>Assessment non iniziati: {{notStarted}}</li>
          <li>Tasso completamento: {{completionRate}}%</li>
        </ul>
        <p>Top performers questa settimana:</p>
        {{#each topPerformers}}
          <li>{{this.name}} - Score: {{this.score}}</li>
        {{/each}}
        <a href="{{dashboardUrl}}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">
          Visualizza Dashboard
        </a>
        <p>Il Team HR</p>
      `,
      'team-progress': `
        <h2>Aggiornamento Progresso Team</h2>
        <p>Ciao {{managerName}},</p>
        <p>Il tuo team ha raggiunto il {{percentage}}% di completamento per l'assessment: <strong>{{assessmentName}}</strong></p>
        <p>Membri che hanno completato: {{completedCount}}/{{totalCount}}</p>
        <p>Membri ancora in corso: {{inProgressCount}}</p>
        <p>Scadenza: {{dueDate}}</p>
        <a href="{{teamUrl}}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">
          Visualizza Dettagli Team
        </a>
        <p>Il Team HR</p>
      `
    };

    return templates[templateName] || '<p>{{content}}</p>';
  }

  /**
   * Invia email invito assessment
   */
  async sendAssessmentInvitation(userId, assessmentId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true }
      });

      const assessment = await prisma.assessmentInstance.findUnique({
        where: { id: assessmentId },
        include: { template: true }
      });

      if (!user || !assessment) {
        throw new Error('User or assessment not found');
      }

      const template = this.templates.get('assessment-invitation');
      const html = template({
        userName: user.name,
        assessmentName: assessment.template.name,
        assessmentType: this.getAssessmentTypeLabel(assessment.type),
        dueDate: new Date(assessment.dueDate).toLocaleDateString('it-IT'),
        estimatedTime: assessment.template.estimatedTime || 15,
        assessmentUrl: `${process.env.FRONTEND_URL}/assessments/${assessmentId}`
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'hr@moobee.com',
        to: user.email,
        subject: `Nuovo Assessment: ${assessment.template.name}`,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log notification in database
      await prisma.notificationLog.create({
        data: {
          userId,
          type: 'ASSESSMENT_INVITATION',
          referenceId: assessmentId,
          sentAt: new Date(),
          status: 'SENT',
          metadata: { messageId: result.messageId }
        }
      });

      console.log(`Assessment invitation sent to ${user.email}`);
      return result;

    } catch (error) {
      console.error('Error sending assessment invitation:', error);
      throw error;
    }
  }

  /**
   * Invia reminder assessment
   */
  async sendAssessmentReminder(userId, assessmentId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      const assessment = await prisma.assessmentInstance.findUnique({
        where: { id: assessmentId },
        include: {
          template: true,
          responses: {
            where: { userId }
          }
        }
      });

      if (!user || !assessment) {
        throw new Error('User or assessment not found');
      }

      const daysRemaining = Math.ceil(
        (new Date(assessment.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
      );

      const progress = this.calculateProgress(assessment.responses);
      const buttonText = progress > 0 ? 'Continua Assessment' : 'Inizia Assessment';

      const template = this.templates.get('assessment-reminder');
      const html = template({
        userName: user.name,
        assessmentName: assessment.template.name,
        dueDate: new Date(assessment.dueDate).toLocaleDateString('it-IT'),
        daysRemaining,
        progress,
        buttonText,
        assessmentUrl: `${process.env.FRONTEND_URL}/assessments/${assessmentId}`
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'hr@moobee.com',
        to: user.email,
        subject: `Promemoria: ${assessment.template.name} scade tra ${daysRemaining} giorni`,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          userId,
          type: 'ASSESSMENT_REMINDER',
          referenceId: assessmentId,
          sentAt: new Date(),
          status: 'SENT',
          metadata: { messageId: result.messageId, daysRemaining }
        }
      });

      console.log(`Reminder sent to ${user.email}`);
      return result;

    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }

  /**
   * Invia notifica completamento assessment
   */
  async sendAssessmentCompleted(userId, assessmentId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      const assessment = await prisma.assessmentInstance.findUnique({
        where: { id: assessmentId },
        include: { template: true }
      });

      if (!user || !assessment) {
        throw new Error('User or assessment not found');
      }

      const timeTaken = Math.round(
        (new Date(assessment.completedAt) - new Date(assessment.startedAt)) / (1000 * 60)
      );

      const template = this.templates.get('assessment-completed');
      const html = template({
        userName: user.name,
        assessmentName: assessment.template.name,
        completedDate: new Date(assessment.completedAt).toLocaleDateString('it-IT'),
        timeTaken
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'hr@moobee.com',
        to: user.email,
        subject: `Assessment Completato: ${assessment.template.name}`,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          userId,
          type: 'ASSESSMENT_COMPLETED',
          referenceId: assessmentId,
          sentAt: new Date(),
          status: 'SENT',
          metadata: { messageId: result.messageId, timeTaken }
        }
      });

      return result;

    } catch (error) {
      console.error('Error sending completion notification:', error);
      throw error;
    }
  }

  /**
   * Invia report settimanale manager
   */
  async sendWeeklyManagerReport(managerId) {
    try {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: {
          department: {
            include: {
              users: {
                include: {
                  assessmentInstances: {
                    where: {
                      createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!manager || !manager.department) {
        throw new Error('Manager or department not found');
      }

      // Calcola statistiche
      const stats = this.calculateWeeklyStats(manager.department.users);

      // Identifica top performers
      const topPerformers = await this.getTopPerformers(manager.departmentId, 5);

      const template = this.templates.get('weekly-report');
      const html = template({
        managerName: manager.name,
        completed: stats.completed,
        inProgress: stats.inProgress,
        notStarted: stats.notStarted,
        completionRate: stats.completionRate,
        topPerformers,
        dashboardUrl: `${process.env.FRONTEND_URL}/hr/dashboard`
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'hr@moobee.com',
        to: manager.email,
        subject: `Report Settimanale Assessment - ${new Date().toLocaleDateString('it-IT')}`,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log notification
      await prisma.notificationLog.create({
        data: {
          userId: managerId,
          type: 'WEEKLY_REPORT',
          sentAt: new Date(),
          status: 'SENT',
          metadata: { messageId: result.messageId, stats }
        }
      });

      return result;

    } catch (error) {
      console.error('Error sending weekly report:', error);
      throw error;
    }
  }

  /**
   * Invia aggiornamento progresso team
   */
  async sendTeamProgressUpdate(managerId, assessmentId) {
    try {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: {
          department: {
            include: {
              users: true
            }
          }
        }
      });

      const assessment = await prisma.assessmentSchedule.findUnique({
        where: { id: assessmentId },
        include: {
          assessmentInstances: {
            include: {
              user: true
            }
          }
        }
      });

      if (!manager || !assessment) {
        throw new Error('Manager or assessment not found');
      }

      const totalCount = assessment.assessmentInstances.length;
      const completedCount = assessment.assessmentInstances.filter(a => a.status === 'COMPLETED').length;
      const inProgressCount = assessment.assessmentInstances.filter(a => a.status === 'IN_PROGRESS').length;
      const percentage = Math.round((completedCount / totalCount) * 100);

      const template = this.templates.get('team-progress');
      const html = template({
        managerName: manager.name,
        assessmentName: assessment.name,
        percentage,
        completedCount,
        totalCount,
        inProgressCount,
        dueDate: new Date(assessment.dueDate).toLocaleDateString('it-IT'),
        teamUrl: `${process.env.FRONTEND_URL}/hr/team/${manager.departmentId}`
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'hr@moobee.com',
        to: manager.email,
        subject: `Aggiornamento Team: ${percentage}% completato - ${assessment.name}`,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);

      return result;

    } catch (error) {
      console.error('Error sending team progress update:', error);
      throw error;
    }
  }

  /**
   * Invia notifiche batch
   */
  async sendBatchNotifications(notifications) {
    const results = [];

    for (const notification of notifications) {
      try {
        let result;

        switch (notification.type) {
          case 'invitation':
            result = await this.sendAssessmentInvitation(notification.userId, notification.assessmentId);
            break;
          case 'reminder':
            result = await this.sendAssessmentReminder(notification.userId, notification.assessmentId);
            break;
          case 'completed':
            result = await this.sendAssessmentCompleted(notification.userId, notification.assessmentId);
            break;
          default:
            throw new Error(`Unknown notification type: ${notification.type}`);
        }

        results.push({
          success: true,
          userId: notification.userId,
          type: notification.type,
          messageId: result.messageId
        });

      } catch (error) {
        results.push({
          success: false,
          userId: notification.userId,
          type: notification.type,
          error: error.message
        });
      }

      // Delay tra email per evitare rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Utility methods
   */

  getAssessmentTypeLabel(type) {
    const labels = {
      'SELF_ASSESSMENT': 'Auto-valutazione',
      'MANAGER_ASSESSMENT': 'Valutazione Manager',
      'PEER_ASSESSMENT': 'Valutazione Colleghi',
      '360_ASSESSMENT': 'Valutazione 360°'
    };
    return labels[type] || type;
  }

  calculateProgress(responses) {
    if (!responses || responses.length === 0) return 0;
    const answeredQuestions = responses.filter(r => r.answer !== null).length;
    const totalQuestions = responses.length;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  }

  calculateWeeklyStats(users) {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let total = 0;

    users.forEach(user => {
      user.assessmentInstances.forEach(assessment => {
        total++;
        switch (assessment.status) {
          case 'COMPLETED':
            completed++;
            break;
          case 'IN_PROGRESS':
            inProgress++;
            break;
          case 'NOT_STARTED':
            notStarted++;
            break;
        }
      });
    });

    return {
      completed,
      inProgress,
      notStarted,
      total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  async getTopPerformers(departmentId, limit = 5) {
    const topPerformers = await prisma.userSoftSkill.findMany({
      where: {
        user: {
          departmentId
        },
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: true
      },
      orderBy: {
        currentScore: 'desc'
      },
      take: limit
    });

    return topPerformers.map(p => ({
      name: p.user.name,
      score: p.currentScore
    }));
  }

  /**
   * Scheduler automatico per reminder
   */
  async scheduleAutomaticReminders() {
    try {
      // Trova assessment con scadenza imminente
      const upcomingAssessments = await prisma.assessmentInstance.findMany({
        where: {
          status: 'IN_PROGRESS',
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Prossimi 3 giorni
          }
        },
        include: {
          user: true
        }
      });

      const reminders = upcomingAssessments.map(assessment => ({
        type: 'reminder',
        userId: assessment.userId,
        assessmentId: assessment.id
      }));

      if (reminders.length > 0) {
        console.log(`Scheduling ${reminders.length} automatic reminders`);
        await this.sendBatchNotifications(reminders);
      }

    } catch (error) {
      console.error('Error scheduling automatic reminders:', error);
    }
  }

  /**
   * Cleanup vecchie notifiche
   */
  async cleanupOldNotifications(daysToKeep = 90) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const deleted = await prisma.notificationLog.deleteMany({
        where: {
          sentAt: {
            lt: cutoffDate
          }
        }
      });

      console.log(`Cleaned up ${deleted.count} old notifications`);
      return deleted.count;

    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

// Singleton instance
let emailService = null;

module.exports = {
  getEmailService: () => {
    if (!emailService) {
      emailService = new EmailNotificationService();
    }
    return emailService;
  },
  EmailNotificationService
};