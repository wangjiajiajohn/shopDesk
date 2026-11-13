"""Creation settings persistence tests on an isolated database; no real account writes."""
import unittest
from types import SimpleNamespace
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models import ProductCreationConfig
from app.routers.creation_configs import SaveConfig, save_config, read_config

class CreationConfigTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        async with self.engine.begin() as conn:
            await conn.execute(text('CREATE TABLE source_products (id TEXT PRIMARY KEY,user_id TEXT)'))
            await conn.run_sync(ProductCreationConfig.__table__.create)
            await conn.execute(text("INSERT INTO source_products VALUES ('p1','owner1')"))
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.user = SimpleNamespace(id='owner1')
        self.config = dict(stock=20, weight=200, depth=10, height=5, width=10,
                           schemes=[{'id':'first','reference':{'id':'ref1'}},{'id':'second'}],
                           selectedFunctions=['聚拢'], supplementalRequirements='保留原结构')
    async def asyncTearDown(self):
        await self.engine.dispose()
    async def test_new_session_reads_saved_settings_and_all_schemes(self):
        async with self.sessions() as db:
            self.assertEqual((await read_config('p1',db,self.user))['revision'],0)
            await save_config('p1',SaveConfig(expected_revision=0,config=self.config),db,self.user)
        async with self.sessions() as db:
            saved=await read_config('p1',db,self.user)
            self.assertEqual(saved['config']['selectedFunctions'],['聚拢'])
            self.assertEqual(saved['config']['schemes'],self.config['schemes'])
            self.assertEqual(saved['config']['supplementalRequirements'],'保留原结构')
    async def test_stale_writer_cannot_overwrite_other_device(self):
        async with self.sessions() as db:
            await save_config('p1',SaveConfig(expected_revision=0,config=self.config),db,self.user)
        async with self.sessions() as db:
            with self.assertRaises(HTTPException) as ctx:
                await save_config('p1',SaveConfig(expected_revision=0,config={**self.config,'stock':99}),db,self.user)
            self.assertEqual(ctx.exception.status_code,409)
        async with self.sessions() as db:
            self.assertEqual((await read_config('p1',db,self.user))['config']['stock'],20)
    async def test_foreign_account_cannot_read_or_write(self):
        for operation in ('read','write'):
            async with self.sessions() as db:
                with self.assertRaises(HTTPException) as ctx:
                    if operation=='read': await read_config('p1',db,SimpleNamespace(id='other'))
                    else: await save_config('p1',SaveConfig(expected_revision=0,config=self.config),db,SimpleNamespace(id='other'))
                self.assertEqual(ctx.exception.status_code,404)

if __name__=='__main__':unittest.main()
