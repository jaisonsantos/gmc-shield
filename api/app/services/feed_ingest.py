import csv, hashlib, io, json, re, urllib.parse
import xml.etree.ElementTree as ET
from typing import Iterable, Tuple

UTM_PATTERN = re.compile(r"^utm_|^gclid$|^fbclid$", re.I)

def canonicalize_link(url: str) -> str:
    if not url:
        return url
    u = urllib.parse.urlsplit(url)
    qs = urllib.parse.parse_qsl(u.query, keep_blank_values=False)
    qs = [(k, v) for (k, v) in qs if not UTM_PATTERN.match(k)]
    return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, urllib.parse.urlencode(qs), u.fragment))

def parse_price(val: str) -> Tuple[int, str]:
    if val is None:
        return None, None
    s = str(val).strip()
    cur = None
    parts = re.findall(r"[A-Z]{3}", s)
    if parts:
        cur = parts[0]
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
    p, cur = parse_price(r.get("price"))
    sp, _ = parse_price(r.get("sale_price"))
    shipping = r.get("shipping")
    if isinstance(shipping, (dict, list)):
        shipping_json = json.dumps(shipping)
    elif shipping:
        shipping_json = json.dumps({"raw": shipping})
    else:
        shipping_json = None
    return {
        "item_id": str(item_id),
        "title": r.get("title"),
        "link_canonical": canonicalize_link(r.get("link")),
        "price_cents": p,
        "sale_price_cents": sp,
        "currency": cur,
        "availability": availability_norm(r.get("availability")),
        "brand": r.get("brand"),
        "gtin": r.get("gtin"),
        "mpn": r.get("mpn"),
        "shipping_json": shipping_json,
        "raw_json": json.dumps(r, ensure_ascii=False),
    }

def compute_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()
