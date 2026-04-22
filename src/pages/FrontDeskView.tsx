import { useEffect, useState } from 'react';
import { Plus, X, Car, Package, ChevronDown, ChevronUp, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WorkOrder, Profile, PartsRequest } from '../types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  waiting_parts: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-green-900/60 text-green-300',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', waiting_parts: 'Waiting Parts', completed: 'Completed',
};

const PARTS_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-900/60 text-amber-300',
  ordered: 'bg-blue-900/60 text-blue-300',
  received: 'bg-green-900/60 text-green-300',
  cancelled: 'bg-slate-700 text-slate-400',
};

type Tab = 'orders' | 'parts';

interface NewOrderForm {
  car_make: string; car_model: string; car_year: string;
  license_plate: string; customer_name: string; customer_phone: string;
  description: string; assigned_mechanic_id: string; tasks: string[];
}

const EMPTY_FORM: NewOrderForm = {
  car_make: '', car_model: '', car_year: new Date().getFullYear().toString(),
  license_plate: '', customer_name: '', customer_phone: '',
  description: '', assigned_mechanic_id: '', tasks: [''],
};

export default function FrontDeskView() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [partsRequests, setPartsRequests] = useState<(PartsRequest & { work_order: WorkOrder; mechanic: Profile })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewOrderForm>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  async function fetchAll() {
    const [ordersRes, mechRes, partsRes] = await Promise.all([
      supabase.from('work_orders')
        .select('*, tasks:work_order_tasks(*), parts_requests(*), mechanic:profiles!work_orders_assigned_mechanic_id_fkey(*)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'mechanic'),
      supabase.from('parts_requests')
        .select('*, work_order:work_orders(*), mechanic:profiles!parts_requests_mechanic_id_fkey(*)')
        .order('created_at', { ascending: false }),
    ]);
    setOrders(ordersRes.data ?? []);
    setMechanics(mechRes.data ?? []);
    setPartsRequests(partsRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const { data: order } = await supabase.from('work_orders').insert({
      car_make: form.car_make,
      car_model: form.car_model,
      car_year: parseInt(form.car_year),
      license_plate: form.license_plate.toUpperCase(),
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      description: form.description,
      assigned_mechanic_id: form.assigned_mechanic_id || null,
      created_by: profile.id,
      status: form.assigned_mechanic_id ? 'pending' : 'pending',
    }).select().maybeSingle();

    if (order) {
      const validTasks = form.tasks.filter(t => t.trim());
      if (validTasks.length > 0) {
        await supabase.from('work_order_tasks').insert(
          validTasks.map(t => ({ work_order_id: order.id, description: t }))
        );
      }
    }

    setForm(EMPTY_FORM);
    setShowCreate(false);
    setSaving(false);
    await fetchAll();
  }

  async function updatePartsStatus(id: string, status: string) {
    await supabase.from('parts_requests').update({ status }).eq('id', id);
    await fetchAll();
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this work order?')) return;
    await supabase.from('work_orders').delete().eq('id', id);
    await fetchAll();
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);
  const pendingParts = partsRequests.filter(p => p.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
        <button
          onClick={() => setTab('orders')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
            tab === 'orders' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Car className="w-4 h-4" />
          Work Orders
          <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === 'orders' ? 'bg-amber-600 text-amber-100' : 'bg-slate-700 text-slate-400'}`}>
            {orders.filter(o => o.status !== 'completed').length}
          </span>
        </button>
        <button
          onClick={() => setTab('parts')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
            tab === 'parts' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          Parts Requests
          {pendingParts > 0 && (
            <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
              {pendingParts}
            </span>
          )}
        </button>
      </div>

      {/* Work Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {['all', 'pending', 'in_progress', 'waiting_parts', 'completed'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                    filterStatus === s ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-medium text-sm transition shadow-lg"
            >
              <Plus className="w-4 h-4" />
              New Order
            </button>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No work orders found</p>
            </div>
          )}

          {filteredOrders.map(order => {
            const tasks = order.tasks ?? [];
            const completedCount = tasks.filter(t => t.status === 'completed').length;
            const isOpen = expanded === order.id;

            return (
              <div key={order.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-slate-750 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-white font-bold text-base">
                        {order.car_year} {order.car_make} {order.car_model}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">{order.license_plate}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                      <span>{order.customer_name}</span>
                      {(order as WorkOrder & { mechanic?: Profile }).mechanic && (
                        <span className="text-blue-400">
                          Mechanic: {(order as WorkOrder & { mechanic?: Profile }).mechanic?.full_name}
                        </span>
                      )}
                      <span>{completedCount}/{tasks.length} tasks</span>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); deleteOrder(order.id); }}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-700 px-6 pb-6 pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-700/50 rounded-xl px-4 py-3">
                        <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Customer</p>
                        <p className="text-white font-medium">{order.customer_name}</p>
                        <p className="text-slate-400">{order.customer_phone}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl px-4 py-3">
                        <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Description</p>
                        <p className="text-slate-300 text-sm">{order.description}</p>
                      </div>
                    </div>

                    {tasks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Tasks</p>
                        <div className="space-y-1.5">
                          {tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg">
                              {task.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                              )}
                              <span className={`text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                {task.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(order.parts_requests ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parts Requests</p>
                        <div className="space-y-1.5">
                          {(order.parts_requests ?? []).map((pr: PartsRequest) => (
                            <div key={pr.id} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg">
                              <Package className="w-4 h-4 text-amber-400" />
                              <span className="text-slate-300 text-sm flex-1">{pr.part_name} (x{pr.quantity})</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${PARTS_STATUS_COLORS[pr.status]}`}>{pr.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Parts Requests Tab */}
      {tab === 'parts' && (
        <div className="space-y-3">
          {partsRequests.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No parts requests</p>
            </div>
          )}

          {partsRequests.map(pr => (
            <div key={pr.id} className="bg-slate-800 rounded-2xl border border-slate-700 px-6 py-4 shadow">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-white font-semibold">{pr.part_name}</span>
                    {pr.part_number && <span className="text-slate-500 text-xs font-mono">#{pr.part_number}</span>}
                    <span className="text-slate-500 text-xs">x{pr.quantity}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PARTS_STATUS_COLORS[pr.status]}`}>
                      {pr.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {pr.work_order?.car_year} {pr.work_order?.car_make} {pr.work_order?.car_model} · {pr.work_order?.license_plate}
                  </p>
                  {pr.mechanic && <p className="text-slate-500 text-xs mt-0.5">Requested by: {pr.mechanic.full_name}</p>}
                  {pr.notes && <p className="text-slate-400 text-sm mt-1 italic">"{pr.notes}"</p>}
                  <p className="text-slate-600 text-xs mt-1">{new Date(pr.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {pr.status === 'pending' && (
                    <button
                      onClick={() => updatePartsStatus(pr.id, 'ordered')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      Mark Ordered
                    </button>
                  )}
                  {pr.status === 'ordered' && (
                    <button
                      onClick={() => updatePartsStatus(pr.id, 'received')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      Mark Received
                    </button>
                  )}
                  {(pr.status === 'pending' || pr.status === 'ordered') && (
                    <button
                      onClick={() => updatePartsStatus(pr.id, 'cancelled')}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Work Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <h3 className="text-white font-bold text-lg">New Work Order</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createOrder} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Make *</label>
                  <input required value={form.car_make} onChange={e => setForm(f => ({ ...f, car_make: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="Toyota" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Model *</label>
                  <input required value={form.car_model} onChange={e => setForm(f => ({ ...f, car_model: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="Camry" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Year *</label>
                  <input required type="number" min={1900} max={new Date().getFullYear() + 1}
                    value={form.car_year} onChange={e => setForm(f => ({ ...f, car_year: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">License Plate *</label>
                <input required value={form.license_plate} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm uppercase"
                  placeholder="ABC 1234" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Customer Name *</label>
                  <input required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                  <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="+1 555 000 0000" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Description *</label>
                <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                  placeholder="Describe the work to be done..." />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign Mechanic</label>
                <select value={form.assigned_mechanic_id} onChange={e => setForm(f => ({ ...f, assigned_mechanic_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                  <option value="">-- Unassigned --</option>
                  {mechanics.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-400">Tasks</label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, tasks: [...f.tasks, ''] }))}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition">
                    <Plus className="w-3 h-3" /> Add Task
                  </button>
                </div>
                <div className="space-y-2">
                  {form.tasks.map((task, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={task} onChange={e => {
                        const tasks = [...form.tasks];
                        tasks[i] = e.target.value;
                        setForm(f => ({ ...f, tasks }));
                      }}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder={`Task ${i + 1}...`} />
                      {form.tasks.length > 1 && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, tasks: f.tasks.filter((_, j) => j !== i) }))}
                          className="p-2 text-slate-500 hover:text-red-400 transition">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
