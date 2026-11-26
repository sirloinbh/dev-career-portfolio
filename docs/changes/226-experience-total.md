# Show the total length of work experience (#226)

The career list now starts with "Total experience" as "N years M months".

Counting rules (user decision 2026-11-27: the recommended rules):

- Overlapping or back-to-back periods count once.
- Internships are left out of the total and shown as a separate number.
- A job with no end date counts up to today in `Asia/Seoul`; nothing counts after today.
- Partial months round down, per merged block (both end dates are worked days).

| File                              | Change                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `frontend/src/experience.ts`      | Pure `experienceOf` and `monthsText`                    |
| `frontend/src/experience.test.ts` | Overlap, gap, current job, internship, month boundaries |
| `frontend/src/careers.tsx`        | `ExperienceTotal` above the list                        |
| `frontend/src/careers.test.tsx`   | Screen test for the total text                          |
