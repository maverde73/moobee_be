/**
 * Run Migration 041: Remove file_content column
 * Date: 2025-10-10
 *
 * ATTENZIONE: Questa migration è IRREVERSIBILE!
 * - Rimuove la colonna file_content da cv_extractions
 * - I dati esistenti nella colonna verranno persi
 * - Eseguire SOLO dopo aver verificato che il sistema di volume storage funzioni
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function runMigration() {
  try {
    console.log('🚀 Migration 041: Remove file_content column\n');

    // Check environment
    const dbUrl = process.env.DATABASE_URL || '';
    const isProduction = dbUrl.includes('railway.app') || dbUrl.includes('prod');

    if (isProduction) {
      console.error('⚠️  ATTENZIONE: Database di PRODUZIONE rilevato!');
      console.log('   Assicurati di aver:');
      console.log('   1. Esportato tutti i file da file_content verso volume storage');
      console.log('   2. Verificato che tutti i CV funzionino con il nuovo sistema');
      console.log('   3. Fatto backup del database\n');

      const confirm = await question('   Sei sicuro di voler procedere in PRODUZIONE? (PRODUZIONE/no): ');
      if (confirm !== 'PRODUZIONE') {
        console.log('❌ Migration annullata.');
        return;
      }
    }

    // Check if column exists
    console.log('🔍 Verifica esistenza colonna file_content...');
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cv_extractions'
        AND column_name = 'file_content'
    `;

    if (!columnCheck || columnCheck.length === 0) {
      console.log('✅ Colonna file_content già rimossa (migration già eseguita)');
      return;
    }

    console.log('✅ Colonna file_content esiste\n');

    // Check for data in file_content
    console.log('📊 Verifica presenza dati in file_content...');
    const dataCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM cv_extractions
      WHERE file_content IS NOT NULL
    `;

    const recordsWithData = parseInt(dataCheck[0].count);

    if (recordsWithData > 0) {
      console.log(`⚠️  ATTENZIONE: ${recordsWithData} record hanno ancora file_content popolato!`);
      console.log('   Questi dati verranno PERSI se procedi.\n');

      const proceed = await question('   Vuoi comunque procedere? (sì/no): ');
      if (proceed.toLowerCase() !== 'sì' && proceed.toLowerCase() !== 'si') {
        console.log('❌ Migration annullata.');
        console.log('\nSuggerimento: Usa lo script di migrazione dei file prima di rimuovere la colonna.');
        return;
      }
    } else {
      console.log('✅ Nessun record con file_content popolato (safe to drop)\n');
    }

    // Execute migration
    console.log('🗑️  Rimozione colonna file_content...');

    await prisma.$executeRaw`
      ALTER TABLE cv_extractions DROP COLUMN IF EXISTS file_content
    `;

    console.log('✅ Colonna file_content rimossa con successo\n');

    // Add comment
    await prisma.$executeRaw`
      COMMENT ON TABLE cv_extractions IS 'CV extraction metadata - files now stored on volume (see cv_files table)'
    `;

    console.log('✅ Comment aggiunto alla tabella\n');

    // Verify
    const verifyCheck = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cv_extractions'
        AND column_name = 'file_content'
    `;

    if (!verifyCheck || verifyCheck.length === 0) {
      console.log('✅ Verifica: Colonna file_content non più presente\n');
    } else {
      console.error('❌ Errore: Colonna file_content ancora presente!');
      return;
    }

    console.log('='.repeat(60));
    console.log('✅ MIGRATION 041 COMPLETATA CON SUCCESSO');
    console.log('='.repeat(60));
    console.log('\nLa colonna file_content è stata rimossa da cv_extractions.');
    console.log('I file CV sono ora gestiti esclusivamente tramite:');
    console.log('- Volume storage (temp_uploads/ o /cv-storage)');
    console.log('- Tabella cv_files (metadata)\n');

    console.log('⚠️  IMPORTANTE:');
    console.log('- Aggiorna anche lo schema Prisma rimuovendo file_content');
    console.log('- Esegui: npx prisma generate\n');

  } catch (error) {
    console.error('\n❌ Migration fallita:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run migration
runMigration();
