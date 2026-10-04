# JARVIS Deep Form Surfaces v183

JARVIS Browser Operator keeps unrestricted navigation to valid HTTP/HTTPS sites and extends active browser form work into modern page surfaces.

## Supported in v183

- normal document DOM
- open Shadow DOM roots, recursively discovered with a bounded scan
- same-origin iframe documents, recursively discovered with a bounded scan
- nested combinations of same-origin frames and open shadow roots
- form field matching, safe learned autofill and approved text-button clicks on those surfaces
- realm-correct input/change events for same-origin iframe controls

## Not claimed

Cross-origin iframe contents remain isolated by browser origin policy in this version. v183 reports `crossOriginFrames: false` rather than pretending those contents are controllable through page JavaScript. A future CDP frame-session implementation can handle that separately.

Closed Shadow DOM is also not claimed because page JavaScript cannot enumerate a closed shadow root after creation.

## Existing invariants

Opening a site alone never triggers saved profile autofill. Sensitive values remain excluded from learned memory. Consequential final actions remain behind the existing approval gate and target-verification flow. Any valid HTTP/HTTPS host remains navigable; v183 does not restore a host allowlist.
