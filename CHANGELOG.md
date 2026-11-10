# Changelog

All notable changes to SkoolMate OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature flags system for gradual rollout of new features
- App update notification component
- API versioning utilities for backward compatibility
- App version API endpoint (`/api/app-version`)
- Breaking change detection in pre-commit hooks

### Changed
- `src/proxy.ts`: Removed `NODE_ENV === "development"` check from `DEMO_MODE_ENABLED` so demo mode can be controlled via env var in production
- Pre-commit hook: Added breaking change detection (API routes, env vars, console.log usage)

### Deprecated
- None

### Removed
- None

### Fixed
- Auth sign-in flow in production (demo mode was blocked by NODE_ENV check)

### Security
- None

## [1.0.0] - 2026-11-08

### Added
- Initial release of SkoolMate OS
- Student management, attendance tracking, fee management
- Grade entry and report generation
- Parent and teacher portals
- Offline-first architecture with IndexedDB sync
- PWA support with service worker
- Multi-role access control (headmaster, teacher, bursar, parent, etc.)
- Supabase integration with RLS policies
- Android (Capacitor) and iOS (Capacitor) mobile apps
- Cloudflare Workers deployment support

### Security
- RLS policies on all 102 database tables
- CSP headers configured
- CSRF token protection
- Secret scanning with gitleaks

---

## Types of Changes

- **Added** for new features.
- **Changed** for changes in existing functionality.
- **Deprecated** for soon-to-be removed features.
- **Removed** for now removed features.
- **Fixed** for any bug fixes.
- **Security** in case of vulnerabilities.

## Versioning

We use [Semantic Versioning](https://semver.org/). Given a version number MAJOR.MINOR.PATCH:

- **MAJOR** version when you make incompatible API changes,
- **MINOR** version when you add functionality in a backwards compatible manner,
- **PATCH** version when you make backwards compatible bug fixes.

## Upgrade Policy

- Major versions may include breaking changes. Migration guides will be provided.
- Minor versions are backwards compatible and include new features.
- Patch versions are backwards compatible bug fixes only.

## Support

For upgrade assistance, contact: support@skoolmate.org