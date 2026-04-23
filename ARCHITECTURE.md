# Architecture: Problem Translation and Solution Sharing Platform

## 1) Goals and Scope

Build a community website where users can:
- Search programming problems by **Online Judge (OJ) site + problem ID** (e.g., `Codeforces 1700A`, `AtCoder abc300_c`, `QOJ 1234`).
- View existing community content for that problem:
  - **Translations** shown in the top section for comparison.
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
  - `site` (enum/string): `Codeforces | AtCoder | QOJ | ...`
  - `externalProblemId` (string)
  - Unique key: `(site, externalProblemId)`
- **Translation**
  - Many per problem.
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
- Translations section appears first.
- If no translation exists, show “No translation yet” CTA for logged-in users.
- Translations are sorted by score (tie-breaker newest) so users can compare alternatives.
- Solutions render as a collapsed list by default; user can expand per item or all.
- Sort default: highest score first, tie-breaker newest.

### 2.4 Naming conventions
- Application/API examples in this document use `camelCase`.
- Database schema examples use `snake_case`.

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
- Use Nitro's Database feature as the data access layer.
- Primary deployment target: Cloudflare Workers with Cloudflare D1 (SQLite-compatible relational DB).
- Keep schema and queries relational/portable so deployment can move to Postgres later with minimal changes.
- Preserve DB-level constraints for uniqueness, vote integrity, and audit-ready fields.

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
- `/problems/:site/:externalProblemId`
  - Problem header + canonical link info.
  - Translations block at top.
  - Solutions list (collapsed by default).

### 4.2 Authenticated pages
- `/submit/translation/:site/:externalProblemId`
- `/submit/solution/:site/:externalProblemId`
- `/edit/translation/:id` and `/edit/solution/:id` (author-only in phase 1)

### 4.3 Optional pages (phase 2)
- `/users/:username`
- `/moderation`

---

## 5) API Surface (SolidStart server routes)

Recommended endpoints (illustrative):
- `GET /api/problems/:site/:externalProblemId`
  - Returns problem details + translations + solutions.
- `POST /api/problems/resolve`
  - Upsert/resolve problem by `(site, externalProblemId)`.
- `POST /api/translations`
- `PATCH /api/translations/:id`
- `POST /api/solutions`
- `PATCH /api/solutions/:id`
- `POST /api/votes`
  - Body includes target type/id. Creates or keeps an upvote.
- `DELETE /api/votes/:targetType/:targetId`
  - Removes the caller's upvote.

API principles:
- Return stable typed payloads.
- Include aggregate upvote count and current user’s upvote state.
- Return full solution list for the problem (expected small volume).

---

## 6) Data Model (Logical)

### 6.1 Tables/collections
- `users`
- `problems`
  - unique index: `(site, external_problem_id)`
- `translations`
  - foreign key: `problem_id`, `author_id`
  - multiple translations allowed per problem
- `solutions`
  - foreign key: `problem_id`, `author_id`
- `votes`
  - fields: `user_id`, `target_type`, `target_id`
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
2. If translations exist, display them in top section sorted by score.
3. Logged-in users can submit additional translations for the same problem.

### 8.2 Solution lifecycle
1. Solutions fetched with vote counts.
2. Render collapsed cards/accordion by default.
3. Expand to read full content.
4. Vote interactions update score optimistically with rollback on error.

### 8.3 Search behavior
- Exact lookup by `(site, externalProblemId)` first.
- Canonicalize all input problem IDs by stripping non-alphanumeric characters and uppercasing letters before query.

---

## 9) Security, Abuse Prevention, and Data Quality

- Input validation and output encoding for all user-generated content.
- Use markdown content with raw HTML disabled.
- Render math using KaTeX during markdown rendering.
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
- Defer heavy rendering/content parsing where possible.

---

## 11) Deployment and Operations

- Deploy SolidStart app to Cloudflare Workers in the default path.
- Use Nitro Database with Cloudflare D1 in the default deployment path.
- Keep migration path documented for switching Nitro Database backend to Postgres on dedicated infrastructure.
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
- Problem page with translations at top
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
- Translations are displayed first on problem page.
- Solutions are hidden/collapsed initially.
- Stack aligns with Solid.js/SolidStart + TailwindCSS + Flowbite.
