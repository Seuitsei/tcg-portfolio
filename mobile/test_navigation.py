"""Real Android emulator smoke test: navigation pixels stay fixed while content scrolls."""
import io, subprocess, time
from pathlib import Path
from PIL import Image, ImageChops

def capture(name):
    raw = subprocess.check_output(['adb','exec-out','screencap','-p'])
    Path(name).write_bytes(raw)
    return Image.open(io.BytesIO(raw)).convert('RGB')

a = capture('android-nav-start.png')
w,h = a.size
# Pixel 6 system navigation occupies the lowest ~5%; app tabs are above it.
bar = (0, int(h*.89), w, int(h*.945))
for _ in range(3):
    subprocess.run(['adb','shell','input','swipe',str(w//2),str(int(h*.72)),str(w//2),str(int(h*.25)),'450'],check=True)
time.sleep(2)
b = capture('android-nav-down.png')
assert ImageChops.difference(a.crop(bar), b.crop(bar)).getbbox() is None, 'Tab bar moved or stretched after scrolling down'
content = (0,int(h*.2),w,int(h*.8))
assert ImageChops.difference(a.crop(content),b.crop(content)).getbbox() is not None, 'Content did not scroll: test inconclusive'
for _ in range(3):
    subprocess.run(['adb','shell','input','swipe',str(w//2),str(int(h*.25)),str(w//2),str(int(h*.72)),'450'],check=True)
time.sleep(2)
c = capture('android-nav-up.png')
assert ImageChops.difference(a.crop(bar), c.crop(bar)).getbbox() is None, 'Tab bar moved or stretched after scrolling up'
print('PASS: visible tab bar unchanged after real emulator swipes in both directions; content moved.')
