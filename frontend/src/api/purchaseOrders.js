import client from './client';

export const parsePO          = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return client.post('/purchase-orders/parse', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data.data);
};

export const createPO         = ({ data, filePath }) =>
  client.post(`/purchase-orders?file_path=${encodeURIComponent(filePath)}`, data).then((r) => r.data.data);

export const listPOs          = (params) =>
  client.get('/purchase-orders', { params }).then((r) => r.data.data);

export const getPO            = (id) =>
  client.get(`/purchase-orders/${id}`).then((r) => r.data.data);

export const updatePO         = (id, data) =>
  client.put(`/purchase-orders/${id}`, data).then((r) => r.data.data);

export const confirmPO        = (id) =>
  client.put(`/purchase-orders/${id}`, { status: 'active' }).then((r) => r.data.data);

export const closePO          = (id) =>
  client.post(`/purchase-orders/${id}/close`).then((r) => r.data.data);

export const raiseInvoice     = (id) =>
  client.post(`/purchase-orders/${id}/create-invoice`).then((r) => r.data.data);

export const getInvoicesForPO = (id) =>
  client.get(`/purchase-orders/${id}/invoices`).then((r) => r.data.data);

