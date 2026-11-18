# ScholarHub

An online course platform (Project 2, MERN stack). Instructors build and publish courses, admins
review them, and students enrol, learn and earn certificates.

**Live:** [https://scholarhub-plum.vercel.app](https://scholarhub-plum.vercel.app) (client) and [https://scholarhub-ga1s.onrender.com](https://scholarhub-ga1s.onrender.com) (API).

## Stack

- **Client:** Next.js (App Router, Turbopack), TypeScript, Tailwind CSS
- **Server:** Node.js, Express, express-validator
- **Database:** MongoDB with Mongoose
- **Auth:** JWT access token and rotating refresh token in httpOnly cookies
- **Uploads:** Cloudinary, with server-side type and size checks

## Features

- Three roles (student, instructor, admin) with role and ownership checks on the server
- Refresh token rotation with reuse detection and server-side invalidation
- Course lifecycle: draft, submitted, approved or rejected
- Course editor: sections, lessons, thumbnail and attachments
- Public catalogue with search, filters, sort and pagination
- Learning view with progress and resume, and certificates with a public verification page
- Reviews and ratings
- Instructor and admin dashboards backed by MongoDB aggregation pipelines
- Admin: course review queue, user management and platform analytics

## Documentation

| Document | What it covers |
|---|---|
| [`docs/api.md`](docs/api.md) | Every endpoint, access rules and errors |
| [`docs/rendering-strategy.md`](docs/rendering-strategy.md) | SSR, SSG, ISR or CSR choice per page, with reasons |
| [`docs/aggregation.md`](docs/aggregation.md) | The aggregation pipelines behind the analytics |
| [`docs/role-ownership-table.md`](docs/role-ownership-table.md) | 35 role and ownership test cases, all passing |

## Project structure

```
scholarhub/
  client/     Next.js app (app/, components/, lib/, proxy.ts)
  server/     Express API (routes/, controllers/, middleware/, models/, aggregations/, scripts/)
  docs/       API, rendering, aggregation and test documentation
```

## Run it locally

Requirements: Node.js 20 or newer, and a MongoDB database (local or Atlas).

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:5000
```

Environment variables (see `server/.env.example`): `PORT`, `MONGO_URI`, `ACCESS_TOKEN_SECRET`,
`REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES`, `REFRESH_TOKEN_EXPIRES`, `CLIENT_URL`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.

Cloudinary is needed for thumbnails and attachments. SMTP is needed for the verification and
password reset emails; seeded users are already verified, so you can log in without it.

### 2. Client

```bash
cd client
npm install
cp .env.example .env.local   # then fill in the value
npm run dev                  # http://localhost:3000
```

Environment variable (see `client/.env.example`): `API_ORIGIN`, the address of the Express server.
The Next.js app proxies `/api/*` to it, so the browser only talks to its own domain and the auth
cookies stay first-party.

### 3. Seed data

```bash
cd server
node scripts/seed.js
```

This creates an admin, instructors, students, courses and enrolments spread over the last 12
months. Every seeded account uses the password `Seed@12345`:

| Role | Email |
|---|---|
| Admin | `admin@seed.scholarhub.test` |
| Instructor | `instructor1@seed.scholarhub.test` |
| Student | `student1@seed.scholarhub.test` |

To create another admin: `node scripts/createAdmin.js <email> <password>`.

## Tests

The API is tested with scripts in `server/scripts/`, run against a running server:

```bash
cd server
node scripts/runAll.js
```

They cover auth (including the refresh token flow), roles and ownership, uploads, pagination and
search, analytics and admin user management. Most of them log in as `admin@example.com` /
`admin12345`, so create that admin first with `node scripts/createAdmin.js admin@example.com admin12345`.

## Security notes

- Passwords are hashed, and refresh tokens are stored only as hashes
- Refresh tokens rotate on every use; reusing an old one revokes the session
- Role and ownership are enforced on the server, never only in the UI
- Request bodies cannot set `role`, `status` or `instructor`
- Secrets live in environment variables; `.env` files are not committed
