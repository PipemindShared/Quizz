import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { HostFinale } from "../types";
import FitToScreen from "../FitToScreen";
import { IntroSlide, NumbersSlide } from "./OpeningSlides";
import { RaceSlide } from "./RaceSlide";
import { AwardSlide, IronSlide, TeamAwardsSlide } from "./AwardSlides";
import { QuestionSlide } from "./QuestionSlide";
import { CountdownSlide, DrumrollSlide } from "./CountdownSlides";

/**
 * The tournament awards slideshow on the big screen. The host steps through it
 * like questions; every slide is data the server froze when the final's last
 * question closed, so nothing here waits on the network.
 */
export default function HostRecap({ finale }: { finale: HostFinale }) {
  const step = Math.max(0, Math.min(finale.step, finale.slides.length - 1));
  const slide = finale.slides[step]!;

  // "Award 3 of 8" counts the individual awards only.
  const awardSteps = useMemo(
    () =>
      finale.slides
        .map((s, i) => (s.kind === "award" || s.kind === "iron" ? i : -1))
        .filter((i) => i >= 0),
    [finale.slides],
  );
  const awardNumber = awardSteps.indexOf(step) + 1;

  let body: React.ReactNode;
  switch (slide.kind) {
    case "intro":
      body = <IntroSlide slide={slide} />;
      break;
    case "numbers":
      body = <NumbersSlide slide={slide} />;
      break;
    case "race":
      body = <RaceSlide slide={slide} />;
      break;
    case "teamAwards":
      body = <TeamAwardsSlide slide={slide} />;
      break;
    case "award":
      body = <AwardSlide slide={slide} index={awardNumber} total={awardSteps.length} />;
      break;
    case "iron":
      body = <IronSlide slide={slide} index={awardNumber} total={awardSteps.length} />;
      break;
    case "question":
      body = <QuestionSlide slide={slide} />;
      break;
    case "countdown":
      body = <CountdownSlide standings={finale.standings} revealed={slide.revealed} />;
      break;
    case "drumroll":
      body = <DrumrollSlide standings={finale.standings} />;
      break;
  }

  // Every countdown step shares one key, so the list stays put and only the
  // newly revealed team animates in.
  const key = slide.kind === "countdown" ? "countdown" : `slide-${step}`;
  const progress = (step + 1) / finale.slides.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative z-10 h-dvh w-full"
    >
      <div className="fixed inset-x-0 top-0 z-30 h-1.5 bg-white/5">
        <motion.div
          className="h-full bg-[linear-gradient(90deg,var(--color-neon),var(--color-punch),var(--color-sun))]"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          style={{ boxShadow: "0 0 16px var(--color-punch)" }}
        />
      </div>
      <AnimatePresence mode="wait">
        <FitToScreen key={key}>{body}</FitToScreen>
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Warm-up                                                               */
/* ------------------------------------------------------------------ */

function collectImages(finale: HostFinale): Id<"_storage">[] {
  const ids = new Set<Id<"_storage">>();
  for (const s of finale.standings) if (s.team.iconId) ids.add(s.team.iconId);
  for (const slide of finale.slides) {
    if (slide.kind === "question") {
      if (slide.question.promptImageId) ids.add(slide.question.promptImageId);
      for (const c of slide.question.choices) if (c.imageId) ids.add(c.imageId);
    }
  }
  return [...ids];
}

function Warm({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useQuery(api.files.getUrl, { storageId });
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  }, [url]);
  return null;
}

/**
 * Mounted from the final's round results onwards: resolves and downloads every
 * image the slideshow will show, and keeps those URL subscriptions alive, so no
 * slide ever pops in with a loading placeholder.
 */
export function RecapWarmup({ finale }: { finale: HostFinale }) {
  const ids = useMemo(() => collectImages(finale), [finale]);
  return (
    <>
      {ids.map((id) => (
        <Warm key={id} storageId={id} />
      ))}
    </>
  );
}
