import { cn } from '../../utils/cn';

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-[#6B7280] hover:border-gray-300 hover:text-[#111827]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function TabPanel({ children, className }) {
  return <div className={cn('pt-6', className)}>{children}</div>;
}
