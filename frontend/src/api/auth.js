import apiClient, { clearToken, setToken } from './client';

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  setToken(data.data.access_token);
  return data.data;
}

export async function register({ name, email, password }) {
  const { data } = await apiClient.post('/auth/register', { name, email, password });
  return data;
}

export async function verifyEmail(email, code) {
  const { data } = await apiClient.post('/auth/verify-email', { email, code });
  return data;
}

export async function resendCode(email) {
  const { data } = await apiClient.post('/auth/resend-code', { email });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await apiClient.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(email, code, newPassword) {
  const { data } = await apiClient.post('/auth/reset-password', {
    email,
    code,
    new_password: newPassword,
  });
  return data;
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
