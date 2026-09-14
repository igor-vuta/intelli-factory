# Oracle deployment

Release branch: `production`. Development branch: `main`. The active site uses Oracle for all three tiers.
The former Vercel Git integration is disconnected; pushes to this branch run
the Oracle workflow, which calls the quality checks once before testing the stack.

```text
Browser → Caddy on the dedicated Oracle VM (HTTPS)
                     → 127.0.0.1:4200 → Next.js → FastAPI → PostgreSQL 15
```

These are three application tiers in separate containers on one Oracle Compute
VM, not three machines. The frontend uses its same-origin `/api` proxy to reach
FastAPI. Only FastAPI joins the private database network (the migration job also
joins it). PostgreSQL has a dedicated persistent volume and no host port.

## Dedicated E2 Micro instance

Target: a separate `VM.Standard.E2.1.Micro` instance running Ubuntu 24.04 Minimal
(x86_64), in the tenancy's home region. This shape has 1 GB RAM and a fractional
CPU allocation. It is a constrained testing/demo target, not a validated production
capacity estimate. The other project's VM and reverse proxy are independent.

Use the default boot volume only after checking the tenancy's remaining Always
Free storage allowance. Point `APP_DOMAIN` at the new VM's public IP. Install
host Caddy as the sole listener on 80/443 and use `Caddyfile.example` as its site
configuration. Permit 80/443 in OCI and the OS firewall; restrict SSH to your
administration source. Do not expose 3000, 4200, 8000 or 5432 publicly.

`micro.yml` limits container memory, PostgreSQL connections and Node's heap.
Configure 2 GB swap on the VM before starting containers; swap is a fallback and
can make optimization requests slower. Verify actual memory use and latency with
`docker stats` and a representative workflow before calling the instance ready.
Build images in CI, never on this 1 GB VM.

`COMPOSE_PROJECT_NAME=intelli-factory-testing` scopes the containers, networks and
database volume. Keep this value for the CI image artifact and deploy script.

## Configure and deploy

Install Docker Engine, the Compose v2 plugin and Caddy on the VM. The deployment
checkout tracks `production`; `main` remains the integration branch.

## Automatic releases

1. Merge feature work into `main`.
2. Open a pull request from `main` into `production`.
3. Wait for **Release ready**. It requires all code checks and both architecture
   stack tests. Only `main` in this repository may be the source of a release PR.
4. Merge the PR. **Production deployment** tests that exact merge commit, then
   transfers its tested AMD64 images and deploys them over SSH.

The `production` protection requires PRs, up-to-date passing checks and resolved
conversations, including for administrators. Direct pushes, force pushes and
branch deletion are blocked. A second reviewer is not required for this sole-owner
repository. A production push never skips testing, even after the PR checks passed.
Manual workflow dispatch can retry the current `production` commit.

The **Production** GitHub environment accepts only the `production` branch and has
no additional approval prompt. Configure these environment values before the first
release:

| Type     | Name                     | Value                                           |
| -------- | ------------------------ | ----------------------------------------------- |
| Variable | `ORACLE_HOST`            | VM SSH hostname or public IP                    |
| Variable | `ORACLE_USER`            | Deployment login, normally `ubuntu`             |
| Variable | `ORACLE_PATH`            | Absolute clean checkout path on the VM          |
| Secret   | `ORACLE_SSH_PRIVATE_KEY` | Dedicated deployment SSH private key            |
| Secret   | `ORACLE_SSH_KNOWN_HOSTS` | Verified SSH host-key entries for `ORACLE_HOST` |

Authorize the matching public key on the deployment account. Use a dedicated key,
not a Git signing key. Keep host-key checking enabled; obtain known-host entries
from an already trusted connection. The account needs passwordless `sudo docker`
and read access to this public repository. The application `.env` stays on the VM;
CI does not need the database or mail passwords. Allow the chosen runner to reach
SSH using the VM's network policy; do not silently broaden an existing firewall rule.

Deployment is serialized in GitHub and with a VM lock. Before changing the checkout,
the script verifies the archive checksum and refuses stale commits or local edits.
It loads the tested images, creates and validates a database backup, applies
migrations, and waits for both application containers to become healthy. Public
HTTPS and API requests must also pass for the workflow to succeed. A failed check
marks the release failed; database restoration is never automatic.

## Initial VM configuration

```sh
cp deploy/oracle/.env.example deploy/oracle/.env
chmod 600 deploy/oracle/.env
openssl rand -hex 32
```

Put the generated URL-safe password in `POSTGRES_PASSWORD`; set `APP_DOMAIN` to
the hostname only, without scheme or path. This deployment uses Gmail SMTP with
STARTTLS on port 587. Set `SMTP_USERNAME` and `SMTP_FROM_EMAIL` to the same Gmail
address, and `SMTP_PASSWORD` to a Google app password, without spaces. Enable
2-Step Verification on that Google account before creating the app password;
some account types or security policies do not allow app passwords. Never use the
normal Google account password. Keep `.env` out of Git.

A personal Gmail account has sending limits and is suitable for low-volume testing.
Google can temporarily block sending when limits are reached. No paid Google
Workspace subscription is needed for this setup. See Google's
[app password instructions](https://support.google.com/accounts/answer/185833) and
[Gmail sending limits](https://support.google.com/mail/answer/22839).
The database password initializes a new volume; changing the variable alone does
not rotate an existing PostgreSQL role's password.

For a manual retry, use the successful **Production deployment** run's
`oracle-amd64-COMMIT_SHA` artifact and the exact `production` commit. The normal
workflow performs these steps automatically:

```sh
gunzip -c oracle-images.tar.gz | sudo docker load
ORACLE_DOCKER_SUDO=true bash deploy/oracle/deploy.sh
```

`ORACLE_DOCKER_SUDO=true` uses explicit sudo for Docker commands without granting
the login account Docker group membership. Git and backups run as the login user.
Use `sudo docker` for the manual inspection commands below on this host.

The script checks the branch and clean working tree, checks the prebuilt images, waits
for PostgreSQL, takes a database backup, applies migrations, then starts the API
and frontend in order. API readiness executes a database query. Images are tagged
with the commit ID. Prisma is generated inside the Linux image to select the VM's
native engine, including ARM64 in the additional CI job; E2 uses the AMD64 artifact. The image build and runtime still need verification
on the actual Oracle host.

After the stack is healthy, configure the domain in Caddy, validate its
configuration, and reload it. With host Caddy the commands are typically
`sudo caddy validate --config /etc/caddy/Caddyfile` and `sudo systemctl reload caddy`.
Verify the HTTPS hostname after the reload.

## Data and verification

The reference snapshot contains 249 countries and territories and 5,046 ISO-coded
administrative subdivisions. To load or refresh it explicitly:

```sh
docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml -f deploy/oracle/micro.yml exec backend python seed_reference_geo.py
```

The import is transactional and repeatable, preserving existing IDs, addresses,
custom regions and inactive flags. Country names cover English, Russian and Kazakh.
Subdivision translations use the requested language where available, then English.
Sources, coverage and refresh instructions are in
`backend/app/api/data/geography/README.md`.

Demo users and workflow scenarios are optional: review `seed.py` before running
it. Existing Aiven records are not transferred automatically. If those records
must be preserved, plan a separate dump/restore and migration rehearsal before
cutover; never seed over a restored database without reviewing the seed behavior.

Verify the landing page, countries on registration, email delivery and verification,
login/logout cookies, and a role workflow through the HTTPS hostname. Check that
`/api/auth/me` reaches the backend (an unauthenticated response is expected
without a session). Inspect service logs if readiness fails:

```sh
docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml -f deploy/oracle/micro.yml ps
docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml -f deploy/oracle/micro.yml logs --tail 100 backend frontend migrate
```

## Rollback and backups

Before each release, note the previous image tags from `docker compose images`.
Keep those images and copy backups from `deploy/oracle/backups/` to storage outside
the VM. The deploy script creates pre-release backups; it does not schedule daily
backups or manage retention.

For a code-only rollback compatible with the current database schema:

```sh
IMAGE_TAG=PREVIOUS_COMMIT docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml -f deploy/oracle/micro.yml up -d --no-deps --wait backend frontend
```

Do not run migrations backwards or restore over the live database blindly. A
schema-incompatible rollback requires stopping application writes and rehearsing
a restore of the matching backup into a separate database first. Never run
`docker compose down -v` against a database you intend to keep.

## Dependency updates

The backend image installs hash-locked dependencies from `requirements.txt`,
exported from the existing Poetry lock. After changing that lock, regenerate it:

```sh
cd backend/app/api
uv tool run --with poetry-plugin-export --from poetry==2.3.2 poetry export --only main --format requirements.txt --output requirements.txt
```

The frontend uses the root npm workspace lock. Standalone output follows the
[Next.js deployment documentation](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output);
service ordering uses [Compose health dependencies](https://docs.docker.com/compose/how-tos/startup-order/).

Shape and allowance details: [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## Failed release recovery

Keep the previous image tags and the pre-release database backup. Do not delete or
restore the database volume as an automatic reaction to a failed health check.
Inspect the failed job and container logs first. For an application rollback,
confirm that the previous code is compatible with any applied migrations, then
start the previous backend and frontend image tags using the compose command in
this document. A database restore requires an explicit recovery decision because
it can discard writes after the backup. Follow with a revert PR through `main` and
`production` so the branch history records the recovered release.

Validate release guards locally with:

```sh
bash -n deploy/oracle/deploy.sh deploy/oracle/release.sh
shellcheck deploy/oracle/deploy.sh deploy/oracle/release.sh
python3 -m unittest discover -s deploy/oracle/tests -v
```
