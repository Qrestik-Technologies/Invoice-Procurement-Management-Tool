import apiClient from './client';

export async function fetchCashFlowSummary() {
  const { data } = await apiClient.get('/cashflow/summary');
  return data.data;
}
