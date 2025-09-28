/**
 * Script per sistemare le selezioni dei tenant nel database
 * e garantire l'isolamento corretto dei dati
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTenantSelections() {
  try {
    console.log('🔧 Fixing tenant selections in database\n');

    // 1. Verifica lo stato attuale
    console.log('1. Verifica stato attuale delle selezioni:');
    const currentSelections = await prisma.tenantAssessmentSelection.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        template: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`   Totale selezioni trovate: ${currentSelections.length}`);

    // Raggruppa per tenant
    const byTenant = {};
    currentSelections.forEach(sel => {
      if (!byTenant[sel.tenantId]) {
        byTenant[sel.tenantId] = {
          tenant: sel.tenant,
          count: 0,
          templates: []
        };
      }
      byTenant[sel.tenantId].count++;
      byTenant[sel.tenantId].templates.push(sel.template.name);
    });

    console.log('\n   Selezioni per tenant:');
    Object.entries(byTenant).forEach(([tenantId, data]) => {
      console.log(`   • ${data.tenant?.name || 'Unknown'} (${tenantId}): ${data.count} selezioni`);
      data.templates.forEach(t => console.log(`     - ${t}`));
    });

    // 2. Verifica il tenant di Raffaella Maiello
    console.log('\n2. Verifica tenant di Raffaella Maiello:');
    const raffaellaTenantId = 'b1234567-89ab-cdef-0123-456789abcdef';

    // Prima verifica se il tenant esiste
    let raffaellaTenant = await prisma.tenants.findUnique({
      where: { id: raffaellaTenantId }
    }).catch(() => null);

    if (!raffaellaTenant) {
      console.log('   ❌ Tenant non trovato. Creazione del tenant...');

      // Crea il tenant per Raffaella Maiello
      raffaellaTenant = await prisma.tenants.create({
        data: {
          id: raffaellaTenantId,
          slug: 'raffaella-maiello-org',
          name: 'Raffaella Maiello Organization',
          email: 'raffaella.maiello@example.com',
          subscription_plan: 'enterprise',
          subscription_status: 'active',
          max_employees: 100,
          settings: {
            locale: {
              currency: 'EUR',
              language: 'it',
              timezone: 'Europe/Rome',
              date_format: 'DD/MM/YYYY'
            },
            features: {
              projects: true,
              analytics: true,
              api_access: true,
              assessments: true,
              white_label: false,
              custom_reports: true
            },
            notifications: {
              sms_enabled: false,
              webhook_url: null,
              email_enabled: true
            }
          }
        }
      });

      console.log('   ✅ Tenant creato:', raffaellaTenant.name);
    } else {
      console.log('   ✅ Tenant trovato:', raffaellaTenant.name);
    }

    // 3. Verifica e correggi l'utente Raffaella Maiello
    console.log('\n3. Verifica utente Raffaella Maiello:');
    const raffaellaUser = await prisma.tenant_users.findFirst({
      where: {
        email: {
          contains: 'raffaella.maiello',
          mode: 'insensitive'
        }
      }
    });

    if (raffaellaUser) {
      console.log(`   Utente trovato: ${raffaellaUser.email}`);
      console.log(`   Tenant attuale: ${raffaellaUser.tenant_id}`);

      if (raffaellaUser.tenant_id !== raffaellaTenantId) {
        console.log('   ⚠️  Tenant ID non corretto. Aggiornamento in corso...');

        await prisma.tenant_users.update({
          where: { id: raffaellaUser.id },
          data: { tenant_id: raffaellaTenantId }
        });

        console.log('   ✅ Tenant ID aggiornato');
      } else {
        console.log('   ✅ Tenant ID corretto');
      }
    } else {
      console.log('   ❌ Utente non trovato');
    }

    // 4. Rimuovi selezioni errate per il tenant di Raffaella
    console.log('\n4. Pulizia selezioni errate:');
    const raffaellaSelections = await prisma.tenantAssessmentSelection.findMany({
      where: { tenantId: raffaellaTenantId }
    });

    if (raffaellaSelections.length > 0) {
      console.log(`   Rimozione di ${raffaellaSelections.length} selezioni errate...`);
      await prisma.tenantAssessmentSelection.deleteMany({
        where: { tenantId: raffaellaTenantId }
      });
      console.log('   ✅ Selezioni rimosse');
    } else {
      console.log('   ✅ Nessuna selezione da rimuovere');
    }

    // 5. Aggiungi alcune selezioni di esempio per il tenant di Raffaella
    console.log('\n5. Aggiunta selezioni di esempio per test:');

    // Trova alcuni template da assegnare
    const templates = await prisma.assessmentTemplate.findMany({
      take: 3,
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (templates.length > 0) {
      console.log(`   Aggiunta di ${templates.length} template di esempio...`);

      for (const template of templates) {
        await prisma.tenantAssessmentSelection.create({
          data: {
            tenantId: raffaellaTenantId,
            templateId: template.id,
            isActive: true,
            selectedBy: 'system'
          }
        });
        console.log(`   • Aggiunto: ${template.name}`);
      }

      console.log('   ✅ Selezioni di esempio aggiunte');
    } else {
      console.log('   ⚠️  Nessun template attivo trovato');
    }

    // 6. Verifica finale
    console.log('\n6. Verifica finale:');

    const finalSelections = await prisma.tenantAssessmentSelection.findMany({
      where: { tenantId: raffaellaTenantId },
      include: {
        template: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`   Selezioni per Raffaella Maiello: ${finalSelections.length}`);
    finalSelections.forEach(sel => {
      console.log(`   • ${sel.template.name} (Active: ${sel.isActive})`);
    });

    console.log('\n✅ Fix completato con successo!');
    console.log('   Il tenant di Raffaella Maiello ora ha le sue selezioni isolate');
    console.log('   Gli altri tenant mantengono le loro selezioni');

  } catch (error) {
    console.error('❌ Errore durante il fix:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
fixTenantSelections();