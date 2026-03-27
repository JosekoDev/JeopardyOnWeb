# JeopardyOnWeb
Aka. JeapordyMaxxing

JeopardyMaxxing is a real-time multiplayer Jeopardy-style game for discord calls, game nights, and events.  
A host creates a session, players join with a 6-character lobby code, and everyone stays synced live over websockets.

## What The App Does

- Lets hosts create and run live Jeopardy sessions with multiple boards
- Lets players join from phones/laptops using a lobby code
- Supports real-time buzz order, score updates, and round flow
- Includes an in-app board editor with per-user saved content
- Plays themed SFX for major game events (lobby, clue, buzz, rounds, rankings)

## Core Features

### Host Experience

- Account-based host login/signup (username + password)
- Create new game sessions
- Edit board content tied to the host account
- Select clues, open/reset buzzer, reveal answer, and mark clue done
- Adjust player scores (+/-)
- Skip board / end game flow
- Daily Double support with reveal phase
- Round summary and next-round controls
- Animated podium/final standings

### Player Experience

- Enter lobby code on landing screen
- Join with username
- Live clue view + buzzer
- Real-time score and buzz order updates
- Daily Double and round summary visibility
- Final rankings/podium

### Board Editor

- Edit board multiplier, categories, points, questions, and answers
- Add question images via URL or file upload
- Preview/remove clue image in editor
- Save content per host account in database

## Tech Stack

### Frontend

- React 19
- React Router
- Vite
- Socket.IO client
- Custom CSS (responsive/mobile-first behavior tuned for clue and lobby flows)

### Backend

- Node.js
- Express 5
- Socket.IO server (real-time game state)
- SQLite (`sqlite3`) for host accounts and per-user board content
- In-memory active session model for live games

### Infra / Deployment

- Docker multi-stage build
- `docker-compose` service for app container
- Optional Cloudflare Tunnel (`cloudflared`) service
- Persistent data mount (`./data:/app/data`) for DB/data durability

## Project Structure

```text
.
├─ client/                # React app (host/player/editor UI)
├─ server/                # Express + Socket.IO API/server
├─ data/                  # Persistent app data (DB and content files)
├─ audio/                 # Game SFX assets served by backend
├─ Dockerfile             # Multi-stage image build
└─ docker-compose.yml     # App + optional cloudflared services
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
npm --prefix client install
npm --prefix server install
```

### Run in dev mode

```bash
npm run dev
```

This starts:

- server on `http://localhost:3010`
- client (Vite) on `http://localhost:5174`

## Docker Run

```bash
docker compose up --build
```

App is available at:

- `http://localhost:3010` (same machine)
- `http://<your-lan-ip>:3010` (other devices on your Wi-Fi, if firewall allows)

## Optional Public Access (Cloudflare Tunnel)

`docker-compose.yml` includes a `cloudflared` service.  
Set this in `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=your_token_here
```

Then run compose normally. The tunnel proxies to the app service.

## Authentication & Persistence Notes

- Host auth is token-based (stored client-side)
- Board content is saved per host account in SQLite
- Live game sessions are in memory (restart clears active sessions)
- Account + saved board data persist via mounted `data` volume

## Audio SFX

SFX files are served from `/audio/*` and mapped in the client SFX module for:

- lobby success/fail
- username/join success
- clue selection
- daily double
- buzz order sounds (`buzz1`..`buzz5`)
- round done / next round
- final rankings

## Scripts

Root:

- `npm run dev` - run server + client in parallel
- `npm run build` - build client bundle
- `npm run start` - run server in production mode

Server:

- `npm --prefix server run dev` - nodemon server
- `npm --prefix server run start` - node server

Client:

- `npm --prefix client run dev` - vite dev
- `npm --prefix client run build` - vite build
- `npm --prefix client run preview` - vite preview

## Troubleshooting

- If UI or assets look stale after changes, rebuild:
  - `docker compose down`
  - `docker compose up --build`
- If devices on Wi-Fi cannot connect:
  - verify host machine IP
  - allow inbound TCP `3010` in firewall
- If audio does not play on first interaction:
  - interact with page first (browser autoplay policies can block initial playback)
