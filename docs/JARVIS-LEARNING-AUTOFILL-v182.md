# JARVIS Learning Autofill v182

## Behavior

JARVIS Browser Operator may navigate any valid HTTP/HTTPS site. Domain access is not restricted by this feature.

When a browser form is opened, JARVIS may automatically fill empty, ordinary identity/contact fields from its local autofill profile. Supported profile classes include name, e-mail, phone, company, job title, website and postal-address fields.

When JARVIS explicitly fills one of those ordinary fields during a browser mission, the value can be learned for later forms. Learned values are kept in local user data rather than the repository/workspace. Environment variables can also provide profile values without changing site access.

## Never learned or auto-filled

The learning profile rejects passwords, OTP/verification codes, recovery/security codes, PINs, payment-card numbers, CVV/CVC, IBAN/bank-account data, routing/SWIFT data, government identity numbers, passport numbers, API keys, access tokens, secrets and private keys.

Checkboxes/radio buttons are not auto-selected. This prevents JARVIS from silently accepting terms, attestations or choices that require a user decision.

## Approval boundary

Autofill is preparation only. It does not click submit/publish/pay/register controls. Existing mission approval and final-target verification remain responsible for consequential final actions such as:

- creating an account or submitting a registration/application,
- publishing a YouTube video,
- publishing a Shopify product,
- placing an order or making a payment,
- other irreversible/high-impact final submissions.

The intended UX is: prepare and fill first, then present one final binding-action approval when the workflow is ready.

## Privacy

Autofill status reports only field classes/keys, never stored values. The local profile can be cleared without affecting the browser's ability to visit sites.
