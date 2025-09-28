# Configurazione Ambienti - Moobee Backend

## Panoramica
Il backend Moobee supporta 3 ambienti distinti con configurazioni CORS specifiche:
- **Locale** (development)
- **Test** (Railway staging)
- **Produzione** (Railway production)

## File di Configurazione

### 1. `.env` (Default - Locale)
File principale utilizzato in sviluppo locale.
```bash
NODE_ENV=development
PORT=3000
CORS_ORIGIN="http://localhost:3001,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3001,http://127.0.0.1:5173,http://127.0.0.1:5174"
```

### 2. `.env.local`
Backup per sviluppo locale con tutte le porte necessarie.
- Supporta FE_moobee (3001, 5173)
- Supporta FE_tenant (5174)
- Include sia localhost che 127.0.0.1

### 3. `.env.test`
Configurazione per ambiente di test su Railway.
```bash
NODE_ENV=test
CORS_ORIGIN="https://moobee-be-test.up.railway.app,https://moobee-fe-tenant-test.up.railway.app,https://moobee-fe-moobee-test.up.railway.app"
```

### 4. `.env.production`
Configurazione per ambiente di produzione.
```bash
NODE_ENV=production
CORS_ORIGIN="https://moobee.app,https://www.moobee.app,https://api.moobee.app"
RATE_LIMIT_MAX_REQUESTS=50  # Più restrittivo
LOG_LEVEL=error  # Solo errori
```

## Gestione CORS Dinamica

Il server (`src/server.js`) gestisce CORS dinamicamente:

```javascript
// Parse comma-separated origins from .env
const corsOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

// Comportamento per ambiente:
// - Development: Permissivo (accetta tutti)
// - Test/Production: Restrittivo (solo origini specificate)
```

## Utilizzo per Ambiente

### Sviluppo Locale
```bash
# Usa .env di default
npm start

# O specifica esplicitamente
NODE_ENV=development npm start
```

### Test su Railway
```bash
# Railway caricherà automaticamente le variabili
# Assicurati di impostare NODE_ENV=test nelle variabili Railway
```

### Produzione su Railway
```bash
# Railway caricherà automaticamente le variabili
# Assicurati di impostare NODE_ENV=production nelle variabili Railway
```

## Variabili Railway

### Configurazione Test
Nel dashboard Railway per l'ambiente di test:
```
NODE_ENV=test
PORT=3000
CORS_ORIGIN=https://tuodominio-test.railway.app,https://altrodominio-test.railway.app
DATABASE_URL=${RAILWAY_DATABASE_URL}
REDIS_URL=${RAILWAY_REDIS_URL}
JWT_ACCESS_SECRET=test-secret-change-me
JWT_REFRESH_SECRET=test-refresh-secret-change-me
```

### Configurazione Produzione
Nel dashboard Railway per produzione:
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://moobee.app,https://www.moobee.app
DATABASE_URL=${RAILWAY_DATABASE_URL}
REDIS_URL=${RAILWAY_REDIS_URL}
JWT_ACCESS_SECRET=strong-production-secret
JWT_REFRESH_SECRET=strong-production-refresh-secret
RATE_LIMIT_MAX_REQUESTS=50
LOG_LEVEL=error
```

## Domini Frontend

### Porte Locali
- **BE_nodejs**: 3000 (sempre)
- **FE_moobee**: 3001 o 5173
- **FE_tenant**: 5174 (sempre)

### URL Test (esempio)
- **Backend**: https://moobee-be-test.up.railway.app
- **FE Tenant**: https://moobee-fe-tenant-test.up.railway.app
- **FE Moobee**: https://moobee-fe-moobee-test.up.railway.app

### URL Produzione (esempio)
- **Backend**: https://api.moobee.app
- **FE Tenant**: https://tenant.moobee.app
- **FE Moobee**: https://app.moobee.app

## Troubleshooting CORS

### Errore: "Not allowed by CORS"
1. Verifica che l'origine sia nella lista CORS_ORIGIN
2. Controlla NODE_ENV (development è più permissivo)
3. Assicurati che l'URL includa il protocollo (http:// o https://)

### Test CORS
```bash
# Test locale
curl -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3000/api/health

# Test produzione
curl -H "Origin: https://moobee.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://api.moobee.app/api/health
```

## Sicurezza

### Best Practices
1. **Mai usare `CORS_ORIGIN="*"` in produzione**
2. **Specifica sempre domini completi con protocollo**
3. **Mantieni JWT secrets forti e unici per ambiente**
4. **Rate limiting più restrittivo in produzione**
5. **Log level minimo in produzione**

### Rotazione Secrets
```bash
# Genera nuovi secrets per produzione
openssl rand -base64 32  # Per JWT_ACCESS_SECRET
openssl rand -base64 32  # Per JWT_REFRESH_SECRET
```

## Script di Deploy

### Deploy Test
```bash
#!/bin/bash
# deploy-test.sh
git push railway-test main:main
echo "Deploy completato su test. Verifica CORS per domini test."
```

### Deploy Produzione
```bash
#!/bin/bash
# deploy-prod.sh
echo "⚠️  Deploy in produzione. Verificare:"
echo "- NODE_ENV=production"
echo "- CORS_ORIGIN configurato correttamente"
echo "- JWT secrets forti"
read -p "Continuare? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push railway-prod main:main
fi
```

## Monitoraggio

### Verifica Configurazione Attiva
Aggiungi endpoint di health check che mostra l'ambiente:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    cors: process.env.CORS_ORIGIN?.split(',').length + ' origins configured'
  });
});
```

## Note Importanti

1. **Non committare file .env con secrets reali**
2. **Usa variabili Railway per secrets in produzione**
3. **Testa sempre CORS dopo deploy**
4. **Monitora rate limiting in produzione**
5. **Aggiorna domini CORS quando cambi URL frontend**