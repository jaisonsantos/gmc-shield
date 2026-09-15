# Migration from Content API v2.1 to Merchant API v1

## Overview

**Timeline:** Google deprecated the Content API for Shopping on August 18, 2026. Since September 1, 2026, projects without extension grants have experienced intermittent `HTTP 410 Gone` failures. Full shutdown is planned for early 2027.

**Status:** GMC Shield has been migrated to use the Merchant API v1, which is the official replacement.

## Changes Made

### 1. Settings

Added new environment variable:
```python
GOOGLE_MERCHANT_API_BASE: str = "https://merchantapi.googleapis.com"
```

This separate base URL is necessary because:
- OAuth userinfo still uses `GOOGLE_API_BASE` (`/oauth2/v3/userinfo`)
- Merchant API uses a different hostname

### 2. Endpoint Changes

#### Accounts Listing
**Old (Content API v2.1):**
```
GET {GOOGLE_API_BASE}/content/v2.1/accounts/authinfo
```

**New (Merchant API v1):**
```
GET {GOOGLE_MERCHANT_API_BASE}/accounts/v1/accounts
```

Response format changed:
```json
// New format
{
  "accounts": [
    {
      "name": "accounts/123456789",
      "displayName": "My Store"
    }
  ]
}
```

#### Products Listing
**Old (Content API v2.1):**
```
GET {GOOGLE_API_BASE}/content/v2.1/{merchant_id}/products?maxResults=50&pageToken=...
```

**New (Merchant API v1):**
```
GET {GOOGLE_MERCHANT_API_BASE}/products/v1/accounts/{merchant_id}/products?pageSize=50&pageToken=...
```

**Parameter Changes:**
- `maxResults` → `pageSize` (Merchant API standard)
- Response key changed: `resources` → `products`

Response format changed:
```json
// New format
{
  "products": [
    {
      "name": "accounts/123/products/en~US~SKU123",
      "offerId": "SKU123",
      "productAttributes": {
        "title": "Product Title",
        "link": "https://example.com/product",
        "availability": "IN_STOCK",
        "price": {
          "amountMicros": "1599000000",
          "currencyCode": "USD"
        },
        "salePrice": {
          "amountMicros": "1299000000",
          "currencyCode": "USD"
        },
        "brand": "Brand Name",
        "gtin": "1234567890123",
        "mpn": "MPN-123",
        "shipping": [...]
      }
    }
  ]
}
```

### 3. Data Type Changes

#### Price Handling
**Old:** Price as string with decimal point
- `price.value: "10.00"` (string)
- `price.currency: "USD"`
- Stored in cents: `int(float("10.00") * 100)` = `1000`

**New:** Price in micros (millionths of currency unit)
- `price.amountMicros: "1000000000"` (string, value in micros)
- `price.currencyCode: "USD"`
- Stored in cents: `int(1000000000) // 10_000` = `1000`

Conversion formula:
```python
cents = amount_micros // 10_000
```

### 4. Field Mapping

| Content API v2.1 | Merchant API v1 |
|---|---|
| `resources` (array) | `products` (array) |
| `p.offerId` or `p.id` | `p.offerId` |
| `p.title` | `p.productAttributes.title` |
| `p.link` | `p.productAttributes.link` |
| `p.availability` | `p.productAttributes.availability` |
| `p.price.value` | `p.productAttributes.price.amountMicros` |
| `p.price.currency` | `p.productAttributes.price.currencyCode` |
| `p.salePrice.value` | `p.productAttributes.salePrice.amountMicros` |
| `p.brand` | `p.productAttributes.brand` |
| `p.gtin` | `p.productAttributes.gtin` |
| `p.mpn` | `p.productAttributes.mpn` |
| `p.shipping` | `p.productAttributes.shipping` |

### 5. OAuth & Authentication

**Good news:** OAuth scope and token handling remain unchanged.
- Scope: `https://www.googleapis.com/auth/content` (same)
- Access token and refresh token flow: identical
- No additional Developer Registration steps required at the API call level

**Note:** Google recommends registering your Merchant Center account with your Google Cloud project via:
```
POST https://merchantapi.googleapis.com/accounts/v1/accounts/{ACCOUNT_ID}/developerRegistration:registerGcp
```
This is optional but recommended for production deployments.

## Code Changes Summary

### New Helper Function

```python
def _extract_product_attributes(product: dict) -> dict:
    """
    Normalize product data from Merchant API v1 format.
    Handles field mapping and price unit conversion.
    """
```

### Updated Endpoints

- `GET /api/google/mc/accounts` - calls Merchant API v1
- `GET /api/google/mc/{merchant_id}/products` - calls Merchant API v1, uses `pageSize`
- `POST /api/google/mc/{merchant_id}/import` - parses new format, converts amountMicros to cents

### Tests Updated

All tests in `test_google_content_api.py` have been updated to:
- Mock Merchant API v1 response format
- Test amountMicros to cents conversion
- Verify productAttributes nesting
- Use correct endpoint URLs

## Backward Compatibility

**Breaking Changes:**
- Response format changed (clients expecting `resources` key must update to `products`)
- Price data structure changed (`price.value` → `price.amountMicros`)
- Parameter name changed in API calls (`maxResults` → `pageSize`)

**Database:**
- No schema changes required
- Existing FeedItem data continues to work (price_cents format unchanged)

## Testing & Validation

Run tests with:
```bash
pytest api/tests/test_google_content_api.py -v
```

Key test scenarios:
1. Accounts listing returns Merchant API format
2. Products listing with pagination
3. Price conversion (amountMicros → cents)
4. Product import with new response structure
5. Feed versioning (content_hash calculation)

## References

- [Merchant API v1 Documentation](https://developers.google.com/merchant/api)
- [Migration Guide](https://developers.google.com/merchant/api/guides/compatibility/overview)
- [Products API Reference](https://developers.google.com/merchant/api/guides/compatibility/products)
