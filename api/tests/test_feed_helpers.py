from app.services.feed_ingest import (
    clean_text,
    canonicalize_link,
    extract_currency,
    normalize_gtin,
)


def test_clean_text():
    assert clean_text("  ACME   Corp  ") == "ACME Corp"
    assert clean_text("\n\t") is None


def test_canonicalize_link():
    url = "HTTP://Example.COM/Product?id=1&utm_source=x&utm_medium=y"
    assert canonicalize_link(url) == "http://example.com/Product?id=1"
    # default path
    assert canonicalize_link("https://Example.com") == "https://example.com/"


def test_extract_currency():
    assert extract_currency("eur 19.90") == "EUR"
    assert extract_currency("10 usd") == "USD"
    assert extract_currency("19.90") is None


def test_normalize_gtin():
    # valid 13-digit with spaces/hyphens
    assert normalize_gtin("4006-3813 33931") == "4006381333931"
    # valid 8-digit
    assert normalize_gtin("12345670") == "12345670"
    # invalid check digit
    assert normalize_gtin("12345671") is None
    # invalid length
    assert normalize_gtin("1234567") is None
