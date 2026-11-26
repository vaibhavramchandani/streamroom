# Streamroom

Browser screen sharing at up to 1080p60 for small groups, with voice. Rooms you
join by link. Built on LiveKit (media), FastAPI (API) and React (web).

```
api/       FastAPI: sign-in, rooms, invites, permissions, LiveKit tokens
web/       React + TypeScript + Tailwind: screens, media layer, design system (/design)
replica/   planning: recon, architecture, schema, design tokens, feature matrix, build log
```

## Run it locally

You need Python 3.11+, Node 20+ and a LiveKit server.

**1. Media server** (one terminal)

```bash
brew install livekit            # macOS. Or: docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev
livekit-server --dev            # ws://localhost:7880, key devkey, secret secret
```

**2. API** (second terminal)

```bash
cd api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**3. Web** (third terminal)

```bash
cd web
npm install
npm run dev                     # http://localhost:5173
```

Open http://localhost:5173 in two browser windows. Use a private window for the
second person. Sign in as two different names, create a room, open the invite
link in the other window, join the call in both, and go live.

## Tests

```bash
cd api && pytest                                 # API
cd web && npx playwright install chromium        # once
cd web && npx playwright test                    # slice, without media
cd web && MEDIA=1 npx playwright test            # with livekit-server --dev running: really streams 1080p60
```

## Going to LiveKit Cloud

Create a project at cloud.livekit.io, then put its URL, API key and secret into
`api/.env` (`LIVEKIT_URL=wss://<project>.livekit.cloud`). Nothing else changes.
To test across continents, send the invite link to someone overseas, open the
stats overlay, and compare round-trip time and frame rate.
