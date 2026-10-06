# Original 3D audio-reactive robot v199

Settings → Avatar studio → Toggle original 3D robot. Select NOVA, JARVIS or
ORION first. The enabled flag is local to this browser. Toggle off to restore
the photo/original sphere. Photo removal does not remove the separate 3D mode.
Projection preview offers mirror and a ±60° head rotation slider.

The original procedural robot is actual xyz triangle geometry, depth-sorted,
lit and perspective-projected onto Canvas 2D. It is not a photograph or a
celebrity model. No downloaded models, dependencies or paid APIs are added.
This is an on-screen 3D render, not a physical volumetric hologram.

The two existing browser audio playback paths pass a copy of their encoded
audio to OfflineAudioContext.decodeAudioData. Per-channel RMS is reduced to
50 samples per second and sampled using the player's currentTime. Original
playback/output routing is unchanged. Pause, seeking, end and source replacement
close the jaw. Decode failures leave the mouth closed. Encoded input is capped
at 6 MB; decoded clips longer than 120 seconds are rejected. Existing trusted
TTS responses only: no user-uploaded audio or additional network requests.

Browser speech fallback uses boundary events when emitted by the browser.
This is explicitly labelled word-event animation. Audio-energy jaw opening is
not phoneme/viseme-based lip sync. No human facial reconstruction, celebrity
voice, realistic talking human, model import or physical projection pairing is
implemented. Those remain separate work, not completed capabilities.

Idle head motion respects reduced-motion. Rendering stops in hidden documents;
disconnected canvases are dropped. Projection controls remain native HTML.
No new cybersecurity/external-target functionality is included in this release.

API reference: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData
Hardware acceptance on physical iPhone, Windows and projector is still required.
