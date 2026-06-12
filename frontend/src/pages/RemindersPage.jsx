import { useEffect, useState } from 'react';
import { Plus, Bell, Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react';
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
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function getReminderUrgency(reminder) {
  const now = new Date();
  const scheduled = new Date(reminder.scheduled_at);
  const daysUntil = (scheduled - now) / (1000 * 60 * 60 * 24);
  if (reminder.sent_at) return 'sent';
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 3) return 'urgent';
  return 'pending';
}

function ReminderCard({ reminder, invoices, selected, onClick }) {
  const urgency = getReminderUrgency(reminder);
  const date = new Date(reminder.scheduled_at);
  const invoice = invoices.find(i => i.id === reminder.invoice_id);
  const s = {
    sent:    { border: 'border-green-200',  bg: 'bg-green-50',   icon: <CheckCircle className="h-5 w-5 text-green-500" />,              badge: 'bg-green-100 text-green-700',   label: 'Sent' },
    overdue: { border: 'border-red-400',    bg: 'bg-red-50',     icon: <AlertTriangle className="h-5 w-5 text-red-500" />,             badge: 'bg-red-100 text-red-700',      label: 'Overdue' },
    urgent:  { border: 'border-orange-400', bg: 'bg-orange-50',  icon: <Bell className="h-5 w-5 text-orange-500 animate-pulse" />,      badge: 'bg-orange-100 text-orange-700', label: 'Due Soon' },
    pending: { border: 'border-gray-200',   bg: 'bg-white',      icon: <Clock className="h-5 w-5 text-blue-400" />,                    badge: 'bg-blue-100 text-blue-700',    label: 'Pending' },
  }[urgency];
  return (
    <div onClick={onClick} className={`cursor-pointer rounded-xl border-2 ${s.border} ${s.bg} p-4 shadow-sm transition-all hover:shadow-md ${selected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className={`font-semibold text-gray-900 ${urgency === 'urgent' || urgency === 'overdue' ? 'text-base' : 'text-sm'}`}>
              {reminder._po_reminder ? (reminder.message || 'PO Reminder') : `Invoice ${invoice?.invoice_number || '#' + reminder.invoice_id}`}
            </p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>{s.label}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {reminder.reminder_type && (
            <p className="mt-1 text-xs font-medium text-indigo-500 uppercase tracking-wide">{reminder.reminder_type.replace(/_/g, ' ')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({ reminders, onDayClick, selectedDay, month, year, onPrev, onNext }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const priority = { overdue: 4, urgent: 3, pending: 2, sent: 1 };
  const dateUrgency = {};
  reminders.forEach(r => {
    const d = new Date(r.scheduled_at);
    if (d.getMonth() !== month || d.getFullYear() !== year) return;
    const key = d.getDate();
    const u = getReminderUrgency(r);
    if (!dateUrgency[key] || priority[u] > priority[dateUrgency[key]]) dateUrgency[key] = u;
  });
  const dotColors = { overdue: 'bg-red-500', urgent: 'bg-orange-400', pending: 'bg-indigo-400', sent: 'bg-green-400' };
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onPrev} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-base font-bold text-gray-800">{MONTHS[month]} {year}</span>
        <button onClick={onNext} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="mb-3 grid grid-cols-7 text-center">
        {DAYS.map(d => <div key={d} className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const urgency = dateUrgency[day];
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSelected = selectedDay === day;
          return (
            <button key={i} onClick={() => onDayClick(day)}
              className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all
                ${isSelected ? 'bg-indigo-600 text-white shadow-lg scale-110'
                : urgency === 'overdue' ? 'bg-red-100 text-red-700 font-bold ring-2 ring-red-300'
                : urgency === 'urgent'  ? 'bg-orange-100 text-orange-700 font-bold'
                : isToday ? 'bg-indigo-50 text-indigo-600 font-bold'
                : 'text-gray-700 hover:bg-gray-100'}`}>
              {day}
              {urgency && <span className={`absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : dotColors[urgency]}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
        {[['bg-red-500','Overdue'],['bg-orange-400','Due soon'],['bg-indigo-400','Pending'],['bg-green-400','Sent']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${c}`} /><span className="text-xs text-gray-500">{l}</span></div>
        ))}
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
  const [selectedReminder, setSelectedReminder] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => Promise.all([
    apiClient.get('/invoices/reminders/scheduled').then(r => r.data.data || []).catch(() => []),
    apiClient.get('/reminders').then(r => r.data.data || []).catch(() => []),
  ]).then(([inv, po]) => setReminders([...inv, ...po.map(r => ({ ...r, _po_reminder: true }))]));

  useEffect(() => { if (!organizationId) return; load(); apiClient.get('/invoices').then(r => setInvoices(r.data.data || [])).catch(() => {}); }, [organizationId]);
  useEffect(() => {
    const state = location.state;
    if (state?.prefill_invoice_id) { setForm(f => ({ ...f, invoice_id: String(state.prefill_invoice_id) })); setShowModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/reminders', { invoice_id: Number(form.invoice_id), scheduled_at: new Date(form.scheduled_at).toISOString(), message: form.message || null });
      toast.success('Reminder scheduled'); setShowModal(false); setForm({ invoice_id: '', scheduled_at: '', message: '' }); load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed');
    }
  };

  const filteredReminders = selectedDay
    ? reminders.filter(r => { const d = new Date(r.scheduled_at); return d.getDate() === selectedDay && d.getMonth() === calMonth && d.getFullYear() === calYear; })
    : reminders;

  const pending = reminders.filter(r => !r.sent_at && new Date(r.scheduled_at) >= new Date()).length;
  const sent    = reminders.filter(r => r.sent_at).length;
  const overdue = reminders.filter(r => !r.sent_at && new Date(r.scheduled_at) < new Date()).length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <PageHeader title={meta.title} organizationName={meta.organizationName} description={meta.description}
        action={canEdit ? <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" /> New Reminder</Button> : null} />

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: pending, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock },
          { label: 'Sent',    value: sent,    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', icon: CheckCircle },
          { label: 'Overdue', value: overdue, color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-100',   icon: Bell },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border ${border} ${bg} p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div><p className={`text-3xl font-bold ${color}`}>{value}</p><p className="text-xs text-gray-500 mt-1">{label}</p></div>
              <Icon className={`h-8 w-8 ${color} opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[380px_1fr] gap-6">
        <div className="space-y-3">
          <MiniCalendar reminders={reminders} onDayClick={(day) => { setSelectedDay(p => p === day ? null : day); setSelectedReminder(null); }}
            selectedDay={selectedDay} month={calMonth} year={calYear}
            onPrev={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }}
            onNext={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} />
          {selectedDay && <button onClick={() => { setSelectedDay(null); setSelectedReminder(null); }} className="w-full rounded-xl border border-gray-100 bg-white py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors">Clear filter · Show all</button>}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">
            {selectedDay ? `${MONTHS[calMonth]} ${selectedDay} — ${filteredReminders.length} reminder${filteredReminders.length !== 1 ? 's' : ''}` : `All reminders — ${reminders.length}`}
          </p>
          {filteredReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
              <Calendar className="mb-3 h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">No reminders {selectedDay ? 'on this day' : 'scheduled'}</p>
              <p className="mt-1 text-xs text-gray-400">Click a date or add a new reminder</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map(r => (
                <div key={r.id}>
                  <ReminderCard reminder={r} invoices={invoices} selected={selectedReminder?.id === r.id} onClick={() => setSelectedReminder(p => p?.id === r.id ? null : r)} />
                  {selectedReminder?.id === r.id && (
                    <div className="mt-1 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm space-y-2">
                      <p className="font-semibold text-indigo-800 text-base">Reminder Details</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div><span className="text-gray-500">Type: </span><span className="font-medium text-gray-800">{r.reminder_type?.replace(/_/g,' ') || 'invoice reminder'}</span></div>
                        <div><span className="text-gray-500">Status: </span><span className="font-medium text-gray-800">{r.sent_at ? 'Sent' : new Date(r.scheduled_at) < new Date() ? 'Overdue' : 'Pending'}</span></div>
                        <div><span className="text-gray-500">Scheduled: </span><span className="font-medium text-gray-800">{new Date(r.scheduled_at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
                        {r.sent_at && <div><span className="text-gray-500">Sent at: </span><span className="font-medium text-gray-800">{new Date(r.sent_at).toLocaleString('en-GB')}</span></div>}
                        {r.invoice_id && <div><span className="text-gray-500">Invoice: </span><span className="font-medium text-gray-800">{invoices.find(i => i.id === r.invoice_id)?.invoice_number || '#'+r.invoice_id}</span></div>}
                        {r.po_id && <div><span className="text-gray-500">PO ID: </span><span className="font-medium text-gray-800">#{r.po_id}</span></div>}
                        {r.message && <div className="col-span-2"><span className="text-gray-500">Message: </span><span className="font-medium text-gray-800">{r.message}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Schedule a Reminder" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice <span className="text-red-500">*</span></label>
              <select value={form.invoice_id} onChange={set('invoice_id')} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">Select an invoice</option>
                {invoices.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number}{i.customer_name ? ` — ${i.customer_name}` : ''}{i.amount ? ` (${i.currency || 'USD'} ${Number(i.amount).toLocaleString()})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send At <span className="text-red-500">*</span></label>
              <input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} required
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={form.message} onChange={set('message')} rows={3} placeholder="e.g. Payment due — please process at your earliest convenience"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Schedule Reminder</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
