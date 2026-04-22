import { Wrench, LogOut, Gauge, ClipboardList, LayoutDashboard, UserCircle2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import MechanicView from './pages/MechanicView';
import FrontDeskView from './pages/FrontDeskView';
import ManagerView from './pages/ManagerView';

function AppShell() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;

  const role = profile.role;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top nav */}
      <header className="bg-slate-800 border-b border-slate-700 shadow-lg sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5 mr-4">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight hidden sm:block">AutoShop</span>
          </div>

          <div className="flex-1" />

          {/* Role badge */}
          {role === 'mechanic' && (
            <div className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs px-3 py-1.5 rounded-full font-medium">
              <Wrench className="w-3 h-3" />
              Mechanic
            </div>
          )}
          {role === 'clerk' && (
            <div className="flex items-center gap-1.5 bg-green-900/40 border border-green-700/50 text-green-300 text-xs px-3 py-1.5 rounded-full font-medium">
              <ClipboardList className="w-3 h-3" />
              Front Desk
            </div>
          )}
          {role === 'manager' && (
            <div className="flex items-center gap-1.5 bg-amber-900/40 border border-amber-700/50 text-amber-300 text-xs px-3 py-1.5 rounded-full font-medium">
              <Gauge className="w-3 h-3" />
              Manager
            </div>
          )}

          <div className="flex items-center gap-1.5 text-slate-400 text-sm border-l border-slate-700 pl-4">
            <UserCircle2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:block font-medium text-slate-300">{profile.full_name}</span>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-sm px-3 py-2 hover:bg-slate-700 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Out</span>
          </button>
        </div>
      </header>

      {/* Page header */}
      <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/0 border-b border-slate-700/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          {role === 'mechanic' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">Work Queue</h1>
                <p className="text-slate-400 text-sm">Your assigned repair orders</p>
              </div>
            </div>
          )}
          {role === 'clerk' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">Front Desk</h1>
                <p className="text-slate-400 text-sm">Manage orders and parts requests</p>
              </div>
            </div>
          )}
          {role === 'manager' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">Manager Dashboard</h1>
                <p className="text-slate-400 text-sm">Shop performance and team overview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {role === 'mechanic' && <MechanicView />}
        {role === 'clerk' && <FrontDeskView />}
        {role === 'manager' && <ManagerView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
