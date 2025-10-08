const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const extraction = await prisma.cv_extractions.findUnique({
      where: { id: '8c3a0ee8-fcea-4801-b7a7-76765c12feda' },
      select: {
        id: true,
        employee_id: true,
        original_filename: true,
        file_size_bytes: true,
        file_content: true,
        extracted_text: true,
        llm_tokens_used: true,
        llm_cost: true,
        llm_model_used: true,
        status: true
      }
    });

    console.log('\n=== CV EXTRACTION RECORD ===');
    console.log('ID:', extraction.id);
    console.log('Employee ID:', extraction.employee_id);
    console.log('Filename:', extraction.original_filename);
    console.log('File Size:', extraction.file_size_bytes?.toString(), 'bytes');
    console.log('\n📁 file_content (BYTEA):', extraction.file_content ? `✅ Saved (${extraction.file_content.length} bytes)` : '❌ NULL');
    console.log('📄 extracted_text:', extraction.extracted_text ? `✅ Saved (${extraction.extracted_text.length} chars)` : '❌ NULL');
    console.log('🔢 llm_tokens_used:', extraction.llm_tokens_used || '❌ NULL');
    console.log('💰 llm_cost:', extraction.llm_cost?.toString() || '❌ NULL');
    console.log('🤖 Model:', extraction.llm_model_used);
    console.log('Status:', extraction.status);

    // Check employee_roles
    const role = await prisma.employee_roles.findFirst({
      where: { employee_id: 144 },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        role_id: true,
        sub_role_id: true,
        anni_esperienza: true
      }
    });

    console.log('\n=== EMPLOYEE ROLE ===');
    if (role) {
      console.log('Role ID:', role.role_id || '❌ NULL');
      console.log('Sub-Role ID:', role.sub_role_id || '❌ NULL');
      console.log('Years Experience:', role.anni_esperienza);
    } else {
      console.log('❌ No role found');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
