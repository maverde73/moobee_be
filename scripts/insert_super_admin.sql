-- Inserisce il Super Admin nella tabella tenant_users

-- Prima verifichiamo se esiste già
SELECT id, email, role FROM tenant_users WHERE email = 'superadmin@moobee.com';

-- Inserisci il super admin
INSERT INTO tenant_users (
    id,
    tenant_id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- ID del tenant 'default' 
    'superadmin@moobee.com',
    '$2a$10$UCsC1IHLu9jTJd9Mqr5THOVb9Y/cC3ZJ3e7kVPikOdIveB5ruSZE2', -- Password: SuperAdmin123!
    'Super',
    'Admin',
    'super_admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE
SET 
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verifica l'inserimento
SELECT id, email, first_name, last_name, role, is_active FROM tenant_users WHERE email = 'superadmin@moobee.com';