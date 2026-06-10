import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Flag,
  Users,
  Bell,
  FolderOpen,
  TrendingUp,
  Settings,
  X,
  ChevronLeft,
  LogOut,, ClipboardList} from 'lucide-react';
import { cn } from '../../utils/cn';
import { RoleBadge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { canAccessSettings, toDisplayRole } from '../../utils/status';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    { to: '/milestones', label: 'Milestones', icon: Flag },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/cash-flow', label: 'Cash Flow', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visibleNav = navItems.filter(
    (item) => !item.adminOnly || canAccessSettings(user?.role),
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'lg:w-16',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className={cn('flex items-center gap-2.5', collapsed && 'lg:justify-center lg:w-full')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              Q
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold text-[#111827]">Qrestik</p>
                <p className="text-[10px] text-[#6B7280]">Invoice Manager</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-lg p-1.5 text-[#6B7280] hover:bg-gray-100 lg:block"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]',
                  collapsed && 'lg:justify-center lg:px-2',
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t border-border p-4', collapsed && 'lg:p-2')}>
          <div className={cn('flex items-center gap-3', collapsed && 'lg:justify-center')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {user?.name?.split(' ').map((n) => n[0]).join('') || '?'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111827]">{user?.name}</p>
                <div className="mt-0.5">
                  <RoleBadge role={toDisplayRole(user?.role)} />
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]',
              collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
