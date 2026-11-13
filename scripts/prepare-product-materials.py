#!/usr/bin/env python3
import json,re,hashlib,io
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
import httpx
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/product-materials-import'
for d in ['images','previews']:(OUT/d).mkdir(exist_ok=True)
links=json.load(open(OUT/'links.json'));origins={re.search(r'(?:/pdp/|/product/)(\d+)',p['url']).group(1):p for p in links}

def normalise_local(record):
 p=record['product'];images=[]
 def add(im,role,label=''):
  if im and im.get('url_list'):images.append({'urls':im['url_list'],'role':role,'label':label})
 for i,im in enumerate(p.get('images',[])):add(im,'主图' if i==0 else f'副图-{i:02}')
 for i,b in enumerate(p.get('desc_blocks',[])):
  if b.get('type')=='image':add(b.get('image'),f'详情图-{i+1:02}')
 add(p.get('size_guide',{}).get('image'),'详情图-尺码表')
 for prop in p.get('sale_props',[]):
  for i,value in enumerate(prop.get('sale_prop_values',[])):add(value.get('image'),f'SKU-{len([x for x in images if x["role"].startswith("SKU")])+1:02}',value.get('prop_value',''))
 text='\n'.join(b.get('text','') if isinstance(b.get('text'),str) else str(b.get('text','')) for b in p.get('desc_blocks',[]) if b.get('type')=='text')
 return dict(id=record['id'],title=p['title'],source_url=record['url'],sold_text=p.get('sold_count'),salesTotal=int(p['sold_count']) if str(p.get('sold_count','')).isdigit() else None,description=text,shop=p.get('seller',{}).get('name'),options=p.get('sale_props',[]),images=images,method='public_page_embedded_product_info',capturedAt=record['capturedAt'])

def normalise_browser(p):
 pid=str(p.get('product_id') or p.get('id',''));images=[]
 for i,im in enumerate(p.get('gallery',[])):
  if not isinstance(im,dict) or not im.get('url'):continue
  if 'common-sign' in im['url'] or 'tplv-noop' in im['url'] or '/static/image/tts_' in im['url']:continue
  images.append({'urls':[im['url']],'role':'主图' if i==0 else f'副图-{i:02}','label':''})
 for i,im in enumerate(p.get('sku_images',[])):
  if isinstance(im,dict) and im.get('url'):images.append({'urls':[im['url']],'role':f'SKU-{i+1:02}','label':im.get('label','')})
 for i,im in enumerate(p.get('detail_images',[])):
  if im.get('url'):images.append({'urls':[im['url']],'role':f'详情图-{i+1:02}','label':''})
 return dict(id=pid,title=p.get('title',''),source_url=p.get('source_url',origins.get(pid,{}).get('url','')),sold_text=p.get('sold_text'),salesTotal=None,description=p.get('description',''),options=p.get('options',{}),images=images,errors=p.get('errors',[]),method=p.get('method','browser_visible_product_page'),capturedAt=p.get('capturedAt',datetime.now(timezone.utc).isoformat()))

records={}
for p in json.load(open(OUT/'collected.json')):
 if p['status']=='available':records[p['id']]=normalise_local(p)
for f in [OUT/'browser-sample.json',*sorted(OUT.glob('browser-batch-*.json'))]:
 if not f.exists():continue
 data=json.load(open(f));items=data.get('products',[data]) if isinstance(data,dict) else data
 for p in items:
  # A browser result may contain logos/placeholders even when access failed.
  if re.search(r'captcha|blocked|regional restriction|not available in this country|not currently available', str(p.get('errors','')), re.I):continue
  n=normalise_browser(p)
  if n['id'] in origins and n['title'] and n['images']:records[n['id']]=n

cache=json.load(open(OUT/'download-map.json')) if (OUT/'download-map.json').exists() else {}
urls={u for p in records.values() for im in p['images'] for u in im['urls']}
client=httpx.Client(timeout=25,follow_redirects=True)
def download(url):
 if url in cache and (OUT/cache[url]['asset']).exists():return url,cache[url]
 try:
  r=client.get(url);r.raise_for_status();raw=r.content
  with Image.open(io.BytesIO(raw)) as im:
   im.load();w,h=im.size;fmt=im.format;ext={'JPEG':'jpg','PNG':'png','WEBP':'webp','GIF':'gif'}.get(fmt)
   if not ext:raise ValueError('unsupported image format')
   digest=hashlib.sha256(raw).hexdigest();asset=f'images/{digest}.{ext}';preview=f'previews/{digest}.webp';(OUT/asset).write_bytes(raw)
   im.thumbnail((384,512));im.convert('RGB').save(OUT/preview,'WEBP',quality=82)
  return url,dict(asset=asset,preview=preview,width=w,height=h,sha256=digest,bytes=len(raw))
 except Exception as e:return url,{'error':type(e).__name__}
with ThreadPoolExecutor(max_workers=10) as pool:
 futures=[pool.submit(download,u) for u in urls]
 for i,f in enumerate(as_completed(futures),1):
  u,value=f.result();cache[u]=value
  if i%25==0:print('images',i,'/',len(urls),flush=True)
client.close();(OUT/'download-map.json').write_text(json.dumps(cache,ensure_ascii=False,indent=2))
manifest=[]
for p in records.values():
 images=[];failed=[]
 for im in p.pop('images'):
  found=next(((u,cache[u]) for u in im['urls'] if 'asset' in cache.get(u,{})),None)
  if found:
   u,asset=found;images.append({**asset,'role':im['role'],'skuLabel':im['label'],'sourceUrl':u})
  else:failed.append({'role':im['role'],'label':im['label'],'urls':im['urls']})
 origin=origins[p['id']];p.update(images=images,failedImages=failed,sourceWorkbook='文胸链接汇总.xlsx',archiveCategory=origin['category'],origin=origin)
 manifest.append(p)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('PREPARED',json.dumps({'products':len(manifest),'images':sum(len(p['images']) for p in manifest),'failed_images':sum(len(p['failedImages']) for p in manifest)},ensure_ascii=False),flush=True)
