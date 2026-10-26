# Changelog: AI Context System & Architecture

This document tracks significant architectural decisions, system additions, and documentation updates for the Real Estate AI Calling CRM.

---

### 2026-10-26 (AWS & MySQL Migration)
- **Change:** Migrated database provider from SQLite to MySQL 8.0, configured `@db.Text` and `@db.LongText` attributes on high-capacity string fields, regenerated Prisma Client, and created production AWS deployment assets (Backend Dockerfile, Frontend Standalone Dockerfile, Nginx reverse proxy configuration, production Docker Compose with MySQL 8.0, EC2 setup script, and AWS deployment guide).
- **Reason:** Prepared project for production cloud deployment on AWS EC2 with a dedicated MySQL database as requested by the user.
- **Affected Areas:**
  - `backend/prisma/schema.prisma` (`provider = "mysql"`, `@db.Text`, `@db.LongText`)
  - `backend/.env.example` (MySQL connection string)
  - `frontend/next.config.ts` (`output: "standalone"`)
  - `frontend/Dockerfile` & `backend/Dockerfile`
  - `nginx/nginx.conf`
  - `docker-compose.yml` (MySQL 8, backend, frontend, nginx)
  - `scripts/setup-aws-ec2.sh`
  - `AWS_DEPLOYMENT_GUIDE.md`
  - `.ai/DATABASE.md` & `.ai/PROJECT.md`
- **Migration/API Impact:** Schema datasource changed to MySQL. Prisma Client recompiled. Zero breaking changes to API endpoints or frontend functionality.

---

### 2026-10-26
- **Change:** Established the foundational AI context documentation system and automated file structure generator.
- **Reason:** Provide future AI coding assistants with explicit, evidence-based architectural knowledge without assumptions or guesswork.
- **Affected Areas:**
  - `AI.md` (Root entry point)
  - `.ai/` documentation directory:
    - `PROJECT.md`
    - `ARCHITECTURE.md`
    - `FILE_STRUCTURE.md`
    - `API.md`
    - `DATABASE.md`
    - `RULES.md`
    - `CHANGELOG.md`
  - `scripts/generate-ai-context.cjs`
  - `package.json` (`ai:context` script verification)
- **Migration/API Impact:** None. Zero runtime modifications to existing application code, database schema, or public API endpoints.
