import React from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function AppShell(){
  return (
    <div style={{fontFamily:'Inter, system-ui', display:'grid', gridTemplateColumns:'240px 1fr', minHeight:'100vh'}}>
      <aside style={{padding:'16px', borderRight:'1px solid #eee'}}>
        <h2>GMC Shield</h2>
        <nav style={{display:'grid', gap:8}}>
          <Link to="/">Dashboard</Link>
          <Link to="/stores">Stores</Link>
          <Link to="/policies">Policies</Link>
          <Link to="/appeals">Appeals</Link>
          <Link to="/notifications">Notifications</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/agency">Agency</Link>
          <Link to="/ops">Ops</Link>
        </nav>
      </aside>
      <main style={{padding:'24px'}}><Outlet /></main>
    </div>
  )
}
