"""
Quotation pricing. All amounts are computed here from the product catalogue —
client-supplied prices or totals are never read.

Per line:  subtotal = unitPrice × qty
           discount = subtotal × discountPct / 100   (capped per role)
           tax      = (subtotal − discount) × taxRatePct / 100
Product taxRatePct (if set on the product) overrides settings.quotation.defaultTaxRatePct.
"""
from decimal import Decimal

from lib.db import table
from lib.settings import get_setting
from lib.util import HttpError, money, to_decimal

MAX_ITEMS = 50


def calculate(items: list, delivery_charge, role: str) -> dict:
    cfg = get_setting('quotation')
    if not isinstance(items, list) or not items:
        raise HttpError(400, 'Add at least one product')
    if len(items) > MAX_ITEMS:
        raise HttpError(400, f'At most {MAX_ITEMS} products per quotation')
    max_disc = Decimal(str(cfg['maxDiscountPctByRole'].get(role, 0)))
    default_tax = Decimal(str(cfg['defaultTaxRatePct'] or 0))

    lines, seen = [], set()
    subtotal = discount_total = tax_total = Decimal('0')
    max_line_disc = Decimal('0')
    warnings = []
    for raw in items:
        pid = (raw or {}).get('productId')
        if not isinstance(pid, str) or not pid:
            raise HttpError(400, 'Each item needs a productId')
        if pid in seen:
            raise HttpError(400, 'A product appears more than once — combine the quantities')
        seen.add(pid)
        product = table('products').get_item(Key={'productId': pid}).get('Item')
        if not product or product.get('isActive') is False:
            raise HttpError(400, 'A selected product is no longer available')
        qty = to_decimal(raw.get('quantity'), 'quantity', minimum='0.01', maximum=100000)
        disc_pct = to_decimal(raw.get('discountPct') or 0, 'discountPct', minimum=0, maximum=100)
        if disc_pct > max_disc:
            raise HttpError(403, f'Your discount limit is {max_disc}%')
        tax_pct = Decimal(str(product['taxRatePct'])) if product.get('taxRatePct') is not None else default_tax

        unit_price = money(product.get('price'))
        line_sub = money(unit_price * qty)
        line_disc = money(line_sub * disc_pct / 100)
        line_tax = money((line_sub - line_disc) * tax_pct / 100)
        line_total = line_sub - line_disc + line_tax
        subtotal += line_sub
        discount_total += line_disc
        tax_total += line_tax
        max_line_disc = max(max_line_disc, disc_pct)
        stock = product.get('stock')
        if stock is not None and Decimal(str(stock)) < qty:
            warnings.append(f"Only {stock} {product.get('unit', '')} of {product['name']} in stock")
        lines.append({
            'productId': pid,
            'name': product['name'],
            'description': (product.get('description') or '')[:300],
            'unit': product.get('unit', ''),
            'quantity': qty,
            'unitPrice': unit_price,
            'discountPct': disc_pct,
            'discountAmount': line_disc,
            'taxRatePct': tax_pct,
            'taxAmount': line_tax,
            'subtotal': line_sub,
            'lineTotal': line_total,
        })

    delivery = money(to_decimal(delivery_charge or 0, 'deliveryCharge', minimum=0, maximum=10000000))
    grand = subtotal - discount_total + tax_total + delivery
    requires_approval = role in cfg['approvalRequiredForRoles'] or \
        max_line_disc > Decimal(str(cfg['approvalDiscountPct']))
    return {
        'items': lines,
        'subtotal': money(subtotal),
        'discountTotal': money(discount_total),
        'taxTotal': money(tax_total),
        'deliveryCharge': delivery,
        'grandTotal': money(grand),
        'requiresApproval': requires_approval,
        'warnings': warnings,
    }
