# Easy onboarding and practice guides

## Audience and design

Requested language: simple English. Designed for staff in peri-urban and rural Uganda, including people unfamiliar with apps and people using small Android phones.

- No automatic tutorial popups over school setup.
- A visible Home invitation and a permanent Help link under the user’s name.
- One short instruction at a time, concrete school examples, large controls and 16px practice inputs.
- No new videos, remote illustration assets, animation packages or paid services.
- Separate school, teacher and bursar lessons based on the person’s actual assigned roles. Other roles get phone basics, not an inferred teaching or finance role.
- A compact lesson chooser on phones, a visible lesson list on desktop, Back/Next and a next-unread-lesson action.

## Safe practice and honest progress

`/dashboard/learn/` teaches navigation, save confirmation, school setup, first learners, staff assignments, attendance, marks, fees, payments and receipt checks.

The attendance example and cash-payment exercise use pretend records held only in component state. They cannot save attendance, create a payment or send an SMS. Guide storage contains only lesson IDs, instruction index and lessons explicitly marked as read; it does not store the practice amount or change school setup status. Storage is separated by school, account and learning track. Corrupt or unavailable storage does not block the lessons. Open lessons remain usable offline; opening the page for the first time offline is not promised.

Skipping between lessons does not mark them complete. Closing the guide does not mark school setup complete. Links to real pages are explicitly distinguished from practice. The guidance avoids promises of automatic parent delivery, certified grading or reconciled dashboard totals.

## School setup improvements

- Plain-language step names, expandable examples and optional school contacts/motto grouped away from the first required fields.
- Large numbered step targets instead of tiny mobile dots; readable input sizes.
- Pause returns without jumping to the launch step or setting completion flags.
- Setup is portalled above navigation and assistant buttons so those controls cannot cover its actions.
- Restored subjects and term dates are no longer overwritten by default-setting effects. Boarding choices and completed setup steps are included in the draft.
- Setup drafts can resume for up to 30 days on the same phone/browser. Other autosave users retain the default 24-hour expiry.
- Blocked/full storage is reported without crashing. Disabled final-step autosave does not recreate a cleared draft.
- The demo setup checklist no longer invokes API cleanup or database fallback mutations just by opening Home.

## Verification boundaries

Unit tests exercise role selection, corrupt/scoped storage, explicit review progress, interactive examples, storage failure, pause, restored setup data and demo no-write behavior. Browser tests cover 320px/390px and desktop screens, offline practice, reload/resume, Help discovery, fee practice validation, setup examples and unobstructed pause. REST mutations are aborted and fail the onboarding browser suite.

Registration/authentication, all five setup steps against a real isolated database, old physical Android devices, screen-reader usability, staff invitation delivery and field trials with first-time users remain separate validation work. Browser viewport tests are not a claim that onboarding needs no human assistance in every school.
