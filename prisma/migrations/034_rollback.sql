-- Migration 034 Rollback: Recreate employee_competenze_trasversali table
-- Date: 7 October 2025, 02:30

-- WARNING: This rollback will recreate the table structure but will NOT restore data

CREATE TABLE IF NOT EXISTS railway.public.employee_competenze_trasversali (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    competenza VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    anni_esperienza INTEGER,
    livello VARCHAR(50),
    note TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_employee_competenze_employee
        FOREIGN KEY (employee_id)
        REFERENCES railway.public.employees(id)
        ON DELETE CASCADE
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_employee_competenze_employee
    ON railway.public.employee_competenze_trasversali(employee_id);
