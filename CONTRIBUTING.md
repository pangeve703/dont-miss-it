# Contributing to Don't Miss It

Thanks for helping out! This is a small project, and these guidelines keep it that way.

## Principles

- **Private.** No network requests with user data, no analytics, no trackers, no external
  fonts or CDNs.
- **Free to host.** Static files only, with no backend, database or API keys.
- **Lightweight.** Avoid new dependencies unless they clearly pay for themselves.
- **Honest.** The UI must never claim something happened (like a notification) that didn't.
- **Accessible.** Keyboard and screen-reader friendly, sufficient contrast, reduced-motion support.

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm test
npm run build   # also type-checks
```

## Guidelines

- Keep business logic in plain TypeScript (`src/utils`, `src/services`) so it can be unit
  tested without a browser. Components should mostly display data and forward events.
- Add or update tests in `tests/` for any logic change. Date code needs special care:
  never call `new Date('YYYY-MM-DD')`. Use the helpers in `src/utils/dates.ts`.
- If you change the stored data shape, bump `SCHEMA_VERSION` and add a migration in
  `src/services/storage.ts`, so existing users never lose data.
- Match the existing code style: Composition API with `<script setup lang="ts">`, scoped
  CSS using the variables in `src/assets/main.css`.
- Keep pull requests focused. For larger changes, open an issue first to discuss.

## Reporting bugs

Use the GitHub issue templates. Include your browser, device and time zone, and never
attach real personal data or backup files.

By contributing, you agree that your contributions are licensed under the MIT License.
