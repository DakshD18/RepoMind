export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
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
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  error_message: string;
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
