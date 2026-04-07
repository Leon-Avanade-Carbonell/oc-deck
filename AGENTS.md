<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Quick Commands

- **Dev server**: `bun dev`
- **Build**: `bun run build`
- **Type check & lint**: `bun run lint`
- **Production start**: `bun start`
- **Cleanup after changes**: `bun run lint` (auto-fixes where possible)

*Note: All scripts can also be run with `npm run <script>` if npm is preferred, but Bun is the canonical package manager for this repo.*

## Package Manager: Bun

This repo uses **Bun** (`bun.lock` is the source of truth, not `package.json`). Key differences:

- Install with `bun install`, not `npm install`
- Run scripts with `bun run <script>` or just `<script>` if in package.json
- Some npm packages may have installation quirks; `package.json` has `trustedDependencies` and `ignoreScripts` to work around them (`sharp`, `unrs-resolver`)
- Lock file is `bun.lock`, not `package-lock.json`

## Tooling

- **ESLint 9** with flat config format (`eslint.config.mjs`). Do not write `.eslintrc.json` or other old formats.
- **Tailwind CSS v4** with `@tailwindcss/postcss` and PostCSS. Use Tailwind utility classes in JSX (`className="..."`).
- **TypeScript 5** in strict mode. All paths must type-check; `@/*` alias maps to repo root.
- **React 19** with App Router (not Pages Router). Server Components by default — understand the boundary between server and client.

## Architecture

- **App Router** structure: `app/` contains routes; `page.tsx` is the route file, `layout.tsx` nests across routes.
- **Path alias**: `@/*` in `tsconfig.json` points to repo root, allowing `import { X } from "@/some/path"`.
- **Strict TypeScript**: `strict: true` in `tsconfig.json`. No implicit `any`, no unchecked casts.

## When Making Changes

1. Edit code as needed.
2. Before committing or submitting PR: run `bun run lint` to auto-fix style issues and verify no type errors.
