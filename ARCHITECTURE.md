# Architecture: Universal Problem-Solving Guide

## 1) Goals and Scope

Build a community website where users can:
- Search programming problems by **OJ site + problem ID** (e.g., `Codeforces 1700A`, `AtCoder abc300_c`, `QOJ 1234`).
- View existing community content for that problem:
  - **Translation** shown at the top.
  - **Solutions** shown below and collapsed/hidden by default.
- Register/login to:
  - Submit a translation.
  - Submit one or more solutions.
  - Upvote translations and solutions from other users.

Primary stack:
- **Framework:** Solid.js + SolidStart
- **Styling:** TailwindCSS + Flowbite

Non-goals (phase 1):
- Full markdown editor with plugins.
- Real-time collaboration.
- Complex recommendation systems.

---

## 2) Product Requirements Clarified

### 2.1 User roles
- **Guest (anonymous):** search + read content.
- **Registered user:** guest capabilities + create translation/solution + upvote.
- **Moderator/Admin (future-ready):** content moderation actions.

### 2.2 Core entities
- **Problem**
  - `site` (enum/string): `codeforces | atcoder | qoj | ...`
  - `externalProblemId` (string)
  - Unique key: `(site, externalProblemId)`
- **Translation**
  - One “primary” translation per problem in phase 1 (simplifies top display).
  - Authored by a user.
  - Version metadata for edits.
- **Solution**
  - Many per problem.
  - Authored by a user.
  - Optional metadata: language, difficulty tag, approach summary.
- **Vote**
  - User vote on translation or solution.
  - One vote per `(user, targetType, targetId)`.
- **User**
  - Auth identity + public profile basics.

### 2.3 Ranking/display rules
- Translation section appears first.
- If no translation exists, show “No translation yet” CTA for logged-in users.
- Solutions render as a collapsed list by default; user can expand per item or all.
- Sort default: highest score first, tie-breaker newest.

---

## 3) High-Level System Architecture

### 3.1 Frontend (SolidStart app)
- SolidStart routes for:
  - Home/search
  - Problem detail page
  - Auth pages
  - Submission/edit pages
  - User profile (basic)
- Server-side rendering for SEO and fast first paint.
- Progressive enhancement:
  - Initial content loaded server-side.
  - Client interactions for voting, expanding solutions, and form submission.

### 3.2 Backend (SolidStart server routes)
- API endpoints inside SolidStart for:
  - Problem lookup/create-on-demand
  - Translation CRUD (phase 1: create/read/update author-owned)
  - Solution CRUD (same ownership policy)
  - Voting
- Validation at API boundary (schema-based validation recommended).
- Authorization checks in all mutation routes.

### 3.3 Data layer
- Relational DB recommended (PostgreSQL) for:
  - Strong uniqueness constraints
  - Reliable vote integrity
  - Future moderation/audit fields
- ORM/query layer can be Prisma/Drizzle/Kysely (team choice).

### 3.4 Styling/UI system
- TailwindCSS for utility-first layout and responsive design.
- Flowbite components for:
  - Navbar, cards, accordions/collapse, buttons, forms, modals, alerts.
- Maintain a thin design token layer (colors/spacing/typography) in Tailwind config for consistency.

---

## 4) Routing and Pages

### 4.1 Public pages
- `/`
  - Search by site + problem ID.
  - Optional quick examples for each supported OJ.
- `/problems/:site/:problemId`
  - Problem header + canonical link info.
  - Translation block at top.
  - Solutions list (collapsed by default).

### 4.2 Authenticated pages
- `/submit/translation/:site/:problemId`
- `/submit/solution/:site/:problemId`
- `/edit/translation/:id` and `/edit/solution/:id` (author-only in phase 1)

### 4.3 Optional pages (phase 2)
- `/users/:username`
- `/moderation`

---

## 5) API Surface (SolidStart server routes)

Recommended endpoints (illustrative):
- `GET /api/problems/:site/:problemId`
  - Returns problem details + top translation + paginated solutions.
- `POST /api/problems/resolve`
  - Upsert/resolve problem by `(site, externalProblemId)`.
- `POST /api/translations`
- `PATCH /api/translations/:id`
- `POST /api/solutions`
- `PATCH /api/solutions/:id`
- `POST /api/votes`
  - Body includes target type/id and direction.
- `DELETE /api/votes/:targetType/:targetId`

API principles:
- Return stable typed payloads.
- Include aggregate vote score and current user’s vote state.
- Use cursor pagination for solutions to scale.

---

## 6) Data Model (Logical)

### 6.1 Tables/collections
- `users`
- `problems`
  - unique index: `(site, external_problem_id)`
- `translations`
  - foreign key: `problem_id`, `author_id`
  - optional unique constraint phase 1: one active translation per problem
- `solutions`
  - foreign key: `problem_id`, `author_id`
- `votes`
  - fields: `user_id`, `target_type`, `target_id`, `value`
  - unique index: `(user_id, target_type, target_id)`

### 6.2 Audit/moderation-ready fields
- `created_at`, `updated_at`
- `deleted_at` (soft delete)
- `status` (`active`, `hidden`, `flagged`) for future moderation

---

## 7) Authentication and Authorization

### 7.1 Authentication
- Use SolidStart-compatible auth solution (e.g., Auth.js) with OAuth/email.
- Session-based auth with secure cookies.

### 7.2 Authorization rules
- Only authenticated users can create/edit content and vote.
- Authors can edit own translations/solutions.
- Voting on own content can be disallowed (recommended) to reduce gaming.
- All write endpoints enforce CSRF/session checks according to auth approach.

---

## 8) Content Lifecycle and UX Behavior

### 8.1 Translation lifecycle
1. Problem page loaded.
2. If translation exists, display at top.
3. Logged-in users can submit new translation when missing (or propose replacement in future phases).

### 8.2 Solution lifecycle
1. Solutions fetched with vote counts.
2. Render collapsed cards/accordion by default.
3. Expand to read full content.
4. Vote interactions update score optimistically with rollback on error.

### 8.3 Search behavior
- Exact lookup by `(site, problemId)` first.
- Normalize IDs per site conventions (case sensitivity and separators) before query.

---

## 9) Security, Abuse Prevention, and Data Quality

- Input validation and output encoding for all user-generated content.
- Markdown sanitization (if markdown enabled) to prevent XSS.
- Rate limit write actions (submissions/votes) by user/IP.
- Basic anti-spam controls (cooldowns, optional CAPTCHA for suspicious activity).
- Keep an immutable vote event log or change history for moderation/audit.

---

## 10) Performance and Scalability

- Cache hot read endpoints (problem pages) with short TTL.
- Add DB indexes for:
  - `(site, external_problem_id)`
  - `problem_id` on translations/solutions
  - vote lookup indexes by target
- Use pagination/infinite scroll for large solution sets.
- Defer heavy rendering/content parsing where possible.

---

## 11) Deployment and Operations

- Deploy SolidStart app on Node-compatible platform.
- Managed PostgreSQL for persistence.
- Environment variables for DB/auth/secrets.
- Backups and restore runbook for DB.
- Observability:
  - Request logging
  - Error tracking
  - Basic product metrics (searches, submissions, votes)

---

## 12) Suggested Milestones

### Milestone 1 (MVP)
- Search by site + problem ID
- Problem page with translation at top
- Solutions collapsed by default
- Auth
- Submit translation/solution
- Upvote translation/solution

### Milestone 2
- Editing/version history
- Moderation tools and reporting
- Better ranking and filtering

### Milestone 3
- Notifications, richer profiles, and community quality features

---

## 13) Minimal Acceptance Checklist

- Guest can search and view problem content.
- Registered user can submit translation and solution.
- Registered user can upvote others’ translation/solution.
- Translation is displayed first on problem page.
- Solutions are hidden/collapsed initially.
- Stack aligns with Solid.js/SolidStart + TailwindCSS + Flowbite.
