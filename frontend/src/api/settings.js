import apiClient from './client';

export async function fetchSettings() {
  const { data } = await apiClient.get('/settings');
  return data.data;
}

export async function updateCompanySettings(payload) {
  const { data } = await apiClient.put('/settings/company', payload);
  return data.data;
}

export async function updateEmailSettings(payload) {
  const { data } = await apiClient.put('/settings/email', payload);
  return data.data;
}

export async function updateTemplateSettings(payload) {
  const { data } = await apiClient.put('/settings/template', payload);
  return data.data;
}
