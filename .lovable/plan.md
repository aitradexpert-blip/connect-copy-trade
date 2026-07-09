# Landing Page Redesign — Khumo Copy AI

The uploaded Gemini image is treated as **visual reference only** (not embedded). Focus is `src/pages/Auth.tsx` (the public landing, which is what unauthenticated visitors see at `/auth` and where the screenshot maps to).

## Scope of this pass

Primary and only build target for this plan: **landing page UI + animations + mobile polish**.

Tasks 2 (Trading Account Modal / Copy Engine math) and Task 3 (Cybersecurity / State machine) from your brief are **not included here** — they are substantial engineering changes that deserve their own dedicated plans with proper DB migrations and edge-function work. I'll queue those next once this UI ships. Say the word if you'd rather I bundle them.

## Design direction

- **Palette**: Matte Black `#0A0A0A` base, elevated surfaces `#111114` / `#17171B`, deep metallic red primary `#B0121A` with glow `#E63946`, off-white text `#F5F5F7`, muted `#8A8A93`.
- **Type**: Existing font stack, but heading weight bumped to 800/900, tighter tracking (`-0.03em`), fluid `clamp()` sizing so the H1 stays huge on mobile without overflow.
- **Feel**: Sandton-finance premium — dense blacks, red accents used sparingly for CTAs and the "AI" wordmark, subtle noise/grain overlay, radial red glow behind the bull.

## Landing structure (mobile-first, single column → 3-col on `md`)

```text
┌───────────────────────────────────────┐
│  KHUMO [AI]        [Sign In] [Sign Up]│  sticky nav, blur backdrop
├───────────────────────────────────────┤
│           (bull hero image)           │
│         KHUMO COPY AI  (H1)           │
│   Welcome to the future of money.     │
│   Precision-engineered trading tools  │
│   for the next generation of SA       │
│   market leaders.                     │
│                                       │
│    [ ▶ Download App  (telegram) ]     │  primary red CTA → t.me/mansamusafx
│           [   Join Now   ]            │  ghost outline → #auth-form
├───────────────────────────────────────┤
│ [Trade Ideas] [Copy Trading] [AI Bot] │  glassmorphism cards, stagger-in
├───────────────────────────────────────┤
│         Auth tabs (Sign In / Up)      │  existing form, restyled shell
└───────────────────────────────────────┘
```

## What changes in code

### 1. `src/pages/Auth.tsx`

- Wrap the existing form in a new **Landing shell**:
  - **Sticky top nav** with `KHUMO [AI]` wordmark (AI in red) and two ghost buttons that scroll to the auth form / open sign-up tab.
  - **Hero section** with the bull image, H1, sub-headline, primary **Download App** button (Telegram icon, links `https://t.me/mansamusafx` in new tab), and secondary **Join Now** outline button that smooth-scrolls to `#auth-form`.
  - **Three feature cards** ("Trade Ideas", "Copy Trading", "AI Bot System") — glassmorphism (`bg-white/[0.03] backdrop-blur border border-white/10`), red icon tile top-left, title, one-line body.
  - **Auth form** kept intact, wrapped in a `<section id="auth-form">` with a restyled card (matte black surface, red focus rings).
- Remove/hide the old plain header and reflow paddings so the form sits below the hero on mobile and side-by-side with hero content on `lg+`.

### 2. New file `src/components/landing/HeroBull.tsx`

- Renders the bull hero image with a radial red glow, subtle vignette, and Framer Motion parallax on scroll (`useScroll` + `useTransform` on Y).
- Uses `imagegen` to generate one hero asset: dark high-contrast bull, reflective sunglasses with faint chart candles, cinematic lighting on matte black. Saved to `src/assets/hero-bull.jpg` and imported as ES6 module (fast/standard tier, 1536×1024).

### 3. New file `src/components/landing/FeatureCard.tsx`

- Reusable glassmorphism card. Props: `icon`, `title`, `body`. Framer Motion `whileHover={{ scale: 1.03, y: -4 }}`, `whileTap={{ scale: 0.98 }}`, entry stagger via parent `motion.div`.

### 4. Animation system

- Add `framer-motion` usage (already in project — will verify; if missing, install).
- Stagger children on hero mount, fade+rise for H1/subhead, spring pop for CTAs, `viewport={{ once: true }}` reveals for the card row.
- Reduced-motion respected via `useReducedMotion()`.

### 5. `src/index.css`

- Add landing-scoped tokens under a `.landing-dark` class (or extend `:root`) so the rest of the app isn't affected: red primary vars, glass surface vars, grain background utility, `.text-glow-red` helper.
- No hard-coded Tailwind colors in components — everything through semantic tokens per project rules.

### 6. Mobile polish

- Fluid type: `text-[clamp(2.5rem,9vw,5rem)]` on H1, `clamp(1rem,3.5vw,1.25rem)` on subhead.
- Touch targets ≥ 48px on all CTAs and nav buttons.
- Safe-area padding on hero (`pt-[max(1.25rem,env(safe-area-inset-top))]`).
- Cards stack full-width on `<md`, 3-col on `md+`, with equal-height flex.
- Sticky nav shrinks on scroll (height + backdrop-blur transition).

## Out of scope for this plan (queued next)

- Trading Account modal Combobox refactor + proportional copy-engine lot math (Task 2).
- State-machine + failover hardening + additional security audits (Task 3).

## Technical notes

- No new dependencies expected beyond `framer-motion` (already used elsewhere; will confirm via `package.json` at build time).
- Telegram download link opens in a new tab with `rel="noopener noreferrer"` and includes a spinner state briefly on click to prevent double-taps.
- All copy uses "Trade Ideas" — no "Trading Signals" wording on the landing.
- FSCA disclaimer footer preserved verbatim per project memory.

Check this before you implement any changes:  
### SYSTEM INSTRUCTION: ARCHITECTURAL CRITIQUE & FLOW OPTIMIZATION

Before you write or execute any code for the landing page refactor, you must perform a strict code validation pass against the existing repository. The current plan isolates the UI from the underlying systems, creating a high risk of broken authentication flows and visual fragmentation.

#### 1. MANDATORY PRE-CHECK (Verify before altering code)

- Inspect `src/pages/Auth.tsx` and `package.json` immediately.

- Verify if `framer-motion` and `lucide-react` are fully installed and configured. If missing, queue their installation first.

- Analyze the existing layout structure of `src/pages/Auth.tsx`. Ensure that wrapping it in a landing shell does not break current Supabase OAuth redirect states or custom session listener hooks.

#### 2. ARCHITECTURAL DISAGREEMENTS & CRITIQUE OF THE INITIAL PLAN

- CRITIQUE A (The "Out of Scope" Fallacy): Postponing the Server Dropdown/Combobox fix (Task 2) while rebuilding the main Auth page is an inefficient sequence. If a user drops onto the new landing page, hits [Sign Up], creates an account, and is immediately dropped into a broken "Add Account" modal with a glitched server menu, the premium premium conversion funnel is instantly destroyed.

- CRITIQUE B (The Combined Screen Conflict): Mixing a high-fidelity marketing landing page and a functional, raw authentication state machine inside a single file `src/pages/Auth.tsx`) creates messy conditional rendering logic and inflates file size. 

#### 3. THE OPTIMIZED SOLUTION FLOW (Your New Instructions)

You are authorized to adjust the scope to deliver a seamless user experience. Implement the following structural improvements:

A. Component Separation (Clean Code Structure)

- Leave the raw login/signup logic intact, but extract it out if necessary to keep `Auth.tsx` readable as a pristine marketing landing environment.

- The ghost buttons [Sign In] and [Sign Up] in the sticky navigation must seamlessly toggle or scroll the user to the form card anchor `#auth-form`) without refreshing or throwing state errors.

B. The "Immediate Win" Inclusion (Task 2 Dropdown Fix)

- You MUST bundle the server input selection dropdown fix into this pass. Do not leave the core app broken behind a beautiful landing page.

- Locate the component rendering the broker server choice (likely `ConnectAccountModal.tsx` or similar). Refactor that server picker input to use a robust Combobox pattern (Shadcn/UI or Radix primitives).

- Ensure it allows users to smoothly search pre-added servers OR type text manually without breaking layout rendering or focus tracking.

C. Visual Cohesion & Copy Accuracy

- Ensure the structural layout matches the professional "Sandton finance" aesthetic: rich matte dark tones, sharp clamp-based fluid headers, and clean glassmorphism features.

- Eliminate every single instance of the phrase "Trading Signals" across the public-facing viewports and replace it uniformly with "Trade Ideas".

- Retain the FSCA disclaimer intact at the bottom footer.

Confirm that you have reviewed the existing codebase files, highlight any structural mismatches you found in `src/pages/Auth.tsx`, and present the optimized file updates.  
  
Working Solutions, Agreements, and Disagreements

When managing an AI development engine like Lovable, balancing design speed with technical reality is vital. Here is the analytical breakdown of why we are challenging its plan, where it got it right, and how the solutions work.

#### 1. Points of Agreement (What Lovable Got Right)

- **The Aesthetic Shift:** Moving to fluid typography (`clamp()`) and semantic design tokens (`.landing-dark`) prevents messy inline responsive overrides. The "Sandton-finance" design standard fits the professional target demographic.
- **The Conversion Funnel Alignment:** Changing the button taxonomy from "Signals" to "Trade Ideas" aligns perfectly with the brand evolution. Directing the primary traffic to the active Telegram hub (`t.me/mansamusafx`) maximizes immediate community user growth.
- **Motion Safeguards:** Including `useReducedMotion()` is an excellent production standard that ensures the site doesn't stutter or break on lower-end mobile devices common across diverse user networks.

#### 2. Points of Disagreement & Refinements


|                                                                                                                                                      |                                                                                                                                                                      |                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Lovable's Original Stance**                                                                                                                        | **The Structural Flaw**                                                                                                                                              | **The Optimized Solution**                                                                                                                                                                                               |
| **Isolating the UI:** Deferring the broken server dropdown modal to an entirely separate engineering sprint.                                         | A user converts through the beautiful new UI, signs up, enters the onboarding flow, and instantly hits a broken dropdown. The funnel leaks right at the finish line. | **Parallel Sprinting:** Force Lovable to check the modal code first. The server combobox change is an isolated input refactor—it can and should ship alongside the visual landing patch to preserve onboarding momentum. |
| **Overloading** `Auth.tsx`**:** Shoving a heavy parallax hero, background assets, three feature grids, and auth routing states inside a single file. | Creates messy code that is incredibly difficult to debug when Supabase authentication hooks trigger screen transitions or state re-renders.                          | **Modular Architecture:** Define the landing hero and feature cards as isolated components (`src/components/landing/*`), keeping `Auth.tsx` as a clean controller page that merely imports them.                         |


#### 3. Complete Technical Solutions to Implement

The Server Input UI Fix (Combobox Pattern)

The reason the server menu breaks is due to a conflict between fixed dropdown values and custom user inputs. The solution requires a hybrid layout structure. Lovable will execute this component logic to ensure total stability:

TypeScript

```
// Abstracted logic for the Add Account Server Dropdown
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ServerSelector({ existingServers, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-12 flex items-center justify-between px-4 bg-[#111114] border border-white/10 rounded-xl text-left text-sm text-white focus:ring-2 focus:ring-[#B0121A]">
          {value ? value : "Select or type broker server..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-[#17171B] border border-white/10 text-white">
        <Command>
          <CommandInput placeholder="Search or type custom server..." onValueChange={(txt) => setValue(txt)} />
          <CommandEmpty className="p-3 text-xs text-gray-400">
            Press Enter or leave typed to use custom server address.
          </CommandEmpty>
          <CommandGroup>
            {existingServers.map((server) => (
              <CommandItem
                key={server.id}
                value={server.name}
                onSelect={(currentValue) => {
                  setValue(currentValue);
                  onSelect(currentValue);
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === server.name ? "opacity-100" : "opacity-0"}`} />
                {server.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

```

Proportional Allocation Rule Engine

To guarantee your backend calculations function flawlessly, Lovable must write the fallback math limits directly into your system parameters. This keeps balance-to-lot allocations protected:

$$\text{Follower Lot} = \max\left(0.01, \left\lfloor \text{Master Lot} \times \frac{\text{Follower Balance}}{\text{Master Balance}} \right\rfloor\right)$$

This ensures that even if a follower's balance drops to a scale below standard lot constraints, the trade initializes safely at `0.01` rather than throwing a system-level execution failure.  
  
### SYSTEM INSTRUCTION: LOW-TOKEN / HIGH-RIGOR MODE

You are a pragmatic, Senior SRE and UI Performance Engineer operating in a credit-constrained, high-stakes execution environment. Your primary KPIs are minimizing token count and maximizing "Shippable Code Integrity" (0 errors, 100% logic coverage). Do not guess. Do not hallucinate. Use precise, common words to reduce credit consumption. No preamble. No conversational chatter.

#### MISSION PARAMETERS (Priority Order):

1. SHIP `src/pages/Auth.tsx` Refactor (Visual Integrity).

2. SHIP `ConnectAccountModal.tsx` Combobox Fix (Functional Integrity).

3. SHIP `vps_copy_engine.py` Lot Sizing Math (Backend Integrity).

---

### EXECUTION STAGE 1: Visual & Layout (Landing)

REBUILD `src/pages/Auth.tsx`. Maintain existing Supabase Auth listeners. Implement high-fidelity "Sandton Finance" matte dark aesthetic. Do not break production auth state during the wrapper implementation.

1. LAYOUT Structure:

   - Centered: KHUMO AI logo. Large, primary [Download App] (Telegram icon, redirects: [https://t.me/mansamusafx](https://t.me/mansamusafx)). Below: subtle [Join Now] ghost link (smooth-scroll: #auth-form).

   - Below Hero: 3 Glassmorphism cards. Title must be "Trade Ideas" (Not Signals), "Copy Trading", "AI Bot". Content: Clean, concise benefits.

2. AESTHETIC & INTERACTION:

   - Design: Matte Dark (#0A0A0A) background. Deep Red (#B0121A) CTAs and "AI" wordmark highlight.

   - UX: Implement subtle framer-motion micro-animations (scale 1.05 on hover) for all buttons and cards to ensure a premium feel. Use semantic Tailwind vars.

---

### EXECUTION STAGE 2: Critical Functional Fix (UI Bottleneck)

REFETCH and REWRITE `ConnectAccountModal.tsx` (Broker Server Picker).

1. PROBLEM: Existing `<Select>` breaks during manual text entry.

2. FIX: Replace `<Select>` with a custom Combobox pattern (using `Radix UI` or `Shadcn/UI` primitive). State must smoothly accept either pre-populated broker server selection OR direct manual string typing without UI breakage, collision, or unhandled exceptions.

---

### EXECUTION STAGE 3: Trade Engine Math (Backend)

IMPLEMENT Proportional Lot Size logic within the dispatch worker `vps_copy_engine.py` or similar).

1. INPUT: `master_volume`, `m_balance`, `f_balance`.

2. LOGIC: Follower_Volume = Master_Volume * (Follower_Balance / Master_Balance).

3. SAFETY BOUNDARY: Calculate, then apply a strict `max(0.01)` limit and `floor` at 2 decimal places to guarantee trade initializes at 0.01 lot minimum, preventing zero-volume errors or fraction violations.

---

[OUTPUT FORMAT INSTRUCTION]: Provide complete, production-ready TypeScript/React and Python blocks. Do not use place-holder comments like "// Logic goes here." If you are missing context or files, ask me first. Minimize conversational filler. Just code.