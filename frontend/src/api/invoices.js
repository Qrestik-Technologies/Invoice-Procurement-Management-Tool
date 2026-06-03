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

export async function downloadInvoicePdf(id, filename) {
  const response = await apiClient.get(`/invoices/${id}/pdf`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function uploadInvoicePdf(invoiceId, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post(
    `/invoices/${invoiceId}/upload-pdf`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
        : undefined,
    }
  );
  return data.data;
}


export async function parseInvoiceFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post('/invoices/parse-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
      : undefined,
  });

  return data.data;
}


export function applyParseResult(parseResult, setFormState, fieldMap = {}) {
  const defaultMap = {
    invoice_number:  'invoiceNumber',
    invoice_date:    'invoiceDate',
    po_number:       'poNumber',
    customer_name:   'customerName',
    bill_to_address: 'billToAddress',
    ship_to_address: 'shipToAddress',
    subtotal:        'subtotal',
    tax:             'tax',
    total:           'total',
    currency:        'currency',
    line_items:      'lineItems',
    vendor_name:     'vendorName',
    bank_account_number: 'bankAccountNumber',
    bank_routing:        'bankRouting',
    bank_address:        'bankAddress',
    bank_iban:           'bankIban',
    bank_swift:          'bankSwift',
    bank_branch:         'bankBranch',
    bank_fein:           'bankFein',
    bank_email:          'bankEmail',
  };

  const map = { ...defaultMap, ...fieldMap };
  const updates = {};

  for (const [src, dst] of Object.entries(map)) {
    const val = parseResult[src];
    if (val !== null && val !== undefined && val !== '') {
      updates[dst] = val;
    }
  }

  setFormState((prev) => ({ ...prev, ...updates }));
}
