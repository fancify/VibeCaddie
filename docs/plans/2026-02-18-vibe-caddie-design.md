# Vibe Caddie — Design Document

Date: 2026-02-18

## Product Overview

Vibe Caddie is a multi-user golf companion web app that provides pre-round caddie briefings, post-round recaps, and gentle learning over time. It is NOT a swing coach, GPS tracker, or stats platform. Tone: calm, supportive, plain English.

Core loop: **plan → play → recap → learn → adjust future plan**

## Confirmed Decisions

| Item | Decision |
|---|---|
| Architecture | Next.js App Router + API Routes, 3-layer separation |
| Infrastructure | AWS Amplify (Hosting) + Cognito (Auth) + RDS PostgreSQL |
| Auth | Cognito email magic link (passwordless) |
| Strategy engine | Pure logic, priority chain (history → hazards → hole type) |
| LLM | OpenRouter — generates natural language briefings/recaps |
| Knowledge base | JSON files with keyword matching (from 3 golf books) |
| UI | Custom design system tokens, responsive (iPad-first, 3 screens) |
| Data isolation | Application-layer userId injection, no DB-level RLS |
| Maps | Not in V1 |

## Architecture

### API Layer

All backend logic in Next.js API Routes. Business logic decoupled into `lib/services/` so it can be extracted to standalone Lambda if ever needed.

```
app/api/        ← Route layer (thin: validation + response)
lib/services/   ← Business logic (strategy engine, briefing, recap, LLM)
lib/db/         ← Data access layer (pg Pool, typed queries)
components/     ← UI components (design system + domain)
```

### Project Structure

```
vibe-caddie/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing / login entry
│   ├── (auth)/login/page.tsx       # Magic link login
│   ├── (app)/                      # Authenticated area
│   │   ├── layout.tsx              # Navigation shell
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx        # Profile + bag + distances
│   │   ├── courses/
│   │   │   ├── page.tsx            # Course list (shared)
│   │   │   ├── new/page.tsx
│   │   │   └── [courseId]/
│   │   │       ├── page.tsx        # Course detail + holes + hazards
│   │   │       └── holes/page.tsx
│   │   ├── briefing/
│   │   │   ├── page.tsx            # Select course → generate
│   │   │   └── [briefingId]/page.tsx
│   │   ├── rounds/
│   │   │   ├── page.tsx            # My rounds list
│   │   │   ├── new/page.tsx        # Enter new round
│   │   │   └── [roundId]/
│   │   │       ├── page.tsx        # Round detail
│   │   │       └── recap/page.tsx
│   │   └── history/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── courses/
│       ├── briefing/
│       ├── rounds/
│       ├── recap/
│       └── learning/
├── lib/
│   ├── db/
│   ├── services/
│   │   ├── strategy.ts
│   │   ├── briefing.ts
│   │   ├── recap.ts
│   │   ├── learning.ts
│   │   └── llm.ts
│   ├── knowledge/
│   ├── auth/
│   └── utils/
├── components/
│   ├── ui/
│   ├── course/
│   ├── briefing/
│   ├── round/
│   └── recap/
├── books/
├── docs/plans/
└── public/
```

## Authentication

Cognito Custom Auth Flow for passwordless magic link:
1. User enters email
2. Cognito triggers Define/Create Auth Challenge Lambda → sends email with link
3. User clicks link → Verify Auth Challenge Lambda validates
4. JWT session managed by next-auth + Cognito Provider

API Routes authenticate via `getServerSession()`. userId always injected server-side, never from client.

## Database

### Shared Tables (all authenticated users can read/write)

- `courses` — id, name, location_text, latitude (opt), longitude (opt), course_note (opt)
- `course_tees` — id, course_id, tee_name, tee_color, par_total
- `course_holes` — id, course_tee_id, hole_number, par, yardage, hole_note (opt)
- `hole_hazards` — id, course_hole_id, side (L/R/C), type (water/bunker/trees/OOB), start_yards, end_yards, note (opt)

### Private Tables (user can only access own data)

- `player_profiles` — user_id (pk), name, sex (opt), age (opt), handicap_index (opt)
- `player_bag_clubs` — id, user_id, club_code, club_label (opt), enabled (bool)
- `player_club_distances` — id, user_id, club_code, typical_carry_yards (opt), updated_at
- `pre_round_briefings` — id, user_id, course_tee_id, play_date, briefing_json (jsonb), created_at
- `rounds` — id, user_id, course_tee_id, played_date, total_score (opt), created_at
- `round_holes` — id, round_id, hole_number, tee_club, tee_result (FW/L/R/PEN), score (opt), putts (opt), gir (opt)
- `player_hole_history` — user_id, course_tee_id, hole_number, rounds_played, driver_used, control_used, penalties, avg_score

### Data Isolation

Application-layer enforcement. All private table queries require userId parameter, injected from server session:

```typescript
export async function getPlayerRounds(userId: string) {
  return db.query('SELECT * FROM rounds WHERE user_id = $1', [userId]);
}
```

### Course Deduplication

Uses `pg_trgm` extension. Course names normalized (remove accents, punctuation, lowercase) before similarity search. Threshold: 0.4.

## Strategy Engine

Priority chain per hole:

1. Player history shows high driver penalty rate → control club
2. Hazard overlaps driver carry ± 15 yards → control club (skip if carry unknown)
3. Short par-4 (<360) → control club
4. Long par-4 (>400) → driver OK
5. Par-3 → center green target
6. Par-5 → safe reach or layup
7. Default → driver OK

Output: `BriefingData` with `control_holes`, `driver_ok_holes`, `avoid_side`, and per-hole `HoleStrategy` objects containing `confidence` level.

### Confidence-Adaptive Language

| Rounds | Confidence | Language |
|---|---|---|
| 1-2 | low | "may help", "likely safer" |
| 3-5 | medium | "has been safer", "tends to work better" |
| 6+ | high | "has brought trouble", "is safer" |

## LLM Integration

### Provider

OpenRouter API, model: `anthropic/claude-sonnet-4-20250514` (configurable).

### Briefing Generation Flow

1. User selects course + tee
2. `strategy.ts` computes per-hole strategies → `BriefingData`
3. Query `player_hole_history` if exists
4. Load relevant knowledge JSON chunks by topic
5. Assemble prompt: BriefingData + history + knowledge + tone requirements
6. Call LLM → natural language briefing
7. Save to `pre_round_briefings` (briefing_json = structured fields + display text)

### Recap Generation Flow

1. User completes round entry
2. Match `pre_round_briefing` by (user_id + course_tee_id + date)
3. Compare: planned vs actual club, tee_result, score
4. Query history trends (if 2+ rounds on same course_tee)
5. Assemble prompt → call LLM → recap text
6. Trigger `learning.ts` to update `player_hole_history`

### Learning Update

After each round:
- `rounds_played++`
- `driver_used++` or `control_used++`
- `penalties++` if tee_result == 'PEN'
- Recompute `avg_score`

High penalty rate feeds back into next briefing's strategy decisions.

## Knowledge Base

Three JSON files in `lib/knowledge/`:
- `architecture.json` — Golf Architecture for Normal People
- `anatomy.json` — The Anatomy of a Golf Course
- `foundations.json` — The Four Foundations of Golf

Structure:
```json
{
  "source": "Book Title",
  "chunks": [
    { "id": "arch_001", "topic": "hazard_placement", "principle": "...", "application": "..." }
  ]
}
```

Matched by topic keyword to briefing/recap context. No vector search needed.

## UI Design System

### Colors

| Token | Value | Usage |
|---|---|---|
| bg | #F7F7F5 | Page background |
| card | #FFFFFF | Cards |
| text | #1C1C1C | Primary text |
| secondary | #6B6B6B | Secondary text |
| accent | #2F6F57 | Accent (deep green) |
| divider | #E8E6E3 | Dividers |

### Typography

Font: Inter (via next/font). Title: 28-32px semibold. Section: 18-20px semibold. Body: 15-16px regular.

### Layout

Max content width: 720px, centered column. Large spacing, rounded cards, soft shadows.

### Responsive Breakpoints

| Breakpoint | Screen | Layout |
|---|---|---|
| < 640px | Phone | Full-width, bottom tab nav |
| 640-1024px | iPad | 720px centered, bottom tab nav |
| > 1024px | Desktop | 720px centered, left sidebar nav |

### Voice

Friendly, calm, human. Say "Driver brings trouble here." Never "Dispersion corridor."

## Page Flow

```
Login
 └→ Dashboard
     ├→ New Briefing: select course → select tee → generate → view
     ├→ Enter Round: select course → per-hole entry → submit → view Recap
     ├→ Courses: browse/search → course detail → edit holes/hazards
     ├→ My Rounds: history list → round detail / recap
     └→ Settings: profile / bag / distances
```

## Build Order

1. Auth (Cognito magic link + next-auth)
2. Courses (shared CRUD + dedup)
3. Holes (per course_tee)
4. Hazards (structured input)
5. Pre-round briefing (strategy engine + LLM)
6. Round entry (per-hole input)
7. Recap (comparison + LLM)
8. Learning (history update)
9. Knowledge (book JSON)
10. Chat (Q&A with LLM)
