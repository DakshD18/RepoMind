import axios from 'axios';
import type {
  AuthResponse,
  Repository,
  ChatSession,
  ChatResponse,
  IndexResponse,
  ImpactFilesResponse,
  ImpactAnalysisResponse,
  HealthOverviewResponse,
  HealthScanResponse,
  PaginatedFindingsResponse,
  HealthFilesResponse,
  HealthTrendsResponse,
  ProductivityOverviewResponse,
  ProductivityActivityResponse,
  PaginatedContributorsResponse,
  PaginatedHotspotsResponse,
  FileDetailResponse,
  ProductivityModulesResponse,
  ProductivityChurnResponse,
  ProductivityAIInsights,
  ProductivityRefreshResponse,
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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle token expiry — automatically refresh access token or redirect on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network / connection error (e.g. backend temporarily down) — preserve tokens
    if (!error.response) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login/') ||
      requestUrl.includes('/auth/register/') ||
      requestUrl.includes('/auth/google/') ||
      requestUrl.includes('/auth/github/') ||
      requestUrl.includes('/auth/refresh/');

    if (error.response.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      const storedRefreshToken = localStorage.getItem('refresh_token');

      if (!storedRefreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const res = await axios.post(`${baseURL}/auth/refresh/`, {
          refresh: storedRefreshToken,
        });

        const newAccessToken = res.data.access;
        localStorage.setItem('access_token', newAccessToken);
        if (res.data.refresh) {
          localStorage.setItem('refresh_token', res.data.refresh);
        }

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
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

// ─── Phase 5: Repository Health Dashboard ─────────────────────────────────

export const getRepoHealth = (repoId: number | string): Promise<HealthOverviewResponse> =>
  api.get(`/repositories/${repoId}/health/`).then((res) => res.data);

export const triggerHealthScan = (
  repoId: number | string,
  forceRescan: boolean = false,
  generateAi: boolean = true
): Promise<HealthScanResponse> =>
  api
    .post(`/repositories/${repoId}/health/scan/`, {
      force_rescan: forceRescan,
      generate_ai_summary: generateAi,
    })
    .then((res) => res.data);

export const getHealthFindings = (
  repoId: number | string,
  params?: {
    severity?: string;
    category?: string;
    file_path?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }
): Promise<PaginatedFindingsResponse> =>
  api.get(`/repositories/${repoId}/health/findings/`, { params }).then((res) => res.data);

export const getHealthFiles = (
  repoId: number | string,
  params?: {
    search?: string;
    ordering?: string;
    has_issues_only?: boolean;
  }
): Promise<HealthFilesResponse> =>
  api.get(`/repositories/${repoId}/health/files/`, { params }).then((res) => res.data);

export const getHealthTrends = (repoId: number | string): Promise<HealthTrendsResponse> =>
  api.get(`/repositories/${repoId}/health/trends/`).then((res) => res.data);

// ─── Phase 6: Productivity Intelligence ───────────────────────────────────

export const getProductivityOverview = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    aggregation?: string;
  }
): Promise<ProductivityOverviewResponse> =>
  api.get(`/repositories/${repoId}/productivity/`, { params }).then((res) => res.data);

export const getProductivityActivity = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    aggregation?: string;
  }
): Promise<ProductivityActivityResponse> =>
  api.get(`/repositories/${repoId}/productivity/activity/`, { params }).then((res) => res.data);

export const getProductivityContributors = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
  }
): Promise<PaginatedContributorsResponse> =>
  api.get(`/repositories/${repoId}/productivity/contributors/`, { params }).then((res) => res.data);

export const getProductivityHotspots = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
  }
): Promise<PaginatedHotspotsResponse> =>
  api.get(`/repositories/${repoId}/productivity/hotspots/`, { params }).then((res) => res.data);

export const getFileHotspotDetail = (
  repoId: number | string,
  filePath: string
): Promise<FileDetailResponse> =>
  api
    .get(`/repositories/${repoId}/productivity/hotspots/`, {
      params: { file_path: filePath },
    })
    .then((res) => res.data);

export const getProductivityModules = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
  }
): Promise<ProductivityModulesResponse> =>
  api.get(`/repositories/${repoId}/productivity/modules/`, { params }).then((res) => res.data);

export const getProductivityChurn = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    aggregation?: string;
  }
): Promise<ProductivityChurnResponse> =>
  api.get(`/repositories/${repoId}/productivity/churn/`, { params }).then((res) => res.data);

export const getProductivityInsights = (
  repoId: number | string,
  params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
  },
  forceRegenerate: boolean = false
): Promise<ProductivityAIInsights> =>
  forceRegenerate
    ? api
        .post(`/repositories/${repoId}/productivity/insights/`, { force_regenerate: true }, { params })
        .then((res) => res.data)
    : api.get(`/repositories/${repoId}/productivity/insights/`, { params }).then((res) => res.data);

export const refreshProductivityAnalytics = (
  repoId: number | string
): Promise<ProductivityRefreshResponse> =>
  api.post(`/repositories/${repoId}/productivity/refresh/`).then((res) => res.data);

export default api;

