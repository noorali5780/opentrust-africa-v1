# Deployment

## CI

GitHub Actions runs on pushes to `main` and on pull requests:

- `npm ci`
- `npm run prisma:generate`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- Docker image build

The workflow lives at `.github/workflows/ci.yml`.

## Docker

Build the application image:

```powershell
docker build -t opentrust-africa:local .
```

Run the image with environment variables:

```powershell
docker run --rm -p 3000:3000 `
  --env-file .env `
  opentrust-africa:local
```

When running in Docker Compose with the included Postgres service, use a container-reachable database URL:

```text
DATABASE_URL=postgresql://opentrust:opentrust@postgres:5432/opentrust_africa?schema=public
```

Run migrations before serving real traffic:

```powershell
npm.cmd run prisma:migrate
```

For production, execute migrations in the release pipeline against the managed database, then start the container with production secrets from the platform secret store.

## Required Runtime Settings

Set these in production:

- `DATABASE_URL`
- `APP_URL`
- `ENFORCE_API_AUTH=true`
- `OPEN_TRUST_API_KEY`
- `ISSUER_KEY_ID`
- `ISSUER_ED25519_PUBLIC_KEY`
- `ISSUER_ED25519_PRIVATE_KEY`
- `DATA_ENCRYPTION_KEY_ID`
- `DATA_ENCRYPTION_KEY`

Do not commit real `.env` files or generated keys.
