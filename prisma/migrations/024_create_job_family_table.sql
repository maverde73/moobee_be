-- Migration 024: Create job_family table
-- Date: 2025-10-03 23:52
-- Purpose: Create job family classification for roles

-- Create job_family table
CREATE TABLE IF NOT EXISTS job_family (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_job_family_name ON job_family(name);
CREATE INDEX idx_job_family_is_active ON job_family(is_active);

-- Insert seed data for 10 job families
INSERT INTO job_family (name, description) VALUES
  ('Developer / Engineer', 'Software development, engineering, and technical implementation roles'),
  ('QA / DevOps / SysAdmin', 'Quality assurance, DevOps, system administration, and infrastructure roles'),
  ('PM / Scrum Master', 'Project management, scrum masters, and agile delivery roles'),
  ('Business Consultant', 'Business consulting, analysis, and advisory roles'),
  ('Architect / Presales', 'Solution architecture, technical presales, and design roles'),
  ('Product Manager / UX', 'Product management, UX/UI design, and product strategy roles'),
  ('Sales / Account', 'Sales, account management, and business development roles'),
  ('HR / Support Functions', 'Human resources, administration, and support function roles'),
  ('Data & Analytics', 'Data science, analytics, business intelligence, and data engineering roles'),
  ('Finance / Legal / Admin', 'Finance, legal, compliance, and administrative roles')
ON CONFLICT (name) DO NOTHING;

-- Optional: Add job_family_id to sub_roles table (if you want to link them)
-- ALTER TABLE sub_roles ADD COLUMN job_family_id INT REFERENCES job_family(id);
-- CREATE INDEX idx_sub_roles_job_family ON sub_roles(job_family_id);

COMMIT;
