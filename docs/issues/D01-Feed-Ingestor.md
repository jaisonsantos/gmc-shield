# D1 — Feed Ingestor (XML/CSV/TSV) + Versionamento
**Tipo:** feature • **Labels:** feed, backend • **Estimativa:** 1d

## Descrição
- Endpoint `POST /stores/{id}/feed` e leitura de URL/arquivo.
- Parse (id,title,link,price,sale_price,availability,brand,gtin,mpn,shipping).
- Normalização preço/moeda e limpeza de UTM.
- Hash/versionamento do feed e diffs básicos.

## Aceite
- [ ] Upload e URL funcionam.
- [ ] 60 itens importados do seed.
- [ ] `GET /feed/versions` lista historico com hash.
