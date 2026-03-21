# Familienrezepte

A mobile-first German recipe management app for personal/family use.

> **Note:** This is a personal project, built with AI assistance, intended for self-deployment.

## Tech Stack

- Next.js 16 (App Router)
- PostgreSQL (raw SQL, no ORM)
- Tailwind CSS + shadcn/ui
- JWT authentication with shared PIN

## Features

- Recipe management with ingredients and instructions
- AI-powered recipe import from images/URLs
- AI image generation for recipes
- Adjustable servings with ingredient scaling

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

```
DATABASE_URI=postgresql://...
SESSION_SECRET=...
REPLICATE_API_TOKEN=...
```

## API Access

External services can access recipes via API keys. Create and manage keys under **Einstellungen > API-Schlüssel**.

Authenticate with the `Authorization: Bearer` header:

```bash
# List recipes
curl -H "Authorization: Bearer rz_yourkey" https://your-host/api/recipes

# Get single recipe
curl -H "Authorization: Bearer rz_yourkey" https://your-host/api/recipes/<id>

# List tags
curl -H "Authorization: Bearer rz_yourkey" https://your-host/api/tags

# Export all recipes
curl -H "Authorization: Bearer rz_yourkey" https://your-host/api/export
```

The recipe list endpoint omits base64 image data when accessed via API key.

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Run ESLint
```
