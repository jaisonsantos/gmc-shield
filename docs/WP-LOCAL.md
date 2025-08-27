maravilha!! segue o **WP-LOCAL.md** atualizado — é só colar no seu repo no lugar do antigo.

````markdown
# WordPress local (Docker) para testar o plugin **GMC Shield**

Este guia sobe um WordPress “limpo”, ativa o plugin **GMC Shield** e conecta no backend local (FastAPI) para sincronizar a blocklist.

> **Pré-requisitos**
>
> - Docker + Docker Compose
> - Sua API rodando em `http://localhost:8000` (o compose principal já expõe essa porta)
> - Portas livres: `8080` (WordPress) e `8081` (phpMyAdmin)

---

## 1) Subir o WordPress

Crie `docker-compose.wp.yml` com:

```yaml
services:
  wp:
    image: wordpress:6.5-php8.1-apache
    ports: ["8080:80"]
    environment:
      # Habilita Application Passwords em ambiente local (sem HTTPS)
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_ENVIRONMENT_TYPE', 'local');
      WORDPRESS_DB_HOST: dbwp
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp
      WORDPRESS_DB_NAME: wp
    volumes:
      # monta o plugin local dentro do WP
      - ./plugin-woo:/var/www/html/wp-content/plugins/gmc-shield
    # (Linux: se "host.docker.internal" não resolver, descomente abaixo)
    # extra_hosts:
    #   - "host.docker.internal:host-gateway"

  dbwp:
    image: mysql:8
    environment:
      MYSQL_DATABASE: wp
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp
      MYSQL_ROOT_PASSWORD: root
    # command: --default-authentication-plugin=mysql_native_password
    volumes:
      - dbwp_data:/var/lib/mysql

  phpmyadmin:
    image: phpmyadmin:latest
    ports: ["8081:80"]
    environment:
      PMA_HOST: dbwp

volumes:
  dbwp_data:
```
````

Suba:

```bash
docker compose -f docker-compose.wp.yml up -d
```

Abra `http://localhost:8080` e rode o instalador do WP:

1. Escolha o idioma → **Continuar**
2. Preencha:

   - **Site Title**: GMC Shield (ou o que preferir)
   - **Username**: `admin`
   - **Password**: sua senha
   - **Email**: seu email

3. **Install WordPress → Log in**

---

## 2) Ativar plugin e ajustar permalinks

1. **Plugins → GMC Shield → Ativar**
2. **Configurações → Links permanentes → “Nome do post” → Salvar**
3. Teste o REST base: abra `http://localhost:8080/wp-json` (deve responder um JSON)

---

## 3) Habilitar **Application Passwords** (auth no REST)

Com `WP_ENVIRONMENT_TYPE=local` no compose, a seção _Senhas da aplicação_ já aparece.

- Vá em **Usuários → Perfil → Senhas da aplicação**
- Em **Novo nome de senha da aplicação**, digite: `GMC Shield local` → **Adicionar senha de aplicativo**
- **Copie** a senha gerada (tem espaços!)

Teste (no terminal):

```bash
APP="COLE A SENHA (com espaços)"
curl -i -u admin:"$APP" "http://localhost:8080/wp-json/wp/v2/users/me"
```

Se retornar 200 com seus dados, a autenticação está ok.

> Dica: Para abrir no navegador (com cookie + nonce), a página de **Configurações → GMC Shield** inclui botões de teste; veja a seção 6.

---

## 4) Conectar o WordPress à API local

A partir do container do WP, seu host local é acessível por `http://host.docker.internal:8000` (se o WP rodar em outro container;
se rodar direto no host, use `http://localhost:8000`).

Confirme de dentro do container:

```bash
docker compose -f docker-compose.wp.yml exec wp curl -I http://host.docker.internal:8000/docs
```

No WordPress, abra **Configurações → GMC Shield** e preencha:

- **API URL:** `http://host.docker.internal:8000`
- **Store ID:** (pegaremos no próximo passo)
- **API Token:** (seu JWT **sem** o prefixo `Bearer `)
- **Intervalo (min):** 10 (ou o que preferir)

> Se estiver no Linux e `host.docker.internal` não resolver, use o `extra_hosts` do compose (comentado na seção 1).

---

## 5) Preparar a **Store** no backend e pegar o **Store ID**

### 5.1 Gerar um token (JWT)

Opção A — via endpoint (veja `/docs` da API):
`POST /auth/login` ou `POST /auth/token` → copie `access_token`.

Opção B — (atalho) gerar direto no container da API:

```bash
docker compose exec -T api python - <<'PY'
from app.auth import create_token
print(create_token("owner@gmcshield.dev", "owner", 1))
PY
```

Guarde o token (expira; gere de novo quando precisar).

### 5.2 Criar a loja

```bash
TOKEN="SEU_JWT"

curl -s -X POST http://localhost:8000/api/stores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Loja WP Local",
    "platform": "woocommerce",
    "base_url": "http://localhost:8080",
    "site_url": "http://localhost:8080",
    "country": "ES",
    "currency": "EUR",
    "timezone": "Europe/Madrid"
  }'
# resposta: {"id":1}
```

Pegue o `id`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/stores
# ex.: [{"id":1,"platform":"woocommerce",...}]
```

Coloque esse **id** em **Store ID** nas configurações do plugin e salve.
Cole também o **API Token** (o JWT).

### (Opcional) criar 1 bloqueio para teste

O schema exige `feed_item_id` (e opcionalmente `sku`):

```bash
STORE_ID=1
curl -s -X POST "http://localhost:8000/api/stores/$STORE_ID/blocks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feed_item_id":"SKU123","sku":"SKU123","reason":"manual_test"}'
```

---

## 6) Sincronizar e testar (UI e REST)

Abra **Configurações → GMC Shield**. Na seção **Testes rápidos**:

- **Abrir /blocklist no navegador** → abre `GET /wp-json/gmc-shield/v1/blocklist` com nonce (precisa estar logado)
- **Sincronizar agora (REST)** → faz `POST /wp-json/gmc-shield/v1/sync` e mostra o JSON de retorno

Também dá para testar por `curl` com a App Password:

```bash
APP="SUA APP PASSWORD DO WP"

# dispara a sync
curl -u admin:"$APP" -X POST "http://localhost:8080/wp-json/gmc-shield/v1/sync"

# vê a lista interna do WP
curl -u admin:"$APP" "http://localhost:8080/wp-json/gmc-shield/v1/blocklist"
```

Esperado: `last_sync > 0` e `items` contendo `["SKU123"]` (se criou o teste).

> `GET /wp-json/gmc-shield/v1/status` é público e serve como healthcheck rápido.

---

## 7) Troubleshooting

- **404 `rest_no_route`**
  Verifique se o namespace/rota batem com o registrado no plugin (`gmc-shield/v1`, rotas: `/status`, `/blocklist`, `/sync`).

- **401 `rest_forbidden` (mesmo logado em outra aba)**
  Para endpoints protegidos, use **Application Password** (ou cookie + nonce).
  `curl -u admin:"APP PASSWORD"` funciona; no navegador use os botões da página de configurações.

- **`items: []` ou `last_sync: 0`**

  - Confira se as opções (API URL/Store ID/Token) estão corretas.
  - Se o endpoint do backend retorna **lista pura** ou `{items:[...]}`, o plugin já trata ambos.
  - Verifique a API diretamente:
    `GET /api/stores/{id}/blocks` com `Authorization: Bearer ...`

- **WP não consegue falar com a API**

  - Use `http://host.docker.internal:8000` no campo **API URL**.
  - Em Linux, se não resolver, use `extra_hosts: ["host.docker.internal:host-gateway"]` no serviço `wp`.
  - Teste de dentro do container:
    `docker compose -f docker-compose.wp.yml exec wp curl -I http://host.docker.internal:8000/docs`

- **Token inválido**

  - O JWT expira; gere outro e atualize o campo **API Token**.

---

## 8) Resetar tudo

```bash
# derruba e apaga volumes do WP (não mexe na sua API)
docker compose -f docker-compose.wp.yml down -v

# (opcional) remover a App Password no WP: Usuários → Perfil → Senhas da aplicação
# (subir de novo)
docker compose -f docker-compose.wp.yml up -d
```

Pronto — com esse passo a passo, você sai do zero e valida o plugin inteiro (REST + cron + sync) em poucos minutos.

---

````markdown
# WordPress local (Docker) + integração GMC Shield (API + Plugin)

Guia de ponta a ponta para subir um WordPress local com o plugin **GMC Shield**, conectar a API local, salvar credenciais (App Password), publicar políticas e sincronizar bloqueios.

> Testado em macOS com Docker Desktop. Em Linux, veja a nota **host.docker.internal** abaixo.

---

## Visão geral

- **WP stack** (Docker): WordPress + MySQL + phpMyAdmin
- **API stack** (Docker): Postgres + Redis + FastAPI + Worker
- **Segredo necessário**: `FERNET_KEY` (usado para criptografar a App Password do WP)

---

## 0) Pré-requisitos

- Docker / Docker Desktop
- Node 18+ (para rodar o front local, opcional)
- Este repositório clonado

---

## 1) Subir o WordPress local

Use o `docker-compose.wp.yml` já presente no repo:

```bash
docker compose -f docker-compose.wp.yml up -d
```
````

Acesse: `http://localhost:8080`

### 1.1) Instalação inicial do WP

Siga o instalador padrão (Título do site, admin/senha, e-mail).

### 1.2) Ativar plugin e permalinks

- **Plugins → GMC Shield → Ativar**
- **Configurações → Links permanentes → “Nome do post” → Salvar**
- Teste a REST API do WP: `http://localhost:8080/wp-json` (deve responder JSON)

### 1.3) Criar **Application Password**

- **Usuários → Perfil → Senhas da aplicação**
- Nome: `GMC Shield local` → **Adicionar**
- **Copie a senha** (ex.: `MXTq dkzG gaAm IbYM Nbxa C6R9`)

> **Teste rápido (do host):**
>
> ```bash
> APP="SUA APP PASSWORD AQUI"
> curl -i -u admin:"$APP" http://localhost:8080/wp-json/wp/v2/users/me
> ```
>
> Deve retornar `200 OK` com os dados do usuário.

> **Linux (importante):** adicione a linha abaixo no serviço `wp` do `docker-compose.wp.yml`:
>
> ```yaml
> extra_hosts:
>   - "host.docker.internal:host-gateway"
> ```
>
> Isso permite que containers acessem serviços no host via `host.docker.internal`.

---

## 2) Subir a API/Worker e **gerar o FERNET_KEY**

A API precisa do `FERNET_KEY` para criptografar a App Password.

### 2.1) Gere a chave

No host (não precisa estar no container):

```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```

Copie a saída (ex.: `A0BGCIOK5WeZ_M3QxW9hS2vVl4lwhqW2sNiuMOV1GwA=`).

### 2.2) Coloque no `.env` (na raiz do repo)

```
FERNET_KEY=A0BGCIOK5WeZ_M3QxW9hS2vVl4lwhqW2sNiuMOV1GwA=
```

> Garanta também que `CORS_ORIGINS` inclui seus frontends, por exemplo:
>
> ```
> CORS_ORIGINS=http://localhost:5173,http://localhost:5174
> ```

### 2.3) Suba a stack da API

```bash
docker compose up -d db redis api worker
```

> Se já estava rodando, **recrie a API** para aplicar o `.env`:
>
> ```bash
> docker compose up -d --force-recreate api
> docker compose exec -T api printenv | grep FERNET_KEY
> # deve mostrar a chave
> ```

---

## 3) Criar um token (JWT) para a conta 1

```bash
docker compose exec -T api python - <<'PY'
from app.auth import create_token
print(create_token("owner@gmcshield.dev", "owner", 1))
PY

# exporte o token
TOKEN='COLE_O_TOKEN_IMPRESSO_AQUI'
```

Verifique:

```bash
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/whoami
# 200 OK com email/role/account_id
```

---

## 4) Criar uma loja (ou descobrir o ID)

Criar:

```bash
curl -s -X POST http://localhost:8000/api/stores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Loja WP Local",
    "platform": "woocommerce",
    "base_url": "http://localhost:8080",
    "site_url": "http://localhost:8080",
    "country": "ES",
    "currency": "EUR",
    "timezone": "Europe/Madrid"
  }'
# responde {"id":N}
```

Listar:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/stores
```

Defina:

```bash
STORE_ID=N
```

---

## 5) Salvar as credenciais do WP na loja

> **Importante:** dentro do **container da API**, o WP deve ser acessado por
> `http://host.docker.internal:8080` (Mac/Windows) ou via `extra_hosts` (Linux).

```bash
APP="SUA APP PASSWORD DO WP"
curl -i -X POST "http://localhost:8000/api/stores/$STORE_ID/wp/credentials" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wp_api_base": "http://host.docker.internal:8080/wp-json",
    "wp_base_url": "http://localhost:8080",
    "wp_user": "admin",
    "wp_app_password": "'"$APP"'"
  }'
# 200 {"ok": true}
```

---

## 6) Publicar uma política (opcional, via API)

```bash
curl -i -X POST "http://localhost:8000/api/stores/$STORE_ID/wp/policies/publish" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "refund",
    "content_md": "## Devolução em 30 dias\n\nDevolvemos sem custo em 30 dias.",
    "status": "publish"
  }'
# retorna page_id/page_url/version
```

---

## 7) Testar o plugin (REST)

```bash
# status "health"
curl -s http://localhost:8080/wp-json/gmc-shield/v1/status | jq

# blocklist (requer estar autenticado com App Password)
curl -s -u admin:"$APP" http://localhost:8080/wp-json/gmc-shield/v1/blocklist | jq
```

Se você adicionou um bloqueio na API:

```bash
curl -s -X POST "http://localhost:8000/api/stores/$STORE_ID/blocks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"feed_item_id":"SKU123","sku":"SKU123","reason":"manual_test"}'
```

Sincronize pelo plugin (se o endpoint `/sync` estiver no plugin) **ou** pela API:

```bash
curl -s -X POST "http://localhost:8000/api/stores/$STORE_ID/wp/blocks/sync" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8) Testar pela UI Web (opcional)

Suba o front:

```bash
cd web
npm install
npm run dev
```

Abra `http://localhost:5173`, vá em **Stores → <sua loja> → WP**,
preencha os campos e clique **Salvar & Testar**.
Se aparecer erro de CORS, adicione o origin no `CORS_ORIGINS` do `.env` e recrie a API.

---

## Troubleshooting

- **401 Unauthorized** em `/wp/credentials`: seu **JWT expirou**. Gere outro token (Seção 3).
- **`FERNET_KEY not set`**: faltou adicionar `FERNET_KEY` no `.env` e **recriar** a API (`--force-recreate`).
- **`rest_forbidden` no WP**: está chamando endpoint restrito **sem** App Password. Use `-u admin:"$APP"`.
- **`rest_no_route` no WP**: ative o plugin **e** deixe **Links permanentes** em “Nome do post”.
- **CORS no front**: inclua `http://localhost:5173` (ou seu domínio) em `CORS_ORIGINS`.
- **Linux / conexão WP a partir da API**: use `extra_hosts: ["host.docker.internal:host-gateway"]` no serviço `wp`.
- **Validar App Password do WP a partir do container da API**:

  ```bash
  docker compose exec -T api curl -i -u admin:"$APP" \
    http://host.docker.internal:8080/wp-json/wp/v2/users/me
  ```

  Deve retornar `200 OK`.

- **Logs (sem travar):**

  ```bash
  docker compose logs --tail=200 api
  # ou
  docker compose logs --since=10m api
  # ou
  docker logs $(docker compose ps -q api) --tail=200
  ```

---

## Checklist de sucesso

- [ ] `http://localhost:8080/wp-json` responde JSON
- [ ] App Password criada e testada com `/wp/v2/users/me`
- [ ] `FERNET_KEY` no `.env` e API recriada
- [ ] Token JWT válido (`/api/auth/whoami` = 200)
- [ ] `POST /api/stores/{id}/wp/credentials` = 200
- [ ] Política publicada (200 com `page_id`/`page_url`)
- [ ] `/wp-json/gmc-shield/v1/blocklist` mostra itens (quando houver)

````

### Sugestão de commit
```bash
git add docs/WP-LOCAL.md
git commit -m "docs: WP-LOCAL.md end-to-end — inclui FERNET_KEY, App Password, salvar credenciais, publish de políticas, testes e troubleshooting"
````
