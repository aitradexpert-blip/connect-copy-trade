import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import heroBull from "@/assets/hero-bull.jpg";

/**
 * Landing hero bull image with radial red glow, subtle vignette, and
 * scroll-driven parallax. Respects prefers-reduced-motion.
 */
export default function HeroBull() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* radial red glow */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 40%, hsla(354, 82%, 45%, 0.35), transparent 70%)",
        }}
      />
      <motion.img
        src={heroBull}
        alt="Khumo Copy AI — bull market"
        width={1536}
        height={1024}
        style={{ y, scale, opacity }}
        className="absolute left-1/2 top-0 h-full w-auto min-w-full -translate-x-1/2 object-cover object-center opacity-90 mix-blend-screen"
      />
      {/* vignette + fade to bg */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 40%, transparent 40%, hsl(0 0% 4%) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[hsl(0_0%_4%)]" />
      {/* grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}
