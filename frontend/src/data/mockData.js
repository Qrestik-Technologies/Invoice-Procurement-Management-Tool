export const INVOICE_STATUSES = ['Draft', 'Pending', 'Dispatched', 'Received', 'Overdue'];

export const STATUS_COLORS = {
  Draft: { bg: 'bg-gray-100', text: 'text-status-draft', dot: 'bg-status-draft' },
  Pending: { bg: 'bg-amber-50', text: 'text-status-pending', dot: 'bg-status-pending' },
  Dispatched: { bg: 'bg-blue-50', text: 'text-status-dispatched', dot: 'bg-status-dispatched' },
  Received: { bg: 'bg-green-50', text: 'text-status-received', dot: 'bg-status-received' },
  Overdue: { bg: 'bg-red-50', text: 'text-status-overdue', dot: 'bg-status-overdue' },
};

export const customers = [
  {
    id: 'c1',
    name: 'Meridian Construction Group',
    email: 'accounts@meridianconstruction.com',
    phone: '(512) 555-0142',
    templateType: 'Standard',
    totalInvoiced: 284500,
  },
  {
    id: 'c2',
    name: 'EMCOR Facilities Services',
    email: 'ap@emcorfacilities.com',
    phone: '(713) 555-0198',
    templateType: 'EMCOR',
    shipTo: 'EMCOR Facilities — Building 4, 2200 Commerce St, Houston TX 77002',
    totalInvoiced: 412750,
  },
  {
    id: 'c3',
    name: 'Summit Healthcare Partners',
    email: 'finance@summithealthcare.org',
    phone: '(214) 555-0167',
    templateType: 'Standard',
    totalInvoiced: 156200,
  },
  {
    id: 'c4',
    name: 'Pacific Rail Logistics',
    email: 'billing@pacificrail.com',
    phone: '(503) 555-0133',
    templateType: 'Standard',
    totalInvoiced: 89300,
  },
  {
    id: 'c5',
    name: 'Greenfield Energy Corp',
    email: 'invoices@greenfieldenergy.com',
    phone: '(405) 555-0189',
    templateType: 'EMCOR',
    shipTo: 'Greenfield Energy — Site Office, 8800 Pipeline Rd, Tulsa OK 74103',
    totalInvoiced: 327400,
  },
];

export const milestones = [
  {
    id: 'm1',
    projectName: 'Meridian HQ Renovation — Phase 2',
    customerId: 'c1',
    startDate: '2026-01-15',
    endDate: '2026-03-30',
    linkedInvoiceId: 'inv-001',
    alertStatus: 'On Track',
    notes: 'Electrical rough-in milestone due end of March.',
  },
  {
    id: 'm2',
    projectName: 'EMCOR Dallas Data Center',
    customerId: 'c2',
    startDate: '2026-02-01',
    endDate: '2026-06-15',
    linkedInvoiceId: 'inv-003',
    alertStatus: 'Due Soon',
    notes: 'Cooling system install checkpoint.',
  },
  {
    id: 'm3',
    projectName: 'Summit Clinic Expansion',
    customerId: 'c3',
    startDate: '2025-11-01',
    endDate: '2026-04-10',
    linkedInvoiceId: 'inv-005',
    alertStatus: 'Overdue',
    notes: 'Final inspection milestone pending sign-off.',
  },
  {
    id: 'm4',
    projectName: 'Pacific Rail Yard Upgrade',
    customerId: 'c4',
    startDate: '2026-03-01',
    endDate: '2026-05-29',
    linkedInvoiceId: null,
    alertStatus: 'On Track',
    notes: 'Track signaling upgrade — no invoice linked yet.',
  },
  {
    id: 'm5',
    projectName: 'Greenfield Solar Array — Block A',
    customerId: 'c5',
    startDate: '2026-04-01',
    endDate: '2026-06-01',
    linkedInvoiceId: 'inv-008',
    alertStatus: 'Due Soon',
    notes: 'Panel installation completion milestone.',
  },
];

export const invoices = [
  { id: 'inv-001', number: 'INV-2026-0041', customerId: 'c1', date: '2026-03-15', dueDate: '2026-04-15', amount: 42500, status: 'Pending', milestoneId: 'm1' },
  { id: 'inv-002', number: 'INV-2026-0038', customerId: 'c2', date: '2026-03-10', dueDate: '2026-04-10', amount: 67800, status: 'Dispatched', milestoneId: 'm2' },
  { id: 'inv-003', number: 'INV-2026-0035', customerId: 'c2', date: '2026-02-28', dueDate: '2026-03-30', amount: 89200, status: 'Received', milestoneId: 'm2' },
  { id: 'inv-004', number: 'INV-2026-0031', customerId: 'c3', date: '2026-02-20', dueDate: '2026-03-22', amount: 31400, status: 'Overdue', milestoneId: 'm3' },
  { id: 'inv-005', number: 'INV-2026-0028', customerId: 'c3', date: '2026-02-01', dueDate: '2026-03-03', amount: 28750, status: 'Received', milestoneId: 'm3' },
  { id: 'inv-006', number: 'INV-2026-0024', customerId: 'c4', date: '2026-01-25', dueDate: '2026-02-25', amount: 15600, status: 'Draft', milestoneId: null },
  { id: 'inv-007', number: 'INV-2026-0019', customerId: 'c5', date: '2026-01-18', dueDate: '2026-02-18', amount: 112300, status: 'Overdue', milestoneId: null },
  { id: 'inv-008', number: 'INV-2026-0015', customerId: 'c5', date: '2026-01-10', dueDate: '2026-02-10', amount: 95400, status: 'Received', milestoneId: 'm5' },
  { id: 'inv-009', number: 'INV-2026-0012', customerId: 'c1', date: '2026-01-05', dueDate: '2026-02-05', amount: 38200, status: 'Received', milestoneId: 'm1' },
  { id: 'inv-010', number: 'INV-2026-0008', customerId: 'c4', date: '2025-12-20', dueDate: '2026-01-20', amount: 22100, status: 'Pending', milestoneId: 'm4' },
  { id: 'inv-011', number: 'INV-2026-0005', customerId: 'c2', date: '2025-12-15', dueDate: '2026-01-15', amount: 54300, status: 'Received', milestoneId: null },
  { id: 'inv-012', number: 'INV-2026-0002', customerId: 'c1', date: '2025-12-01', dueDate: '2026-01-01', amount: 19800, status: 'Dispatched', milestoneId: 'm1' },
];

export const reminders = [
  { id: 'r1', invoiceId: 'inv-004', sentAt: '2026-03-25T09:15:00', type: 'Overdue', status: 'Delivered' },
  { id: 'r2', invoiceId: 'inv-007', sentAt: '2026-03-22T14:30:00', type: 'Overdue', status: 'Delivered' },
  { id: 'r3', invoiceId: 'inv-001', sentAt: '2026-03-20T10:00:00', type: 'Payment Reminder', status: 'Delivered' },
  { id: 'r4', invoiceId: 'inv-002', sentAt: '2026-03-18T11:45:00', type: 'Payment Reminder', status: 'Delivered' },
  { id: 'r5', invoiceId: 'inv-003', sentAt: '2026-03-15T08:30:00', type: 'Milestone Alert', status: 'Delivered' },
  { id: 'r6', invoiceId: 'inv-010', sentAt: '2026-03-12T16:20:00', type: 'Payment Reminder', status: 'Failed' },
  { id: 'r7', invoiceId: 'inv-005', sentAt: '2026-02-28T09:00:00', type: 'Milestone Alert', status: 'Delivered' },
];

export const pendingApprovals = [
  { id: 'pa1', invoiceId: 'inv-006', submittedBy: 'Sarah Chen', submittedAt: '2026-03-28T11:00:00', note: 'Draft ready for internal review before customer dispatch.' },
  { id: 'pa2', invoiceId: 'inv-012', submittedBy: 'James Ortiz', submittedAt: '2026-03-27T15:30:00', note: 'Updated line items per change order CO-14.' },
];

export const documents = [
  { id: 'd1', filename: 'INV-2026-0041_Meridian.pdf', invoiceId: 'inv-001', uploadedBy: 'Sarah Chen', uploadedAt: '2026-03-15T10:22:00', oneDriveStatus: 'Synced' },
  { id: 'd2', filename: 'INV-2026-0038_EMCOR.pdf', invoiceId: 'inv-002', uploadedBy: 'James Ortiz', uploadedAt: '2026-03-10T14:05:00', oneDriveStatus: 'Synced' },
  { id: 'd3', filename: 'ChangeOrder_CO-14.docx', invoiceId: 'inv-012', uploadedBy: 'James Ortiz', uploadedAt: '2026-03-27T15:28:00', oneDriveStatus: 'Pending' },
  { id: 'd4', filename: 'Summit_Invoice_Support.pdf', invoiceId: 'inv-004', uploadedBy: 'Sarah Chen', uploadedAt: '2026-02-20T09:15:00', oneDriveStatus: 'Synced' },
  { id: 'd5', filename: 'Greenfield_PO_Reference.pdf', invoiceId: 'inv-008', uploadedBy: 'Mike Torres', uploadedAt: '2026-01-10T11:40:00', oneDriveStatus: 'Failed' },
];

export const cashFlowData = [
  { month: 'Oct 2025', expected: 98000, received: 92000 },
  { month: 'Nov 2025', expected: 112000, received: 105500 },
  { month: 'Dec 2025', expected: 134000, received: 128200 },
  { month: 'Jan 2026', expected: 156000, received: 142800 },
  { month: 'Feb 2026', expected: 178000, received: 165400 },
  { month: 'Mar 2026', expected: 195000, received: 148600 },
];

export const cashFlowInvoices = [
  { invoiceId: 'inv-001', expectedDate: '2026-04-15', amount: 42500, status: 'Pending' },
  { invoiceId: 'inv-002', expectedDate: '2026-04-10', amount: 67800, status: 'Dispatched' },
  { invoiceId: 'inv-004', expectedDate: '2026-03-22', amount: 31400, status: 'Overdue' },
  { invoiceId: 'inv-007', expectedDate: '2026-02-18', amount: 112300, status: 'Overdue' },
  { invoiceId: 'inv-010', expectedDate: '2026-01-20', amount: 22100, status: 'Pending' },
  { invoiceId: 'inv-003', expectedDate: '2026-03-30', amount: 89200, status: 'Received' },
  { invoiceId: 'inv-008', expectedDate: '2026-02-10', amount: 95400, status: 'Received' },
];

export const users = [
  { id: 'u1', name: 'Alex Rivera', email: 'alex.rivera@qrestik.com', role: 'Admin', active: true },
  { id: 'u2', name: 'Sarah Chen', email: 'sarah.chen@qrestik.com', role: 'Entry', active: true },
  { id: 'u3', name: 'James Ortiz', email: 'james.ortiz@qrestik.com', role: 'Entry', active: true },
  { id: 'u4', name: 'Mike Torres', email: 'mike.torres@qrestik.com', role: 'Readonly', active: true },
  { id: 'u5', name: 'Subra Krishnan', email: 'subra.krishnan@qrestik.com', role: 'Readonly', active: false },
];

export const currentUser = {
  name: 'Alex Rivera',
  email: 'alex.rivera@qrestik.com',
  role: 'Admin',
  avatar: null,
};

export function getCustomerById(id) {
  return customers.find((c) => c.id === id);
}

export function getInvoiceById(id) {
  return invoices.find((i) => i.id === id);
}

export function getMilestoneById(id) {
  return milestones.find((m) => m.id === id);
}

export function getDashboardStats() {
  const pendingAmount = invoices
    .filter((i) => i.status === 'Pending' || i.status === 'Dispatched')
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;
  const receivedThisMonth = invoices
    .filter((i) => i.status === 'Received' && i.date.startsWith('2026-03'))
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    totalInvoices: invoices.length,
    pendingAmount,
    overdueCount,
    receivedThisMonth,
  };
}

export function getStatusBreakdown() {
  const counts = INVOICE_STATUSES.reduce((acc, status) => {
    acc[status] = invoices.filter((i) => i.status === status).length;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function getUpcomingMilestones(days = 7) {
  const now = new Date('2026-03-29');
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  return milestones
    .filter((m) => {
      const end = new Date(m.endDate);
      return end >= now && end <= cutoff;
    })
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
}
