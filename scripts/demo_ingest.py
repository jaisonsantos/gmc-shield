import asyncio
import os
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys

repo_root = Path(__file__).resolve().parents[1]
sys.path.append(str(repo_root / "api"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app import models
from app.models import Base
from app.routers.feeds import _ingest_raw


def main():
    # in-memory SQLite DB
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[
        models.Store.__table__,
        models.Feed.__table__,
        models.FeedVersion.__table__,
        models.FeedItem.__table__,
    ])
    Session = sessionmaker(bind=engine)
    db = Session()

    store = models.Store(account_id=1, platform='woo', base_url='http://example.com')
    db.add(store)
    db.flush()
    feed = models.Feed(store_id=store.id, source_type='file', format='csv')
    db.add(feed)
    db.commit()

    # ingest from file (>=60 items)
    csv_path = repo_root / 'docs/seed/demo_feed.csv'
    raw = csv_path.read_bytes()
    _ingest_raw(db, store.id, feed, raw, 'csv', 'upload:' + csv_path.name)

    # serve same file over HTTP and ingest via URL
    os.chdir(repo_root)
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args, **kwargs):
            pass
    server = HTTPServer(('127.0.0.1', 8001), Handler)
    t = threading.Thread(target=server.serve_forever)
    t.daemon = True
    t.start()
    async def ingest_url():
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get('http://127.0.0.1:8001/docs/seed/demo_feed.csv')
            _ingest_raw(db, store.id, feed, r.content, 'csv', str(r.url))
    try:
        asyncio.run(ingest_url())
    finally:
        server.shutdown()

    versions = db.query(models.FeedVersion).count()
    print('versions:', versions, 'last_item_count:', feed.last_item_count)


if __name__ == '__main__':
    main()
