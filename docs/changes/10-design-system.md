# #10 Switch the screens to the shared design system

- Issue: [#10](https://github.com/sirloinbh/dev-career-portfolio/issues/10) (central tracking issue sirloinbh/project-standards#126)
- Branch: `feat/10-design-system`

## Purpose

The 8 apps agreed to use the same tokens, components, layout, and PWA settings (central ADR-0007 and ADR-0008). The method followed "Converting an existing app" in the central `docs/design-system.md` (workout-memo#160 applied it first).

## Changes — 2026-10-26

### Packages

The user installed them directly. They are the packages in the central ADR-0007 table (pre-approved on 2026-10-22) and react-router, vitest, jsdom, and Testing Library (approved on 2026-10-26). All are pinned versions, published more than 14 days ago, with `--ignore-scripts`.

- dependencies: `@sirloinbh/design-tokens` 1.0.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `radix-ui` 1.7.0, `react-router` 8.4.0, `sonner` 2.0.8, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `vaul` 1.1.2, `lucide-react` 0.468.0 → 1.52.0
- devDependencies: `tailwindcss` and `@tailwindcss/vite` 4.3.3, `vitest` 5.0.3, `jsdom` 30.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1
- Two lockfiles (root and `frontend/`): no package was removed, and only `lucide-react` changed version. Every new entry has the official registry, an integrity value, and no install script. `ioc-scan`: no suspicious entry

### Shared files (centrally managed)

They are exactly what was taken from the sync preview with this app's `features.ui` and `features.vitest` turned on centrally: 15 files in `frontend/src/components/ui/` and their tests, `components/layout/`, `lib/utils.ts` and `theme.ts`, `public/theme-init.js`, and `frontend/vitest.config.ts`.

### App code

- **Screens:** replaced the own shell (sidebar and header) with `AppShell` and added page addresses (`/`, `/settings`). Deleted the own `style.css` and use the shared tokens and `EmptyState`.
- **Entry points:** `app.tsx` (screens), `main.tsx` (rendering, and service worker registration only in the production build), and `index.css` (Tailwind, `tw-animate-css`, the shared tokens).
- **PWA:** 4 icons (the central `scripts/pwa-icons.mjs`), and the manifest, icons, light and dark `theme-color`, `viewport-fit=cover`, and the flash-prevention script in `index.html`.
- **Tests and build:** added a `test` (vitest) script and `src/test/setup.ts` to `frontend`, and the root `npm test` also runs the frontend tests. The production build leaves out test files with `tsconfig.build.json`. Added the Tailwind plugin to `vite.config.ts`.
- **Deleted the screen test in the backend:** `backend/test/app-ui.test.ts` was a temporary test that ran `main.tsx` with a fake React when Vitest did not exist. The frontend Vitest test checks the same content (title, server state, error alert, menu navigation) with real React, so it was deleted.
- **Screen test (`app.test.tsx`):** showing the server date, the server error alert, page navigation through the menu with the current page shown, and handling an unknown address.

## Verification

- Prettier, ESLint, `tsc` (all), 40 frontend tests passed, `vite build`, `ioc-scan`
- The backend tests need a DB, so they are confirmed in CI.
