# Template Project - Claude Instructions

## Project Overview

**Project**: Template Monorepo
**Repository**: Multi-package monorepo with pnpm workspaces
**Demo**: Todo list application with full-stack implementation

## Project Structure

```
apps/
├── server/     - Express.js backend (Node.js/TypeScript/Vitest)
├── ui/         - React frontend (Vite/TypeScript/Zustand)
└── mobile/     - React Native app (Expo/TypeScript/Zustand)

packages/
├── schema/     - Shared schema and types (Drizzle ORM/Zod)
└── components/ - Shared React components library

scripts/
└── init-db.sh  - Database initialization script
```

## Quick Start

```bash
# 1. Initialize database
./scripts/init-db.sh

# 2. Setup environment (copy .env.example in each package)
cp apps/server/.env.example apps/server/.env
cp packages/schema/.env.example packages/schema/.env

# 3. Run migrations
cd packages/schema && pnpm db:migrate

# 4. Start development
pnpm dev           # Server + UI
pnpm dev:mobile    # Mobile app (Expo)
```

## Claude Workflow Commands

| Command | Purpose |
|---------|---------|
| `/specify [description]` | Create Linear ticket, spec, tasks, worktree |
| `/implement [LINEAR-ID]` | Execute tasks with review gates |
| `/complete-feature [LINEAR-ID]` | Merge to main, cleanup worktree |
| `/commit-group` | Organize commits logically |

## Commands

```bash
pnpm dev              # Start server + UI concurrently
pnpm dev:mobile       # Start Expo mobile app
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm test:unit        # Run unit tests (all packages)
pnpm test:changed     # Run tests for changed packages only (Nx)
```

### Package-Specific

```bash
cd apps/[app-name]        # or cd packages/[package-name]
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm test:unit        # Run unit tests
pnpm type-check       # Type checking
pnpm lint             # Linting
```

### Database

```bash
cd packages/schema
pnpm db:generate --name migration_name   # Generate migration
pnpm db:migrate                          # Run migrations
pnpm db:studio                           # Open Drizzle Studio
```

## Architecture

### Server (apps/server)

- **Framework**: Express.js with TypeScript
- **DI Container**: Awilix
- **Validation**: Zod schemas from `@todos/schema`
- **Logging**: Colored console logger with request/error middleware
- **Pattern**: Controller → Service → Repository

### UI (apps/ui)

- **Framework**: React 18 with Vite
- **State**: Zustand with Immer middleware
- **API**: Axios with request/response interceptors
- **Error Handling**: React ErrorBoundary
- **Styling**: Tailwind CSS

### Mobile (apps/mobile)

- **Framework**: Expo SDK 54 with React Native
- **Routing**: Expo Router (file-based)
- **State**: Zustand with AsyncStorage persistence
- **Offline**: Cached data with optimistic updates

### Schema (packages/schema)

- **ORM**: Drizzle ORM with PostgreSQL
- **Validation**: Zod schemas for API contracts
- **Migrations**: Timestamp-prefixed SQL files

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://review_user:review_pass@localhost:5432/review_dev

# Server
PORT=3001

# UI
VITE_API_URL=http://localhost:3001

# Mobile
EXPO_PUBLIC_API_URL=http://localhost:3001
```

## Testing

```bash
# Recommended: Test only changed packages
pnpm test:changed

# Run specific test file (fastest)
pnpm vitest run --no-coverage [file]

# Watch mode for TDD
pnpm vitest --no-coverage [file]
```

## Logging

All packages include development logging:

- **Server**: Colored terminal output with timestamps, request logging, error middleware
- **UI**: Browser console with CSS styling, API interceptors
- **Mobile**: React Native console with emoji indicators

## Platform-Specific Files

Metro resolves files by platform extension:
- `.web.tsx` - Web only
- `.native.tsx` - iOS/Android only
- `.tsx` - Fallback/shared

### Conditional Native Imports
Never use runtime `require()` for native modules - Metro still bundles them.
Use platform-specific files instead:

```typescript
// BAD - Metro bundles both branches
if (Platform.OS !== 'web') {
  const { Something } = require('native-module');
}

// GOOD - Use platform files
// Component.tsx (web fallback)
// Component.native.tsx (native with imports)
```

## Linear Integration

**Team Name**: [YOUR_TEAM_NAME]
**Team ID**: `[YOUR_TEAM_ID]`
**Project Name**: [YOUR_PROJECT_NAME]
**Project ID**: `[YOUR_PROJECT_ID]`
**Ticket Prefix**: `[PREFIX]-`
**Team URL**: https://linear.app/[YOUR_ORG]/team/[PREFIX]/all

Use this team and project when creating Linear tickets.

## Important Reminders

1. Use `pnpm` (not npm) for package management
2. Run `pnpm test:changed` during development
3. Check existing patterns before implementing new features
4. API contracts are defined in `packages/schema/src/api/`
5. Reusable components go in `packages/components/`

## Known Issues

See `TROUBLESHOOTING.md` for common issues and solutions.
