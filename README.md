# Discord Wordle Tracker Bot

A Discord bot that automatically tracks and displays Wordle game statistics for guild members, featuring real-time score capture, historical data scraping, and interactive leaderboards with personal performance analytics.

## Features

- **🎯 Real-time Score Capture**: Automatically monitors and parses Wordle results posted by the Wordle App Bot
- **📊 Interactive Leaderboards**: View weekly, monthly, yearly, and all-time rankings
- **📈 Personal Statistics**: Track individual performance metrics including solve rates, streaks, and average guesses
- **🔄 Historical Backfill**: Admin command to scrape past channel messages and populate the database
- **👥 User Synchronization**: Automatically syncs Discord guild members to the database

## Technology Stack

- **Runtime**: Node.js with CommonJS modules
- **Discord Integration**: discord.js v14
- **Database**: SQLite with Prisma ORM v6 (better-sqlite3 adapter)
- **Development**: ESLint, TypeScript definitions, nodemon

## Prerequisites

- Node.js v18.18 or higher (required by Prisma 6)
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- Discord Developer Mode enabled (for obtaining IDs)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/LennyPK/discord-app-rcr.git
   cd discord-app-rcr
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the database (creates `prisma/dev.db` and generates the Prisma client):

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

   If you already have a database that was created with `db push` before migrations were
   baselined, mark the baseline as applied once instead of deploying:

   ```bash
   npx prisma migrate resolve --applied 0_init
   ```

   To change the schema later, edit `prisma/schema.prisma` and run `npm run db:migrate`
   (`npx prisma migrate dev --name <change>`). `npm run db:studio` opens a database browser.

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your-bot-token-here
CLIENT_ID=your-client-id-here
GUILD_ID=your-guild-id-here

# Database Configuration
# Relative paths are resolved from the prisma/ folder
DATABASE_URL=file:./dev.db

# Wordle Bot Configuration
WORDLE_APP_ID=wordle_bot_user_id_here

# Timezone for all Wordle date calculations
TZ=Pacific/Auckland
```

### Obtaining Configuration Values

- **DISCORD_TOKEN**: Bot token from Discord Developer Portal → Your Application → Bot → Token
- **CLIENT_ID**: Application ID from Discord Developer Portal → Your Application → General Information
- **GUILD_ID**: Right-click your Discord server → Copy Server ID (requires Developer Mode)
- **WORDLE_APP_ID**: Right-click the Wordle App Bot → Copy User ID

## Usage

### Starting the Bot

**Development mode** (with auto-restart):

```bash
npm run dev
```

**Production mode**:

```bash
npm start
```

### Running Tests

Unit tests for scoring, leaderboard periods, results parsing and timelines use Node's built-in test runner:

```bash
npm test
```

### Registering Commands

Before first use, register slash commands with Discord:

```bash
node src/register-commands.js
```

### Available Commands

- `/wordle_leaderboard [type]` - Display weekly, monthly, yearly, or all-time rankings
- `/wordle_stats` - View your personal Wordle statistics and performance metrics
- `/wordle_init [range] [verbose]` - Backfill historical Wordle data by scanning the channel it's run in
- `/update_members [verbose]` - Sync Discord guild members to the database
- `/wordle_blacklist add|remove|list` - Hide players from the leaderboards (Manage Server only). Their scores are still recorded, and they can still use `/wordle_stats`
- `/ping` - Check the bot is online, with response time and uptime

## How It Works

The bot monitors messages from a designated Wordle App Bot and automatically captures scores when daily results are posted. Scores are parsed using regex patterns to extract user mentions and guess counts, then stored in a SQLite database with a composite unique key ensuring one score per user per day.

### Scoring

Every day in the leaderboard period earns points:

| Result | Points |
| ------ | ------ |
| Solved in 1 / 2 / 3 / 4 / 5 / 6 | 100 / 90 / 80 / 70 / 60 / 50 |
| Failed (X) | 25 |
| Didn't play | 0 |

```text
score = average points per day × (0.7 + 0.3 × days played ÷ days in period)
```

Playing more always raises your score, and failing is worth more than skipping. Periods run up to yesterday's Wordle (or the latest recorded results): weekly from Monday, monthly from the 1st, yearly from 1 January, and all-time from the first recorded Wordle. Players who join late are penalised on all-time but start fresh on each new week, month and year.

## Database Schema

The bot uses two primary models:

- **User**: Stores Discord user information (ID, username, display names) and whether the player is hidden from leaderboards
- **Wordle**: Tracks individual game results (date, score, solved status) with a foreign key to User

## Project Structure

```shell
prisma/
├── schema.prisma               # Database schema
└── migrations/                 # Migration history (0_init is the baseline)
src/
├── index.js                    # Bot entry point: loads commands and message handlers
├── env.js                      # Loads .env from the project root
├── prisma-client.js            # Prisma client singleton
├── pagination.js               # Paginated embed helper
├── register-commands.js        # Registers slash commands with Discord
├── utils.js                    # Small shared helpers
├── commands/
│   ├── utility/                # /ping, /update_members
│   └── wordle/                 # /wordle_* commands
│       └── utils/
│           ├── periods.js      # Leaderboard date ranges
│           ├── results.js      # Parsing and saving Wordle results posts
│           ├── scoring.js      # Scoring and ranking
│           ├── timeline.js     # Day-by-day history per player
│           └── user.js         # User queries
└── messages/
    └── wordle/                 # Captures the daily results post
```
