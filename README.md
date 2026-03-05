# Retro Rumble 🔄

A modern, real-time **Scrum Retrospective** tool for agile teams — anonymous, secure, and simple. Built with Nuxt 4, TypeScript, and WebSockets. Part of the growing scrum app stack alongside [Planning Poker](https://github.com/JosunLP/planning-poker).

<p align="center">
  <strong>Write → Group → Vote → Discuss → Act</strong>
</p>

---

## ✨ Features

### Core Retrospective Flow

| Phase                 | Description                                       |
| --------------------- | ------------------------------------------------- |
| **Set the Stage**     | Check-in with emoji moods to warm up the team     |
| **Gather Data**       | Submit anonymous cards to three columns           |
| **Generate Insights** | Drag & drop cards into thematic groups            |
| **Dot Voting**        | Distribute votes freely across cards and groups   |
| **Decide Actions**    | Define action items with assignees and due dates  |
| **Close Retro**       | Review summary, export results, and give feedback |

### Collaboration & UX

- **Real-time sync** — All changes broadcast instantly via WebSocket
- **Anonymous cards** — No author information revealed to participants
- **Join codes** — Easy 6-character codes (non-confusable charset, no `O/0/I/1/l`)
- **Session timer** — Built-in countdown with audio chime notification
- **Export** — Download results as JSON, Markdown, or high-quality PNG image
- **Responsive design** — Optimized for desktop and mobile
- **12 languages** — EN, DE, ES, FR, IT, JA, NL, PL, PT-BR, RU, SV, ZH-CN

### Security & Privacy

- **Zero persistence** — Sessions live in memory only, no database
- **No authentication** — Friction-free access, nothing stored
- **Input sanitization** — Server-side HTML stripping with iterative bypass protection
- **Rate limiting** — Action item and card creation limits prevent abuse
- **Phase enforcement** — Server validates all operations against the current session phase

---

## 🛠️ Tech Stack

| Layer            | Technology                                                                              |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Framework**    | [Nuxt 4](https://nuxt.com/) (Vue 3 + Nitro)                                             |
| **Language**     | TypeScript (strict mode, `vue-tsc`)                                                     |
| **Styling**      | [Tailwind CSS](https://tailwindcss.com/) + custom semantic tokens                       |
| **Real-time**    | WebSocket via [crossws](https://github.com/unjs/crossws)                                |
| **Runtime**      | [Bun](https://bun.sh/)                                                                  |
| **Icons**        | [Heroicons](https://heroicons.com/) via `@nuxt/icon`                                    |
| **i18n**         | `@nuxtjs/i18n` with 12 locales                                                          |
| **Sanitization** | [DOMPurify](https://github.com/cure53/DOMPurify) (client) + custom `stripHtml` (server) |

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
# → http://localhost:3000
```

### Production

```bash
bun run build
bun run preview
```

### Quality

```bash
bun test             # Run test suite
bun run typecheck    # Type-check (vue-tsc --noEmit)
bun run lint:fix     # ESLint with auto-fix
```

---

## 📁 Project Structure

```text
retro-rumble/
├── app/
│   ├── components/        # Vue components (RetroBoard, VotingBoard, ClusterCanvas, …)
│   ├── composables/       # Reusable logic (useWebSocket, useRetroSession, useExport, …)
│   ├── pages/             # Single-page route (index.vue)
│   ├── types/             # TypeScript interfaces & constants
│   │   ├── retro.ts       # Domain types (IRetroSession, IRetroCard, ICardGroup, …)
│   │   └── websocket.ts   # Client/server message protocol types
│   ├── utils/             # Shared OOP classes & config
│   │   ├── RetroSession.ts   # Core session logic (used by client & server)
│   │   ├── Participant.ts     # Participant model
│   │   └── columnConfig.ts    # Centralized column metadata (DRY)
│   └── assets/css/        # Global Tailwind styles
├── i18n/locales/          # 12 translation files (en, de, es, fr, it, ja, nl, pl, pt-BR, ru, sv, zh-CN)
├── server/
│   ├── routes/_ws.ts      # WebSocket message dispatcher (30+ handlers)
│   └── utils/sessionStore.ts  # In-memory session store singleton
├── tests/                 # Bun test suite (222 tests)
├── nuxt.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 🏗️ Architecture

### Data Flow

```
Vue Components → useRetroSession → useWebSocket → WebSocket Server (_ws.ts) → SessionStore → Broadcast
```

### Key Concepts

- **Interface-first types** — All domain types in `app/types/`, prefixed with `I`. Constants use `as const` arrays with derived union types.
- **Shared OOP models** — `RetroSession` and `Participant` classes implement interfaces, provide `toJSON()`/`fromJSON()` serialization, and are shared between client and server.
- **Composables** — `useWebSocket` (connection singleton with auto-reconnect), `useRetroSession` (session state + all actions), `useExport` (JSON/Markdown/PNG export), `useClusterCanvas` (drag & drop).
- **WebSocket protocol** — Typed messages `{ type, payload, timestamp }` with separate client/server message type unions in `app/types/websocket.ts`.

### Session Lifecycle

```
create → set-the-stage → gather-data → generate-insights → voting → decide-action → close-retro
```

Sessions auto-delete when the last participant disconnects and the idle TTL (30 min) expires. Participants can rejoin within this window.

---

## 🌍 Internationalization

All user-facing strings are localized via `@nuxtjs/i18n`. Currently supported:

| Language       | Code    | File         |
| -------------- | ------- | ------------ |
| English        | `en`    | `en.json`    |
| Deutsch        | `de`    | `de.json`    |
| Español        | `es`    | `es.json`    |
| Français       | `fr`    | `fr.json`    |
| Italiano       | `it`    | `it.json`    |
| 日本語         | `ja`    | `ja.json`    |
| Nederlands     | `nl`    | `nl.json`    |
| Polski         | `pl`    | `pl.json`    |
| Português (BR) | `pt-BR` | `pt-BR.json` |
| Русский        | `ru`    | `ru.json`    |
| Svenska        | `sv`    | `sv.json`    |
| 中文 (简体)    | `zh-CN` | `zh-CN.json` |

---

## 🧪 Testing

The project includes a comprehensive test suite using `bun:test`:

```bash
bun test
# 222 tests, 0 failures, 524 expect() calls across 4 files
```

Coverage includes:
- `RetroSession` — Phase management, card CRUD, voting, groups, action items, timer, deep copy safety
- `Participant` — Serialization and state transitions
- `SessionStore` — Full server-side logic including phase restrictions, rate limiting, `stripHtml` edge cases, host authorization
- Type validation — Constant correctness, validator functions

---

## 📄 License

MIT License
