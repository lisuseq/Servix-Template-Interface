import { useEffect, useState } from 'react';
import { Users, ClipboardList, CheckCircle2, Package, TrendingUp, Clock, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkOrder, Profile, PartsRequest } from '../types';

interface MechanicStats {
  profile: Profile;
  assigned: number;
  inProgress: number;
  completed: number;
  waitingParts: number;
  avgCompletionHours: number | null;
  tasksCompleted: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-2xl px-6 py-5 shadow flex items-start gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ManagerView() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [parts, setParts] = useState<PartsRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [ordersRes, mechRes, partsRes] = await Promise.all([
        supabase.from('work_orders').select('*, tasks:work_order_tasks(*)'),
        supabase.from('profiles').select('*').eq('role', 'mechanic'),
        supabase.from('parts_requests').select('*'),
      ]);
      setOrders(ordersRes.data ?? []);
      setMechanics(mechRes.data ?? []);
      setParts(partsRes.data ?? []);
      setLoading(false);
    }
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalOrders = orders.length;
  const completedToday = orders.filter(o => o.completed_at && new Date(o.completed_at) >= today).length;
  const inProgress = orders.filter(o => o.status === 'in_progress').length;
  const waitingParts = orders.filter(o => o.status === 'waiting_parts').length;
  const pendingParts = parts.filter(p => p.status === 'pending').length;

  const mechanicStats: MechanicStats[] = mechanics.map(m => {
    const mOrders = orders.filter(o => o.assigned_mechanic_id === m.id);
    const completed = mOrders.filter(o => o.status === 'completed');

    const avgMs = completed.length > 0
      ? completed.reduce((sum, o) => {
          if (!o.completed_at) return sum;
          return sum + (new Date(o.completed_at).getTime() - new Date(o.created_at).getTime());
        }, 0) / completed.length
      : null;

    const tasksCompleted = mOrders.reduce((sum, o) => {
      return sum + ((o.tasks ?? []).filter(t => t.status === 'completed').length);
    }, 0);

    return {
      profile: m,
      assigned: mOrders.length,
      inProgress: mOrders.filter(o => o.status === 'in_progress').length,
      completed: completed.length,
      waitingParts: mOrders.filter(o => o.status === 'waiting_parts').length,
      avgCompletionHours: avgMs ? Math.round(avgMs / 3600000 * 10) / 10 : null,
      tasksCompleted,
    };
  });

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Orders"
          value={totalOrders}
          icon={<ClipboardList className="w-5 h-5 text-white" />}
          color="bg-slate-600"
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-blue-600"
        />
        <StatCard
          label="Completed Today"
          value={completedToday}
          icon={<CheckCircle2 className="w-5 h-5 text-white" />}
          color="bg-green-600"
        />
        <StatCard
          label="Waiting Parts"
          value={waitingParts}
          icon={<Package className="w-5 h-5 text-white" />}
          color="bg-amber-600"
        />
        <StatCard
          label="Pending Parts"
          value={pendingParts}
          sub="need ordering"
          icon={<AlertCircle className="w-5 h-5 text-white" />}
          color="bg-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mechanic Efficiency */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold">Mechanic Efficiency</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {mechanics.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No mechanics registered</p>
              </div>
            )}
            {mechanicStats.map(stat => {
              const utilization = stat.assigned > 0 ? Math.round((stat.completed / stat.assigned) * 100) : 0;
              return (
                <div key={stat.profile.id} className="px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold">{stat.profile.full_name}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{stat.assigned} total</span>
                        <span className="text-blue-400">{stat.inProgress} active</span>
                        <span className="text-green-400">{stat.completed} done</span>
                        {stat.waitingParts > 0 && <span className="text-amber-400">{stat.waitingParts} waiting parts</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{utilization}%</p>
                      <p className="text-slate-500 text-xs">completion</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-green-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>

                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      {stat.tasksCompleted} tasks completed
                    </span>
                    {stat.avgCompletionHours !== null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-400" />
                        avg {stat.avgCompletionHours}h per order
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold">Recent Activity</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {recentOrders.map(order => (
              <div key={order.id} className="px-6 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  order.status === 'completed' ? 'bg-green-400' :
                  order.status === 'in_progress' ? 'bg-blue-400' :
                  order.status === 'waiting_parts' ? 'bg-amber-400' :
                  'bg-slate-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {order.car_year} {order.car_make} {order.car_model}
                    <span className="text-slate-500 font-normal text-xs ml-2">{order.license_plate}</span>
                  </p>
                  <p className="text-slate-500 text-xs">{order.customer_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium capitalize ${
                    order.status === 'completed' ? 'text-green-400' :
                    order.status === 'in_progress' ? 'text-blue-400' :
                    order.status === 'waiting_parts' ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </p>
                  <p className="text-slate-600 text-xs">{new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Parts Requests Overview */}
      {parts.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
            <Package className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold">Parts Status Overview</h3>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {['pending', 'ordered', 'received', 'cancelled'].map(s => {
              const count = parts.filter(p => p.status === s).length;
              const colors: Record<string, string> = {
                pending: 'text-amber-400',
                ordered: 'text-blue-400',
                received: 'text-green-400',
                cancelled: 'text-slate-500',
              };
              return (
                <div key={s} className="bg-slate-700/50 rounded-xl px-4 py-3 text-center">
                  <p className={`text-2xl font-bold ${colors[s]}`}>{count}</p>
                  <p className="text-slate-400 text-xs capitalize mt-1">{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
