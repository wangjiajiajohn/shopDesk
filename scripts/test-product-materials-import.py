import importlib.util,json,sqlite3,tempfile,hashlib,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('materials_import',Path(__file__).with_name('import-product-materials.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ImportTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.db=self.root/'test.db';self.manifest=self.root/'manifest.json'
  c=sqlite3.connect(self.db);c.executescript('create table reference_datasets(id text,user_id text,categories text);create table reference_products(id text,user_id text,dataset_id text,product_id text,index_data text,detail_data text,created_at text);');c.executemany('insert into reference_datasets values(?,?,?)',[('a','user-a','[]'),('b','user-b','[]')]);c.commit();c.close()
  (self.root/'images').mkdir();(self.root/'previews').mkdir();raw=b'fixture bytes';digest=hashlib.sha256(raw).hexdigest();(self.root/'images/test.jpg').write_bytes(raw);(self.root/'previews/test.webp').write_bytes(b'preview fixture')
  self.item=dict(id='123',title='Reference',source_url='https://example.com/product',images=[dict(asset='images/test.jpg',preview='previews/test.webp',sha256=digest,role='主图',skuLabel='')],sourceWorkbook='test.xlsx',archiveCategory='文胸',origin={'url':'https://example.com/product'},capturedAt='2026-11-14',method='test')
  self.manifest.write_text(json.dumps([self.item]))
 def tearDown(self):self.tmp.cleanup()
 def run_import(self,user='user-a',apply=True):return module.import_materials(self.db,self.manifest,self.root,user,apply)
 def test_dry_run_rolls_back_and_repeated_import_keeps_one_record(self):
  self.assertEqual(self.run_import(apply=False)['added'],1)
  self.assertEqual(self.run_import()['added'],1)
  self.assertEqual(self.run_import()['added'],0)
  c=sqlite3.connect(self.db);self.assertEqual(c.execute('select count(*) from reference_products').fetchone()[0],1);c.close()
 def test_import_is_account_scoped(self):
  self.run_import();self.run_import(user='user-b')
  c=sqlite3.connect(self.db);self.assertEqual(c.execute('select count(*) from reference_products').fetchone()[0],2);c.close()
 def test_checksum_failure_leaves_database_untouched(self):
  self.item['images'][0]['sha256']='wrong';self.manifest.write_text(json.dumps([self.item]))
  with self.assertRaises(ValueError):self.run_import()
  c=sqlite3.connect(self.db);self.assertEqual(c.execute('select count(*) from reference_products').fetchone()[0],0);c.close()
if __name__=='__main__':unittest.main()
