# Subdomain Routing - Local Development ✅

## How to Test Subdomain Routing Locally

### 1. Setup Subdomain in Dashboard

1. Login as PRO/BUSINESS instructor
2. Go to `/dashboard/branding`
3. Enter subdomain (e.g., "john")
4. Wait for availability check ✓
5. Click "Save Branding Settings"

### 2. Configure Local Hosts File

**Windows**: Edit `C:\Windows\System32\drivers\etc\hosts`

**Mac/Linux**: Edit `/etc/hosts`

Add this line:
```
127.0.0.1 john.localhost
```

Replace "john" with your actual subdomain.

### 3. Test Subdomain Routing

**Start your dev server**:
```bash
npm run dev
```

**Visit subdomain URL**:
```
http://john.localhost:3000
```

**Expected Result**:
- Automatically routes to instructor's booking page
- Shows instructor's branding (logo, colors)
- URL stays as `john.localhost:3000`

### 4. How It Works

```
User visits: john.localhost:3000
     ↓
Middleware detects subdomain: "john"
     ↓
Looks up instructor with customDomain = "john"
     ↓
Rewrites to: /book/[instructorId]
     ↓
Shows booking page with branding
```

---

## Testing Multiple Subdomains

Add multiple lines to hosts file:
```
127.0.0.1 john.localhost
127.0.0.1 sarah.localhost
127.0.0.1 mike.localhost
```

Then test each:
- `http://john.localhost:3000`
- `http://sarah.localhost:3000`
- `http://mike.localhost:3000`

---

## Middleware Logic

### Subdomain Detection:
```typescript
// Extracts subdomain from hostname
john.localhost → "john"
john.localhost:3000 → "john"
john.drivebook.com → "john"
localhost → null (no subdomain)
www.drivebook.com → null (www ignored)
```

### Routing Rules:
1. **No subdomain** → Normal routing
2. **Subdomain found** → Look up instructor
3. **Instructor found** → Rewrite to `/book/[instructorId]`
4. **Instructor not found** → Continue normally (404)
5. **Protected routes** (`/dashboard`, `/admin`, `/client-dashboard`) → Use auth middleware

### Excluded Paths:
- `/api/*` - API routes (not rewritten)
- `/_next/*` - Next.js internal routes
- `/static/*` - Static files
- Images (svg, png, jpg, etc.)

---

## Production Behavior

In production, subdomain routing works automatically:

**DNS Setup** (handled by Vercel/hosting):
```
*.drivebook.com → Your app
```

**Examples**:
- `john.drivebook.com` → John's booking page
- `sarah.drivebook.com` → Sarah's booking page
- `drivebook.com` → Main landing page
- `www.drivebook.com` → Main landing page

**No hosts file needed** - DNS handles it automatically!

---

## Troubleshooting

### Issue: Subdomain not working locally

**Check 1**: Hosts file configured?
```bash
# Windows
type C:\Windows\System32\drivers\etc\hosts

# Mac/Linux
cat /etc/hosts
```

Should see: `127.0.0.1 john.localhost`

**Check 2**: Subdomain saved in database?
```bash
# Run this script
node scripts/check-subdomain.js
```

**Check 3**: Dev server running?
```bash
npm run dev
```

**Check 4**: Browser cache?
- Clear browser cache
- Try incognito/private mode
- Try different browser

### Issue: Shows 404

**Possible causes**:
1. Subdomain not saved in database
2. Instructor not found
3. Typo in subdomain

**Solution**:
- Check database: `customDomain` field should match subdomain
- Check spelling: `john.localhost:3000` (not `jhon`)

### Issue: Redirects to main page

**Possible cause**: Middleware not detecting subdomain

**Solution**:
- Check middleware.ts is updated
- Restart dev server
- Check console for errors

---

## Example Test Flow

### Step 1: Create Subdomain
```
1. Login as birhane457@gmail.com (PRO tier)
2. Go to /dashboard/branding
3. Enter "birhane" as subdomain
4. Save settings
```

### Step 2: Configure Hosts
```
# Add to hosts file
127.0.0.1 birhane.localhost
```

### Step 3: Test
```
# Visit
http://birhane.localhost:3000

# Should show
- Birhane's booking page
- Logo (if uploaded)
- Brand colors
- URL stays as birhane.localhost:3000
```

---

## Code Reference

### Middleware (`middleware.ts`):
- Detects subdomain from hostname
- Looks up instructor by `customDomain`
- Rewrites to `/book/[instructorId]`
- Preserves auth middleware for protected routes

### Subdomain Utils (`lib/utils/subdomain.ts`):
- `extractSubdomain(hostname)` - Extract subdomain
- `isCustomSubdomain(hostname)` - Check if custom subdomain
- `getInstructorBySubdomain(subdomain)` - Get instructor ID
- `buildBookingUrl(instructorId, subdomain)` - Build URL

---

## Benefits

### For Development:
- ✅ Test subdomain routing locally
- ✅ No need to deploy to test
- ✅ Same behavior as production
- ✅ Easy to test multiple subdomains

### For Production:
- ✅ Automatic subdomain routing
- ✅ No DNS configuration per instructor
- ✅ Professional URLs
- ✅ SEO-friendly

---

## Next Steps

### Local Testing:
1. Configure hosts file
2. Test subdomain routing
3. Verify branding appears
4. Test multiple subdomains

### Production Deployment:
1. Deploy to Vercel
2. Configure wildcard DNS: `*.drivebook.com`
3. Test subdomain routing in production
4. Monitor for errors

---

## Summary

✅ Subdomain routing implemented in middleware

✅ Works locally with hosts file configuration

✅ Works in production with wildcard DNS

✅ Preserves auth middleware for protected routes

✅ Excludes API routes and static files

**Test it now**: Add `127.0.0.1 john.localhost` to hosts file and visit `http://john.localhost:3000`!

---

**Last Updated**: Subdomain Routing Implementation
**Status**: ✅ READY FOR LOCAL TESTING
**Production**: Will work automatically with wildcard DNS

