# Discord Wordle Tracker Bot

A Discord bot that automatically tracks and displays Wordle game statistics for guild members, featuring real-time score capture, historical data scraping, and interactive leaderboards with personal performance analytics.

## Features

- **🎯 Real-time Score Capture**: Automatically monitors and parses Wordle results posted by the Wordle App Bot
- **📊 Interactive Leaderboards**: View weekly, monthly, and all-time rankings with custom scoring algorithms
- **📈 Personal Statistics**: Track individual performance metrics including solve rates, streaks, and average guesses
- **🔄 Historical Backfill**: Admin command to scrape past channel messages and populate the database
- **👥 User Synchronization**: Automatically syncs Discord guild members to the database

## Technology Stack

- **Runtime**: Node.js with CommonJS modules
- **Discord Integration**: discord.js v14.24.2
- **Database**: SQLite with Prisma ORM v6.18.0
- **Development**: ESLint, TypeScript definitions, nodemon

## Prerequisites

- Node.js (v16 or higher recommended)
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

3. Set up the database:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your-bot-token-here
CLIENT_ID=your-client-id-here
GUILD_ID=your-guild-id-here

# Database Configuration
DATABASE_URL=file:./prisma/dev.db

# Wordle Bot Configuration
WORDLE_APP_ID=wordle_bot_user_id_here
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

### Registering Commands

Before first use, register slash commands with Discord:

```bash
node src/register-commands.js
```

### Available Commands

- `/wordle_leaderboard [type]` - Display weekly, monthly, or all-time rankings
- `/wordle_stats` - View your personal Wordle statistics and performance metrics
- `/wordle_init [range] [verbose]` - Admin command to backfill historical Wordle data
- `/update_members [verbose]` - Sync Discord guild members to the database

## How It Works

The bot monitors messages from a designated Wordle App Bot and automatically captures scores when daily results are posted. Scores are parsed using regex patterns to extract user mentions and guess counts, then stored in a SQLite database with a composite unique key ensuring one score per user per day.

The scoring algorithm balances skill metrics (solve rate and guess efficiency) with participation incentives, calculating composite scores for leaderboard rankings.

## Database Schema

The bot uses two primary models:

- **User**: Stores Discord user information (ID, username, display names)
- **Wordle**: Tracks individual game results (date, score, solved status) with a foreign key to User

## Project Structure

```shell
src/
├── index.js                    # Bot entry point and initialization
├── prisma-client.js            # Prisma client singleton
├── register-commands.js        # Command registration utility
├── commands/
│   ├── wordle/                 # Wordle tracking commands
│   └── utility/                # Utility commands
└── messages/
    └── wordle/                 # Message handlers for score capture
```
