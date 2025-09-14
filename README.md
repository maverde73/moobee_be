# Moobee Backend - Node.js API

Backend API per la piattaforma Moobee di gestione HR, costruito con Node.js, Express, Prisma ORM e PostgreSQL.

## 🚀 Caratteristiche

- **Autenticazione JWT** con Access Token (15min) e Refresh Token (7 giorni)
- **Prisma ORM** per gestione database PostgreSQL
- **API RESTful** con validazione input
- **Rate Limiting** e sicurezza con Helmet
- **Logging** strutturato con Winston
- **CORS** configurabile

## 📋 Prerequisiti

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database (configurato in .env)
- Redis (opzionale, per refresh tokens)

## 🛠️ Installazione

1. Installa le dipendenze:
```bash
npm install
```

2. Configura le variabili d'ambiente nel file `.env`:
```env
DATABASE_URL="postgresql://user:password@host:port/database"
JWT_ACCESS_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3000
```

3. Genera il client Prisma:
```bash
npm run prisma:generate
```

4. Esegui il seed del database (opzionale):
```bash
npm run prisma:seed
```

## 🏃‍♂️ Avvio

### Sviluppo
```bash
npm run dev
```

### Produzione
```bash
npm start
```

### Prisma Studio (GUI Database)
```bash
npm run prisma:studio
```

## 📚 API Endpoints

### Autenticazione
- `POST /api/auth/login` - Login utente
- `POST /api/auth/refresh` - Refresh tokens
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verifica token

### Dipendenti
- `GET /api/employees` - Lista dipendenti (paginata)
- `GET /api/employees/:id` - Dettaglio dipendente
- `POST /api/employees` - Crea nuovo dipendente
- `PUT /api/employees/:id` - Aggiorna dipendente
- `GET /api/employees/:id/skills` - Skills del dipendente
- `POST /api/employees/:id/skills` - Aggiungi skill

### Ruoli
- `GET /api/roles` - Lista ruoli
- `GET /api/roles/:id` - Dettaglio ruolo
- `GET /api/roles/:id/skills` - Skills associate al ruolo
- `GET /api/roles/sub-roles/all` - Lista sotto-ruoli
- `GET /api/roles/hierarchy/tree` - Gerarchia ruoli

### Health Check
- `GET /health` - Stato del server
- `GET /api` - Info API

## 🔐 Autenticazione

Il sistema usa JWT con doppio token:

1. **Access Token**: 
   - Durata: 15 minuti
   - Usato per autenticare le richieste API
   - Header: `Authorization: Bearer <token>`

2. **Refresh Token**:
   - Durata: 7 giorni
   - Usato per ottenere nuovi access token
   - Endpoint: `/api/auth/refresh`

### Esempio Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john.doe@example.com", "password": "Password123!"}'
```

### Esempio Richiesta Autenticata
```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/api/employees
```

## 🗄️ Database

Il database PostgreSQL include le seguenti tabelle principali:

- `employees` - Dipendenti
- `departments` - Dipartimenti
- `roles` - Ruoli professionali
- `sub_roles` - Sotto-ruoli
- `skills` - Competenze tecniche
- `employee_roles` - Associazione dipendenti-ruoli
- `employee_skills` - Competenze dei dipendenti
- `projects` - Progetti
- `assessments` - Valutazioni
- `engagement_surveys` - Sondaggi di engagement

## 📝 Scripts

- `npm start` - Avvia il server
- `npm run dev` - Avvia in modalità sviluppo con nodemon
- `npm run prisma:generate` - Genera Prisma Client
- `npm run prisma:migrate` - Esegui migrazioni
- `npm run prisma:studio` - Apri Prisma Studio
- `npm run prisma:seed` - Popola database con dati test
- `npm test` - Esegui test
- `npm run lint` - Controllo qualità codice

## 🧪 Test Credentials

Dopo aver eseguito il seed:

- **John Doe** (Software Developer)
  - Email: john.doe@example.com
  - Password: Password123!

- **Jane Smith** (HR Manager)
  - Email: jane.smith@example.com
  - Password: Password123!

- **Bob Johnson** (Sales)
  - Email: bob.johnson@example.com
  - Password: Password123!

## 🔧 Configurazione

### Rate Limiting
- Window: 15 minuti
- Max requests: 100 per IP

### CORS
- Default origin: http://localhost:3001
- Configurabile via env: CORS_ORIGIN

### Logging
- Development: console (colored)
- Production: file + console

## 📦 Struttura Progetto

```
BE_nodejs/
├── src/
│   ├── config/         # Configurazioni
│   ├── controllers/    # Controller
│   ├── middlewares/    # Middleware
│   ├── routes/         # Route API
│   ├── services/       # Business logic
│   ├── utils/          # Utility
│   └── server.js       # Entry point
├── prisma/
│   ├── schema.prisma   # Schema database
│   └── seed.js         # Script seed
├── tests/              # Test
├── .env                # Variabili ambiente
└── package.json        # Dipendenze
```

## 🤝 Contribuire

1. Fork del repository
2. Crea branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📄 Licenza

ISC

## 👥 Team

Moobee Team - 2024