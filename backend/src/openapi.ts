// OpenAPI 3.1 document built from the registered Express routes and the server's own Zod schemas.
// `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date.
import type express from 'express';
import type { Pool } from 'pg';
import type { z } from 'zod/v4';

import { createApp } from './app.js';
import { applicationInput } from './routes/applications.js';
import { careerInput } from './routes/careers.js';
import { certificationInput } from './routes/certifications.js';
import { questionsInput } from './routes/cover-letter-questions.js';
import { educationInput } from './routes/educations.js';
import { projectInput } from './routes/projects.js';
import { skillInput } from './routes/skills.js';

type Json = Record<string, unknown>;

type CheckDef = {
  check: string;
  format?: string;
  pattern?: RegExp;
  minimum?: number;
  maximum?: number;
  length?: number;
  value?: number;
  inclusive?: boolean;
};
const checksOf = (def: Json) =>
  ((def.checks ?? []) as { _zod: { def: CheckDef } }[]).map((check) => check._zod.def);

const STRING_FORMATS: Record<string, string> = {
  uuid: 'uuid',
  guid: 'uuid',
  email: 'email',
  url: 'uri',
  datetime: 'date-time',
  date: 'date',
  time: 'time',
};
function stringFormat(format: string) {
  const name = STRING_FORMATS[format];
  if (!name) throw new Error(`Unsupported string format: ${format}`);
  return name;
}
// z.number().int() is a check and z.int() is the type itself; float32 and float64 are the same kinds but not integers.
const isIntegerFormat = (format: unknown) => typeof format === 'string' && format.includes('int');

// Converts the Zod 4 types the API uses. Refinements (cross-field rules) cannot be expressed
// here; any other unsupported type fails loudly instead of being silently dropped.
export function jsonSchema(schema: z.ZodType): Json {
  const def = schema._zod.def as unknown as Json & { type: string };
  switch (def.type) {
    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>;
      const required = Object.keys(shape).filter((key) => !shape[key].isOptional());
      const catchall = def.catchall as z.ZodType | undefined;
      return {
        type: 'object',
        properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchema(v)])),
        ...(required.length ? { required } : {}),
        ...(catchall?._zod.def.type === 'never' ? { additionalProperties: false } : {}),
      };
    }
    case 'string': {
      const out: Json = { type: 'string' };
      // z.uuid() and z.email() carry their format on the type, z.string().uuid() as a check.
      if (def.format) out.format = stringFormat(def.format as string);
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') out.minLength = check.minimum;
        else if (check.check === 'max_length') out.maxLength = check.maximum;
        else if (check.check === 'length_equals') out.minLength = out.maxLength = check.length;
        else if (check.check === 'string_format' && check.format === 'regex')
          out.pattern = check.pattern!.source;
        else if (check.check === 'string_format') out.format = stringFormat(check.format!);
        // `overwrite` is trim(); `custom` is a refinement.
        else if (check.check !== 'overwrite' && check.check !== 'custom')
          throw new Error(`Unsupported string check: ${check.format ?? check.check}`);
      }
      return out;
    }
    case 'number': {
      const out: Json = { type: isIntegerFormat(def.format) ? 'integer' : 'number' };
      for (const check of checksOf(def)) {
        if (check.check === 'number_format') {
          if (isIntegerFormat(check.format)) out.type = 'integer';
        } else if (check.check === 'greater_than')
          out[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
        else if (check.check === 'less_than')
          out[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
        else if (check.check === 'multiple_of') out.multipleOf = check.value;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported number check: ${check.check}`);
      }
      return out;
    }
    case 'boolean':
      return { type: 'boolean' };
    case 'array': {
      let min: number | undefined;
      let max: number | undefined;
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') min = check.minimum;
        else if (check.check === 'max_length') max = check.maximum;
        else if (check.check === 'length_equals') min = max = check.length;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported array check: ${check.check}`);
      }
      return {
        type: 'array',
        items: jsonSchema(def.element as z.ZodType),
        ...(min !== undefined ? { minItems: min } : {}),
        ...(max !== undefined ? { maxItems: max } : {}),
      };
    }
    case 'enum':
      return { type: 'string', enum: Object.values(def.entries as Record<string, string>) };
    case 'nullable': {
      const inner = jsonSchema(def.innerType as z.ZodType);
      return typeof inner.type === 'string'
        ? { ...inner, type: [inner.type, 'null'] }
        : { anyOf: [inner, { type: 'null' }] };
    }
    case 'optional':
      return jsonSchema(def.innerType as z.ZodType);
    case 'default':
      return { ...jsonSchema(def.innerType as z.ZodType), default: def.defaultValue };
    // .transform() is a pipe; the request is described by what comes in. z.preprocess() is a pipe
    // starting from a transform, which says nothing about the value, so its target describes it.
    case 'pipe': {
      const input = def.in as z.ZodType;
      return jsonSchema(input._zod.def.type === 'transform' ? (def.out as z.ZodType) : input);
    }
    case 'unknown':
      return {};
    default:
      throw new Error(`Unsupported Zod type for OpenAPI: ${def.type}`);
  }
}

type Operation = {
  summary: string;
  body?: [name: string, schema: z.ZodType];
  // Success status first; the rest are documented error statuses.
  status: number[];
};

// Every registered route must appear here exactly once (checked when building).
// Every route that reads an id or a body also answers 400 when validation fails.
const operations: Record<string, Operation> = {
  'GET /api/health': { summary: 'Check the server and database connection', status: [200, 500] },
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },

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
    status: [201, 400],
  },
  'PUT /api/skills/:id': {
    summary: 'Replace a skill',
    body: ['Skill', skillInput],
    status: [200, 400, 404],
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
};

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

// The app as the server builds it, with no database: routes are only registered, never called, so
// the pool is never used. All routes are registered directly on the app, so the router stack lists them.
export function documentedApp() {
  return createApp({} as Pool);
}

export function registeredRoutes(app: express.Express) {
  const stack = (app as unknown as { router: { stack: Layer[] } }).router.stack;
  return stack.flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${layer.route!.path}`)
      : [],
  );
}

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

// Path ids are plain positive integers (up to 15 digits).
const idParam = { type: 'integer', minimum: 1, maximum: 999_999_999_999_999 };

export function buildOpenApi(app: express.Express) {
  const routes = registeredRoutes(app);
  const missing = routes.filter((route) => !operations[route]);
  const extra = Object.keys(operations).filter((route) => !routes.includes(route));
  if (missing.length || extra.length)
    throw new Error(`OpenAPI operations differ from routes: +${missing} -${extra}`);
  const schemas: Json = {
    Error: {
      type: 'object',
      properties: { error: { type: 'string', description: 'English error message' } },
      required: ['error'],
    },
  };
  const paths: Record<string, Json> = {};
  for (const route of [...routes].sort()) {
    const [method, path] = route.split(' ');
    const op = operations[route];
    const parameters: Json[] = [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: idParam,
    }));
    if (op.body) schemas[op.body[0]] = jsonSchema(op.body[1]);
    const [success, ...failures] = op.status;
    const responses: Json = { [success]: { description: statusText[success] } };
    for (const status of failures)
      responses[status] = {
        description: statusText[status],
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      };
    const key = path.replace(/:(\w+)/g, '{$1}');
    paths[key] ??= {};
    paths[key][method.toLowerCase()] = {
      summary: op.summary,
      ...(parameters.length ? { parameters } : {}),
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: `#/components/schemas/${op.body[0]}` } },
              },
            },
          }
        : {}),
      responses,
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Dev Career Portfolio API',
      version: '1.0.0',
      description: 'Dates are YYYY-MM-DD. Every error response is { error: English message }.',
    },
    servers: [{ url: '/' }],
    paths,
    components: { schemas },
  };
}
