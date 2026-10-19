/**
 * Productivity Intelligence Type Definitions for RepoMind Phase 6.
 */

export interface PreviousPeriodComparison {
  has_previous_data: boolean;
  previous_commits: number;
  previous_contributors: number;
  previous_additions: number;
  previous_deletions: number;
  commits_delta_pct: number | null;
  contributors_delta_pct: number | null;
  additions_delta_pct: number | null;
  deletions_delta_pct: number | null;
}

export interface ProductivityOverviewMetrics {
  total_commits: number;
  active_contributors: number;
  files_modified: number;
  lines_added: number;
  lines_deleted: number;
  net_line_change: number;
  total_churn_volume: number;
  stats_available: boolean;
  active_days_count: number;
  avg_commits_per_active_day: number;
  previous_period: PreviousPeriodComparison;
}

export interface KnowledgeDistribution {
  total_active_contributors: number;
  single_contributor_modules_count: number;
  shared_modules_count: number;
  top_contributor_commit_share_pct: number;
  methodology_note: string;
}

export interface DataAvailability {
  total_stored_commits: number;
  earliest_commit_date: string | null;
  latest_commit_date: string | null;
  is_partial_history: boolean;
  limitations_note: string;
}

export interface ProductivityOverviewResponse {
  repository_id: number;
  repository_name: string;
  repository_owner: string;
  time_range: string;
  start_date: string | null;
  end_date: string | null;
  aggregation: string;
  timestamp_basis: string;
  overview: ProductivityOverviewMetrics;
  knowledge_distribution: KnowledgeDistribution;
  data_availability: DataAvailability;
}

export interface ActivityTimelinePoint {
  bucket: string;
  commits: number;
  active_contributors: number;
  files_modified: number;
  additions: number;
  deletions: number;
  net_change: number;
  total_churn: number;
}

export interface ProductivityActivityResponse {
  repository_id: number;
  time_range: string;
  aggregation: string;
  timestamp_basis: string;
  overview: ProductivityOverviewMetrics;
  timeline: ActivityTimelinePoint[];
}

export interface ContributorInsight {
  contributor_key: string;
  display_name: string;
  email: string;
  commit_count: number;
  files_modified_count: number;
  lines_added: number;
  lines_deleted: number;
  net_change: number;
  total_churn: number;
  first_commit: string | null;
  last_commit: string | null;
  top_files: Array<{ file_path: string; touches: number }>;
  top_modules: Array<{ module_path: string; touches: number }>;
}

export interface PaginatedContributorsResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  time_range: string;
  knowledge_distribution: KnowledgeDistribution;
  results: ContributorInsight[];
}

export interface FileHotspot {
  file_path: string;
  module: string;
  commit_count: number;
  contributor_count: number;
  contributors: string[];
  lines_added: number;
  lines_deleted: number;
  net_change: number;
  total_churn: number;
  first_modified: string | null;
  last_modified: string | null;
  activity_label: string;
}

export interface PaginatedHotspotsResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  time_range: string;
  results: FileHotspot[];
}

export interface SingleFileCommit {
  commit_sha: string;
  author_name: string;
  committed_date: string;
  message: string;
  status: string;
  additions: number;
  deletions: number;
  churn: number;
}

export interface FileDetailResponse {
  file_path: string;
  repository_id: number;
  commit_touches_count: number;
  contributors_count: number;
  contributors: string[];
  total_additions: number;
  total_deletions: number;
  net_line_change: number;
  total_churn: number;
  impact_analysis_url: string;
  commits: SingleFileCommit[];
}

export interface ModuleMetric {
  module_path: string;
  commit_count: number;
  file_count: number;
  contributor_count: number;
  contributors: string[];
  lines_added: number;
  lines_deleted: number;
  net_change: number;
  total_churn: number;
  single_contributor_period: boolean;
  cautious_note?: string | null;
  top_files: Array<{ file_path: string; commits: number; churn: number }>;
}

export interface ProductivityModulesResponse {
  repository_id: number;
  time_range: string;
  modules_count: number;
  modules: ModuleMetric[];
}

export interface CodeChurnSummary {
  total_additions: number;
  total_deletions: number;
  net_line_change: number;
  total_churn_volume: number;
  stats_available: boolean;
  top_churn_files: FileHotspot[];
  top_churn_modules: ModuleMetric[];
}

export interface ProductivityChurnResponse {
  repository_id: number;
  time_range: string;
  aggregation: string;
  churn: CodeChurnSummary;
  churn_timeline: Array<{
    bucket: string;
    additions: number;
    deletions: number;
    net_change: number;
    total_churn: number;
  }>;
}

export interface ProductivityAIInsights {
  ai_generated: boolean;
  model: string;
  overall_pattern: string;
  timeline_trends: string;
  hotspots_and_modules: string;
  code_churn_dynamics: string;
  collaboration_and_distribution: string;
  areas_for_review: Array<{
    title: string;
    reason: string;
    affected_path: string;
  }>;
  data_limitations: string;
}

export interface ProductivityRefreshResponse {
  message: string;
  repository_id: number;
  new_commits_ingested: number;
  total_commits_in_memory: number;
}
