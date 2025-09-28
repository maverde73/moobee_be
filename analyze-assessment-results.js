const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeAssessmentResults() {
  try {
    console.log('=== ANALISI ASSESSMENT RESULTS ===\n');

    // Get all assessment results
    const results = await prisma.assessment_results.findMany({
      include: {
        campaign: {
          include: {
            template: true
          }
        }
      },
      orderBy: {
        completed_at: 'desc'
      }
    });

    console.log(`📊 Totale risultati trovati: ${results.length}\n`);

    // Analyze each result
    results.forEach((result, index) => {
      console.log(`\n--- RISULTATO ${index + 1} ---`);
      console.log(`ID: ${result.id}`);
      console.log(`Campaign ID: ${result.campaign_id}`);
      console.log(`Employee ID: ${result.employee_id}`);
      console.log(`Assignment ID: ${result.assignment_id}`);
      console.log(`Completato: ${result.completed_at}`);
      console.log(`Tempo impiegato: ${result.time_taken} minuti`);
      console.log(`Tentativo #: ${result.attempt_number}`);

      // Analyze responses
      console.log('\n📝 RISPOSTE:');
      if (result.responses) {
        const responses = typeof result.responses === 'string'
          ? JSON.parse(result.responses)
          : result.responses;

        console.log(`  Numero risposte: ${Object.keys(responses).length}`);
        console.log('\n  Dettaglio risposte:');

        // Calculate score based on responses
        let totalScore = 0;
        let questionCount = 0;
        const categoryScores = {};

        Object.entries(responses).forEach(([questionId, answerData]) => {
          // Handle different response formats
          let value = 0;
          let questionText = '';

          if (typeof answerData === 'object' && answerData !== null) {
            // Format: { questionId, value, text, category }
            value = answerData.value || 0;
            questionText = answerData.text || answerData.question || '';
            const category = answerData.category || 'general';

            // Track scores by category
            if (!categoryScores[category]) {
              categoryScores[category] = { total: 0, count: 0 };
            }
            categoryScores[category].total += value;
            categoryScores[category].count++;

            console.log(`    Q${questionId}: ${questionText.substring(0, 50)}... -> Valore: ${value}`);
          } else if (typeof answerData === 'number') {
            value = answerData;
            console.log(`    Q${questionId}: Valore diretto: ${value}`);
          }

          if (value > 0) {
            totalScore += value;
            questionCount++;
          }
        });

        const calculatedScore = questionCount > 0 ? (totalScore / questionCount).toFixed(2) : 0;
        const percentage = questionCount > 0 ? (totalScore/(questionCount * 5) * 100).toFixed(1) : 0;

        console.log(`\n  📈 CALCOLO PUNTEGGIO:`);
        console.log(`    Somma totale: ${totalScore}`);
        console.log(`    Numero domande: ${questionCount}`);
        console.log(`    Media calcolata: ${calculatedScore}/5`);
        console.log(`    Percentuale: ${percentage}%`);

        console.log(`\n  📊 PUNTEGGI PER CATEGORIA:`);
        Object.entries(categoryScores).forEach(([category, data]) => {
          const avgScore = data.count > 0 ? (data.total / data.count).toFixed(2) : 0;
          console.log(`    ${category}: ${avgScore}/5 (${data.total}/${data.count})`);
        });

        // Compare with stored overall_score
        if (result.overall_score !== null) {
          console.log(`\n  ⚠️ CONFRONTO: Overall score salvato (${result.overall_score}) vs calcolato (${calculatedScore})`);
          const diff = Math.abs(result.overall_score - calculatedScore);
          if (diff > 0.1) {
            console.log(`    ❌ DISCREPANZA: Differenza di ${diff.toFixed(2)} punti`);
          } else {
            console.log(`    ✅ Corrispondono`);
          }
        }
      } else {
        console.log('  ❌ Nessuna risposta salvata');
      }

      // Analyze scores
      console.log('\n📊 SCORES:');
      if (result.scores && Object.keys(result.scores).length > 0) {
        console.log('  Scores per categoria:', JSON.stringify(result.scores, null, 2));
      } else {
        console.log('  ⚠️ VUOTO - Scores non calcolati');
      }

      // Overall score
      console.log('\n🎯 OVERALL SCORE:');
      if (result.overall_score !== null) {
        console.log(`  ${result.overall_score}`);
      } else {
        console.log('  ⚠️ NULL - Overall score non calcolato');
      }

      // Percentile
      console.log('\n📈 PERCENTILE:');
      if (result.percentile !== null) {
        console.log(`  ${result.percentile}%`);
      } else {
        console.log('  ⚠️ NULL - Percentile non calcolato');
      }

      // Strengths
      console.log('\n💪 STRENGTHS:');
      if (result.strengths && Object.keys(result.strengths).length > 0) {
        console.log('  ', JSON.stringify(result.strengths, null, 2));
      } else {
        console.log('  ⚠️ VUOTO - Punti di forza non identificati');
      }

      // Improvements
      console.log('\n📈 IMPROVEMENTS:');
      if (result.improvements && Object.keys(result.improvements).length > 0) {
        console.log('  ', JSON.stringify(result.improvements, null, 2));
      } else {
        console.log('  ⚠️ VUOTO - Aree di miglioramento non identificate');
      }

      // Recommendations
      console.log('\n💡 RECOMMENDATIONS:');
      if (result.recommendations && Object.keys(result.recommendations).length > 0) {
        console.log('  ', JSON.stringify(result.recommendations, null, 2));
      } else {
        console.log('  ⚠️ VUOTO - Raccomandazioni non generate');
      }

      console.log('\n' + '='.repeat(50));
    });

    // Summary
    console.log('\n\n=== RIEPILOGO PROBLEMI IDENTIFICATI ===');
    console.log('1. ❌ Campo "scores": VUOTO - Non vengono calcolati i punteggi per categoria');
    console.log('2. ❌ Campo "percentile": NULL - Non viene calcolato il percentile');
    console.log('3. ❌ Campo "strengths": VUOTO - Non vengono identificati i punti di forza');
    console.log('4. ❌ Campo "improvements": VUOTO - Non vengono identificate le aree di miglioramento');
    console.log('5. ❌ Campo "recommendations": VUOTO - Non vengono generate raccomandazioni AI');
    console.log('6. ⚠️ Campo "overall_score": Potrebbe non essere calcolato correttamente');

    console.log('\n=== AZIONI NECESSARIE ===');
    console.log('1. Implementare il calcolo dei scores per categoria basato sulle risposte');
    console.log('2. Calcolare il percentile confrontando con altri risultati dello stesso assessment');
    console.log('3. Implementare analisi per identificare strengths e improvements');
    console.log('4. Integrare AI per generare recommendations personalizzate');
    console.log('5. Verificare che overall_score sia calcolato correttamente');

  } catch (error) {
    console.error('Errore durante l\'analisi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeAssessmentResults();