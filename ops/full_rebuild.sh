# ops/full_rebuild.sh

#!/usr/bin/env bash
set -euo pipefail

# Carrega o arquivo .env, se existir
if [ -f .env ]; then
    set -a  # Exporta automaticamente todas as variáveis definidas
    source .env
    set +a
else
    echo "Erro: Arquivo .env não encontrado!"
    exit 1
fi

# Entra na raiz do repo (independente de onde você chamou)
cd "$(dirname "$0")/.."

# Derruba containers, volumes e faz prune do sistema
# Nota: o ambiente WordPress (docker-compose.wp.yml) é apenas derrubado, não reconstruído
echo "==> Down + prune…"
docker compose down -v --remove-orphans || true
docker compose -f docker-compose.wp.yml down -v || true
docker system prune -f
docker builder prune -f || true

# Constrói imagens da API, Worker e RQ workers
echo "==> Build das imagens…"
docker compose build api worker rq-feed rq-crawl

# Inicia db e redis
echo "==> Sobe db + redis e espera ficarem saudáveis…"
docker compose up -d db redis
sleep 5  # Dá tempo para os containers iniciarem antes do check

# Aguarda o banco de dados ficar saudável (usando healthcheck nativo, máx 60s)
echo "==> Esperando DB ficar saudável..."
max_wait=60
count=0
while [ "$(docker inspect -f '{{.State.Health.Status}}' gmc-shield-db-1 2>/dev/null)" != "healthy" ]; do
  if [ $count -gt $max_wait ]; then
    echo "Erro: Banco de dados não ficou saudável em $max_wait segundos!"
    docker compose logs db
    exit 1
  fi
  sleep 1
  count=$((count+1))
done

# Aguarda o Redis ficar saudável (alinhado com healthcheck, máx 30s)
echo "==> Esperando Redis ficar saudável..."
max_wait_redis=30
count_redis=0
while [ "$(docker inspect -f '{{.State.Health.Status}}' gmc-shield-redis-1 2>/dev/null)" != "healthy" ]; do
  if [ $count_redis -gt $max_wait_redis ]; then
    echo "Erro: Redis não ficou saudável em $max_wait_redis segundos!"
    docker compose logs redis
    exit 1
  fi
  sleep 1
  count_redis=$((count_redis+1))
done

# Inicia API, Worker e RQ workers
echo "==> Sobe API + Worker…"
docker compose up -d api worker
echo "==> Sobe workers RQ (feed + crawl)…"
docker compose up -d rq-feed rq-crawl

# Aguarda a API ficar pronta (loop até /healthz retornar OK, máx 60s)
echo "==> Esperando API ficar pronta..."
max_wait_api=60
count_api=0
while ! curl -sf http://localhost:8000/healthz | grep -q '"ok":'; do
  if [ $count_api -gt $max_wait_api ]; then
    echo "Erro: API não ficou pronta em $max_wait_api segundos!"
    docker compose logs api
    exit 1
  fi
  sleep 1
  count_api=$((count_api+1))
done

# Executa migrações do Alembic (depois do wait, para garantir conexão)
echo "==> Migrações Alembic…"
docker compose exec -T api alembic upgrade head

# Faz seed de usuários
echo "==> Seed de usuários (owner/manager/viewer @ demo)…"
docker compose exec -T api python -m app.scripts.seed_users

# Teste rápido de saúde da API (agora deve passar, pois há wait)
echo "==> Smoke rápido…"
curl -sf http://localhost:8000/healthz | grep -q '"ok":' && echo "healthz OK" || {
    echo "Erro: API /healthz não respondeu como esperado!"
    exit 1
}

# Exibe instruções finais
cat <<EOF

✅ Pronto. Frontend:
  cd web && npm i && printf 'VITE_API_BASE=http://localhost:8000\n' > .env.local && npm run dev -- --host

ℹ️ Log da API:  docker compose logs -f api
ℹ️ Health worker: curl -s http://localhost:8000/api/ops/worker/health | jq .
ℹ️ Logs RQ (feed):   docker compose logs -f rq-feed
ℹ️ Logs RQ (crawl):  docker compose logs -f rq-crawl
ℹ️ Para iniciar o ambiente WordPress (e o plugin local):
  docker compose -f docker-compose.wp.yml up -d

Dica ngrok (UI):
  ngrok http http://localhost:5173

Como o backend já aceita:
  ALLOWED_ORIGINS="$ALLOWED_ORIGINS"
  ALLOWED_ORIGIN_REGEX="$ALLOWED_ORIGIN_REGEX"
não precisa editar a API ao trocar o domínio do ngrok.
EOF
