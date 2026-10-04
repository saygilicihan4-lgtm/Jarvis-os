# JARVIS Canonical Mobile Cockpit v185

## Goal

Provide a dedicated portrait mobile cockpit instead of shrinking the desktop/reference canvas onto a phone. The mobile shell keeps the NOVA / JARVIS / ORION visual hierarchy, quick actions, active mission status, notifications, voice entry, action states and connection status visible in a phone-native layout.

## Safety and authority boundary

The v185 layer is presentation-only. It does not call Worker, publish content, approve consequential actions, persist command text, or create a second authority path. Mobile controls proxy the already-established reference cockpit hotspots, so Mission Engine / Worker / approval gates remain the only execution path.

## Runtime behavior

- Activates only for portrait viewports up to 860 px wide.
- Hides the desktop reference frame only while the portrait mobile shell is active.
- Mirrors live tri-core role and conversation state from existing body datasets.
- Mirrors localized copy from the existing reference cockpit i18n layer instead of creating a competing translation system.
- Mirrors mission queue, audit feed and PC link state from the existing cockpit DOM.
- Honors `prefers-reduced-motion`.
- Returns to the unchanged desktop/reference cockpit when the media query no longer matches.

## Verification

`mobile-canonical-cockpit-selftest.js` checks portrait activation, tri-core presence, reactive states, i18n mirroring, legacy action proxying, reduced-motion support, and the absence of direct network, storage, publish or approval authority.
