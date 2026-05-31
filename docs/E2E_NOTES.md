E2E Notes

To reduce noisy Supabase mock warnings when running Playwright locally, set the following env vars before running tests:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase URL (e.g. http://127.0.0.1:54322)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key for local Supabase or a placeholder

Example:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54322 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npm run test:e2e
```

Artifacts:
- `playwright-report/` — HTML report (open with `npx playwright show-report`)
- `test-results/` — screenshots, videos, and run metadata
- `test-artifacts.zip` — packaged copy of the above

If you want, I can open the HTML report, upload `test-artifacts.zip`, or push the committed changes to a remote branch.