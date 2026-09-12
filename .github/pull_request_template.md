# Pull Request

## Description
<!-- Brief summary of what this PR accomplishes -->

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes, code improvements)
- [ ] Documentation update
- [ ] Configuration change

## Related Issues
<!-- Link to GitHub issues, e.g., "Closes #123" or "Related to #456" -->

---

## Architecture Compliance

**Before merging, confirm these architectural principles are maintained:**

- [ ] This PR does NOT introduce industry-specific application logic
- [ ] If it adds capability logic, the logic is generic (not industry-specific)
- [ ] If it adds a preset/template, the preset contains only data/defaults (no logic)
- [ ] If it introduces industry checks (`if (industry === 'X')` or `if (businessType === 'X')`), I have documented the architectural justification below

### ⚠️ If you checked the last box, explain the justification:

_Industry-specific logic is only permitted if it meets one of these thresholds:_
- _Different data model (e.g., healthcare medical records)_
- _Unique regulatory requirements (e.g., HIPAA, financial licensing)_
- _Fundamentally different workflow (e.g., manufacturing vs service booking)_

**Justification:**
<!-- Explain why this industry requires specialized logic -->

---

## Testing Checklist

- [ ] I have tested this change locally
- [ ] I have added/updated tests for this change
- [ ] All existing tests pass (`npm test`)
- [ ] I have verified TypeScript compilation (`npm run build`)
- [ ] I have verified no linting errors (`npm run lint`)

## Database Changes

- [ ] This PR includes Prisma schema changes
- [ ] Migration has been created (`npx prisma migrate dev`)
- [ ] Migration has been tested locally

---

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Additional Notes
<!-- Any additional context, implementation details, or concerns -->

---

## Reviewer Checklist (for code reviewers)

- [ ] Code follows project conventions
- [ ] Changes are well-tested
- [ ] Documentation is updated (if needed)
- [ ] No security vulnerabilities introduced
- [ ] **Architecture principle is maintained** (no unjustified industry-specific logic)
