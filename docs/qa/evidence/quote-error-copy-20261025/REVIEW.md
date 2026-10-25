# Independent quote-error copy retest — 2026-10-25

Actual Chrome, isolated `http://127.0.0.1:3040/`, compiled bundles supplied/restarted by the integration owner. Desktop1440×900 and emulated390×844. Source app at3003 and owner's integrated browser draft untouched. Reviewer made no repository changes.

Fixture: local-only new in-ground reinforced-concrete rectangular10×4.5×1.5m Skimmer Slim, straight internal stairs, defaults elsewhere. Form data entirely synthetic: QA Isolata, qa-release@example.invalid,0000000000,Località QA,Still considering,QA privacy acknowledgement checked,marketingOFF. No attachments.

Safety: integration owner configured the local adapter to reject every POST503 before app/backend dispatch, without credentials or email access. No successful cloud save, lead creation or email is claimed by this test.

## Before — reproduced

IT Submit and Retry produced a failed project-save message followed by the false assurance `La tua configurazione resta salvata: puoi riprovare senza perdere nulla.` EN displayed `Your configuration remains saved: you can try again without losing anything.`

Actual visible error screenshots: `before-it-alert.jpg`, `before-en-alert.jpg`. Initial top-of-form screenshots retained separately, not substituted for alert proof. Paired DOM and retry DOM receipts retained.

## After — PASS for the copy correction

After owner's two translation-line changes and successful production rebuild/restart, reloaded only the ephemeral QA page. The form was blank after reload; recreated synthetic data, adding the note `Verifica locale isolata: nessuna email da inviare.` No cross-reload form retention is claimed.

- IT Submit503 and Retry503 show `Le tue scelte e i dati inseriti restano in questa pagina. Puoi riprovare.`
- Closed only the modal, changed IT→EN in the same loaded app page and reopened. The corresponding message reads `Your selections and entered details remain on this page. You can try again.`
- EN Retry503 retains the corrected wording. False saved-assurance strings absent from captured after DOMs.
- Name, location, notes, populated email/phone fields, selected timing and privacy state retained through errors/retry/modal reopen/language. Marketing staysOFF. Email/phone values are redacted by browser DOM export, so exact plaintext comparison for those two values is not claimed from DOM alone.
- Input records in `after-fields.json`: identical across each same-language retry; across modal close/reopen/language only auto-generated React fieldIDs differ, not the captured values. Timing/privacy/marketing states are shown in afterDOMs/screenshots (Radix controls are not native inputs).

Actual full-alert screenshots: `after-it-alert.jpg`, `after-en-alert.jpg`, `after-en-mobile390-alert.jpg`; matching DOM receipts included. Mobile screenshot shows the complete wrapped corrected message and usable Retry control.

Scope: failed-save error copy and retained local form state only. Not a real quote-success/backend/email test, not performance or full release approval.

Cleanup: own Chrome tab651928529closed; viewport override reset. Parent can stop its adapter.
