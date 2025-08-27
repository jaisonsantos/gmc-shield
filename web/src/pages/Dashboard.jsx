// web/src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stores as Api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Page, PageHeader, PageContent } from '../components/Page';
import { AlertTriangle, ShieldCheck, Ban, Clock, ArrowRight } from 'lucide-react';

// Um componente simples para os cartões de KPI
const KpiCard = ({ title, value, icon, severity = 'info' }) => (
  <div className={`kpi-card ${severity}`}>
    <div className="kpi-icon">{icon}</div>
    <div className="kpi-content">
      <span className="kpi-value">{value}</span>
      <span className="kpi-title">{title}</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
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
        <div className="ph-left">
          <h2 style={{ margin: 0 }}>Dashboard</h2>
        </div>
        {stores.length > 1 && (
          <div className="ph-right">
            <select
              className="input"
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(Number(e.target.value))}
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name || `Loja #${store.id}`}</option>
              ))}
            </select>
          </div>
        )}
      </PageHeader>
      
      <PageContent>
        {loading && <p>A carregar dados do dashboard...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && !selectedStoreId && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <h3>Bem-vindo ao GMC Shield!</h3>
            <p className="muted">Parece que ainda não tem nenhuma loja. <Link to="/app/stores">Crie a sua primeira loja</Link> para começar.</p>
          </div>
        )}

        {data && (
          <div className="stack" style={{ gap: '24px' }}>
            {/* Secção de KPIs */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              <KpiCard title="Violações Críticas" value={data.overview.violations.critical} icon={<AlertTriangle />} severity="critical" />
              <KpiCard title="Violações Graves" value={data.overview.violations.warning} icon={<AlertTriangle />} severity="major" />
              <KpiCard title="Itens Bloqueados" value={data.overview.items_blocked} icon={<Ban />} severity="info" />
              <KpiCard title="Score de Risco" value={`${data.overview.risk_score}%`} icon={<ShieldCheck />} severity={data.overview.risk_score > 50 ? 'critical' : 'ok'} />
            </div>

            <div className="grid-2" style={{gap: '24px', alignItems: 'start'}}>
              {/* Secção de Scans Recentes */}
              <section className="card stack">
                <h3>Execuções Recentes</h3>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {data.latest_scans.map(scan => (
                        <tr key={scan.id}>
                          <td><span className={`status-pill ${scan.status}`}>{scan.status}</span></td>
                          <td><Clock size={14} className="muted"/> {formatDate(scan.finished_at || scan.started_at)}</td>
                          <td style={{textAlign: 'right'}}>
                            <Link to={`/app/stores/${selectedStoreId}/scans`} className="btn-link-action">
                              Detalhes <ArrowRight size={14}/>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Secção de Violações Recentes */}
              <section className="card stack">
                <h3>Violações Recentes</h3>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {data.recent_violations.map(v => (
                        <tr key={v.id}>
                          <td><span className={`severity-pill ${v.severity}`}>{v.severity}</span></td>
                          <td className="mono">{v.rule_code}</td>
                          <td className="mono">{v.feed_item_id}</td>
                           <td style={{textAlign: 'right'}}>
                            <Link to={`/app/stores/${selectedStoreId}/violations`} className="btn-link-action">
                              Ver Todas <ArrowRight size={14}/>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </PageContent>
    </Page>
  );
}