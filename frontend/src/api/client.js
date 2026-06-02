import axios from 'axios';

const TOKEN_KEY = 'qrestik_token';
const COMPANY_KEY = 'qrestik_organization_id';

let activeCompanyId = localStorage.getItem(COMPANY_KEY)
  ? Number(localStorage.getItem(COMPANY_KEY))
  : null;

export function setActiveCompanyId(id) {
  if (id == null || id === '') {
    activeCompanyId = null;
    localStorage.removeItem(COMPANY_KEY);
  } else {
    activeCompanyId = Number(id);
    localStorage.setItem(COMPANY_KEY, String(activeCompanyId));
  }
}

export function getActiveCompanyId() {
  return activeCompanyId;
}

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Re-attach token on page reload
const saved = getToken();
if (saved) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${saved}`;
}

apiClient.interceptors.request.use((config) => {
  if (activeCompanyId) {
    config.headers['X-Company-Id'] = String(activeCompanyId);
  }
  return config;
});

// Global 401 handler — clear token so ProtectedRoute redirects to login
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      setActiveCompanyId(null);
      // Already on a public auth page? Don't hard-redirect — that reloads the
      // page and swallows the inline error toast (e.g. wrong password on login).
      const authPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
      const onAuthPage = authPaths.some((p) => window.location.pathname.startsWith(p));
      if (!onAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;