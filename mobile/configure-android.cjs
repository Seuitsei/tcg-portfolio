const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'android/app/src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(file,'utf8');
if(!manifest.includes('android.permission.CAMERA'))manifest=manifest.replace('</manifest>','    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
fs.writeFileSync(file,manifest);
const wrapper=path.join(__dirname,'android/gradle/wrapper/gradle-wrapper.properties');
fs.writeFileSync(wrapper,fs.readFileSync(wrapper,'utf8').replace('gradle-8.14.3-all.zip','gradle-8.14.3-bin.zip').replace('networkTimeout=10000','networkTimeout=120000'));
