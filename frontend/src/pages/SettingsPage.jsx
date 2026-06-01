import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-[#111827]">Settings</h1>
      <div className="max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm space-y-3">
        <div><p className="text-xs text-[#9CA3AF]">Name</p><p className="font-medium text-[#111827]">{user?.name}</p></div>
        <div><p className="text-xs text-[#9CA3AF]">Email</p><p className="font-medium text-[#111827]">{user?.email}</p></div>
        <div><p className="text-xs text-[#9CA3AF]">Role</p><p className="font-medium text-[#111827] capitalize">{user?.role}</p></div>
      </div>
    </div>
  );
}
