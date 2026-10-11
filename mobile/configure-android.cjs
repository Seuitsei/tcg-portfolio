const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'android/app/src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(file,'utf8');
if(!manifest.includes('android.permission.CAMERA'))manifest=manifest.replace('</manifest>','    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
fs.writeFileSync(file,manifest);
const wrapper=path.join(__dirname,'android/gradle/wrapper/gradle-wrapper.properties');
fs.writeFileSync(wrapper,fs.readFileSync(wrapper,'utf8').replace('gradle-8.14.3-all.zip','gradle-8.14.3-bin.zip').replace('networkTimeout=10000','networkTimeout=120000'));

// Fixed debug-only key for updates to Test 2. Never use this public test key for production.
fs.writeFileSync(path.join(__dirname,'android/test-debug.jks'),Buffer.from(fs.readFileSync(path.join(__dirname,'test-debug-keystore.base64'),'utf8').trim(),'base64'));
const build=path.join(__dirname,'android/app/build.gradle');
let gradle=fs.readFileSync(build,'utf8');
gradle=gradle.replace(/versionCode \d+/, 'versionCode 4').replace(/versionName "[^"]*"/, 'versionName "1.1.1"');
const marker='// CraftDrop stable test signing';
if(!gradle.includes(marker))gradle += `
${marker}
android {
    signingConfigs {
        debug {
            storeFile rootProject.file('test-debug.jks')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
}
`;
fs.writeFileSync(build,gradle);


// APK-only native camera integration; generated Android project is disposable.
const nativeDir=path.join(__dirname,'android/app/src/main/java/fr/craftdrop/tcgtest2');
fs.mkdirSync(nativeDir,{recursive:true});
for(const name of ['CardCameraPlugin.java','MainActivity.java'])fs.copyFileSync(path.join(__dirname,'native-android',name),path.join(nativeDir,name));
let nativeBuild=fs.readFileSync(build,'utf8');
if(!nativeBuild.includes('// CraftDrop CameraX'))nativeBuild += `
// CraftDrop CameraX
dependencies {
    implementation 'androidx.camera:camera-camera2:1.6.2'
    implementation 'androidx.camera:camera-lifecycle:1.6.2'
    implementation 'androidx.camera:camera-view:1.6.2'
    implementation 'androidx.exifinterface:exifinterface:1.4.2'
}
`;
fs.writeFileSync(build,nativeBuild);

