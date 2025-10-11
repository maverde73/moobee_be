-- Migration 040: Create cv_files table for volume-based storage
-- Date: 2025-10-10
-- Purpose: Separate CV file storage from cv_extractions table
--          Store files on Railway Volume (/cv-storage) instead of database BYTEA

CREATE TABLE IF NOT EXISTS cv_files (
  id SERIAL PRIMARY KEY,
  extraction_id UUID NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,

  -- File storage fields
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  original_filename VARCHAR(255),

  -- Metadata
  uploaded_at TIMESTAMP DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_cv_files_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES cv_extractions(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_files_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_cv_files_extraction ON cv_files(extraction_id);
CREATE INDEX idx_cv_files_tenant ON cv_files(tenant_id);
CREATE INDEX idx_cv_files_uploaded_at ON cv_files(uploaded_at DESC);

-- Comment
COMMENT ON TABLE cv_files IS 'CV file storage metadata - actual files stored on Railway Volume /cv-storage';
COMMENT ON COLUMN cv_files.file_path IS 'Full path to file on volume (e.g., /cv-storage/cv_123_2025-10-10.pdf)';
COMMENT ON COLUMN cv_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN cv_files.original_filename IS 'Original uploaded filename for download';
