# EvilTime

<p align="center"><img src="app/static/images/timetracker-logo.svg" alt="EvilTime clock logo" width="144"></p>

EvilTime is a self-hosted project time-tracking system. It keeps attendance and project tracking in one workflow: users clock directly into a project and clock out when they are finished.

## What is different in EvilTime?

- Every running timer belongs to a project. There is no separate general-attendance clock.
- Teams can create their own catch-all project for internal or general work; no project name is hardcoded.
- Each user can choose a default project in **My Settings → Work tracking**.
- Starting a timer without an explicit project uses that default when it is available and active.
- Timer heartbeat and idle handling preserve healthy project timers instead of stopping them after a short period of browser inactivity.
- Weekly time can be reviewed and corrected while keeping the underlying project entries visible.
- Weekly expected hours are schedule changes: set them once in the weekly overview and later weeks inherit them until the next change. Administrators can manage the same ledger for each user.
- Browser notifications can remind a user when a 30-minute break is over.
- Projects can use an emoji or uploaded PNG icon for one-click recent-project actions on the dashboard.
- The dashboard includes a fixed-day event timeline for clock-ins, project switches, breaks, and clock-outs. Events can be edited, dragged, or inserted retroactively.
- Every user can create a private MCP connection for timer control, projects, reporting, and retry-safe historical imports.
- Durations are displayed as hours and minutes (`7:30h`) instead of decimal hours (`7.50h`).
- The UI, metadata, manifests, and frontend package are branded as EvilTime.

EvilTime also retains the broader project, task, client, reporting, invoicing, API, authentication, and administration capabilities inherited from the upstream application.

## Run with Docker

The main Compose stack builds EvilTime locally and starts PostgreSQL, the application, and an nginx HTTPS proxy.

### Requirements

- Docker Engine 20.10 or newer
- Docker Compose v2
- Git
- About 2 GB of available memory

### Start the production-style stack

```bash
git clone git@git.domisbu.de:Domi2803/EvilTime.git
cd EvilTime
cp env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the generated value into `.env` as `SECRET_KEY`. Review at least `TZ`, `ADMIN_USERNAMES`, `AUTH_METHOD`, the PostgreSQL credentials, and the cookie/CSRF settings before exposing the service to a network.

Then build and start it:

```bash
docker compose up -d --build
docker compose ps
```

Open `https://localhost`. The bundled certificate is self-signed, so a browser warning is expected for a local installation. The application container runs database migrations during startup.

Follow startup logs with:

```bash
docker compose logs -f app
```

Stop the stack without deleting its database volumes:

```bash
docker compose down
```

### Quick local Docker test

For an isolated SQLite test instance on plain HTTP:

```bash
docker compose -f docker/docker-compose.local-test.yml up --build
```

Open `http://localhost:8080`. This mode is intended for development and evaluation, not production.

## Run directly for development

Native development uses Python 3.11 and Node.js 18 or newer. The commands below use SQLite, build the frontend assets, apply migrations, and start Flask on port 8080.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
npm run build:assets
mkdir -p instance logs
export FLASK_ENV=development
export FLASK_DEBUG=true
export SECRET_KEY=eviltime-local-development-secret-key
export DATABASE_URL="sqlite:///$PWD/instance/eviltime.db"
export AUTH_METHOD=local
export ADMIN_USERNAMES=admin
flask --app app.py db upgrade
python app.py
```

Open `http://localhost:8080`. For production, use PostgreSQL and a production WSGI deployment such as the included Docker stack.

When frontend source files change, rebuild them with:

```bash
npm run build:assets
```

## First-time setup

The first username in `ADMIN_USERNAMES` is the initial administrator. With local authentication, sign in as that user and set a password when prompted. Then:

1. Create the projects your team may clock into, including any desired internal/general project.
2. Assign project access and permissions to users.
3. Have each user select a default project under **My Settings → Work tracking**.
4. Review timezone, rounding, authentication, backups, and module visibility under **Admin → Settings**.

## Updating an installation

Back up the database and uploaded files first, then rebuild from the new revision:

```bash
git pull --ff-only
docker compose up -d --build
docker compose logs -f app
```

The startup process applies pending Alembic migrations. Persistent data is stored in Docker volumes; do not use `docker compose down -v` unless you intentionally want to delete it.

## EvilTime versions

EvilTime keeps the compatible upstream numeric version and adds an `-evil` suffix, starting at `5.11.4-evil`. The version lives in [`EVILTIME_VERSION`](EVILTIME_VERSION) and can be overridden for a build with the `EVILTIME_VERSION` environment variable. Upstream update reminders are intentionally disabled.

## Connect an MCP agent

Each user can open **My Settings → MCP integration** at the bottom of their settings, create a short-lived token, and copy the displayed Streamable HTTP configuration into their agent. The MCP server is scoped to that user and exposes their timer, available projects, completed entries, and retry-safe batch imports. Use the import tool with `dry_run: true` before writing historical data.

The endpoint is `/mcp`. Authentication uses the generated token as `Authorization: Bearer <token>`; the token is shown only once and should not be committed to source control.

## Tests and checks

```bash
source .venv/bin/activate
pytest
python scripts/check_silent_excepts.py
npm run build:assets
```

## Configuration and documentation

- [`env.example`](env.example) documents the principal environment variables.
- [`docs/`](docs/) contains the inherited administration, security, API, backup, and deployment guides.
- [`CHANGELOG.md`](CHANGELOG.md) contains the upstream release history and project changes.
- [`UNINSTALL.md`](UNINSTALL.md) explains how to remove an installation and its data.

Some inherited documents still use the original TimeTracker name where they describe unchanged upstream subsystems.

## Fork attribution

EvilTime is a fork of [DRYTRIX/TimeTracker](https://github.com/DRYTRIX/TimeTracker). We are grateful to the original maintainers and contributors for the application this work builds upon.

EvilTime-specific changes are maintained in [Domi2803/EvilTime](https://git.domisbu.de/Domi2803/EvilTime).

## License

This project remains available under the upstream license. See [`LICENSE`](LICENSE) for the full terms and copyright notices.
