#!/usr/bin/env python3
"""Additional research only: independent vintage scan archive, exact printed identity.
No scanner data is modified. Requires aiohttp, Pillow. Resumable local response cache.
"""
import asyncio,json,gzip,re,html,ssl,os,hashlib,unicodedata
from pathlib import Path
from urllib.parse import urljoin
from io import BytesIO
import aiohttp
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'jp-vintage-cache';CACHE.mkdir(exist_ok=True)
norm=lambda s:''.join(unicodedata.normalize('NFKC',s).split())
async def main():
 old=json.loads(gzip.decompress((ROOT/'docs/japanese-reference-research.json.gz').read_bytes()))
 sets={s['id']:s for s in json.loads((ROOT/'scanner/data/sets-ja.json').read_text())}
 rows=[];sem=asyncio.Semaphore(6);context=ssl.create_default_context()
 if os.environ.get('CODEX_PROXY_CERT'):context.load_verify_locations(os.environ['CODEX_PROXY_CERT'])
 async with aiohttp.ClientSession(trust_env=True,connector=aiohttp.TCPConnector(ssl=context),timeout=aiohttp.ClientTimeout(total=35)) as session:
  async def get(url,data=None):
   key=hashlib.sha256((url+str(data)).encode()).hexdigest();file=CACHE/key
   if file.exists():return file.read_bytes()
   async with sem:
    for attempt in range(3):
     try:
      async with session.request('POST' if data else 'GET',url,data=data) as r:
       r.raise_for_status();b=await r.read()
      file.write_bytes(b);return b
     except Exception:
      if attempt==2:raise
      await asyncio.sleep(1)
  async def series(sid):
   code='vs0' if sid=='VS1' else sid.lower()
   wanted=[c for c in old['cards'] if c['setId']==sid and c['status']=='not-found']
   if not wanted:return
   api=json.loads(await get('https://pcg-search.com/card/sql/ajax_detail_card_search.php',{'where':"CONCAT(C.series, C.cd) = '"+code+"'"}))
   candidates=[]
   for d in api:
    name=d['cName']
    if '\\u' in name:name=json.loads('"'+name+'"')
    candidates.append({**d,'name':name})
   async def card(c):
    exact=[d for d in candidates if d['cCd']==code+str(c['localId']).zfill(3)]
    # Several legacy catalogue names are mistranslated. Printed series/number
    # identity is verified independently; disagreements stay explicit in the audit.
    rowNameConflict=bool(exact and norm(exact[0]['name'])!=norm(c['name']))
    row={'id':c['id'],'name':c['name'],'localId':c['localId'],'setId':sid,'lang':'ja','status':'not-found','source':'pcg-search.com'}
    try:
     valid=[]
     for d in exact:
      url='https://pcg-search.com/card/'+d['series']+'/'+d['cCd']+'.php'
      text=(await get(url)).decode();title=html.unescape(re.search(r'<title>(.*?)</title>',text,re.S).group(1))
      numbers=re.findall(r'\((\d+)\s*/\s*(\d+)\)',title)
      if not any(int(a)==int(c['localId']) for a,b in numbers):continue
      if norm(sets[sid]['name']) not in norm(title):continue
      img=re.search(r'<img[^>]*class="cardImg"[^>]*src="([^"]+)"',text)
      if not img:continue
      valid.append((d,url,urljoin(url,img.group(1)),title))
     if len(valid)>1:row['status']='ambiguous'
     elif len(valid)==1:
      d,url,img,title=valid[0];b=await get(img)
      with Image.open(BytesIO(b)) as im:im.load();w,h=im.size
      if w<250 or h<350 or not .63<w/h<.79:row['status']='insufficient-format';row.update(width=w,height=h)
      else:
       digest=hashlib.sha256(b).hexdigest();file=digest+'.png';(CACHE/file).write_bytes(b)
       row['status']='verified-secondary';row['catalogueNameMismatch']=rowNameConflict;row['sourceName']=d['name'];row['reference']={'url':img,'detailUrl':url,'title':title,'sha256':digest,'width':w,'height':h,'bytes':len(b),'file':file,'source':'pcg-search.com'}
    except Exception as e:row['status']='error';row['error']=str(e)[:150]
    rows.append(row)
   await asyncio.gather(*(card(c) for c in wanted))
   print(sid,len(wanted),sum(r['setId']==sid and r['status']=='verified-secondary' for r in rows),flush=True)
  # Modest concurrency: two series, at most six requests total.
  sids=['VS1']+['E'+str(i) for i in range(1,6)]+['PCG'+str(i) for i in range(1,11)]
  for i in range(0,len(sids),2):await asyncio.gather(*(series(sid) for sid in sids[i:i+2]))
 from collections import Counter
 summary=dict(Counter(r['status'] for r in rows))
 report={'source':'https://pcg-search.com/card/search.php','scannerChanged':False,'matching':'Exact series title and printed collector number. Japanese name disagreements remain explicit for review. Secondary source, not official. Not an accuracy test.','summary':summary,'cards':sorted(rows,key=lambda c:c['id'])}
 (ROOT/'docs/japanese-vintage-research.json.gz').write_bytes(gzip.compress(json.dumps(report,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 print(json.dumps(summary),flush=True)
asyncio.run(main())
