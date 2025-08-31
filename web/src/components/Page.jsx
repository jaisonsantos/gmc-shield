// web/src/components/Page.jsx
export function Page({ children }) {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {children}
    </div>
  );}

export function PageHeader({ children }) {
  return (
    <header className="flex items-center mb-4 md:mb-6 gap-3">
      {children}
    </header>
  );}

export function PageContent({ children }) {
  return <div>{children}</div>;
}

export default Page;
