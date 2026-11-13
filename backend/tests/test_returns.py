import unittest
from unittest.mock import patch
from app.services.tiktok.returns import fetch_pending_returns
from app.services.tiktok.client import TikTokAPIError

class ReturnsTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagination_filters_completed_waiting_and_keeps_pending(self):
        calls=[]
        async def request(method,path,token,**kwargs):
            self.assertEqual((method,path),('POST','/return_refund/202602/returns/search'))
            calls.append(kwargs['query'])
            statuses=['RETURN_OR_REFUND_REQUEST_COMPLETE','RETURN_OR_REFUND_REQUEST_PENDING'] if len(calls)==1 else ['AWAITING_BUYER_SHIP','BUYER_SHIPPED_ITEM']
            return {'return_orders':[{'return_id':s,'return_status':s} for s in statuses], 'total_count':4,'next_page_token':'next' if len(calls)==1 else 'still-present'}
        with patch('app.services.tiktok.returns.signed_request',request):
            rows,total=await fetch_pending_returns('test','test')
        self.assertEqual(total,4);self.assertEqual(len(rows),2)
        self.assertEqual(calls[1]['page_token'],'next');self.assertEqual(len(calls),2)

    async def test_total_reached_stops_despite_cursor(self):
        async def request(*args,**kwargs):
            return {'return_orders':[{'return_id':'done','return_status':'RETURN_OR_REFUND_REQUEST_COMPLETE'}], 'total_count':1, 'next_page_token':'present'}
        with patch('app.services.tiktok.returns.signed_request',side_effect=request) as call:
            rows,total=await fetch_pending_returns('test','test')
        self.assertEqual((rows,total),([],1));self.assertEqual(call.call_count,1)

    async def test_repeated_cursor_never_silently_truncates(self):
        async def request(*args,**kwargs):
            return {'return_orders':[{'return_id':'x'}], 'next_page_token':'same'}
        with patch('app.services.tiktok.returns.signed_request',request):
            with self.assertRaises(TikTokAPIError):await fetch_pending_returns('test','test')
