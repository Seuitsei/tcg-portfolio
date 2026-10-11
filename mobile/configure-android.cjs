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
gradle=gradle.replace(/versionCode \d+/, 'versionCode 2').replace(/versionName "[^"]*"/, 'versionName "1.0.1"');
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

