import apiClient from './client';

export async function fetchCustomers() {
  const { data } = await apiClient.get('/customers');
  return data.data;
}

export async function createCustomer(payload) {
  const { data } = await apiClient.post('/customers', payload);
  return data.data;
}

export async function updateCustomer(id, payload) {
  const { data } = await apiClient.put(`/customers/${id}`, payload);
  return data.data;
}
