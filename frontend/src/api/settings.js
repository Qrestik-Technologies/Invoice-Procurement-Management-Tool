import apiClient from './client';

export async function fetchSettings() {
  const { data } = await apiClient.get('/settings');
  return data.data;
}

export async function updateOrganizationSettings(payload) {
  const { data } = await apiClient.put('/settings/organization', payload);
  return data.data;
}

export async function updateEmailSettings(payload) {
  const { data } = await apiClient.put('/settings/email', payload);
  return data.data;
}

export async function updateInvoiceDefaults(payload) {
  const { data } = await apiClient.put('/settings/invoice-defaults', payload);
  return data.data;
}

// Legacy alias
export async function updateCompanySettings(payload) {
  return updateOrganizationSettings(payload);
}

export async function updateTemplateSettings(payload) {
  return updateInvoiceDefaults(payload);
}
