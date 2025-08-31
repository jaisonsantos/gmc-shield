import React, { useEffect, useState } from "react";
import { Ops as Api } from "../lib/api";
import { useToast } from "../lib/toast";
import { useTranslation } from 'react-i18next';

export default function Ops(){
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const toast = useToast();
  const { t } = useTranslation();

  const load = async () => {
    setErr("");
    try {
      const d = await Api.workerHealth();
      setData(d);
    } catch(e) {
      setErr(e.message);
      toast.error(e.message || t('ops.healthFailed'));
    }
  };

  useEffect(()=> {
    load();
    const id = setInterval(load, 5000);  // auto refresh a cada 5s
    return () => clearInterval(id);
  }, []);

  if (err) return <div className="text-red-600 p-4">{err}</div>;
  if (!data) return <div className="p-4">{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('ops.workerHealth')}</h2>
      <div className="text-sm">{t('ops.queueLen')}: <b>{data.queue_len}</b></div>
      <div className="text-sm">
        {t('ops.metrics')}: published={data.metrics?.published||0}, processed={data.metrics?.processed||0}, failed={data.metrics?.failed||0}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('ops.lastTs')}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('ops.processed')}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('ops.queueSnap')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(data.workers||[]).map((w,i)=>(
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{w.host}</td>
                <td className="px-4 py-2">{w.ts}</td>
                <td className="px-4 py-2">{w.processed}</td>
                <td className="px-4 py-2">{w.queue_len}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={load} className="px-3 py-2 text-sm border rounded-md w-fit">{t('common.refresh')}</button>
    </div>
  );
}
