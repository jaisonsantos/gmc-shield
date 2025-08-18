// web/src/pages/WP.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Textarea from "../components/Textarea";
import { Page, PageHeader, PageContent } from "../components/Page";

export default function WP() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ url: "", key: "", template: "" });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const cancel = () => navigate(id ? `/stores/${id}` : "/stores");
  const submit = (e) => {
    e.preventDefault();
    // TODO: save & test
  };

  return (
    <Page>
      <PageHeader>
        <a href={id ? `/stores/${id}` : "/stores"}>Voltar</a>
      </PageHeader>
      <PageContent>
        <form onSubmit={submit}>
          <div className="section">
            <div className="grid-2">
              <div>
                <label>API URL</label>
                <Input value={form.url} onChange={update("url")} />
              </div>
              <div>
                <label>API Key</label>
                <Input value={form.key} onChange={update("key")} />
              </div>
            </div>
          </div>

          <div className="section">
            <div>
              <label>Template</label>
              <Textarea value={form.template} onChange={update("template")} />
            </div>
          </div>

          <div
            className="action-bar"
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              padding: 16,
              borderTop: "1px solid var(--line)",
              background: "#fff",
            }}
          >
            <Button type="submit">Salvar & Testar</Button>
            <Button type="button" onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </PageContent>
    </Page>
  );
}
