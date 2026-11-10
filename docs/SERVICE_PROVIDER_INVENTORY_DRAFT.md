# SkoolMate Service Provider Inventory — Draft

**Status:** Code/configuration inventory only; privacy lead and procurement must verify before publication
**Prepared:** 9 November 2026
**Rule:** Presence in source code or `.env.example` does not prove that a provider is active in production, contractually approved, or receives learner data in every deployment.

| Provider / service | Evidence in this repository | Data potentially involved (verify actual payloads) | Production status, processing locations, safeguards, retention, and contract |
| --- | --- | --- | --- |
| Supabase | Application auth, database, and storage configuration; server and browser clients | Account identifiers, learner/staff/parent records, school files, authentication/session data, and uploaded media | **Owner verification required:** confirm project/region, support access, backups and expiry, DPA, subprocessors, deletion/return path, and security settings. |
| Cloudflare | Cloudflare/OpenNext deployment configuration and Worker build scripts | Request metadata, IP/device logs, application traffic, and potentially request payloads depending on logging/configuration | **Owner verification required:** confirm services enabled, region/log retention, data processing terms, access controls, and whether logs capture sensitive request content. |
| Resend | `RESEND_API_KEY`/`EMAIL_FROM`; email service and receipt/notification paths | Recipient email, message content, report/receipt attachments or links where used, delivery metadata | **Owner verification required:** confirm active account, regions, retention, DPA, subprocessor list, suppression behavior, and whether report cards are emailed. |
| Africa's Talking / configured SMS gateway | SMS API key/username and `sendAfricasTalkingSMS` implementation | Recipient phone number, SMS body (which may contain attendance, fee, OTP, or notice information), delivery ID/status | **Owner verification required:** confirm actual gateway per environment, routing/processing locations, message retention, sender identity, DPA, and limits on sensitive message content. |
| SchoolPay | SchoolPay transaction sync integration | School code, student payment code/registration number, student name, amount, payment time, receipt and transaction/channel identifiers | **Owner verification required:** confirm which schools use the integration, credential storage, API terms, payload retention, processing location, and reconciliation/deletion process. |
| Sentry | Sentry SDK/configuration and DSN settings | Error events, stack traces, route/device metadata, and possibly user-provided values if included in exception context | **Owner verification required:** confirm active project/region, sampling, PII scrubbing, replay/session capture status, retention, access controls, DPA, and deletion workflow. |
| Stripe | Test/config placeholders and billing routes | SkoolMate subscription contact and transaction metadata; confirm whether any school/parent/student payment data is sent | **Owner verification required:** confirm live use, exact data flow, account region, DPA, retention, and separation from learner fee collection. |
| PayPal | Test/config placeholders and billing references | SkoolMate subscription contact and transaction metadata; confirm whether this is active | **Owner verification required:** verify active use and data flow; do not infer production processing from `.env.example`. |
| MoneyUnify, MTN MoMo, Airtel Money | Mobile-money configuration and payment webhook paths | Phone/account reference, transaction identifier, amount, payment status and callback metadata | **Owner verification required:** identify enabled provider(s), actual payloads, country/region, contracts, callback security, retention, and whether money is for subscriptions or school fees. |
| Google / OAuth identity service | OAuth registration and sign-in flows | Identity claims required for sign-in (such as email and provider subject); confirm token/data retention | **Owner verification required:** confirm configured OAuth providers, consent screen, scopes, project owner, regional terms, and deletion/revocation process. |
| Google Gemini API | AI chat route and `GOOGLE_GENAI_API_KEY` configuration | User prompts and any conversation/context fields included in the API request; confirm whether learner personal data can be included | **Owner verification required:** confirm production use, exact request fields, model/data retention and training settings, region, DPA, user notice, and controls for sensitive learner data. |
| Web Push delivery (transport provider not established by source review) | Browser push subscription and send routes; VAPID configuration | Browser push endpoint/token, device metadata, and notification payload text | **Owner verification required:** identify the actual push transport and subprocessors, endpoint/token retention, payload contents, opt-in/revocation, regional processing, and DPA. |

## Verification worksheet

For every active provider, attach or link the executed agreement and record:

- Legal entity and service name, business owner, technical owner, and emergency contact.
- Exact purpose, data categories, data-subject categories, and endpoints/payloads shared.
- Whether the provider is a processor, subprocessor, or separate controller for each flow.
- Hosting and support access locations, international transfers, and transfer safeguards.
- Security controls, encryption, access restrictions, incident notice commitment, and audit evidence.
- Retention, backups, deletion/return, and evidence after termination.
- Subprocessors and change-notice process; review date and next review owner.
- School agreement terms and the public privacy-notice wording approved for this provider.

## How to complete

1. Compare this source inventory with production environment variables and Cloudflare/Supabase/provider dashboards; never paste secret values into this file.
2. Trace each active integration from route to provider payload and record redacted examples or schema references in restricted evidence storage.
3. Obtain current contracts, data processing terms, transfer terms, provider locations, retention settings, and subprocessor lists from the account owner.
4. Have the privacy lead classify controller/processor roles and review necessity, lawful basis, notices, minimisation, and safeguards with Ugandan counsel where required.
5. Publish only the approved, current subset in the privacy notice. Keep this working inventory restricted if it includes security or contract details.

This draft is not evidence of compliance or an approved provider list. Do not publish it until every active service and data flow has been confirmed by its accountable owner.
