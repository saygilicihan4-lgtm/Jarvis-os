# Human projection prototype v200

## Sourced assets

- TalkingHead: MIT JavaScript renderer, commit
  `b3e277b3b46f88e557bf28a2c5612a5b04e075c3`.
- Its `avatars/mpfb.glb`: 36,815,920 bytes. The upstream README explicitly
  identifies this specific MPFB model as CC0. It is an original female human
  character, not a celebrity. Other upstream models have different licenses
  and are deliberately not used.
- HeadAudio: MIT, commit `d3af5f9ff86ab6b2b1913d411a4e1922ec101953`.
  Its English-trained mixed-voice classifier estimates 15 mouth shapes. The
  author explicitly notes imperfect accuracy. Turkish accuracy is unverified.
- Three.js 0.180.0: MIT renderer dependency.

References:
- https://github.com/met4citizen/TalkingHead#the-indexhtml-test-app
- https://github.com/met4citizen/HeadAudio
- https://github.com/mrdoob/three.js/tree/r180

Assets load on explicit activation from pinned jsDelivr/GitHub URLs. This is
not offline installation: internet and those hosts must be reachable. No paid
TTS/AI endpoint, account, API key, voice clone or microphone capture is added.
The first model load is about 37 MB plus libraries. Intended first hardware
target is desktop rendering with video output to an existing projector.

## Behavior and limits

Settings → Avatar studio → Human avatar / Projection opens an optional scene.
Load the human model explicitly. Mirror, full-screen and hide-controls options
are available. Escape or Show controls restores controls. Full-screen support
depends on browser. Core portraits remain independent of this projection scene.

Existing relay/language audio playback passes a copy of encoded TTS audio to
the scene. The copy is decoded locally and analyzed by HeadAudio. A zero-gain
output keeps analysis running without duplicate audible speech. The original
audio output is untouched. Pause, stop, seeking and source replacement stop
analysis; play/seek completion resumes using media currentTime. Closing or
hiding the scene stops analysis. Reopening waits for a new clip.

This is estimated audio-driven mouth animation, not measured perfect phoneme
alignment. A 50–100 ms classifier delay may occur. No claim of Turkish accuracy,
celebrity likeness or voice, hardware acceptance, or volumetric holography.
Browser SpeechSynthesis fallback does not provide encoded audio to this scene.

The renderer runs at 24 FPS with an effective device-pixel ratio capped at one.
It stops while closed or hidden, including when closed during initial loading.
The encoded TTS analyzer uses trained silence prototypes (`silMode: 0`), not
microphone quiet-period calibration. Failure disposes the renderer/context;
retry remains explicit. Narrow-view grid columns use `minmax(0,1fr)` so the
WebGL canvas's intrinsic width cannot push controls outside the viewport.

The browser regression uses the actual pinned model, worklet and classifier.
Synthetic harmonic audio tests applied mesh visemes and pause-to-neutral;
it is not a recording of Turkish speech and does not measure lip accuracy.
Closing during loading, hidden playback, mirror and portrait/landscape controls
are also checked. A successful local Chromium run is not iPhone/Windows proof.

## User projector

The user photo shows a LEERFEI HY300 label. Ports, firmware, actual native
resolution, casting support and image quality were not verified from that
photo. Manuals/specs for other HY300 brands are not evidence of this exact unit.
If the unit has HDMI input, use the PC's video output and select HDMI on the
projector. First verify a normal desktop image, then open this scene and enable
full-screen. No firmware changes or purchases are required by this software.
Ordinary wall/screen projection is not an image suspended in empty air.

Physical PC/iPhone/projector verification remains outstanding.
