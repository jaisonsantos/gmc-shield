import { useState, useEffect } from "react";

export default function Settings() {
  const [accounts, setAccounts] = useState(null);
  const [merchant, setMerchant] = useState("");
  const [products, setProducts] = useState(null);

  useEffect(() => {
    fetch("/api/google/mc/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccounts(data);
      });
  }, []);

  const connect = () => {
    window.location.href = "/api/auth/google/start-content?return_to=/settings";
  };

  const chooseMerchant = async (id) => {
    setMerchant(id);
    await fetch("/api/stores/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_merchant_id: id }),
    });
    const res = await fetch(`/api/google/mc/${id}/products`);
    if (res.ok) setProducts(await res.json());
  };

  return (
    <div>
      <h1>Settings</h1>
      <div>
        <h2>Google Merchant Center</h2>
        {!accounts && <button onClick={connect}>Conectar Merchant Center</button>}
        {accounts && (
          <div>
            <select value={merchant} onChange={(e) => chooseMerchant(e.target.value)}>
              <option value="">Selecione merchant</option>
              {accounts.accountIdentifiers?.map((a) => (
                <option key={a.merchantId} value={a.merchantId}>
                  {a.merchantId}
                </option>
              ))}
            </select>
          </div>
        )}
        {products && <pre>{JSON.stringify(products, null, 2)}</pre>}
      </div>
    </div>
  );
}