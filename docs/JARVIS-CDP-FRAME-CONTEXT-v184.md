# JARVIS CDP Frame Context v184

## Purpose

Prepare a bounded, testable Chrome DevTools Protocol frame-context runtime so a later Browser Operator integration can interact with ordinary form controls that live inside cross-origin iframes.

## What v184 proves

- `Page.getFrameTree` data is flattened with a hard frame-count bound.
- Main, same-origin and cross-origin HTTP/HTTPS frames are classified explicitly.
- Non-web frames such as `about:blank`, `data:` or browser-internal schemes are not selected as cross-origin web work targets.
- Cross-origin frame execution contexts are requested through `Page.createIsolatedWorld`.
- `grantUniveralAccess` is always `false`; JARVIS does not request universal page access.
- `Runtime.evaluate` calls are bound to a concrete positive execution-context ID.
- The runtime can stop after the first truthy match to avoid unnecessary traversal.

## Truth boundary

v184 is the CDP frame-context engine and regression contract. It is intentionally not described as finished cross-origin form automation yet. Browser Operator wiring and real Windows/Chrome acceptance remain separate verification steps.

## Existing invariants

This stage does not alter host navigation: any valid HTTP/HTTPS site remains allowed. It does not alter autofill sensitivity exclusions and it does not alter final-action approval/target-verification gates.
