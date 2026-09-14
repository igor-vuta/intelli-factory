# Oracle deployment

Branch: `main`. The active site uses Oracle for all three tiers.
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

Install Docker Engine, the Compose v2 plugin and Caddy on the VM. Use a checkout of the
reviewed, committed `main` branch. No push workflow deploys this branch:
releases are deliberate, using the script below.

Feature branches are reviewed through pull requests into `main`. The Oracle
workflow runs the quality checks and both architecture smoke tests, then publishes
the tested AMD64 image artifact. Deploy that exact commit manually only after the
whole workflow succeeds. A staging branch is not used for this live environment.

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

After the branch is committed and pushed, the `Oracle stack test` workflow builds
and tests images. Download the successful run's `oracle-amd64-COMMIT_SHA` artifact,
extract `oracle-images.tar.gz`, and transfer it to the VM. Match the VM checkout
to that exact commit. No image registry publishing or CI SSH credentials are used.

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
