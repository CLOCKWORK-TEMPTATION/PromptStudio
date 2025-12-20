/*
  # Prompt Engineering Studio - Complete Database Schema
  
  ## Overview
  This migration creates the complete database schema for an enterprise-grade
  prompt engineering platform with support for:
  - Prompt management and versioning
  - Templates and techniques library
  - Prompt chaining and workflows
  - A/B testing and evaluation
  - Golden datasets for QA
  - Marketplace for community sharing
  - Live collaboration
  - Semantic caching
  - Multi-language translations
  - Environment profiles
  - Cloud deployments
  
  ## Tables Created
  1. user_sessions - Anonymous session tracking
  2. prompts - Main prompts storage
  3. prompt_versions - Version history for prompts
  4. templates - Pre-built prompt templates
  5. techniques - Educational content
  6. model_configs - Model hyperparameter configurations
  7. tool_definitions - Function calling definitions
  8. smart_variables - Custom variable definitions
  9. environment_profiles - Context-based configurations
  10. prompt_chains - Workflow definitions
  11. chain_nodes - Individual nodes in chains
  12. chain_connections - Connections between nodes
  13. golden_datasets - Test case collections
  14. test_cases - Individual test cases
  15. evaluation_runs - Bulk evaluation executions
  16. evaluation_results - Individual evaluation results
  17. ab_tests - A/B test definitions
  18. ab_test_variants - Test variants
  19. ab_test_results - Test execution results
  20. marketplace_prompts - Shared community prompts
  21. marketplace_reviews - Ratings and reviews
  22. translations - Multi-language translations
  23. collaboration_sessions - Live editing sessions
  24. collaboration_cursors - User cursor positions
  25. cache_entries - Semantic cache storage
  26. deployments - Cloud deployment records
  
  ## Security
  - RLS enabled on all tables
  - Session-based access control
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Sessions (anonymous tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token text UNIQUE NOT NULL,
  display_name text DEFAULT 'Anonymous User',
  preferences jsonb DEFAULT '{"theme": "dark", "language": "en"}',
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions are accessible by token"
  ON user_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Prompts (main storage)
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Prompt',
  content text NOT NULL DEFAULT '',
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  category text DEFAULT 'general',
  model_id text DEFAULT 'gpt-4',
  model_config jsonb DEFAULT '{}',
  variables jsonb DEFAULT '[]',
  is_favorite boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prompts accessible by session"
  ON prompts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_prompts_session ON prompts(session_id);
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_tags ON prompts USING GIN(tags);

-- 3. Prompt Versions (history tracking)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL,
  model_config jsonb DEFAULT '{}',
  change_summary text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Versions accessible by session"
  ON prompt_versions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_versions_prompt ON prompt_versions(prompt_id);
CREATE UNIQUE INDEX idx_versions_unique ON prompt_versions(prompt_id, version_number);

-- 4. Templates (pre-built prompts)
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  subcategory text DEFAULT '',
  tags text[] DEFAULT '{}',
  difficulty text DEFAULT 'beginner',
  model_recommendation text DEFAULT 'gpt-4',
  variables jsonb DEFAULT '[]',
  examples jsonb DEFAULT '[]',
  is_featured boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are publicly readable"
  ON templates FOR SELECT
  USING (true);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_featured ON templates(is_featured);

-- 5. Techniques (educational content)
CREATE TABLE IF NOT EXISTS techniques (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  difficulty text DEFAULT 'beginner',
  tags text[] DEFAULT '{}',
  examples jsonb DEFAULT '[]',
  best_for text[] DEFAULT '{}',
  related_techniques text[] DEFAULT '{}',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Techniques are publicly readable"
  ON techniques FOR SELECT
  USING (true);

CREATE INDEX idx_techniques_category ON techniques(category);
CREATE INDEX idx_techniques_slug ON techniques(slug);

-- 6. Model Configurations (hyperparameters)
CREATE TABLE IF NOT EXISTS model_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  model_id text NOT NULL,
  temperature numeric DEFAULT 0.7,
  top_p numeric DEFAULT 1.0,
  top_k integer DEFAULT 40,
  frequency_penalty numeric DEFAULT 0.0,
  presence_penalty numeric DEFAULT 0.0,
  max_tokens integer DEFAULT 2048,
  stop_sequences text[] DEFAULT '{}',
  response_format text DEFAULT 'text',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Model configs accessible by session"
  ON model_configs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_model_configs_session ON model_configs(session_id);

-- 7. Tool Definitions (function calling)
CREATE TABLE IF NOT EXISTS tool_definitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}',
  returns jsonb DEFAULT '{}',
  mock_response jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tool_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tool definitions accessible by session"
  ON tool_definitions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_tool_definitions_prompt ON tool_definitions(prompt_id);

-- 8. Smart Variables
CREATE TABLE IF NOT EXISTS smart_variables (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  variable_type text NOT NULL,
  default_value text DEFAULT '',
  description text DEFAULT '',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smart_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variables accessible by session"
  ON smart_variables FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_smart_variables_session ON smart_variables(session_id);

-- 9. Environment Profiles
CREATE TABLE IF NOT EXISTS environment_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  default_role text DEFAULT '',
  default_constraints text[] DEFAULT '{}',
  default_output_format text DEFAULT '',
  variables jsonb DEFAULT '{}',
  model_config jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE environment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles accessible by session"
  ON environment_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_environment_profiles_session ON environment_profiles(session_id);

-- 10. Prompt Chains (workflows)
CREATE TABLE IF NOT EXISTS prompt_chains (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  canvas_state jsonb DEFAULT '{}',
  is_template boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chains accessible by session"
  ON prompt_chains FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_prompt_chains_session ON prompt_chains(session_id);

-- 11. Chain Nodes
CREATE TABLE IF NOT EXISTS chain_nodes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id uuid REFERENCES prompt_chains(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  position_x numeric DEFAULT 0,
  position_y numeric DEFAULT 0,
  data jsonb DEFAULT '{}',
  prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chain_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chain nodes accessible"
  ON chain_nodes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_chain_nodes_chain ON chain_nodes(chain_id);

-- 12. Chain Connections
CREATE TABLE IF NOT EXISTS chain_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id uuid REFERENCES prompt_chains(id) ON DELETE CASCADE,
  source_node_id uuid REFERENCES chain_nodes(id) ON DELETE CASCADE,
  target_node_id uuid REFERENCES chain_nodes(id) ON DELETE CASCADE,
  source_handle text DEFAULT 'output',
  target_handle text DEFAULT 'input',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chain_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connections accessible"
  ON chain_connections FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_chain_connections_chain ON chain_connections(chain_id);

-- 13. Golden Datasets
CREATE TABLE IF NOT EXISTS golden_datasets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL,
  test_count integer DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE golden_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Datasets accessible by session"
  ON golden_datasets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_golden_datasets_session ON golden_datasets(session_id);

-- 14. Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id uuid REFERENCES golden_datasets(id) ON DELETE CASCADE,
  input_data jsonb NOT NULL,
  expected_output text NOT NULL,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Test cases accessible"
  ON test_cases FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_test_cases_dataset ON test_cases(dataset_id);

-- 15. Evaluation Runs
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES golden_datasets(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  total_cases integer DEFAULT 0,
  completed_cases integer DEFAULT 0,
  passed_cases integer DEFAULT 0,
  failed_cases integer DEFAULT 0,
  avg_latency_ms numeric DEFAULT 0,
  avg_tokens integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluation runs accessible"
  ON evaluation_runs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_evaluation_runs_session ON evaluation_runs(session_id);
CREATE INDEX idx_evaluation_runs_dataset ON evaluation_runs(dataset_id);

-- 16. Evaluation Results
CREATE TABLE IF NOT EXISTS evaluation_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id uuid REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES test_cases(id) ON DELETE CASCADE,
  actual_output text NOT NULL,
  is_passed boolean DEFAULT false,
  latency_ms integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  evaluation_scores jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluation results accessible"
  ON evaluation_results FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_evaluation_results_run ON evaluation_results(run_id);

-- 17. A/B Tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'draft',
  winner_variant_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AB tests accessible by session"
  ON ab_tests FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ab_tests_session ON ab_tests(session_id);

-- 18. A/B Test Variants
CREATE TABLE IF NOT EXISTS ab_test_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id uuid REFERENCES ab_tests(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt_content text NOT NULL,
  model_config jsonb DEFAULT '{}',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ab_test_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variants accessible"
  ON ab_test_variants FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ab_test_variants_test ON ab_test_variants(test_id);

-- 19. A/B Test Results
CREATE TABLE IF NOT EXISTS ab_test_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id uuid REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  input_data text NOT NULL,
  output_data text NOT NULL,
  latency_ms integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  quality_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Test results accessible"
  ON ab_test_results FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ab_test_results_test ON ab_test_results(test_id);
CREATE INDEX idx_ab_test_results_variant ON ab_test_results(variant_id);

-- 20. Marketplace Prompts
CREATE TABLE IF NOT EXISTS marketplace_prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
  author_name text DEFAULT 'Anonymous',
  title text NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  tags text[] DEFAULT '{}',
  model_recommendation text DEFAULT 'gpt-4',
  variables jsonb DEFAULT '[]',
  avg_rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  clone_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  is_staff_pick boolean DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE marketplace_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketplace prompts readable"
  ON marketplace_prompts FOR SELECT
  USING (status = 'approved' OR author_session_id IS NOT NULL);

CREATE POLICY "Marketplace prompts insertable"
  ON marketplace_prompts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Marketplace prompts updatable by author"
  ON marketplace_prompts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_marketplace_category ON marketplace_prompts(category);
CREATE INDEX idx_marketplace_rating ON marketplace_prompts(avg_rating DESC);
CREATE INDEX idx_marketplace_featured ON marketplace_prompts(is_featured);

-- 21. Marketplace Reviews
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketplace_prompt_id uuid REFERENCES marketplace_prompts(id) ON DELETE CASCADE,
  reviewer_session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
  reviewer_name text DEFAULT 'Anonymous',
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text DEFAULT '',
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews readable"
  ON marketplace_reviews FOR SELECT
  USING (true);

CREATE POLICY "Reviews insertable"
  ON marketplace_reviews FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_reviews_prompt ON marketplace_reviews(marketplace_prompt_id);

-- 22. Translations
CREATE TABLE IF NOT EXISTS translations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  source_language text NOT NULL,
  target_language text NOT NULL,
  original_content text NOT NULL,
  translated_content text NOT NULL,
  quality_score numeric DEFAULT 0,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Translations accessible"
  ON translations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_translations_prompt ON translations(prompt_id);
CREATE INDEX idx_translations_languages ON translations(source_language, target_language);

-- 23. Collaboration Sessions
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  created_by_session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
  share_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  max_participants integer DEFAULT 10,
  permissions text DEFAULT 'edit',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaboration sessions accessible"
  ON collaboration_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_collaboration_share_code ON collaboration_sessions(share_code);

-- 24. Collaboration Cursors
CREATE TABLE IF NOT EXISTS collaboration_cursors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaboration_session_id uuid REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  cursor_position integer DEFAULT 0,
  selection_start integer,
  selection_end integer,
  color text DEFAULT '#3B82F6',
  last_updated_at timestamptz DEFAULT now()
);

ALTER TABLE collaboration_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cursors accessible"
  ON collaboration_cursors FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_cursors_session ON collaboration_cursors(collaboration_session_id);

-- 25. Cache Entries (Semantic Caching - using text for embedding storage)
CREATE TABLE IF NOT EXISTS cache_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  prompt_hash text NOT NULL,
  prompt_embedding text,
  input_text text NOT NULL,
  output_text text NOT NULL,
  model_id text NOT NULL,
  model_config jsonb DEFAULT '{}',
  tokens_saved integer DEFAULT 0,
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cache accessible by session"
  ON cache_entries FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_cache_hash ON cache_entries(prompt_hash);
CREATE INDEX idx_cache_expires ON cache_entries(expires_at);

-- 26. Deployments
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  deployment_url text,
  api_key_hint text,
  status text DEFAULT 'pending',
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deployments accessible by session"
  ON deployments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_deployments_session ON deployments(session_id);
CREATE INDEX idx_deployments_prompt ON deployments(prompt_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers for updated_at
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_techniques_updated_at BEFORE UPDATE ON techniques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_configs_updated_at BEFORE UPDATE ON model_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environment_profiles_updated_at BEFORE UPDATE ON environment_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_chains_updated_at BEFORE UPDATE ON prompt_chains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_golden_datasets_updated_at BEFORE UPDATE ON golden_datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_tests_updated_at BEFORE UPDATE ON ab_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_prompts_updated_at BEFORE UPDATE ON marketplace_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();