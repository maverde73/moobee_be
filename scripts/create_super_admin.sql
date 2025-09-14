-- Script per creare il super admin nella tabella tenant_users

-- Prima vediamo la struttura della tabella
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tenant_users'
ORDER BY ordinal_position;

-- Inserisci il super admin (adatta i campi in base alla struttura effettiva)
-- NOTA: Modifica questa query dopo aver visto la struttura della tabella
/*
INSERT INTO tenant_users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_super_admin,
    tenant_id,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'superadmin@moobee.com',
    crypt('SuperAdmin123!', gen_salt('bf')), -- Password hash con bcrypt
    'Super',
    'Admin',
    'super_admin',
    true,
    NULL, -- Super admin non appartiene a nessun tenant specifico
    true,
    NOW(),
    NOW()
);
*/