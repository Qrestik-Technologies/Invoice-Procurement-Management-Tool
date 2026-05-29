import apiClient from './client';

export async function fetchInvoices(params = {}) {
  const { data } = await apiClient.get('/invoices', { params });
  return data.data;
}

export async function fetchInvoice(id) {
  const { data } = await apiClient.get(`/invoices/${id}`);
  return data.data;
}

export async function createInvoice(payload) {
  const { data } = await apiClient.post('/invoices', payload);
  return data.data;
}

export async function updateInvoice(id, payload) {
  const { data } = await apiClient.put(`/invoices/${id}`, payload);
  return data.data;
}

export async function dispatchInvoice(id) {
  const { data } = await apiClient.post(`/invoices/${id}/dispatch`);
  return data.data;
}

export async function markInvoiceReceived(id, payload) {
  const { data } = await apiClient.put(`/invoices/${id}/mark-received`, payload);
  return data.data;
}
