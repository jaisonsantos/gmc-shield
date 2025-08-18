// web/src/components/Page.jsx
export function Page({ children }) {
  return (
    <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      {children}
    </div>
  );
}

export function PageHeader({ children }) {
  return (
    <header style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
      {children}
    </header>
  );
}

export function PageContent({ children }) {
  return <div>{children}</div>;
}

export default Page;
