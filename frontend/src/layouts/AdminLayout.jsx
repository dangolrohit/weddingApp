import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard,
  Package,
  Tag, 
  HardDrive, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Camera,
  ExternalLink
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Clients', path: '/admin/clients', icon: Users },
    { label: 'Payments', path: '/admin/payments', icon: CreditCard },
    { label: 'Equipment', path: '/admin/equipment', icon: Package },
    { label: 'Categories', path: '/admin/categories', icon: Tag },
    { label: 'Storage', path: '/admin/storage', icon: HardDrive },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-stone-900 text-stone-100 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-amber-400" />
          <span className="font-serif tracking-wider font-semibold">STUDIO ADMIN</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded text-stone-300 hover:text-white hover:bg-stone-800"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-stone-900 text-stone-200 flex flex-col justify-between
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-xl md:shadow-none
        `}
      >
        <div>
          {/* Studio Brand Header */}
          <div className="p-6 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-serif font-semibold text-stone-100 text-sm tracking-wide">STUDIO ADMIN</h1>
                <p className="text-xs text-stone-400">Photo Delivery Platform</p>
              </div>
            </div>
            {mobileMenuOpen && (
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-amber-600/15 text-amber-400 border border-amber-500/30'
                        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Footer */}
        <div className="p-4 border-t border-stone-800 space-y-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <span>View Public Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center justify-between pt-2 border-t border-stone-800/60">
            <div className="truncate pr-2">
              <p className="text-xs font-medium text-stone-200 truncate">{user?.name || 'Administrator'}</p>
              <p className="text-[11px] text-stone-400 truncate">{user?.email || 'admin@studio.com'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

