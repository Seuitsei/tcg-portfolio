package fr.craftdrop.tcgtest2;

import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.hardware.camera2.CameraCharacteristics;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.util.Size;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.camera.camera2.interop.Camera2CameraInfo;
import androidx.camera.camera2.interop.ExperimentalCamera2Interop;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.UseCaseGroup;
import androidx.camera.core.resolutionselector.AspectRatioStrategy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.exifinterface.media.ExifInterface;
import androidx.lifecycle.LifecycleOwner;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** CameraX only. Views occupy the web scanner's bounds, never the bottom tabs. */
@OptIn(markerClass = ExperimentalCamera2Interop.class)
@CapacitorPlugin(name = "CardCamera", permissions = @Permission(alias = "camera", strings = Manifest.permission.CAMERA))
public class CardCameraPlugin extends Plugin {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService images = Executors.newSingleThreadExecutor();
    private volatile int generation;
    private ProcessCameraProvider provider;
    private FrameLayout host, viewport;
    private PreviewView previewView;
    private GuideView guide;
    private Preview preview;
    private ImageCapture imageCapture;
    private Camera camera;
    private PluginCall opening, capturing, permissionCall;
    private boolean frameBusy, streaming;
    private JSObject bounds;
    private String lensId = "";

    @PluginMethod public void start(PluginCall call) {
        ui.post(() -> {
            if (getPermissionState("camera") != PermissionState.GRANTED) {
                if (permissionCall != null) { call.reject("Autorisation caméra déjà demandée."); return; }
                permissionCall = call;
                requestPermissionForAlias("camera", call, "cameraPermission");
            } else open(call);
        });
    }
    @PermissionCallback private void cameraPermission(PluginCall call) {
        ui.post(() -> {
            if (permissionCall != call) return;
            permissionCall = null;
            if (getPermissionState("camera") == PermissionState.GRANTED) open(call);
            else call.reject("Autorise la caméra pour ouvrir le scanner.");
        });
    }
    private void open(PluginCall call) {
        close();
        final int session = generation;
        opening = call;
        bounds = call.getData();
        lensId = call.getString("deviceId", "");
        host = new FrameLayout(getContext());
        host.setClipChildren(true);
        ((ViewGroup) bridge.getWebView().getParent()).addView(host, new ViewGroup.LayoutParams(-1, -1));
        viewport = new FrameLayout(getContext());
        viewport.setBackgroundColor(Color.BLACK);
        viewport.setClipToOutline(true);
        viewport.setOutlineProvider(new android.view.ViewOutlineProvider() {
            @Override public void getOutline(View v, android.graphics.Outline o) {
                o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), 25 * getContext().getResources().getDisplayMetrics().density);
            }
        });
        host.addView(viewport, new FrameLayout.LayoutParams(1, 1));
        previewView = new PreviewView(getContext());
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        viewport.addView(previewView, new FrameLayout.LayoutParams(-1, -1));
        guide = new GuideView();
        guide.setContentDescription("Aperçu CameraX. Toucher pour faire la mise au point.");
        guide.setOnTouchListener((v, e) -> {
            if (e.getAction() == MotionEvent.ACTION_UP) {
                requestFocus(e.getX(), e.getY(), null);
                v.performClick();
            }
            return true;
        });
        viewport.addView(guide, new FrameLayout.LayoutParams(-1, -1));
        position();
        previewView.getPreviewStreamState().observe((LifecycleOwner) getActivity(), state -> {
            if (session != generation) return;
            streaming = state == PreviewView.StreamState.STREAMING;
            if (streaming && opening != null) {
                PluginCall pending = opening; opening = null;
                pending.resolve(info());
                requestFocus(previewView.getWidth() / 2f, previewView.getHeight() / 2f, null);
                Log.i("CraftDropCamera", "CameraX preview streaming");
                ui.post(sample);
            }
        });
        var future = ProcessCameraProvider.getInstance(getContext());
        future.addListener(() -> {
            if (session != generation) return;
            try {
                provider = future.get();
                // Wait for the view's real dimensions before computing its ViewPort.
                previewView.post(() -> { if (session == generation) bind(session); });
            } catch (Exception e) { failOpening("CameraX ne peut pas ouvrir cette caméra.", e); }
        }, ContextCompat.getMainExecutor(getContext()));
        ui.postDelayed(() -> { if (session == generation && opening != null) failOpening("L’aperçu caméra n’a pas démarré. Réessaie.", null); }, 15000);
    }
    private void bind(int session) {
        if (session != generation || previewView == null) return;
        if (previewView.getWidth() == 0 || previewView.getHeight() == 0 || previewView.getDisplay() == null) {
            ui.postDelayed(() -> bind(session), 16); return;
        }
        try {
            CameraSelector.Builder selector = new CameraSelector.Builder().requireLensFacing(CameraSelector.LENS_FACING_BACK);
            if (!lensId.isEmpty()) selector.addCameraFilter(infos -> {
                ArrayList<CameraInfo> selected = new ArrayList<>();
                for (CameraInfo i : infos) if (Camera2CameraInfo.from(i).getCameraId().equals(lensId)) selected.add(i);
                return selected;
            });
            int rotation = previewView.getDisplay().getRotation();
            preview = new Preview.Builder().setTargetRotation(rotation).build();
            imageCapture = new ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setJpegQuality(95).setTargetRotation(rotation)
                .setResolutionSelector(new ResolutionSelector.Builder()
                    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                    .setResolutionStrategy(new ResolutionStrategy(new Size(2560, 1920), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)).build())
                .build();
            preview.setSurfaceProvider(previewView.getSurfaceProvider());
            UseCaseGroup.Builder group = new UseCaseGroup.Builder().addUseCase(preview).addUseCase(imageCapture);
            if (previewView.getViewPort() != null) group.setViewPort(previewView.getViewPort());
            camera = provider.bindToLifecycle((LifecycleOwner) getActivity(), selector.build(), group.build());
        } catch (Exception e) { if (session == generation) failOpening("Cette caméra arrière est indisponible. Réessaie en mode automatique.", e); }
    }
    private JSObject info() {
        JSObject out = new JSObject(); out.put("engine", "CameraX");
        JSArray devices = new JSArray();
        for (CameraInfo i : provider.getAvailableCameraInfos()) {
            Camera2CameraInfo c = Camera2CameraInfo.from(i);
            Integer facing = c.getCameraCharacteristic(CameraCharacteristics.LENS_FACING);
            if (facing == null || facing != CameraCharacteristics.LENS_FACING_BACK) continue;
            String id = c.getCameraId(); float[] focal = c.getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
            JSObject d = new JSObject(); d.put("deviceId", id);
            d.put("label", "Caméra arrière " + (devices.length() + 1) + (focal != null && focal.length > 0 ? " · " + String.format(java.util.Locale.FRANCE, "%.1f mm", focal[0]) : ""));
            devices.put(d);
        }
        out.put("devices", devices); out.put("label", "CameraX · caméra arrière");
        out.put("focusMode", "native"); out.put("availableFocusModes", new JSArray(java.util.Collections.singletonList("native")));
        if (imageCapture.getResolutionInfo() != null) {
            Size size = imageCapture.getResolutionInfo().getResolution(); out.put("width", size.getWidth()); out.put("height", size.getHeight());
        }
        return out;
    }
    @PluginMethod public void setBounds(PluginCall call) {
        ui.post(() -> { bounds = call.getData(); if (host != null) position(); call.resolve(); });
    }
    private void position() {
        float scale = bridge.getWebView().getWidth() / (float) Math.max(1, bounds.optDouble("viewportWidth", 1));
        int left = bridge.getWebView().getLeft(), top = bridge.getWebView().getTop();
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(Math.max(1, (int) Math.round(bounds.optDouble("width") * scale)), Math.max(1, (int) Math.round(bounds.optDouble("height") * scale)));
        p.leftMargin = left + (int) Math.round(bounds.optDouble("x") * scale);
        p.topMargin = top + (int) Math.round(bounds.optDouble("y") * scale);
        viewport.setLayoutParams(p);
        host.setClipBounds(new Rect(left, top + (int) Math.round(bounds.optDouble("clipTop", 0) * scale), left + bridge.getWebView().getWidth(), top + (int) Math.round(bounds.optDouble("clipBottom") * scale)));
        if (imageCapture != null && previewView.getDisplay() != null) imageCapture.setTargetRotation(previewView.getDisplay().getRotation());
    }
    @PluginMethod public void setQuality(PluginCall call) {
        ui.post(() -> { if (guide != null) { guide.progress = (float) Math.max(0, Math.min(1, call.getDouble("progress", 0d))); guide.hint = call.getString("hint", "Place la carte dans le cadre."); guide.invalidate(); } call.resolve(); });
    }
    private final Runnable sample = new Runnable() {
        @Override public void run() {
            if (previewView == null) return;
            final int session = generation;
            if (streaming && !frameBusy && capturing == null && viewport.getHeight() > 0 && viewport.getWidth() > 0) {
                Bitmap full = previewView.getBitmap();
                if (full != null) {
                    frameBusy = true;
                    images.execute(() -> {
                        try {
                            RectF r = guideRect(full.getWidth(), full.getHeight());
                            Bitmap crop = Bitmap.createBitmap(full, Math.round(r.left), Math.round(r.top), Math.max(1, Math.round(r.width())), Math.max(1, Math.round(r.height())));
                            Bitmap scaled = Bitmap.createScaledBitmap(crop, 504, 704, true);
                            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); scaled.compress(Bitmap.CompressFormat.JPEG, 95, bytes);
                            JSObject out = new JSObject(); out.put("jpeg", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                            ui.post(() -> { if (session == generation) { frameBusy = false; notifyListeners("frame", out); } });
                            if (scaled != crop) scaled.recycle(); if (crop != full) crop.recycle();
                        } catch (Exception e) { ui.post(() -> { if (session == generation) frameBusy = false; }); }
                        finally { full.recycle(); }
                    });
                }
            }
            ui.postDelayed(this, 250);
        }
    };
    @PluginMethod public void focus(PluginCall call) {
        ui.post(() -> {
            if (previewView == null) { call.reject("Caméra fermée."); return; }
            requestFocus(previewView.getWidth() / 2f, previewView.getHeight() / 2f, call);
        });
    }
    private void requestFocus(float x, float y, PluginCall call) {
        if (camera == null || !streaming) { if (call != null) call.reject("Attends que l’aperçu caméra soit prêt."); return; }
        try {
            final int session = generation;
            MeteringPoint point = previewView.getMeteringPointFactory().createPoint(x, y, .18f);
            FocusMeteringAction action = new FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE).setAutoCancelDuration(3, TimeUnit.SECONDS).build();
            var future = camera.getCameraControl().startFocusAndMetering(action);
            future.addListener(() -> {
                try {
                    boolean success = future.get().isFocusSuccessful();
                    JSObject result = new JSObject(); result.put("success", success);
                    if (call != null) call.resolve(result);
                    if (session == generation) notifyListeners("focus", result);
                } catch (Exception e) { if (call != null) call.reject("Mise au point non disponible sur cet objectif."); }
            }, ContextCompat.getMainExecutor(getContext()));
        } catch (Exception e) { if (call != null) call.reject("Mise au point non disponible sur cet objectif."); }
    }
    @PluginMethod public void capture(PluginCall call) {
        ui.post(() -> {
            if (imageCapture == null || !streaming) { call.reject("La caméra n’est pas prête."); return; }
            if (capturing != null) { call.reject("Une photo est déjà en cours."); return; }
            try {
                final File file = File.createTempFile("tcg-camera-", ".jpg", getContext().getCacheDir());
                final int session = generation; capturing = call;
                imageCapture.takePicture(new ImageCapture.OutputFileOptions.Builder(file).build(), images, new ImageCapture.OnImageSavedCallback() {
                    @Override public void onImageSaved(@NonNull ImageCapture.OutputFileResults saved) {
                        try {
                            JSObject result = readPhoto(file);
                            ui.post(() -> { if (session == generation && capturing == call) { capturing = null; call.resolve(result); Log.i("CraftDropCamera", "CameraX still capture delivered"); } });
                        } catch (Exception e) { ui.post(() -> { if (capturing == call) { capturing = null; call.reject("La photo native n’a pas pu être lue."); } }); }
                        finally { file.delete(); }
                    }
                    @Override public void onError(@NonNull ImageCaptureException e) {
                        file.delete(); ui.post(() -> { if (capturing == call) { capturing = null; call.reject("Échec de capture CameraX. Réessaie."); } });
                    }
                });
            } catch (Exception e) { capturing = null; call.reject("Impossible de préparer la capture native."); }
        });
    }
    private JSObject readPhoto(File file) throws Exception {
        BitmapFactory.Options probe = new BitmapFactory.Options(); probe.inJustDecodeBounds = true; BitmapFactory.decodeFile(file.getPath(), probe);
        BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 1;
        while (Math.max(probe.outWidth, probe.outHeight) / (options.inSampleSize * 2) >= 2560) options.inSampleSize *= 2;
        Bitmap bitmap = BitmapFactory.decodeFile(file.getPath(), options);
        if (bitmap == null) throw new IllegalStateException("Invalid JPEG");
        Matrix matrix = new Matrix();
        switch (new ExifInterface(file.getPath()).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            case ExifInterface.ORIENTATION_ROTATE_90: matrix.postRotate(90); break;
            case ExifInterface.ORIENTATION_ROTATE_180: matrix.postRotate(180); break;
            case ExifInterface.ORIENTATION_ROTATE_270: matrix.postRotate(270); break;
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.postScale(1, -1); break;
            case ExifInterface.ORIENTATION_TRANSPOSE: matrix.postRotate(90); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_TRANSVERSE: matrix.postRotate(270); matrix.postScale(-1, 1); break;
        }
        Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
        if (rotated != bitmap) bitmap.recycle();
        float factor = Math.min(1f, 2560f / Math.max(rotated.getWidth(), rotated.getHeight()));
        Bitmap scaled = Bitmap.createScaledBitmap(rotated, Math.max(1, Math.round(rotated.getWidth() * factor)), Math.max(1, Math.round(rotated.getHeight() * factor)), true);
        if (scaled != rotated) rotated.recycle();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(); scaled.compress(Bitmap.CompressFormat.JPEG, 95, bytes);
        JSObject out = new JSObject(); out.put("jpeg", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)); out.put("width", scaled.getWidth()); out.put("height", scaled.getHeight()); out.put("engine", "CameraX");
        scaled.recycle(); return out;
    }
    @PluginMethod public void stop(PluginCall call) { ui.post(() -> { close(); call.resolve(); }); }
    private void failOpening(String message, Exception e) {
        if (opening != null) { PluginCall call = opening; opening = null; call.reject(message); }
        if (e != null) Log.w("CraftDropCamera", message, e);
        close();
    }
    private void close() {
        generation++; streaming = false;
        if (permissionCall != null) { permissionCall.reject("Autorisation caméra interrompue."); permissionCall = null; } ui.removeCallbacks(sample); frameBusy = false;
        if (opening != null) { opening.reject("Ouverture caméra interrompue."); opening = null; }
        if (capturing != null) { capturing.reject("Capture interrompue."); capturing = null; }
        if (provider != null) { if (preview != null) provider.unbind(preview); if (imageCapture != null) provider.unbind(imageCapture); }
        if (previewView != null) previewView.getPreviewStreamState().removeObservers((LifecycleOwner) getActivity());
        if (host != null && host.getParent() instanceof ViewGroup) ((ViewGroup) host.getParent()).removeView(host);
        host = null; viewport = null; previewView = null; guide = null; camera = null; preview = null; imageCapture = null;
    }
    @Override protected void handleOnPause() { ui.post(() -> { if (host != null) { close(); notifyListeners("paused", new JSObject()); } }); }
    @Override protected void handleOnDestroy() { ui.post(() -> { close(); images.shutdown(); }); }
    private static RectF guideRect(int width, int height) {
        float h = Math.min(height * .76f, width * .82f * 88 / 63), w = h * 63 / 88;
        return new RectF((width - w) / 2, (height - h) / 2, (width + w) / 2, (height + h) / 2);
    }
    private class GuideView extends View {
        final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float progress;
        String hint = "Place la carte dans le cadre · Touche l’image pour faire le point";
        GuideView() { super(CardCameraPlugin.this.getContext()); }
        @Override protected void onDraw(Canvas canvas) {
            float density = getResources().getDisplayMetrics().density;
            paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2 * density);
            paint.setColor(progress >= 1 ? Color.rgb(113, 231, 164) : progress > 0 ? Color.rgb(245, 187, 88) : Color.rgb(242, 117, 104));
            canvas.drawRoundRect(guideRect(getWidth(), getHeight()), 14 * density, 14 * density, paint);
            paint.setStyle(Paint.Style.FILL); paint.setColor(0xdd092020);
            canvas.drawRoundRect(new RectF(10 * density, getHeight() - 65 * density, getWidth() - 10 * density, getHeight() - 24 * density), 9 * density, 9 * density, paint);
            paint.setColor(Color.WHITE); paint.setTextSize(12 * density); paint.setTextAlign(Paint.Align.CENTER);
            CharSequence label = android.text.TextUtils.ellipsize(hint, new android.text.TextPaint(paint), Math.max(1, getWidth() - 30 * density), android.text.TextUtils.TruncateAt.END);
            canvas.drawText(label.toString(), getWidth() / 2f, getHeight() - 40 * density, paint);
            paint.setColor(Color.rgb(113, 231, 164)); canvas.drawRect(getWidth() * .2f, getHeight() - 16 * density, getWidth() * (.2f + .6f * progress), getHeight() - 12 * density, paint);
        }
    }
}
