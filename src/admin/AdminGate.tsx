import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { LoaderCircle, Lock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import Backdrop from "../components/Backdrop";
import { isAdminUnlocked, setAdminUnlocked } from "../lib/session";

type Props = {
  children: React.ReactNode;
};

export default function AdminGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState<boolean>(() => isAdminUnlocked());
  const [candidate, setCandidate] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);
  const [, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const result = useQuery(
    api.auth.check,
    submitted !== undefined ? { passphrase: submitted } : "skip",
  );

  useEffect(() => {
    if (submitted === undefined) return; // idle
    if (result === undefined) return; // query in flight
    if (result === true) {
      setAdminUnlocked(true);
      setUnlocked(true);
    } else {
      setError("Wrong passphrase");
      setSubmitted(undefined); // reset so next attempt re-queries
      setAttempt((a) => a + 1);
      setCandidate("");
    }
  }, [result, submitted]);

  if (unlocked) return <>{children}</>;

  const pending = submitted !== undefined && result === undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitted(candidate);
  }

  return (
    <>
      <Backdrop variant="calm" />
      <div className="min-h-screen grid place-items-center px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="glass p-8">
            <div className="mb-4 flex items-center gap-2 text-white/80">
              <Lock className="h-5 w-5" />
              <h1 className="font-display text-2xl">Host access</h1>
            </div>
            <p className="mb-4 text-sm text-white/60">
              Enter the host passphrase to manage tournaments.
            </p>

            {error && (
              <div className="glass-soft mb-4 flex items-center justify-between gap-3 border-siren/40 px-4 py-3 text-sm text-siren">
                <span>{error}</span>
              </div>
            )}

            <form className="flex flex-col gap-3" onSubmit={submit}>
              <input
                type="password"
                autoFocus
                value={candidate}
                onChange={(e) => setCandidate(e.target.value)}
                placeholder="Passphrase"
                className="field"
              />
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={pending || candidate.length === 0}
              >
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  "Unlock"
                )}
              </button>
            </form>

            <Link
              to="/"
              className="mt-4 block text-center text-xs text-white/40 hover:text-white/60 transition"
            >
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
