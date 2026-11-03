# EGM Structural App Review

**Target:** `/Users/me/schoolx-git/README.md`  

The README has a readable hierarchy and sound Markdown formatting, but it is not an authoritative repository map.

## Major findings

- The project tree omits major route, context, hook, type, utility, billing, offline, API, and portal areas.
- Supabase schema, migrations, seeds, operational SQL, and verification files are not documented.
- Module boundaries between pages, components, hooks, contexts, API routes, Supabase, offline sync, payments, SMS, and webhooks are unspecified.
- Migration authority and seed workflow are unspecified.
- Release and deployment scripts for typecheck, regression, E2E, schema drift, leakage, Docker, Capacitor, Cloudflare, CI, and smoke tests are not surfaced.
- Subscription vocabulary is inconsistent between the table and environment-variable names.

## Positive structural evidence

The README has one clear H1, logical H2/H3 nesting, consistent lists, a valid table, and closed code blocks.
