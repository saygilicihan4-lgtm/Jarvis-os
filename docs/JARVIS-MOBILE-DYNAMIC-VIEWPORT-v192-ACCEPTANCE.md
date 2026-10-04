# v192 acceptance notes

Automated acceptance requires both the general Jarvis CI and Jarvis Reference Cockpit CI
on the exact PR head. The viewport patch is presentation-only and does not replace the
separate physical iPhone screenshot acceptance gate.

Required regression points:
- native v190 loads before the v192 viewport patch;
- visible mobile dimensions follow `visualViewport` when available;
- `100lvh` cannot override the exact visible viewport height;
- legacy raster layers remain non-interactive/hidden;
- touch focus residue is cleared on coarse pointers only;
- no storage, approval, publish or payment authority is introduced.
