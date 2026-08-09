import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, QrCode } from "lucide-react";
import Backdrop from "./components/Backdrop";

export default function Landing() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const ready = code.length === 6;

  const join = () => {
    if (ready) navigate(`/play/${code}`);
  };

  return (
    <>
      <Backdrop variant="calm" />
      <div className="min-h-screen grid place-items-center px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="glass p-8 text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-sun">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                Live quiz
              </span>
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="grad-text font-display text-4xl sm:text-5xl">
              Quiz Arena
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Team up, think fast, and chase the championship crown.
            </p>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-white/50">
              <QrCode className="h-4 w-4" />
              Scan the QR code on the big screen — or punch in the 6-character
              code below.
            </p>

            <form
              className="mt-6 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <input
                value={code}
                onChange={(e) => {
                  const raw = e.target.value;
                  const clean = raw
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6);
                  setCode(clean);
                }}
                maxLength={6}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABC123"
                className="field text-center text-2xl font-display tracking-[0.4em] uppercase"
              />
              <button type="submit" className="btn-primary w-full" disabled={!ready}>
                Join game
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <Link
            to="/admin"
            className="mt-6 block text-center text-xs text-white/30 hover:text-white/60 transition"
          >
            Host controls
          </Link>
        </div>
      </div>
    </>
  );
}
