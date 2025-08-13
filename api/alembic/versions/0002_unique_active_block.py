# api/alembic/versions/0002_unique_active_block.py
from alembic import op

revision = "0002_unique_active_block"
down_revision = "0001_init"

def upgrade():
    # 1) Desativar duplicados ativos mantendo o mais recente por (store_id, feed_item_id)
    op.execute("""
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY store_id, feed_item_id
               ORDER BY id DESC
             ) AS rn
      FROM blocks
      WHERE active IS TRUE
    )
    UPDATE blocks b
       SET active = FALSE
      FROM ranked r
     WHERE b.id = r.id
       AND r.rn > 1;
    """)

    # 2) Índice único parcial: só permite 1 block ativo por (store_id, feed_item_id)
    op.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_active_block
      ON blocks (store_id, feed_item_id)
      WHERE active IS TRUE;
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_active_block;")
