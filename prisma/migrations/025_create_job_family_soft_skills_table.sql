-- Migration 025: Create job_family_soft_skills association table
-- Date: 2025-10-04 00:05
-- Purpose: Link job families with soft skills and define their importance

-- Create job_family_soft_skills table
CREATE TABLE IF NOT EXISTS job_family_soft_skills (
  id SERIAL PRIMARY KEY,
  job_family_id INT NOT NULL,
  soft_skill_id INT NOT NULL,
  priority INT NOT NULL CHECK (priority > 0),
  min_score INT NOT NULL CHECK (min_score BETWEEN 1 AND 5),
  is_required BOOLEAN NOT NULL DEFAULT false,
  weight DECIMAL(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  target_score INT NOT NULL CHECK (target_score BETWEEN 1 AND 5),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_jfss_job_family
    FOREIGN KEY (job_family_id) REFERENCES job_family(id) ON DELETE CASCADE,
  CONSTRAINT fk_jfss_soft_skill
    FOREIGN KEY (soft_skill_id) REFERENCES soft_skills(id) ON DELETE CASCADE,

  -- Unique constraint to prevent duplicate mappings
  CONSTRAINT unique_job_family_soft_skill
    UNIQUE(job_family_id, soft_skill_id)
);

-- Create indexes for performance
CREATE INDEX idx_jfss_job_family ON job_family_soft_skills(job_family_id);
CREATE INDEX idx_jfss_soft_skill ON job_family_soft_skills(soft_skill_id);
CREATE INDEX idx_jfss_required ON job_family_soft_skills(is_required);
CREATE INDEX idx_jfss_priority ON job_family_soft_skills(priority);

-- Create composite index for common query pattern
CREATE INDEX idx_jfss_job_family_priority ON job_family_soft_skills(job_family_id, priority);

COMMIT;
