# universal-ps-guide

Initialized API-focused project scaffold for the problem translation/solution sharing platform.

## Available scripts

- `npm run lint` - syntax check for API and tests.
- `npm run build` - syntax check for API sources.
- `npm test` - run API tests with Vitest.

## Implemented API routes

- `GET /api/problems/:site/:externalProblemId`
- `POST /api/problems/resolve`
- `POST /api/translations`
- `PATCH /api/translations/:id`
- `POST /api/solutions`
- `PATCH /api/solutions/:id`
- `POST /api/votes`
- `DELETE /api/votes/:targetType/:targetId`

Authentication is modeled with the `x-user-id` header for mutation routes.
