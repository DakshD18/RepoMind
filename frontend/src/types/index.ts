export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Commit {
  author: string;
  email: string;
  initials: string;
  message: string;
  time: string;
  branch: string;
  hash: string;
}

export interface Repository {
  id: number;
  url: string;
  name: string;
  owner: string;
  default_branch: string;
  branches: string[];
  languages: string[];
  file_count: number;
  folder_count: number;
  last_commit_date: string | null;
  description: string;
  recent_commits: Commit[];
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  error_message: string;
  // Phase 2 — AI Knowledge Indexing
  is_indexed: boolean;
  index_status: '' | 'indexing' | 'indexed' | 'failed';
  index_error: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Phase 2: Repository Intelligence / AI Chat ───────────────────────────

export interface SourceReference {
  file_path: string;
  symbol_name: string;
  symbol_type: string;
  start_line: number;
  end_line: number;
  // Phase 3 — commit sources
  commit_sha?: string;
  author_name?: string;
  committed_date?: string;
}

export interface ChatMessage {
  id: number;
  session: number;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceReference[];
  created_at: string;
}

export interface ChatSession {
  id: number;
  repository: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  messages?: ChatMessage[];
}

export interface ChatResponse {
  session_id: number;
  title: string;
  message_id: number;
  answer: string;
  sources: SourceReference[];
  debug_chunks?: Array<{
    file_path: string;
    symbol_name: string;
    start_line: number;
    end_line: number;
    similarity: number;
  }>;
}

export interface IndexResponse {
  message: string;
  index_status: string;
}

// ─── Phase 4: Impact Analysis ─────────────────────────────────────────────

export interface DirectDependent {
  file_path: string;
  relationship_type: string;
  imported_symbols: string[];
  line_number: number;
}

export interface TransitiveDependent {
  file_path: string;
  depth: number;
  via: string;
  dependency_path: string[];
}

export interface DependencyTreeNode {
  file_path: string;
  depth: number;
  relationship_type?: string;
  imported_symbols?: string[];
  line_number?: number;
  children: DependencyTreeNode[];
}

export interface RiskFactors {
  direct_dependent_count: number;
  transitive_dependent_count: number;
  total_affected_files: number;
  max_dependency_depth: number;
  blast_radius_ratio: number;
  in_degree_centrality: number;
  cycles_detected_count: number;
}

export interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  reasons: string[];
  factors: RiskFactors;
  is_estimate: boolean;
  disclaimer: string;
}

export interface AIAdvisory {
  available: boolean;
  disclaimer: string;
  insight: string | null;
}

export interface ImpactAnalysisResponse {
  target_file: string;
  repository_id: number;
  revision: string;
  target_metadata: {
    language: string;
    line_count: number;
    defined_symbols: string[];
  };
  summary: {
    total_affected_files: number;
    direct_dependent_count: number;
    transitive_dependent_count: number;
    max_depth: number;
    total_repository_files: number;
  };
  risk_assessment: RiskAssessment;
  ai_advisory: AIAdvisory;
  direct_dependents: DirectDependent[];
  transitive_dependents: TransitiveDependent[];
  dependency_paths: string[][];
  cycles_detected: string[][];
  dependency_tree: DependencyTreeNode;
  limitations: string[];
}

export interface ImpactFilesResponse {
  repository_id: number;
  revision: string;
  total_files: number;
  files: string[];
  suggested_files: string[];
}

