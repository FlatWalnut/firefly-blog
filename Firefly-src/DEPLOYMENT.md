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

## Admin publishing

The admin page can now connect to GitHub and publish the browser backup through
Cloudflare Pages Functions. The Function converts the backup into Markdown
posts, `public/admin-settings.json`, and uploaded media, then creates one Git
commit on the configured branch. The existing GitHub Actions workflow performs
the build and Cloudflare Pages deployment after that commit.

Create a GitHub OAuth App with this callback URL:

```text
https://YOUR_SITE_DOMAIN/api/auth/github/callback
```

Set these encrypted secrets on the Cloudflare Pages project under **Settings →
Variables and Secrets**:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET` (a random value of at least 32 characters)

The non-secret repository settings are in `wrangler.jsonc`. For a private
repository, change `GITHUB_OAUTH_SCOPE` to `repo` in the Pages environment.
The OAuth token remains in an encrypted, HttpOnly session cookie and is never
returned to browser JavaScript. The repository owner is restricted by
`GITHUB_ALLOWED_LOGIN`.

Never commit either secret or a local Wrangler authentication file.
