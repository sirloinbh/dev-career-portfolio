# Decide how the portfolio page is shared (#235)

Adds `docs/decisions/0001-portfolio-sharing-access.md`: options (token link, static export, whole app behind a login), the risks, the user's choice (whole app behind a login, shared page as a public route, 2026-11-27), and the proposed link mechanism for #236.

Finding: the login part is already on main (shared sign-in, #106), so no new login card is needed.

No code changed. Checked: `npm run check`.
