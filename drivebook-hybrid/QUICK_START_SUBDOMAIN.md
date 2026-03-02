# Quick Start: Test Subdomain Routing Locally 🚀

## Step 1: Configure Subdomain (2 minutes)

1. **Login** as PRO/BUSINESS instructor:
   ```
   Email: birhane457@gmail.com
   ```

2. **Go to Branding Settings**:
   ```
   http://localhost:3000/dashboard/branding
   ```

3. **Enter Subdomain**:
   - Scroll to "Custom Subdomain" section
   - Enter: `birhane` (or any name you want)
   - Wait for ✓ "birhane.drivebook.com is available!"
   - Click "Save Branding Settings"

---

## Step 2: Edit Hosts File (1 minute)

### Windows:
1. Open Notepad as Administrator
2. Open file: `C:\Windows\System32\drivers\etc\hosts`
3. Add this line at the end:
   ```
   127.0.0.1 birhane.localhost
   ```
4. Save and close

### Mac/Linux:
1. Open Terminal
2. Run: `sudo nano /etc/hosts`
3. Add this line at the end:
   ```
   127.0.0.1 birhane.localhost
   ```
4. Save (Ctrl+O, Enter, Ctrl+X)

---

## Step 3: Test (30 seconds)

1. **Make sure dev server is running**:
   ```bash
   npm run dev
   ```

2. **Visit subdomain URL**:
   ```
   http://birhane.localhost:3000
   ```

3. **Expected Result**:
   - ✅ Shows your booking page
   - ✅ Shows your logo (if uploaded)
   - ✅ Shows your brand colors
   - ✅ URL stays as `birhane.localhost:3000`

---

## Verify It's Working

Run this script to check configured subdomains:

```bash
node scripts/check-subdomain.js
```

**Expected Output**:
```
✅ Found 1 configured subdomain(s):

1. Birhane [Your Name]
   Email: birhane457@gmail.com
   Tier: PRO
   Subdomain: birhane
   Local URL: http://birhane.localhost:3000
   Production URL: https://birhane.drivebook.com
```

---

## Test Multiple Subdomains

Want to test with different names?

1. **Add more to hosts file**:
   ```
   127.0.0.1 birhane.localhost
   127.0.0.1 john.localhost
   127.0.0.1 sarah.localhost
   ```

2. **Configure in dashboard**:
   - Change subdomain to "john"
   - Save
   - Visit `http://john.localhost:3000`

---

## Troubleshooting

### Issue: "This site can't be reached"

**Solution**: Check hosts file
```bash
# Windows
type C:\Windows\System32\drivers\etc\hosts

# Mac/Linux
cat /etc/hosts
```

Should see: `127.0.0.1 birhane.localhost`

### Issue: Shows main page, not booking page

**Solution**: 
1. Check subdomain saved in database:
   ```bash
   node scripts/check-subdomain.js
   ```
2. Restart dev server
3. Clear browser cache

### Issue: 404 error

**Solution**: Subdomain not found in database
- Go to `/dashboard/branding`
- Re-enter subdomain
- Click "Save Branding Settings"

---

## Production (When Ready)

In production, it works automatically - no hosts file needed!

**DNS Setup** (Vercel handles this):
```
*.drivebook.com → Your app
```

**Then**:
- `birhane.drivebook.com` → Your booking page
- `john.drivebook.com` → John's booking page
- `sarah.drivebook.com` → Sarah's booking page

---

## Summary

✅ Configure subdomain in dashboard

✅ Add to hosts file: `127.0.0.1 subdomain.localhost`

✅ Visit: `http://subdomain.localhost:3000`

✅ Works automatically in production!

---

**That's it!** Your subdomain routing is ready to test locally. 🎉

