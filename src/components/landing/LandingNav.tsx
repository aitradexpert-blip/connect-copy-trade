import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface LandingNavProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

/**
 * Sticky top nav for the Khumo landing page. Shrinks with a blur backdrop on scroll.
 */
export default function LandingNav({ onSignIn, onSignUp }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 20));

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-[hsl(0_0%_4%/0.75)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <a href="#top" className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-xl">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(354_82%_45%)] to-[hsl(354_90%_30%)] font-black text-white shadow-[0_0_20px_-4px_hsl(354_82%_45%/0.7)]">
            K
          </span>
          <span>
            KHUMO <span className="text-[hsl(354_90%_60%)]">AI</span>
          </span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="h-10 rounded-full border border-white/15 bg-transparent px-4 text-sm font-semibold text-white hover:bg-white/5 hover:text-white sm:h-11 sm:px-5"
          >
            Sign In
          </Button>
          <Button
            onClick={onSignUp}
            className="h-10 rounded-full border border-[hsl(354_82%_45%)] bg-[hsl(354_82%_45%)] px-4 text-sm font-semibold text-white shadow-[0_0_24px_-6px_hsl(354_82%_45%/0.9)] hover:bg-[hsl(354_82%_38%)] sm:h-11 sm:px-5"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
