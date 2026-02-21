# Gator 🐊 (RSS Blog Aggregator CLI)

Gator is a multi-user CLI app written in TypeScript that aggregates RSS feeds, stores posts in a PostgreSQL database, and lets users follow/unfollow feeds and browse recent posts.

> Local-only (no server besides Postgres). No authentication — whoever has DB access can act as any user.

---

## Requirements

- Node.js `v22.15.0` (recommended via nvm + `.nvmrc`)
- PostgreSQL `16+`
- npm

### Install Postgres (WSL / Ubuntu)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start