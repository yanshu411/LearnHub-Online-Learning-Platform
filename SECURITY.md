# LearnHub — Security and privacy

LearnHub is an **educational course management project** and has not undergone a production security audit.

## Current safeguards

- Passwords are hashed using Werkzeug's password-hashing helpers.
- Flask-Login manages authenticated session cookies.
- Mutation requests to `/api/` require the session's CSRF token in the `X-CSRF-Token` header.
- Backend role and ownership checks protect instructor-only course management and enrolled lesson access.
- Cookies use `HttpOnly` and `SameSite=Lax`; set `HTTPS_ONLY=1` in a real HTTPS deployment.
- SQLite is stored under `server/data/`, which is excluded from Git commits.

## Before public deployment

1. Set a strong, random `SECRET_KEY` in the backend environment (do not commit it).
2. Use HTTPS and set `HTTPS_ONLY=1`.
3. Move production data into a reliably hosted, backed-up database such as PostgreSQL.
4. Add email verification, account recovery, login rate limiting and monitoring.
5. Add moderation and abuse protection; the demo currently allows users to self-register as instructors.
6. Add schema migrations and automated backups before accepting real students.
7. Run tests and audit dependencies regularly.
8. Keep production accounts and personal data out of demo screenshots and GitHub commits.

## Never commit

- `server/.env`, `SECRET_KEY`, database credentials, tokens, or service-account keys
- `server/data/learnhub.db` or `server/data/.flask_secret`
- private student records, uploaded user files, or other personal data

## Testing

The repository includes `server/test_smoke.py` and a GitHub Actions workflow. These are **basic smoke checks**, not a penetration test or proof of production readiness.
