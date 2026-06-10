import client from './client';

export const parsePO       = (formData) => client.post('/purchase-orders/parse', formData);
export const createPO      = (data, filePath) => client.post(`/purchase-orders?file_path=${encodeURIComponent(filePath)}`, data);
export const listPOs       = (params) => client.get('/purchase-orders', { params });
export const getPO         = (id) => client.get(`/purchase-orders/${id}`);
export const updatePO      = (id, data) => client.put(`/purchase-orders/${id}`, data);
export const confirmPO     = (id) => client.put(`/purchase-orders/${id}`, { status: 'active' });
export const closePO       = (id) => client.post(`/purchase-orders/${id}/close`);
