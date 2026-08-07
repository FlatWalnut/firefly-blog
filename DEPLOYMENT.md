# Deployment

The site is deployed to the existing Cloudflare Pages project
`firefly-personal-blog` by GitHub Actions.

## GitHub setup

Add these repository secrets under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Pages write access
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID that owns the Pages project

Pushes to `main` run `.github/workflows/deploy.yml`. The workflow installs the
locked dependencies, runs `pnpm run build`, and uploads `dist` to Cloudflare
Pages. It can also be started manually from the Actions tab.

Never commit either secret or a local Wrangler authentication file.
