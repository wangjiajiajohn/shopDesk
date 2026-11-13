#!/usr/bin/env python3
import json,re,html
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/product-materials-import'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.title=[];self.in_title=False
 def handle_starttag(self,t,a):
  if t=='img':self.images.append(dict(a))
  if t=='h1':self.in_title=True
 def handle_endtag(self,t):
  if t=='h1':self.in_title=False
 def handle_data(self,d):
  if self.in_title:self.title.append(d)
full=json.load(open(OUT/'remote-pages.json'))
full+=json.load(open(OUT/'remote-sample-pages.json'))['results']
byid={re.search(r'(?:/pdp/|/product/)(\d+)',p['url']).group(1):p for p in full}
products=[];skipped=[]
for f in sorted(OUT.glob('image-scope-batch-*.json')):
 for record in json.load(open(f))['results']:
  pid=re.search(r'(?:/pdp/|/product/)(\d+)',record['url']).group(1);p=Page();p.feed(record['text']);gallery=[];skus=[];details=[]
  for im in p.images:
   cls=im.get('class','');url=im.get('src','');alt=im.get('alt','')
   if not url.startswith('https://'):continue
   if 'flex-none object-contain' in cls and 'cursor-zoom-in' in cls:gallery.append({'url':url,'label':alt})
   elif 'w-60 h-60 rounded-2' in cls:skus.append({'url':url,'label':alt})
   elif 'descriptionImage-' in cls:details.append({'url':url,'label':alt})
  title=''.join(p.title).strip()
  if not title and gallery:title=gallery[0]['label']
  if not title or not gallery:skipped.append({'id':pid,'url':record['url'],'reason':'页面未提供商品标题与主图库'});continue
  raw=byid.get(pid,{});text=html.unescape(re.sub('<[^>]+>',' ',raw.get('text','')));text=' '.join(text.split());sold=re.search(r'\b[\d,.]+\s*[KMB]?\+?\s+(?:sold|Sold)\b',text)
  products.append({'product_id':pid,'source_url':record.get('final_url',record['url']),'title':title,'gallery':gallery,'sku_images':skus,'detail_images':details,'sold_text':sold.group(0) if sold else None,'description':'','options':{'image_variant_labels':[s['label'] for s in skus]},'method':'public_browser_DOM_img_class_and_alt','capturedAt':datetime.now(timezone.utc).isoformat(),'errors':[] if skus else ['页面未取得SKU图片']})
(OUT/'browser-batch-dom.json').write_text(json.dumps({'products':products,'skipped':skipped},ensure_ascii=False,indent=2))
print(json.dumps({'products':len(products),'gallery':sum(len(p['gallery']) for p in products),'sku_images':sum(len(p['sku_images']) for p in products),'details':sum(len(p['detail_images']) for p in products),'skipped':len(skipped)},ensure_ascii=False))
