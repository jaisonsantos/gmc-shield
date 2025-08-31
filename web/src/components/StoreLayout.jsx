// web/src/components/StoreLayout.jsx
import React from 'react';
import { Outlet, useParams, NavLink, useNavigate } from 'react-router-dom';
import { Page, PageHeader, PageContent } from './Page';
import Button from './Button';
import { ChevronLeft, BarChart, History, Rss, List, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const storeNavLinks = (t) => ([
  { to: 'violations', text: t('store.tabs.violations'), icon: <BarChart size={16} /> },
  { to: 'scans', text: t('store.tabs.scans'), icon: <History size={16} /> },
  { to: 'feeds', text: t('store.tabs.feeds'), icon: <Rss size={16} /> },
  { to: 'items', text: t('store.tabs.items'), icon: <List size={16} /> },
  { to: 'wp', text: t('store.tabs.wp'), icon: <HardDrive size={16} /> },
]);

const StoreNav = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const getNavLinkClass = ({ isActive }) => `flex items-center gap-2 px-4 py-2 border rounded-t-md -mb-px ${isActive ? 'bg-white border-gray-200 text-accent border-b-white' : 'text-gray-500 hover:bg-gray-50 border-transparent'}`;

  return (
    <nav className="flex gap-1 border-b mb-6">
      {storeNavLinks(t).map(link => (
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
  const { t } = useTranslation();

  return (
    <Page>
      <PageHeader>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" onClick={() => navigate('/app/stores')}>
            <ChevronLeft size={16} /> {t('store.back')}
          </Button>
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 style={{ margin: 0 }}>{t('store.title', { id })}</h2>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <StoreNav />
        <div>
          <Outlet />
        </div>
      </PageContent>
    </Page>
  );
}
