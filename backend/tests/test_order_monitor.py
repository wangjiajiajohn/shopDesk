import asyncio
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from fastapi import HTTPException
from app.database import Base
from app.models import Shop, ShopOrder
from app.services.order_monitor import classify_order
from app.services.tiktok.orders import normalize_order
from app.routers.tiktok_orders import order_monitor, list_shop_orders

NOW = 1800000000


def order(**kwargs):
    values = dict(status='AWAITING_SHIPMENT', rts_sla_time=NOW+3600,
                  tts_sla_time=NOW+86400, cancel_order_sla_time=None,
                  synced_at=datetime.fromtimestamp(NOW, timezone.utc))
    values.update(kwargs)
    return SimpleNamespace(**values)


class DeadlineTests(unittest.TestCase):
    def test_thresholds(self):
        for seconds, expected in [(86401,'on_track'), (86400,'due_soon'), (1,'due_soon'), (0,'overdue'), (-1,'overdue')]:
            self.assertEqual(classify_order(order(rts_sla_time=NOW+seconds),NOW)['risk'], expected)

    def test_collection_uses_collection_deadline(self):
        result = classify_order(order(status='AWAITING_COLLECTION',rts_sla_time=NOW-100,tts_sla_time=NOW+100000),NOW)
        self.assertEqual(result['stage'],'collection')
        self.assertEqual(result['risk'],'on_track')

    def test_missing_deadline_is_unknown_and_partial_stays_preparing(self):
        result = classify_order(order(status='PARTIALLY_SHIPPING',rts_sla_time=None),NOW)
        self.assertEqual((result['risk'], result['stage']),('unknown','preparing'))

    def test_cancellation_priority_and_stale(self):
        result = classify_order(order(cancel_order_sla_time=NOW+1,synced_at=datetime.fromtimestamp(NOW-1801,timezone.utc)),NOW)
        self.assertEqual(result['risk'],'cancellation')
        self.assertTrue(result['stale'])

    def test_normalize_sla_and_exclude_buyer(self):
        result = normalize_order(dict(id='123',rts_sla_time=str(NOW),tts_sla_time=0,cancel_order_sla_time='bad',buyer_email='private'))
        self.assertEqual(result['rts_sla_time'],NOW)
        self.assertIsNone(result['tts_sla_time'])
        self.assertIsNone(result['cancel_order_sla_time'])
        self.assertNotIn('buyer_email',result)


class IsolationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session = async_sessionmaker(self.engine,expire_on_commit=False)()
        self.session.add_all([
            Shop(id='own',user_id='owner',market_code='MX',shop_name='Own',tiktok_shop_id='1'),
            Shop(id='other',user_id='someone',market_code='MX',shop_name='Other',tiktok_shop_id='2'),
            ShopOrder(shop_id='own',tiktok_order_id='1',status='AWAITING_SHIPMENT'),
            ShopOrder(shop_id='own',tiktok_order_id='2',status='PARTIALLY_SHIPPING'),
            ShopOrder(shop_id='own',tiktok_order_id='3',status='AWAITING_COLLECTION'),
            ShopOrder(shop_id='own',tiktok_order_id='4',status='CANCELLED'),
            ShopOrder(shop_id='own',tiktok_order_id='5',status='UNPAID'),
            ShopOrder(shop_id='other',tiktok_order_id='6',status='AWAITING_SHIPMENT'),
        ])
        await self.session.commit()

    async def asyncTearDown(self):
        await self.session.close()
        await self.engine.dispose()

    async def test_account_isolation_counts_and_pagination(self):
        result = await order_monitor(shop_id=None,stage=None,page=1,page_size=2,db=self.session,user=SimpleNamespace(id='owner'))
        self.assertEqual(result['total'],3)
        self.assertEqual(len(result['items']),2)
        self.assertEqual(result['counts']['preparing'],2)
        self.assertEqual(result['counts']['collection'],1)
        self.assertTrue(all(i['shop_id']=='own' for i in result['items']))
        filtered = await order_monitor(shop_id=None,stage='collection',page=1,page_size=10,db=self.session,user=SimpleNamespace(id='owner'))
        self.assertEqual(filtered['total'],1)
        self.assertEqual(filtered['items'][0]['order_id'],'3')

    async def test_cannot_read_other_shop(self):
        with self.assertRaises(HTTPException) as error:
            await order_monitor(shop_id='other',stage=None,page=1,page_size=10,db=self.session,user=SimpleNamespace(id='owner'))
        self.assertEqual(error.exception.status_code,404)

    async def test_attention_list_all_shops_isolated_and_has_deadlines(self):
        result = await list_shop_orders(shop_id="ALL",status=None,keyword=None,page=1,page_size=20,needs_attention=True,db=self.session,user=SimpleNamespace(id="owner"))
        self.assertEqual(result["total"],3)
        self.assertEqual(result["attention_count"],3)
        self.assertTrue(all(row["shop_id"]=="own" for row in result["items"]))
        self.assertTrue(all(row["monitor"]["risk"]=="unknown" for row in result["items"]))
        with self.assertRaises(HTTPException):
            await list_shop_orders(shop_id="other",status=None,keyword=None,page=1,page_size=20,needs_attention=False,db=self.session,user=SimpleNamespace(id="owner"))
