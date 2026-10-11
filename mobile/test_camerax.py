"""Exercise the real CameraX bridge/capture on an emulator, not card accuracy."""
import json, subprocess, time, urllib.request
from pathlib import Path
import websocket
from PIL import Image, ImageChops

def adb(*args):
    return subprocess.check_output(['adb', *args]).decode().strip()

adb('shell', 'pm', 'grant', 'fr.craftdrop.tcgtest2', 'android.permission.CAMERA')
def connect():
    deadline=time.time()+60
    while time.time()<deadline:
        try:
            pid=adb('shell','pidof','fr.craftdrop.tcgtest2').split()[0]
            sockets=adb('shell','cat','/proc/net/unix')
            socket=next(line.split()[-1].lstrip('@') for line in sockets.splitlines() if 'webview_devtools_remote_'+pid in line)
            adb('forward','tcp:9222','localabstract:'+socket)
            pages=json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
            target=next(p for p in pages if p.get('type')=='page')
            return websocket.create_connection(target['webSocketDebuggerUrl'],suppress_origin=True,timeout=90)
        except Exception:time.sleep(.5)
    raise RuntimeError('WebView debugger did not become available')
ws=connect()
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

def tap(selector):
    point=evaluate("(()=>{const r=document.querySelector("+json.dumps(selector)+").getBoundingClientRect();return {x:(r.x+r.width/2)*devicePixelRatio,y:(r.y+r.height/2)*devicePixelRatio,webHeight:innerHeight*devicePixelRatio};})()")
    screen=Image.open(__import__('io').BytesIO(subprocess.check_output(['adb','exec-out','screencap','-p'])))
    # Pixel 6 fixture has equal-height status and three-button system bars.
    inset=(screen.height-point['webHeight'])/2
    adb('shell','input','tap',str(round(point['x'])),str(round(point['y']+inset)))

def screenshot(name):
    evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))")
    time.sleep(.4)
    Path(name).write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p']))

try:
    wait("!!document.querySelector('#scanNav')")
    evaluate("localStorage.setItem('tcgCards',JSON.stringify([{collectionId:'native-test',id:'keep',name:'Keep',buy:'12.50'}]));true")
    import re
    previous_version=re.search(r'versionName=(\S+)',adb('shell','dumpsys','package','fr.craftdrop.tcgtest2')).group(1)
    previous_origin=evaluate('location.origin')
    ws.close()
    # Replace the preceding signed APK, without uninstalling or clearing its data.
    adb('install','-r','mobile/android/app/build/outputs/apk/debug/app-debug.apk')
    adb('shell','am','start','-n','fr.craftdrop.tcgtest2/.MainActivity')
    ws=connect()
    wait("!!(document.querySelector('#scanNav')&&window.Capacitor?.Plugins?.CardCamera)")
    assert evaluate("JSON.parse(localStorage.getItem('tcgCards'))[0].buy")=='12.50'
    assert evaluate('location.origin')==previous_origin=='https://localhost'
    # Use Android input, as a user does, so the WebView is visibly presented.
    screen=Image.open(__import__('io').BytesIO(subprocess.check_output(['adb','exec-out','screencap','-p'])))
    adb('shell','input','tap',str(int(screen.width*.625)),str(int(screen.height*.91)))
    wait("!document.querySelector('#search').disabled")
    wait("!document.querySelector('#scanScreen').hidden&&document.querySelector('#homeScreen').hidden&&document.querySelector('#scanNav').classList.contains('active')")
    screenshot('android-camerax-before.png')
    tap('#start')
    wait("!document.querySelector('#cameraControls').hidden&&document.querySelector('#cameraState').textContent.includes('CameraX')")
    screenshot('android-camerax-preview.png')
    before=Image.open('android-camerax-before.png').convert('RGB');after=Image.open('android-camerax-preview.png').convert('RGB')
    bar=(0,int(before.height*.89),before.width,int(before.height*.945))
    assert ImageChops.difference(before.crop(bar),after.crop(bar)).getbbox() is None,'Native preview moved or covered bottom tabs'
    # Actual native focus command; fixed-focus emulator cameras need not report success.
    focus=evaluate("window.Capacitor.Plugins.CardCamera.focus()")
    assert isinstance(focus.get('success'),bool)
    # Native photo -> JS canvas -> production worker. No expected identity on a virtual scene.
    evaluate("document.querySelector('#capture').scrollIntoView({block:'center'});true")
    time.sleep(.4)
    tap('#capture')
    wait("!document.querySelector('#again').hidden",120)
    diagnostic=evaluate("JSON.parse(document.querySelector('#debug').textContent)")
    assert diagnostic['camera']['engine']=='CameraX',diagnostic
    assert diagnostic['camera']['captureWidth']>0 and diagnostic['camera']['captureHeight']>0
    assert evaluate("!document.querySelector('#frozenPreview').hidden")
    screenshot('android-camerax-capture.png')
    evaluate("document.querySelector('#again').scrollIntoView({block:'center'});true")
    tap('#again')
    wait("!document.querySelector('#cameraControls').hidden&&!document.querySelector('#capture').disabled&&document.querySelector('#cameraState').textContent.includes('CameraX')")
    tap('#portfolioNav')
    wait("document.querySelector('#scanScreen').hidden")
    assert evaluate("document.querySelector('#scanScreen').hidden")
    assert evaluate("JSON.parse(localStorage.getItem('tcgCards'))[0].buy")=='12.50'
    tap('#scanNav')
    evaluate("document.querySelector('#start').scrollIntoView({block:'center'});true")
    tap('#start')
    wait("!document.querySelector('#cameraControls').hidden")
    adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(1)
    adb('shell','am','start','-n','fr.craftdrop.tcgtest2/.MainActivity')
    wait("!document.querySelector('#start').disabled&&document.querySelector('#capture').hidden")
    logs=adb('logcat','-d','-s','CraftDropCamera:I','AndroidRuntime:E')
    assert 'CameraX still capture delivered' in logs
    assert 'FATAL EXCEPTION' not in logs
    Path('android-camerax-result.json').write_text(json.dumps({'updatedFrom':previous_version,'updatedTo':'1.1.0','origin':previous_origin,'camera':diagnostic['camera'],'focus':focus,'collectionPreserved':True,'checks':['native preview','native photo delivered to worker','restart','navigation cleanup','pause','tabs unchanged'],'limitation':'Emulator camera scene; no physical autofocus or recognition success measurement.'},indent=2))
    print('PASS CameraX emulator: native preview/capture to production worker, focus command, restart, navigation and background cleanup, unchanged tabs and local purchase price. Not physical-camera accuracy.')
finally:
    Path('android-emulator.log').write_text(adb('logcat','-d'))
    Path('android-camerax-dom.json').write_text(json.dumps(evaluate("({height:innerHeight,width:innerWidth,dpr:devicePixelRatio,screen:screen.height,homeHidden:document.querySelector('#homeScreen').hidden,scanHidden:document.querySelector('#scanScreen').hidden,stage:document.querySelector('.stage').getBoundingClientRect().toJSON(),capture:document.querySelector('#capture').getBoundingClientRect().toJSON(),body:document.body.innerText.slice(0,1800)})"),indent=2))
    ws.close()
