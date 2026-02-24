# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture

**Familienrezepte** - A mobile-first German recipe management app built with Next.js 16 App Router.

### Tech Stack
- Next.js 16 with App Router
- Tailwind CSS + shadcn/ui components
- PostgreSQL with raw SQL (no ORM) via `pg` library
- JWT sessions with `jose` library
- Replicate API for AI features

### Key Patterns

**Database**: All tables prefixed with `recipes_` (recipes_app_settings, recipes_recipes, recipes_ingredients, recipes_tags, recipes_recipe_tags). Raw SQL queries in `lib/db/queries/`.

**Migrations** (`lib/db/migrations/`):
- `000_all.sql` is the canonical full schema for fresh database setup — always keep it in sync with the current DB structure
- When changing DB structure: update `000_all.sql` with the new schema, AND add a temporary `001_xxx.sql` (etc.) migration for existing databases that already ran the previous `000_all.sql`
- Temporary migrations (001+) can be deleted once applied to all environments

**Authentication**: Simple shared PIN authentication. PIN hashed with scrypt (`lib/auth/pin.ts`). JWT sessions stored in cookies (`lib/auth/session.ts`). Middleware protects all routes except `/login`.

**AI Features** (`lib/replicate/client.ts`):
- Recipe extraction from images/URLs using `openai/gpt-5.2` model
- Image generation using `google/nano-banana` model (16:9 aspect ratio)

**Recipe Data Flow**:
- Images stored as base64 in PostgreSQL
- Instructions stored as markdown numbered lists (auto-formatted on save)
- Ingredients have optional amount/unit fields

**Theming**:
- Uses `next-themes` for Light/Dark/System theme switching
- Theme stored in localStorage (per-device preference)
- All UI elements must include `dark:` Tailwind variants for dark mode support
- CSS variables defined in `app/globals.css` with `.dark` class selector
- ThemeProvider wraps the app in `app/layout.tsx`

### Environment Variables
```
DATABASE_URI=
SESSION_SECRET=
REPLICATE_API_TOKEN=
COOKIE_SECURE=          # Optional: set to 'false' for HTTP deployments
```
