# Documentation Index

All documentation for drivebook-hybrid is organized here. Start with the links below.

## 📖 Main Documentation

**New to this project?** Start here:
- **[../README.md](../README.md)** — Project overview, quick start, API reference, deployment

## 📋 Detailed Guides

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flows, components, error handling
- **[INTEGRATION.md](INTEGRATION.md)** — How drivebook-hybrid integrates with main DriveBook platform
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Production deployment to Heroku, AWS ECS, Railway, Render
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** — Quick lookup for workflows, APIs, troubleshooting

## 🤖 AI System

- **[AI_SYSTEM.md](AI_SYSTEM.md)** — Copilot agent integration, response formats, AI flow
- **[HOMEPAGE.md](HOMEPAGE.md)** — Suggested public landing page / marketing copy

## 📝 Status & Changelog

- **[../STATUS.md](../STATUS.md)** — What's been done, known issues fixed, what's next

---

## File Organization

```
drivebook-hybrid/
├── README.md              # ⭐ START HERE
├── STATUS.md              # Build status, changelog, next steps
├── package.json
├── server.js
├── routes/                # API endpoints
├── services/              # Business logic
├── utils/                 # Validators, logger, config
├── tests/                 # Jest test files
├── prisma/                # Database schema
├── docs/                  # 📁 Documentation (this folder)
│   ├── INDEX.md           # This file
│   ├── ARCHITECTURE.md
│   ├── INTEGRATION.md
│   ├── DEPLOYMENT.md
│   ├── QUICK_REFERENCE.md
│   └── AI_SYSTEM.md
├── Dockerfile             # Docker image definition
├── docker-compose.yml     # Local dev environment
└── .env                   # Environment variables (not in git)
```

---

## Quick Navigation by Topic

### 🚀 Getting Started
1. Read [../README.md](../README.md) — Overview & quick start
2. Run `npm install` then `npm run dev`
3. Visit `http://localhost:3000/` for API docs

### 🛠️ Development
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — Common commands and APIs
- [ARCHITECTURE.md](ARCHITECTURE.md) — Understand the system design

### 🔌 Integration
- [INTEGRATION.md](INTEGRATION.md) — Connect to main DriveBook platform
- [AI_SYSTEM.md](AI_SYSTEM.md) — Copilot agent setup and usage

### 📦 Deployment
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deploy to production (Heroku/AWS/Railway)
- [../STATUS.md](../STATUS.md) — Deployment readiness checklist

---

## Command Reference

```bash
# Development
npm run dev           # Start with auto-reload
npm test              # Run all tests
npm test -- tests/smoke.test.js  # Integration tests
npm run build         # Build (runs tests first)

# Database
npx prisma studio    # GUI database browser
npx prisma migrate dev --name <name>  # Create migration

# Server
npm start             # Production mode
curl http://localhost:3000/  # View API docs
```

---

## Support

- **Issues?** Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md) troubleshooting section
- **Architecture questions?** See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Deployment help?** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Copilot setup?** See [AI_SYSTEM.md](AI_SYSTEM.md)
- **Status & progress?** See [../STATUS.md](../STATUS.md)

---

**Version**: 1.0.0  
**Last Updated**: Feb 28, 2026  
**Status**: Production Ready
