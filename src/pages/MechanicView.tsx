import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, Package, AlertTriangle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WorkOrder, WorkOrderTask, PartsRequest } from '../types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  waiting_parts: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-green-900/60 text-green-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  waiting_parts: 'Waiting Parts',
  completed: 'Completed',
};

interface PartsForm {
  part_name: string;
  part_number: string;
  quantity: number;
  notes: string;
}

export default function MechanicView() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [partsModal, setPartsModal] = useState<string | null>(null);
  const [partsForm, setPartsForm] = useState<PartsForm>({ part_name: '', part_number: '', quantity: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    if (!profile) return;
    const { data } = await supabase
      .from('work_orders')
      .select('*, tasks:work_order_tasks(*), parts_requests(*)')
      .eq('assigned_mechanic_id', profile.id)
      .neq('status', 'completed')
      .order('created_at', { ascending: true });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [profile]);

  async function toggleTask(task: WorkOrderTask, orderId: string) {
    const next = task.status === 'completed' ? 'in_progress' : 'completed';
    await supabase.from('work_order_tasks').update({
      status: next,
      completed_by: next === 'completed' ? profile?.id : null,
      completed_at: next === 'completed' ? new Date().toISOString() : null,
    }).eq('id', task.id);

    // auto-update order status
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const tasks = (order.tasks ?? []).map(t => t.id === task.id ? { ...t, status: next } : t);
      const allDone = tasks.every(t => t.status === 'completed');
      const anyDone = tasks.some(t => t.status !== 'pending');
      const newStatus = allDone ? 'completed' : anyDone ? 'in_progress' : 'pending';
      await supabase.from('work_orders').update({
        status: newStatus,
        completed_at: allDone ? new Date().toISOString() : null,
      }).eq('id', orderId);
    }
    await fetchOrders();
  }

  async function submitPartsRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!partsModal || !profile) return;
    setSubmitting(true);
    await supabase.from('parts_requests').insert({
      work_order_id: partsModal,
      mechanic_id: profile.id,
      ...partsForm,
    });
    // Set order to waiting_parts
    await supabase.from('work_orders').update({ status: 'waiting_parts' }).eq('id', partsModal);
    setPartsModal(null);
    setPartsForm({ part_name: '', part_number: '', quantity: 1, notes: '' });
    setSubmitting(false);
    await fetchOrders();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">My Work Orders</h2>
        <span className="text-slate-400 text-sm">{orders.length} active</span>
      </div>

      {orders.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active work orders</p>
          <p className="text-sm mt-1">You're all caught up!</p>
        </div>
      )}

      {orders.map(order => {
        const tasks = order.tasks ?? [];
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const pendingParts = (order.parts_requests ?? []).filter(p => p.status === 'pending').length;
        const isOpen = expanded === order.id;

        return (
          <div key={order.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
            <button
              onClick={() => setExpanded(isOpen ? null : order.id)}
              className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-slate-750 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-white font-bold text-lg">
                    {order.car_year} {order.car_make} {order.car_model}
                  </span>
                  <span className="text-slate-500 text-sm font-mono">{order.license_plate}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-slate-400 text-sm truncate">{order.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {completedCount}/{tasks.length} tasks
                  </span>
                  {pendingParts > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Package className="w-3 h-3" />
                      {pendingParts} parts needed
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="shrink-0 mt-1">
                {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-700 px-6 pb-6 pt-4 space-y-5">
                {/* Customer info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-700/50 rounded-xl px-4 py-3">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Customer</p>
                    <p className="text-white font-medium">{order.customer_name}</p>
                    <p className="text-slate-400">{order.customer_phone}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl px-4 py-3">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Work Description</p>
                    <p className="text-slate-300 text-sm">{order.description}</p>
                  </div>
                </div>

                {/* Tasks */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Tasks</h4>
                  {tasks.length === 0 && <p className="text-slate-500 text-sm">No tasks assigned</p>}
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task, order.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-700/60 hover:bg-slate-700 rounded-xl text-left transition group"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-500 group-hover:text-slate-300 shrink-0 transition" />
                        )}
                        <span className={`text-sm flex-1 ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.description}
                        </span>
                        {task.status === 'completed' && (
                          <span className="text-xs text-green-500">Done</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parts requests */}
                {(order.parts_requests ?? []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Parts Requests</h4>
                    <div className="space-y-2">
                      {(order.parts_requests ?? []).map((pr: PartsRequest) => (
                        <div key={pr.id} className="flex items-center gap-3 px-4 py-3 bg-slate-700/40 rounded-xl">
                          <Package className="w-4 h-4 text-amber-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{pr.part_name}</p>
                            {pr.part_number && <p className="text-slate-500 text-xs">#{pr.part_number} · Qty: {pr.quantity}</p>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            pr.status === 'pending' ? 'bg-amber-900/60 text-amber-300' :
                            pr.status === 'ordered' ? 'bg-blue-900/60 text-blue-300' :
                            pr.status === 'received' ? 'bg-green-900/60 text-green-300' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request parts button */}
                <button
                  onClick={() => setPartsModal(order.id)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-sm font-medium transition"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Request Missing Parts
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Parts Request Modal */}
      {partsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <h3 className="text-white font-bold text-lg">Request Parts</h3>
              <button onClick={() => setPartsModal(null)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitPartsRequest} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Part Name *</label>
                <input
                  required
                  value={partsForm.part_name}
                  onChange={e => setPartsForm(f => ({ ...f, part_name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="e.g. Brake Pad Set"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Part Number</label>
                  <input
                    value={partsForm.part_number}
                    onChange={e => setPartsForm(f => ({ ...f, part_number: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="e.g. BP-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={partsForm.quantity}
                    onChange={e => setPartsForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                <textarea
                  value={partsForm.notes}
                  onChange={e => setPartsForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPartsModal(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
