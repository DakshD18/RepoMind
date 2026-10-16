import axios from 'axios';
import type {
  AuthResponse,
  Repository,
  ChatSession,
  ChatResponse,
  IndexResponse,
  ImpactFilesResponse,
  ImpactAnalysisResponse,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request // An interceptor is code that runs 
// before every request

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry — redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const googleLogin = (credential: string): Promise<AuthResponse> =>
  api.post('/auth/google/', { credential }).then((res) => res.data);

export const githubLogin = (code: string): Promise<AuthResponse> =>
  api.post('/auth/github/', { code }).then((res) => res.data);

export const emailLogin = (email: string, password: string): Promise<AuthResponse> =>
  api.post('/auth/login/', { email, password }).then((res) => res.data);

export const emailRegister = (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<AuthResponse> =>
  api.post('/auth/register/', { email, password, first_name: firstName, last_name: lastName }).then((res) => res.data);

export const getCurrentUser = () =>
  api.get('/auth/me/').then((res) => res.data);

// Repository endpoints
export const analyseRepository = (url: string): Promise<Repository> =>
  api.post('/repositories/analyse/', { url }).then((res) => res.data);

export const getRepositories = (): Promise<Repository[]> =>
  api.get('/repositories/').then((res) => res.data);

export const getRepository = (id: number): Promise<Repository> =>
  api.get(`/repositories/${id}/`).then((res) => res.data);

// Dashboard endpoint
export const getDashboardRepository = (id: number): Promise<Repository> =>
  api.get(`/dashboard/${id}/`).then((res) => res.data);

// Delete repository
export const deleteRepository = (id: number): Promise<void> =>
  api.delete(`/repositories/${id}/`).then(() => undefined);

// ─── Phase 2: AI Indexing & Repository Intelligence ──────────────────────────

export const indexRepository = (repoId: number): Promise<IndexResponse> =>
  api.post(`/repositories/${repoId}/index/`).then((res) => res.data);

export const sendChatMessage = (
  repoId: number,
  message: string,
  sessionId?: number | null,
  debug = false,
): Promise<ChatResponse> =>
  api.post(`/repositories/${repoId}/chat/`, { message, session_id: sessionId ?? null, debug }).then((res) => res.data);

export const getChatSessions = (repoId: number): Promise<ChatSession[]> =>
  api.get(`/repositories/${repoId}/sessions/`).then((res) => res.data);

export const createChatSession = (repoId: number, title?: string): Promise<ChatSession> =>
  api.post(`/repositories/${repoId}/sessions/`, { title: title ?? 'New Chat' }).then((res) => res.data);

export const getChatSession = (repoId: number, sessionId: number): Promise<ChatSession> =>
  api.get(`/repositories/${repoId}/sessions/${sessionId}/`).then((res) => res.data);

export const deleteChatSession = (repoId: number, sessionId: number): Promise<void> =>
  api.delete(`/repositories/${repoId}/sessions/${sessionId}/`).then(() => undefined);

// ─── Phase 4: Impact Analysis ─────────────────────────────────────────────

export const getImpactFiles = (repoId: number | string): Promise<ImpactFilesResponse> =>
  api.get(`/repositories/${repoId}/impact/files/`).then((res) => res.data);

export const analyzeImpact = (
  repoId: number | string,
  filePath: string,
  forceRebuild: boolean = false
): Promise<ImpactAnalysisResponse> =>
  api
    .post(`/repositories/${repoId}/impact/`, {
      file_path: filePath,
      force_rebuild: forceRebuild,
    })
    .then((res) => res.data);

export default api;

