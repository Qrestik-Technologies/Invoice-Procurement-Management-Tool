import apiClient from './client';

export async function fetchMilestones() {
  const { data } = await apiClient.get('/milestones');
  return data.data;
}

export async function createMilestone(payload) {
  const { data } = await apiClient.post('/milestones', payload);
  return data.data;
}

export async function updateMilestone(id, payload) {
  const { data } = await apiClient.put(`/milestones/${id}`, payload);
  return data.data;
}

export async function deleteMilestone(id) {
  await apiClient.delete(`/milestones/${id}`);
}
