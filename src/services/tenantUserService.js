/**
 * @module TenantUserService
 * @description Service layer per la gestione degli utenti tenant
 * Estratto da tenantUserRoutes.js per rispettare Giurelli Standards
 */

const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * @description Ottiene tutti gli utenti di un tenant
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Array>} Lista degli utenti
 */
async function getUsersForTenant(tenantId) {
  const users = await prisma.tenant_users.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true
    },
    select: {
      id: true,
      email: true,
      role: true,
      is_active: true,
      employee_id: true,
      created_at: true,
      updated_at: true,
      employees: {
        select: {
          first_name: true,
          last_name: true,
          position: true
        }
      }
    }
    // Removed orderBy here - will sort in JavaScript to avoid segfault
  });

  // Map per retrocompatibilità (mantenere struttura flat) e ordina in memoria
  const mappedUsers = users.map(user => ({
    ...user,
    first_name: user.employees?.first_name || '',
    last_name: user.employees?.last_name || '',
    position: user.employees?.position || null,
    employees: undefined // Rimuovi l'oggetto employees nested per mantenere la struttura flat
  }));

  // Ordina per cognome e poi per nome (in JavaScript per evitare segfault)
  return mappedUsers.sort((a, b) => {
    const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
    if (lastNameCompare !== 0) return lastNameCompare;
    return (a.first_name || '').localeCompare(b.first_name || '');
  });
}

/**
 * @description Ottiene un utente specifico
 * @param {string} userId - ID dell'utente
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object|null>} Utente o null
 */
async function getUserById(userId, tenantId) {
  const user = await prisma.tenant_users.findFirst({
    where: {
      id: userId,
      tenant_id: tenantId
    },
    include: {
      employees: true
    }
  });

  if (!user) return null;

  // Map per retrocompatibilità (mantenere struttura flat)
  return {
    ...user,
    first_name: user.first_name || user.employees?.first_name || '',
    last_name: user.last_name || user.employees?.last_name || '',
    position: user.employees?.position || null
  };
}

/**
 * @description Verifica se un utente esiste già
 * @param {string} email - Email dell'utente
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<boolean>} True se esiste
 */
async function checkUserExists(email, tenantId) {
  const user = await prisma.tenant_users.findFirst({
    where: {
      email: email.toLowerCase(),
      tenant_id: tenantId
    }
  });
  return !!user;
}

/**
 * @description Crea un nuovo utente
 * @param {Object} userData - Dati dell'utente
 * @returns {Promise<Object>} Utente creato
 */
async function createUser(userData) {
  // Prima crea employee record se necessario
  let employeeId = userData.employee_id;

  if (!employeeId && userData.tenant_id) {
    // Determine position based on role
    let position = userData.position || null;
    if (!position && userData.role === 'hr') {
      position = 'HR Manager';
    }
    // For 'employee' role, position remains null/empty if not provided

    const employee = await prisma.employees.create({
      data: {
        tenant_id: userData.tenant_id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        position: position,
        department_id: userData.department_id || null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    employeeId = employee.id;
  }

  // Rimuovi first_name e last_name da userData prima di creare tenant_user
  const { first_name, last_name, ...userDataWithoutNames } = userData;

  return await prisma.tenant_users.create({
    data: {
      ...userDataWithoutNames,
      employee_id: employeeId,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

/**
 * @description Aggiorna un utente esistente
 * @param {string} userId - ID dell'utente
 * @param {string} tenantId - ID del tenant
 * @param {Object} updateData - Dati da aggiornare
 * @returns {Promise<Object|null>} Utente aggiornato o null
 */
async function updateUser(userId, tenantId, updateData) {
  // Verifica che l'utente esista e appartenga al tenant
  const existingUser = await getUserById(userId, tenantId);
  if (!existingUser) {
    return null;
  }

  // Separa i dati per le due tabelle
  const employeeData = {};
  const userData = {};

  // Campi per employees table (single source of truth per dati anagrafici)
  if (updateData.first_name !== undefined) employeeData.first_name = updateData.first_name;
  if (updateData.last_name !== undefined) employeeData.last_name = updateData.last_name;
  if (updateData.position !== undefined) employeeData.position = updateData.position;

  // Campi per tenant_users table
  if (updateData.email !== undefined) {
    userData.email = updateData.email;
    employeeData.email = updateData.email; // Email in entrambe per ora
  }
  if (updateData.role !== undefined) userData.role = updateData.role;
  if (updateData.is_active !== undefined) userData.is_active = updateData.is_active;

  // Hash password se fornita
  if (updateData.password) {
    userData.password_hash = await bcrypt.hash(updateData.password, 10);
  }

  try {
    // Usa transaction per atomicità
    const result = await prisma.$transaction(async (tx) => {
      // Update employee se ci sono campi da aggiornare
      if (existingUser.employee_id && Object.keys(employeeData).length > 0) {
        await tx.employees.update({
          where: { id: existingUser.employee_id },
          data: {
            ...employeeData,
            updated_at: new Date()
          }
        });
      }

      // Update tenant_user
      // NOTA: first_name e last_name NON esistono più in tenant_users
      // Sono gestiti solo nella tabella employees
      const userUpdateData = {
        ...userData,
        // Rimuovi campi che non esistono più in tenant_users
        updated_at: new Date()
      };

      const updatedUser = await tx.tenant_users.update({
        where: { id: userId },
        data: userUpdateData,
        include: {
          employees: true
        }
      });

      return updatedUser;
    });

    // Return con mapping per retrocompatibilità
    return {
      ...result,
      // I nomi ora vengono SOLO da employees
      first_name: result.employees?.[0]?.first_name || '',
      last_name: result.employees?.[0]?.last_name || '',
      position: result.employees?.[0]?.position || null
    };
  } catch (error) {
    console.error('Prisma update error:', error);
    console.error('Update data was:', updateData);
    throw error;
  }
}

/**
 * @description Elimina un utente (soft delete)
 * @param {string} userId - ID dell'utente
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<boolean>} True se eliminato
 */
async function deleteUser(userId, tenantId) {
  const user = await getUserById(userId, tenantId);
  if (!user) {
    return false;
  }

  await prisma.tenant_users.update({
    where: { id: userId },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });

  // Disattiva anche employee se esiste
  if (user.employee_id) {
    await prisma.employees.update({
      where: { id: user.employee_id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });
  }

  return true;
}

/**
 * @description Importa utenti in batch
 * @param {string} tenantId - ID del tenant
 * @param {Array} users - Array di utenti da importare
 * @returns {Promise<Object>} Risultato dell'importazione
 */
async function importUsers(tenantId, users) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let employeesCreated = 0;
  const errors = [];
  const processedUsers = [];
  const detailedReport = [];

  for (const userData of users) {
    const userReport = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || 'employee',
      actions: [],
      status: 'processing',
      temporaryPassword: null
    };

    try {
      // Check if user exists
      const existingUser = await prisma.tenant_users.findFirst({
        where: {
          email: userData.email.toLowerCase(),
          tenant_id: tenantId
        }
      });

      if (existingUser) {
        if (!existingUser.employee_id) {
          // Determine position based on role
          let position = null;
          if (userData.role === 'hr') {
            position = 'HR Manager';
          }
          // For 'employee' role, position remains null/empty

          // Create employee record for existing user
          const employee = await prisma.employees.create({
            data: {
              tenant_id: tenantId,
              email: userData.email,
              first_name: userData.firstName,
              last_name: userData.lastName,
              position: position,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          });

          await prisma.tenant_users.update({
            where: { id: existingUser.id },
            data: {
              employee_id: employee.id,
              updated_at: new Date()
            }
          });

          employeesCreated++;
          updated++;
          userReport.status = 'updated';
          userReport.actions.push('Created missing employee record');
        } else {
          skipped++;
          userReport.status = 'skipped';
          userReport.actions.push('User already complete');
        }
      } else {
        // Create new user with temp password
        const tempPassword = generateTempPassword(userData.firstName, userData.lastName);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Determine position based on role
        let position = null;
        if (userData.role === 'hr') {
          position = 'HR Manager';
        }
        // For 'employee' role, position remains null/empty

        // Create employee first
        const employee = await prisma.employees.create({
          data: {
            tenant_id: tenantId,
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            position: position,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // Create tenant user (nome/cognome ora solo in employees)
        await prisma.tenant_users.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            email: userData.email.toLowerCase(),
            password_hash: hashedPassword,
            role: userData.role || 'employee',
            employee_id: employee.id,
            is_active: true,
            password_reset_token: uuidv4(),
            password_reset_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        created++;
        employeesCreated++;
        userReport.status = 'created';
        userReport.temporaryPassword = tempPassword;
        userReport.actions.push('Created new user and employee');
      }

      processedUsers.push(userReport);
      detailedReport.push(userReport);

    } catch (error) {
      console.error(`Error processing user ${userData.email}:`, error);
      userReport.status = 'error';
      userReport.error = error.message;
      errors.push({
        email: userData.email,
        message: error.message
      });
      detailedReport.push(userReport);
    }
  }

  return {
    created,
    updated,
    skipped,
    employeesCreated,
    errors,
    processedUsers,
    detailedReport,
    summary: {
      totalProcessed: users.length,
      created,
      updated,
      skipped,
      errors: errors.length,
      employeesCreated
    }
  };
}

/**
 * @description Genera una password temporanea
 * @param {string} firstName - Nome dell'utente
 * @param {string} lastName - Cognome dell'utente
 * @returns {string} Password temporanea
 */
function generateTempPassword(firstName, lastName) {
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return `${firstName.charAt(0).toUpperCase()}${lastName.toLowerCase()}${randomNum}!`;
}

module.exports = {
  getUsersForTenant,
  getUserById,
  checkUserExists,
  createUser,
  updateUser,
  deleteUser,
  importUsers
};