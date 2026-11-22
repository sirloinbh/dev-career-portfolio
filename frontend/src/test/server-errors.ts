// The body of a validation 400 as the API sends it: the one sentence in `error` and each invalid field by its path in
// `fields` (backend/src/standard/http.ts). `issues` are [path, message] pairs.
export type ErrorBody = { error: string; fields?: { path: string; message: string }[] };

export const validation = (...issues: [path: string, message: string][]): ErrorBody => ({
  error: issues.map(([, message]) => message).join(', '),
  fields: issues.map(([path, message]) => ({ path, message })),
});
