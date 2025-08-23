from app.services.feed_ingest import (
    extract_currency,
    canonicalize_link,
    normalize_gtin,
    clean_text,
)

def test_extract_currency():
    assert extract_currency("eur 19.90") == "EUR"
    assert extract_currency("USD") == "USD"
    assert extract_currency("19.90") is None

def test_canonicalize_link():
    url = "HTTP://Example.COM/Product?id=1&utm_source=x"
    assert canonicalize_link(url) == "http://example.com/Product?id=1"
    assert canonicalize_link("https://example.com") == "https://example.com/"

def test_normalize_gtin():
    assert normalize_gtin("4006381333931") == "4006381333931"
    assert normalize_gtin("4006381333932") is None

def test_clean_text():
    assert clean_text("  ACME   Corp  ") == "ACME Corp"
