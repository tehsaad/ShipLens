# Sample data: expected dashboard values

The values the dashboard shows for the section 10 sample data (`npm run db:seed`, data in
`prisma/seed/data.ts`), as of **18 October 2026** in Asia/Karachi, the last day the seed
covers. `tests/integration/sample-data.test.ts` loads the seed into a database of its own and
asserts every value below (section 10, acceptance).

The figures were first worked out from `prisma/seed/data.ts` alone, independently of the
dashboard code, and the dashboard was then checked against them. Each KPI follows its section
7.2 definition; sums are net of correction entries (decision 7a), and the seed has none.

On any later date the dashboard moves on: "this month", the 12-month window and the overdue
weeks all follow the current business date. The Render deployment therefore shows different
figures from these unless it is viewed on 18 October 2026.

## Head office (Super Admin, Finance Reviewer)

| KPI                     | Definition                                         | Expected                            |
| ----------------------- | -------------------------------------------------- | ----------------------------------- |
| Collections this month  | Sum and count of collections dated in October 2026 | **PKR 55,000.00**, **10** entries   |
| Active branches         | Branches with status ACTIVE                        | **4**                               |
| Active members          | Members with status ACTIVE                         | **32**                              |
| Reports awaiting review | SUBMITTED reports, oldest `submittedAt`            | **2**, oldest **21 Sep 2026** 12:00 |
| Unrouted collections    | Count and sum where `routedAt` is null             | **34** entries, **PKR 186,000.00**  |
| Pending applications    | Applications with status NEW                       | **8**                               |

### Collections per month (line chart, PKR)

| Month    | Total     | Month    | Total     |
| -------- | --------- | -------- | --------- |
| Nov 2025 | 73,000.00 | May 2026 | 67,500.00 |
| Dec 2025 | 32,500.00 | Jun 2026 | 46,000.00 |
| Jan 2026 | 77,500.00 | Jul 2026 | 62,500.00 |
| Feb 2026 | 37,000.00 | Aug 2026 | 50,500.00 |
| Mar 2026 | 72,500.00 | Sep 2026 | 57,500.00 |
| Apr 2026 | 41,500.00 | Oct 2026 | 55,000.00 |

### New members per month (bar chart)

Nov 2025 to Oct 2026: 3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 2 (39 in total; the 40th member joined
earlier).

### Unrouted list

Oldest first; the first three are dated 4 Nov 2025, 4 Dec 2025 and 17 Dec 2025.

### Overdue weekly reports (decision 9)

Completed weeks since each ACTIVE branch opened with no SUBMITTED or APPROVED report. The last
completed week is the one starting 5 Oct 2026; the week of 12 Oct ends on 18 Oct and is not
complete yet.

| Branch     | Overdue weeks | Oldest missing week |
| ---------- | ------------- | ------------------- |
| BR-ISL-001 | 89            | 2025-01-20          |
| BR-KAR-001 | 135           | 2024-02-26          |
| BR-KAR-002 | 108           | 2024-09-09          |
| BR-LAH-001 | 126           | 2024-05-06          |

## Other roles

- **HR Lead:** membership figures only: active members 32, pending applications 8, active
  branches 4, and the new-members chart. No finance figures.
- **Branch Lead (`lead.kar001`, BR-KAR-001):** own branch only. Collections this month
  PKR 12,500.00 (3), unrouted 10 entries / PKR 53,000.00, 1 report awaiting review, 135
  overdue weeks, active members 7, pending applications preferring the branch 2. No
  active-branches figure.
- **Content Editor:** no dashboard.
