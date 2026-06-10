import { useEffect, useState } from 'react';
import { Plus, Bell, Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function MiniCalendar({ reminders, onDayClick, selectedDay, month, year, onPrev, onNext }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const reminderDates = new Set(
    reminders.map(r => {
      const d = new Date(r.scheduled_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onPrev} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTHS[month]} {year}</span>
        <button onClick={onNext} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 text-center">
        {DAYS.map(d => (
          <div key={d} className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = `${year}-${month}-${day}`;
          const hasReminder = reminderDates.has(key);
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSelected = selectedDay === day;
          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all
                ${isSelected ? 'bg-indigo-600 text-white shadow-md' : isToday ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {day}
              {hasReminder && (
                <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReminderCard({ reminder, invoiceNumber }) {
  const date = new Date(reminder.scheduled_at);
  const isPending = !reminder.sent_at;
  const isOverdue = isPending && date < new Date();

  return (
    <div className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
        ${isOverdue ? 'bg-red-50' : isPending ? 'bg-amber-50' : 'bg-green-50'}`}>
        {isOverdue
          ? <Bell className="h-5 w-5 text-red-400" />
          : isPending
          ? <Clock className="h-5 w-5 text-amber-400" />
          : <CheckCircle className="h-5 w-5 text-green-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Invoice {invoiceNumber}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium
            ${isOverdue ? 'bg-red-100 text-red-700' : isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            {isOverdue ? 'Overdue' : isPending ? 'Pending' : 'Sent'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}
          {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {reminder.message && (
          <p className="mt-1.5 text-xs text-gray-500 italic">"{reminder.message}"</p>
        )}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Reminders', 'Scheduled payment follow-ups');
  const location = useLocation();

  const [reminders, setReminders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ invoice_id: '', scheduled_at: '', message: '' });
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => apiClient.get('/invoices/reminders/scheduled').then(r => setReminders(r.data.data || [])).catch(() => setReminders([]));

  useEffect(() => {
    if (!organizationId) return;
    load();
    apiClient.get('/invoices').then(r => setInvoices(r.data.data || [])).catch(() => {});
  }, [organizationId]);

  useEffect(() => {
    const state = location.state;
    if (state?.prefill_invoice_id) {
      setForm(f => ({ ...f, invoice_id: String(state.prefill_invoice_id) }));
      setShowModal(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/invoices/${form.invoice_id}/reminders`, {
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        message: form.message || null,
      });
      toast.success('Reminder scheduled');
      setShowModal(false);
      setForm({ invoice_id: '', scheduled_at: '', message: '' });
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to schedule reminder';
      toast.error(msg);
    }
  };

  const filteredReminders = selectedDay
    ? reminders.filter(r => {
        const d = new Date(r.scheduled_at);
        return d.getDate() === selectedDay && d.getMonth() === calMonth && d.getFullYear() === calYear;
      })
    : reminders;

  const pending = reminders.filter(r => !r.sent_at).length;
  const sent = reminders.filter(r => r.sent_at).length;
  const overdue = reminders.filter(r => !r.sent_at && new Date(r.scheduled_at) < new Date()).length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        action={canEdit ? (
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Reminder
          </Button>
        ) : null}
      />

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
          { label: 'Sent', value: sent, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
          { label: 'Overdue', value: overdue, color: 'text-red-600', bg: 'bg-red-50', icon: Bell },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[300px_1fr] gap-6">
        <div className="space-y-4">
          <MiniCalendar
            reminders={reminders}
            onDayClick={(day) => setSelectedDay(prev => prev === day ? null : day)}
            selectedDay={selectedDay}
            month={calMonth}
            year={calYear}
            onPrev={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
              else setCalMonth(m => m - 1);
            }}
            onNext={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
              else setCalMonth(m => m + 1);
            }}
          />
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="w-full rounded-xl border border-gray-100 bg-white py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
              Clear filter · Show all
            </button>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">
              {selectedDay
                ? `${MONTHS[calMonth]} ${selectedDay} — ${filteredReminders.length} reminder${filteredReminders.length !== 1 ? 's' : ''}`
                : `All reminders — ${reminders.length}`}
            </p>
          </div>
          {filteredReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
              <Calendar className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No reminders {selectedDay ? 'on this day' : 'scheduled'}</p>
              <p className="mt-1 text-xs text-gray-400">Click a date or add a new reminder</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map(r => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  invoiceNumber={invoices.find(i => i.id === r.invoice_id)?.invoice_number || `#${r.invoice_id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Schedule a Reminder" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Select label="Invoice" value={form.invoice_id} onChange={set('invoice_id')} required>
              <option value="">Select invoice</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>{i.invoice_number}</option>
              ))}
            </Select>
            <Input label="Send At" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required />
            <Input label="Message (optional)" value={form.message} onChange={set('message')} placeholder="e.g. Payment due reminder" />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Schedule</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
