# Avatar studio and isolated security checks v198

Settings → Avatar studio accepts local PNG/JPEG/WebP images up to 2 MiB.
Users can name and assign an image to NOVA/JARVIS/ORION, remove it, and preview
it on black with optional horizontal mirroring. Celebrity images are not
automatically sourced or licensed. The UI requires a usage-rights attestation,
not proof or a grant of rights. It identifies the result as an AI avatar, not
the real person. No likeness-based execution privileges are granted.

Images stay in this browser's localStorage. They are not uploaded or synced
across devices. Shared browser profiles share this local data. Invalid data,
SVG/HTML and files exceeding limits are rejected. Decoding occurs before save;
quota failure is surfaced. File-selection races are fenced by revision IDs.

This is **2D image presentation**, not generative human animation, lip-sync,
voice cloning, volumetric holography, or automatic projector pairing. State
glow reacts to the existing cockpit state. A physical projection/reflection
setup must be provided separately. No paid service is introduced.

Settings → Security checks displays local browser capabilities, not proof of
an authenticated or secure deployment. `npm run security:check` executes a
fixed allowlist of six isolated repository regression tests, without shell
commands or caller-supplied targets. It reports pass/fail without dumping logs
or credentials. CI runs this command. Failures result in nonzero exit status.

Not implemented: dark-web access, external reconnaissance/scanning, automatic
remediation, avatar generation, real-time facial/lip animation or celebrity
voice reproduction. External tests require explicit target authorization and
scope; this release provides no external-target executor.

Automated browser tests are not physical iPhone/Windows/projector acceptance.
