#!/usr/bin/env python3
"""Pre-render the Reels narration in the "Sonia" voice (Microsoft en-GB-SoniaNeural).

Uses the official Azure Speech API when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set (free tier),
otherwise the free edge-tts route.

Writes data/audio/<card>/<role>.m4a and data/audio/manifest.json. Safe to re-run: only cards that are
new or whose text changed are rendered. Stops cleanly when the time budget runs out and saves progress.

  pip install edge-tts
  python tools/voice.py [--budget 300] [--limit 5]
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'audio')
MANIFEST = os.path.join(OUT, 'manifest.json')
VOICE, SPEED, LANG = 'en-GB-SoniaNeural', 1.0, 'en-gb'


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
    ap.add_argument('--model-dir', default='.')  # unused, kept for old invocations
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
    import asyncio, urllib.request
    from xml.sax.saxutils import escape as xesc
    key, region = os.environ.get('AZURE_SPEECH_KEY'), os.environ.get('AZURE_SPEECH_REGION')
    print('engine:', 'azure' if key and region else 'edge-tts', flush=True)

    def synth(text, dst_mp3):
        if key and region:
            ssml = f"<speak version='1.0' xml:lang='en-GB'><voice name='{VOICE}'>{xesc(text)}</voice></speak>"
            req = urllib.request.Request(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode(),
                headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                         'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'underline'})
            for i in range(4):
                try:
                    open(dst_mp3, 'wb').write(urllib.request.urlopen(req, timeout=60).read()); return
                except Exception:
                    if i == 3: raise
                    time.sleep(3 * (i + 1))
        import edge_tts
        for i in range(4):
            try:
                asyncio.run(edge_tts.Communicate(text, VOICE).save(dst_mp3)); return
            except Exception:
                if i == 3: raise
                time.sleep(3 * (i + 1))

    def dur(f):
        return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip() or 0)

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
            with tempfile.TemporaryDirectory() as td:
                raw = os.path.join(td, 'x.mp3'); synth(text, raw)
                dst = os.path.join(OUT, fol, role + '.m4a')
                trim = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08'
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', trim, '-c:a', 'aac', '-b:a', '40k', '-ac', '1', '-ar', '24000', '-movflags', '+faststart', dst], check=True)
            ent['s'].append({'r': role, 'd': round(dur(dst), 2)})
        man[cid] = ent; done += 1
        tmp = MANIFEST + '.tmp'
        json.dump(man, open(tmp, 'w'), separators=(',', ':')); os.replace(tmp, MANIFEST)
        if done % 10 == 0 or done == len(todo): print(f'[{done}/{len(todo)}] {cid} ({(time.time() - t0) / 60:.1f} min)', flush=True)
    print('done', flush=True)


if __name__ == '__main__':
    main()
