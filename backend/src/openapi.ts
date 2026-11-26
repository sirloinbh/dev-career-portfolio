// The API's operation table. The document is built by the managed standard/openapi.ts from Zod schemas
// (z.toJSONSchema). `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date or
// when the table and the registered routes differ.
import { applicationInput } from './routes/applications.js';
import { careerInput } from './routes/careers.js';
import { certificationInput } from './routes/certifications.js';
import { questionsInput } from './routes/cover-letter-questions.js';
import { educationInput } from './routes/educations.js';
import { interviewInput } from './routes/interviews.js';
import { projectInput } from './routes/projects.js';
import { skillInput } from './routes/skills.js';
import { buildOpenApi, type Operation } from './standard/openapi.js';

// Every registered route must appear here exactly once (checked when building).
// Every route that reads an id or a body also answers 400 when validation fails.
export const operations: Record<string, Operation> = {
  'GET /api/health': {
    summary: 'Check the server and database connection',
    status: [200, 503],
    public: true,
  },
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },
  'GET /api/dashboard': {
    summary:
      'Summarize item counts, upcoming deadlines, expiring certifications and recent changes',
    status: [200],
  },

  'GET /api/educations': { summary: 'List educations, newest start first', status: [200] },
  'POST /api/educations': {
    summary: 'Add an education',
    body: ['Education', educationInput],
    status: [201, 400],
  },
  'PUT /api/educations/:id': {
    summary: 'Replace an education',
    body: ['Education', educationInput],
    status: [200, 400, 404],
  },
  'DELETE /api/educations/:id': { summary: 'Delete an education', status: [204, 400, 404] },

  'GET /api/careers': { summary: 'List careers, newest start first', status: [200] },
  'POST /api/careers': {
    summary: 'Add a career',
    body: ['Career', careerInput],
    status: [201, 400],
  },
  'PUT /api/careers/:id': {
    summary: 'Replace a career',
    body: ['Career', careerInput],
    status: [200, 400, 404],
  },
  'DELETE /api/careers/:id': { summary: 'Delete a career', status: [204, 400, 404] },

  'GET /api/projects': { summary: 'List projects, newest start first', status: [200] },
  'POST /api/projects': {
    summary: 'Add a project',
    body: ['Project', projectInput],
    status: [201, 400],
  },
  'PUT /api/projects/:id': {
    summary: 'Replace a project',
    body: ['Project', projectInput],
    status: [200, 400, 404],
  },
  'DELETE /api/projects/:id': { summary: 'Delete a project', status: [204, 400, 404] },

  'GET /api/skills': { summary: 'List skills by category, strongest first', status: [200] },
  'POST /api/skills': {
    summary: 'Add a skill',
    body: ['Skill', skillInput],
    status: [201, 400, 409],
  },
  'PUT /api/skills/:id': {
    summary: 'Replace a skill',
    body: ['Skill', skillInput],
    status: [200, 400, 404, 409],
  },
  'DELETE /api/skills/:id': { summary: 'Delete a skill', status: [204, 400, 404] },

  'GET /api/certifications': { summary: 'List certifications, newest first', status: [200] },
  'POST /api/certifications': {
    summary: 'Add a certification',
    body: ['Certification', certificationInput],
    status: [201, 400],
  },
  'PUT /api/certifications/:id': {
    summary: 'Replace a certification',
    body: ['Certification', certificationInput],
    status: [200, 400, 404],
  },
  'DELETE /api/certifications/:id': { summary: 'Delete a certification', status: [204, 400, 404] },

  'GET /api/applications': {
    summary: 'List job applications by status and deadline',
    status: [200],
  },
  'POST /api/applications': {
    summary: 'Add a job application',
    body: ['Application', applicationInput],
    status: [201, 400],
  },
  'PUT /api/applications/:id': {
    summary: 'Replace a job application',
    body: ['Application', applicationInput],
    status: [200, 400, 404],
  },
  'DELETE /api/applications/:id': { summary: 'Delete a job application', status: [204, 400, 404] },

  'GET /api/applications/:id/status-history': {
    summary: 'List the hiring stage changes of an application, oldest first, each with its day',
    status: [200, 400, 404],
  },
  'GET /api/cover-letter-answers': {
    summary:
      'Search earlier cover letter questions and answers by text (q), leaving out one application (exclude)',
    status: [200, 400],
  },
  'GET /api/applications/:id/questions': {
    summary: 'List the cover letter questions of an application',
    status: [200, 400, 404],
  },
  'PUT /api/applications/:id/questions': {
    summary:
      'Replace the whole question list of an application; questions left out are deleted, entries with an id are updated',
    body: ['CoverLetterQuestions', questionsInput],
    status: [200, 400, 404, 409],
  },
  'DELETE /api/applications/:id/questions/:questionId': {
    summary: 'Delete one cover letter question',
    status: [204, 400, 404],
  },

  'GET /api/applications/:id/interviews': {
    summary: 'List the interviews of an application, in the order they happen',
    status: [200, 400, 404],
  },
  'POST /api/applications/:id/interviews': {
    summary: 'Add an interview (day and time in Asia/Seoul) to an application',
    body: ['Interview', interviewInput],
    status: [201, 400, 404],
  },
  'PUT /api/applications/:id/interviews/:interviewId': {
    summary: 'Replace an interview of an application',
    body: ['Interview', interviewInput],
    status: [200, 400, 404],
  },
  'DELETE /api/applications/:id/interviews/:interviewId': {
    summary: 'Delete one interview of an application',
    status: [204, 400, 404],
  },
};

const statusText: Record<number, string> = {
  200: 'Success',
  201: 'Created',
  204: 'Success, no content',
  400: 'Input validation failed or the ID is invalid',
  401: 'Sign-in required (no session from the shared sign-in)',
  404: 'No target',
  409: 'Duplicate or conflict',
  500: 'Server error',
  503: 'The shared sign-in service is unavailable or not configured',
};

export const document = buildOpenApi({
  title: 'Dev Career Portfolio API',
  description:
    'Dates are YYYY-MM-DD. Every error response is { error: English message }; a validation 400 also lists the invalid fields as fields: [{ path, message }].',
  errorDescription: 'English error message',
  // app.ts registers createErrorHandler({ fields: true }), so a validation 400 also lists the invalid fields (#200, #214).
  errorFields: true,
  operations,
  statusText,
});
