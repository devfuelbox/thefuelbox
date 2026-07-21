# Contributing to Fuel Box Website

## Getting Started

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and add Supabase credentials
4. Run `npm run dev`

## Branch Strategy

- `main` — Production-ready code (protected)
- `develop` — Integration branch (protected)
- `feature/xxx` — Your feature branch (create from `develop`)

## Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-page-name
```

## Coding Rules

### Do ✅
- Use Tailwind theme tokens: `text-brand-600`, `bg-brand-50`, `text-energy-500`, `font-heading`, `font-body`
- Import shared UI from `@/components/ui`: `Button`, `Input`, `Card`, `Badge`, `Modal`, `Select`, `Spinner`
- Import layout from `@/components/layout`: `Navbar`, `Footer`
- Use hooks from `@/hooks`: `useAuth`, `useCart`, `useSupabase`, `useMediaQuery`
- Use stores from `@/store`: `useAuthStore`, `useCartStore`, `useUiStore`
- Use types from `@/types`
- Use API functions from `@/lib/api.ts`
- Work ONLY inside your assigned `src/pages/YourPage/` folder
- Each page must have an `index.tsx` as its entry point

### Don't ❌
- Don't hardcode colors — use Tailwind theme tokens only
- Don't create custom Button/Input — use shared components
- Don't call `supabase` directly in pages — use `@/lib/api.ts`
- Don't import from another person's page folder
- Don't modify shared components without asking Person #1
- Don't push directly to `main` or `develop`

## Before Committing

```bash
npm run lint
npm run build
```

Fix any errors before pushing.

## Pull Request Process

1. Push your feature branch: `git push origin feature/your-page-name`
2. Open a PR against `develop`
3. Title: `feat: add [Page Name] page`
4. In the description, list what you built
5. Person #1 will review and merge

## File Naming

- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts`
- Utilities: `camelCase.ts`
- Types: `camelCase.ts`

## Project Structure

```
src/
├── components/
│   ├── ui/       ← Shared primitives (Button, Input, Card...)
│   ├── layout/   ← Navbar, Footer, PageLayout
│   └── auth/     ← ProtectedRoute
├── pages/        ← YOUR WORK GOES HERE (one folder per page)
├── hooks/        ← Shared custom hooks
├── lib/          ← API client, utilities, constants
├── store/        ← Zustand state stores
└── types/        ← TypeScript type definitions
```
