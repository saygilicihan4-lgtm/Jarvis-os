# JARVIS Tri-Core Personality + Reactive Hologram v179

## Purpose

v179 connects the existing tri-core visual roles to the local conversation layer without creating independent agents or new authority.

- **JARVIS / İCRA / amber**: concise, operational, execution-oriented conversation style.
- **NOVA / DANIŞMAN / cyan**: calm comparison, trade-off, risk and decision-support style.
- **ORION / UZMAN / violet**: deeper technical, evidence-conscious root-cause and specialist style.

Normal conversation is routed deterministically. An explicit leading `Jarvis`, `Nova` or `Orion` selects that speaking role. The selected role may consult the other role lenses for analysis, but the answer remains one coherent response through the same system authority chain.

## Authority boundary

The three roles are presentation/personality lenses only. They do not receive independent execution, approval, publishing, credential, filesystem, network or PC authority. Mission execution continues through the existing Mission Engine / Worker / approval chain.

The local conversation prompt explicitly states this boundary and also states that the conversation channel has no action tools. Role metadata returned to desktop/mobile clients is taken from the deterministic local selector rather than model-provided metadata.

No YouTube PUBLIC or Shopify PUBLIC behavior is added or changed by v179.

## Reactive hologram

The browser adds a zero-cost native WebGL enhancement behind the existing CSS tri-core shell:

- three colored particle fields and multi-layer rings;
- energy/data bridges and moving packets during real `thinking` / `working` states;
- state-specific visual behavior for idle, listening, thinking, speaking, working, waiting and error;
- conversation-state events plus existing UI status observation;
- reduced-motion support;
- lower particle count / frame rate / device pixel ratio on lower-memory or lower-core devices;
- automatic fallback to the existing CSS shell when WebGL is unavailable.

The WebGL renderer performs no network requests and persists no command, credential or mission data.

## Evidence boundary

Automated CI can validate syntax, deterministic routing contracts, privacy/authority boundaries and browser source-level fallbacks. It cannot prove real GPU rendering, microphone behavior, Windows audio, or iPhone playback on a physical device. Those remain final device acceptance tests.
