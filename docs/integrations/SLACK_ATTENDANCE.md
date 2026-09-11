# Slack Attendance Integration

Workspace-level Slack slash commands for project time tracking. The commands operate on the same project
timer as the EvilTime web app, so Slack and the website always show the same state.

## Commands

| Command | Action |
|---------|--------|
| `/in [project]` | Clock in (default project when no name is given) |
| `/switch project` | Switch the running timer to another project |
| `/brb` | Start a break |
| `/back` | End break (return to work) |
| `/out` | Clock out |

Successful commands post an **in-channel** confirmation so the attendance channel acts as a shared log. Errors are
shown only to the user who ran the command (ephemeral).

Changes made anywhere else — dashboard, kiosk, REST API, MCP, and the automatic clock-out — are announced in the
attendance channel by the bot, so the channel stays complete no matter where people clock in.

## Slack App Setup

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app for your workspace.
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `commands` — receive slash commands
   - `chat:write` — post announcements, overtime reminders (DM) and test messages
   - `users:read` — look up Slack users
   - `users:read.email` — match Slack profile email to EvilTime accounts
   - `channels:join` *(optional)* — lets the bot join a public attendance channel by itself
3. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-…`).
   After adding scopes, click **Reinstall to Workspace**; the token only gains new scopes after reinstalling.

### 2. Signing secret

Under **Basic Information**, copy the **Signing Secret**.

### 3. Slash commands

Under **Slash Commands**, create five commands. All use the same **Request URL**:

```
https://your-eviltime-host/api/integrations/slack/attendance
```

| Command | Short description |
|---------|-------------------|
| `/in` | Clock in |
| `/switch` | Switch project |
| `/brb` | Start break |
| `/back` | End break |
| `/out` | Clock out |

### 4. Interactivity (overtime reminder buttons)

Under **Interactivity & Shortcuts**, turn Interactivity on and set the **Request URL** to:

```
https://your-eviltime-host/api/integrations/slack/interactions
```

Under **App Home**, enable the **Messages Tab** so employees receive the bot's direct messages.

### 5. EvilTime configuration

1. Log in as an administrator **using the public URL Slack reaches** (it is stored for links in bot messages).
2. Go to **Integrations** → **Workspace integrations** → **EvilTime Slack**.
3. Enter the bot token, signing secret, and the **Attendance channel ID** (e.g. `C1234567890`).
4. Save and send a test message. If it fails, the card shows Slack's error and what to do about it.

Invite the bot to the attendance channel (`/invite @YourBot`). Private channels always require the invite.

## Automatic clock-out

Every employee has a **standard hours per day** (Settings → Overtime). When the hours worked that day reach it:

1. The employee gets a reminder on the dashboard, as a browser notification, and as a Slack DM with
   **+0:15 h / +0:30 h / +1:00 h / Clock out now** buttons. They have **15 minutes** to react.
2. **Clock out now** records the time the button is pressed.
3. **Extending** adds the time to the moment of the reminder: reminder at 17:00, +0:15 h → work time runs until 17:15,
   regardless of when within the 15 minutes the button is pressed. A new reminder follows at 17:15.
4. **No reaction**: the timer is stopped after 15 minutes and the work time is recorded until the reminder (17:00),
   e.g. when someone left without clocking out. The channel and the employee are notified.

Breaks do not count as worked time. Employees can turn the automatic clock-out off in Settings → Overtime.

## Break reminder

After **30 minutes** of break, Slack-linked employees get a DM "Are you well rested? Feel free to get back to work any
time." with an **End break** button, in addition to the browser notification on the dashboard. It is on by default;
each employee can turn it off in **Settings → Profile** below the Slack user ID.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/integrations/slack/attendance` | HMAC-SHA256 signature | Slash command handler. |
| POST | `/api/integrations/slack/interactions` | HMAC-SHA256 signature | Button clicks from the overtime reminder. |
| POST | `/api/integrations/slack-attendance/config` | Admin | Save bot token, signing secret, channel ID. |
| POST | `/api/integrations/slack-attendance/test` | Admin | Post a test message to the attendance channel. |
| GET | `/api/integrations/slack-attendance/status` | Admin | Connection state, last delivery error (no secrets). |
| POST | `/timer/extend-workday` | Logged in | Extend today's working time from the dashboard. |

Both Slack endpoints are `csrf.exempt` and reject requests older than **5 minutes** or with an invalid
`X-Slack-Signature`. Slack requires an answer within 3 seconds: EvilTime acknowledges immediately and delivers the
result through Slack's `response_url`, so a slow moment on the server no longer shows up as `operation_timeout`.

## User linking

EvilTime resolves Slack users in this order:

1. **Slack member ID** stored on the EvilTime user (`slack_user_id`). Users set it in **Settings → Profile** — it is
   the `U…` value from Slack's profile menu **⋮ → Copy member ID**, not the display name.
2. **Email match** — if the Slack profile email matches the EvilTime account email, the link is created
   automatically on the first command.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `/in` says "already clocked in … since yesterday" | A timer was left running. Clock out with `/out`; the automatic clock-out prevents this going forward. |
| Website changes do not appear in Slack | Check the error on the EvilTime Slack card. `not_in_channel` → invite the bot. `invalid_auth`/`token_revoked` → paste a new token. |
| Slack shows `dispatch_failed` | The request URL is unreachable from the internet (DNS, TLS, reverse proxy). |
| Buttons in the reminders show an error | Interactivity is not enabled or points to the wrong URL (step 4). |
| "Your Slack account is not linked" | The member ID in Settings is wrong, or the Slack email differs from the EvilTime email. |
