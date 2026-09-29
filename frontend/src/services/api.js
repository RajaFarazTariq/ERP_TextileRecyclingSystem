import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Access tokens are short-lived. On a 401, renew once with the refresh token
// (shared between concurrent requests) and retry; if that fails, log out.
let refreshing = null;

function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return Promise.reject(new Error('No refresh token'));
  // Plain axios: this request must not go through the interceptors below
  return axios.post(`${baseURL}users/token/refresh/`, { refresh }).then(({ data }) => {
    localStorage.setItem('access_token', data.access);
    if (data.refresh) localStorage.setItem('refresh_token', data.refresh);   // rotated
    return data.access;
  });
}

function forceLogout() {
  const darkMode = localStorage.getItem('darkMode');
  localStorage.clear();
  if (darkMode) localStorage.setItem('darkMode', darkMode);
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith('users/login') || original?.url?.startsWith('users/logout');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshing = refreshing || refreshAccessToken().finally(() => { refreshing = null; });
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        forceLogout();
      }
    } else if (error.response?.status === 401 && !isAuthCall) {
      forceLogout();
    }
    return Promise.reject(error);
  }
);

export default api;
