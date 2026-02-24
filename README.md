# Harbor

Harbor is a safe space for users to start conversations, seek support, and connect with caring AI. Built with React Native and Expo, it leverages Supabase for authentication and data storage, and integrates with backend services for advanced AI features.

## Features
- User authentication (Supabase)
- Conversation management (create, view, preview)
- Personalized care profile greeting
- AI-powered chat and support
- Secure sign-out
- Responsive, modern UI

## Folder Structure
- `app/` — Frontend React Native app
  - `(app)/` — Main app screens (chat, conversation, onboarding)
  - `(auth)/` — Authentication screens (sign-in, sign-up)
  - `_layout.tsx` — Layout components
- `backend/` — Node.js backend services
  - `.env` — API keys and secrets (not tracked by git)
  - `src/` — Service logic, routes, middleware
- `lib/` — Supabase client setup
- `database/` — SQL schema files
- `assets/` — Static assets

## Tech Stack
- React Native (Expo)
- Supabase
- Node.js (Express)
- Anthropic API

## License
MIT

## Contributing
Pull requests and issues are welcome. Please follow code style and security best practices.

---
For questions or support, contact the maintainers or open an issue.
