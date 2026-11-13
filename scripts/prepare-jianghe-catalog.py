"""Read the saved Fenco XLSX snapshot and preserve supplier evidence in a manifest.
No network, no database writes, no generated product images.
"""
from pathlib import Path
import collections,datetime,hashlib,json,posixpath,re,zipfile,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/jianghe-catalog';(OUT/'assets').mkdir(parents=True,exist_ok=True)
sheets=json.loads((ROOT/'output/jianghe-new-arrivals/all-sheets-raw.json').read_text());source=Path('/Users/jiajiawang/Downloads/Fenco-电商款货盘.xlsx');z=zipfile.ZipFile(source)
NS={'xdr':'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/cellimages.xml.rels'))};image_map={}
for ci in E.fromstring(z.read('xl/cellimages.xml')):
 p=ci.find('.//xdr:cNvPr',NS);b=ci.find('.//a:blip',NS);image_map[p.attrib['name']]=posixpath.normpath('xl/'+rels[b.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed']])
def value(row,col):return row['cells'].get(col,{}).get('v','').strip()
ALL_SIZES=['XS','S','M','L','XL','2XL','3XL','4XL','5XL']
def parse_sizes(raw):
 s=raw.strip().replace('‑','-').replace('–','-').replace('—','-')
 if not s:return []
 if s in ['F','F（均码）','F(均码)','均码（F）','S/M','L/XL','A/B通杯','C/D通杯']:return [s]
 if re.search(r'[,，、]',s):
  parts=[p.strip() for p in re.split(r'[,，、]',s) if p.strip()]
  return parts if all(re.fullmatch(r'(?:\d+|[A-Z0-9]+(?:/[A-Z0-9]+)?)',p) for p in parts) else []
 m=re.fullmatch(r'(XS|S|M|L|XL|[2-5]XL)-(XS|S|M|L|XL|[2-5]XL)',s)
 if m:
  a,b=map(ALL_SIZES.index,m.groups());return ALL_SIZES[a:b+1] if a<=b else []
 m=re.fullmatch(r'([A-Z0-9]+/[A-Z0-9]+)-([A-Z0-9]+/[A-Z0-9]+)',s)
 if m:return list(m.groups())
 m=re.fullmatch(r'([A-D])罩杯-([A-D])罩杯',s)
 if m:return [c+'罩杯' for c in 'ABCD'['ABCD'.index(m[1]):'ABCD'.index(m[2])+1]]
 if re.fullmatch(r'[A-Z0-9]+/[A-Z0-9]+',s):return [s]
 return []
NUM={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}
def pack_count(title):
 m=re.search(r'([0-9一二两三四五六七八九十]+)\s*件\s*[装套]',title)
 if m:return int(m[1]) if m[1].isdigit() else NUM.get(m[1])
 if '套装' in title or '组合装' in title:return None
 return 1
pack_rows=next(s for s in sheets if s['name']=='包装价格信息')['rows'][1:];pack_index=collections.defaultdict(list)
for r in pack_rows:pack_index[value(r,'A')].append(r)
all_groups=collections.OrderedDict();categories=[];source_count=0
for sh in sheets:
 cat=sh['name']
 if cat in ['包装价格信息','WpsReserved_CellImgList']:continue
 categories.append(cat);groups=collections.OrderedDict();current=None
 for row in sh['rows'][1:]:
  code=value(row,'A')
  if code:
   assert re.fullmatch(r'DS\d+',code),code
   current=code;source_count+=1
   groups.setdefault(code,{'heads':[],'rows':[],'issues':[]})['heads'].append(row)
  assert current
  groups[current]['rows'].append(row)
 # Only the explicitly identified misplaced pant rows, not arbitrary SKC typos.
 if cat=='女士收腹裤':
  for row in list(groups['DS62021']['rows']):
   if row['row'] in [66,67] and value(row,'C').startswith('DS57087-'):
    groups['DS62021']['rows'].remove(row);groups['DS57087']['rows'].append(row)
    groups['DS57087']['issues'].append({'field':'source_layout','message':f'第{row["row"]}行位于DS62021区域，原SKC明确为DS57087；依编号关联并保留来源位置。','source_cell':f'{cat}!C{row["row"]}'})
 for code,g in groups.items():
  target=all_groups.setdefault(code,{'origins':[]})
  target['origins'].append({'category':cat,**g})
items=[]
for code,g in all_groups.items():
 origins=g['origins'];origin=origins[0];head=origin['heads'][0];cat=origin['category'];rownum=head['row'];v=lambda col:value(head,col);issues=[];assets=[];asset_keys=set();colors=collections.OrderedDict();all_raw=[]
 for o in origins:
  issues.extend(o['issues'])
  for h in o['heads']:
   if value(h,'E')!=v('E'):issues.append({'field':'source_conflict','message':f'同货号在{o["category"]}第{h["row"]}行的品名不同，原文保留待核对。'})
   if value(h,'F')!=v('F'):issues.append({'field':'price_conflict','message':f'同货号在{o["category"]}第{h["row"]}行报价不同，未覆盖首条报价。'})
  for row in o['rows']:
   all_raw.append({'sheet':o['category'],**row})
   for col,role in [('B','supplier_collage'),('I','size_chart')]:
    match=re.search(r'ID_[A-F0-9]+',value(row,col))
    if not match:continue
    iid=match.group();cell=f'{o["category"]}!{col}{row["row"]}'
    if (iid,role) in asset_keys:
     next(a for a in assets if a['source_image_id']==iid and a['role']==role)['source_cells'].append(cell);continue
    if iid not in image_map:issues.append({'field':'assets','message':f'{cell}图片引用无法在原文件找到。'});continue
    ip=image_map[iid];data=z.read(ip);digest=hashlib.sha256(data).hexdigest();filename=digest[:24]+Path(ip).suffix;(OUT/'assets'/filename).write_bytes(data)
    assets.append({'role':role,'source_type':'supplier_raw','url':'/uploads/jianghe-catalog/'+filename,'source_cell':cell,'source_cells':[cell],'source_image_id':iid,'sha256':digest,'filename':filename});asset_keys.add((iid,role))
   color=value(row,'D');skc=value(row,'C')
   # Per-row size can override the merged group's header (important for different colors).
   size_raw=value(row,'H') or value(o['heads'][0],'H')
   if not color:continue
   option=colors.setdefault(color,{'color':color,'supplier_skc':skc,'sources':[],'sizes':[]})
   option['sources'].append({'sheet':o['category'],'row':row['row'],'skc':skc,'sizes_raw':size_raw})
   for size in parse_sizes(size_raw):
    if size not in option['sizes']:option['sizes'].append(size)
   if size_raw and not parse_sizes(size_raw):issues.append({'field':'sizes','message':f'颜色{color}的尺码原文“{size_raw}”未确定可售枚举；保留原文，暂不展开。','source_cell':f'{o["category"]}!H{row["row"]}'})
   if skc and not (skc==code or skc.startswith(code+'-')):issues.append({'field':'source_skc','message':f'原始SKC“{skc}”与货号{code}不一致，按原表货号分组，保留原值待核对。','source_cell':f'{o["category"]}!C{row["row"]}'})
 assert any(a['role']=='supplier_collage' for a in assets),code
 if not colors:
  issues.append({'field':'colors','message':'原表未提供明确颜色枚举，未自行从合成图推断。'})
  colors[None]={'color':None,'supplier_skc':v('C'),'sources':[],'sizes':parse_sizes(v('H'))}
 sizes=list(dict.fromkeys(s for option in colors.values() for s in option['sizes']))
 if not sizes:issues.append({'field':'sizes','message':f'可售尺码原文“{v("H") or "未填写"}”未明确，未补造尺码选项。'})
 composition=v('J');comp_source=f'{cat}!J{rownum}'
 material_pattern=r'棉|纶|纤维|聚酯|聚脂|硅胶|尼龙|Nylon|Poly|Elastane|Spandex|Cotton|Silicone'
 if composition and not re.search(material_pattern,composition,re.I):
  issues.append({'field':'composition_missing','message':f'原成分列内容“{composition}”不像材质，已保留原文，需核对。'})
  match=re.search(r'100[%％]\s*硅胶',v('E'))
  if match:
   composition=match.group();comp_source=f'{cat}!E{rownum}'
   issues[-1]={'field':'source_column_mismatch','message':'原成分列填入尺码；成分按品名明确的100%硅胶提取，原始列值仍保留。'}
  else:composition=''
 if not composition and not any(i['field']=='composition_missing' for i in issues):issues.append({'field':'composition_missing','message':'原表成分未填写，保留原图待补充。'})
 # Check each layer separately; totals across shell and lining must not be combined.
 lines=[l for l in re.split(r'[\n；;]',composition) if l.strip()]
 layered=any(re.search(r'面层|里层|裆部|底裆|裆底|面料|里料|内裆|主料',l) for l in lines) and len(lines)>1
 if layered:
  for line in lines:
   nums=re.findall(r'(\d+(?:\.\d+)?)\s*[%％]',line)
   total=sum(map(float,nums))
   if nums and abs(total-100)>.01:issues.append({'field':'composition','message':f'原文分层成分“{line}”合计{total:g}%，待核对。'})
 else:
  # Parentheses may repeat the same composition in English. Do not double-count it.
  check_text=re.sub(r'[（(][^）)]*[）)]','',composition)
  nums=re.findall(r'(\d+(?:\.\d+)?)\s*[%％]',check_text);total=sum(map(float,nums))
  if nums and abs(total-100)>.01:
   message='原文比例标注不完整（部分数值缺百分号），待核对；不自动补写。' if re.search(r'\d+(?:\.\d+)?\s+(?:氨纶|锦纶|棉)',check_text) else f'原文成分比例合计{total:g}%，待核对；不得自动用于买家成分声明。'
   issues.append({'field':'composition','message':message})
 pack=pack_count(v('E'));raw_price=float(v('F'));price=round(raw_price*pack,2) if pack else None
 if pack is None:issues.append({'field':'pack_quantity','message':'品名提到套装但未明确件数；保留原单件报价，整套采购价暂待核对。'})
 unit='pair' if cat=='袜子' or cat=='最近上新' else 'piece'
 raw_links=list(dict.fromkeys(value(r,'K') for o in origins for r in o['rows'] if value(r,'K')))
 members=list(dict.fromkeys(o['category'] for o in origins));meta={'schema_version':1,'document_title':'Fenco-电商款货盘','document_url':'https://www.kdocs.cn/l/cfI3Mp6bg41D','source_category':cat,'category_memberships':members,'category_order':categories,'source_row':rownum,'source_product_code':code,'source_origins':[{'sheet':o['category'],'rows':[r['row'] for r in o['rows']]} for o in origins],'raw_cells':all_raw,'imported_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'original_unit_price':raw_price,'currency':'MXN','price_unit':unit,'pack_quantity':pack,'pack_quantity_basis':'按用户确认的单件价格×品名明确件数；不使用最低起订量作为套装件数','composition_source':comp_source,'stock_status':'unknown','raw_photo_links':raw_links,'assets':assets,'variant_sources':list(colors.values()),'extractions':[],'issues':issues,'generation_status':'not_started','packaging_reference_rows':pack_index.get(code.removeprefix('DS'),[])}
 chart_assets=[a for a in assets if a['role']=='size_chart'];chart={'kind':'image_table','original_image':chart_assets[0]['url'],'original_images':[a['url'] for a in chart_assets],'language':'zh','columns':[],'rows':[],'extraction_status':'pending','selling_sizes':sizes} if chart_assets else None
 specs=([{'name':'颜色','values':[c for c in colors if c]}] if any(colors) else [])+([{'name':'尺码','values':sizes}] if sizes else [])
 variants=[]
 for ci,option in enumerate(colors.values()):
  for si,size in enumerate(option['sizes'] or [None]):
   variants.append({'sku_code':f'JH-{code}-C{ci+1:02d}-S{si+1:02d}','attributes':([{'name':'颜色','value':option['color']}] if option['color'] else [])+([{'name':'尺码','value':size}] if size else []),'supplier_sku_code':option['supplier_skc'],'supply_price':price,'currency':'MXN','stock_quantity':0})
 items.append({'title':v('E'),'sku_code':code,'category_name':cat,'supplier_id':'e1026dcd-eb9e-445a-8b3a-e3acf70ee609','source_url':meta['document_url'],'main_image':next(a['url'] for a in assets if a['role']=='supplier_collage'),'images':[a['url'] for a in assets if a['role']=='supplier_collage'],'composition':composition,'size_chart':chart,'supply_price':price,'supply_currency':'MXN','specs':specs,'source_data':meta,'weight_g':0,'package_length_cm':0,'package_width_cm':0,'package_height_cm':0,'stock_quantity':0,'is_active':True,'_variants':variants})
manifest={'supplier_name':'江河跨境','scope':'entire_workbook','asset_directory':'jianghe-catalog','workbook_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'categories':categories,'items':items}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
report={'unique_products':len(items),'source_product_occurrences':source_count,'variants':sum(len(p['_variants']) for p in items),'asset_references':sum(len(p['source_data']['assets']) for p in items),'unique_files':len(list((OUT/'assets').iterdir())),'categories':{c:sum(c in p['source_data']['category_memberships'] for p in items) for c in categories},'issue_products':sum(bool(p['source_data']['issues']) for p in items),'issues':collections.Counter(i['field'] for p in items for i in p['source_data']['issues']),'unknown_set_prices':[p['sku_code'] for p in items if p['supply_price'] is None]}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
