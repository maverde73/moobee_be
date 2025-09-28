-- Script per creare il tenant Moobee e l'utente super admin
-- Eseguire su railway.public

-- 1. Verifica se il tenant esiste già
DO $$
DECLARE
    tenant_uuid UUID;
BEGIN
    -- Genera UUID per il tenant
    tenant_uuid := gen_random_uuid();

    -- Verifica se il tenant Moobee esiste già
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE name = 'Moobee' OR "companyName" = 'Moobee HR Platform') THEN
        -- Crea il tenant Moobee
        INSERT INTO tenants (
            id,
            name,
            "companyName",
            email,
            phone,
            address,
            city,
            country,
            "isActive",
            plan,
            "maxUsers",
            "createdAt",
            "updatedAt"
        ) VALUES (
            tenant_uuid::text,
            'Moobee',
            'Moobee HR Platform',
            'admin@moobee.com',
            '+39 02 12345678',
            'Via dell''Innovazione, 1',
            'Milano',
            'Italia',
            true,
            'enterprise',
            1000,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Tenant Moobee creato con ID: %', tenant_uuid;

        -- Crea l'utente super admin per il tenant
        IF NOT EXISTS (SELECT 1 FROM tenant_users WHERE email = 'superadmin@moobee.com') THEN
            INSERT INTO tenant_users (
                "tenantId",
                email,
                "firstName",
                "lastName",
                role,
                "isActive",
                "lastLogin",
                "createdAt",
                "updatedAt"
            ) VALUES (
                tenant_uuid::text,
                'superadmin@moobee.com',
                'Super',
                'Admin',
                'super_admin',
                true,
                NULL,
                NOW(),
                NOW()
            );

            RAISE NOTICE 'Super Admin creato per tenant Moobee';
        END IF;

        -- Crea anche un utente HR Manager
        IF NOT EXISTS (SELECT 1 FROM tenant_users WHERE email = 'hr.manager@moobee.com') THEN
            INSERT INTO tenant_users (
                "tenantId",
                email,
                "firstName",
                "lastName",
                role,
                "isActive",
                "lastLogin",
                "createdAt",
                "updatedAt"
            ) VALUES (
                tenant_uuid::text,
                'hr.manager@moobee.com',
                'HR',
                'Manager',
                'hr',
                true,
                NULL,
                NOW(),
                NOW()
            );

            RAISE NOTICE 'HR Manager creato per tenant Moobee';
        END IF;

        -- Crea un utente admin standard
        IF NOT EXISTS (SELECT 1 FROM tenant_users WHERE email = 'admin@moobee.com') THEN
            INSERT INTO tenant_users (
                "tenantId",
                email,
                "firstName",
                "lastName",
                role,
                "isActive",
                "lastLogin",
                "createdAt",
                "updatedAt"
            ) VALUES (
                tenant_uuid::text,
                'admin@moobee.com',
                'Admin',
                'User',
                'admin',
                true,
                NULL,
                NOW(),
                NOW()
            );

            RAISE NOTICE 'Admin User creato per tenant Moobee';
        END IF;

    ELSE
        -- Se il tenant esiste, recupera l'ID
        SELECT id INTO tenant_uuid FROM tenants WHERE name = 'Moobee' LIMIT 1;
        RAISE NOTICE 'Tenant Moobee già esistente con ID: %', tenant_uuid;

        -- Verifica e crea gli utenti se mancanti
        IF NOT EXISTS (SELECT 1 FROM tenant_users WHERE email = 'superadmin@moobee.com') THEN
            INSERT INTO tenant_users (
                "tenantId",
                email,
                "firstName",
                "lastName",
                role,
                "isActive",
                "lastLogin",
                "createdAt",
                "updatedAt"
            ) VALUES (
                tenant_uuid::text,
                'superadmin@moobee.com',
                'Super',
                'Admin',
                'super_admin',
                true,
                NULL,
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Super Admin creato per tenant esistente';
        END IF;
    END IF;

END $$;

-- Verifica i dati inseriti
SELECT 'Tenant creato:' as info;
SELECT id, name, "companyName", email, plan, "maxUsers", "isActive"
FROM tenants
WHERE name = 'Moobee';

SELECT 'Utenti tenant creati:' as info;
SELECT tu.id, tu.email, tu."firstName", tu."lastName", tu.role, tu."isActive"
FROM tenant_users tu
JOIN tenants t ON tu."tenantId" = t.id
WHERE t.name = 'Moobee'
ORDER BY tu.role DESC, tu."createdAt";