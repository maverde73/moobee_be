# Struttura Database Assessment - Moobee

## Tabelle Principali

### 1. `assessment_templates` ✅
**Scopo**: Catalogo di tutti i template di assessment disponibili nel sistema
- Contiene tutti i tipi di assessment (Big Five, DISC, Belbin, Custom)
- Template riutilizzabili con domande e opzioni
- Questa è la fonte principale per il catalogo

### 2. `tenant_assessment_selections` ✅
**Scopo**: Associazione tra tenant e template selezionati
- Traccia quali template ogni tenant ha selezionato per il proprio uso
- Relazione many-to-many tra tenants e assessment_templates
- Campi principali:
  - `tenantId`: UUID del tenant
  - `templateId`: ID del template selezionato
  - `isActive`: Se la selezione è attiva
  - `selectedAt`: Quando è stato selezionato

### 3. `assessments` ❓
**Scopo attuale**: Tabella legacy per assessment completati
**Problemi**:
- Struttura vecchia, non collegata ai template
- Campi limitati (solo scores e note)
- Non supporta la struttura domande/risposte

**Proposta**:
- **Opzione A**: Rinominare in `assessment_instances` e usarla per tracciare quando un dipendente completa un assessment
- **Opzione B**: Rimuoverla e creare nuove tabelle per le esecuzioni

## Flusso Corretto

1. **Catalogo Assessment**:
   - Legge da `assessment_templates`
   - Mostra tutti i template disponibili

2. **Selezione Tenant**:
   - Salva in `tenant_assessment_selections`
   - Associa template al tenant

3. **Pianificazione/Assegnazione**:
   - Usa solo i template da `tenant_assessment_selections` dove `tenantId = current_tenant`

4. **Esecuzione Assessment** (da implementare):
   - Crea record in `assessment_instances` (nuova tabella)
   - Salva risposte in `assessment_responses` (nuova tabella)

## Tabelle da Creare (Future)

### `assessment_instances`
```sql
- id
- templateId (FK -> assessment_templates)
- employeeId (FK -> employees)
- tenantId (FK -> tenants)
- status (pending, in_progress, completed)
- startedAt
- completedAt
- scores (JSON)
```

### `assessment_responses`
```sql
- id
- instanceId (FK -> assessment_instances)
- questionId (FK -> assessment_questions)
- optionId (FK -> assessment_options)
- textResponse
- createdAt
```