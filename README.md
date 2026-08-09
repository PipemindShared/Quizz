# Quiz Arena

A live, team-based quiz experience for company quiz nights. A host projects the
big screen, everyone else scans a QR code with their phone and plays. Quizzes are
grouped into a tournament; the tournament ends on the quiz flagged as **final**,
which triggers the championship leaderboard.

- **Tournament builder** (`/admin`) — teams (2–10) with name, icon, colour and a
  member roster; the quizzes that make up the tournament.
- **Quiz builder** (`/admin/quiz/:id`) — questions with optional images, four
  answer layouts, difficulty (1–3 points) and a per-question timer (default 20s).
- **Live game** — host screen at `/host/:gameId`, players at `/play/:code`
  (no login, QR code only).

Stack: React 19 + Vite + Tailwind v4 + framer-motion on the front end, Convex for
data, file storage and realtime sync.

## Run it

```bash
npm install
```

Then pick a backend:

**A. Local, no account needed** (what this repo is currently configured for):

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

This runs a Convex backend on `127.0.0.1:3212` and keeps `convex/_generated/` in
sync. Leave it running.

**B. Convex Cloud** — for a deployment that outlives your laptop, or players on
networks that can't reach it:

```bash
npx convex dev   # log in, create a project; rewrites .env.local
```

Then, in a second terminal:

```bash
npm run dev      # http://localhost:5173
```

## Playing from real phones

Both the Vite server and the local Convex backend bind to `0.0.0.0`, so phones
can play against a laptop with no cloud account.

**The one rule: open the host screen using the address the phones will use, not
`localhost`.** The QR code is built from `window.location.origin`, so a host on
`localhost` hands out a QR that points every phone at itself.

```bash
hostname -I | awk '{print $1}'      # e.g. 192.168.8.202
```

Open `http://<that-ip>:5173/admin` on the host machine, start a game, and the QR
code will encode `http://<that-ip>:5173/play/<code>` — which phones on the same
Wi-Fi can reach. `src/lib/convexUrl.ts` handles the other half: when the page is
served from a non-loopback host, the Convex client's `127.0.0.1` is rewritten to
that same host, so phones talk to the backend instead of to themselves. A real
`*.convex.cloud` URL is left untouched.

Two gotchas:

- **A VPN on the host can kill LAN access.** If the laptop is connected to a
  commercial VPN, enable its "allow LAN traffic" setting or disconnect it, or
  phones will not reach `192.168.x.x` at all.
- **Guest/AP-isolated Wi-Fi blocks device-to-device traffic.** Use a normal
  network, a phone hotspot, or Tailscale — a tailnet IP (`100.x.y.z`) works
  through the same rewrite and does not even need the same Wi-Fi.

Optional — change the builder passphrase (default `quiz`):

```bash
npx convex env set ADMIN_PASSPHRASE something-else
```

## A quiz night, start to finish

1. `/admin` → enter the passphrase.
2. Create a tournament, add 2–10 teams (icon, colour, member names).
3. Add a quiz, then questions. Mark the tournament's last quiz as **Final quiz**.
4. Hit **Start live game** on a quiz → you land on the host screen showing a QR
   code and join code.
5. Players scan, pick their team, pick or type their name, and land in the lobby.
   The host sees the per-team join counts fill up.
6. Host starts. Each question runs on a shared timer; it closes when time runs out
   or everyone has answered, then the reveal shows the vote distribution as dots
   in team colours (fastest answers land first) and the fastest correct player.
7. After the last question: team totals for the quiz, then the cumulative
   championship leaderboard. If the quiz was the final one, the tournament is
   closed out with the champion celebration.

## Scoring

- A correct answer earns the question's points: 1 Easy, 2 Normal, 3 Hard.
- **A team's score for a quiz is the average of its players' totals** — players
  who joined but never answered count as 0, so a big team of guessers does not
  beat a small sharp one.
- Championship total is the sum of a team's per-quiz scores across the tournament.
- Free-text answers ignore case, accents and punctuation, and the builder can add
  extra accepted spellings.

## Layout

```
convex/            data model, queries, mutations (see ARCHITECTURE.md §6)
src/admin/         tournament + quiz builders, passphrase gate
src/host/          the projected big screen, one component per game phase
src/player/        the phone experience
src/components/    shared UI (Backdrop, TeamBadge, ImageUpload, StorageImage)
src/lib/           helpers: text normalisation, countdown, confetti
```

`ARCHITECTURE.md` is the build contract: design tokens, the game state machine,
scoring rules and the full Convex API surface.
