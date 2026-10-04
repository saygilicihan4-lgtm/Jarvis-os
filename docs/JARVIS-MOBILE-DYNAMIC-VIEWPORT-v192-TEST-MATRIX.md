# v192 test matrix

| Layer | Automated check |
| --- | --- |
| Loader | v190 native cockpit is loaded before v192 viewport hardening |
| Viewport | visualViewport width/height drive mobile root dimensions |
| Toolbar | visualViewport resize/scroll schedules a resync |
| Legacy UI | old raster/overlay presentation remains hidden |
| Touch | coarse-pointer focus residue is cleared after pointer-up |
| Security | no persistence or consequential-action authority is added |

Physical iPhone rendering remains a separate final acceptance check.
