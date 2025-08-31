// web/src/pages/AppShell.jsx
import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Shield, LayoutDashboard, ShoppingCart, FileText, Bell, Settings, Building, HardHat, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
// Preferences moved into Settings page to avoid duplication in sidebar

const navLinks = (t) => ([
  { to: '/app/dashboard', text: t('nav.dashboard'), icon: <LayoutDashboard size={18} /> },
  { to: '/app/stores', text: t('nav.stores'), icon: <ShoppingCart size={18} /> },
  { to: '/app/notifications', text: t('nav.notifications'), icon: <Bell size={18} /> },
  { to: '/app/settings', text: t('nav.settings'), icon: <Settings size={18} /> },
  { to: '/app/agency', text: t('nav.agency'), icon: <Building size={18} /> },
  { to: '/app/ops', text: t('nav.ops'), icon: <HardHat size={18} /> },
]);

export default function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md font-medium ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="bg-white dark:bg-gray-950 border-r dark:border-gray-800 p-3 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2 px-2 py-1 text-accent">
          <Link to="/app/dashboard" className="flex items-center gap-2 text-accent no-underline">
            <Shield size={28} />
            <h1 className="text-lg font-semibold m-0">{t('app.name')}</h1>
          </Link>
        </div>
        <nav className="mt-4 flex flex-col gap-1 flex-1">
          {navLinks(t).map((link) => (
            <NavLink to={link.to} key={link.to} className={getNavLinkClass}>
              {link.icon}
              <span>{link.text}</span>
            </NavLink>
          ))}
        </nav>
        {/* Preferences (language/theme) agora ficam em Settings > Preferences */}
        <div className="pt-2 border-t text-sm text-gray-500 flex items-center justify-between">
          <span className="truncate" title={user?.email}>{user?.email}</span>
          <button onClick={logout} className="p-1 rounded hover:bg-gray-100" title={t('auth.logout')}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
