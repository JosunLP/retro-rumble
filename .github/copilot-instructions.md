# Copilot Instructions — Retro Rumble

## Architecture Overview

Nuxt 4 real-time retrospective tool. Single-page app (`app/pages/index.vue`) with WebSocket-driven state sync. No database — all sessions live in-memory on the server.

**Data flow:** Vue components → `useRetroSession` composable → `useWebSocket` composable → Nitro WebSocket server (`server/routes/_ws.ts`) → `SessionStore` singleton (`server/utils/sessionStore.ts`) → broadcast to all peers.

## Project Conventions

- **Package manager:** Bun (`bun install`, `bun run dev`, `bun test`)
- **Strict TypeScript:** `typescript.strict: true`, type-checked at build (`vue-tsc --noEmit`)
- **Path alias:** `~/` maps to `./app/` (configured in `bunfig.toml` and Nuxt)

### Type System (Interface-First)

All types live in `app/types/`. Interfaces prefixed with `I` (e.g., `IRetroCard`, `IRetroSession`). Constants use `as const` arrays with derived union types:

```ts
export const RETRO_COLUMNS = [
  'went-well',
  'to-improve',
  'action-items',
] as const;
export type RetroColumnType = (typeof RETRO_COLUMNS)[number];
```

WebSocket messages are fully typed in `app/types/websocket.ts` with separate client/server message types and matching payload interfaces.

### OOP Utility Classes (Shared Client/Server)

`app/utils/Participant.ts` and `app/utils/RetroSession.ts` are class-based models used by **both** client and server. They implement their corresponding `I*` interfaces and provide `toJSON()`/`fromJSON()` serialization. The server imports them directly from `../../app/utils/`.

### Composables Pattern

- `useWebSocket` — Client-only singleton (module-level `clientState`). Handles connect/reconnect/ping. Event-driven via `on(type, handler)` / `off(type, handler)`.
- `useRetroSession` — Main session state via `useState()`. Registers WebSocket handlers once per tab (guarded by `handlersRegistered` flag). Exposes all session actions (`addCard`, `voteCard`, `createGroup`, etc.).
- `useDragDrop` — HTML5 drag & drop for grouping phase. Custom MIME type `application/retro-card`.

### WebSocket Protocol

Messages follow `{ type, payload, timestamp }` structure. Client types: `session:create`, `card:add`, `group:create`, `timer:start`, etc. Server types: `session:created`, `session:updated`, `participant:joined`, etc. The server handler in `_ws.ts` uses a switch-case dispatcher. When adding new message types: add to both `ClientMessageType`/`ServerMessageType` unions, create payload interfaces, add handler in `_ws.ts`, and wire into `useRetroSession`.

### i18n

English (`en.json`) and German (`de.json`) in `i18n/locales/`. Strategy `no_prefix`. Use `const { t } = useI18n()` in components — never hardcode user-facing strings.

### Styling

Tailwind CSS with custom semantic colors (`primary`, `secondary`, `success`, `warning`, `danger`) defined in `tailwind.config.ts`. DOMPurify is used for sanitizing card content.

## Key Commands

```bash
bun install          # Install dependencies
bun run dev          # Dev server (http://localhost:3000)
bun run build        # Production build
bun run lint:fix     # ESLint with auto-fix
bun run typecheck    # Type-check without emit
bun test             # Run tests
```

## Session Lifecycle

Phases: `writing` → `grouping` → `voting` → `discussing` → `summary`. Only the host can change phases. Join codes are 6 uppercase chars from a non-confusable charset (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no O/0/I/1/l). Sessions auto-delete when the last participant leaves.

## Adding a New Feature Checklist

1. Define types/interfaces in `app/types/retro.ts`
2. Add WebSocket message types and payloads in `app/types/websocket.ts`
3. Implement server logic in `server/utils/sessionStore.ts`
4. Add message handler in `server/routes/_ws.ts` and wire into the switch-case
5. Expose action in `app/composables/useRetroSession.ts`
6. Build/update Vue components in `app/components/`
7. Add i18n keys to both `i18n/locales/en.json` and `de.json`
