import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app import models
from app.models import Base
from app.routers.feeds import _ingest_raw


def sqlite_now():
    return datetime.datetime.utcnow().isoformat()


def make_session():
    engine = create_engine("sqlite:///:memory:")
    @event.listens_for(engine, "connect")
    def connect(dbapi_connection, connection_record):
        dbapi_connection.create_function("now", 0, sqlite_now)
    Base.metadata.create_all(engine, tables=[
        models.Store.__table__,
        models.Feed.__table__,
        models.FeedVersion.__table__,
        models.FeedItem.__table__,
    ])
    return sessionmaker(bind=engine)()


def test_ingest_idempotent():
    db = make_session()
    feed = models.Feed(store_id=1, source_type="file", format="csv")
    db.add(feed)
    db.commit()
    raw = b"id,title,price\n1,Item,9.99 USD\n"
    res1 = _ingest_raw(db, 1, feed, raw, "csv", "upload")
    assert res1["items_imported"] == 1
    assert res1["items_count"] == 1
    assert feed.last_item_count == 1
    hash1 = res1["content_hash"]
    res2 = _ingest_raw(db, 1, feed, raw, "csv", "upload")
    assert res2["items_imported"] == 0
    assert res2.get("skipped") == "same-hash"
    assert res2["content_hash"] == hash1
    db.close()
