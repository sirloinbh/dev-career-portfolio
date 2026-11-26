import type { Express } from 'express';
import type { Pool } from 'pg';

// Dashboard summary (#221): read-only. The windows are the recommended values on the card; the user's
// answer is recorded on #221 and the constants change here only.
const deadlineWindowDays = 14;
const expiryWindowDays = 90;
const recentLimit = 5;

export function registerDashboardRoutes(app: Express, pool: Pool, today: () => string) {
  app.get('/api/dashboard', async (_req, res) => {
    const date = today();
    const [counts, deadlines, expiries, recent] = await Promise.all([
      pool.query<Record<string, number>>(
        `SELECT
           (SELECT count(*)::int FROM educations) AS educations,
           (SELECT count(*)::int FROM careers) AS careers,
           (SELECT count(*)::int FROM projects) AS projects,
           (SELECT count(*)::int FROM skills) AS skills,
           (SELECT count(*)::int FROM certifications) AS certifications,
           (SELECT count(*)::int FROM applications) AS applications`,
      ),
      // Only a cover letter still being written has a deadline worth warning about. Due today counts (#83).
      pool.query(
        `SELECT id, company_name AS "companyName", position, deadline
         FROM applications
         WHERE status = 'drafting' AND deadline BETWEEN $1::date AND $1::date + $2::int
         ORDER BY deadline, id`,
        [date, deadlineWindowDays],
      ),
      // The expiry date itself still counts as valid, so it is in the window; a past date is not.
      pool.query(
        `SELECT id, name, issuer, expiry_date AS "expiryDate"
         FROM certifications
         WHERE expiry_date BETWEEN $1::date AND $1::date + $2::int
         ORDER BY expiry_date, id`,
        [date, expiryWindowDays],
      ),
      pool.query(
        `SELECT section, id, title, updated_at AS "updatedAt" FROM (
           SELECT 'educations' AS section, id, school AS title, updated_at FROM educations
           UNION ALL SELECT 'careers', id, company, updated_at FROM careers
           UNION ALL SELECT 'projects', id, name, updated_at FROM projects
           UNION ALL SELECT 'skills', id, name, updated_at FROM skills
           UNION ALL SELECT 'certifications', id, name, updated_at FROM certifications
           UNION ALL SELECT 'applications', id, company_name, updated_at FROM applications
         ) changed
         ORDER BY updated_at DESC, section, id DESC
         LIMIT $1`,
        [recentLimit],
      ),
    ]);
    res.json({
      today: date,
      windows: { deadlineDays: deadlineWindowDays, expiryDays: expiryWindowDays },
      counts: counts.rows[0],
      upcomingDeadlines: deadlines.rows,
      expiringCertifications: expiries.rows,
      recentlyChanged: recent.rows,
    });
  });
}
