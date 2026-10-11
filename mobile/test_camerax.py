"""Exercise the real CameraX bridge/capture on an emulator, not card accuracy."""
import json, subprocess, time, urllib.request
from pathlib import Path
import websocket
from PIL import Image, ImageChops

def adb(*args):
    return subprocess.check_output(['adb', *args]).decode().strip()

adb('shell', 'pm', 'grant', 'fr.craftdrop.tcgtest2', 'android.permission.CAMERA')
pid=adb('shell','pidof','fr.craftdrop.tcgtest2').split()[0]
sockets=adb('shell','cat','/proc/net/unix')
socket=next(line.split()[-1].lstrip('@') for line in sockets.splitlines() if 'webview_devtools_remote_'+pid in line)
adb('forward','tcp:9222','localabstract:'+socket)
pages=json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
target=next(p for p in pages if p.get('type')=='page')
ws=websocket.create_connection(target['webSocketDebuggerUrl'],suppress_origin=True,timeout=90)
request_id=0
def evaluate(expression):
    global request_id
    request_id+=1
    ws.send(json.dumps({'id':request_id,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True,'awaitPromise':True}}))
    while True:
        result=json.loads(ws.recv())
        if result.get('id')!=request_id: continue
        if 'error' in result or result.get('result',{}).get('exceptionDetails'): raise RuntimeError(result)
        return result.get('result',{}).get('result',{}).get('value')

def wait(expression, seconds=75):
    deadline=time.time()+seconds
    while time.time()<deadline:
        value=evaluate(expression)
        if value:return value
        time.sleep(.5)
    raise AssertionError('Timed out: '+expression+'; status='+str(evaluate("document.querySelector('#status').textContent")))

def screenshot(name):
    Path(name).write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p']))

try:
    wait("!!(document.querySelector('#scanNav')&&window.Capacitor?.Plugins?.CardCamera)")
    evaluate("localStorage.setItem('tcgCards',JSON.stringify([{collectionId:'native-test',id:'keep',name:'Keep',buy:'12.50'}]));document.querySelector('#scanNav').click();true")
    wait("!document.querySelector('#search').disabled")
    screenshot('android-camerax-before.png')
    evaluate("document.querySelector('#start').click();true")
    wait("!document.querySelector('#cameraControls').hidden&&document.querySelector('#cameraState').textContent.includes('CameraX')")
    screenshot('android-camerax-preview.png')
    before=Image.open('android-camerax-before.png').convert('RGB');after=Image.open('android-camerax-preview.png').convert('RGB')
    bar=(0,int(before.height*.89),before.width,int(before.height*.945))
    assert ImageChops.difference(before.crop(bar),after.crop(bar)).getbbox() is None,'Native preview moved or covered bottom tabs'
    # Actual native focus command; fixed-focus emulator cameras need not report success.
    focus=evaluate("window.Capacitor.Plugins.CardCamera.focus()")
    assert isinstance(focus.get('success'),bool)
    # Native photo -> JS canvas -> production worker. No expected identity on a virtual scene.
    evaluate("document.querySelector('#capture').click();true")
    wait("!document.querySelector('#again').hidden",120)
    diagnostic=evaluate("JSON.parse(document.querySelector('#debug').textContent)")
    assert diagnostic['camera']['engine']=='CameraX',diagnostic
    assert diagnostic['camera']['captureWidth']>0 and diagnostic['camera']['captureHeight']>0
    assert evaluate("!document.querySelector('#frozenPreview').hidden")
    screenshot('android-camerax-capture.png')
    evaluate("document.querySelector('#again').click();true")
    wait("!document.querySelector('#cameraControls').hidden&&!document.querySelector('#capture').disabled&&document.querySelector('#cameraState').textContent.includes('CameraX')")
    evaluate("document.querySelector('#portfolioNav').click();true")
    assert evaluate("document.querySelector('#scanScreen').hidden")
    assert evaluate("JSON.parse(localStorage.getItem('tcgCards'))[0].buy")=='12.50'
    evaluate("document.querySelector('#scanNav').click();document.querySelector('#start').click();true")
    wait("!document.querySelector('#cameraControls').hidden")
    adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(1)
    adb('shell','am','start','-n','fr.craftdrop.tcgtest2/.MainActivity')
    wait("!document.querySelector('#start').disabled&&document.querySelector('#capture').hidden")
    logs=adb('logcat','-d','-s','CraftDropCamera:I','AndroidRuntime:E')
    assert 'CameraX still capture delivered' in logs
    assert 'FATAL EXCEPTION' not in logs
    Path('android-camerax-result.json').write_text(json.dumps({'camera':diagnostic['camera'],'focus':focus,'collectionPreserved':True,'checks':['native preview','native photo delivered to worker','restart','navigation cleanup','pause','tabs unchanged'],'limitation':'Emulator camera scene; no physical autofocus or recognition success measurement.'},indent=2))
    print('PASS CameraX emulator: native preview/capture to production worker, focus command, restart, navigation and background cleanup, unchanged tabs and local purchase price. Not physical-camera accuracy.')
finally:
    ws.close()
