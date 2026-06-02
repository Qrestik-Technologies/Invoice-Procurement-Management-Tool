import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Milestone, Users, Bell,
  FolderOpen, TrendingUp, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const LOGO_SRC = '/Qrestik%20Technologies-01.png';

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
      <aside className="flex w-[17rem] flex-col border-r border-border bg-white">
        {/* Logo */}
        <div className="flex justify-center border-b border-border px-5 py-5">
          <NavLink to="/" end className="rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
            <img
              src={LOGO_SRC}
              alt="Qrestik Technologies"
              className="mx-auto h-11 w-auto max-w-[12rem] object-contain"
            />
          </NavLink>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium leading-snug transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0 stroke-[1.75]" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 truncate text-sm text-[#6B7280]">
            <span className="font-semibold text-[#111827]">{user?.name}</span>
            <span className="ml-2 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
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

