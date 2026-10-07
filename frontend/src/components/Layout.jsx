import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Boxes, Users, ShoppingCart, BarChart3, Sparkles,
  MessageCircleQuestion, Settings, Bell, LogOut, BrainCircuit, Menu, X, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Badge } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, perm: 'orders' },
  { to: '/products', label: 'Products', icon: Package, perm: 'products' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory' },
  { to: '/customers', label: 'Customers', icon: Users, perm: 'customers' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, perm: 'analytics' },
  { to: '/ai', label: 'AI Insights', icon: Sparkles, perm: 'ai' },
  { to: '/assistant', label: 'AI Assistant', icon: MessageCircleQuestion, perm: 'ai' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: 'settings' },
];

export default function Layout() {
  const { user, business, logout, can } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () => client.get('/notifications')
      .then(({ data }) => { setNotifications(data.notifications); setUnread(data.unread); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    await client.post('/notifications/read-all');
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="font-bold leading-tight">BizMind AI</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Decision Support</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.filter((n) => !n.perm || can(n.perm)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-indigo-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-400">
          {business?.name || 'BizMind'}
          <div className="text-slate-500">{business?.currency === 'BDT' ? '৳ BDT' : business?.currency || ''}</div>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden text-slate-500" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="font-semibold text-slate-700 hidden sm:block">{business?.name}</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button className="relative text-slate-500 hover:text-slate-800 p-2" onClick={() => setNotifOpen(!notifOpen)}>
                <Bell size={19} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1">{unread}</span>}
              </button>
              {notifOpen && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="font-semibold text-sm">Notifications</span>
                    <button onClick={markAll} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><CheckCheck size={13} /> Mark all read</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No notifications</div>}
                    {notifications.map((n) => (
                      <div key={n.id} className={`px-4 py-3 text-sm ${n.isRead ? '' : 'bg-indigo-50/50'}`}>
                        <div className="flex items-center gap-2">
                          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                          <span className="font-medium text-slate-700">{n.title}</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{initials}</div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-medium text-slate-700">{user?.name}</div>
                <Badge className="bg-slate-100 text-slate-600 capitalize">{user?.role}</Badge>
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-slate-400 hover:text-rose-600 p-2" title="Sign out"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
