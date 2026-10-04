# JARVIS Mobile Dynamic Viewport v192

v192 is a presentation-only hardening layer for the approved portrait JARVIS cockpit.
It does not change the locked NOVA / JARVIS / ORION visual structure and does not add
mission, approval, publish, payment or account authority.

## Why

The native v190 cockpit removed the stretched raster presentation, but its base CSS
uses the large viewport unit (`lvh`). On iPhone browsers the visible viewport can be
smaller while browser chrome is present, so a large-viewport layout can be clipped or
appear to leave content outside the actually visible screen.

## What changes

- Measure the current `visualViewport.width` and `visualViewport.height` when present.
- Override the mobile root and native cockpit to those exact visible pixel dimensions.
- Re-sync when the iPhone browser toolbar changes size, the device rotates, or the app
  becomes visible again.
- Keep the v190 safe-area layer as the single owner of notch/home-indicator padding.
- Keep legacy v185 raster/overlay presentation hidden behind the native DOM cockpit.
- Remove coarse-pointer tap focus residue without changing mouse/keyboard behavior.
- Preserve the existing mission/action proxy boundaries.

## Evidence boundary

CI can prove syntax, loader ordering, viewport contracts and authority boundaries. It
cannot prove the final appearance on the user's physical iPhone. A post-deploy iPhone
screenshot remains a separate acceptance gate.
