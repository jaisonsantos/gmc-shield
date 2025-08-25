# api/app/services/crawler.py

import os
import json
import re
from typing import Dict, List

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

UA_GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
UA_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

def extract_structured_data(html: str) -> Dict:
    soup = BeautifulSoup(html, "html.parser")
    products: List[Dict] = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for obj in data:
                if isinstance(obj, dict) and obj.get("@type") == "Product":
                    products.append(obj)
        elif isinstance(data, dict) and data.get("@type") == "Product":
            products.append(data)
    if not products:
        return {}
    product = products[0]
    out: Dict = {"jsonld": product}
    if isinstance(product, dict):
        out["name"] = product.get("name")
        offers = product.get("offers")
        if isinstance(offers, dict):
            out["price"] = offers.get("price")
            out["currency"] = offers.get("priceCurrency")
            out["availability"] = offers.get("availability")
    return out

def extract_visible_signals(html: str) -> Dict:
    soup = BeautifulSoup(html, "html.parser")
    out: Dict = {}
    h1 = soup.find("h1")
    if h1:
        out["h1"] = h1.get_text(strip=True)
    price_tag = soup.select_one("[itemprop=price], meta[itemprop=price], .price, [data-price]")
    price_text = None
    if price_tag:
        price_text = price_tag.get("content") or price_tag.get_text()
    if price_text:
        m = re.search(r"(\d+[.,]\d{2})", price_text)
        if m:
            out["price"] = m.group(1).replace(",", ".")
        mcur = re.search(r"([A-Z]{3})", price_text)
        if mcur:
            out["currency"] = mcur.group(1)
    currency_tag = soup.select_one("[itemprop=priceCurrency]")
    if currency_tag and "currency" not in out:
        out["currency"] = currency_tag.get("content") or currency_tag.get_text()
    availability_tag = soup.select_one("[itemprop=availability]")
    if availability_tag:
        out["availability"] = availability_tag.get("content") or availability_tag.get_text()
    return out

def merge_extracted(visible: Dict, jsonld: Dict, ua_label: str) -> Dict:
    data: Dict = {"ua": ua_label}
    if "h1" in visible:
        data["h1"] = visible["h1"]
    for key in ("price", "currency", "availability"):
        data[key] = visible.get(key) or jsonld.get(key)
    if jsonld.get("jsonld"):
        data["jsonld"] = jsonld["jsonld"]
    return data

async def crawl_once(url: str, user_agent: str, timeout_ms: int = 20000) -> Dict:
    # opcional: rewrite de base para ambientes locais
    frm = os.getenv("CRAWLER_REWRITE_FROM")
    to  = os.getenv("CRAWLER_REWRITE_TO")
    if frm and to and url.startswith(frm):
        url = url.replace(frm, to, 1)
    label = "googlebot" if user_agent == UA_GOOGLEBOT else "chrome"
    result = {
        "status": None,
        "final_url": url,
        "redirect_chain": [],
        "html": "",
        "screenshot_bytes": b"",
        "extracted": {"ua": label},
    }
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=user_agent)
            page = await context.new_page()
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            except PlaywrightTimeoutError:
                result["extracted"]["error"] = "timeout"
                await browser.close()
                return result
            if response:
                result["status"] = response.status
                req = response.request
                chain: List[str] = []
                while req:
                    chain.append(req.url)
                    req = req.redirected_from
                result["redirect_chain"] = list(reversed(chain))
            result["final_url"] = page.url
            result["html"] = await page.content()
            result["screenshot_bytes"] = await page.screenshot(full_page=True)
            jsonld = extract_structured_data(result["html"])
            visible = extract_visible_signals(result["html"])
            result["extracted"] = merge_extracted(visible, jsonld, label)
            await browser.close()
    except Exception as exc:  # noqa: BLE001
        result["extracted"]["error"] = str(exc)
    return result
