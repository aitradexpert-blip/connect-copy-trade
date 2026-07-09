import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * Glassmorphism feature card for the Khumo landing grid.
 * Bold, animated, and mobile-first.
 */
export default function FeatureCard({ icon: Icon, title, body }: FeatureCardProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 18 } },
      }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6"
    >
      {/* red glow on hover */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(60% 80% at 20% 0%, hsla(354, 82%, 45%, 0.35), transparent 70%)",
        }}
      />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[hsl(354_82%_45%/0.3)] bg-[hsl(354_82%_45%/0.12)] text-[hsl(354_90%_60%)] shadow-[0_0_24px_-6px_hsl(354_82%_45%/0.6)]">
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{body}</p>
        </div>
      </div>
    </motion.div>
  );
}
