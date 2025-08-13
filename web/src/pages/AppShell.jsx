import React from 'react'
import { Link } from 'react-router-dom'
export default function App({ children }){
  return (
    <div style={{fontFamily:'Inter, system-ui', display:'grid', gridTemplateColumns:'240px 1fr', minHeight:'100vh'}}>
      <aside style={{padding:'16px', borderRight:'1px solid #eee'}}>
        <h2>GMC Shield</h2>
        <nav style={{display:'grid', gap:8}}>
          <Link to="/">Dashboard</Link>
          <Link to="/violations">Violations</Link>
          <Link to="/items">Items</Link>
          <Link to="/policies">Policies</Link>
          <Link to="/appeals">Appeals</Link>
          <Link to="/feeds">Feeds</Link>
          <Link to="/scans">Scans</Link>
          <Link to="/notifications">Notifications</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/agency">Agency</Link>
        </nav>
      </aside>
      <main style={{padding:'24px'}}>{children}</main>
    </div>
  )
}