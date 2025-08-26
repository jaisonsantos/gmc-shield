# api/alembic/env.py

from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
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
