#!/usr/bin/env python3
"""Generate the fake-camera fixture used by tests/browser.cjs, from cached art."""
import sys
from pathlib import Path
import cv2,numpy as np
from PIL import Image
source=Path(sys.argv[1] if len(sys.argv)>1 else '../analysis/images/fr-swsh4.5-21.webp')
dest=Path(sys.argv[2] if len(sys.argv)>2 else '../analysis/camera.y4m')
rgb=np.array(Image.open(source).convert('RGB').resize((252,352)))
H=cv2.getPerspectiveTransform(np.float32([[0,0],[251,0],[251,351],[0,351]]),np.float32([[170,54],[405,72],[420,415],[154,426]]))
scene=cv2.warpPerspective(rgb,H,(640,480),borderValue=(45,55,48));yuv=cv2.cvtColor(scene,cv2.COLOR_RGB2YUV_I420)
with dest.open('wb') as f:
 f.write(b'YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n')
 for _ in range(100):f.write(b'FRAME\n'+yuv.tobytes())
