import apiClient from './client';

export async function fetchReminders() {
  const { data } = await apiClient.get('/reminders');
  return data.data;
}

export async function sendReminder(invoiceId, reminderType = 'payment_reminder', recipientEmails = '') {
  const { data } = await apiClient.post(`/reminders/${invoiceId}/send`, null, {
    params: { reminder_type: reminderType, recipient_emails: recipientEmails },
  });
  return data.data;
}
