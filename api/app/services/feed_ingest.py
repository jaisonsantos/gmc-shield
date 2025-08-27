import csv
import hashlib
import io
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Iterable, Tuple

UTM_PATTERN = re.compile(r"^utm_|^gclid$|^fbclid$", re.I)


def clean_text(val: str | None) -> str | None:
    if not val:
        return None
    t = re.sub(r"\s+", " ", val).strip()
    return t or None


def extract_currency(s: str | None) -> str | None:
    if not s:
        return None
    m = re.search(r"([a-z]{3})", s, re.I)
    return m.group(1).upper() if m else None


def canonicalize_link(url: str | None) -> str | None:
    if not url:
        return None
    u = urllib.parse.urlsplit(url)
    qs = urllib.parse.parse_qsl(u.query, keep_blank_values=False)
    qs = [(k, v) for (k, v) in qs if not UTM_PATTERN.match(k)]
    scheme = u.scheme.lower()
    host = u.netloc.lower()
    path = u.path or "/"
    return urllib.parse.urlunsplit(
        (scheme, host, path, urllib.parse.urlencode(qs), "")
    )


def normalize_gtin(val: str | None) -> str | None:
    if not val:
        return None
    digits = re.sub(r"\D", "", val)
    if len(digits) not in (8, 12, 13, 14):
        return None
    total = sum(
        int(d) * (3 if (len(digits) - i) % 2 == 0 else 1)
        for i, d in enumerate(digits[:-1])
    )
    check = (10 - total % 10) % 10
    return digits if check == int(digits[-1]) else None

def parse_price(val: str | None) -> Tuple[int | None, str | None]:
    if val is None:
        return None, None
    s = str(val).strip()
    cur = None
    parts = re.findall(r"[A-Za-z]{3}", s)
    if parts:
        cur = parts[0].upper()
    num = re.sub(r"[^\d,.\-]", "", s).replace(",", ".")
    if num.count(".") > 1:
        head, tail = num.rsplit(".", 1)
        num = head.replace(".", "") + "." + tail
    cents = int(round(float(num) * 100))
    return cents, cur

def availability_norm(val: str) -> str:
    v = (val or "").lower()
    if "out" in v or "unavailable" in v:
        return "out_of_stock"
    if "pre" in v:
        return "preorder"
    if "back" in v:
        return "backorder"
    return "in_stock"

def parse_csv(buf: bytes, delimiter=",") -> Iterable[dict]:
    text = buf.decode("utf-8", errors="replace")
    rdr = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    for r in rdr:
        yield r

def parse_xml(buf: bytes) -> Iterable[dict]:
    root = ET.fromstring(buf)
    for it in root.iterfind(".//item"):
        def g(tag):
            n = it.find(tag)
            return n.text if n is not None else None
        yield {
            "id": g("g:id") or g("id"),
            "title": g("title"),
            "link": g("link"),
            "price": g("g:price") or g("price"),
            "sale_price": g("g:sale_price") or g("sale_price"),
            "availability": g("g:availability") or g("availability"),
            "brand": g("g:brand") or g("brand"),
            "gtin": g("g:gtin") or g("gtin"),
            "mpn": g("g:mpn") or g("mpn"),
            "shipping": g("g:shipping") or None,
        }

def normalize_row(r: dict) -> dict:
    item_id = r.get("id") or r.get("item_id") or r.get("sku")
    p, _cur = parse_price(r.get("price"))
    sp, _ = parse_price(r.get("sale_price"))
    price_currency = extract_currency(r.get("price_currency") or r.get("price"))
    shipping = r.get("shipping")
    if isinstance(shipping, (dict, list)):
        shipping_json = json.dumps(shipping)
    elif shipping:
        shipping_json = json.dumps({"raw": shipping})
    else:
        shipping_json = None
    return {
        "item_id": str(item_id),
        "title": clean_text(r.get("title")),
        "link_canonical": canonicalize_link(r.get("link")),
        "price_cents": p,
        "sale_price_cents": sp,
        "currency": price_currency,
        "availability": availability_norm(r.get("availability")),
        "brand": clean_text(r.get("brand")),
        "gtin": normalize_gtin(r.get("gtin")),
        "mpn": clean_text(r.get("mpn")),
        "shipping_json": shipping_json,
        "raw_json": json.dumps(r, ensure_ascii=False),
    }

def compute_hash(raw: bytes, origin: str = "") -> str:
    h = hashlib.sha256()
    h.update(raw)
    if origin:
        h.update(origin.encode("utf-8"))
    return h.hexdigest()
