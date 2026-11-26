#!/usr/bin/env python3
"""Pre-render the Reels narration with Kokoro (free, open-source neural voice).

Writes data/audio/<card>/<role>.m4a and data/audio/manifest.json. Safe to re-run: only cards that are
new or whose text changed are rendered. Stops cleanly when the time budget runs out and saves progress.

  pip install kokoro-onnx soundfile
  python tools/voice.py --model-dir /path/with/kokoro-v1.0.int8.onnx+voices-v1.0.bin [--budget 300] [--limit 5]
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'audio')
MANIFEST = os.path.join(OUT, 'manifest.json')
VOICE, SPEED, LANG = 'af_heart', 1.05, 'en-us'


def clean(t):
    t = re.sub(r'\s+', ' ', str(t or '')).strip()
    return t.replace('—', ', ').replace('–', ', ').replace('…', '...')


def end_punct(t):
    t = clean(t)
    return t if re.search(r'[.!?]["”\']?$', t) else t + '.'


def cards():
    """Same ids/order as the app: book.id + ':' + index in the book's cards array."""
    idx = json.load(open(os.path.join(DATA, 'index.json')))
    seen = {}
    for f in idx.get('files', []):
        try:
            arr = json.load(open(os.path.join(DATA, f)))
        except Exception:
            continue
        for b in arr:
            if b and b.get('id') and b.get('title'):
                seen[b['id']] = b
    for b in seen.values():
        for i, c in enumerate(b.get('cards') or []):
            if c and c.get('text'):
                yield b['id'] + ':' + str(i), b, c


def scenes(b, c):
    q = c.get('type') == 'quote'
    author = clean(b.get('author'))
    out = [('idea', end_punct(c['text']) + (' ' + author + '.' if q and author else ''))]
    if c.get('meaning'):
        out.append(('meaning', end_punct(c['meaning'])))
    if c.get('apply'):
        out.append(('apply', 'Try this. ' + end_punct(c['apply'])))
    out.append(('end', clean(b['title']) + (', by ' + author + '.' if author else '.')))
    return out


def digest(sc):
    return hashlib.sha1(('|'.join(r + ':' + t for r, t in sc) + VOICE + str(SPEED)).encode()).hexdigest()[:10]


def folder(cid):
    return re.sub(r'[^A-Za-z0-9_-]', '-', cid.replace(':', '_'))


def trim(s, sr):
    import numpy as np
    a = np.abs(s)
    nz = np.where(a > 0.012)[0]
    if not len(nz):
        return s
    pad = int(sr * 0.07)
    return s[max(0, nz[0] - pad): min(len(s), nz[-1] + pad)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model-dir', default='.')
    ap.add_argument('--budget', type=float, default=300, help='minutes')
    ap.add_argument('--limit', type=int, default=0, help='max cards to render this run (0 = all)')
    ap.add_argument('--only', default='', help='render only card ids starting with this')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    todo = []
    for cid, b, c in cards():
        sc = scenes(b, c)
        if a.only and not cid.startswith(a.only):
            continue
        if man.get(cid, {}).get('h') != digest(sc):
            todo.append((cid, sc))
    print(f'{len(todo)} cards to render ({len(man)} already done)', flush=True)
    if not todo:
        return
    import numpy as np, soundfile as sf
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(a.model_dir, 'kokoro-v1.0.int8.onnx'), os.path.join(a.model_dir, 'voices-v1.0.bin'))
    t0 = time.time(); done = 0
    for cid, sc in todo:
        if a.limit and done >= a.limit:
            break
        if (time.time() - t0) / 60 > a.budget:
            print('time budget reached, stopping', flush=True)
            break
        fol = folder(cid); os.makedirs(os.path.join(OUT, fol), exist_ok=True)
        ent = {'h': digest(sc), 'f': fol, 's': []}
        for role, text in sc:
            s, sr = k.create(text, voice=VOICE, speed=SPEED, lang=LANG)
            s = trim(s, sr)
            with tempfile.TemporaryDirectory() as td:
                wav = os.path.join(td, 'x.wav'); sf.write(wav, s, sr)
                dst = os.path.join(OUT, fol, role + '.m4a')
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-ar', '24000', '-movflags', '+faststart', dst], check=True)
            ent['s'].append({'r': role, 'd': round(len(s) / sr, 2)})
        man[cid] = ent; done += 1
        tmp = MANIFEST + '.tmp'
        json.dump(man, open(tmp, 'w'), separators=(',', ':')); os.replace(tmp, MANIFEST)
        print(f'[{done}/{len(todo)}] {cid} ({(time.time() - t0) / 60:.1f} min)', flush=True)
    print('done', flush=True)


if __name__ == '__main__':
    main()
