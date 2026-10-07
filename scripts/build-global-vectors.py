#!/usr/bin/env python3
"""Compact, full-catalog retrieval index; ORB references fetched only for shortlist."""
import asyncio,json,importlib.util,time,argparse
from pathlib import Path
import aiohttp,numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('builder',str(Path(__file__).with_name('build-index.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
async def main():
 p=argparse.ArgumentParser();p.add_argument('--cache',required=True);p.add_argument('--metadata',required=True);p.add_argument('--langs',nargs='+',default=['fr','en']);a=p.parse_args();cache=Path(a.cache);data=m.ROOT/'scanner/data';start=time.monotonic()
 async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=8),timeout=aiohttp.ClientTimeout(total=25),trust_env=True) as session:
  for lang in a.langs:
   cards=json.loads((Path(a.metadata)/f'{lang}-cards.json').read_text());cards=[c for c in cards if c.get('image') and '/tcgp/' not in c['image']]
   sem=asyncio.Semaphore(8);done=0;failed=[];results=[None]*len(cards)
   async def run(i,c):
    nonlocal done
    async with sem:
     f=cache/(lang+'-'+c['id']+'.webp')
     try:
      if not f.exists():
       for retry in range(2):
        try:
         async with session.get(c['image']+'/low.webp') as r:
          r.raise_for_status();f.write_bytes(await r.read());break
        except Exception:
         if retry:raise
         await asyncio.sleep(1)
      rgb=np.array(Image.open(f).convert('RGB'));results[i]=np.array(m.vector(rgb),dtype=np.int8).tobytes()
     except Exception:failed.append(c['id'])
     done+=1
     if done%1000==0:print(lang,done,'/',len(cards),'failed',len(failed),'seconds',round(time.monotonic()-start),flush=True)
   await asyncio.gather(*(run(i,c) for i,c in enumerate(cards)))
   success=[c for c,v in zip(cards,results) if v];blob=b''.join(v for v in results if v)
   (data/f'vectors-{lang}.bin').write_bytes(blob);(data/f'vectors-{lang}.json').write_text(json.dumps({'version':1,'dimensions':216,'cards':success,'failed':failed,'built':'2026-10-07'},ensure_ascii=False,separators=(',',':')))
   print('DONE',lang,len(success),len(blob),round(time.monotonic()-start),flush=True)
if __name__=='__main__':asyncio.run(main())
