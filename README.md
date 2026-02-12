# Retro Rumble 🎯

A modern, secure, and anonymous scrum retrospective application built with Nuxt 4, Bun, TypeScript, and Tailwind CSS.

## ✨ Features

- **Three-Column Retro Board**: What went well, What to improve, Action items
- **Anonymous Mode**: Optional anonymous participation for honest feedback
- **Voting System**: Vote on the most important cards with a configurable vote limit
- **Phase Management**: Writing → Grouping → Voting → Discussion → Completed
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **No Registration**: Create and join sessions instantly with a simple code
- **Privacy-Focused**: Session data is stored locally in your browser (via localStorage) and persists until you or your browser clear it; no long-term server-side storage

## 🛠️ Technology Stack

- **Framework**: [Nuxt 4](https://nuxt.com/)
- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript (strict mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [@nuxt/icon](https://icones.js.org/) with Heroicons
- **Fonts**: [@nuxt/fonts](https://fonts.nuxtjs.org/)
- **i18n**: [@nuxtjs/i18n](https://i18n.nuxtjs.org/) (English & German)
- **Content**: [@nuxt/content](https://content.nuxt.com/) (requires better-sqlite3)
- **Security**: DOMPurify (prepared for future rich text features)

## 📁 Project Structure

```
retro-rumble/
├── app/
│   ├── assets/css/        # Global styles
│   ├── components/        # Vue components
│   │   ├── CreateSessionModal.vue
│   │   ├── JoinSessionModal.vue
│   │   └── RetroColumn.vue
│   ├── composables/       # Reusable logic
│   ├── pages/             # Routes/pages
│   │   ├── index.vue      # Landing page
│   │   └── session/
│   │       └── [id].vue   # Retro session page
│   ├── types/             # TypeScript types
│   └── utils/             # Utility classes
│       ├── Participant.ts
│       └── Session.ts
├── i18n/locales/          # Internationalization
│   ├── en.json
│   └── de.json
├── public/                # Static assets
├── nuxt.config.ts         # Nuxt configuration
├── tailwind.config.ts     # Tailwind configuration
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed on your system

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

# Preview production build
bun run preview
```

## 🎮 How to Use

### Creating a Session

1. Click "Create New Session" on the landing page
2. Enter a session title and your name
3. Configure max votes per participant (default: 3)
4. Optionally enable anonymous mode
5. Share the generated session code with your team

### Joining a Session

1. Click "Join Session" on the landing page
2. Enter the 6-character session code
3. Enter your name
4. Optionally join anonymously
5. Start adding cards and voting!

### Running a Retro

1. **Writing Phase**: All participants add cards to the three columns
2. **Grouping Phase**: Group similar cards together (coming soon)
3. **Voting Phase**: Vote on the most important cards
4. **Discussion Phase**: Discuss the top-voted items
5. **Completed**: Retro is finished

## 🔒 Security & Privacy

- **No Account Required**: Start using immediately without registration
- **Anonymous Mode**: Participate without revealing your identity
- **Client-Side Storage**: Session data stored locally for privacy
- **Input Handling**: User input is rendered using Vue's escaped text interpolation (no raw HTML)
- **Temporary Sessions**: No permanent data storage

## 📖 Architecture

The project follows DRY and OOP principles inspired by [planning-poker](https://github.com/JosunLP/planning-poker):

- **Utility Classes**: `Participant` and `Session` classes for business logic in `utils/`
- **Types**: Central TypeScript definitions in `types/`
- **Components**: Reusable Vue components with clear responsibilities

## 🌍 Internationalization

Currently supported languages:
- English (en)
- German (de)

Add more languages by creating new JSON files in `i18n/locales/`.

## 🤝 Contributing

This project is part of a growing scrum app stack. Contributions are welcome!

## 📄 License

MIT License
