# Contributing to DriveBook Voice Service

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

## Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/drivebook-hybrid.git
   cd drivebook-hybrid
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npx prisma generate
   ```

3. **Set Up Environment**
   ```bash
   cp .env.voice-service.example .env
   # Edit .env with your local Twilio/Copilot credentials
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

---

## Development Workflow

### Branch Naming
- `feature/foo` – new features
- `fix/bar` – bug fixes
- `refactor/baz` – code cleanup (no behavior change)
- `docs/readme` – documentation only

### Before Committing

1. **Lint & Format**
   ```bash
   npm run lint
   npm run format
   ```

2. **Run Tests**
   ```bash
   npm test
   ```

3. **Check Security**
   ```bash
   npm audit
   ```

### Commit Messages
Use clear, descriptive messages:
```
feat: add voice webhook handler
fix: correct timezone calculation in booking API
refactor: extract database service to separate module
docs: update README with deployment steps
```

### Code Style

- **Indentation**: 2 spaces (see `.eslintrc.json`)
- **Quotes**: Single quotes (except JSON/config)
- **Semicolons**: Always
- **Line length**: Max 120 characters
- **Comments**: Explain why, not what (code should be self-documenting)

**Example:**
```javascript
// ✅ Good: explains the reasoning
const timeout = 5000; // Copilot API is slow, give it time

// ❌ Bad: states the obvious
const timeout = 5000; // Set timeout to 5000ms
```

---

## Testing Requirements

- **Unit tests**: For utilities, services, validators
- **Integration tests**: For API routes (use `supertest`)
- **Smoke tests**: Quick sanity checks before deployment

```bash
npm test                          # Run all tests
npm test -- --coverage            # With coverage report
npm test -- tests/smoke.test.js   # Specific test file
```

### Coverage Goal
- Aim for **≥80% coverage** on business logic
- Don't worry about 100% coverage for error edge cases

---

## Pull Request Process

1. **Create PR with clear title & description**
   - Reference any related issues (#123)
   - Explain what changed and why

2. **Example PR Description**
   ```markdown
   ## Description
   Adds rate limiting to voice webhook endpoint to prevent abuse.

   ## Related Issue
   Fixes #456

   ## Changes
   - Added rate limit middleware
   - Configured via RATE_LIMIT_* env vars
   - Returns 429 on limit exceeded

   ## Testing
   - Unit test for rate limiting logic
   - Integration test with simulated traffic spike
   - Manual testing with Postman
   ```

3. **Code Review**
   - Address feedback promptly
   - Push changes to same branch (squash commits if multiple)
   - Request re-review when ready

4. **Merge**
   - Ensure all checks pass (tests, lint, security)
   - Squash commits for clean history
   - Delete branch after merge

---

## Documentation

- Update `README.md` if adding/changing features
- Add JSDoc comments to functions:
  ```javascript
  /**
   * Create a new booking from voice input
   * @param {object} data - Booking data {phone, date, time, duration}
   * @returns {Promise<object>} Created booking with ID
   * @throws {ValidationError} If data is invalid
   */
  async function createBooking(data) { ... }
  ```
- Keep `.env.voice-service.example` in sync with actual variables

---

## Common Issues

**Tests fail locally but pass on CI?**
- Make sure you're using the same Node version (see `.nvmrc`)
- Clear node_modules: `rm -rf node_modules package-lock.json && npm install`

**Can't connect to Twilio/Copilot?**
- Check `.env` has correct credentials from `.env.voice-service.example`
- Verify API endpoints are accessible: `curl https://api.twilio.com`

**Prisma migration errors?**
- Reset database for local dev: `npx prisma migrate reset`
- Never force-push migrations to production

---

## Need Help?

- Check existing issues & PRs
- Read the [Security Policy](./SECURITY.md)
- Review [README.md](./README.md) for architecture
- Ask in discussions or create a GitHub issue

---

## Code of Conduct

Please respect all contributors. Be respectful, constructive, and inclusive. Harassment or discrimination is not tolerated.

Happy coding! 🚀
