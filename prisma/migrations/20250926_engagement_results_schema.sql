-- ============================================
-- Engagement Results Table Migration
-- Date: 2025-09-26 21:30
-- Description: Creates new engagement_results and engagement_question_weights tables
--              to replace simple engagement_responses with weighted scoring system
-- ============================================

-- Step 1: Create engagement_question_weights table
CREATE TABLE IF NOT EXISTS engagement_question_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL,
    question_id UUID NOT NULL,
    area VARCHAR(50) NOT NULL,
    weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight BETWEEN 0.1 AND 3.0),
    impact_factor DECIMAL(3,2) DEFAULT 1.0 CHECK (impact_factor BETWEEN 0.1 AND 3.0),
    is_reversed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_weight_template FOREIGN KEY (template_id)
        REFERENCES engagement_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_weight_question FOREIGN KEY (question_id)
        REFERENCES engagement_questions(id) ON DELETE CASCADE,
    CONSTRAINT uq_template_question UNIQUE (template_id, question_id)
);

CREATE INDEX idx_weight_template ON engagement_question_weights(template_id);
CREATE INDEX idx_weight_area ON engagement_question_weights(area);

-- Step 2: Create engagement_results table
CREATE TABLE IF NOT EXISTS engagement_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    employee_id INTEGER NOT NULL,
    tenant_user_id VARCHAR(255) NOT NULL,
    template_id UUID NOT NULL,

    -- Response Data (JSON columns)
    responses JSONB NOT NULL,
    weighted_scores JSONB,

    -- Scoring
    area_scores JSONB,
    overall_score DECIMAL(5,2) CHECK (overall_score >= 0 AND overall_score <= 100),
    engagement_index DECIMAL(5,2),
    percentile DECIMAL(5,2) CHECK (percentile >= 0 AND percentile <= 100),
    benchmark_score DECIMAL(5,2),

    -- Analytics
    strengths JSONB,
    improvements JSONB,
    recommendations JSONB,
    sentiment VARCHAR(20) CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE')),
    trend VARCHAR(20) CHECK (trend IN ('IMPROVING', 'STABLE', 'DECLINING')),

    -- Metadata
    completed_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    time_taken INTEGER, -- seconds
    attempt_number INTEGER DEFAULT 1,
    completion_rate DECIMAL(5,2) CHECK (completion_rate >= 0 AND completion_rate <= 100),

    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20) CHECK (device_type IN ('DESKTOP', 'MOBILE', 'TABLET')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key Constraints
    CONSTRAINT fk_result_campaign FOREIGN KEY (campaign_id)
        REFERENCES engagement_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_result_assignment FOREIGN KEY (assignment_id)
        REFERENCES engagement_campaign_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_result_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_result_tenant_user FOREIGN KEY (tenant_user_id)
        REFERENCES tenant_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_result_template FOREIGN KEY (template_id)
        REFERENCES engagement_templates(id) ON DELETE CASCADE,

    -- Unique constraint for assignment attempts
    CONSTRAINT uq_assignment_attempt UNIQUE (assignment_id, attempt_number)
);

-- Create indexes for performance
CREATE INDEX idx_result_campaign ON engagement_results(campaign_id);
CREATE INDEX idx_result_employee ON engagement_results(employee_id);
CREATE INDEX idx_result_tenant_user ON engagement_results(tenant_user_id);
CREATE INDEX idx_result_completed ON engagement_results(completed_at);
CREATE INDEX idx_result_score ON engagement_results(overall_score);
CREATE INDEX idx_result_assignment ON engagement_results(assignment_id);

-- Step 3: Populate default weights for existing templates
INSERT INTO engagement_question_weights (template_id, question_id, area, weight, impact_factor)
SELECT
    eq.template_id,
    eq.id as question_id,
    CASE
        -- Map questions to areas based on keywords
        WHEN LOWER(eq.question_text) LIKE '%motivat%' OR LOWER(eq.question_text) LIKE '%energiz%' THEN 'MOTIVATION'
        WHEN LOWER(eq.question_text) LIKE '%leader%' OR LOWER(eq.question_text) LIKE '%manager%' OR LOWER(eq.question_text) LIKE '%supervis%' THEN 'LEADERSHIP'
        WHEN LOWER(eq.question_text) LIKE '%communicat%' OR LOWER(eq.question_text) LIKE '%inform%' OR LOWER(eq.question_text) LIKE '%feedback%' THEN 'COMMUNICATION'
        WHEN LOWER(eq.question_text) LIKE '%balance%' OR LOWER(eq.question_text) LIKE '%life%' OR LOWER(eq.question_text) LIKE '%stress%' THEN 'WORK_LIFE_BALANCE'
        WHEN LOWER(eq.question_text) LIKE '%belong%' OR LOWER(eq.question_text) LIKE '%team%' OR LOWER(eq.question_text) LIKE '%cultur%' THEN 'BELONGING'
        WHEN LOWER(eq.question_text) LIKE '%grow%' OR LOWER(eq.question_text) LIKE '%develop%' OR LOWER(eq.question_text) LIKE '%career%' OR LOWER(eq.question_text) LIKE '%learn%' THEN 'GROWTH'
        WHEN LOWER(eq.question_text) LIKE '%recogni%' OR LOWER(eq.question_text) LIKE '%appreciat%' OR LOWER(eq.question_text) LIKE '%reward%' THEN 'RECOGNITION'
        WHEN LOWER(eq.question_text) LIKE '%autonom%' OR LOWER(eq.question_text) LIKE '%decision%' OR LOWER(eq.question_text) LIKE '%freedom%' THEN 'AUTONOMY'
        ELSE 'GENERAL'
    END as area,
    -- Set default weights based on area importance
    CASE
        WHEN LOWER(eq.question_text) LIKE '%motivat%' THEN 1.2
        WHEN LOWER(eq.question_text) LIKE '%leader%' THEN 1.1
        WHEN LOWER(eq.question_text) LIKE '%belong%' THEN 1.1
        ELSE 1.0
    END as weight,
    1.0 as impact_factor
FROM engagement_questions eq
WHERE NOT EXISTS (
    SELECT 1 FROM engagement_question_weights
    WHERE template_id = eq.template_id AND question_id = eq.id
);

-- Step 4: Migrate existing engagement_responses to engagement_results
-- This is a complex migration that aggregates responses per assignment
WITH aggregated_responses AS (
    SELECT
        er.campaign_id,
        er.user_id as tenant_user_id,
        eca.id as assignment_id,
        eca.employee_id,
        ec.template_id,
        MIN(er.responded_at) as started_at,
        MAX(er.responded_at) as completed_at,
        COUNT(DISTINCT er.question_id) as questions_answered,
        jsonb_agg(
            jsonb_build_object(
                'question_id', er.question_id,
                'value', er.response_value,
                'text', er.response_text,
                'responded_at', er.responded_at
            ) ORDER BY er.responded_at
        ) as responses
    FROM engagement_responses er
    JOIN engagement_campaigns ec ON er.campaign_id = ec.id
    JOIN engagement_campaign_assignments eca ON
        eca.campaign_id = er.campaign_id
        AND eca.status = 'COMPLETED'
    JOIN employees e ON eca.employee_id = e.id
    JOIN tenant_users tu ON er.user_id = tu.id AND tu.email = e.email
    GROUP BY er.campaign_id, er.user_id, eca.id, eca.employee_id, ec.template_id
),
scored_responses AS (
    SELECT
        ar.*,
        -- Calculate basic overall score (average of all responses)
        (
            SELECT AVG((resp->>'value')::numeric * 20) -- Convert 1-5 scale to 0-100
            FROM jsonb_array_elements(ar.responses) as resp
            WHERE resp->>'value' IS NOT NULL
        ) as overall_score,
        -- Calculate completion rate
        (
            ar.questions_answered::numeric /
            NULLIF((SELECT COUNT(*) FROM engagement_questions WHERE template_id = ar.template_id), 0) * 100
        ) as completion_rate
    FROM aggregated_responses ar
)
INSERT INTO engagement_results (
    campaign_id,
    assignment_id,
    employee_id,
    tenant_user_id,
    template_id,
    responses,
    overall_score,
    completion_rate,
    started_at,
    completed_at,
    time_taken,
    attempt_number
)
SELECT
    campaign_id,
    assignment_id,
    employee_id,
    tenant_user_id,
    template_id,
    responses,
    COALESCE(overall_score, 0),
    COALESCE(completion_rate, 0),
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as time_taken,
    1 as attempt_number
FROM scored_responses
ON CONFLICT (assignment_id, attempt_number) DO NOTHING;

-- Step 5: Calculate area scores for migrated data
UPDATE engagement_results er
SET area_scores = (
    SELECT jsonb_object_agg(area, avg_score)
    FROM (
        SELECT
            w.area,
            AVG((r->>'value')::numeric * w.weight * 20) as avg_score
        FROM jsonb_array_elements(er.responses) as r
        LEFT JOIN engagement_question_weights w ON
            w.question_id = (r->>'question_id')::uuid
            AND w.template_id = er.template_id
        WHERE r->>'value' IS NOT NULL
        GROUP BY w.area
    ) area_calc
),
weighted_scores = (
    SELECT jsonb_object_agg(
        r->>'question_id',
        jsonb_build_object(
            'raw_value', (r->>'value')::numeric,
            'weight', COALESCE(w.weight, 1.0),
            'weighted_score', (r->>'value')::numeric * COALESCE(w.weight, 1.0) * 20
        )
    )
    FROM jsonb_array_elements(er.responses) as r
    LEFT JOIN engagement_question_weights w ON
        w.question_id = (r->>'question_id')::uuid
        AND w.template_id = er.template_id
    WHERE r->>'value' IS NOT NULL
)
WHERE er.area_scores IS NULL;

-- Step 6: Calculate percentiles within each campaign
UPDATE engagement_results er1
SET percentile = (
    SELECT PERCENT_RANK() OVER (ORDER BY overall_score) * 100
    FROM engagement_results er2
    WHERE er2.campaign_id = er1.campaign_id
    AND er2.id = er1.id
)
WHERE percentile IS NULL;

-- Step 7: Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_engagement_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER engagement_results_updated_at
    BEFORE UPDATE ON engagement_results
    FOR EACH ROW
    EXECUTE FUNCTION update_engagement_results_updated_at();

CREATE TRIGGER engagement_question_weights_updated_at
    BEFORE UPDATE ON engagement_question_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_engagement_results_updated_at();

-- Step 8: Create view for easy reporting
CREATE OR REPLACE VIEW engagement_results_summary AS
SELECT
    er.id,
    er.campaign_id,
    ec.name as campaign_name,
    er.employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    e.email as employee_email,
    er.template_id,
    et.title as template_name,
    er.overall_score,
    er.percentile,
    er.area_scores,
    er.completion_rate,
    er.completed_at,
    er.time_taken,
    er.sentiment,
    er.trend
FROM engagement_results er
JOIN engagement_campaigns ec ON er.campaign_id = ec.id
JOIN employees e ON er.employee_id = e.id
JOIN engagement_templates et ON er.template_id = et.id;

-- Step 9: Grant permissions (adjust based on your user roles)
GRANT SELECT, INSERT, UPDATE ON engagement_results TO moobee_app;
GRANT SELECT, INSERT, UPDATE ON engagement_question_weights TO moobee_app;
GRANT SELECT ON engagement_results_summary TO moobee_app;

-- Step 10: Add comments for documentation
COMMENT ON TABLE engagement_results IS 'Stores engagement survey results with weighted scoring and analytics';
COMMENT ON TABLE engagement_question_weights IS 'Defines weights for each engagement question by area and impact';
COMMENT ON COLUMN engagement_results.responses IS 'JSON array of all responses with question_id, value, and text';
COMMENT ON COLUMN engagement_results.area_scores IS 'JSON object with scores by engagement area (MOTIVATION, LEADERSHIP, etc.)';
COMMENT ON COLUMN engagement_results.weighted_scores IS 'JSON object with weighted score calculation details per question';
COMMENT ON COLUMN engagement_question_weights.area IS 'Engagement area: MOTIVATION, LEADERSHIP, COMMUNICATION, WORK_LIFE_BALANCE, BELONGING, GROWTH, RECOGNITION, AUTONOMY, GENERAL';
COMMENT ON COLUMN engagement_question_weights.weight IS 'Weight multiplier for the question (0.1 to 3.0)';
COMMENT ON COLUMN engagement_question_weights.impact_factor IS 'Business impact factor for the question';

-- Migration completed successfully
-- To rollback: DROP TABLE engagement_results CASCADE; DROP TABLE engagement_question_weights CASCADE;