#!/usr/bin/env python3
"""Check downloaded originals and saved role/source metadata without AI calls."""
import json,hashlib,io
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'output/product-materials-import'
items=json.load(open(root/'manifest.json'));assets={}
for p in items:
 assert p['id'] and p['title'] and p['source_url']
 for im in p['images']:
  assert im.get('sourceUrl') and im.get('role')
  assets[im['asset']]=im
for name,im in assets.items():
 raw=(root/name).read_bytes();assert hashlib.sha256(raw).hexdigest()==im['sha256']
 with Image.open(io.BytesIO(raw)) as pic:assert pic.size==(im['width'],im['height'])
 with Image.open(root/im['preview']) as pic:assert pic.width<=384 and pic.height<=512
report={'products':len(items),'image_records':sum(len(p['images']) for p in items),'unique_images':len(assets),'failed_images':sum(len(p.get('failedImages',[])) for p in items),'bytes':sum((root/name).stat().st_size for name in assets),'no_sku_images':[p['id'] for p in items if not any(i['role'].startswith('SKU') for i in p['images'])]}
(root/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
