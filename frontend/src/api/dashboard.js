import apiClient from './client';

export async function fetchDashboardStats() {
  const { data } = await apiClient.get('/dashboard/stats');
  return data.data;
}

export async function fetchUpcomingMilestones(days = 7) {
  const { data } = await apiClient.get('/dashboard/upcoming-milestones', { params: { days } });
  return data.data;
}
