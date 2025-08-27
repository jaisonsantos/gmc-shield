import React from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function AppShell(){
  return (
    <div style={{fontFamily:'Inter, system-ui', display:'grid', gridTemplateColumns:'240px 1fr', minHeight:'100vh'}}>
      <aside style={{padding:'16px', borderRight:'1px solid #eee'}}>
        <h2>GMC Shield</h2>
          <nav style={{display:'grid', gap:8}}>
            <Link to="/app/dashboard">Dashboard</Link>
            <Link to="/app/stores">Stores</Link>
            <Link to="/app/policies">Policies</Link>
            <Link to="/app/appeals">Appeals</Link>
            <Link to="/app/notifications">Notifications</Link>
            <Link to="/app/settings">Settings</Link>
            <Link to="/app/billing">Billing</Link>
            <Link to="/app/agency">Agency</Link>
            <Link to="/app/ops">Ops</Link>
          </nav>
      </aside>
      <main style={{padding:'24px'}}><Outlet /></main>
    </div>
  )
}
