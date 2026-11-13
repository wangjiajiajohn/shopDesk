#!/usr/bin/env python3
"""Add user-supplied reference products without replacing earlier library assets."""
import argparse,json,sqlite3,uuid,hashlib
from pathlib import Path
from datetime import datetime,timezone

def import_materials(db_path,manifest_path,asset_root,user_id,apply=False):
 manifest=json.loads(Path(manifest_path).read_text());root=Path(asset_root)
 if not manifest:raise ValueError('empty manifest')
 for p in manifest:
  for im in p['images']:
   path=root/im['asset'];preview=root/im['preview']
   if not path.is_file() or not preview.is_file():raise ValueError('missing asset '+str(path))
   if hashlib.sha256(path.read_bytes()).hexdigest()!=im['sha256']:raise ValueError('checksum mismatch '+str(path))
 conn=sqlite3.connect(db_path);conn.row_factory=sqlite3.Row
 try:
  ds=conn.execute('select * from reference_datasets where user_id=?',(user_id,)).fetchone()
  if not ds:raise ValueError('existing account materials dataset required')
  now=datetime.now(timezone.utc).isoformat();added=updated=0
  if apply:
   backup=Path(db_path).parent/'backups'/('before-product-materials-'+datetime.now().strftime('%Y%m%dT%H%M%S%f')+'.db');backup.parent.mkdir(exist_ok=True)
   dest=sqlite3.connect(backup);conn.backup(dest);dest.close()
  conn.execute('begin immediate')
  for p in manifest:
   old=conn.execute('select * from reference_products where user_id=? and product_id=?',(user_id,p['id'])).fetchone()
   detail=json.loads(old['detail_data']) if old else {};index=json.loads(old['index_data']) if old else {}
   old_images=detail.get('images',[]);keys={(i['asset'],i.get('role'),i.get('skuLabel','')) for i in old_images}
   for im in p['images']:
    key=(im['asset'],im.get('role'),im.get('skuLabel',''))
    if key not in keys:old_images.append(im);keys.add(key)
   detail.update(id=p['id'],images=old_images,salesTotal=p.get('salesTotal'),salesTotalDisplay=p.get('sold_text'),salesTotalSource='TikTok商品页展示累计销量',salesCapturedAt=p['capturedAt'])
   for k,v in {'title':p['title'],'shop':p.get('shop',''),'descriptionText':p.get('description',''),'tiktokUrl':p['source_url'],'placements':[],'sales7':None,'sales28':None,'detailStatus':'available','skuNote':json.dumps(p.get('options',{}),ensure_ascii=False),'sellingPoints':'','descriptionLanguage':'es' if '/mx/' in p['source_url'] else 'en'}.items():
    if not detail.get(k):detail[k]=v
   detail['sourceImports']=list({(x.get('workbook'),x.get('productId')):x for x in [*detail.get('sourceImports',[]),{'workbook':p['sourceWorkbook'],'productId':p['id'],'category':p['archiveCategory'],'url':p['origin']['url'],'capturedAt':p['capturedAt'],'method':p['method'],'title':p['title'],'soldText':p.get('sold_text')} ]}.values())
   detail['sourceOptions']=p.get('options',{})
   detail['failedImages']=p.get('failedImages',[])
   detail['imageCollectionNotes'] = p.get('errors', [])
   notes=detail.get('notes',[])
   if not isinstance(notes,list):notes=[str(notes)]
   for note in ['本次销量来自TikTok商品页累计展示，不是近7天或近28天销量。',*(['部分图片下载失败，参见失败记录。'] if p.get('failedImages') else []),*(['此次未取得SKU图。'] if not any(i['role'].startswith('SKU') for i in p['images']) else [])]:
    if note not in notes:notes.append(note)
   detail['notes']=notes
   index.update(id=p['id'],archiveCategory=p['archiveCategory'],salesTotal=p.get('salesTotal'),salesTotalDisplay=p.get('sold_text'),sourceWorkbook=p['sourceWorkbook'],capturedAt=p['capturedAt'])
   index.setdefault('placements',[]);index.setdefault('sales7',None);index.setdefault('sales28',None)
   index['searchText']=' '.join(dict.fromkeys([index.get('searchText',''),p['title'],p['id'],p['archiveCategory'],p['sourceWorkbook']]))
   if old:
    conn.execute('update reference_products set index_data=?,detail_data=? where id=?',(json.dumps(index,ensure_ascii=False),json.dumps(detail,ensure_ascii=False),old['id']));updated+=1
   else:
    conn.execute('insert into reference_products (id,user_id,dataset_id,product_id,index_data,detail_data,created_at) values (?,?,?,?,?,?,?)',(str(uuid.uuid4()),user_id,ds['id'],p['id'],json.dumps(index,ensure_ascii=False),json.dumps(detail,ensure_ascii=False),now));added+=1
  rows=conn.execute('select index_data from reference_products where user_id=?',(user_id,)).fetchall();counts={}
  for row in rows:
   item=json.loads(row[0]);cats={x.get('category') for x in [*item.get('placements',[]),*item.get('placements28',[])]};cats.add(item.get('archiveCategory'))
   for c in cats:
    if c:counts[c]=counts.get(c,0)+1
  previous=json.loads(ds['categories']);names=list(dict.fromkeys([x['name'] for x in previous]+list(counts)))
  conn.execute('update reference_datasets set categories=? where id=?',(json.dumps([{'name':n,'count':counts.get(n,0)} for n in names],ensure_ascii=False),ds['id']))
  report={'apply':apply,'processed':len(manifest),'added':added,'updated':updated,'total':len(rows),'image_records':sum(len(p['images']) for p in manifest)}
  if apply:conn.commit();report['backup']=str(backup)
  else:conn.rollback()
  return report
 finally:conn.close()

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',required=True);p.add_argument('--manifest',required=True);p.add_argument('--assets',required=True);p.add_argument('--user',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args()
 print(json.dumps(import_materials(a.db,a.manifest,a.assets,a.user,a.apply),ensure_ascii=False))
