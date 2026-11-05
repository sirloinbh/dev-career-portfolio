// Links stored by the API (projects #33, applications #36), shown on the list screens.

/**
 * The link if it is a web address. The server only stores http(s) links; this keeps any other
 * scheme, such as javascript:, out of an href all the same.
 */
export function webLink(url: string | null) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
