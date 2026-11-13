#!/usr/bin/env python3
"""Read user-supplied public product pages, preserve source snapshots, download product images."""
import json,re,time,hashlib,io,threading
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor,as_completed
import httpx
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/product-materials-import'
for name in ['pages','raw','images','previews']: (OUT/name).mkdir(parents=True,exist_ok=True)
LOCK=threading.Lock()

def extract_product(html):
 m=re.search(r'<script[^>]*id="__MODERN_ROUTER_DATA__"[^>]*>(.*?)</script>',html,re.S)
 if not m:return None
 data=json.loads(m.group(1))
 for route in data.get('loaderData',{}).values():
  if not isinstance(route,dict):continue
  for component in route.get('page_config',{}).get('components_map',[]):
   p=component.get('component_data',{}).get('product_info')
   if p and p.get('title'):return p
 return None

def fetch(item):
 pid=re.search(r'(?:/pdp/|/product/)(\d+)',item['url']).group(1)
 raw=OUT/'raw'/f'{pid}.json'
 if raw.exists():return json.loads(raw.read_text())
 record={**item,'id':pid,'capturedAt':datetime.now(timezone.utc).isoformat(),'status':'failed'}
 try:
  with httpx.Client(timeout=25,follow_redirects=True,headers={'User-Agent':'Mozilla/5.0'}) as client:
   r=client.get(item['url']);record.update(http_status=r.status_code,final_url=str(r.url))
   (OUT/'pages'/f'{pid}.html').write_text(r.text)
   p=extract_product(r.text) if r.status_code==200 else None
   if p and str(p.get('product_id'))==pid:record.update(status='available',product=p)
   else:record['error']='页面未提供对应商品资料' if r.status_code==200 else f'HTTP {r.status_code}'
 except Exception as e:record['error']=type(e).__name__
 raw.write_text(json.dumps(record,ensure_ascii=False))
 return record

def main():
 links=json.load(open(OUT/'links.json'));byid={}
 for item in links:
  pid=re.search(r'(?:/pdp/|/product/)(\d+)',item['url']).group(1)
  byid.setdefault(pid,item)
 records=[]
 with ThreadPoolExecutor(max_workers=4) as pool:
  futures=[pool.submit(fetch,item) for item in byid.values()]
  for f in as_completed(futures):
   r=f.result();records.append(r)
   print('page',len(records),'/',len(byid),r['id'],r['status'],r.get('error',''),flush=True)
 records.sort(key=lambda r:list(byid).index(r['id']))
 (OUT/'collected.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
 print('SUMMARY',len(records),'available',sum(r['status']=='available' for r in records),flush=True)

if __name__=='__main__':main()
