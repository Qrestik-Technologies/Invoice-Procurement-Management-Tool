import apiClient from './client';

export async function fetchDocuments() {
  const { data } = await apiClient.get('/documents');
  return data.data;
}

export async function uploadDocument(file, linkedInvoiceId = null) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post('/documents/upload', form, {
    params: { linked_invoice_id: linkedInvoiceId, parse: true },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
