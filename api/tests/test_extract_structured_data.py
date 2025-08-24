from app.services import crawler


def test_extract_structured_data_product():
    html = """
    <html><head>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org",
      "@type": "Product",
      "name": "Widget",
      "offers": {"price": "9.99", "priceCurrency": "USD", "availability": "InStock"}
    }
    </script>
    </head></html>
    """
    data = crawler.extract_structured_data(html)
    assert data["price"] == "9.99"
    assert data["currency"] == "USD"
    assert data["availability"] == "InStock"
    assert data["jsonld"]["name"] == "Widget"
