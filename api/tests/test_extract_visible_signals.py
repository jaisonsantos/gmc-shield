from app.services import crawler


def test_extract_visible_signals_basic():
    html = """
    <html><body>
    <h1>Great Product</h1>
    <span class="price">USD 12.50</span>
    <link itemprop="priceCurrency" content="USD"/>
    <div itemprop="availability">InStock</div>
    </body></html>
    """
    data = crawler.extract_visible_signals(html)
    assert data["h1"] == "Great Product"
    assert data["price"] == "12.50"
    assert data["currency"] == "USD"
    assert data["availability"] == "InStock"
