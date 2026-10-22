/**
 * Architecture Intelligence Types for RepoMind.
 */

export interface ArchitectureOverview {
  repo_id: number;
  repo_name: string;
  default_branch: string;
  revision: string;
  total_files: number;
  total_directories: number;
  total_dependencies: number;
  languages: Record<string, number>;
  component_types: Record<string, number>;
  circular_cycles_count: number;
  circular_files_count: number;
  unresolved_imports_count: number;
  syntax_errors_count: number;
}

export interface ArchitectureTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file';
  component_type?: string;
  language?: string;
  line_count?: number;
  file_count?: number;
  children?: ArchitectureTreeNode[];
  direct_dependencies_count?: number;
  direct_dependents_count?: number;
  is_circular?: boolean;
  has_unresolved?: boolean;
}

export interface ArchitectureTreeResponse {
  repo_id: number;
  total_files: number;
  tree: ArchitectureTreeNode[];
}

export interface ArchitectureGraphNode {
  id: string;
  name: string;
  path: string;
  type: 'file';
  component_type: string;
  direction?: 'focus' | 'incoming' | 'outgoing' | 'other';
  language: string;
  line_count: number;
  in_degree: number;
  out_degree: number;
  total_degree: number;
  module: string;
  is_circular: boolean;
  has_unresolved: boolean;
}

export interface ArchitectureGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  imported_symbols: string[];
  line_number: number;
  is_circular: boolean;
}

export interface ArchitectureGraphResponse {
  repo_id: number;
  revision: string;
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
  total_nodes_in_repo: number;
  nodes_returned: number;
  total_matching_nodes: number;
  total_edges_in_graph: number;
  edges_returned: number;
  is_truncated: boolean;
}

export interface ArchitectureModuleNode {
  id: string;
  name: string;
  path: string;
  role: string;
  file_count: number;
  files: string[];
  languages: Record<string, number>;
  in_degree: number;
  out_degree: number;
  total_degree: number;
  is_circular: boolean;
  issues_count: number;
}

export interface ArchitectureModuleEdge {
  id: string;
  source: string;
  target: string;
  dependency_count: number;
  relationship_types: string[];
  sample_connections: Array<{
    source_file: string;
    target_file: string;
    relationship_type: string;
    imported_symbols: string[];
    line_number: number;
  }>;
  is_circular: boolean;
}

export interface ArchitectureModuleGraphResponse {
  repo_id: number;
  revision: string;
  modules: ArchitectureModuleNode[];
  edges: ArchitectureModuleEdge[];
  total_modules: number;
  total_cross_module_edges: number;
  total_files: number;
}

export interface DependencyItem {
  file_path: string;
  relationship_type: string;
  imported_symbols: string[];
  line_number: number;
  language: string;
  is_circular: boolean;
}

export interface DefinedSymbol {
  name: string;
  type: string;
  class_name: string;
  start_line: number | null;
  end_line: number | null;
}

export interface ArchitectureNodeDetail {
  file_path: string;
  name: string;
  module: string;
  language: string;
  component_type: string;
  line_count: number;
  github_url: string;
  incoming_dependencies: DependencyItem[];
  incoming_count: number;
  outgoing_dependencies: DependencyItem[];
  outgoing_count: number;
  defined_symbols: DefinedSymbol[];
  is_circular: boolean;
  cycles: string[][];
  unresolved_imports: Array<{
    file: string;
    module: string;
    line: number;
  }>;
  syntax_errors: Array<{
    file_path: string;
    error: string;
  }>;
}

export interface CircularFinding {
  id: string;
  type: 'circular_dependency';
  severity: 'HIGH';
  title: string;
  cycle: string[];
  length: number;
  description: string;
  affected_files: string[];
  recommendation: string;
}

export interface UnresolvedFinding {
  id: string;
  type: 'unresolved_import';
  severity: 'MEDIUM';
  title: string;
  file_path: string;
  module: string;
  line_number: number;
  description: string;
  recommendation: string;
}

export interface HighlyConnectedFinding {
  id: string;
  type: 'highly_connected';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  file_path: string;
  in_degree: number;
  out_degree: number;
  total_degree: number;
  description: string;
  recommendation: string;
}

export interface ArchitectureFindingsResponse {
  repo_id: number;
  revision: string;
  total_findings: number;
  circular_dependencies: CircularFinding[];
  circular_count: number;
  circular_files_count: number;
  unresolved_imports: UnresolvedFinding[];
  unresolved_count: number;
  highly_connected_files: HighlyConnectedFinding[];
  highly_connected_count: number;
  syntax_errors: any[];
}
