# JARVIS Safe Autofill v182

## Goal

JARVIS keeps unrestricted navigation to normal `http://` and `https://` sites while reducing repeated manual form entry during an active browser task.

## Trigger boundary

Safe autofill is **task-triggered**, not page-triggered. Merely opening or reading a site never releases saved profile values. Autofill may run only after JARVIS is already performing an explicit form-field operation through Browser Operator.

## Local profile

Reusable low-risk fields are stored locally under the JARVIS workspace in `.jarvis-memory/browser-autofill-profile.json`. The file is written atomically and JARVIS attempts to restrict permissions to the current user. Runtime status exposes only the stored canonical field names/count, never their values.

Recognized reusable fields are limited to name, email, phone, company, job title, website, city and country variants. Existing non-empty page controls are never overwritten by profile autofill.

## Never learned or replayed

Passwords/passcodes/PINs, OTP or verification codes, tokens/secrets/API keys, payment-card/CVV data, IBAN/bank-account data, national identity numbers, passport data, tax identifiers, birth-date fields and security-answer fields are excluded from learned autofill memory.

This exclusion does not prevent a user from entering a required secret through the site's normal secure interaction. It only prevents JARVIS from persisting or automatically replaying those values.

## Final-action boundary

Autofill never submits a form, publishes content, purchases anything or performs another binding final action. Existing browser mission approval and final-target verification remain the authority for consequential final clicks.

## Compatibility

Browser Operator remains version `1.1` so Worker 2.102.0 repair/bootstrap compatibility is preserved. v182 is exposed independently as `BROWSER_AUTOFILL_VERSION='1.0'` inside the Browser Operator file, which is already covered by the trusted updater and Worker bootstrap paths.
