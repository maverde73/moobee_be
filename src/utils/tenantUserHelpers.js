/**
 * @module TenantUserHelpers
 * @description Funzioni helper per la gestione degli utenti tenant
 * Estratto da tenantUserRoutes.js per rispettare Giurelli Standards
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * @description Genera una password temporanea
 * @param {string} firstName - Nome utente
 * @param {string} lastName - Cognome utente
 * @returns {string} Password temporanea
 */
function generateTempPassword(firstName, lastName) {
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return `${firstName.charAt(0).toUpperCase()}${lastName.toLowerCase()}${randomNum}!`;
}

/**
 * @description Formatta la risposta utente per l'API
 * @param {Object} user - Oggetto utente dal database
 * @returns {Object} Utente formattato
 */
function formatUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    isActive: user.is_active,
    employeeId: user.employee_id,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    // Aggiungi informazioni employee se presenti
    ...(user.employee && {
      employee: {
        id: user.employee.id,
        position: user.employee.position,
        department: user.employee.department_id
      }
    })
  };
}

/**
 * @description Genera un report di importazione
 * @param {string} tenantId - ID del tenant
 * @param {Object} importResult - Risultato dell'importazione
 * @returns {Promise<Object>} Info sul file di report generato
 */
async function generateImportReport(tenantId, importResult) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `import_report_${tenantId}_${timestamp}.txt`;
  const reportFilePath = path.join(process.cwd(), 'import_reports', reportFileName);

  // Ensure import_reports directory exists
  await fs.mkdir(path.join(process.cwd(), 'import_reports'), { recursive: true });

  // Generate report content
  let reportContent = '='.repeat(80) + '\n';
  reportContent += 'MOOBEE USER IMPORT REPORT\n';
  reportContent += '='.repeat(80) + '\n\n';
  reportContent += `Date: ${new Date().toLocaleString()}\n`;
  reportContent += `Tenant ID: ${tenantId}\n\n`;

  reportContent += 'SUMMARY\n';
  reportContent += '-'.repeat(40) + '\n';
  reportContent += `Total Users Processed: ${importResult.summary.totalProcessed}\n`;
  reportContent += `New Users Created: ${importResult.created}\n`;
  reportContent += `Users Updated: ${importResult.updated}\n`;
  reportContent += `Users Skipped: ${importResult.skipped}\n`;
  reportContent += `Employees Created: ${importResult.employeesCreated}\n`;
  reportContent += `Errors: ${importResult.errors.length}\n\n`;

  reportContent += 'DETAILED USER REPORT\n';
  reportContent += '='.repeat(80) + '\n\n';

  for (let i = 0; i < importResult.detailedReport.length; i++) {
    const report = importResult.detailedReport[i];
    reportContent += `[${i + 1}] ${report.email}\n`;
    reportContent += '-'.repeat(60) + '\n';
    reportContent += `Name: ${report.firstName} ${report.lastName}\n`;
    reportContent += `Role: ${report.role}\n`;
    reportContent += `Status: ${report.status.toUpperCase()}\n`;

    if (report.temporaryPassword) {
      reportContent += `\n**TEMPORARY PASSWORD**: ${report.temporaryPassword}\n`;
      reportContent += `Note: User must change password on first login (expires in 1 year)\n`;
    }

    reportContent += `\nActions Performed:\n`;
    report.actions.forEach((action, index) => {
      reportContent += `  ${index + 1}. ${action}\n`;
    });

    if (report.error) {
      reportContent += `\nERROR: ${report.error}\n`;
    }

    reportContent += '\n';
  }

  if (importResult.errors.length > 0) {
    reportContent += '\nERRORS ENCOUNTERED\n';
    reportContent += '='.repeat(80) + '\n';
    importResult.errors.forEach((error, index) => {
      reportContent += `${index + 1}. ${error.email}: ${error.message}\n`;
    });
  }

  reportContent += '\n' + '='.repeat(80) + '\n';
  reportContent += 'END OF REPORT\n';
  reportContent += '='.repeat(80) + '\n';

  // Write report to file
  await fs.writeFile(reportFilePath, reportContent, 'utf8');

  console.log(`\nImport report saved to: ${reportFilePath}`);

  return {
    fileName: reportFileName,
    filePath: reportFilePath
  };
}

/**
 * @description Valida i dati di un utente
 * @param {Object} userData - Dati utente da validare
 * @returns {Object} Risultato validazione
 */
function validateUserData(userData) {
  const errors = [];

  if (!userData.email || !userData.email.includes('@')) {
    errors.push('Invalid email address');
  }

  if (!userData.first_name || userData.first_name.trim().length < 1) {
    errors.push('First name is required');
  }

  if (!userData.last_name || userData.last_name.trim().length < 1) {
    errors.push('Last name is required');
  }

  if (userData.password && userData.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  generateTempPassword,
  formatUserResponse,
  generateImportReport,
  validateUserData
};