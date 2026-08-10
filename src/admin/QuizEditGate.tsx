import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { LoaderCircle, Lock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Backdrop from "../components/Backdrop";
import QuizBuilder from "./QuizBuilder";

/** Grants access to QuizBuilder via a quiz's secret edit link, without the admin passphrase. */
export default function QuizEditGate() {
  const { quizId, token } = useParams() as {
    quizId: Id<"quizzes">;
    token: string;
  };

  const quiz = useQuery(api.quizzes.get, { quizId });

  if (quiz === undefined) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="grid min-h-screen place-items-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-neon" />
        </div>
      </>
    );
  }

  if (quiz === null || quiz.editToken !== token) {
    return (
      <>
        <Backdrop variant="calm" />
        <div className="min-h-screen grid place-items-center px-4 py-8">
          <div className="mx-auto w-full max-w-md">
            <div className="glass p-8 text-center">
              <div className="mb-4 flex items-center justify-center gap-2 text-white/80">
                <Lock className="h-5 w-5" />
                <h1 className="font-display text-2xl">Invalid link</h1>
              </div>
              <p className="text-sm text-white/60">
                This edit link is wrong or no longer valid. Ask the tournament
                manager for a fresh link.
              </p>
              <Link to="/" className="btn-ghost mt-4 inline-flex">
                Back to landing
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return <QuizBuilder />;
}
