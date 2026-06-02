import apiClient from './client';

export async function fetchCompanies() {
  const { data } = await apiClient.get('/companies');
  return data.data;
}

export async function createCompany(payload) {
  const { data } = await apiClient.post('/companies', payload);
  return data.data;
}

export async function updateCompany(id, payload) {
  const { data } = await apiClient.put(`/companies/${id}`, payload);
  return data.data;
}

export async function deleteCompany(id) {
  await apiClient.delete(`/companies/${id}`);
}
