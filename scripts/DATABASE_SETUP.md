# Database Setup Guide

## Prerequisites

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Verify it's running
psql -U postgres -c "SELECT version();"
```

### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user
sudo -u postgres psql
```

### Windows

1. Download installer from https://www.postgresql.org/download/windows/
2. Run the installer and follow prompts
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL bin to PATH (usually `C:\Program Files\PostgreSQL\16\bin`)

### Docker (Alternative)

```bash
# Run PostgreSQL in Docker
docker run --name review-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16

# Connect to it
docker exec -it review-postgres psql -U postgres
```

## Initialize Database

Once PostgreSQL is running, create the databases:

```bash
# From project root
psql -U postgres -f scripts/init-db.sql
```

This creates:
- **User**: `review_user` (password: `review_password`)
- **Dev DB**: `review_dev`
- **Test DB**: `review_test`

## Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your database URL
DATABASE_URL=postgresql://review_user:review_password@localhost:5432/review_dev
```

## Run Migrations

```bash
cd packages/schema
pnpm db:migrate
```

## Verify Setup

```bash
# Connect to dev database
psql -U review_user -d review_dev

# List tables (after migrations)
\dt

# Exit
\q
```

## Common Issues

### "peer authentication failed"

Edit `pg_hba.conf` to use `md5` instead of `peer`:

```bash
# Find the file
sudo find /etc -name pg_hba.conf 2>/dev/null
# Or on macOS with Homebrew:
# /opt/homebrew/var/postgresql@16/pg_hba.conf

# Change 'peer' to 'md5' for local connections, then restart:
sudo systemctl restart postgresql
# Or on macOS:
brew services restart postgresql@16
```

### "database does not exist"

Make sure you ran the init script:

```bash
psql -U postgres -f scripts/init-db.sql
```

### "permission denied"

The init script grants all necessary permissions. If issues persist:

```bash
psql -U postgres -d review_dev -c "GRANT ALL ON SCHEMA public TO review_user;"
```

### Port 5432 already in use

Another PostgreSQL instance may be running:

```bash
# Check what's using the port
lsof -i :5432

# Stop other instances or use a different port
```

## Database Commands Reference

```bash
# Generate migration after schema changes
cd packages/schema
pnpm db:generate --name describe_your_change

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (visual DB browser)
pnpm db:studio

# Reset database (drop all tables)
psql -U postgres -d review_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm db:migrate
```
