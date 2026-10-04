# JARVIS Browser Any-Site v181

## Goal

JARVIS must be able to navigate normal web sites without a fixed domain allowlist. Site access itself is not the approval boundary.

## Navigation policy

- Any syntactically valid `http://` or `https://` URL may be opened by Browser Operator.
- YouTube, Shopify, account-registration pages, dashboards and arbitrary public web sites use the same navigation path.
- Non-web URL schemes such as `file:`, `javascript:`, `data:` and browser-extension schemes are rejected.
- `status()` exposes `anyHttpSite: true` and `allowedHosts: ['*']` so old clients can detect the widened policy without guessing.

## Action policy

Browsing, reading pages, taking a page snapshot and filling non-sensitive form fields are preparation actions. They do not require a domain-specific permission prompt.

A consequential final action remains a separate boundary. Existing mission approval/verification gates continue to control final submit/click flows, including account creation/registration, YouTube publishing, Shopify publishing and other actions that create an external commitment.

JARVIS should prepare as much as possible before asking the user. The approval request should be grouped at the final binding step rather than interrupting for every ordinary field.

## Sensitive fields

Persistent browser missions must not store or invent passwords, OTP/verification codes, API secrets, payment-card data, CVV/CVC, IBAN/bank-account data or similar secrets. If a site requires one of these, the user supplies it through the site's normal secure interaction; this is input/authentication, not a replacement for the final-action approval gate.

## Safety invariant

v181 removes the domain allowlist only. It does not remove final-action approval, target verification or high-risk action safeguards.
