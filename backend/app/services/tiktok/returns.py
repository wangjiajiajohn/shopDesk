"""Read-only return search. Never executes aftersales decisions."""
from .client import signed_request, TikTokAPIError

PENDING = {'RETURN_OR_REFUND_REQUEST_PENDING': '待审核退货退款', 'REPLACEMENT_REQUEST_PENDING': '待审核补发', 'EXCHANGE_REQUEST_PENDING': '待审核换货', 'PENDING_REQUEST_REVIEW': '待审核售后', 'PENDING_PACKAGE_REVIEW': '待验收退货包裹', 'BUYER_SHIPPED_ITEM': '买家已寄回，待跟进验收'}

async def fetch_pending_returns(token, cipher):
    rows, seen, page = {}, set(), ''
    for _ in range(200):
        query = {'page_size': 50}
        if page: query['page_token'] = page
        data = await signed_request('POST', '/return_refund/202602/returns/search', token, query=query, body={}, shop_cipher=cipher)
        batch = data.get('return_orders')
        if not isinstance(batch, list): raise TikTokAPIError('退货分页格式异常')
        for row in batch:
            rid = row.get('return_id')
            if not rid: raise TikTokAPIError('退货记录缺少编号')
            rows[rid] = row
        total = data.get('total_count')
        if isinstance(total, int) and len(rows) >= total: break
        page = data.get('next_page_token') or ''
        if not page: break
        if page in seen: raise TikTokAPIError('退货分页未推进')
        seen.add(page)
    else: raise TikTokAPIError('退货记录过多，分页未完成')
    items = []
    for row in rows.values():
        status = row.get('return_status', '')
        if status not in PENDING: continue
        items.append({'return_id': str(row['return_id']), 'order_id': str(row.get('order_id') or ''), 'status': status, 'status_label': PENDING[status], 'return_type': row.get('return_type'), 'created_at': row.get('create_time'), 'updated_at': row.get('update_time')})
    return sorted(items, key=lambda r: (r['created_at'] or 0, r['return_id'])), len(rows)
