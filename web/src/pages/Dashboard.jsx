// web/src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stores as Api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Page, PageHeader, PageContent } from '../components/Page';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldCheck, Ban, Clock, ArrowRight } from 'lucide-react';
import Card from '../components/ui/Card';
import SectionHeader from '../components/ui/SectionHeader';
import Badge from '../components/ui/Badge';

// Um componente simples para os cartões de KPI
const KpiCard = ({ title, value, icon, severity = 'info' }) => {
  const bubble = severity === 'critical' ? 'bg-red-100 text-red-800' : severity === 'major' ? 'bg-orange-100 text-orange-800' : severity === 'ok' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  return (
    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bubble}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-sm text-gray-500">{title}</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);

  // Carregar a lista de lojas do utilizador
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const storeList = await Api.list();
        setStores(storeList);
        if (storeList.length > 0) {
          // Selecionar a primeira loja por defeito
          setSelectedStoreId(storeList[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Falha ao carregar as lojas.');
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  // Carregar os dados do dashboard para a loja selecionada
  useEffect(() => {
    if (!selectedStoreId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const dashboardData = await Api.dashboard(selectedStoreId);
        setData(dashboardData);
      } catch (err) {
        setError(`Falha ao carregar os dados da loja #${selectedStoreId}.`);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [selectedStoreId]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  return (
    <Page>
      <PageHeader>
        <h2 className="m-0 text-xl font-semibold">{t('nav.dashboard')}</h2>
        {stores.length > 1 && (
          <div className="ml-auto">
            <select className="px-2 py-1 border border-gray-300 rounded-md" value={selectedStoreId || ''} onChange={(e) => setSelectedStoreId(Number(e.target.value))}>
              {stores.map(store => (<option key={store.id} value={store.id}>{store.name || `Loja #${store.id}`}</option>))}
            </select>
          </div>
        )}
      </PageHeader>
      
      <PageContent>
        {loading && <p className="text-gray-500">{t('common.loading')}</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && !selectedStoreId && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center space-y-2">
            <h3 className="text-lg font-semibold">{t('dashboard.emptyTitle')}</h3>
            <p className="text-gray-500">{t('dashboard.emptyDesc')} <Link to="/app/stores" className="text-accent hover:underline">{t('dashboard.createFirst')}</Link>.</p>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              <KpiCard title="Violações Críticas" value={data.overview.violations.critical} icon={<AlertTriangle />} severity="critical" />
              <KpiCard title="Violações Graves" value={data.overview.violations.warning} icon={<AlertTriangle />} severity="major" />
              <KpiCard title="Itens Bloqueados" value={data.overview.items_blocked} icon={<Ban />} severity="info" />
              <KpiCard title="Score de Risco" value={`${data.overview.risk_score}%`} icon={<ShieldCheck />} severity={data.overview.risk_score > 50 ? 'critical' : 'ok'} />
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
              {/* Secção de Scans Recentes */}
              <Card>
                <SectionHeader title="Execuções Recentes" />
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody>
                      {data.latest_scans.map(scan => (
                        <tr key={scan.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><Badge variant={scan.status==='done'?'ok':scan.status==='running'?'info':scan.status==='queued'?'warning':'neutral'}>{scan.status}</Badge></td>
                          <td className="px-3 py-2"><Clock size={14} className="inline text-gray-500"/> {formatDate(scan.finished_at || scan.started_at)}</td>
                          <td className="px-3 py-2 text-right">
                            <Link to={`/app/stores/${selectedStoreId}/scans`} className="inline-flex items-center gap-1 text-accent dark:text-purple-300">
                              Detalhes <ArrowRight size={14}/>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Secção de Violações Recentes */}
              <Card>
                <SectionHeader title="Violações Recentes" />
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody>
                      {data.recent_violations.map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><Badge variant={v.severity==='critical'?'critical':v.severity==='warning'?'warning':'neutral'}>{v.severity}</Badge></td>
                          <td className="px-3 py-2 font-mono">{v.rule_code}</td>
                          <td className="px-3 py-2 font-mono">{v.feed_item_id}</td>
                           <td className="px-3 py-2 text-right">
                            <Link to={`/app/stores/${selectedStoreId}/violations`} className="inline-flex items-center gap-1 text-accent dark:text-purple-300">
                              Ver Todas <ArrowRight size={14}/>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageContent>
    </Page>
  );
}
