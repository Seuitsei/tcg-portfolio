# Web synchronization from APK 1.1.7 — 2026-11-18

Source: user-provided public.zip extracted from APK 1.1.7. This is not 1.1.8.

Ported: automatic recognition with three matching strong results and independent final verification, quality gate, serialized worker with manual priority and cancellation, detailed diagnostics, export/copy actions directly below the diagnostics heading, and capture feedback styling.

Browser adaptation: native sharing is exposed only when the Android camera adapter exists; browsers download a JSON document. Native banner bootstrap is excluded; the existing non-remunerated web banner remains. Updated cache keys for changed entry points and modules. Fixed damaged French feedback labels.

Unchanged: main index.html, collection storage keys, reference datasets, identity thresholds and ambiguity protections. All 344 reference asset paths from the APK manifest exist in the repository after removing the Android-only .asset suffix; their bytes were not independently compared.

Validation: JavaScript syntax and local module dependencies pass; sharp/blurred/stable quality test passes; three confirmations, stale-session rejection, uncertain/unavailable-result refusal and JSON export serialization pass. A Playwright camera/export/navigation smoke test was attempted but Chromium failed to launch because socket() was denied by the environment. No physical-device or Safari test performed.

Known limitations: the 1.1.7 strict stability gate may still prevent automatic analysis in real use; 1.1.8 fixes were not supplied. Remote references can still fail or delay recognition. Native CameraX latency improvements do not apply to browser getUserMedia.
