- **Suggerimenti**: 3
- **Warning**: 50
- **Problemi Critici**: 0
- **Tabelle con Problemi**: 0
- **Tabelle Analizzate**: 9

## 📊 Statistiche


---

# 🔄 DIFFERENZE TRA BACKEND E DATABASE

Generated: 2025-09-20T16:04:33.100Z

## Executive Summary


## Tabella: employees


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| employee_code | ✅ Esiste | character varying | YES | OK |
| first_name | ✅ Esiste | character varying | NO | OK |
| last_name | ✅ Esiste | character varying | NO | OK |
| email | ✅ Esiste | character varying | NO | OK |
| phone | ✅ Esiste | character varying | YES | OK |
| hire_date | ✅ Esiste | date | YES | OK |
| position | ✅ Esiste | character varying | YES | OK |
| department_id | ✅ Esiste | integer | YES | OK |
| manager_id | ✅ Esiste | integer | YES | OK |
| is_active | ✅ Esiste | boolean | YES | OK |
| tenant_id | ✅ Esiste | ⚠️ uuid | NO | Tipo potrebbe non corrispondere |
| created_at | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| updated_at | ✅ Esiste | timestamp without time zone | YES | OK |

### Operazione: UPDATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| first_name | ✅ Esiste | character varying | NO | OK |
| last_name | ✅ Esiste | character varying | NO | OK |
| email | ✅ Esiste | character varying | NO | OK |
| phone | ✅ Esiste | character varying | YES | OK |
| position | ✅ Esiste | character varying | YES | OK |
| department_id | ✅ Esiste | integer | YES | OK |
| manager_id | ✅ Esiste | integer | YES | OK |
| is_active | ✅ Esiste | boolean | YES | OK |
| updated_at | ✅ Esiste | timestamp without time zone | YES | OK |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| employee_code | ✅ Esiste | character varying | YES | OK |
| first_name | ✅ Esiste | character varying | NO | OK |
| last_name | ✅ Esiste | character varying | NO | OK |
| email | ✅ Esiste | character varying | NO | OK |
| phone | ✅ Esiste | character varying | YES | OK |
| hire_date | ✅ Esiste | date | YES | OK |
| position | ✅ Esiste | character varying | YES | OK |
| department_id | ✅ Esiste | integer | YES | OK |
| manager_id | ✅ Esiste | integer | YES | OK |
| is_active | ✅ Esiste | boolean | YES | OK |
| tenant_id | ✅ Esiste | ⚠️ uuid | NO | Tipo potrebbe non corrispondere |
| created_at | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| updated_at | ✅ Esiste | timestamp without time zone | YES | OK |

### ⚠️ Campi Extra nel Database (non usati dal BE):

| Campo DB | Tipo | Nullable | Suggerimento |
|----------|------|----------|--------------|
| currentRoleId | integer | YES | Valutare se rimuovere |
| lastAssessmentDate | timestamp without time zone | YES | Valutare se rimuovere |
| nextAssessmentDue | timestamp without time zone | YES | Valutare se rimuovere |

## Tabella: tenants


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | ⚠️ text | NO | Tipo potrebbe non corrispondere |
| name | ✅ Esiste | text | NO | OK |
| companyName | ✅ Esiste | text | YES | OK |
| email | ✅ Esiste | text | NO | OK |
| phone | ✅ Esiste | text | YES | OK |
| address | ✅ Esiste | text | YES | OK |
| city | ✅ Esiste | text | YES | OK |
| country | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| plan | ✅ Esiste | text | YES | OK |
| maxUsers | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: UPDATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| name | ✅ Esiste | text | NO | OK |
| companyName | ✅ Esiste | text | YES | OK |
| email | ✅ Esiste | text | NO | OK |
| phone | ✅ Esiste | text | YES | OK |
| address | ✅ Esiste | text | YES | OK |
| city | ✅ Esiste | text | YES | OK |
| country | ✅ Esiste | text | YES | OK |
| plan | ✅ Esiste | text | YES | OK |
| maxUsers | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | ⚠️ text | NO | Tipo potrebbe non corrispondere |
| name | ✅ Esiste | text | NO | OK |
| companyName | ✅ Esiste | text | YES | OK |
| email | ✅ Esiste | text | NO | OK |
| phone | ✅ Esiste | text | YES | OK |
| address | ✅ Esiste | text | YES | OK |
| city | ✅ Esiste | text | YES | OK |
| country | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| plan | ✅ Esiste | text | YES | OK |
| maxUsers | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

## Tabella: tenant_users


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| tenantId | ✅ Esiste | ⚠️ text | NO | Tipo potrebbe non corrispondere |
| email | ✅ Esiste | text | NO | OK |
| firstName | ✅ Esiste | text | YES | OK |
| lastName | ✅ Esiste | text | YES | OK |
| role | ✅ Esiste | text | NO | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| lastLogin | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: UPDATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| email | ✅ Esiste | text | NO | OK |
| firstName | ✅ Esiste | text | YES | OK |
| lastName | ✅ Esiste | text | YES | OK |
| role | ✅ Esiste | text | NO | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| lastLogin | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| tenantId | ✅ Esiste | ⚠️ text | NO | Tipo potrebbe non corrispondere |
| email | ✅ Esiste | text | NO | OK |
| firstName | ✅ Esiste | text | YES | OK |
| lastName | ✅ Esiste | text | YES | OK |
| role | ✅ Esiste | text | NO | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| lastLogin | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

## Tabella: assessment_templates


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| name | ✅ Esiste | text | NO | OK |
| type | ✅ Esiste | text | YES | OK |
| description | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| suggestedRoles | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| targetSoftSkillIds | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| createdBy | ✅ Esiste | text | YES | OK |
| version | ✅ Esiste | text | YES | OK |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: UPDATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| name | ✅ Esiste | text | NO | OK |
| type | ✅ Esiste | text | YES | OK |
| description | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| suggestedRoles | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| targetSoftSkillIds | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| version | ✅ Esiste | text | YES | OK |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| name | ✅ Esiste | text | NO | OK |
| type | ✅ Esiste | text | YES | OK |
| description | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| suggestedRoles | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| targetSoftSkillIds | ✅ Esiste | ⚠️ ARRAY | YES | Tipo potrebbe non corrispondere |
| createdBy | ✅ Esiste | text | YES | OK |
| version | ✅ Esiste | text | YES | OK |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

## Tabella: assessment_questions


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| templateId | ✅ Esiste | integer | NO | OK |
| text | ✅ Esiste | text | NO | OK |
| type | ✅ Esiste | text | NO | OK |
| category | ✅ Esiste | text | YES | OK |
| order | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| templateId | ✅ Esiste | integer | NO | OK |
| text | ✅ Esiste | text | NO | OK |
| type | ✅ Esiste | text | NO | OK |
| category | ✅ Esiste | text | YES | OK |
| order | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |

## Tabella: assessment_options


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| questionId | ✅ Esiste | integer | NO | OK |
| text | ✅ Esiste | text | NO | OK |
| value | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| questionId | ✅ Esiste | integer | NO | OK |
| text | ✅ Esiste | text | NO | OK |
| value | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |

## Tabella: soft_skills


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| name | ✅ Esiste | text | NO | OK |
| nameEn | ✅ Esiste | text | YES | OK |
| description | ✅ Esiste | text | YES | OK |
| category | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| name | ✅ Esiste | text | NO | OK |
| nameEn | ✅ Esiste | text | YES | OK |
| description | ✅ Esiste | text | YES | OK |
| category | ✅ Esiste | text | YES | OK |
| isActive | ✅ Esiste | boolean | NO | OK |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |
| updatedAt | ✅ Esiste | timestamp without time zone | NO | OK |

## Tabella: role_soft_skills


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| roleId | ✅ Esiste | integer | NO | OK |
| softSkillId | ✅ Esiste | integer | NO | OK |
| priority | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |
| minScore | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| roleId | ✅ Esiste | integer | NO | OK |
| softSkillId | ✅ Esiste | integer | NO | OK |
| priority | ✅ Esiste | ⚠️ integer | NO | Tipo potrebbe non corrispondere |
| minScore | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |
| createdAt | ✅ Esiste | ⚠️ timestamp without time zone | NO | Tipo potrebbe non corrispondere |

## Tabella: assessments


### Operazione: CREATE

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| employee_id | ✅ Esiste | integer | NO | OK |
| assessment_type | ✅ Esiste | character varying | NO | OK |
| assessment_date | ✅ Esiste | date | NO | OK |
| overall_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| technical_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| soft_skills_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| notes | ✅ Esiste | text | YES | OK |
| assessed_by | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |
| status | ✅ Esiste | character varying | YES | OK |
| created_at | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| updated_at | ✅ Esiste | timestamp without time zone | YES | OK |
| tenant_id | ✅ Esiste | ⚠️ uuid | NO | Tipo potrebbe non corrispondere |

### Operazione: READ

| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |
|--------------|----------|---------|----------|------|
| id | ✅ Esiste | integer | NO | OK |
| employee_id | ✅ Esiste | integer | NO | OK |
| assessment_type | ✅ Esiste | character varying | NO | OK |
| assessment_date | ✅ Esiste | date | NO | OK |
| overall_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| technical_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| soft_skills_score | ✅ Esiste | ⚠️ numeric | YES | Tipo potrebbe non corrispondere |
| notes | ✅ Esiste | text | YES | OK |
| assessed_by | ✅ Esiste | ⚠️ integer | YES | Tipo potrebbe non corrispondere |
| status | ✅ Esiste | character varying | YES | OK |
| created_at | ✅ Esiste | ⚠️ timestamp without time zone | YES | Tipo potrebbe non corrispondere |
| updated_at | ✅ Esiste | timestamp without time zone | YES | OK |
| tenant_id | ✅ Esiste | ⚠️ uuid | NO | Tipo potrebbe non corrispondere |

## ⚠️ WARNING (non bloccanti)

1. employees.tenant_id: tipo atteso integer, trovato uuid
2. employees.created_at: tipo atteso varchar, trovato timestamp without time zone
3. employees.tenant_id: tipo atteso integer, trovato uuid
4. employees.created_at: tipo atteso varchar, trovato timestamp without time zone
5. tenants.id: tipo atteso integer, trovato text
6. tenants.maxUsers: tipo atteso varchar, trovato integer
7. tenants.createdAt: tipo atteso varchar, trovato timestamp without time zone
8. tenants.maxUsers: tipo atteso varchar, trovato integer
9. tenants.id: tipo atteso integer, trovato text
10. tenants.maxUsers: tipo atteso varchar, trovato integer
11. tenants.createdAt: tipo atteso varchar, trovato timestamp without time zone
12. tenant_users.tenantId: tipo atteso integer, trovato text
13. tenant_users.lastLogin: tipo atteso varchar, trovato timestamp without time zone
14. tenant_users.createdAt: tipo atteso varchar, trovato timestamp without time zone
15. tenant_users.lastLogin: tipo atteso varchar, trovato timestamp without time zone
16. tenant_users.tenantId: tipo atteso integer, trovato text
17. tenant_users.lastLogin: tipo atteso varchar, trovato timestamp without time zone
18. tenant_users.createdAt: tipo atteso varchar, trovato timestamp without time zone
19. assessment_templates.suggestedRoles: tipo atteso varchar, trovato ARRAY
20. assessment_templates.targetSoftSkillIds: tipo atteso integer, trovato ARRAY
21. assessment_templates.createdAt: tipo atteso varchar, trovato timestamp without time zone
22. assessment_templates.suggestedRoles: tipo atteso varchar, trovato ARRAY
23. assessment_templates.targetSoftSkillIds: tipo atteso integer, trovato ARRAY
24. assessment_templates.suggestedRoles: tipo atteso varchar, trovato ARRAY
25. assessment_templates.targetSoftSkillIds: tipo atteso integer, trovato ARRAY
26. assessment_templates.createdAt: tipo atteso varchar, trovato timestamp without time zone
27. assessment_questions.order: tipo atteso varchar, trovato integer
28. assessment_questions.order: tipo atteso varchar, trovato integer
29. assessment_options.value: tipo atteso varchar, trovato integer
30. assessment_options.value: tipo atteso varchar, trovato integer
31. soft_skills.createdAt: tipo atteso varchar, trovato timestamp without time zone
32. soft_skills.createdAt: tipo atteso varchar, trovato timestamp without time zone
33. role_soft_skills.priority: tipo atteso varchar, trovato integer
34. role_soft_skills.minScore: tipo atteso varchar, trovato integer
35. role_soft_skills.createdAt: tipo atteso varchar, trovato timestamp without time zone
36. role_soft_skills.priority: tipo atteso varchar, trovato integer
37. role_soft_skills.minScore: tipo atteso varchar, trovato integer
38. role_soft_skills.createdAt: tipo atteso varchar, trovato timestamp without time zone
39. assessments.overall_score: tipo atteso varchar, trovato numeric
40. assessments.technical_score: tipo atteso varchar, trovato numeric
41. assessments.soft_skills_score: tipo atteso varchar, trovato numeric
42. assessments.assessed_by: tipo atteso varchar, trovato integer
43. assessments.created_at: tipo atteso varchar, trovato timestamp without time zone
44. assessments.tenant_id: tipo atteso integer, trovato uuid
45. assessments.overall_score: tipo atteso varchar, trovato numeric
46. assessments.technical_score: tipo atteso varchar, trovato numeric
47. assessments.soft_skills_score: tipo atteso varchar, trovato numeric
48. assessments.assessed_by: tipo atteso varchar, trovato integer
49. assessments.created_at: tipo atteso varchar, trovato timestamp without time zone
50. assessments.tenant_id: tipo atteso integer, trovato uuid

## 💡 SUGGERIMENTI

1. Considerare rimozione o utilizzo di employees.currentRoleId
2. Considerare rimozione o utilizzo di employees.lastAssessmentDate
3. Considerare rimozione o utilizzo di employees.nextAssessmentDue

---
## 🔧 SCRIPT SQL PER CORREZIONI

```sql
-- Script generato automaticamente per allineare DB con BE

```