#!/usr/bin/env python3
"""Explicit TCGdex / legacy Pokémon TCG API crosswalk for Classic Collection.
Source JSON: PokemonTCG/pokemon-tcg-data/cards/en/cel25c.json. Never treat CC002 as printed number.
French metadata uses English reference artwork where TCGdex has no image; expose this limitation.
"""
import json,asyncio,base64,hashlib,sys,importlib.util
from pathlib import Path
import aiohttp,cv2,numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('builder',str(Path(__file__).with_name('build-index.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
IDS=['2_A','4_A','15_A1','73_A','8_A','15_A2','15_A3','24_A','20_A','66_A','9_A','86_A','88_A','93_A','17_A','15_A4','109_A','145_A','107_A','113_A','114_A','54_A','97_A','76_A','60_A']
async def main():
 source=json.loads(Path(sys.argv[1]).read_text());cache=Path(sys.argv[2]);data=m.ROOT/'scanner/data';catalog=json.loads((data/'catalog.json').read_text());manifest=json.loads((data/'manifest.json').read_text())
 async with aiohttp.ClientSession(trust_env=True) as session:
  for lang in ['fr','en']:
   entries=[]
   for i,api_id in enumerate(IDS,1):
    ref=next(c for c in source if c['id']=='cel25c-'+api_id);entry=next(c for c in catalog[lang] if c['id']==f'cel25cc-CC{i:03}')
    file=cache/(lang+'-'+entry['id']+'.webp')
    if not file.exists():
     async with session.get(ref['images']['small']) as r:
      r.raise_for_status();from io import BytesIO
      Image.open(BytesIO(await r.read())).convert('RGB').save(file,'WEBP',quality=94)
    rgb=np.array(Image.open(file).convert('RGB'));v=m.vector(rgb);gray=cv2.cvtColor(cv2.resize(rgb,(252,352),interpolation=cv2.INTER_AREA),cv2.COLOR_RGB2GRAY);kp,desc=cv2.ORB_create(nfeatures=350).detectAndCompute(gray,None);coords=np.array([[round(k.pt[0]*16),round(k.pt[1]*16)] for k in kp],dtype='<u2')
    c={**entry,'localId':ref['number'],'printedNumber':ref['number'],'image':ref['images']['small'],'referenceLang':'en','lang':lang,'source':'pokemontcg.io historical reference','setId':'cel25cc','setName':'Célébrations Collection Classique' if lang=='fr' else 'Celebrations Classic Collection','total':25,'v':v,'orb':base64.b64encode(desc.tobytes()).decode(),'points':base64.b64encode(coords.tobytes()).decode()};entries.append(c)
    # Enrich searchable metadata with printed number and provenance.
    entry.update({k:c[k] for k in ['localId','printedNumber','image','referenceLang']})
   pack=f'{lang}-cel25cc.json';raw=json.dumps(entries,ensure_ascii=False,separators=(',',':')).encode();(data/pack).write_bytes(raw)
   manifest['packs']=[p for p in manifest['packs'] if p['file']!=pack];manifest['packs'].append({'file':pack,'lang':lang,'setId':'cel25cc','name':entries[0]['setName'],'count':len(entries),'available':len(entries),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()});print(lang,len(entries),flush=True)
 (data/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(data/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
if __name__=='__main__':asyncio.run(main())
