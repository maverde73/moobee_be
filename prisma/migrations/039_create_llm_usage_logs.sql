-- Migration 039: LLM Usage Audit Logging
-- Creates comprehensive logging table for all LLM operations
-- Date: 10 October 2025

-- Create llm_usage_logs table
CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- LLM Operation Details
  operation_type VARCHAR(100) NOT NULL, -- 'cv_extraction', 'role_matching', 'assessment_generation', 'skill_enrichment', etc.
  entity_type VARCHAR(50), -- 'cv_extraction', 'employee', 'assessment', etc.
  entity_id VARCHAR(255), -- ID of the entity being processed

  -- LLM Provider & Model
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google', etc.
  model VARCHAR(100) NOT NULL, -- 'gpt-4o', 'claude-3-opus', 'gemini-pro', etc.

  -- Token Usage & Cost
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  estimated_cost DECIMAL(10, 6), -- Cost in USD

  -- Request/Response Metadata
  request_params JSON, -- Input parameters (sanitized, no sensitive data)
  response_summary JSON, -- Summary of response (not full text)

  -- Performance & Status
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'timeout', 'rate_limited'
  response_time_ms INT, -- Response time in milliseconds
  error_message TEXT,

  -- Context & Traceability
  user_id VARCHAR(255), -- User who triggered the operation
  request_id VARCHAR(255), -- Unique request ID for correlation
  parent_operation_id UUID, -- For nested/chained operations

  -- Audit Fields
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  metadata JSON -- Additional context-specific data
);

-- Indexes for performance
CREATE INDEX idx_llm_logs_tenant ON llm_usage_logs(tenant_id);
CREATE INDEX idx_llm_logs_operation_type ON llm_usage_logs(operation_type);
CREATE INDEX idx_llm_logs_created_at ON llm_usage_logs(created_at DESC);
CREATE INDEX idx_llm_logs_status ON llm_usage_logs(status);
CREATE INDEX idx_llm_logs_entity ON llm_usage_logs(entity_type, entity_id);
CREATE INDEX idx_llm_logs_cost ON llm_usage_logs(estimated_cost DESC);

-- Composite index for common queries (cost per tenant per month)
CREATE INDEX idx_llm_logs_tenant_month_cost ON llm_usage_logs(
  tenant_id,
  DATE_TRUNC('month', created_at),
  estimated_cost
);

-- Comments for documentation
COMMENT ON TABLE llm_usage_logs IS 'Comprehensive audit log for all LLM API calls across the platform';
COMMENT ON COLUMN llm_usage_logs.operation_type IS 'Type of operation: cv_extraction, role_matching_fallback, assessment_generation, etc.';
COMMENT ON COLUMN llm_usage_logs.estimated_cost IS 'Estimated cost in USD based on token usage and model pricing';
COMMENT ON COLUMN llm_usage_logs.request_params IS 'Sanitized request parameters (no PII/sensitive data)';
