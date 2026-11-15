# MongoDB aggregation

All analytics numbers are computed inside MongoDB with aggregation pipelines. The API never loads
documents into JavaScript to add them up. The code lives in `server/aggregations/`
(`adminAnalytics.js`, `instructorAnalytics.js`, `monthSeries.js`).

## Platform overview (`overviewStats`)

One round trip per collection, using `$facet` to compute several results from a single scan:

| Collection | Facets | Stages |
|---|---|---|
| `users` | users by role, total, joined in the last 30 days | `$group`, `$count`, `$match` |
| `courses` | courses by status, total, weighted average rating | `$group`, `$count`, `$match`, `$project`, `$cond`, `$round` |
| `enrollments` | totals (count, revenue, completed, completion rate), last 30 days | `$group`, `$match`, `$project`, `$cond`, `$round` |

The three collections are queried in parallel with `Promise.all`.
The platform average rating is weighted: sum of `averageRating * reviewCount` divided by the total
review count, over approved courses only.
A course counts as completed when `completedAt` has BSON type `date` (`$type`).

## Top courses (`topCourses`)

1. `$match` approved courses (and `reviewCount > 0` when ranking by rating).
2. `$lookup` into `enrollments` with a sub-pipeline that `$group`s enrolments and revenue per
   course, so the join returns one small row, not every enrolment.
3. `$unwind` with `preserveNullAndEmptyArrays` and `$addFields` with `$ifNull`, so courses with no
   enrolments still appear with zero.
4. `$sort` (with `_id` as the last key so ties are stable) and `$limit`.
5. Only after the limit, a second `$lookup` into `users` that projects just the instructor's name.
   This runs for at most `limit` rows, and the email and password hash never enter the pipeline.

## Top instructors (`topInstructors`)

`$group` enrolments by course, `$lookup` each course's instructor, `$group` again by instructor
(summing enrolments and revenue and counting courses), then `$sort`, `$limit` and a name `$lookup`.

## Monthly series (`monthlyStats`)

`$match` on `createdAt >= start of window`, then `$group` by a `YYYY-MM` key
(`monthKey` in `monthSeries.js`). `monthWindow` builds the list of month labels, and the code fills
months with no data with zeros so the chart has no gaps. Users and enrolments are aggregated in
parallel.

## Instructor analytics

*(to be completed from `instructorAnalytics.js`)*

## Why aggregation and not JavaScript

- The database does the grouping, so only the final small result crosses the network.
- `$facet` and `$lookup` sub-pipelines avoid loading all enrolments into memory.
- Sorting and limiting happen before expensive joins.