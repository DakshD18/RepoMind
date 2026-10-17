/**
 * Health Dashboard Type Definitions for RepoMind Phase 5.
 */

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingCategory =
  | 'COMPLEXITY'
  | 'MAINTAINABILITY'
  | 'DUPLICATION'
  | 'TESTING'
  | 'DOCUMENTATION'
  | 'ARCHITECTURE';

export interface HealthFinding {
  id: number;
  finding_type: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  file_path: string;
  start_line?: number | null;
  end_line?: number | null;
  symbol_name?: string;
  evidence: Record<string, any>;
  recommendation: string;
  estimated_effort: 'QUICK_FIX' | 'MODERATE' | 'SIGNIFICANT' | string;
  is_effort_estimate: boolean;
  is_ai_inferred: boolean;
  fingerprint: string;
  created_at: string;
}

export interface ComponentScores {
  complexity: number;
  maintainability: number;
  duplication: number;
  testing: number;
  documentation: number;
  dependencies: number;
}

export interface HealthMetricsSummary {
  total_files_analyzed: number;
  total_loc: number;
  total_functions: number;
  avg_cyclomatic_complexity: number;
  complex_functions_count: number;
  severe_functions_count: number;
  large_files_count: number;
  oversized_files_count: number;
  duplication_percentage: number;
  test_files_count: number;
  test_to_code_ratio: number;
  test_configs_detected: string[];
  test_coverage_status: 'REPORT_AVAILABLE' | 'UNAVAILABLE';
  test_coverage_percent?: number | null;
  has_readme: boolean;
  documented_symbols_ratio: number;
  circular_dependencies_count: number;
  syntax_errors_count: number;
  unresolved_imports_count: number;
}

export interface FileHealthMetric {
  file_path: string;
  language: string;
  line_count: number;
  function_count: number;
  max_complexity: number;
  avg_complexity: number;
  complex_functions_count: number;
  findings_count: number;
  severities: FindingSeverity[];
  ast_supported: boolean;
}

export interface AIRecommendedAction {
  step: number;
  action: string;
  reason: string;
  affected_files: string[];
  estimated_effort: string;
}

export interface RepositoryHealthSnapshot {
  id: number;
  repository_id: number;
  repository_name: string;
  commit_sha: string;
  overall_score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  component_scores: ComponentScores;
  metrics_summary: HealthMetricsSummary;
  findings_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  file_metrics: FileHealthMetric[];
  ai_summary: string;
  ai_summary_available: boolean;
  ai_recommended_actions: AIRecommendedAction[];
  created_at: string;
}

export interface HealthDeltaInfo {
  cached: boolean;
  score_diff: number;
  newly_introduced: number;
  resolved: number;
  previous_score?: number | null;
}

export interface HealthOverviewResponse {
  repository_id: number;
  repository_name: string;
  has_snapshot: boolean;
  message?: string;
  latest_snapshot?: RepositoryHealthSnapshot;
}

export interface HealthScanResponse {
  message: string;
  snapshot: RepositoryHealthSnapshot;
  delta: HealthDeltaInfo;
}

export interface PaginatedFindingsResponse {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: HealthFinding[];
}

export interface HealthFilesResponse {
  repository_id: number;
  total_files: number;
  files: FileHealthMetric[];
}

export interface HealthTrendPoint {
  id: number;
  commit_sha: string;
  overall_score: number;
  grade: string;
  component_scores: ComponentScores;
  findings_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  metrics_summary?: HealthMetricsSummary;
  created_at: string;
  delta?: {
    score_diff: number;
    total_findings_diff: number;
  } | null;
}

export interface HealthTrendsResponse {
  repository_id: number;
  total_snapshots: number;
  trends: HealthTrendPoint[];
}
