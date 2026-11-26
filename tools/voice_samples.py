"""Render the same Reels script in several candidate voices so a human can pick by ear."""
import asyncio, os, subprocess, traceback
OUT = 'store/voice-samples'; os.makedirs(OUT, exist_ok=True)
TEXT = ("Mr. Market is your moody business partner. "
        "Some days he's euphoric and offers you a crazy high price. Other days he's terrified and will sell you everything for pennies. "
        "Try this: before you buy anything, write down what it's really worth.")
def mp3(src, name):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '64k', f'{OUT}/{name}.mp3'], check=True)
    print('wrote', name, flush=True)

async def edge():
    import edge_tts
    for v, name, rate, pitch in [
        ('en-US-AndrewMultilingualNeural', '1-andrew-warm-storyteller', '+0%', '+0Hz'),
        ('en-US-AvaMultilingualNeural', '2-ava-friendly-host', '+0%', '+0Hz'),
        ('en-US-BrianMultilingualNeural', '3-brian-casual-podcaster', '+4%', '+0Hz'),
        ('en-US-ChristopherNeural', '4-christopher-movie-trailer', '-6%', '-6Hz'),
        ('en-GB-RyanNeural', '5-ryan-british-documentary', '+0%', '+0Hz'),
        ('en-US-AnaNeural', '6-ana-cartoon-kid', '+6%', '+0Hz'),
        ('en-US-JennyNeural', '7-jenny-upbeat', '+6%', '+2Hz')]:
        try:
            await edge_tts.Communicate(TEXT, v, rate=rate, pitch=pitch).save('/tmp/e.mp3'); mp3('/tmp/e.mp3', name)
        except Exception: traceback.print_exc()

def chatter():
    import torch, torchaudio
    from chatterbox.tts import ChatterboxTTS
    m = ChatterboxTTS.from_pretrained(device='cpu')
    for ex, cfg, name in [(0.5, 0.5, '8-chatterbox-natural'), (0.9, 0.3, '9-chatterbox-dramatic')]:
        try:
            torch.manual_seed(7); w = m.generate(TEXT, exaggeration=ex, cfg_weight=cfg)
            torchaudio.save('/tmp/c.wav', w, m.sr); mp3('/tmp/c.wav', name)
        except Exception: traceback.print_exc()

def kokoro():
    import soundfile as sf
    from kokoro_onnx import Kokoro
    k = Kokoro('model/kokoro-v1.0.int8.onnx', 'model/voices-v1.0.bin')
    for v, name, lang in [('af_heart', '10-kokoro-current', 'en-us'), ('am_puck', '11-kokoro-playful', 'en-us')]:
        s, sr = k.create(TEXT, voice=v, speed=1.0, lang=lang); sf.write('/tmp/k.wav', s, sr); mp3('/tmp/k.wav', name)

async def gb():
    import edge_tts
    for v, name, rate, pitch in [
        ('en-GB-LibbyNeural', 'A-libby-soft', '-4%', '-2Hz'),
        ('en-GB-SoniaNeural', 'B-sonia-warm', '-6%', '-3Hz'),
        ('en-GB-SoniaNeural', 'C-sonia-bright', '+0%', '+0Hz'),
        ('en-GB-LibbyNeural', 'D-libby-natural', '+0%', '+0Hz')]:
        try:
            await edge_tts.Communicate(TEXT, v, rate=rate, pitch=pitch).save('/tmp/e.mp3'); mp3('/tmp/e.mp3', name)
        except Exception: traceback.print_exc()

import sys
for part in sys.argv[1:]:
    try:
        {'gb': lambda: asyncio.run(gb()), 'edge': lambda: asyncio.run(edge()), 'chatter': chatter, 'kokoro': kokoro}[part]()
    except Exception: traceback.print_exc()
