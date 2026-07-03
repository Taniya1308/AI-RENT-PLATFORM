const BASE_URL = process.env.REACT_APP_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({ error: 'Invalid server response' }));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  put: (endpoint, body) => request(endpoint, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  patch: (endpoint, body) => request(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined
  }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' })
};

export default api;
