# api/alembic/env.py

from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# Ensure app modules are importable when running Alembic from /api
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables from .env automatically for local dev
try:
    from dotenv import load_dotenv  # type: ignore

    API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    REPO_ROOT = os.path.abspath(os.path.join(API_DIR, '..'))
    # Try repo root .env first, then /api/.env, without overriding existing envs
    for candidate in (
        os.path.join(REPO_ROOT, '.env'),
        os.path.join(API_DIR, '.env'),
        os.path.join(os.getcwd(), '.env'),
    ):
        if os.path.exists(candidate):
            load_dotenv(candidate, override=False)
except Exception:
    # dotenv is optional in production; ignore if unavailable
    pass

from app.db import Base  # noqa
from app import models  # noqa
config = context.config
target_metadata = Base.metadata

def run_migrations_offline():
    url = os.environ.get("DATABASE_URL")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = os.environ.get("DATABASE_URL")
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
