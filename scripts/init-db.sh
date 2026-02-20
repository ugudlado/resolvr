#!/bin/bash
# ============================================================================
# Database Initialization Script for Review Project
# ============================================================================
#
# Run: ./scripts/init-db.sh
#
# ============================================================================

set -e  # Exit on error

DB_NAME="review_dev"
DB_USER="review_user"
DB_PASS="review_pass"

echo "🗄️  Initializing $DB_NAME database..."

# Drop existing database if it exists
echo "→ Dropping existing database (if any)..."
psql postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

# Drop existing user if it exists
echo "→ Dropping existing user (if any)..."
psql postgres -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true

# Create user with password
echo "→ Creating user $DB_USER..."
psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

# Create database owned by the new user
echo "→ Creating database..."
psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
echo "→ Granting privileges..."
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Enable extensions (need superuser, then grant usage)
echo "→ Enabling extensions..."
psql $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Grant schema privileges
echo "→ Setting up schema permissions..."
psql $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
psql $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
psql $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"

echo ""
echo "✅ Database ready!"
echo ""
echo "Credentials:"
echo "  User:     $DB_USER"
echo "  Password: $DB_PASS"
echo "  Database: $DB_NAME"
echo ""
echo "Connection string:"
echo "  DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env"
echo "  2. Update DATABASE_URL in .env"
echo "  3. cd packages/schema && pnpm db:migrate"
echo "  4. pnpm dev"
