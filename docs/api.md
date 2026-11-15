# ScholarHub API

Base URL: `/api` (the Next.js client proxies `/api/*` to the Express server).
All bodies are JSON, except file uploads, which are `multipart/form-data`.

## Conventions

**Authentication.** Login sets an access token and a refresh token as httpOnly cookies. The client
sends them with `credentials: include`; tokens are never readable from JavaScript and never stored
in `localStorage`. When an access token expires the client calls `POST /auth/refresh` once and retries.

**Roles.** `student`, `instructor`, `admin`. A route marked *Instructor (owner)* also checks that the
course belongs to the logged-in instructor (see `docs/role-ownership-table.md`).

**Errors.** Every error has a `message`. Validation errors (400) also have `errors`:

```json
{ "message": "Validation failed", "errors": [{ "field": "price", "message": "Price must be 0 or more" }] }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed, or an id is not a valid ObjectId |
| 401 | Not logged in, or token invalid or expired |
| 403 | Logged in but wrong role, not the owner, or account deactivated or not verified |
| 404 | Resource does not exist |
| 409 | Action not allowed in the current state (for example editing a submitted course) |
| 429 | Rate limit reached |
| 500 | `{ "message": "Something went wrong" }` |

**Rate limiting.** All `/api` routes have a general limiter. Login, register, forgot-password and
reset-password have a stricter one.

**Pagination.** List endpoints return:

```json
{ "pagination": { "page": 1, "limit": 12, "total": 10000, "totalPages": 834, "hasNext": true } }
```

**Query parameters** that accept one value reject repeats (`?role=a&role=b` returns 400).

**Health check:** `GET /api/health` returns `{ "ok": true }`.

---

## Auth

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | Public | Body: `name` (max 80), `email`, `password` (min 8), optional `role` (`student` or `instructor`; anything else, including `admin`, becomes `student`). 201, or 409 if the email exists. Sends a verification email |
| POST | `/auth/verify-email` | Public | Body: `token`. Token is single use and valid for 24 hours |
| POST | `/auth/login` | Public | Body: `email`, `password`. Sets cookies. 401 bad credentials, 403 email not verified or account deactivated. Returns `{ message, user }` |
| POST | `/auth/refresh` | Cookie | Rotates the refresh token. Reusing an old refresh token revokes all of that user's tokens (401) |
| POST | `/auth/logout` | Cookie | Revokes the refresh token and clears cookies |
| POST | `/auth/forgot-password` | Public | Body: `email`. Always returns the same message, whether the email exists or not |
| POST | `/auth/reset-password` | Public | Body: `token`, `password` (min 8). Revokes all sessions |
| GET | `/auth/me` | Any logged-in user | Returns `{ user: { id, name, email, role } }` |

## Public courses

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/courses` | Public | Approved courses only. Query: `q` (max 100), `category`, `level` (`beginner`, `intermediate`, `advanced`), `minPrice`, `maxPrice`, `minRating` (0 to 5), `sort` (`newest`, `oldest`, `price_asc`, `price_desc`, `rating`), `page`, `limit` (max 50). Returns `{ courses, pagination }` |
| GET | `/courses/categories` | Public | Returns `{ categories: [{ category, count }] }` |
| GET | `/courses/:id` | Public | Course detail with sections and lessons (lesson content is not included) |
| GET | `/courses/:id/reviews` | Public | Query: `page`, `limit` (max 50). Returns `{ reviews, summary: { averageRating, reviewCount, distribution }, pagination }` |

## Instructor: courses

All of these require the `instructor` role.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/courses` | Instructor | Body: `title` (max 120), `description` (max 5000), `category`, optional `level`, `price` (>= 0). `status` and `instructor` in the body are ignored: status is always `draft` and the owner is the logged-in user |
| GET | `/courses/mine` | Instructor | The instructor's own courses |
| GET | `/courses/mine/:id` | Instructor (owner) | One own course with sections, lessons and attachments. Returns `{ course }` |
| PUT | `/courses/:id` | Instructor (owner) | Same fields as create, all optional. 409 while the course is submitted or approved |
| DELETE | `/courses/:id` | Instructor (owner) | 409 for an approved course |
| POST | `/courses/:id/submit` | Instructor (owner) | `draft` or `rejected` to `submitted`. 400 if the course has no lesson, 409 if already submitted or approved |

`/courses/mine` is declared before `/courses/:id` so that "mine" is not read as an id.

## Instructor: sections and lessons

All require *Instructor (owner)*.

| Method | Path | Body |
|---|---|---|
| POST | `/courses/:id/sections` | `title` (required, max 120) |
| PUT | `/courses/:id/sections/:sectionId` | `title` |
| DELETE | `/courses/:id/sections/:sectionId` | none |
| POST | `/courses/:id/sections/:sectionId/lessons` | `title` (required), optional `type` (`video` or `text`), `content` (max 20000), `durationMinutes` (integer >= 0) |
| PUT | `/courses/:id/sections/:sectionId/lessons/:lessonId` | same fields, all optional |
| DELETE | `/courses/:id/sections/:sectionId/lessons/:lessonId` | none |

## Instructor: file upload

All require *Instructor (owner)*. Ownership is checked **before** the file is read, so a rejected
request never stores a file. The server validates the file type and size.

| Method | Path | Notes |
|---|---|---|
| PUT | `/courses/:id/thumbnail` | `multipart/form-data`, field `thumbnail`, image only, max 2 MB. Replaces the old one |
| DELETE | `/courses/:id/thumbnail` | Removes it |
| POST | `/courses/:id/sections/:sectionId/lessons/:lessonId/attachments` | `multipart/form-data`, field `file`, allowed types are checked by the server, max 10 MB |
| DELETE | `/courses/:id/sections/:sectionId/lessons/:lessonId/attachments/:attachmentId` | Removes it |

## Admin: course review

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/admin/courses` | Admin | Query: `status` = `submitted` (default), `approved` or `rejected`. Oldest first. Returns `{ courses }` without sections, with `instructor { name, email }` |
| PATCH | `/admin/courses/:id/approve` | Admin | Only `submitted` courses. 409 otherwise, 404 if missing |
| PATCH | `/admin/courses/:id/reject` | Admin | Body: `reason` (required, max 500). Only `submitted` courses |

Approve and reject are one atomic query (`findOneAndUpdate` with `status: "submitted"`), so two
admins cannot both act on the same course.

## Admin: users

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/admin/users` | Admin | Query: `q` (name or email, max 100), `role`, `status` (`active` or `inactive`), `page`, `limit` (max 50). Returns `{ users, pagination }`. Passwords and tokens are never returned |
| PATCH | `/admin/users/:id` | Admin | Body: `role` and/or `isActive` (boolean). An admin cannot change their own role or status (403). A role change or a deactivation revokes that user's refresh tokens |

## Student: enrolment and learning

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/courses/:id/enroll` | Student | Admins and instructors get 403 |
| GET | `/enrollments/mine` | Student | The student's enrolments with progress |
| GET | `/enrollments/:courseId` | Student | Progress for one course |
| GET | `/learn/courses/:id` | Logged in | Full course content (lesson content and attachments). Needs an enrolment, or admin access |
| POST | `/enrollments/:courseId/lessons/:lessonId/complete` | Student | Marks a lesson complete |
| DELETE | `/enrollments/:courseId/lessons/:lessonId/complete` | Student | Marks it incomplete |
| PUT | `/enrollments/:courseId/last-lesson` | Student | Body: `lessonId` (valid id). Used to resume |
| GET | `/enrollments/:courseId/certificate` | Student | Own certificate, once the course is complete |
| GET | `/certificates/:certificateId` | Public | Verify a certificate. Id format `SH-` followed by 10 hex characters. Returns `{ valid, certificate }` |

## Student: reviews

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/courses/:id/reviews/mine` | Student | Own review |
| POST | `/courses/:id/reviews` | Student | Body: `rating` (whole number 1 to 5), optional `comment` (max 1000). Admins get 403 |
| PUT | `/courses/:id/reviews/mine` | Student | Same fields, all optional |
| DELETE | `/courses/:id/reviews/mine` | Student | Removes it |

## Analytics

All analytics are computed with MongoDB aggregation pipelines (see `docs/aggregation.md`).

| Method | Path | Access | Returns |
|---|---|---|---|
| GET | `/analytics/instructor/overview` | Instructor | `{ overview }`: course counts by status, students, enrolments, revenue, completion rate, average rating |
| GET | `/analytics/instructor/courses` | Instructor | `{ courses }`: each own course with students, revenue, completion rate |
| GET | `/analytics/instructor/monthly?months=6` | Instructor | `{ months }`: enrolments and revenue per month (`months` 1 to 24) |
| GET | `/analytics/admin/overview` | Admin | `{ overview }`: users by role, courses by status, enrolments, revenue, ratings, last-30-day counts |
| GET | `/analytics/admin/top-courses?by=enrollments&limit=5` | Admin | `{ courses }`; `by` is `enrollments`, `revenue` or `rating`; `limit` 1 to 20 |
| GET | `/analytics/admin/top-instructors?limit=5` | Admin | `{ instructors }`: name, enrolments, revenue, courses with enrolments |
| GET | `/analytics/admin/monthly?months=6` | Admin | `{ months }`: new users, enrolments, revenue per month (`months` 1 to 24) |