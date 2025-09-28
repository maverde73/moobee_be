const prisma = require('../config/database');

/**
 * Controller per la gestione dei ruoli
 */
class RolesController {
  /**
   * Recupera tutti i ruoli disponibili
   */
  async getAllRoles(req, res) {
    try {
      // Prima prova a recuperare dalla tabella roles (se presente)
      try {
        const roles = await prisma.$queryRaw`
          SELECT DISTINCT id, "Role" as role, "NameKnown_Role" as name
          FROM roles
          WHERE "Role" IS NOT NULL
          ORDER BY "Role"
        `;

        if (roles && roles.length > 0) {
          const formattedRoles = roles.map(r => ({
            id: r.id,
            name: r.name || r.role,
            role: r.role,
            displayName: r.role // Solo il nome senza prefisso numerico
          }));

          return res.json({
            success: true,
            data: formattedRoles
          });
        }
      } catch (e) {
        console.log('Tabella roles non trovata, uso ruoli predefiniti');
      }

      // Se non ci sono ruoli nel database, restituisci ruoli predefiniti
      const defaultRoles = [
        { id: 1, name: 'Manager', role: 'Manager', displayName: 'Manager' },
        { id: 2, name: 'Developer', role: 'Developer', displayName: 'Developer' },
        { id: 3, name: 'HR', role: 'HR', displayName: 'HR' },
        { id: 4, name: 'Sales', role: 'Sales', displayName: 'Sales' },
        { id: 5, name: 'Team Lead', role: 'Team Lead', displayName: 'Team Lead' },
        { id: 6, name: 'Project Manager', role: 'Project Manager', displayName: 'Project Manager' },
        { id: 7, name: 'All Employees', role: 'All Employees', displayName: 'All Employees' },
        { id: 8, name: 'Customer Service', role: 'Customer Service', displayName: 'Customer Service' },
        { id: 9, name: 'Engineers', role: 'Engineers', displayName: 'Engineers' },
        { id: 10, name: 'IT Staff', role: 'IT Staff', displayName: 'IT Staff' },
        { id: 11, name: 'Remote Workers', role: 'Remote Workers', displayName: 'Remote Workers' },
        { id: 12, name: 'New Hires', role: 'New Hires', displayName: 'New Hires' },
        { id: 13, name: 'Account Managers', role: 'Account Managers', displayName: 'Account Managers' }
      ];

      res.json({
        success: true,
        data: defaultRoles
      });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles'
      });
    }
  }

  /**
   * Recupera i ruoli suggeriti per gli assessment
   */
  async getAssessmentRoles(req, res) {
    try {
      // Recupera ruoli unici dagli assessment esistenti
      const templates = await prisma.assessmentTemplate.findMany({
        select: {
          suggestedRoles: true
        },
        where: {
          isActive: true
        }
      });

      // Estrai ruoli unici
      const allRoles = new Set();
      templates.forEach(template => {
        if (template.suggestedRoles) {
          template.suggestedRoles.forEach(role => {
            // Pulisci il ruolo rimuovendo il prefisso numerico se presente
            const cleanRole = role.includes(':') ? role.split(':')[1].trim() : role;
            allRoles.add(cleanRole);
          });
        }
      });

      const uniqueRoles = Array.from(allRoles).sort().map((role, index) => ({
        id: index + 1,
        name: role,
        role: role,
        displayName: role
      }));

      res.json({
        success: true,
        data: uniqueRoles
      });
    } catch (error) {
      console.error('Error fetching assessment roles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assessment roles'
      });
    }
  }
}

module.exports = new RolesController();