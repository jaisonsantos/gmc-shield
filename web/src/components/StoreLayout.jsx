// web/src/components/StoreLayout.jsx
import React from 'react';
import { Outlet, useParams, NavLink, useNavigate } from 'react-router-dom';
import { Page, PageHeader, PageContent } from './Page';
import Button from './Button';
import { ChevronLeft, BarChart, History, Rss, List, HardDrive } from 'lucide-react';

const storeNavLinks = [
  { to: 'violations', text: 'Violações', icon: <BarChart size={16} /> },
  { to: 'scans', text: 'Scans', icon: <History size={16} /> },
  { to: 'feeds', text: 'Feeds', icon: <Rss size={16} /> },
  { to: 'items', text: 'Itens', icon: <List size={16} /> },
  { to: 'wp', text: 'WordPress', icon: <HardDrive size={16} /> },
];

const StoreNav = () => {
  const { id } = useParams();
  const getNavLinkClass = ({ isActive }) => `store-nav-link ${isActive ? 'active' : ''}`;

  return (
    <nav className="store-nav">
      {storeNavLinks.map(link => (
        <NavLink to={`/app/stores/${id}/${link.to}`} key={link.to} className={getNavLinkClass}>
          {link.icon}
          <span>{link.text}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default function StoreLayout() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <Page>
      <PageHeader>
        <div className="ph-left">
          <Button variant="outline" onClick={() => navigate('/app/stores')}>
            <ChevronLeft size={16} /> Voltar para Lojas
          </Button>
          <div className="title-group">
            <h2 style={{ margin: 0 }}>Loja #{id}</h2>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <StoreNav />
        <div className="store-content">
          <Outlet />
        </div>
      </PageContent>
    </Page>
  );
}