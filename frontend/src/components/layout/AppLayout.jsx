import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Milestone, Users, Bell,
  FolderOpen, TrendingUp, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/milestones', icon: Milestone, label: 'Milestones' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/cash-flow', icon: TrendingUp, label: 'Cash Flow' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success('Signed out');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-border bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            Q
          </div>
          <span className="text-sm font-semibold text-[#111827]">Qrestik</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 truncate text-xs text-[#6B7280]">
            <span className="font-medium text-[#111827]">{user?.name}</span>
            <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

