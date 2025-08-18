import React, { useEffect, useState } from "react";
import { Ops as Api } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Ops(){
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const toast = useToast();

  const load = async () => {
    setErr("");
    try {
      const d = await Api.workerHealth();
      setData(d);
    } catch(e) {
      setErr(e.message);
      toast.error(e.message || "Falha ao carregar health");
    }
  };

  useEffect(()=> {
    load();
    const id = setInterval(load, 5000);  // auto refresh a cada 5s
    return () => clearInterval(id);
  }, []);

  if (err) return <div style={{color:"crimson"}}>{err}</div>;
  if (!data) return <div>Carregando…</div>;

  return (
    <div>
      <h2>Worker Health</h2>
      <div style={{margin:"8px 0"}}>Queue len: <b>{data.queue_len}</b></div>
      <div style={{margin:"8px 0"}}>
        Metrics: published={data.metrics?.published||0}, processed={data.metrics?.processed||0}, failed={data.metrics?.failed||0}
      </div>
      <table width="100%" cellPadding="8" style={{borderCollapse:"collapse"}}>
        <thead>
          <tr style={{borderBottom:"1px solid #eee", textAlign:"left"}}>
            <th>Host</th><th>Last TS (UTC)</th><th>Processed</th><th>Queue (snap)</th>
          </tr>
        </thead>
        <tbody>
          {(data.workers||[]).map((w,i)=>(
            <tr key={i} style={{borderBottom:"1px solid #f3f3f3"}}>
              <td>{w.host}</td><td>{w.ts}</td><td>{w.processed}</td><td>{w.queue_len}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={load} style={{marginTop:12}}>Recarregar</button>
    </div>
  );
}
