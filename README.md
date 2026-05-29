# CCF Pickleball Queue Manager

Production-quality MVP web application for CCF open play queueing, court management, and registration via QR.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- MongoDB + Mongoose
- Zustand + TanStack Query
- Zod validation
- QR code generation

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
npm install
```

3. Run app:

```bash
npm run dev
```

4. Optional seed:

```bash
npm run seed
```

Seed creates a demo owner account:

- Email: `demo-admin@ccf.local`
- Password: `password123`

## Main Routes

- `/login` - admin authentication (register/login)
- `/` - Admin launchpad + game creation wizard
- `/games/[id]` - Tablet-first queue/court dashboard
- `/register/[gameId]` - public registration flow (new, existing, volunteer)
- `/register/[gameId]/success` - registration success screen
- `/leaderboard/[gameId]` - game leaderboard

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

- `POST /api/games/create`
- `GET /api/games/[id]`
- `POST /api/games/[id]/start`
- `POST /api/games/[id]/end`
- `POST /api/register/new`
- `POST /api/register/existing`

## Notes

- Authenticated user becomes the owner of newly created games.
- Game and leaderboard access is scoped to game owner.
- New player registrations generate a personal QR token and add players to queue by registration timestamp.
- End-game flow sends winners and losers to queue tail with pairing memory (`pairGroupId`).
- Email delivery is currently mocked as queued behavior in response text for MVP.

## Deploy

Deploy directly on [Vercel](https://vercel.com/new) with your MongoDB connection string configured in project environment variables.
