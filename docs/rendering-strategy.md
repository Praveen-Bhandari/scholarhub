# Rendering strategy

ScholarHub uses the Next.js App Router. Each page picks the rendering mode that fits its data:
public, SEO-sensitive pages are rendered on the server or at build time, and private, per-user
pages are a thin shell that loads its data in the browser with the user's cookies.

The table below comes from `npm run build` (Next.js 16.4.3).

| Route | Mode | Revalidate | Data source |
|---|---|---|---|
| `/` | Static + ISR | 60 seconds | Public API, fetched on the server |
| `/courses` | Dynamic (SSR) | none | Public API; depends on search, filter, sort and page in the URL |
| `/courses/[id]` | SSG + ISR | 60 seconds | Public API; the 20 top-rated courses are pre-built with `generateStaticParams`, the rest on first visit |
| `/certificates/[id]` | Dynamic (SSR) | none | Public API, verified on every request |
| `/learn/[courseId]` | Dynamic shell + CSR | none | Private; loaded in the browser by the `LearnView` client component |
| `/dashboard` | Static shell + CSR | none | Private; loaded in the browser |
| `/instructor` | Static shell + CSR | none | Private; loaded in the browser |
| `/instructor/courses/new` | Static shell + CSR | none | Form only |
| `/instructor/courses/[id]` | Dynamic shell + CSR | none | Private; loaded in the browser |
| `/admin` | Static shell + CSR | none | Private; loaded in the browser |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Static | none | Forms only |
| `/_not-found` | Static | none | none |

## Why each choice

**Home (`/`): static with ISR (60 seconds).** The page shows public content that is the same for
everyone: top rated courses, newest courses and the category list. A pre-built page is fast and
good for SEO, and `revalidate = 60` keeps it fresh without a database hit on every visit.

**Course list (`/courses`): dynamic (SSR).** The result depends on the query string (search text,
category, level, price, sort, page), so there are far too many combinations to pre-build, and the
results must be current. The page uses `dynamic = "force-dynamic"` and renders on the server for
every request, so the HTML still arrives complete for search engines. It shows 12 courses a page.

**Course detail (`/courses/[id]`): SSG with ISR.** A course page is public, changes rarely and is
the main landing page for search traffic. The 20 top-rated courses are pre-built at build time
with `generateStaticParams`; any other approved course is generated on its first visit and then
cached. Each page is regenerated at most once every 60 seconds, so a new rating or an edit shows up
quickly without a rebuild. An unknown or malformed id returns a real 404 through `notFound()`, and
the page title and description (first 160 characters) are generated for each course.

**Certificate (`/certificates/[id]`): dynamic (SSR).** A certificate is a public page that anyone can
open to verify it. It is rendered on the server for every request (`force-dynamic`), so the check
against the database is always fresh and a revoked or unknown certificate is never served from a
cache. A certificate id that does not exist or is malformed (the API returns 404 or 400) is shown
as an "invalid certificate" page; any other server error goes to the error boundary.

**Learning page (`/learn/[courseId]`): server shell + client component.** Course content and
progress are private to the enrolled student. The route only reads `courseId` on the server and
renders the `LearnView` client component, which loads the lessons and progress in the browser with
the user's cookies. Nothing private is fetched, cached or pre-built on the server.

**Dashboards and the course editor (`/dashboard`, `/instructor`, `/instructor/courses/*`,
`/admin`): static shell + client-side rendering.** These pages show private data (earnings,
students, the review queue, user lists). Public caching would be wrong, and there is nothing for
search engines to index, so the HTML is a thin shell and the data is fetched in the browser.

**Auth forms (`/login`, `/register`, ...): static.** They contain no data, so they are pre-built.

## Why this split

| Need | Choice |
|---|---|
| Search engines must see the content | Public pages (`/`, `/courses`, `/courses/[id]`, `/certificates/[id]`) are pre-built or server-rendered |
| Content must stay fresh | ISR with a 60 second window, or SSR on every request |
| Data is private | Client-side rendering with httpOnly cookies, never cached |
| Speed | Whatever can be pre-built is pre-built |

## Access control

`proxy.ts` runs before every request. Visitors without a session are sent to `/login`, and users are
redirected away from areas of the wrong role (`/instructor` is instructor only, `/admin` is admin
only, students go to `/dashboard`). This only decides which page the user sees: every API call is
checked again on the server by the `authenticate`, `authorize` and ownership middleware (see
`docs/role-ownership-table.md`).