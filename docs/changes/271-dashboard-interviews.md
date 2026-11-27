# Upcoming interviews on the dashboard (#271)

The dashboard shows the interviews of the next 14 days (today included), soonest first, each linking to its application page.

Rule the card left open (default chosen, sent to the coordinator): the window is the same 14 days as the upcoming deadlines, counted by day in Asia/Seoul. Changing it is the `interviewWindowDays` constant in `backend/src/routes/dashboard.ts`.

| File                                              | Change                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/routes/dashboard.ts`                 | `upcomingInterviews` (id, applicationId, companyName, position, round, date, time) and `windows.interviewDays` in `GET /api/dashboard` |
| `frontend/src/dashboard-data.ts`, `dashboard.tsx` | New "Upcoming interviews" block with the countdown, time and a link to `/applications/:id`                                             |
| Tests                                             | Fake-pool test (five read queries), DB test for the window edges in Seoul time (CI only), screen tests                                 |

The response shape grew, so `docs/openapi.json` is unchanged (the dashboard operation has no response schema).
