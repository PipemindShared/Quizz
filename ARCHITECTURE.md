# Quiz Arena — architecture & build contract

Live team quiz for company employees. Three surfaces:

| Surface             | Route                  | Auth              |
| ------------------- | ---------------------- | ----------------- |
| Tournament builder  | `/admin`, `/admin/t/:tournamentId` | passphrase |
| Quiz builder        | `/admin/quiz/:quizId`  | passphrase        |
| Host big screen     | `/host/:gameId`        | none              |
| Player phone        | `/play/:code`          | none (QR code)    |

Stack: **Vite + React 19 + TypeScript**, **Tailwind v4** (CSS-first config — no
`tailwind.config.js`), **Convex** for data + realtime, **framer-motion** for
animation, **canvas-confetti**, **qrcode.react**, **lucide-react** icons.

---

## 1. Conventions (non-negotiable)

- **Tailwind v4.** All custom tokens live in `src/index.css` under `@theme`.
  Available colours: `ink`, `ink-2`, `ink-3`, `veil`, `neon`, `neon-2`, `punch`,
  `sun`, `mint`, `siren`, `sky`. Fonts: `font-display`, `font-sans`. Animations:
  `animate-float`, `animate-pulse-ring`, `animate-shimmer`, `animate-gradient`,
  `animate-pop-in`, `animate-marquee`. Component classes: `glass`, `glass-soft`,
  `btn`, `btn-primary`, `btn-ghost`, `btn-sun`, `field`, `label`, `grad-text`.
  Utilities: `no-scrollbar`, `pb-safe`, `text-balance`.
  **Never** create a `tailwind.config.js`; add new tokens to `@theme` only if
  genuinely needed.
- **Team colours are per-team hex strings from the database**, so they must be
  applied with inline `style`, not Tailwind classes.
- Imports of Convex: `import { api } from "../../convex/_generated/api"` and
  `import type { Doc, Id } from "../../convex/_generated/dataModel"`.
- Fully responsive. Player screens are **phone-first** (`pb-safe`, big tap
  targets ≥ 44px). Host screens are **large-display-first** (`text-[clamp(...)]`,
  designed for 1080p+ projection) but must not break on a laptop.
- Respect `prefers-reduced-motion` for anything continuously animating.
- No `any` unless unavoidable. `npm run build` must pass with zero TS errors.

## 2. File ownership — only touch files you own

Already written, **do not modify**:

```
src/index.css  src/main.tsx  src/App.tsx
src/lib/utils.ts  src/lib/session.ts  src/lib/useCountdown.ts  src/lib/celebrate.ts
src/components/Backdrop.tsx  src/components/StorageImage.tsx
src/components/ImageUpload.tsx  src/components/TeamBadge.tsx
convex/schema.ts  convex/_generated/*
```

Ownership:

| Owner       | Files                                              |
| ----------- | -------------------------------------------------- |
| backend     | `convex/*.ts` (except `schema.ts`, `_generated/`)   |
| admin UI    | `src/Landing.tsx`, `src/admin/**`                   |
| host UI     | `src/host/**`                                       |
| player UI   | `src/player/**`                                     |

Sub-components go **inside your own folder**. Never edit another owner's files.

## 3. Shared helpers you should use

```ts
// src/lib/utils.ts
cn(...classes)                      // clsx wrapper
normalizeAnswer(s): string          // case/accent/punctuation-insensitive
readableOn(hex): string             // "#fff" or "#0b0820"
withAlpha(hex, a): string           // "rgba(...)"
initials(name): string
TEAM_COLORS: string[]               // 10 palette swatches
DIFFICULTY: {1|2|3: {label, color}} // Easy / Normal / Hard
ANSWER_KIND_LABEL: Record<string,string>
seconds(ms), clamp(n,min,max), ordinal(n)

// src/lib/useCountdown.ts
useCountdown(startedAt?, endsAt?) -> { remainingMs, secondsLeft, ratio, expired }
// ratio: 1 at open -> 0 at timeout. Drives every progress bar.

// src/lib/session.ts
loadSession(code) / saveSession(code, s) / clearSession(code)   // PlayerSession
isAdminUnlocked() / setAdminUnlocked(bool)

// src/lib/celebrate.ts
burst(colors?) / sideCannons(colors?) / rain(colors?)

// src/components/*
<Backdrop variant="host" | "calm" tint={string[]} />   // fixed, -z-10
<StorageImage storageId={id} alt className fallback />
<ImageUpload value={id} onChange={(id?) => void} label shape="square"|"wide" />
<TeamBadge team={{_id,name,color,iconId?}} size="sm"|"md"|"lg"|"xl" ring />
```

## 4. Game state machine

```
lobby ──start──▶ question(0) ──time up / all answered──▶ reveal(0)
                     ▲                                      │
                     └──────────advance (more Qs)────────────┘
                                                            │ advance (last Q)
                                                            ▼
finished ◀──advance── leaderboard ◀──advance── round_results
                           ▲                          │ final quiz only
                           └── advance (last slide) ── recap ◀┘  (one slide per advance)
```

- `lobby` — host shows QR + live per-team join counts. Players pick team → name → wait.
- `question` — prompt on both screens, countdown bar. Player submits once.
- `reveal` — vote distribution, right/wrong, best player.
- `round_results` — team totals **for this quiz**. Writing `gameResults` happens
  on entry to this phase, along with a `quizStats` snapshot of the game's
  answers. On the final, the whole-tournament `tournamentRecaps` doc is built
  from those snapshots in the same step (`convex/recap.ts`).
- `recap` — final quiz only: "Awards Night", a slideshow stepped by
  `games.recapStep` (tournament numbers, race chart, team and player awards,
  question awards, countdown from last place). `recapBack` / `skipRecap` let the
  host go back a slide or jump to the champion. Phones show the player's own
  tournament card.
- `leaderboard` — cumulative championship standings for the tournament. If
  `quiz.isFinal`, this is the tournament finale (champion celebration) and the
  tournament is marked completed.
- `finished` — archived.

## 5. Scoring

- Player earns `question.points` (1 Easy / 2 Normal / 3 Hard) for a correct
  answer, otherwise 0. No speed bonus.
- **Team score for a quiz = average of its players' totals** (players who joined
  but never answered count as 0 and stay in the denominator). Team with no
  players scores 0. Round to 2 decimals.
- **Championship total = sum of that team's `gameResults.score`** across the
  tournament.
- **Best player of a question** = correct answer with the smallest `elapsedMs`.
  If nobody was correct, there is no best player (`null`).
- Free-text answers are graded with `normalizeAnswer` against `correctText` plus
  every entry in `acceptedAnswers`.

## 6. Convex API contract

Every signature below is fixed. UI agents code against it; the backend agent
implements exactly it.

### `convex/lib.ts` (internal helpers, not part of the public API)

Shared helpers: `gradeAnswer`, `computeTeamScores`, `buildStandings`,
`makeCode`, `loadQuestions`, `phase transitions`. Export plain functions taking
a `ctx`.

### `convex/auth.ts`

```ts
check: query({ passphrase: string }) => boolean
// compares against process.env.ADMIN_PASSPHRASE ?? "quiz"
```

### `convex/files.ts`

```ts
generateUploadUrl: mutation({}) => string
getUrl: query({ storageId: Id<"_storage"> }) => string | null
```

### `convex/tournaments.ts`

```ts
type TournamentSummary = {
  _id: Id<"tournaments">; _creationTime: number;
  name: string; description?: string; completedAt?: number;
  teamCount: number; quizCount: number; playedCount: number;
};

list:   query({}) => TournamentSummary[]                    // newest first
get:    query({ tournamentId }) => Doc<"tournaments"> | null
create: mutation({ name: string, description?: string }) => Id<"tournaments">
update: mutation({ tournamentId, name?: string, description?: string }) => null
remove: mutation({ tournamentId }) => null                  // cascades everything
```

### `convex/teams.ts`

```ts
listByTournament: query({ tournamentId }) => Doc<"teams">[]  // ordered by `order`
create: mutation({ tournamentId, name: string, color: string,
                   iconId?: Id<"_storage">, members?: string[] }) => Id<"teams">
        // throws ConvexError("Maximum of 10 teams") past 10
update: mutation({ teamId, name?, color?, iconId?, members? }) => null
        // passing iconId: null clears it — use v.optional(v.union(v.id("_storage"), v.null()))
remove: mutation({ teamId }) => null
```

### `convex/quizzes.ts`

```ts
type QuizSummary = Doc<"quizzes"> & {
  questionCount: number; totalPoints: number;
  lastGameId: Id<"games"> | null; lastGameStatus: string | null;
};

listByTournament: query({ tournamentId }) => QuizSummary[]   // ordered by `order`
get:    query({ quizId }) => (Doc<"quizzes"> & { tournamentName: string }) | null
create: mutation({ tournamentId, name: string, description: string,
                   isFinal?: boolean }) => Id<"quizzes">
update: mutation({ quizId, name?, description?, isFinal? }) => null
        // setting isFinal:true clears isFinal on every other quiz of the tournament
remove: mutation({ quizId }) => null                         // cascades questions + games
```

### `convex/questions.ts`

```ts
type QuestionInput = {
  prompt: string;
  promptImageId?: Id<"_storage"> | null;
  answerKind: "text_input" | "text_choice" | "image_choice" | "image_text_choice";
  choices: { text?: string; imageId?: Id<"_storage"> }[];  // exactly 4 for *_choice
  correctChoice?: number;      // 0..3, required for *_choice
  correctText?: string;        // required for text_input
  acceptedAnswers?: string[];
  points: number;              // 1..3
  timeLimit: number;           // 5..180, default 20
};

listByQuiz: query({ quizId }) => Doc<"questions">[]          // ordered by `order`
create:  mutation({ quizId, ...QuestionInput }) => Id<"questions">
update:  mutation({ questionId, ...Partial<QuestionInput> }) => null
remove:  mutation({ questionId }) => null
reorder: mutation({ quizId, orderedIds: Id<"questions">[] }) => null
duplicate: mutation({ questionId }) => Id<"questions">
```

Validation (throw `ConvexError` with a readable message): 4 choices for the
`*_choice` kinds, non-empty `text` for `text_choice`/`image_text_choice`,
`imageId` present for `image_choice`/`image_text_choice`, `correctChoice` in
range, `correctText` non-empty for `text_input`, `points` ∈ 1..3,
`timeLimit` ∈ 5..180.

### `convex/games.ts` — host side

```ts
create: mutation({ quizId }) => { gameId: Id<"games">, code: string }
// status "lobby", currentIndex -1, unique 6-char code from A-Z2-9 (no I/O/0/1)
// throws if the quiz has no questions or the tournament has fewer than 2 teams

start:         mutation({ gameId }) => null   // lobby -> question(0)
closeQuestion: mutation({ gameId, force?: boolean }) => null
// question -> reveal. Without `force`, only closes when the timer has expired
// or every player has answered. Idempotent + safe to call from any client.
advance:       mutation({ gameId }) => null
// reveal -> question(next) | round_results ; round_results -> leaderboard ;
// leaderboard -> finished. Writes gameResults on entry to round_results and
// stamps tournaments.completedAt on entry to leaderboard when quiz.isFinal.

getHostState: query({ gameId }) => HostState | null
```

```ts
type Dot = { teamId: Id<"teams">; teamColor: string; elapsedMs: number };

type HostState = {
  game: {
    _id: Id<"games">; code: string; status: GameStatus; currentIndex: number;
    questionStartedAt?: number; questionEndsAt?: number; phaseStartedAt: number;
  };
  quiz: { _id: Id<"quizzes">; name: string; description: string;
          isFinal: boolean; questionCount: number };
  tournament: { _id: Id<"tournaments">; name: string };
  teams: { _id: Id<"teams">; name: string; color: string;
           iconId?: Id<"_storage">; members: string[];
           playerCount: number; playerNames: string[] }[];
  playerCount: number;
  answeredCount: number;              // for the current question
  /** null in lobby / round_results / leaderboard / finished */
  question: {
    _id: Id<"questions">; order: number; number: number;   // 1-based
    prompt: string; promptImageId?: Id<"_storage">;
    answerKind: AnswerKind; choices: { text?: string; imageId?: Id<"_storage"> }[];
    points: number; timeLimit: number;
    /** present only when status !== "question" — never leak it early */
    correctChoice?: number; correctText?: string;
  } | null;
  /** only when status === "reveal" */
  reveal: {
    correctChoice?: number; correctText?: string;
    /** one entry per choice, index-aligned; empty for text_input */
    distribution: { choiceIndex: number; count: number;
                    correct: boolean; dots: Dot[] }[];
    /** for text_input: what people typed, most common first */
    textAnswers: { text: string; count: number; correct: boolean; dots: Dot[] }[];
    correctCount: number; totalAnswers: number;
    bestPlayer: { name: string; teamId: Id<"teams">; teamName: string;
                  teamColor: string; teamIconId?: Id<"_storage">;
                  elapsedMs: number; points: number } | null;
  } | null;
  /** only when status === "round_results" */
  roundScores: { teamId: Id<"teams">; name: string; color: string;
                 iconId?: Id<"_storage">; score: number; playerCount: number;
                 players: { name: string; points: number }[] }[] | null;   // best first
  /** only when status === "leaderboard" | "finished" */
  standings: { teamId: Id<"teams">; name: string; color: string;
               iconId?: Id<"_storage">; total: number; roundScore: number;
               rank: number }[] | null;
};
```

### `convex/play.ts` — player side

```ts
getPlayState: query({ code: string, playerId?: Id<"players"> }) => PlayState | null
// null when the code matches no game

join: mutation({ code: string, teamId: Id<"teams">, name: string })
      => { playerId: Id<"players"> }
// appends `name` to the team roster when it is new; reuses an existing player
// row when the same name rejoins the same team in the same game

submitAnswer: mutation({ playerId, questionId, choiceIndex?: number, text?: string })
      => { correct: boolean; points: number }
// ignores late/duplicate submissions (throws ConvexError with a readable message);
// auto-closes the question to `reveal` once every player has answered
```

```ts
type PlayState = {
  game: { _id: Id<"games">; code: string; status: GameStatus; currentIndex: number;
          questionStartedAt?: number; questionEndsAt?: number; phaseStartedAt: number };
  quiz: { name: string; description: string; isFinal: boolean; questionCount: number };
  tournament: { name: string };
  teams: { _id: Id<"teams">; name: string; color: string;
           iconId?: Id<"_storage">; members: string[]; playerCount: number }[];
  me: { playerId: Id<"players">; name: string; teamId: Id<"teams">;
        teamName: string; teamColor: string; teamIconId?: Id<"_storage">;
        totalPoints: number } | null;
  playerCount: number;
  answeredCount: number;
  /** null unless status is "question" or "reveal". NEVER contains the answer
   *  while status === "question". */
  question: {
    _id: Id<"questions">; number: number; total: number;
    prompt: string; promptImageId?: Id<"_storage">;
    answerKind: AnswerKind; choices: { text?: string; imageId?: Id<"_storage"> }[];
    points: number; timeLimit: number;
  } | null;
  /** this player's submission for the current question */
  myAnswer: { choiceIndex?: number; text?: string;
              correct?: boolean; points?: number } | null;  // correct/points only at reveal
  /** only when status === "reveal" */
  reveal: {
    correctChoice?: number; correctText?: string;
    myCorrect: boolean; myPoints: number;
    distribution: { choiceIndex: number; count: number }[];
    bestPlayer: { name: string; teamName: string; teamColor: string;
                  isMe: boolean } | null;
  } | null;
  /** only when status === "round_results" */
  roundScores: { teamId: Id<"teams">; name: string; color: string;
                 score: number; isMyTeam: boolean }[] | null;
  /** only when status === "leaderboard" | "finished" */
  standings: { teamId: Id<"teams">; name: string; color: string;
               total: number; rank: number; isMyTeam: boolean }[] | null;
};
```

`AnswerKind` / `GameStatus` are the string unions from `convex/schema.ts`.

## 7. Screen requirements

### Landing `/` (admin owner)

Big festive hero, join-by-code input (6 chars, uppercased, → `/play/CODE`),
discreet link to `/admin`.

### Admin (admin owner)

- `AdminGate.tsx` — passphrase form; `api.auth.check`; on success
  `setAdminUnlocked(true)`; renders children when `isAdminUnlocked()`.
- `AdminHome.tsx` — tournament list (+ create / rename / delete with confirm),
  each card links to `/admin/t/:id`, shows team + quiz counts and completed state.
- `TournamentBuilder.tsx` — two sections:
  - **Teams**: grid of up to 10 team cards. Name, colour swatch picker
    (`TEAM_COLORS` + native colour input), `ImageUpload shape="square"` icon,
    member list (add/remove names, Enter to add). Enforce ≤ 10 and warn when < 2.
  - **Quizzes**: ordered list. Create quiz, toggle "Final quiz", edit link to
    `/admin/quiz/:id`, delete, and a **Start live game** button that calls
    `games.create` then navigates to `/host/:gameId`. Disable it when the quiz
    has no questions or the tournament has < 2 teams, with the reason shown.
- `QuizBuilder.tsx` + `QuestionEditor.tsx` — quiz name/description/isFinal, then
  the question list: reorder (up/down is fine), duplicate, delete, and an editor
  supporting all 4 answer kinds, prompt image upload, points selector (Easy /
  Normal / Hard) and time limit (default 20s). Show total points and estimated
  runtime. Validate client-side before saving; surface server `ConvexError`
  messages inline.

### Host `/host/:gameId` (host owner)

One `HostScreen.tsx` router on `state.game.status`, plus a sub-component per
phase. This is the show-piece — festive, projected, awwwards-grade motion.

- **Lobby**: giant `<QRCodeSVG>` of `${window.location.origin}/play/${code}`,
  the code in huge type, live per-team join counts with player names flying in,
  total player count, Start button (disabled until ≥ 1 player).
- **Question**: question number/points/difficulty chip, prompt in huge type,
  prompt image if present, the 4 choices laid out (2×2 for images, stacked for
  text), a countdown bar driven by `useCountdown` that shifts colour as it
  drains, and an "N of M answered" ticker. Calls `closeQuestion` when
  `expired` (also when `answeredCount === playerCount`). Text-input questions
  show "type your answer on your phone" instead of choices.
- **Reveal**: correct choice glows `mint`, wrong ones dim to `siren`; per-choice
  vote **dots in team colours animate in with a delay proportional to
  `elapsedMs`** (this is the signature moment — stagger them, spring physics,
  the fastest answers land first); bar/column counts; best player card with
  celebration animation (`burst()` + `animate-pulse-ring` halo) or nothing when
  `bestPlayer === null`.
- **Round results**: team totals for the quiz, bars racing up in team colours,
  podium feel, `rain()` confetti.
- **Leaderboard**: cumulative championship standings, animated rank ordering
  (framer-motion layout animations), `roundScore` shown as a `+x.xx` delta. When
  `quiz.isFinal`, treat it as the finale: champion trophy moment,
  `sideCannons()`.
- A small always-visible host control bar: phase name, Next/Reveal button,
  player count, join code.

### Player `/play/:code` (player owner)

`PlayerApp.tsx` reads `useParams().code`, `loadSession(code)`, subscribes to
`getPlayState`, and routes on status. `Backdrop variant="calm"`, phone-first.

- **No session** → team picker (team cards with `TeamBadge`, colour, current
  player count) → name step: pick from `team.members` (mark names already taken
  in this game as unavailable) or type a new one → `join` → `saveSession`.
- **Lobby** → "you're in" card with team colour, player's name, roster of
  teammates present, playful waiting animation.
- **Question** → prompt + the right input for `answerKind`:
  - `text_input`: text field + submit
  - `text_choice`: 4 big buttons
  - `image_choice`: 2×2 image grid
  - `image_text_choice`: 2×2 images with the title overlaid
  Countdown bar; after submitting show a locked-in state with "waiting for the
  others" and the answered count. Disable input when `myAnswer` exists or
  the timer has expired.
- **Reveal** → big correct/wrong verdict with haptics-ish animation, points
  earned, whether they were the best player, the correct answer.
- **Round results / leaderboard** → compact standings with their own team
  highlighted, their personal total.
- **Finished** → thanks screen; when `isFinal`, the champion.

## 8. Build & run

```bash
npm install
npx convex dev      # one-time: creates the deployment, writes VITE_CONVEX_URL
npm run dev
# optional: npx convex env set ADMIN_PASSPHRASE something
```

`convex/_generated/` was originally hand-written so the project would typecheck
before any deployment existed. It is now generated normally by `npx convex dev`.

There is also `convex/seed.ts` for development convenience:

```bash
npx convex run seed:demo   # a tournament, 3 teams, a normal quiz and a final
npx convex run seed:wipe   # empty every table
```

## 9. Build status

`npm run build` (tsc + vite) passes clean; `npx oxlint src convex` reports a
single intentional `exhaustive-deps` warning in `HostReveal.tsx` (the
fire-confetti-once-on-mount effect).

Verified against a live local Convex deployment, not just typechecked:

- **Scoring** — team score is the average of its players' totals; players who
  joined but never answered stay in the denominator; a team with no players
  scores 0; championship totals accumulate across quizzes.
- **Grading** — free text matches across case, accents, punctuation, surrounding
  whitespace and the `acceptedAnswers` list. Reveal groups answers by their
  normalised form, so `OTTAWA!`, `Ottāwa` and `Ottawa` collapse into one row.
- **Answer secrecy** — neither `getHostState` nor `getPlayState` contains
  `correctChoice`/`correctText` while `status === "question"`; both expose them
  from `reveal` onwards.
- **Question close** — closes on the timer via the scheduled `autoClose`
  (guarded by `expectedIndex`, so a stale timer cannot close a later question)
  and early once every player has answered. Duplicate and late submissions are
  rejected with readable errors.
- **Guard rails** — max 10 teams, ≥2 teams and ≥1 question required to start,
  points restricted to 1–3, exactly 4 choices for the choice kinds, one final
  quiz per tournament, and deletes cascade.
- **Files** — upload → `getUrl` → render verified for prompt images, all four
  choice images and team icons; `iconId: null` clears an icon.
- **Live UI** — the join flow (team → name → lobby), answering, both reveal
  verdicts, round results, championship leaderboard and the final-quiz champion
  screen were all driven in a browser. Vote dots render in the correct team
  colours, one per answer.
- **Layout** — no horizontal overflow at 360px; host phases fit within 1280×800
  and 1440×900 without the page scrolling (host roots are `h-dvh` with internal
  scrolling so the fixed control bar never collides with content).

Known gaps, none blocking:

- The JS bundle is ~556 kB (169 kB gzipped) in one chunk. Fine for an internal
  app; route-level `React.lazy` would split it if it ever matters.
- `HostState.quiz` has no `totalPoints`, so the host lobby shows the question
  count but not the points total. One-line backend addition if wanted.
- The host question header shows "Question 3" while the control bar shows
  "Question 3 of 10" — `question.number` has no matching total.
- Players self-add names with no dedupe beyond exact case-insensitive match on a
  team, so two different "Alex"es on one team share a player row. Fine for a
  ten-person quiz night.
