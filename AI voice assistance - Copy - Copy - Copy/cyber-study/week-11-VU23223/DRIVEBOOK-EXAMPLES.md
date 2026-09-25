# VU23223 — DriveBook Privacy and Legislation Examples

## Does the Privacy Act apply to DriveBook?

**Answer: Yes — multiple grounds**

1. **You handle health-adjacent data:** Instructor police check documents (uploaded for
   verification) constitute criminal record information — a category of sensitive information
   under the Privacy Act, regardless of turnover.

2. **You handle financial data:** Bank account details for payout processing.

3. **As the platform grows:** Once revenue exceeds $3M, full obligations apply automatically.

4. **Best practice basis:** Even if not legally required, operating under Privacy Act
   principles protects you from reputational damage and builds user trust.

---

## APP Compliance Mapping for DriveBook

### APP 1 — Privacy Policy
**Status:** ✅ Implemented  
**Evidence:** `app/privacy/page.tsx` — published privacy policy  
**Quote from the policy:**
> "We process bookings and payments, share booking details between matched Learners and
> Instructors, send booking confirmations, reminders, and receipts via email and SMS."

### APP 3 — What you collect and why

| Data collected | Why | Legal basis |
|---------------|-----|-------------|
| Instructor name, phone, email | Account setup, communication | Contractual necessity |
| Instructor ABN | Payout compliance (ATO requirements) | Legal obligation |
| Instructor bank details | Weekly payouts | Contractual necessity |
| Instructor documents (licence, police check) | Identity verification, compliance | Legitimate interest |
| Student name, phone, email | Booking confirmation, lesson coordination | Contractual necessity |
| Student pickup address | Instructor needs to know where to go | Contractual necessity |
| Payment data | Processed by Stripe | Contractual necessity |

**What you do NOT collect (and shouldn't):**
- Race/ethnicity
- Health information (beyond what appears incidentally in police checks)
- Political opinions
- Location tracking beyond pickup address

### APP 5 — Collection notice
**Status:** ✅ Partially implemented  
Users are informed about data collection in the privacy policy.  
**Gap:** Point-of-collection notice — the registration form should say "We'll use your
information for [purposes]. Read our Privacy Policy." This is a one-line addition.

### APP 11 — Security
**Status:** ✅ Implemented (see OWASP assessment)  
Reasonable security measures in place: encryption in transit, hashed passwords,
role-based access, rate limiting, audit logs.

### APP 12 — Access  
**Status:** ⚠️ Gap  
There is no self-service way for a user to download all their personal data.  
Users can view their bookings and profile, but cannot export a full data archive.  
**Recommendation:** Add a "Download my data" function to user settings.

### APP 13 — Correction  
**Status:** ✅ Partially  
Users can edit their own profile. Admin can correct data via the admin panel.

---

## Notifiable Data Breach Scenario — DriveBook

**Scenario:** Your Supabase database connection string is accidentally committed to
a public GitHub repository and remains public for 6 hours before you notice.

**Is this an eligible data breach?**

Step 1 — Was personal information accessed or disclosed?
- Unknown. You don't know if anyone found and used the connection string.
- Precautionary principle: treat it as potentially accessed.

Step 2 — Is there a real risk of serious harm?
- Connection string gives access to: instructor bank details, student personal info,
  booking history, OTP verification records
- Bank details exposure = financial harm risk → YES, serious harm risk

**Conclusion:** This is likely an eligible data breach.

**What you must do:**
1. Immediately rotate the connection string (revoke old, generate new in Supabase)
2. Check Supabase access logs for any connections from unexpected IPs
3. If you cannot rule out access: notify OAIC within 30 days
4. Notify affected instructors (bank details exposed) and students (PII exposed)
5. Write an incident report

---

## Criminal Code Act — How it protects DriveBook

### Unauthorized access to your system
If someone exploits a vulnerability to access your database:
- **s477.2 Criminal Code** — Unauthorized modification (or access) of data
- Up to 10 years imprisonment

### What this means for your bug bounty policy
You don't have a formal bug bounty program yet. If a security researcher finds a
vulnerability in DriveBook and wants to tell you, they need assurance they won't be
prosecuted. Consider adding a responsible disclosure policy to your security page:

> "If you believe you have found a security vulnerability in DriveBook, please email
> security@drivebook.com.au with details. Do not exploit the vulnerability or access
> user data. We will respond within 5 business days. We will not pursue legal action
> against researchers who act in good faith."

This is standard practice and costs nothing to implement.
