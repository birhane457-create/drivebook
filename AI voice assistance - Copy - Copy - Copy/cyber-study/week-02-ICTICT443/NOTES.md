# Week 2 — ICTICT443: Work Collaboratively in the ICT Industry

## What this unit is about

Professional practices in IT teams:
- Communication styles (technical vs non-technical audiences)
- Documentation standards
- Version control and collaborative tools
- Agile and project management basics
- Professionalism, ethics, and intellectual property

---

## Key Concepts

### 1. Technical vs Non-Technical Communication

You will constantly need to explain technical decisions to non-technical people.

| Audience | How to communicate |
|----------|-------------------|
| Developers | Use technical terms freely, show code, reference docs |
| Business owner | Focus on risk, cost, and business impact |
| End user | Plain language, no jargon, focus on what they need to do |
| Regulator/auditor | Precise language, reference legislation, evidence-based |

**Example:** Explaining rate limiting to a non-technical founder:
> "We've added a system that automatically blocks anyone who tries to log in more than 5 times in 15 minutes. This protects your instructors' accounts from hackers who try thousands of password guesses."

### 2. Documentation Standards

Good IT documentation includes:
- **Purpose** — why this document exists
- **Audience** — who it's written for
- **Date and version** — when it was last updated
- **Author** — who is responsible for it
- **Change history** — what changed and when

Types of documentation:
- Technical specs (API docs, architecture diagrams)
- User guides (how to use a feature)
- Runbooks (how to respond to an incident)
- Policy documents (privacy, security, acceptable use)

### 3. Version Control (Git)
- **Commit** — save a snapshot of changes with a message
- **Branch** — work on a feature without affecting the main codebase
- **Pull request / merge request** — request review before merging
- **Repository** — the full project with all its history

Key principle: commit messages should explain *why*, not just *what*.
Bad: `"fix bug"`
Good: `"fix: prevent double-charge when Stripe webhook fires twice for same payment"`

### 4. Agile Basics
- **Sprint** — 1–2 week work cycle
- **Backlog** — list of tasks to be done
- **Stand-up** — short daily team check-in (what did I do, what will I do, any blockers)
- **Retrospective** — what went well, what to improve

### 5. Intellectual Property in IT
- **Copyright** — automatic protection for code you write
- **Open source licences** — MIT, Apache, GPL — you must comply with the licence terms of packages you use
- **Trade secrets** — source code, algorithms, business logic that you keep confidential

---

## Practice Questions

**Q:** You've written a security audit report for a client. How would you present it differently to their IT manager vs their CEO?

**Model answer:**
- IT manager: Full technical report — specific vulnerability names (e.g., CVE numbers), affected systems, CVSS scores, step-by-step remediation instructions
- CEO: Executive summary — business risk in dollar terms, which systems are exposed, three priority actions, estimated cost to fix, what happens if not fixed
