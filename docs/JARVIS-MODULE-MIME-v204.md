# Production module MIME repair

Post-deploy inspection found that the production static handler served `.mjs`
as `text/html`. Module scripts require a JavaScript MIME type, so v203's human
scene could not initialize in production even though its asset bytes matched.
The dedicated browser fixture served `.mjs` correctly and missed this gap.

The real handler now serves both `.js` and `.mjs` as `application/javascript`.
The new regression executes the production HTTP handler with real static files,
checks MIME and byte equality, and verifies missing modules stay 404. It failed
on the previous server code and passed after the fix. It is included in Human
Projection CI. No auth routes or publishing permissions are changed.
