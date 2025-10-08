-- Migration 032: Create notifications table
-- Date: 6 October 2025, 21:50
-- Purpose: Create notifications table for CV extraction and other system notifications
--          visible to employee owner and HR managers of the tenant

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Notification type and content
  type VARCHAR(50) NOT NULL CHECK (type IN ('cv_extraction', 'info', 'success', 'error', 'warning', 'assessment_assigned', 'engagement_assigned')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Status and progress (for CV extraction)
  status VARCHAR(50) CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INT CHECK (progress >= 0 AND progress <= 100),

  -- Related entities
  employee_id INT, -- Employee who owns this notification (NULL = all HR)
  related_entity_type VARCHAR(50), -- 'cv_extraction', 'assessment', 'engagement', etc.
  related_entity_id UUID, -- ID of related entity (e.g., cv_extraction.id)

  -- Metadata
  data JSONB, -- Additional data (stats, errors, etc.)

  -- Read tracking (per user)
  read_by TEXT[], -- Array of user IDs who have read this notification

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,

  -- Indexes
  CHECK (status IS NULL OR type = 'cv_extraction') -- Only CV extraction has status
);

-- Indexes for performance
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_employee ON notifications(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_status ON notifications(status) WHERE deleted_at IS NULL AND type = 'cv_extraction';
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC) WHERE deleted_at IS NULL;

-- GIN index for data JSONB
CREATE INDEX idx_notifications_data_gin ON notifications USING GIN(data) WHERE deleted_at IS NULL;

-- Comment
COMMENT ON TABLE notifications IS 'System notifications visible to employee owner and HR managers of tenant';
COMMENT ON COLUMN notifications.employee_id IS 'NULL = visible to all HR managers, NOT NULL = visible to specific employee + HR';
COMMENT ON COLUMN notifications.read_by IS 'Array of user IDs (employee.id or tenant_user.id) who marked as read';
COMMENT ON COLUMN notifications.data IS 'Additional data: { stats, error, cv_extraction_id, etc. }';
