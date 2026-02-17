# Retro Rumble 🔄

A modern Scrum Retrospective tool for agile teams, built with Nuxt 4, TypeScript and Tailwind CSS. Part of the growing scrum app stack alongside [Planning Poker](https://github.com/JosunLP/planning-poker).

## ✨ Features

- **Anonymous Cards**: Submit retro cards without revealing authorship
- **Real-time Collaboration**: All participants see updates instantly via WebSocket
- **3 Retro Columns**: "What went well", "What to improve", "Action Items"
- **Phase Management**: Write → Group → Vote → Discuss
- **Dot Voting**: Configurable number of votes per participant
- **Session Timer**: Built-in countdown timer for each phase
- **Join Codes**: Easy 6-character codes to join sessions
- **Responsive Design**: Optimized for desktop and mobile
- **i18n**: English and German languages

## 🛠️ Technology Stack

- **Framework**: [Nuxt 4](https://nuxt.com/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Package Manager**: [Bun](https://bun.sh/)
- **Icons**: [@nuxt/icon](https://icones.js.org/)
- **Fonts**: [@nuxt/fonts](https://fonts.nuxtjs.org/)

## 📁 Project Structure

```text
retro-rumble/
├── app/
│   ├── assets/css/        # Global styles
│   ├── components/        # Vue components
│   ├── composables/       # Reusable logic
│   ├── pages/             # Routes/pages
│   ├── types/             # TypeScript types
│   └── utils/             # Utility classes
├── i18n/locales/          # Translation files
├── server/
│   ├── routes/            # WebSocket server
│   └── utils/             # Session store
├── public/                # Static assets
├── nuxt.config.ts         # Nuxt configuration
├── tailwind.config.ts     # Tailwind configuration
└── package.json
```

## 🚀 Quick Start

### Installation

```bash
bun install
```

### Development

```bash
# Start development server (http://localhost:3000)
bun run dev
```

### Production

```bash
# Build for production
bun run build

# Test production build
bun run preview
```

## 📖 Architecture

The project follows the same DRY and OOP principles as [Planning Poker](https://github.com/JosunLP/planning-poker):

- **Composables**: Reusable logic in `composables/` (`useWebSocket`, `useRetroSession`)
- **Utility Classes**: `Participant` and `RetroSession` classes in `utils/`
- **Types**: Central TypeScript definitions in `types/`
- **WebSocket Server**: Nitro-based real-time communication via `crossws`
- **Session Store**: Server-side singleton managing all active sessions

### Security & Anonymity

- Cards are anonymous — no author information is displayed to other participants
- Join codes use non-confusable characters (no O/0, I/1/l)
- No persistent storage — sessions exist only in memory
- No authentication required — simple, friction-free usage

### Retro Flow

1. **Writing Phase**: All participants add anonymous cards to the three columns
2. **Grouping Phase**: Host groups related cards together
3. **Voting Phase**: Each participant distributes their votes
4. **Discussing Phase**: Cards sorted by votes for structured discussion

## 📄 License

MIT License
