-- Share links for the read-only portfolio page (issue #236, decision in docs/decisions/0001-portfolio-sharing-access.md).
-- Only the SHA-256 hash of the random token is stored; the token itself is shown once, when the link is created.
-- items holds the chosen ids per kind, for example {"projects": [1, 2], "careers": [3]}. A link stops working when
-- revoked_at is set; it has no expiry. The table holds credentials, so the JSON export skips it.
CREATE TABLE IF NOT EXISTS share_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
