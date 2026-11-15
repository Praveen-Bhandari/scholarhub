## Instructor analytics (`instructorAnalytics.js`)

Every pipeline starts by selecting the logged-in instructor's own courses (`$match` on
`instructor`, or the instructor's course ids from `Course.distinct`), so one instructor can never
see another instructor's numbers.

### Overview (`overviewStats`)

Two aggregations run in parallel (`Promise.all`):

| Source | Stages | Result |
|---|---|---|
| `courses` | `$match` (own courses), then `$facet` with `byStatus` (`$group`), `total` (`$count`) and `ratings` (`$match` approved, `$group`, `$project` with `$cond` and `$round`) | Course counts by status, weighted average rating, review count |
| `enrollments` | `$match` (`course` in own course ids), `$group` by `student`, `$group` again into totals, `$project` | Unique students, enrolments, revenue, completed enrolments, completion rate |

Unique students are counted without building a big array: the first `$group` makes one row per
student, and the second `$group` counts those rows. The completion rate is
`completed / enrolments * 100`, rounded, and is 0 when there are no enrolments.

### Per-course numbers (`courseStats`)

`$match` own courses, then a `$lookup` with a sub-pipeline that `$group`s each course's
enrolments into students, revenue and completed. The result is `$unwind`ed with
`preserveNullAndEmptyArrays`, so a course with no students still appears with zeros, then
`$project` (with `$ifNull`), `$addFields` for the completion rate, and `$sort` by revenue, then
students, then `_id` (a stable order).

### Monthly series (`monthlyStats`)

`$match` own courses' enrolments from the start of the window, `$group` by `YYYY-MM`
(`$dateToString`, UTC), `$sort`. Months with no enrolments are added with zeros afterwards, only
so the chart has no gaps. The numbers themselves come from the database.