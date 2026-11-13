"""Import a reviewed supplier/category manifest. Requires an existing matching supplier.
Run on the authorized server; assets must already exist in the upload directory.
Makes a SQLite online backup; one transaction; reruns skip identical source records.
"""
import argparse,datetime,hashlib,json,sqlite3,uuid
from pathlib import Path

def run(db_path, manifest_path, uploads, apply=False):
    manifest=json.loads(Path(manifest_path).read_text());items=manifest['items']
    assert items and len({p['sku_code'] for p in items})==len(items)
    category=manifest['category'];asset_directory=manifest['asset_directory'];assert category=='女士收腹裤' and asset_directory=='jianghe-shaping-pants' and len(items)==1 and items[0]['sku_code']=='DS49356'
    conn=sqlite3.connect(db_path);conn.row_factory=sqlite3.Row
    supplier=conn.execute('select id,name,user_id from suppliers where id=?',(items[0]['supplier_id'],)).fetchone()
    assert supplier and supplier['name']==manifest['supplier_name'] and supplier['user_id'], 'Supplier mismatch'
    prepared=[];skipped=[]
    for p in items:
        assert p['supplier_id']==supplier['id'] and p['category_name']==category
        assert p['supply_currency']=='MXN' and p['supply_price']>0
        assert p['source_data']['assets'] and p['source_data']['stock_status']=='unknown'
        assert p['_variants'] and len({v['sku_code'] for v in p['_variants']})==len(p['_variants'])
        for asset in p['source_data']['assets']:
            local=Path(uploads)/asset_directory/asset['filename']
            assert local.is_file() and hashlib.sha256(local.read_bytes()).hexdigest()==asset['sha256'], 'Asset mismatch'
        old=conn.execute('select id,supplier_id,user_id,source_data from source_products where sku_code=?',(p['sku_code'],)).fetchone() if 'source_data' in {r['name'] for r in conn.execute('pragma table_info(source_products)')} else conn.execute('select id from source_products where sku_code=?',(p['sku_code'],)).fetchone()
        if old:
            assert old['supplier_id']==supplier['id'] and old['user_id']==supplier['user_id'], 'Code conflict'
            assert json.loads(old['source_data'])['source_product_code']==p['sku_code'], 'Existing source mismatch'
            skipped.append(p['sku_code']);continue
        prepared.append(p)
    report={'create':len(prepared),'skip':len(skipped),'supplier':supplier['name'],'applied':False}
    if not apply: print(json.dumps(report,ensure_ascii=False));return
    now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
    backup=Path(db_path).parent/'backups'/('jianghe-before-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.db');backup.parent.mkdir(exist_ok=True)
    with sqlite3.connect(backup) as dest: conn.backup(dest)
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('BEGIN IMMEDIATE')
    try:
        if 'source_data' not in {r['name'] for r in conn.execute('pragma table_info(source_products)')}:conn.execute('ALTER TABLE source_products ADD COLUMN source_data JSON')
        for p in prepared:
            pid=str(uuid.uuid4());payload={**{k:v for k,v in p.items() if not k.startswith('_')},'id':pid,'user_id':supplier['user_id'],'created_at':now,'updated_at':now}
            for k in ['images','specs','size_chart','source_data']:payload[k]=json.dumps(payload[k],ensure_ascii=False)
            cols=list(payload);conn.execute('INSERT INTO source_products ('+','.join(cols)+') VALUES ('+','.join('?' for _ in cols)+')',[payload[k] for k in cols])
            for idx,a in enumerate(p['source_data']['assets']):
                aid=str(uuid.uuid4());role='size_chart' if a['role'] in ['size_diagram','size_chart'] else 'detail'
                conn.execute('INSERT INTO product_assets (id,source_product_id,role,source_type,local_url,reference_id,batch_no,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',(aid,pid,role,'supplier_raw',a['url'],a['source_image_id'],'jianghe-shaping-pants',idx,now,now))
            for order,v in enumerate(p['_variants']):
                conn.execute('INSERT INTO source_product_skus (id,source_product_id,sku_code,attributes,supplier_sku_code,supply_price,currency,stock_quantity,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',(str(uuid.uuid4()),pid,v['sku_code'],json.dumps(v['attributes'],ensure_ascii=False),v['supplier_sku_code'],v['supply_price'],v['currency'],0,order,now,now))
        assert len(conn.execute('PRAGMA foreign_key_check').fetchall())==0
        conn.commit()
    except Exception:conn.rollback();raise
    report.update(applied=True,backup=str(backup));print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--db',required=True);p.add_argument('--manifest',required=True);p.add_argument('--uploads',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args();run(a.db,a.manifest,a.uploads,a.apply)
