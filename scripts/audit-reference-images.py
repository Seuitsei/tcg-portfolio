#!/usr/bin/env python3
"""Audit current recognition coverage and find actual, language-specific references.

Writes a source manifest and a report; does not change scanner data or recognition.
Downloaded images and network checkpoints stay in --cache. Resume the same command
after interruption. An image URL is included only after decoding its actual bytes.
"""
import argparse, asyncio, hashlib, json, re
from collections import defaultdict
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import aiohttp
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'scanner/data'
POCKET = re.compile(r'^(?:[AB]\d[a-z]?|P-[AB])$')

def set_id(card):
    return card['id'].rsplit('-', 1)[0]

def source_urls(card, lang):
    if card.get('image'):
        url = card['image']
        yield url if re.search(r'\.(?:png|jpg|webp)$', url) else url + '/low.webp'
    if lang == 'ja':
        return
    sid = set_id(card)
    prefix = {'swsh9tg':'SWSH9', 'swsh10tg':'SWSH10',
              'swsh11tg':'SWSH11', 'swsh12tg':'SWSH12TG',
              'swsh12.5gg':'SWSH12PT5GG', 'sma':'SMA', 'col1':'COL1', 'det1':'DET',
              'smp':'SMP', 'swshp':'SWSHP', 'svp':'SVP',
              'hgssp':'HGSSP', 'dpp':'DPP', 'mep':'MEP'}.get(sid)
    if prefix is None and re.fullmatch(r'(?:dp|pl|hgss|sm|swsh|sv|xy)\d+(?:\.\d+)?(?:sv)?', sid):
        prefix = sid.upper().replace('.', '')
    if prefix is None:
        return
    number = card['localId']
    # Official files do not retain leading zeroes on numerical suffixes.
    unpadded = re.sub(r'\d+', lambda m: str(int(m.group())), number)
    numbers = list(dict.fromkeys([unpadded, number]))
    # Modern SV filenames use a three-digit card number.
    if sid.startswith('sv') and number.isdigit():
        numbers = list(dict.fromkeys([number.zfill(3)] + numbers))
    for n in numbers:
        directory = 'cms2-fr-fr' if lang == 'fr' else 'cms2'
        yield f'https://assets.pokemon.com/assets/{directory}/img/cards/web/{prefix}/{prefix}_{lang.upper()}_{n}.png'

def audit():
    catalog = json.loads((DATA/'catalog.json').read_text())
    catalog['ja'] = json.loads((DATA/'catalog-ja.json').read_text())
    sets = json.loads((DATA/'sets.json').read_text())
    sets['ja'] = json.loads((DATA/'sets-ja.json').read_text())
    names = {lang:{s['id']:s['name'] for s in rows} for lang,rows in sets.items()}
    missing, summary = [], {}
    for lang, cards in catalog.items():
        covered = {c['id'] for c in json.loads((DATA/f'vectors-{lang}.json').read_text())['cards']}
        # Packs and supplements are also recognition references, even without a global vector.
        for f in DATA.glob(f'{lang}-*.json'):
            pack = json.loads(f.read_text())
            if isinstance(pack, list):
                covered.update(c['id'] for c in pack if c.get('orb'))
        physical = [c for c in cards if not POCKET.fullmatch(set_id(c)) and '/tcgp/' not in c.get('image', '')]
        rows = [dict(c, lang=lang, setId=set_id(c), setName=names[lang].get(set_id(c),set_id(c))) for c in physical if c['id'] not in covered]
        missing.extend(rows)
        summary[lang] = {'catalogPhysical':len(physical), 'coveredPhysical':len(physical)-len(rows), 'missingPhysical':len(rows), 'seriesMissing':len({c['setId'] for c in rows})}
    return missing, summary

async def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', required=True)
    p.add_argument('--concurrency', type=int, default=12)
    p.add_argument('--offline', action='store_true', help='Rebuild the report from saved checks without network requests')
    args = p.parse_args()
    cache = Path(args.cache); cache.mkdir(parents=True, exist_ok=True)
    missing, summary = audit()
    statefile = cache/'checks.json'
    checks = json.loads(statefile.read_text()) if statefile.exists() else {}
    sem = asyncio.Semaphore(args.concurrency)
    done = 0
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=args.concurrency), timeout=aiohttp.ClientTimeout(total=20), trust_env=True) as session:
        async def check(url):
            if args.offline:
                return checks.get(url, {'status':'not-checked'})
            if url in checks and checks[url]['status'] != 'network-error':
                return checks[url]
            try:
                async with session.get(url) as response:
                    if response.status != 200:
                        result = {'status':f'http-{response.status}'}
                    else:
                        raw = await response.read()
                        image = Image.open(BytesIO(raw)); image.load()
                        w,h = image.size
                        if w < 200 or not 1.2 < h/w < 1.8:
                            result = {'status':'invalid-card-image', 'width':w, 'height':h}
                        else:
                            digest = hashlib.sha256(raw).hexdigest()
                            (cache/(digest+'.'+image.format.lower())).write_bytes(raw)
                            result = {'status':'verified', 'sha256':digest, 'width':w, 'height':h, 'bytes':len(raw)}
            except Exception as e:
                result = {'status':'network-error', 'error':type(e).__name__}
            checks[url] = result
            return result
        async def run(card):
            nonlocal done
            async with sem:
                key = card['lang']+':'+card['id']
                for url in source_urls(card, card['lang']):
                    result = await check(url)
                    if result['status'] == 'verified':
                        card['reference'] = dict(result, url=url, referenceLang=card['lang'])
                        break
                done += 1
                if done % 100 == 0:
                    statefile.write_text(json.dumps(checks,ensure_ascii=False))
                    print(f'Checked {done}/{len(missing)}; found {sum("reference" in c for c in missing)}', flush=True)
        await asyncio.gather(*(run(c) for c in missing))
    statefile.write_text(json.dumps(checks,ensure_ascii=False))
    date = datetime.now(timezone.utc).isoformat(timespec='seconds')
    out = ROOT/'docs';out.mkdir(exist_ok=True)
    found = [c for c in missing if 'reference' in c]
    unresolved = defaultdict(list)
    unresolved_reasons = {lang:defaultdict(int) for lang in summary}
    for c in missing:
        if 'reference' not in c:
            unresolved[c['lang']+':'+c['setId']].append(c['id'])
            urls = list(source_urls(c, c['lang']))
            statuses = [checks.get(url, {}).get('status', 'not-checked') for url in urls]
            reason = 'no-source-candidate' if not urls else 'network-error' if 'network-error' in statuses else 'not-checked' if 'not-checked' in statuses else 'no-image-confirmed'
            unresolved_reasons[c['lang']][reason] += 1
    existing = out/'reference-image-audit.json'
    previous = json.loads(existing.read_text()).get('cards',[]) if existing.exists() else []
    bank = {(c['lang'],c['id']):c for c in previous}
    bank.update({(c['lang'],c['id']):c for c in found})
    document = {'checkedAt':date,'scope':'physical cards in current FR/EN/JA catalog; global vectors plus local ORB packs; Pocket excluded', 'scannerChanged':False,'summary':summary, 'cards':list(bank.values()), 'foundThisAudit':len(found), 'unresolvedBySeries':dict(unresolved), 'unresolvedReasons':unresolved_reasons}
    (out/'reference-image-audit.json').write_text(json.dumps(document,ensure_ascii=False,separators=(',',':'))+'\n')
    lines = ['# Audit des références visuelles', '', f'Vérification : {date}.', '', 'Cet audit ne modifie pas le scanner. Les cartes Pocket sont exclues. Les références déjà présentes dans les packs ORB sont comptées. Une référence trouvée correspond à une image téléchargée, décodée et vérifiée dans la langue indiquée ; son association au numéro doit être conservée lors de l’intégration.', '', 'Les séries non résolues ne sont pas nécessairement introuvables : aucune image n’a été confirmée dans les sources testées. Les anciennes séries et les séries japonaises nécessitent d’autres sources. Les erreurs réseau restent distinctes des réponses 404 dans le cache du script.', '', '| Langue | Cartes physiques | Références présentes | Manquantes | Images retrouvées | Restantes |', '|---|---:|---:|---:|---:|---:|']
    for lang,s in summary.items():
        n=sum(c['lang']==lang for c in found);lines.append(f'| {lang} | {s["catalogPhysical"]} | {s["coveredPhysical"]} | {s["missingPhysical"]} | {n} | {s["missingPhysical"]-n} |')
    lines += ['', '## Limites de la recherche', '', '| Langue | Autre source à rechercher | Aucune image confirmée aux URL testées | Erreur réseau non résolue | URL non vérifiée |', '|---|---:|---:|---:|---:|']
    for lang,r in unresolved_reasons.items():
        lines.append(f'| {lang} | {r["no-source-candidate"]} | {r["no-image-confirmed"]} | {r["network-error"]} | {r["not-checked"]} |')
    lines += ['', '## Séries avec références manquantes', '', '| Langue | Série | Identifiant | Manquantes | Retrouvées | Restantes |', '|---|---|---|---:|---:|---:|']
    grouped=defaultdict(list)
    for c in missing:grouped[(c['lang'],c['setId'],c['setName'])].append(c)
    for (lang,sid,name),cards in sorted(grouped.items(),key=lambda x:(x[0][0],-len(x[1]),x[0][1])):
        n=sum('reference' in c for c in cards);lines.append(f'| {lang} | {name.replace("|","/")} | {sid} | {len(cards)} | {n} | {len(cards)-n} |')
    lines += ['', 'Le détail carte par carte, les URL vérifiées, la taille des images et leur SHA-256 figurent dans `reference-image-audit.json`.', '', 'Reproduction : `python scripts/audit-reference-images.py --cache /chemin/cache`.']
    (out/'REFERENCE-IMAGE-AUDIT.md').write_text('\n'.join(lines)+'\n')
    print('DONE', json.dumps({lang:dict(s,found=sum(c['lang']==lang for c in found)) for lang,s in summary.items()}),flush=True)

if __name__ == '__main__':
    asyncio.run(main())
