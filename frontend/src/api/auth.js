import apiClient, { clearToken, setToken } from './client';

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  setToken(data.data.access_token);
  return data.data;
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me');
  return data.data;
}

export function logout() {
  clearToken();
}

export async function fetchUsers() {
  const { data } = await apiClient.get('/users');
  return data.data;
}

export async function createUser(payload) {
  const { data } = await apiClient.post('/users', payload);
  return data.data;
}

export async function updateUser(id, payload) {
  const { data } = await apiClient.put(`/users/${id}`, payload);
  return data.data;
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`);
}
