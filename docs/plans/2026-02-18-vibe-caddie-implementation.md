# Vibe Caddie Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Vibe Caddie golf companion web app — from scaffolding to chat.

**Architecture:** Next.js App Router with API Routes, 3-layer separation (routes → services → db). AWS Amplify hosting, Cognito auth, RDS PostgreSQL. OpenRouter LLM for briefing/recap generation.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, next-auth, pg (node-postgres), OpenRouter API

**Design doc:** `docs/plans/2026-02-18-vibe-caddie-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- Create: `.env.local.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`

**Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --use-npm
```

Accept defaults. This creates the base Next.js + Tailwind + TypeScript project.

**Step 2: Install dependencies**

```bash
npm install pg next-auth @auth/core
npm install -D @types/pg
```

**Step 3: Create `.env.local.example`**

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/vibecaddie?sslmode=require

# Auth - Cognito
COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{userPoolId}
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# LLM
OPENROUTER_API_KEY=
OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514
```

**Step 4: Update `.gitignore`**

Add:
```
.env.local
.env.production
books/
```

**Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds with zero errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Design System + Base UI Components

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `components/ui/card.tsx`
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/stepper.tsx`
- Create: `components/ui/section-title.tsx`
- Create: `components/ui/page-container.tsx`
- Create: `components/ui/bottom-nav.tsx`
- Create: `components/ui/sidebar-nav.tsx`
- Create: `lib/constants/clubs.ts`

**Step 1: Configure Tailwind design tokens**

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F7F7F5',
        card: '#FFFFFF',
        text: '#1C1C1C',
        secondary: '#6B6B6B',
        accent: '#2F6F57',
        'accent-hover': '#245A46',
        divider: '#E8E6E3',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'title': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'section': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.5rem' }],
      },
      maxWidth: {
        'content': '720px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Set up root layout with Inter font**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Vibe Caddie",
  description: "Your calm golf companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Set up globals.css**

`app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg: #F7F7F5;
  --color-card: #FFFFFF;
  --color-text: #1C1C1C;
  --color-secondary: #6B6B6B;
  --color-accent: #2F6F57;
  --color-accent-hover: #245A46;
  --color-divider: #E8E6E3;
  --font-family-sans: var(--font-inter), system-ui, sans-serif;
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
  --radius-card: 12px;
}
```

**Step 4: Build base UI components**

Create each component following the design system. Key components:

`components/ui/page-container.tsx` — centered 720px max-width wrapper
`components/ui/card.tsx` — white card with rounded corners and soft shadow
`components/ui/button.tsx` — primary (accent bg), secondary (outlined), ghost variants
`components/ui/input.tsx` — text input with label
`components/ui/select.tsx` — dropdown select with label
`components/ui/stepper.tsx` — numeric +/- stepper (for score/putts entry)
`components/ui/section-title.tsx` — section heading with optional divider
`components/ui/bottom-nav.tsx` — mobile/iPad bottom tab navigation
`components/ui/sidebar-nav.tsx` — desktop left sidebar navigation

Each component must use the design tokens. All components accept `className` prop for composition.

**Step 5: Create club constants**

`lib/constants/clubs.ts`:
```typescript
export const CLUB_CODES = [
  'D', '3W', '5W', '7W', '3H', '4H', '5H',
  '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'SW', 'LW', '50', '52', '54', '56', '58', '60',
  'Putter',
] as const;

export type ClubCode = typeof CLUB_CODES[number];

export const TEE_RESULTS = ['FW', 'L', 'R', 'PEN'] as const;
export type TeeResult = typeof TEE_RESULTS[number];

export const HAZARD_SIDES = ['L', 'R', 'C'] as const;
export type HazardSide = typeof HAZARD_SIDES[number];

export const HAZARD_TYPES = ['water', 'bunker', 'trees', 'OOB'] as const;
export type HazardType = typeof HAZARD_TYPES[number];
```

**Step 6: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: design system tokens and base UI components"
```

---

## Task 3: Database Schema + Connection Layer

**Files:**
- Create: `lib/db/schema.sql`
- Create: `lib/db/client.ts`
- Create: `lib/db/types.ts`
- Create: `lib/db/courses.ts`
- Create: `lib/db/players.ts`
- Create: `lib/db/rounds.ts`
- Create: `lib/db/briefings.ts`

**Step 1: Write SQL schema**

`lib/db/schema.sql` — complete schema for all tables. Include:
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- All shared tables: `courses`, `course_tees`, `course_holes`, `hole_hazards`
- All private tables: `player_profiles`, `player_bag_clubs`, `player_club_distances`, `pre_round_briefings`, `rounds`, `round_holes`, `player_hole_history`
- All UUIDs use `gen_random_uuid()` as default
- All timestamps use `now()` as default
- Proper foreign keys and unique constraints
- Unique constraint on `(course_tee_id, hole_number)` in `course_holes`
- Unique constraint on `(user_id, course_tee_id, hole_number)` in `player_hole_history`
- Index on `courses.name` using `gin(name gin_trgm_ops)` for fuzzy search

**Step 2: Create DB client**

`lib/db/client.ts`:
```typescript
import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;
```

**Step 3: Create TypeScript types**

`lib/db/types.ts` — TypeScript interfaces matching every table. All column names snake_case. Include:
- `Course`, `CourseTee`, `CourseHole`, `HoleHazard`
- `PlayerProfile`, `PlayerBagClub`, `PlayerClubDistance`
- `PreRoundBriefing`, `Round`, `RoundHole`, `PlayerHoleHistory`
- `BriefingJson` type for the jsonb column

**Step 4: Create query modules**

One file per domain. Every private-table function takes `userId` as first parameter.

`lib/db/courses.ts`:
- `searchCourses(searchTerm)` — fuzzy search with pg_trgm
- `getCourseById(id)`
- `createCourse(data)`
- `getCourseTees(courseId)`
- `createCourseTee(data)`
- `getCourseHoles(courseTeeId)`
- `upsertCourseHole(data)`
- `getHoleHazards(courseHoleId)`
- `createHoleHazard(data)`
- `deleteHoleHazard(id)`

`lib/db/players.ts`:
- `getPlayerProfile(userId)`
- `upsertPlayerProfile(userId, data)`
- `getPlayerBagClubs(userId)`
- `upsertPlayerBagClub(userId, data)`
- `getPlayerClubDistances(userId)`
- `upsertPlayerClubDistance(userId, data)`
- `getPlayerHoleHistory(userId, courseTeeId)`

`lib/db/rounds.ts`:
- `getPlayerRounds(userId)`
- `getRoundById(userId, roundId)`
- `createRound(userId, data)`
- `getRoundHoles(roundId)`
- `upsertRoundHole(data)`
- `updatePlayerHoleHistory(userId, courseTeeId, holeNumber, data)`

`lib/db/briefings.ts`:
- `createBriefing(userId, data)`
- `getBriefingById(userId, briefingId)`
- `getPlayerBriefings(userId)`
- `getBriefingForRound(userId, courseTeeId, date)`

**Step 5: Run schema against database**

```bash
psql $DATABASE_URL -f lib/db/schema.sql
```

Expected: All tables created successfully.

**Step 6: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: database schema, client, types, and query modules"
```

---

## Task 4: Authentication (Cognito Magic Link)

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth/config.ts`
- Create: `lib/auth/session.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `components/auth/login-form.tsx`
- Modify: `app/layout.tsx` (add SessionProvider)
- Create: `components/auth/session-provider.tsx`

**Step 1: Configure next-auth with Cognito**

`lib/auth/config.ts`:
```typescript
import { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

export const authOptions: NextAuthOptions = {
  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
```

Note: Cognito Custom Auth Flow (magic link) requires Lambda triggers configured in AWS. The Next.js side uses the standard Cognito provider — the magic link flow is handled by Cognito's Define/Create/Verify Auth Challenge Lambdas.

**Step 2: Create auth route handler**

`app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 3: Create session helper**

`lib/auth/session.ts`:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "./config";

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getUserId(): Promise<string> {
  const session = await getRequiredSession();
  return session.user.id;
}
```

**Step 4: Create SessionProvider wrapper**

`components/auth/session-provider.tsx` — client component wrapping next-auth SessionProvider.

**Step 5: Create login page**

`app/(auth)/login/page.tsx` + `components/auth/login-form.tsx`:
- Clean, centered login form following design system
- Email input + "Send magic link" button
- Uses `signIn("cognito")` from next-auth
- Shows success state: "Check your email for the magic link"

**Step 6: Update root layout**

Wrap children with SessionProvider.

**Step 7: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: Cognito magic link auth with next-auth"
```

---

## Task 5: App Shell (Layout + Navigation + Auth Guard)

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/nav/app-nav.tsx`
- Create: `components/nav/nav-items.ts`
- Create: `middleware.ts`

**Step 1: Create auth middleware**

`middleware.ts` — redirect unauthenticated users to `/login`. Protect all `/(app)/` routes.

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/(app)/:path*"],
};
```

**Step 2: Create navigation items config**

`components/nav/nav-items.ts`:
```typescript
export const navItems = [
  { label: "Home", href: "/dashboard", icon: "home" },
  { label: "Courses", href: "/courses", icon: "map" },
  { label: "Rounds", href: "/rounds", icon: "clipboard" },
  { label: "Profile", href: "/profile", icon: "user" },
];
```

**Step 3: Create app layout with responsive nav**

`app/(app)/layout.tsx`:
- Gets session, redirects if not authenticated
- Renders sidebar nav on desktop (> 1024px)
- Renders bottom tab nav on mobile/iPad
- Content area: centered, max-w-content, proper padding

`components/nav/app-nav.tsx`:
- Responsive component that switches between bottom tabs and sidebar
- Uses navItems config
- Active state highlighting with accent color

**Step 4: Create placeholder dashboard page**

`app/(app)/dashboard/page.tsx` — simple "Welcome to Vibe Caddie" placeholder with the user's name from session.

**Step 5: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: app shell with responsive navigation and auth guard"
```

---

## Task 6: Player Profile + Bag + Club Distances

**Files:**
- Create: `app/(app)/profile/page.tsx`
- Create: `components/profile/profile-form.tsx`
- Create: `components/profile/bag-editor.tsx`
- Create: `components/profile/distance-editor.tsx`
- Create: `app/api/profile/route.ts`
- Create: `app/api/profile/bag/route.ts`
- Create: `app/api/profile/distances/route.ts`

**Step 1: Create profile API routes**

`app/api/profile/route.ts`:
- GET: returns player profile for current user
- PUT: upserts player profile (name, sex, age, handicap_index)
- Both use `getUserId()` for data isolation

`app/api/profile/bag/route.ts`:
- GET: returns all bag clubs for current user
- PUT: upserts a club (club_code, club_label, enabled)
- DELETE: removes a club

`app/api/profile/distances/route.ts`:
- GET: returns all club distances
- PUT: upserts a distance (club_code, typical_carry_yards)

**Step 2: Create profile page**

`app/(app)/profile/page.tsx`:
- Three sections: Profile Info, My Bag, Club Distances
- Each section is a Card component

**Step 3: Create profile form**

`components/profile/profile-form.tsx`:
- Fields: name (text), sex (select: optional), age (number: optional), handicap_index (number: optional)
- Save button, shows success feedback

**Step 4: Create bag editor**

`components/profile/bag-editor.tsx`:
- Grid of all CLUB_CODES from constants
- Each club is a toggle button (enabled/disabled)
- Optional custom label input per club
- Visual: enabled clubs are accent-colored, disabled are gray
- Preset buttons: "Standard Set" (D, 3W, 5H, 5i-9i, PW, SW, Putter)

**Step 5: Create distance editor**

`components/profile/distance-editor.tsx`:
- Shows only enabled clubs from bag
- Each club has a number input for typical_carry_yards
- Explain text: "Approximate carry distances help Vibe Caddie suggest tee clubs. Leave blank if unsure."

**Step 6: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: player profile, bag editor, and club distances"
```

---

## Task 7: Courses CRUD (Shared)

**Files:**
- Create: `app/(app)/courses/page.tsx`
- Create: `app/(app)/courses/new/page.tsx`
- Create: `app/(app)/courses/[courseId]/page.tsx`
- Create: `components/course/course-list.tsx`
- Create: `components/course/course-form.tsx`
- Create: `components/course/course-search.tsx`
- Create: `components/course/duplicate-warning.tsx`
- Create: `app/api/courses/route.ts`
- Create: `app/api/courses/[courseId]/route.ts`
- Create: `app/api/courses/search/route.ts`
- Create: `lib/services/course.ts`

**Step 1: Create course name normalization**

`lib/services/course.ts`:
```typescript
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim();
}
```

**Step 2: Write test for normalization**

```typescript
// __tests__/services/course.test.ts
import { normalizeName } from '@/lib/services/course';

describe('normalizeName', () => {
  test('removes accents', () => {
    expect(normalizeName('Café Golf')).toBe('caf golf');
  });
  test('removes punctuation', () => {
    expect(normalizeName("Pine's Valley G.C.")).toBe('pines valley gc');
  });
  test('lowercases', () => {
    expect(normalizeName('MISSION HILLS')).toBe('mission hills');
  });
  test('trims whitespace', () => {
    expect(normalizeName('  Spring City  ')).toBe('spring city');
  });
});
```

**Step 3: Run test**

```bash
npx jest __tests__/services/course.test.ts
```

Expected: All 4 tests PASS.

**Step 4: Create course API routes**

`app/api/courses/route.ts`:
- GET: list all courses (shared, paginated)
- POST: create course (name, location_text). Before creating, check for duplicates via similarity search. Return similar matches if found.

`app/api/courses/search/route.ts`:
- GET `?q=term`: fuzzy search courses using pg_trgm

`app/api/courses/[courseId]/route.ts`:
- GET: course detail with tees
- PUT: update course info

**Step 5: Create course list page**

`app/(app)/courses/page.tsx`:
- Search bar at top (debounced, calls search API)
- List of course cards showing name, location, tee count
- "Add Course" button
- Explain text: "You're helping build the course guide for everyone."

**Step 6: Create course creation page**

`app/(app)/courses/new/page.tsx` + `components/course/course-form.tsx`:
- Course name input
- Location text input
- On name blur/change: search for duplicates, show `duplicate-warning.tsx` if similar matches found
- Tee section: add tee (tee_name, tee_color picker, par_total)
- Explain text: "You only need a scorecard or memory. Approximate distances are fine."

**Step 7: Create course detail page**

`app/(app)/courses/[courseId]/page.tsx`:
- Course name + location
- Tee list with links to hole editing
- Add tee button

**Step 8: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: shared courses CRUD with duplicate detection"
```

---

## Task 8: Course Holes

**Files:**
- Create: `app/(app)/courses/[courseId]/tees/[teeId]/holes/page.tsx`
- Create: `components/course/hole-editor.tsx`
- Create: `components/course/hole-row.tsx`
- Create: `app/api/courses/[courseId]/tees/[teeId]/holes/route.ts`

**Step 1: Create holes API**

`app/api/courses/[courseId]/tees/[teeId]/holes/route.ts`:
- GET: list all holes for a course_tee, ordered by hole_number
- PUT: upsert a hole (hole_number, par, yardage, hole_note)

**Step 2: Create hole editor page**

`app/(app)/courses/[courseId]/tees/[teeId]/holes/page.tsx`:
- Title: "{Course Name} — {Tee Name} Tee"
- Table/list of 18 holes (or 9, based on par_total)
- Each row: hole number, par (select 3/4/5), yardage (number), note (text, optional)
- "Quick fill" option: enter all pars at once (e.g., 4,3,4,5,4,4,3,4,4,4,4,3,5,4,4,3,4,5)
- Save all button

**Step 3: Create hole row component**

`components/course/hole-row.tsx`:
- Compact row optimized for quick data entry
- Par: 3 toggle buttons (3, 4, 5)
- Yardage: number input
- Note: expandable text input

**Step 4: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: course hole editor with quick-fill"
```

---

## Task 9: Hole Hazards (Structured Input)

**Files:**
- Create: `components/course/hazard-editor.tsx`
- Create: `components/course/hazard-row.tsx`
- Create: `app/api/courses/holes/[holeId]/hazards/route.ts`

**Step 1: Create hazards API**

`app/api/courses/holes/[holeId]/hazards/route.ts`:
- GET: list hazards for a hole
- POST: create hazard (side, type, start_yards, end_yards, note)
- DELETE: remove hazard by id

All fields are structured — no free-text hazard descriptions.

**Step 2: Create hazard editor**

`components/course/hazard-editor.tsx`:
- Displayed within hole editor or course detail page
- "Add Hazard" button opens inline form
- List of existing hazards with delete option

**Step 3: Create hazard row/form**

`components/course/hazard-row.tsx`:
- Side: 3 toggle buttons (Left, Right, Center)
- Type: 4 toggle buttons (Water, Bunker, Trees, OOB)
- Start yards: number input (optional, "approximate OK")
- End yards: number input (optional)
- Note: short text input (optional)
- Display format: "Water Right 230–260"

**Step 4: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: structured hazard editor for course holes"
```

---

## Task 10: Strategy Engine (TDD)

**Files:**
- Create: `lib/services/strategy.ts`
- Create: `__tests__/services/strategy.test.ts`

This is pure business logic — ideal for TDD.

**Step 1: Define types**

```typescript
// lib/services/strategy.ts
export type Confidence = 'low' | 'medium' | 'high';
export type TeeDecision = 'driver' | 'control' | 'center_green' | 'safe_reach';

export interface HoleStrategy {
  hole_number: number;
  decision: TeeDecision;
  reason: string;
  confidence: Confidence;
  hazard_notes: string[];
}

export interface BriefingData {
  control_holes: number[];
  driver_ok_holes: number[];
  avoid_side: 'left' | 'right' | 'none';
  hole_strategies: HoleStrategy[];
}

export interface HoleInput {
  hole_number: number;
  par: number;
  yardage: number;
  hazards: Array<{
    side: string;
    type: string;
    start_yards: number | null;
    end_yards: number | null;
  }>;
}

export interface PlayerHistoryInput {
  hole_number: number;
  rounds_played: number;
  driver_used: number;
  penalties: number;
}

export interface PlayerDistanceInput {
  driver_carry: number | null;
}
```

**Step 2: Write failing tests for each strategy rule**

`__tests__/services/strategy.test.ts`:

```typescript
import { computeHoleStrategy, computeBriefing } from '@/lib/services/strategy';

describe('computeHoleStrategy', () => {
  // Rule 1: High driver penalty history → control
  test('recommends control when driver penalty rate > 40% with history', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 5, driver_used: 4, penalties: 3 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.decision).toBe('control');
    expect(result.confidence).toBe('medium');
  });

  // Rule 2: Hazard overlaps driver carry ± 15
  test('recommends control when hazard overlaps driver carry band', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: 230, end_yards: 260 }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: 245 });
    expect(result.decision).toBe('control');
  });

  // Rule 2 skip: No driver carry known
  test('skips hazard overlap check when driver carry unknown', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: 230, end_yards: 260 }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: null });
    expect(result.decision).toBe('driver'); // falls through to default
  });

  // Rule 3: Short par-4
  test('recommends control for short par-4 under 360', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 340, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('control');
  });

  // Rule 4: Long par-4
  test('recommends driver for long par-4 over 400', () => {
    const hole: HoleInput = { hole_number: 10, par: 4, yardage: 430, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('driver');
  });

  // Rule 5: Par-3
  test('recommends center green for par-3', () => {
    const hole: HoleInput = { hole_number: 3, par: 3, yardage: 165, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('center_green');
  });

  // Rule 6: Par-5
  test('recommends safe reach for par-5', () => {
    const hole: HoleInput = { hole_number: 5, par: 5, yardage: 520, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('safe_reach');
  });

  // Confidence levels
  test('returns low confidence for 1-2 rounds', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 2, driver_used: 2, penalties: 2 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.confidence).toBe('low');
  });

  test('returns high confidence for 6+ rounds', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 8, driver_used: 7, penalties: 5 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.confidence).toBe('high');
  });
});

describe('computeBriefing', () => {
  test('aggregates control_holes and driver_ok_holes', () => {
    // Setup 18 holes with mixed decisions
    // Verify control_holes and driver_ok_holes arrays
  });

  test('computes avoid_side from hazard majority', () => {
    // Setup holes where most hazards are on right
    // Verify avoid_side === 'right'
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npx jest __tests__/services/strategy.test.ts
```

Expected: FAIL — functions not defined.

**Step 4: Implement strategy engine**

`lib/services/strategy.ts`:
- `computeHoleStrategy(hole, history, playerDistance)` → `HoleStrategy`
- `computeBriefing(holes, histories, playerDistance)` → `BriefingData`
- `getConfidence(roundsPlayed)` → `Confidence`
- Implements the full priority chain from the spec

**Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/services/strategy.test.ts
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: strategy engine with priority chain and confidence levels"
```

---

## Task 11: LLM Service (OpenRouter)

**Files:**
- Create: `lib/services/llm.ts`
- Create: `__tests__/services/llm.test.ts`

**Step 1: Create OpenRouter client**

`lib/services/llm.ts`:
```typescript
interface LLMResponse {
  content: string;
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<LLMResponse> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-20250514',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} — ${error}`);
  }

  const data = await res.json();
  return { content: data.choices[0].message.content };
}
```

**Step 2: Create system prompts**

Add to `lib/services/llm.ts`:
```typescript
export const BRIEFING_SYSTEM_PROMPT = `You are Vibe Caddie, a friendly amateur caddie.
Write a pre-round briefing in calm, supportive, plain English.
Never use jargon like "dispersion", "strokes gained", or "corridor".
Structure the briefing with these sections:
- Tee Strategy
- Approach Strategy
- Risk Rules
- Scoring Focus
- Today's Priorities
- Reminders from Last Time (if history provided)

Use confidence-adaptive language:
- low confidence: "may help", "likely safer", "can reduce risk"
- medium confidence: "has been safer", "tends to work better"
- high confidence: "has brought trouble", "is safer", "avoids mistakes"`;

export const RECAP_SYSTEM_PROMPT = `You are Vibe Caddie, a friendly amateur caddie.
Write a post-round recap in calm, supportive, plain English.
Never use jargon. Be encouraging but honest.
Structure the recap with:
- Quick Summary
- Tee Decisions (what went well, what didn't)
- One Thing to Keep
- One Thing to Change Next Time
- Your Progress on This Course (if 2+ rounds, plain English trends)`;
```

**Step 3: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: OpenRouter LLM service with system prompts"
```

---

## Task 12: Pre-Round Briefing

**Files:**
- Create: `lib/services/briefing.ts`
- Create: `app/(app)/briefing/page.tsx`
- Create: `app/(app)/briefing/[briefingId]/page.tsx`
- Create: `components/briefing/course-selector.tsx`
- Create: `components/briefing/briefing-display.tsx`
- Create: `app/api/briefing/route.ts`
- Create: `app/api/briefing/[briefingId]/route.ts`

**Step 1: Create briefing service**

`lib/services/briefing.ts`:
```typescript
export async function generateBriefing(
  userId: string,
  courseTeeId: string,
  playDate: string,
): Promise<{ briefingJson: BriefingJson; displayText: string }> {
  // 1. Fetch course holes + hazards
  // 2. Fetch player distances (driver carry)
  // 3. Fetch player hole history for this course_tee
  // 4. Run strategy engine → BriefingData
  // 5. Load knowledge chunks by relevant topics
  // 6. Assemble prompt with all data
  // 7. Call LLM
  // 8. Parse response, combine with structured BriefingData
  // 9. Return briefing_json + display text
}
```

**Step 2: Create briefing API routes**

`app/api/briefing/route.ts`:
- POST: `{ course_tee_id, play_date }` → generates briefing, saves to DB, returns briefing
- GET: list player's briefings

`app/api/briefing/[briefingId]/route.ts`:
- GET: returns specific briefing

**Step 3: Create course/tee selector**

`app/(app)/briefing/page.tsx` + `components/briefing/course-selector.tsx`:
- Step 1: Search/select course
- Step 2: Select tee
- Step 3: Select date (defaults to today)
- "Generate Briefing" button → calls API → redirects to briefing view

**Step 4: Create briefing display**

`app/(app)/briefing/[briefingId]/page.tsx` + `components/briefing/briefing-display.tsx`:
- Title: "Vibe Caddie Briefing — {Course} ({Tee})"
- Renders each section from the LLM-generated text
- Shows structured data: driver_ok_holes and control_holes as pills/chips
- Clean typography following design system
- Print-friendly layout (for printing before round)

**Step 5: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: pre-round briefing generation and display"
```

---

## Task 13: Round Entry

**Files:**
- Create: `app/(app)/rounds/new/page.tsx`
- Create: `app/(app)/rounds/page.tsx`
- Create: `app/(app)/rounds/[roundId]/page.tsx`
- Create: `components/round/round-setup.tsx`
- Create: `components/round/hole-entry.tsx`
- Create: `components/round/hole-entry-nav.tsx`
- Create: `components/round/round-summary.tsx`
- Create: `app/api/rounds/route.ts`
- Create: `app/api/rounds/[roundId]/route.ts`
- Create: `app/api/rounds/[roundId]/holes/route.ts`

**Step 1: Create rounds API**

`app/api/rounds/route.ts`:
- GET: list player rounds (with course name, date, total score)
- POST: create round `{ course_tee_id, played_date }`

`app/api/rounds/[roundId]/route.ts`:
- GET: round detail with holes
- PUT: update total_score

`app/api/rounds/[roundId]/holes/route.ts`:
- PUT: upsert hole data `{ hole_number, tee_club, tee_result, score, putts, gir }`

**Step 2: Create round setup page**

`app/(app)/rounds/new/page.tsx` + `components/round/round-setup.tsx`:
- Select course + tee (reuse course-selector)
- Date picker (defaults to today)
- "Start Entry" button → creates round → goes to hole entry

**Step 3: Create hole entry component (critical UX)**

`components/round/hole-entry.tsx`:
- Shows one hole at a time
- Header: "Hole {n} · Par {par} · {yardage} yds"
- Tee Club: grid of buttons from player's enabled bag clubs. Large touch targets (min 44px).
- Tee Result: 4 buttons — FW (green), L (amber), R (amber), PEN (red)
- Score: stepper component (- / value / +), pre-filled with par
- Putts: stepper component (optional)
- GIR: toggle Yes/No (optional)
- Auto-saves on each change (debounced PUT to API)

`components/round/hole-entry-nav.tsx`:
- Previous / Next hole buttons
- Hole number indicator (dots or numbers)
- Swipe gesture support (optional, nice-to-have)

**Step 4: Create rounds list page**

`app/(app)/rounds/page.tsx`:
- List of completed rounds
- Each card: course name, tee, date, total score, FW count
- Link to round detail

**Step 5: Create round detail + summary**

`app/(app)/rounds/[roundId]/page.tsx` + `components/round/round-summary.tsx`:
- Per-hole table: hole, par, club, result, score, putts
- Totals row
- Link to recap (if exists) or "Generate Recap" button

**Step 6: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: round entry with per-hole input and rounds list"
```

---

## Task 14: Post-Round Recap + Learning Update

**Files:**
- Create: `lib/services/recap.ts`
- Create: `lib/services/learning.ts`
- Create: `__tests__/services/learning.test.ts`
- Create: `app/(app)/rounds/[roundId]/recap/page.tsx`
- Create: `components/recap/recap-display.tsx`
- Create: `app/api/recap/route.ts`

**Step 1: Write learning update tests**

`__tests__/services/learning.test.ts`:
```typescript
import { computeHistoryUpdate } from '@/lib/services/learning';

describe('computeHistoryUpdate', () => {
  test('increments rounds_played', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 1, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 4 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.rounds_played).toBe(4);
  });

  test('increments driver_used when tee_club is D', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.driver_used).toBe(3);
    expect(result.control_used).toBe(1);
  });

  test('increments control_used when tee_club is not D', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: '3W', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.driver_used).toBe(2);
    expect(result.control_used).toBe(2);
  });

  test('increments penalties when tee_result is PEN', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 1, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'PEN', score: 7 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.penalties).toBe(2);
  });

  test('recomputes avg_score as running average', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 4 };
    const result = computeHistoryUpdate(existing, holeData);
    // (5.0 * 3 + 4) / 4 = 4.75
    expect(result.avg_score).toBeCloseTo(4.75);
  });

  test('handles first round (no existing history)', () => {
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(null, holeData);
    expect(result.rounds_played).toBe(1);
    expect(result.driver_used).toBe(1);
    expect(result.avg_score).toBe(5);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/services/learning.test.ts
```

**Step 3: Implement learning service**

`lib/services/learning.ts`:
```typescript
export function computeHistoryUpdate(
  existing: PlayerHoleHistory | null,
  holeData: { tee_club: string; tee_result: string; score: number },
): PlayerHoleHistory { /* implement */ }

export async function updateLearningAfterRound(
  userId: string,
  roundId: string,
): Promise<void> {
  // 1. Get round + round_holes
  // 2. For each hole, compute history update
  // 3. Upsert player_hole_history
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/services/learning.test.ts
```

**Step 5: Create recap service**

`lib/services/recap.ts`:
```typescript
export async function generateRecap(
  userId: string,
  roundId: string,
): Promise<string> {
  // 1. Get round + round_holes
  // 2. Find matching briefing (same user + course_tee + date)
  // 3. Compare planned vs actual (club, result, score)
  // 4. Query player_hole_history for trends (if 2+ rounds)
  // 5. Assemble prompt
  // 6. Call LLM → recap text
  // 7. Trigger learning update
  // 8. Return recap
}
```

**Step 6: Create recap API + page**

`app/api/recap/route.ts`:
- POST `{ round_id }` → generates recap + triggers learning update

`app/(app)/rounds/[roundId]/recap/page.tsx` + `components/recap/recap-display.tsx`:
- Title: "Vibe Caddie Recap — {Course} ({Tee})"
- Renders recap sections from LLM text
- Shows plan vs play comparison if briefing existed
- Progress section if 2+ rounds on same course

**Step 7: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: post-round recap generation and learning update"
```

---

## Task 15: Dashboard

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Create: `components/dashboard/quick-actions.tsx`
- Create: `components/dashboard/recent-rounds.tsx`
- Create: `components/dashboard/trends-card.tsx`
- Create: `app/api/dashboard/route.ts`

**Step 1: Create dashboard API**

`app/api/dashboard/route.ts`:
- GET: returns aggregated data for current user
  - recent 5 rounds (course, date, score, FW count)
  - basic trends (avg score over last 5 rounds, FW hit rate trend)
  - upcoming briefings (if any saved for future dates)

**Step 2: Build dashboard page**

`app/(app)/dashboard/page.tsx`:
- Greeting: "Hey {name}"
- Quick actions: "New Briefing" card + "Enter Round" card
- Recent rounds list (last 5)
- Trends card (if enough data)
- All using design system components

**Step 3: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: dashboard with quick actions, recent rounds, and trends"
```

---

## Task 16: Knowledge Base (Book JSON)

**Files:**
- Create: `lib/knowledge/architecture.json`
- Create: `lib/knowledge/anatomy.json`
- Create: `lib/knowledge/foundations.json`
- Create: `lib/services/knowledge.ts`

**Step 1: Extract knowledge from books**

Read each book and extract principles relevant to:
- `hazard_placement` — how hazards affect play
- `tee_strategy` — when to use driver vs control
- `course_management` — general course strategy
- `green_approach` — approach shot principles
- `risk_reward` — risk/reward decision making
- `scoring` — scoring strategy
- `mental_game` — mental approach

Each chunk:
```json
{
  "id": "arch_001",
  "topic": "hazard_placement",
  "principle": "Hazards placed at driving distance are meant to...",
  "application": "When a hazard sits in your landing zone..."
}
```

**Step 2: Create knowledge matcher**

`lib/services/knowledge.ts`:
```typescript
export function getRelevantKnowledge(
  topics: string[],
  maxChunks?: number,
): KnowledgeChunk[] {
  // Load all JSON files
  // Filter chunks by matching topics
  // Return up to maxChunks (default 5)
}
```

**Step 3: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: knowledge base JSON from golf books"
```

---

## Task 17: Chat (Q&A)

**Files:**
- Create: `app/(app)/chat/page.tsx`
- Create: `components/chat/chat-interface.tsx`
- Create: `components/chat/message-bubble.tsx`
- Create: `app/api/chat/route.ts`
- Create: `lib/services/chat.ts`

**Step 1: Create chat service**

`lib/services/chat.ts`:
```typescript
export async function handleChatMessage(
  userId: string,
  message: string,
): Promise<string> {
  // 1. Determine context needed (course? round? general?)
  // 2. Fetch relevant data: player history, recent rounds, briefings
  // 3. Load relevant knowledge chunks
  // 4. Build prompt with context + user question
  // 5. Call LLM
  // 6. Return response
}
```

System prompt for chat should include the user's recent context and maintain the Vibe Caddie voice.

**Step 2: Create chat API**

`app/api/chat/route.ts`:
- POST `{ message }` → returns `{ response }`
- Stateless per request (context assembled from DB each time)

**Step 3: Create chat UI**

`app/(app)/chat/page.tsx` + `components/chat/chat-interface.tsx`:
- Message list (scrollable)
- Input bar at bottom
- Vibe Caddie avatar/icon on assistant messages
- Loading state while LLM responds

**Step 4: Add chat to navigation**

Update `components/nav/nav-items.ts` to include Chat tab.

**Step 5: Verify build + commit**

```bash
npm run build
git add -A
git commit -m "feat: chat Q&A interface with Vibe Caddie voice"
```

---

## Task 18: Final Integration + Polish

**Step 1: Cross-link all pages**

- Dashboard "New Briefing" → briefing page
- Dashboard "Enter Round" → round entry
- Round detail → "Generate Recap" → recap
- Course detail → "Create Briefing for this course" shortcut
- Briefing page → after generation, link to save/print

**Step 2: Add loading states and error handling**

- All API calls: loading skeletons, error toasts
- LLM calls: "Generating your briefing..." spinner with caddie-voice text
- Network errors: friendly retry messages

**Step 3: Responsive testing**

- Test all pages at phone (375px), iPad portrait (768px), iPad landscape (1024px), desktop (1440px)
- Navigation switches correctly between bottom tabs and sidebar
- Touch targets are min 44px on mobile/iPad

**Step 4: Add amplify.yml for deployment**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**Step 5: Final build check**

```bash
npm run build
npx jest --passWithNoTests
```

Expected: Zero errors, all tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: final integration, polish, and deployment config"
```

---

## Summary

| Task | Description | Key Files |
|---|---|---|
| 1 | Project scaffolding | package.json, next.config.ts |
| 2 | Design system + UI components | tailwind.config.ts, components/ui/* |
| 3 | Database schema + queries | lib/db/* |
| 4 | Auth (Cognito magic link) | lib/auth/*, app/api/auth/* |
| 5 | App shell + navigation | app/(app)/layout.tsx, middleware.ts |
| 6 | Profile + bag + distances | app/(app)/profile/*, app/api/profile/* |
| 7 | Courses CRUD | app/(app)/courses/*, lib/services/course.ts |
| 8 | Course holes | components/course/hole-editor.tsx |
| 9 | Hole hazards | components/course/hazard-editor.tsx |
| 10 | Strategy engine (TDD) | lib/services/strategy.ts + tests |
| 11 | LLM service | lib/services/llm.ts |
| 12 | Pre-round briefing | lib/services/briefing.ts + UI |
| 13 | Round entry | components/round/hole-entry.tsx |
| 14 | Recap + learning | lib/services/recap.ts, learning.ts + tests |
| 15 | Dashboard | app/(app)/dashboard/* |
| 16 | Knowledge base | lib/knowledge/*.json |
| 17 | Chat | app/(app)/chat/* |
| 18 | Integration + polish | Cross-links, loading states, deployment |
