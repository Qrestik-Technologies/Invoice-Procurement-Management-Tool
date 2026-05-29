const STATUS_MAP = {
  draft: 'Draft',
  reviewed: 'Pending',
  pending: 'Pending',
  dispatched: 'Dispatched',
  received: 'Received',
  overdue: 'Overdue',
};

const STATUS_TO_API = {
  Draft: 'draft',
  Pending: 'pending',
  Dispatched: 'dispatched',
  Received: 'received',
  Overdue: 'overdue',
};

export function toDisplayStatus(apiStatus) {
  return STATUS_MAP[apiStatus] || apiStatus;
}

export function toApiStatus(displayStatus) {
  return STATUS_TO_API[displayStatus] || displayStatus?.toLowerCase();
}

export function toDisplayAlert(status) {
  const map = { on_track: 'On Track', due_soon: 'Due Soon', overdue: 'Overdue' };
  return map[status] || status;
}

export function toDisplayReminderType(type) {
  const map = {
    milestone_alert: 'Milestone Alert',
    payment_reminder: 'Payment Reminder',
    overdue: 'Overdue',
  };
  return map[type] || type;
}

export function toDisplaySync(status) {
  const map = { pending: 'Pending', synced: 'Synced', failed: 'Failed' };
  return map[status] || status;
}

export function toDisplayTemplate(t) {
  return t === 'emcor' ? 'EMCOR' : 'Standard';
}

export function toApiTemplate(t) {
  return t === 'EMCOR' ? 'emcor' : 'standard';
}

export function toDisplayRole(role) {
  const map = { admin: 'Admin', entry: 'Entry', readonly: 'Readonly' };
  return map[role] || role;
}

export function canDispatch(role) {
  return role === 'admin' || role === 'entry';
}

export function canEdit(role) {
  return role === 'admin' || role === 'entry';
}

export function canAccessSettings(role) {
  return role === 'admin';
}
