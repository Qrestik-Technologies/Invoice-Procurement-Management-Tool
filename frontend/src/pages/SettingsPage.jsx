import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs, { TabPanel } from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { RoleBadge } from '../components/ui/Badge';
import QueryError from '../components/ui/QueryError';
import { Input, Select, Textarea, Toggle } from '../components/ui/FormFields';
import { fetchUsers, createUser, updateUser } from '../api/auth';
import { fetchSettings, updateCompanySettings, updateEmailSettings, updateTemplateSettings } from '../api/settings';
import { toDisplayRole, toApiTemplate, toDisplayTemplate, canAccessSettings } from '../utils/status';
import { useAuth } from '../context/AuthContext';

const SETTINGS_TABS = [
  { id: 'company', label: 'Company Info' },
  { id: 'email', label: 'Email Config' },
  { id: 'template', label: 'Template Config' },
  { id: 'users', label: 'Users & Roles' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'entry' });

  const { data: settings, isLoading: settingsLoading, isError: settingsError, refetch: refetchSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: canAccessSettings(user?.role),
  });

  const { data: users = [], isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: canAccessSettings(user?.role),
  });

  const [companyForm, setCompanyForm] = useState({ company_name: '', company_email: '', business_address: '' });
  const [emailForm, setEmailForm] = useState({ from_email: '' });
  const [templateForm, setTemplateForm] = useState({ default_template: 'standard', default_payment_terms: 'Net 30' });

  useEffect(() => {
    if (settings) {
      setCompanyForm({
        company_name: settings.company_name,
        company_email: settings.company_email,
        business_address: settings.business_address || '',
      });
      setEmailForm({ from_email: settings.from_email });
      setTemplateForm({
        default_template: settings.default_template,
        default_payment_terms: settings.default_payment_terms,
      });
    }
  }, [settings]);

  const companyMut = useMutation({
    mutationFn: updateCompanySettings,
    onSuccess: () => { toast.success('Company info saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const emailMut = useMutation({
    mutationFn: updateEmailSettings,
    onSuccess: () => { toast.success('Email config saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const templateMut = useMutation({
    mutationFn: (payload) => updateTemplateSettings({
      default_template: payload.default_template,
      default_payment_terms: payload.default_payment_terms,
    }),
    onSuccess: () => { toast.success('Template config saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => updateUser(id, { is_active }),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success('User created');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setInviteOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'entry' });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Create failed'),
  });

  if (!canAccessSettings(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <PageHeader title="Settings" description="Configure company, email, templates, and users" />
      <Card>
        <Tabs tabs={SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'company' && (
          <TabPanel>
            {settingsError ? (
              <QueryError message="Could not load settings." onRetry={refetchSettings} />
            ) : settingsLoading ? (
              <p className="text-sm">Loading…</p>
            ) : (
              <div className="grid max-w-2xl gap-4">
                <Input label="Company Name" value={companyForm.company_name} onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} />
                <Input label="Company Email" type="email" value={companyForm.company_email} onChange={(e) => setCompanyForm({ ...companyForm, company_email: e.target.value })} />
                <Textarea label="Business Address" value={companyForm.business_address} onChange={(e) => setCompanyForm({ ...companyForm, business_address: e.target.value })} rows={3} />
                <Button className="w-fit" onClick={() => companyMut.mutate(companyForm)} disabled={companyMut.isPending}>Save Company Info</Button>
              </div>
            )}
          </TabPanel>
        )}
        {activeTab === 'email' && (
          <TabPanel>
            <div className="grid max-w-2xl gap-4">
              <p className="text-sm text-[#6B7280]">
                SendGrid API key is configured via server environment variables.
                {settings?.sendgrid_configured ? ' SendGrid is configured.' : ' SendGrid is not configured on the server.'}
              </p>
              <Input label="From Email" type="email" value={emailForm.from_email} onChange={(e) => setEmailForm({ from_email: e.target.value })} />
              <Button className="w-fit" onClick={() => emailMut.mutate(emailForm)} disabled={emailMut.isPending}>Save Email Config</Button>
            </div>
          </TabPanel>
        )}
        {activeTab === 'template' && (
          <TabPanel>
            <div className="grid max-w-2xl gap-4">
              <Select
                label="Default Template"
                value={toDisplayTemplate(templateForm.default_template)}
                onChange={(e) => setTemplateForm({ ...templateForm, default_template: toApiTemplate(e.target.value) })}
              >
                <option>Standard</option>
                <option>EMCOR</option>
              </Select>
              <Input label="Default Payment Terms" value={templateForm.default_payment_terms} onChange={(e) => setTemplateForm({ ...templateForm, default_payment_terms: e.target.value })} />
              <Button className="w-fit" onClick={() => templateMut.mutate(templateForm)} disabled={templateMut.isPending}>Save Template Config</Button>
            </div>
          </TabPanel>
        )}
        {activeTab === 'users' && (
          <TabPanel>
            <div className="mb-4 flex justify-end">
              <Button icon={Plus} onClick={() => setInviteOpen(true)}>Add user</Button>
            </div>
            {usersError ? (
              <QueryError message="Could not load users." onRetry={refetchUsers} />
            ) : usersLoading ? (
              <p className="text-sm">Loading users…</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase text-[#6B7280]">
                    {['Name', 'Email', 'Role', 'Active'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{u.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={toDisplayRole(u.role)} /></td>
                        <td className="px-4 py-3"><Toggle checked={u.is_active} onChange={(v) => toggleMut.mutate({ id: u.id, is_active: v })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabPanel>
        )}
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add user">
        <div className="space-y-4">
          <Input label="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <Input label="Email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          <Input label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          <Select label="Role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="entry">Entry</option>
            <option value="readonly">Readonly</option>
          </Select>
          <Button
            onClick={() => createMut.mutate({ ...newUser, is_active: true })}
            disabled={createMut.isPending || !newUser.name || !newUser.email || !newUser.password}
          >
            Create user
          </Button>
        </div>
      </Modal>
    </div>
  );
}
