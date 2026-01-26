# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Docs: refresh README formatting and environment variable coverage.

## [1.3.0] - 2026-01-26

- Added admin settings for metadata options, warning banners, profile warnings, and Mattermost toggles.
- Added Mattermost notifications for morale announcements and HostHub shift reminders.
- Added configurable metadata options for groups, teams, portfolios, and custom fields.

## [1.2.2] - 2026-01-21

- Fixed mobile UI layout issues.
- Added security shifts to HostHub.
- Added backend support for 892 assignments.
- Added C-Suite group.

## [1.2.1] - 2026-01-21

- Refactored all folders under src so they are more readable.
- Broke long files into multiple components.
- Fixed bug with the edit log for admins.

## [1.2.0] - 2026-01-19

- Added a full reset option for HostHub schedules to clear and regenerate assignments.
- Added a HostHub in-development warning banner across HostHub pages.

## [1.1.0] - 2026-01-16

- Added per-user add/remove vote limits for voting events and enforced them on purchases.
- Added zero-cost voting submission flow without PayPal checkout.
- Added API-backed image serving and moved uploads to a persistent data directory by default.
- Prompt admins to refresh HostHub assignments after eligibility updates, with next-month regeneration notices.

## [1.0.2] - 2026-01-15

- Email domain authentication enabled to only allow "teambespin.us".

## [1.0.0] - 2026-01-14

- Updated all credentials to prod (Clerk, PayPal).

## [0.1.2] - 2026-01-10

- Updated npm commands to automate updates.
- Improved the README readability.
- Tightened the UI for mobile devices.

## [0.1.1] - 2025-02-27

- Added a visible app version/build stamp in the UI.
- Improved morale tool layouts for phone-sized screens.
- Tightened PayPal funding configuration and exposed gateway errors in the UI.

## [0.1.0] - 2025-11-13

- Initial release.
