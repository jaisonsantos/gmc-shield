// web/src/pages/AppShell.jsx
import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Shield, LayoutDashboard, ShoppingCart, FileText, Bell, Settings, Building, HardHat, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

const navLinks = [
  { to: '/app/dashboard', text: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/app/stores', text: 'Lojas', icon: <ShoppingCart size={18} /> },
  { to: '/app/notifications', text: 'Notificações', icon: <Bell size={18} /> },
  { to: '/app/settings', text: 'Configurações', icon: <Settings size={18} /> },
  { to: '/app/agency', text: 'Agência', icon: <Building size={18} /> },
  { to: '/app/ops', text: 'Operações', icon: <HardHat size={18} /> },
];

export default function AppShell() {
  const { user, logout } = useAuth();

  const getNavLinkClass = ({ isActive }) =>
    `nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <Link to="/app/dashboard" className="logo-link">
            <Shield size={28} />
            <h1>GMC Shield</h1>
          </Link>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavLink to={link.to} key={link.to} className={getNavLinkClass}>
              {link.icon}
              <span>{link.text}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
           <div className="user-profile">
              <span className="user-email">{user?.email}</span>
              <button onClick={logout} className="logout-button" title="Sair">
                <LogOut size={18} />
              </button>
           </div>
        </div>
      </aside>
      <div className="app-main-content">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}