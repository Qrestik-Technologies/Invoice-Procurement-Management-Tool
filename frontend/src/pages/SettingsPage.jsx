import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Mail, Users, FileText, Plug, UserCircle, Plus, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  fetchUsers, createUser, updateUser, deleteUser,
} from '../api/auth';
import {
  fetchCompanies, createCompany, updateCompany, deleteCompany,
} from '../api/companies';
import {
  fetchSettings,
  updateOrganizationSettings,
  updateEmailSettings,
  updateInvoiceDefaults,
} from '../api/settings';
import PageHeader from '../components/ui/PageHeader';
import Tabs, { TabPanel } from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Input, Select, Textarea, Checkbox } from '../components/ui/FormFields';
import { RoleBadge } from '../components/ui/Badge';

const ROLES = [
  { value: 'admin', label: 'Admin — full access' },
  { value: 'entry', label: 'Entry — create & edit data' },
  { value: 'readonly', label: 'Readonly — view only' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR'];

const EMPTY_COMPANY = {
  name: '', legal_name: '', email: '', phone: '', address: '',
  tax_id: '', website: '', default_currency: 'USD', is_active: true, notes: '',
};

const EMPTY_USER = {
  name: '', email: '', password: '', role: 'entry', is_active: true, company_id: '',
};

function SettingsCard({ title, description, children, footer }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      {(title || description) && (
        <div className="border-b border-border px-6 py-4">
          {title && <h2 className="text-base font-semibold text-[#111827]">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-[#6B7280]">{description}</p>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>}
    </div>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500'}`} />
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const isAdmin = user?.role === 'admin';
  const meta = usePageMeta('Settings', isAdmin ? 'Manage organizations, users, and platform configuration' : 'Your account');

  const adminTabs = useMemo(() => [
    { id: 'organization', label: 'Issuer profile', icon: Building2 },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'invoice', label: 'Invoice Defaults', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'account', label: 'My Account', icon: UserCircle },
  ], []);

  const userTabs = useMemo(() => [
    { id: 'account', label: 'My Account', icon: UserCircle },
  ], []);

  const tabs = isAdmin ? adminTabs : userTabs;
  const [activeTab, setActiveTab] = useState('account');

  const [settingsBundle, setSettingsBundle] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [orgForm, setOrgForm] = useState({});
  const [emailForm, setEmailForm] = useState({});
  const [invoiceForm, setInvoiceForm] = useState({});

  const [companyModal, setCompanyModal] = useState(null);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);

  const [userModal, setUserModal] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [editUserId, setEditUserId] = useState(null);

  const setOrg = (k) => (e) => setOrgForm((f) => ({ ...f, [k]: e.target.value }));
  const setEmail = (k) => (e) => setEmailForm((f) => ({ ...f, [k]: e.target.value }));
  const setInv = (k) => (e) => setInvoiceForm((f) => ({ ...f, [k]: e.target.value }));
  const setCo = (k) => (e) => setCompanyForm((f) => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));
  const setUsr = (k) => (e) => setUserForm((f) => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [bundle, coList, userList] = await Promise.all([
        fetchSettings(),
        fetchCompanies(),
        fetchUsers(),
      ]);
      setSettingsBundle(bundle);
      const s = bundle.settings;
      setOrgForm({
        organization_name: s.organization_name || '',
        organization_email: s.organization_email || '',
        business_address: s.business_address || '',
        phone: s.phone || '',
        website: s.website || '',
        tax_id: s.tax_id || '',
      });
      setEmailForm({
        from_email: s.from_email || '',
        reply_to_email: s.reply_to_email || '',
        milestone_alert_emails: s.milestone_alert_emails || '',
      });
      setInvoiceForm({
        default_currency: s.default_currency || 'USD',
        default_payment_terms_days: String(s.default_payment_terms_days ?? 30),
        invoice_number_prefix: s.invoice_number_prefix || '',
        reminder_interval_days: String(s.reminder_interval_days ?? 7),
        onedrive_folder: s.onedrive_folder || '',
      });
      setCompanies(coList || []);
      setUsers(userList || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      setActiveTab('organization');
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  const saveOrganization = async (e) => {
    e.preventDefault();
    try {
      const data = await updateOrganizationSettings(orgForm);
      setSettingsBundle((b) => b && { ...b, settings: data });
      toast.success('Organization profile saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    try {
      const data = await updateEmailSettings(emailForm);
      setSettingsBundle((b) => b && { ...b, settings: data });
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    }
  };

  const saveInvoiceDefaults = async (e) => {
    e.preventDefault();
    try {
      const data = await updateInvoiceDefaults({
        ...invoiceForm,
        default_payment_terms_days: Number(invoiceForm.default_payment_terms_days),
        reminder_interval_days: Number(invoiceForm.reminder_interval_days),
      });
      setSettingsBundle((b) => b && { ...b, settings: data });
      toast.success('Invoice defaults saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    }
  };

  const openCompanyModal = (company = null) => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        legal_name: company.legal_name || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        tax_id: company.tax_id || '',
        website: company.website || '',
        default_currency: company.default_currency || 'USD',
        is_active: company.is_active !== false,
        notes: company.notes || '',
      });
      setCompanyModal({ mode: 'edit', id: company.id });
    } else {
      setCompanyForm(EMPTY_COMPANY);
      setCompanyModal({ mode: 'create' });
    }
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    const payload = {
      ...companyForm,
      email: companyForm.email || null,
    };
    try {
      if (companyModal.mode === 'edit') {
        await updateCompany(companyModal.id, payload);
        toast.success('Company updated');
      } else {
        await createCompany(payload);
        toast.success('Company created');
      }
      setCompanyModal(null);
      await loadAdminData();
      await refreshOrganizations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save organization');
    }
  };

  const removeCompany = async (id, name) => {
    if (!window.confirm(`Delete company "${name}"? Users linked to it will be unassigned.`)) return;
    try {
      await deleteCompany(id);
      toast.success('Organization deleted');
      await loadAdminData();
      await refreshOrganizations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const openUserModal = (u = null) => {
    if (u) {
      setEditUserId(u.id);
      setUserForm({
        name: u.name,
        email: u.email,
        password: '',
        role: u.role,
        is_active: u.is_active,
        company_id: u.company_id != null ? String(u.company_id) : '',
      });
      setUserModal('edit');
    } else {
      setEditUserId(null);
      setUserForm(EMPTY_USER);
      setUserModal('create');
    }
  };

  const saveUser = async (e) => {
    e.preventDefault();
    const payload = {
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
      is_active: userForm.is_active,
      company_id: userForm.company_id ? Number(userForm.company_id) : null,
    };
    try {
      if (userModal === 'edit') {
        const update = { ...payload };
        if (userForm.password) update.password = userForm.password;
        await updateUser(editUserId, update);
        toast.success('User updated');
      } else {
        await createUser({ ...payload, password: userForm.password });
        toast.success('User created');
      }
      setUserModal(null);
      loadAdminData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save user');
    }
  };

  const removeUser = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await deleteUser(id);
      toast.success('User deleted');
      loadAdminData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const companyName = (id) => companies.find((c) => c.id === id)?.name;
  const integrations = settingsBundle?.integrations;

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        showOrganization={!isAdmin}
      />

      <Tabs
        tabs={tabs.map(({ id, label }) => ({ id, label }))}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {loading && isAdmin && activeTab !== 'account' && (
        <p className="pt-4 text-sm text-[#9CA3AF]">Loading…</p>
      )}

      <TabPanel>
        {activeTab === 'organization' && isAdmin && (
          <form onSubmit={saveOrganization}>
            <SettingsCard
              title="Organization profile"
              description="Default issuer details shown on invoices and outbound communications."
              footer={<Button type="submit">Save changes</Button>}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Organization name" value={orgForm.organization_name} onChange={setOrg('organization_name')} required />
                <Input label="Organization email" type="email" value={orgForm.organization_email} onChange={setOrg('organization_email')} />
                <Input label="Phone" value={orgForm.phone} onChange={setOrg('phone')} />
                <Input label="Website" value={orgForm.website} onChange={setOrg('website')} />
                <Input label="Tax ID / registration" value={orgForm.tax_id} onChange={setOrg('tax_id')} className="sm:col-span-2" />
                <Textarea label="Business address" value={orgForm.business_address} onChange={setOrg('business_address')} rows={3} className="sm:col-span-2" />
              </div>
            </SettingsCard>
          </form>
        )}

        {activeTab === 'organizations' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openCompanyModal()}>
                <Plus className="h-4 w-4" /> Add organization
              </Button>
            </div>
            <SettingsCard
              title="Organizations"
              description="Add Inginitum Global, Qrestik Technologies, or other entities. Users switch between these on the dashboard; all data is scoped to the active organization."
            >
              {companies.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">No organizations yet. Add Inginitum Global and Qrestik Technologies.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-[#9CA3AF]">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Email</th>
                        <th className="pb-3 pr-4 font-medium">Currency</th>
                        <th className="pb-3 pr-4 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-[#111827]">{c.name}</p>
                            {c.legal_name && <p className="text-xs text-[#6B7280]">{c.legal_name}</p>}
                          </td>
                          <td className="py-3 pr-4 text-[#6B7280]">{c.email || '—'}</td>
                          <td className="py-3 pr-4">{c.default_currency}</td>
                          <td className="py-3 pr-4">
                            <StatusPill ok={c.is_active} label={c.is_active ? 'Active' : 'Inactive'} />
                          </td>
                          <td className="py-3 text-right">
                            <button type="button" onClick={() => openCompanyModal(c)} className="mr-2 rounded p-1.5 text-[#6B7280] hover:bg-gray-100" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => removeCompany(c.id, c.name)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SettingsCard>
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openUserModal()}>
                <Plus className="h-4 w-4" /> Add user
              </Button>
            </div>
            <SettingsCard
              title="Users & roles"
              description="Admin: full settings and user management. Entry: create and edit invoices, customers, milestones. Readonly: view-only access."
            >
              <div className="mb-4 rounded-lg bg-gray-50 p-4 text-xs text-[#6B7280]">
                <strong className="text-[#374151]">Roles</strong>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Admin</strong> — all features including this settings page</li>
                  <li><strong>Entry</strong> — operational data entry (invoices, customers, payments)</li>
                  <li><strong>Readonly</strong> — dashboards and reports without edits</li>
                </ul>
              </div>
              {users.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-[#9CA3AF]">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Email</th>
                        <th className="pb-3 pr-4 font-medium">Role</th>
                        <th className="pb-3 pr-4 font-medium">Company</th>
                        <th className="pb-3 pr-4 font-medium">Active</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4 font-medium text-[#111827]">
                            {u.name}
                            {u.id === user?.id && <span className="ml-1 text-xs text-[#9CA3AF]">(you)</span>}
                          </td>
                          <td className="py-3 pr-4 text-[#6B7280]">{u.email}</td>
                          <td className="py-3 pr-4">
                            <RoleBadge role={u.role?.charAt(0).toUpperCase() + u.role?.slice(1)} />
                          </td>
                          <td className="py-3 pr-4 text-[#6B7280]">{companyName(u.company_id) || '—'}</td>
                          <td className="py-3 pr-4">
                            <StatusPill ok={u.is_active} label={u.is_active ? 'Yes' : 'No'} />
                          </td>
                          <td className="py-3 text-right">
                            <button type="button" onClick={() => openUserModal(u)} className="mr-2 rounded p-1.5 text-[#6B7280] hover:bg-gray-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                            {u.id !== user?.id && (
                              <button type="button" onClick={() => removeUser(u.id, u.name)} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SettingsCard>
          </div>
        )}

        {activeTab === 'email' && isAdmin && (
          <form onSubmit={saveEmail}>
            <SettingsCard
              title="Email & notifications"
              description="Outbound sender addresses and milestone alert recipients. SendGrid API key is configured via server environment."
              footer={<Button type="submit">Save changes</Button>}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="From email" type="email" value={emailForm.from_email} onChange={setEmail('from_email')} placeholder="invoices@yourcompany.com" />
                <Input label="Reply-to email" type="email" value={emailForm.reply_to_email} onChange={setEmail('reply_to_email')} />
                <Textarea
                  label="Milestone alert emails (comma-separated)"
                  value={emailForm.milestone_alert_emails}
                  onChange={setEmail('milestone_alert_emails')}
                  placeholder="ops@company.com, finance@company.com"
                  rows={2}
                  className="sm:col-span-2"
                />
              </div>
            </SettingsCard>
          </form>
        )}

        {activeTab === 'invoice' && isAdmin && (
          <form onSubmit={saveInvoiceDefaults}>
            <SettingsCard
              title="Invoice defaults"
              description="Default values applied when creating new invoices."
              footer={<Button type="submit">Save changes</Button>}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Default currency" value={invoiceForm.default_currency} onChange={setInv('default_currency')}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Input label="Payment terms (days)" type="number" min={1} max={365} value={invoiceForm.default_payment_terms_days} onChange={setInv('default_payment_terms_days')} />
                <Input label="Invoice number prefix" value={invoiceForm.invoice_number_prefix} onChange={setInv('invoice_number_prefix')} placeholder="INV-" />
                <Input label="Reminder interval (days)" type="number" min={1} max={90} value={invoiceForm.reminder_interval_days} onChange={setInv('reminder_interval_days')} />
                <Input label="OneDrive folder name" value={invoiceForm.onedrive_folder} onChange={setInv('onedrive_folder')} className="sm:col-span-2" />
              </div>
            </SettingsCard>
          </form>
        )}

        {activeTab === 'integrations' && isAdmin && (
          <SettingsCard
            title="Integrations"
            description="Connection status is read from environment variables on the server. Update .env and restart containers to change credentials."
          >
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="font-medium text-[#111827]">SendGrid (email)</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">Transactional email for reminders and verification.</p>
                  {integrations?.sendgrid_from_env && (
                    <p className="mt-2 text-xs text-[#9CA3AF]">Env sender: {integrations.sendgrid_from_env}</p>
                  )}
                </div>
                <StatusPill
                  ok={integrations?.sendgrid_configured}
                  label={integrations?.sendgrid_configured ? 'Configured' : 'Not configured'}
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="font-medium text-[#111827]">Microsoft OneDrive</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">Invoice document sync to cloud storage.</p>
                  {integrations?.onedrive_folder_env && (
                    <p className="mt-2 text-xs text-[#9CA3AF]">Folder: {integrations.onedrive_folder_env}</p>
                  )}
                </div>
                <StatusPill
                  ok={integrations?.onedrive_configured}
                  label={integrations?.onedrive_configured ? 'Configured' : 'Not configured'}
                />
              </div>
            </div>
          </SettingsCard>
        )}

        {activeTab === 'account' && (
          <SettingsCard title="My account" description="Your signed-in profile (read-only).">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[#9CA3AF]">Name</dt>
                <dd className="mt-0.5 font-medium text-[#111827]">{user?.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#9CA3AF]">Email</dt>
                <dd className="mt-0.5 font-medium text-[#111827]">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#9CA3AF]">Role</dt>
                <dd className="mt-1">
                  <RoleBadge role={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} />
                </dd>
              </div>
              {!isAdmin && (
                <div className="sm:col-span-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  System settings are available to administrators only.
                </div>
              )}
            </dl>
          </SettingsCard>
        )}
      </TabPanel>

      <Modal
        open={!!companyModal}
        onClose={() => setCompanyModal(null)}
        title={companyModal?.mode === 'edit' ? 'Edit organization' : 'Add organization'}
        size="lg"
      >
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Display name" value={companyForm.name} onChange={setCo('name')} required />
            <Input label="Legal name" value={companyForm.legal_name} onChange={setCo('legal_name')} />
            <Input label="Email" type="email" value={companyForm.email} onChange={setCo('email')} />
            <Input label="Phone" value={companyForm.phone} onChange={setCo('phone')} />
            <Select label="Default currency" value={companyForm.default_currency} onChange={setCo('default_currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="flex items-end pb-1">
              <Checkbox label="Active" checked={companyForm.is_active} onChange={setCo('is_active')} />
            </div>
            <Input label="Tax ID" value={companyForm.tax_id} onChange={setCo('tax_id')} />
            <Input label="Website" value={companyForm.website} onChange={setCo('website')} />
            <Textarea label="Address" value={companyForm.address} onChange={setCo('address')} className="sm:col-span-2" />
            <Textarea label="Notes" value={companyForm.notes} onChange={setCo('notes')} className="sm:col-span-2" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCompanyModal(null)}>Cancel</Button>
            <Button type="submit">{companyModal?.mode === 'edit' ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!userModal}
        onClose={() => setUserModal(null)}
        title={userModal === 'edit' ? 'Edit user' : 'Add user'}
        size="lg"
      >
        <form onSubmit={saveUser} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={userForm.name} onChange={setUsr('name')} required />
            <Input label="Email" type="email" value={userForm.email} onChange={setUsr('email')} required />
            <Input
              label={userModal === 'edit' ? 'New password (optional)' : 'Password'}
              type="password"
              value={userForm.password}
              onChange={setUsr('password')}
              required={userModal === 'create'}
              minLength={6}
            />
            <Select label="Role" value={userForm.role} onChange={setUsr('role')}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <Select label="Default organization" value={userForm.company_id} onChange={setUsr('company_id')}>
              <option value="">— None —</option>
              {companies.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </Select>
            <div className="flex items-end pb-1">
              <Checkbox label="Account active" checked={userForm.is_active} onChange={setUsr('is_active')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setUserModal(null)}>Cancel</Button>
            <Button type="submit">{userModal === 'edit' ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
