import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { PlayerSession } from "../lib/session";
import { clearSession, loadSession, saveSession } from "../lib/session";
import type { PlayTeam } from "./types";
import Backdrop from "../components/Backdrop";
import PlayerWaiting from "./PlayerWaiting";
import JoinTeam from "./JoinTeam";
import JoinName from "./JoinName";
import PlayerLobby from "./PlayerLobby";
import PlayerQuestion from "./PlayerQuestion";
import PlayerReveal from "./PlayerReveal";
import PlayerStandings from "./PlayerStandings";

function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    return typeof err.data === "string" ? err.data : "Something went wrong.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

type JoinStep = "team" | "name";

export default function PlayerApp() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? "").toUpperCase();

  const [session, setSession] = useState<PlayerSession | null>(() => loadSession(code));
  const state = useQuery(api.play.getPlayState, code ? { code, playerId: session?.playerId } : "skip");
  const join = useMutation(api.play.join);

  const [step, setStep] = useState<JoinStep>("team");
  const [selectedTeam, setSelectedTeam] = useState<PlayTeam | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const reduceMotion = useReducedMotion();

  // Stale session: the stored player no longer exists in this game (e.g. the
  // tournament/game was reset). Clear it once, only in an effect, never
  // during render — guarded on `session` so it can't loop.
  useEffect(() => {
    if (state === undefined || state === null) return;
    if (state.me === null && session) {
      clearSession(code);
      setSession(null);
    }
  }, [state, session, code]);

  const handleJoin = async (name: string) => {
    if (!selectedTeam) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await join({ code, teamId: selectedTeam._id, name });
      const next: PlayerSession = { playerId: result.playerId, teamId: selectedTeam._id, name };
      saveSession(code, next);
      setSession(next);
    } catch (err) {
      setJoinError(errorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  let content: React.ReactNode = null;
  let phaseKey = "loading";

  if (state === undefined) {
    phaseKey = "loading";
    content = (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  } else if (state === null) {
    phaseKey = "invalid";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="label text-white/40">That code isn't live</p>
        <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-white">
          {code || "------"}
        </p>
        <p className="max-w-xs text-balance text-base text-white/60">
          Double check the code, or ask the host to re-show the QR — this game
          may have already ended.
        </p>
      </div>
    );
  } else if (state.me === null) {
    if (step === "name" && selectedTeam) {
      phaseKey = "name";
      content = (
        <JoinName
          team={selectedTeam}
          onBack={() => setStep("team")}
          joining={joining}
          error={joinError}
          onJoin={handleJoin}
        />
      );
    } else {
      phaseKey = "team";
      content = (
        <JoinTeam
          quizName={state.quiz.name}
          tournamentName={state.tournament.name}
          teams={state.teams}
          onSelect={(team) => {
            setSelectedTeam(team);
            setStep("name");
          }}
        />
      );
    }
  } else {
    const me = state.me;
    const status = state.game.status;

    if (status === "lobby") {
      phaseKey = "lobby";
      content = (
        <PlayerLobby
          me={me}
          teams={state.teams}
          playerCount={state.playerCount}
          quizName={state.quiz.name}
          tournamentName={state.tournament.name}
          onSwitch={() => {
            clearSession(code);
            setSession(null);
          }}
        />
      );
    } else if (state.sittingOut) {
      // Joined after this question opened, so they wait it out rather than
      // answering with less time than everyone else.
      phaseKey = "sitting-out";
      content = <PlayerWaiting teamColor={me.teamColor} />;
    } else if (status === "question") {
      phaseKey = `question:${state.question?._id ?? ""}`;
      if (state.question) {
        content = (
          <PlayerQuestion
            playerId={me.playerId}
            question={state.question}
            myAnswer={state.myAnswer}
            answeredCount={state.answeredCount}
            playerCount={state.playerCount}
            myTeamColor={me.teamColor}
            questionStartedAt={state.game.questionStartedAt}
            questionEndsAt={state.game.questionEndsAt}
          />
        );
      }
    } else if (status === "reveal") {
      phaseKey = `reveal:${state.question?._id ?? ""}`;
      if (state.question && state.reveal) {
        content = (
          <PlayerReveal
            question={state.question}
            reveal={state.reveal}
            myAnswer={state.myAnswer}
            totalPoints={me.totalPoints}
          />
        );
      }
    } else {
      // status is narrowed to "round_results" | "leaderboard" | "finished" here
      phaseKey = status;
      content = (
        <PlayerStandings
          status={status}
          roundScores={state.roundScores}
          standings={state.standings}
          quizName={state.quiz.name}
          isFinal={state.quiz.isFinal}
        />
      );
    }
  }

  const tint = state?.me ? [state.me.teamColor] : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop variant="calm" tint={tint} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 sm:max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseKey}
            initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
