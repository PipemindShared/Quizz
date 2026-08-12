import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle, TriangleAlert, Users, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { GameStatus } from "./types";
import Backdrop from "../components/Backdrop";
import FitToScreen from "./FitToScreen";
import JoinQrPopover from "./JoinQrPopover";
import HostLobby from "./HostLobby";
import HostQuestion from "./HostQuestion";
import HostReveal from "./HostReveal";
import HostRoundResults from "./HostRoundResults";
import HostLeaderboard from "./HostLeaderboard";

const PHASE_LABEL: Record<GameStatus, string> = {
  lobby: "Lobby",
  question: "Question",
  reveal: "Reveal",
  round_results: "Round Results",
  leaderboard: "Leaderboard",
  finished: "Finished",
};

/**
 * Minimum gap between host activations. Absorbs a double-click or a click that
 * lands on top of a key press.
 */
const ACTION_COOLDOWN_MS = 700;

/** Centered, on-brand placeholder used for loading / not-found / defensive fallback states. */
function CenterMessage({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      {icon}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white/90">
        {title}
      </h1>
      {subtitle ? <p className="max-w-md text-white/50">{subtitle}</p> : null}
    </div>
  );
}

export default function HostScreen() {
  const { gameId } = useParams<{ gameId: string }>();
  const id = gameId as Id<"games"> | undefined;

  const state = useQuery(api.games.getHostState, id ? { gameId: id } : "skip");
  const start = useMutation(api.games.start);
  const closeQuestion = useMutation(api.games.closeQuestion);
  const advance = useMutation(api.games.advance);

  const reducedMotion = useReducedMotion();

  // ---- Control bar auto-dim ----
  const [dimmed, setDimmed] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    setDimmed(false);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => setDimmed(true), 3000);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      if (dimTimer.current) clearTimeout(dimTimer.current);
    };
  }, [wake]);

  // ---- Primary action per status ----
  const status = state?.game.status;
  const playerCount = state?.playerCount ?? 0;

  /**
   * Two activations in quick succession used to chain into each other: the first
   * advanced into the next question, the second force-closed it, so the question
   * was skipped with nobody able to answer. The server refuses to close a
   * just-opened question too — this stops the second press being sent at all.
   */
  const lastActionAt = useRef(0);

  const primaryAction = useCallback(() => {
    if (!id || !status) return;
    const now = Date.now();
    if (now - lastActionAt.current < ACTION_COOLDOWN_MS) return;
    lastActionAt.current = now;
    if (status === "lobby") {
      if (playerCount < 1) return;
      void start({ gameId: id });
    } else if (status === "question") {
      void closeQuestion({ gameId: id, force: true });
    } else if (status === "reveal" || status === "round_results" || status === "leaderboard") {
      void advance({ gameId: id });
    }
    // "finished": no-op
  }, [id, status, playerCount, start, closeQuestion, advance]);

  // ---- Keyboard shortcuts: Space / ArrowRight trigger the primary action ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (status === "finished" || !status) return;
      // The QR overlay owns the keyboard while it is up.
      if (qrOpen) return;
      // Holding the key fires keydown ~30 times a second. Unguarded, the first
      // event opens the next question and the repeats force it straight shut.
      if (e.repeat) return;
      if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        primaryAction();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, primaryAction, qrOpen]);

  // ---- No gameId in the route at all ----
  if (!id) {
    return (
      <>
        <Backdrop variant="host" />
        <CenterMessage
          icon={<TriangleAlert className="h-12 w-12 text-siren" />}
          title="No game specified"
          subtitle="This host link is missing a game id."
        />
      </>
    );
  }

  // ---- Loading ----
  if (state === undefined) {
    return (
      <>
        <Backdrop variant="host" />
        <CenterMessage
          icon={<LoaderCircle className="h-12 w-12 animate-spin text-neon-2" />}
          title="Warming up the stage…"
        />
      </>
    );
  }

  // ---- Not found ----
  if (state === null) {
    return (
      <>
        <Backdrop variant="host" />
        <CenterMessage
          icon={<TriangleAlert className="h-12 w-12 text-siren" />}
          title="Game not found"
          subtitle="Double-check the link, or start a new game from the admin panel."
        />
      </>
    );
  }

  const tint = state.standings?.length
    ? [state.standings[0]!.color]
    : state.reveal?.bestPlayer
      ? [state.reveal.bestPlayer.teamColor]
      : undefined;

  const phaseKey = `${state.game.status}-${state.game.currentIndex}`;

  const phaseLabel =
    state.game.status === "question" || state.game.status === "reveal"
      ? `Question ${state.game.currentIndex + 1} of ${state.quiz.questionCount}`
      : PHASE_LABEL[state.game.status];

  const fallback = (
    <motion.div
      key={`${phaseKey}-fallback`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 flex min-h-dvh items-center justify-center"
    >
      <LoaderCircle className="h-10 w-10 animate-spin text-white/40" />
    </motion.div>
  );

  const onStart = () => {
    void start({ gameId: id });
  };
  const onAutoClose = () => {
    void closeQuestion({ gameId: id });
  };

  let content: React.ReactNode;
  switch (state.game.status) {
    case "lobby":
      content = (
        <FitToScreen key={phaseKey}>
          <HostLobby
            quiz={state.quiz}
            code={state.game.code}
            teams={state.teams}
            playerCount={state.playerCount}
            canStart={state.playerCount >= 1}
            onStart={onStart}
          />
        </FitToScreen>
      );
      break;
    case "question":
      content = state.question ? (
        <HostQuestion
          key={phaseKey}
          question={state.question}
          game={state.game}
          answeredCount={state.answeredCount}
          playerCount={state.answerableCount}
          serverNow={state.serverNow}
          onAutoClose={onAutoClose}
        />
      ) : (
        fallback
      );
      break;
    case "reveal":
      content =
        state.question && state.reveal ? (
          <FitToScreen key={phaseKey}>
            <HostReveal question={state.question} reveal={state.reveal} />
          </FitToScreen>
        ) : (
          fallback
        );
      break;
    case "round_results":
      content = state.roundScores ? (
        <FitToScreen key={phaseKey}>
          <HostRoundResults roundScores={state.roundScores} quizName={state.quiz.name} />
        </FitToScreen>
      ) : (
        fallback
      );
      break;
    case "leaderboard":
      content = state.standings ? (
        <FitToScreen key={phaseKey}>
          <HostLeaderboard
            standings={state.standings}
            isFinal={state.quiz.isFinal}
            status="leaderboard"
          />
        </FitToScreen>
      ) : (
        fallback
      );
      break;
    case "finished":
      content = state.standings ? (
        <FitToScreen key={phaseKey}>
          <HostLeaderboard
            standings={state.standings}
            isFinal={state.quiz.isFinal}
            status="finished"
          />
        </FitToScreen>
      ) : (
        fallback
      );
      break;
    default:
      content = fallback;
  }

  const primaryLabel =
    state.game.status === "lobby"
      ? "Start"
      : state.game.status === "question"
        ? "Reveal now"
        : state.game.status === "finished"
          ? null
          : "Next";

  const primaryDisabled = state.game.status === "lobby" && state.playerCount < 1;

  return (
    <>
      <Backdrop variant="host" tint={tint} />

      <AnimatePresence mode="wait">{content}</AnimatePresence>

      {/* Host control bar */}
      <motion.div
        className="glass fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3 sm:inset-x-6"
        animate={{ opacity: dimmed && !reducedMotion ? 0.25 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        onMouseEnter={wake}
        onFocus={wake}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-neon-2" />
            <span className="truncate font-display text-sm font-semibold tracking-wide text-white/90">
              {phaseLabel}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 text-white/50 sm:flex">
            <Users className="h-4 w-4" />
            <span className="text-sm tabular-nums">{state.playerCount}</span>
          </div>
          <div className="hidden items-center gap-1.5 text-white/50 md:flex">
            <span className="text-xs uppercase tracking-[0.14em]">Code</span>
            <span className="font-display text-sm font-semibold tracking-widest text-sun">
              {state.game.code}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <JoinQrPopover code={state.game.code} onOpenChange={setQrOpen} />
          {primaryLabel ? (
            <>
              <span className="hidden text-xs text-white/35 sm:inline">Space / →</span>
              <button
                type="button"
                className="btn-primary"
                disabled={primaryDisabled}
                onClick={primaryAction}
              >
                {primaryLabel}
              </button>
            </>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
