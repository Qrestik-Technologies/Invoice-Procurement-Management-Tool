import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs, { TabPanel } from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import { RoleBadge } from '../components/ui/Badge';
import { Input, Select, Textarea, Toggle } from '../components/ui/FormFields';
import { fetchUsers, updateUser } from '../api/auth';
import { toDisplayRole } from '../utils/status';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessSettings } from '../utils/status';

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
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers, enabled: canAccessSettings(user?.role) });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => updateUser(id, { is_active }),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Update failed'),
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
            <div className="grid max-w-2xl gap-4">
              <Input label="Company Name" defaultValue="Qrestik Services LLC" />
              <Input label="Company Email" defaultValue="invoices@qrestik.com" />
              <Textarea label="Business Address" defaultValue={'1200 Enterprise Blvd, Suite 400\nAustin, TX 78701'} rows={3} />
              <Button className="w-fit" onClick={() => toast.success('Company info saved (demo)')}>Save Company Info</Button>
            </div>
          </TabPanel>
        )}
        {activeTab === 'email' && (
          <TabPanel>
            <div className="grid max-w-2xl gap-4">
              <Input label="SendGrid API Key" type="password" placeholder="SG.xxxx" />
              <Input label="From Email" defaultValue="invoices@qrestik.com" />
              <Button className="w-fit" onClick={() => toast.success('Email config saved (demo)')}>Save Email Config</Button>
            </div>
          </TabPanel>
        )}
        {activeTab === 'template' && (
          <TabPanel>
            <div className="grid max-w-2xl gap-4">
              <Select label="Default Template"><option>Standard</option><option>EMCOR</option></Select>
              <Input label="Default Payment Terms" defaultValue="Net 30" />
              <Button className="w-fit" onClick={() => toast.success('Template config saved (demo)')}>Save Template Config</Button>
            </div>
          </TabPanel>
        )}
        {activeTab === 'users' && (
          <TabPanel>
            {isLoading ? <p className="text-sm">Loading users…</p> : (
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
    </div>
  );
}
