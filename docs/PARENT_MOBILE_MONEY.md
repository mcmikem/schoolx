# Parent mobile-money collections

SkoolMate supports parent collections for two things:

- School-fee payments recorded in the fee ledger.
- Canteen-wallet top-ups recorded in the learner's wallet and transaction history.

Each school connects its own MTN MoMo and/or Airtel Money merchant account. A parent is never charged on SkoolMate's platform merchant account. A wallet or fee balance changes only after SkoolMate verifies the provider's final status, amount, currency, and transaction reference. Repeated callbacks and status checks settle an intent only once.

## Server setup

1. Apply `supabase/migrations/202611110009_parent_mobile_money_collections.sql` to the production Supabase project.
2. Generate one stable 32-byte encryption key with `openssl rand -base64 32`.
3. Store that value as the Cloudflare Worker secret `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`. Use the same value in local `.dev.vars` when local development needs to read saved merchant credentials. Never commit the key, paste it in chat, or rotate it without re-encrypting the saved school credentials.
4. Deploy the Worker after the migration and encryption secret are present.

The settings screen shows whether encryption is configured. The app does not return provider credentials to browsers.

## School merchant setup

In **Dashboard → Settings → Messaging & Payments → In-app mobile money**:

1. Select **Sandbox** and enter the school's provider test credentials.
2. Use **Test connection**. This requests an access token only; it does not send a payment request.
3. Save and test using the provider's sandbox before switching to production.
4. Complete the provider's business approval and production onboarding. The MTN production account must use the new Uganda MTN API credentials (User ID and Credential Token) and the collection subscription key. Airtel must be approved for Uganda collections.
5. Register `https://skoolmate.omuto.org/api/payment/webhook/parent-mobile-money/` as the collection callback with the merchant account. Confirm that step in Settings before enabling live collections.
6. Select **Production**, enter the production credentials, test the connection, then choose **Save and enable live payments**.

The callback route never trusts a callback's claimed result. It asks the provider for the payment status again before crediting a ledger.

## Parent experience

Parents can enter a Ugandan mobile number and request a phone prompt for fees or canteen-wallet money. The app shows a pending state and checks the provider until it confirms the payment. If a parent closes the app, the callback can settle the payment; reopening the checkout also resumes any pending request. A failed or still-pending payment does not add credit.

The existing manual payment-claim flow remains available for cash, bank transfers, or mobile-money payments made outside SkoolMate. Staff-entered wallet top-ups remain a separate counter workflow.

## Provider readiness

- MTN production collection uses the migrated `https://momoapi.momo.africa` host and requires the Uganda `mtnuganda` target environment.
- Airtel's provider application and production collection access must be approved for Uganda before live payments are enabled.
- The payment API enforces a UGX 500 minimum and UGX 5,000,000 per-request maximum. Larger payments can be split into separate approved requests.
- Do not test production by charging a real parent's number. Use provider sandbox credentials and provider-designated test accounts first.
