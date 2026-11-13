from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, hashlib

ROOT = Path(__file__).parent
OUT = ROOT / 'poses-v1'
OUT.mkdir(exist_ok=True)
sheet = Image.open(ROOT / 'bashlingo-poses-v1.png').convert('RGBA')
assert sheet.size == (1254, 1254)
cells = [sheet.crop((c*418, r*418, (c+1)*418, (r+1)*418)) for r in range(3) for c in range(3)]

# Composite only the generated moving regions; preserve the stationary pixels.
def region(base, source, box):
    mask = Image.new('L', base.size)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    return Image.composite(source, base, mask)

blink = [cells[0], region(cells[0], cells[1], (192, 60, 279, 97)), region(cells[0], cells[2], (192, 60, 279, 97))]
wave = [cells[3], region(cells[3], cells[4], (274, 106, 376, 239)), region(cells[3], cells[5], (274, 106, 376, 239))]
names = ['idle', 'blink-half', 'blink-closed', 'wave-out', 'wave-center', 'wave-in', 'thinking', 'explaining', 'success']
frames = blink + wave + cells[6:]
for name, frame in zip(names, frames):
    frame.save(OUT / (name + '.png'))

sequences = {
    'blink': {'indices': [0,1,2,1,0], 'durations': [3200,80,110,80,730]},
    'wave': {'indices': [3,4,5,4,3,4,5,4,3], 'durations': [500,120,180,120,180,120,180,120,1680]},
}
for name, data in sequences.items():
    images = [frames[i] for i in data['indices']]
    images[0].save(OUT / (name + '.webp'), save_all=True, append_images=images[1:], duration=data['durations'], loop=0, lossless=True)
    images[0].save(OUT / (name + '.apng'), format='PNG', save_all=True, append_images=images[1:], duration=data['durations'], loop=0, disposal=0, blend=0)
    with Image.open(OUT / (name + '.apng')) as encoded:
        actual = []
        for k in range(encoded.n_frames):
            encoded.seek(k)
            actual.append(encoded.info.get('duration'))
        assert sum(actual) == sum(data['durations']), (name, actual)
        data['encoded_durations_ms'] = actual
    data['total_ms'] = sum(data['durations'])

atlas = Image.new('RGBA', (1254,1254))
for i, frame in enumerate(frames):
    atlas.paste(frame, ((i%3)*418,(i//3)*418))
atlas.save(OUT / 'spritesheet.png')
preview = Image.new('RGB',(1254,1254),'#fffef9')
preview.paste(atlas,mask=atlas.getchannel('A'))
preview.resize((900,900)).save(OUT / 'contact-sheet.jpg')
record = {'cell_size': [418,418], 'order': names, 'sequences': sequences,
          'reference_sha256': hashlib.sha256((ROOT/'bashlingo-marten-v3.png').read_bytes()).hexdigest(),
          'files': {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.suffix in ['.png','.webp','.apng']},
          'scope': 'Authored preview timing; no app runtime contract or integration. Two small pose animations, not full skeletal animation.'}
(OUT/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(frames),'size':list(atlas.size),'sequences':sequences},indent=2))
