-- Migration 033: Create employee_domain_knowledge table
-- Date: 7 October 2025, 01:40
-- Purpose: Store domain-specific knowledge extracted from CVs (industry, standards, processes, client sectors)

-- Create employee_domain_knowledge table
CREATE TABLE IF NOT EXISTS railway.public.employee_domain_knowledge (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,

    -- Domain categories
    domain_type VARCHAR(50) NOT NULL CHECK (domain_type IN ('industry', 'standard', 'process', 'sector')),
    domain_value VARCHAR(255) NOT NULL,

    -- Source tracking
    source VARCHAR(50) DEFAULT 'cv_extracted' CHECK (source IN ('cv_extracted', 'manual', 'verified')),
    cv_extraction_id UUID,

    -- Metadata
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    years_experience INTEGER CHECK (years_experience >= 0),

    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_employee_domain_knowledge_employee
        FOREIGN KEY (employee_id)
        REFERENCES railway.public.employees(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_employee_domain_knowledge_extraction
        FOREIGN KEY (cv_extraction_id)
        REFERENCES railway.public.cv_extractions(id)
        ON DELETE SET NULL,

    -- Unique constraint: one domain per employee
    CONSTRAINT unique_employee_domain
        UNIQUE (employee_id, domain_type, domain_value)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_domain_knowledge_employee
    ON railway.public.employee_domain_knowledge(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_domain_knowledge_type
    ON railway.public.employee_domain_knowledge(domain_type);

CREATE INDEX IF NOT EXISTS idx_employee_domain_knowledge_value
    ON railway.public.employee_domain_knowledge(domain_value);

CREATE INDEX IF NOT EXISTS idx_employee_domain_knowledge_type_value
    ON railway.public.employee_domain_knowledge(domain_type, domain_value);

-- Add comment to table
COMMENT ON TABLE railway.public.employee_domain_knowledge IS 'Domain-specific knowledge and transversal competencies extracted from employee CVs';

-- Add comments to columns
COMMENT ON COLUMN railway.public.employee_domain_knowledge.domain_type IS 'Type of domain: industry, standard, process, or sector';
COMMENT ON COLUMN railway.public.employee_domain_knowledge.domain_value IS 'Specific domain value (e.g., Banking, SEPA, KYC)';
COMMENT ON COLUMN railway.public.employee_domain_knowledge.source IS 'Source of knowledge: cv_extracted, manual, or verified';
COMMENT ON COLUMN railway.public.employee_domain_knowledge.confidence_score IS 'Confidence score from AI extraction (0.00 to 1.00)';
COMMENT ON COLUMN railway.public.employee_domain_knowledge.years_experience IS 'Years of experience in this domain';

-- Verify table created
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'employee_domain_knowledge';

-- Verify indexes created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employee_domain_knowledge'
  AND schemaname = 'public'
ORDER BY indexname;
