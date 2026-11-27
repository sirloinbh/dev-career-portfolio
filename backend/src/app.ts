import { meHandler } from '@sirloinbh/auth-client';
import express from 'express';
import type { Pool } from 'pg';
import { types } from 'pg';

import { tools } from './ai-tools.js';
import { registerApplicationProjectRoutes } from './routes/application-projects.js';
import { registerApplicationRoutes } from './routes/applications.js';
import { registerCareerRoutes } from './routes/careers.js';
import { registerCertificationRoutes } from './routes/certifications.js';
import { registerCoverLetterQuestionRoutes } from './routes/cover-letter-questions.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { importPath, registerDataTransferRoutes } from './routes/data.js';
import { registerEducationRoutes } from './routes/educations.js';
import { registerInterviewRoutes } from './routes/interviews.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerSkillRoutes } from './routes/skills.js';
import { setInt8Parser } from './standard/db.js';
import { createErrorHandler, notFound, requestLog, serviceDate } from './standard/http.js';
import { apiRateLimit } from './standard/rate-limit.js';
import { registerToolRoutes } from './standard/tools.js';

// DATE columns stay YYYY-MM-DD strings so the service time zone never shifts them.
types.setTypeParser(1082, (value) => value);
// BIGINT ids come back as numbers, and a value above 2^53 throws instead of rounding (ADR-0025).
setInt8Parser(types);

export function createApp(
  pool: Pool,
  options: {
    today?: () => string;
    requestsPerMinute?: number;
    auth?: express.RequestHandler;
    toolsPublicKey?: string;
  } = {},
) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // project-standards#552: a request ID and one JSON log line for every request, a refused one included.
  app.use(requestLog);
  // Before the body parser and every route, so a refused request costs neither parsing nor a query.
  apiRateLimit(app, { limitPerMinute: options.requestsPerMinute });
  const smallJson = express.json({ limit: '256kb' });
  // The data import accepts a whole export, so it has its own larger limit (#222).
  app.use((req, res, next) => (req.path === importPath ? next() : smallJson(req, res, next)));
  // #106: the shared sign-in guards every /api route except /api/health, before any route registers.
  if (options.auth) app.use('/api', options.auth);
  app.get('/api/me', meHandler);
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
    } catch {
      // #138: a database outage is a 503 the probe can read, not the generic 500.
      res.status(503).json({ ok: false });
      return;
    }
    res.json({ ok: true, service: 'dev-career-portfolio', today: today() });
  });
  registerEducationRoutes(app, pool);
  registerCareerRoutes(app, pool);
  registerProjectRoutes(app, pool);
  registerSkillRoutes(app, pool);
  registerCertificationRoutes(app, pool);
  registerApplicationRoutes(app, pool, today);
  registerCoverLetterQuestionRoutes(app, pool);
  registerInterviewRoutes(app, pool);
  registerApplicationProjectRoutes(app, pool);
  registerDashboardRoutes(app, pool, today);
  registerDataTransferRoutes(app, pool);
  // #711: shared-ai calls the AI tools here with a signed token. Outside /api, so the proxy never reaches it.
  registerToolRoutes(app, {
    app: 'dev-career-portfolio',
    tools,
    pool,
    publicKey: options.toolsPublicKey,
    requireBinding: true,
  });
  app.use('/api', notFound);
  app.use(createErrorHandler({ fields: true }));
  return app;
}
