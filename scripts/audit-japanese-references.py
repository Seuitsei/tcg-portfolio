#!/usr/bin/env python3
"""Research only. Exact set/number/name matching and decoded official JP images.
Usage: audit-japanese-references.py --source ../jp-source --cache ../jp-reference-cache
Does not change scanner data. Resume downloads using the same cache.
"""
import argparse,asyncio,hashlib,json,unicodedata,subprocess,time,ssl,os,gzip
from collections import defaultdict,Counter
from pathlib import Path
from datetime import datetime,timezone
from io import BytesIO
import aiohttp
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def norm(s):return ''.join(unicodedata.normalize('NFKC',s).split())
def identity(sid,num):return sid.lower(),int(num) if num.isdigit() else num

def match(source):
 cat=json.loads((ROOT/'scanner/data/catalog-ja.json').read_text());covered={c['id'] for c in json.loads((ROOT/'scanner/data/vectors-ja.json').read_text())['cards']};index=defaultdict(list)
 for p in (source/'data_jp').glob('*/*.json'):
  d=json.loads(p.read_text());index[identity(str(d.get('set_name','')),str(d.get('number',''))) ].append(d)
 result=[]
 for c in cat:
  if c['id'] in covered:continue
  sid,num=c['id'].rsplit('-',1);matches=index.get(identity(sid,num),[]);exact=[m for m in matches if norm(m.get('name',''))==norm(c['name']) and str(m.get('img','')).startswith('https://www.pokemon-card.com/assets/images/card_images/')]
  urls=sorted({m['img'] for m in exact})
  status='candidate' if len(urls)==1 else 'ambiguous' if len(urls)>1 else 'name-mismatch' if matches else 'not-found'
  row={**c,'lang':'ja','setId':sid,'status':status}
  if status=='candidate':
   m=next(m for m in exact if m['img']==urls[0]);row['reference']={'url':m['img'],'detailUrl':m['url'],'officialId':m.get('jp_id'),'setId':m['set_name'],'number':str(m['number']),'name':m['name'],'printedTotal':m.get('set_total')}
  else:row['candidateCount']=len(urls)
  result.append(row)
 return cat,covered,result

async def main(a):
 cat,covered,rows=match(a.source);a.cache.mkdir(parents=True,exist_ok=True);statefile=a.cache/'state.json';state=json.loads(statefile.read_text()) if statefile.exists() else {};sem=asyncio.Semaphore(a.concurrency);done=0;total=sum(r['status']=='candidate' for r in rows)
 context=ssl.create_default_context();cert=os.environ.get('CODEX_PROXY_CERT');
 if cert:context.load_verify_locations(cert)
 async with aiohttp.ClientSession(trust_env=True,connector=aiohttp.TCPConnector(ssl=context),timeout=aiohttp.ClientTimeout(total=35),headers={'User-Agent':'TCG-Portfolio-reference-audit/1.0'}) as session:
  async def check(row):
   nonlocal done
   if row['status']!='candidate':return
   ref=row['reference'];url=ref['url'];old=state.get(url,{})
   if old.get('status')=='verified' and (a.cache/old['file']).exists():result=old
   else:
    async with sem:
     result=None
     for attempt in range(2):
      try:
       async with session.get(url) as r:
        if r.status!=200:result={'status':'http-error','http':r.status};break
        data=await r.read()
       with Image.open(BytesIO(data)) as im:
        im.load();w,h=im.size;fmt=im.format
       if w<250 or h<350 or not .63<w/h<.79:result={'status':'nonstandard-format','width':w,'height':h};break
       digest=hashlib.sha256(data).hexdigest();file=digest+'.'+(fmt or 'image').lower();(a.cache/file).write_bytes(data)
       result={'status':'verified','sha256':digest,'width':w,'height':h,'bytes':len(data),'file':file};break
      except Exception as e:result={'status':'network-error','error':type(e).__name__};await asyncio.sleep(.5)
     await asyncio.sleep(.12)
    state[url]=result
   row['status']=result['status'];ref.update({k:v for k,v in result.items() if k!='status'});done+=1
   if done%100==0 or done==total:
    statefile.write_text(json.dumps(state));print(f'{done}/{total} candidates checked; {sum(v.get("status")=="verified" for v in state.values())} decoded images',flush=True)
  await asyncio.gather(*(check(r) for r in rows))
 statefile.write_text(json.dumps(state));stats=Counter(r['status'] for r in rows);sets=json.loads((ROOT/'scanner/data/sets-ja.json').read_text());names={s['id']:s['name'] for s in sets};series=[]
 for sid in sorted({r['setId'] for r in rows}):
  rs=[r for r in rows if r['setId']==sid];series.append({'id':sid,'name':names.get(sid,sid),'missing':len(rs),'verified':sum(r['status']=='verified' for r in rs),'statuses':dict(Counter(r['status'] for r in rs))})
 report={'checkedAt':datetime.now(timezone.utc).isoformat(),'scannerChanged':False,'sampleOfficialDetailChecks':json.loads((a.source.parent/'jp-detail-verification.json').read_text()) if (a.source.parent/'jp-detail-verification.json').exists() else [],'sourceRepository':'https://github.com/type-null/PTCG-database','sourceCommit':subprocess.check_output(['git','-C',str(a.source),'rev-parse','HEAD'],text=True).strip(),'summary':{'catalogue':len(cat),'existing':len(covered),'missing':len(rows),'statuses':dict(stats)},'series':series,'cards':rows}
 (ROOT/'docs/japanese-reference-research.json.gz').write_bytes(gzip.compress(json.dumps(report,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 n=stats['verified'];lines=['# Recherche de références japonaises — 10 octobre 2026','',f'Vérification : {report["checkedAt"]}. Le scanner n’est pas modifié.','',f'- Catalogue japonais : **{len(cat):,} cartes**.',f'- Références visuelles déjà présentes : **{len(covered):,}**.',f'- Références manquantes avant cette recherche : **{len(rows):,}**.',f'- Images officielles téléchargées et décodées : **{n:,}**.',f'- Couverture potentielle après intégration et validation : **{len(covered)+n:,}/{len(cat):,}**.',f'- Restantes non vérifiées : **{len(rows)-n:,}**.','','## Méthode et limites','','Métadonnées de la base publique type-null/PTCG-database, figées au commit '+report['sourceCommit']+'. Correspondance exacte de série, numéro et nom japonais, avec normalisation Unicode et espaces. Les variantes avec plusieurs URL distinctes sont laissées ambiguës. Aucun remplacement par une carte française/anglaise ou par une illustration similaire. Les noms différents restent exclus.','','Les images viennent du domaine officiel pokemon-card.com. Chacune est réellement téléchargée, décodée, vérifiée en dimensions/proportions, et son SHA-256 est conservé. Cela vérifie le fichier et la correspondance des métadonnées ; ce n’est pas une relecture OCR individuelle de tous les numéros imprimés ni un test de reconnaissance physique. L’audit ne garantit pas que le catalogue TCGdex couvre toutes les cartes japonaises existantes.','','Un échantillon de 20 fiches officielles a également été vérifié (nom, numéro, série et URL image) ; les 20 passent. Les formats horizontaux restent séparés et ne sont pas comptés comme références standard prêtes. Les erreurs de réseau sont distinctes des images absentes. Les images restent dans le cache local de travail. Le manifeste permet de les retélécharger à l’identique. Les nouveaux descripteurs, packs, index et tests de reconnaissance ne sont pas encore construits.','','## Résultats par série','','| Série | Code | Manquantes avant | Images vérifiées | Restantes |','|---|---|---:|---:|---:|']
 for s in sorted(series,key=lambda s:-s['verified']):lines.append(f'| {s["name"]} | {s["id"]} | {s["missing"]} | {s["verified"]} | {s["missing"]-s["verified"]} |')
 lines+=['','## Statuts','','```json',json.dumps(dict(stats),indent=2),'```','','Détail par carte : `japanese-reference-research.json.gz` (JSON compressé).','','Reproduction : `python scripts/audit-japanese-references.py --source ../jp-source --cache ../jp-reference-cache` (aiohttp et Pillow). Le dépôt source doit être au commit indiqué.']
 (ROOT/'docs/JAPANESE-REFERENCE-RESEARCH.md').write_text('\n'.join(lines)+'\n');print(json.dumps(report['summary']),flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--concurrency',type=int,default=8);asyncio.run(main(p.parse_args()))
