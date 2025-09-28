-- Ricrea il tenant Moobee e il super admin dopo reset database

-- Inserisci tenant Moobee
INSERT INTO tenants (
    id,
    slug,
    name,
    is_deleted,
    is_active,
    subscription_plan,
    subscription_status,
    max_employees,
    "isActive",
    plan,
    "maxUsers",
    "createdAt",
    "updatedAt"
) VALUES (
    'bec3cb9d-173e-4790-aaa0-98d7aa7ea387',
    'moobee',
    'Moobee',
    false,
    true,
    'enterprise',
    'active',
    1000,
    true,
    'enterprise',
    1000,
    NOW(),
    NOW()
);

-- Inserisci super admin user (password: SuperAdmin123!)
INSERT INTO tenant_users (
    "tenantId",
    tenant_id,
    email,
    password_hash,
    "firstName",
    "lastName",
    first_name,
    last_name,
    role,
    "isActive",
    is_active,
    created_at,
    updated_at,
    "createdAt",
    "updatedAt"
) VALUES (
    'bec3cb9d-173e-4790-aaa0-98d7aa7ea387',
    'bec3cb9d-173e-4790-aaa0-98d7aa7ea387',
    'superadmin@moobee.com',
    '$2a$10$aHK0Zxa6YFEJ3oXSKJvYJOcgz7jqYGImL5zB7oKJhKWXC/FHuWwXO',
    'Super',
    'Admin',
    'Super',
    'Admin',
    'super_admin',
    true,
    true,
    NOW(),
    NOW(),
    NOW(),
    NOW()
);