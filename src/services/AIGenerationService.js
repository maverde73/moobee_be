/**
 * AI Generation Service Proxy
 * Redirezione al nuovo servizio modulare secondo Giurelli's Code Standards
 * Il servizio è stato refactorizzato in moduli più piccoli nella directory ./ai/
 * @module services/AIGenerationService
 */

// Export del servizio refactorizzato dalla directory ai/
// Questo mantiene la compatibilità con il codice esistente
module.exports = require('./ai/AIGenerationService');