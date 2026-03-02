# Mobile App Client Role Separation Status

## Current Status

### ✅ Menu Navigation - ALREADY SEPARATED
The mobile app (`mobile/App.tsx`) already has proper role-based menu separation:

**Instructor Menu:**
- 🏠 Dashboard
- 📅 Bookings
- 👥 Clients
- 🚗 PDA Tests
- 📊 Analytics
- 💳 Subscription
- 💰 Earnings
- 👤 Profile (shared)
- ⚙️ Settings (shared)
- ❓ Help (shared)

**Client Menu:**
- 🏠 Dashboard
- 📝 My Lessons
- 💰 Wallet & Packages
- 🔍 Find Instructor
- ⭐ Reviews
- 👤 Profile (shared)
- ⚙️ Settings (shared)
- ❓ Help (shared)

### ⚠️ Screens Need Role-Awareness

#### 1. ProfileScreen (`mobile/screens/ProfileScreen.tsx`)
**Current State:** Shows instructor-specific fields for ALL users

**Instructor-Only Fields:**
- Service areas management
- Car details (make, model, year, image)
- Hourly rate
- Service radius
- License number
- Insurance number
- Vehicle types
- Languages
- Bio

**Client Fields (should show):**
- Name
- Phone
- Email
- Profile image

**Solution:** Add role detection and show different forms based on user role.

#### 2. SettingsScreen (`mobile/screens/SettingsScreen.tsx`)
**Current State:** Shows instructor-specific settings for ALL users

**Instructor-Only Settings:**
- Hourly rate
- Service radius
- Booking buffer time
- Travel time settings
- Allowed lesson durations
- Working hours
- Google Calendar sync
- Calendar buffer mode

**Client Settings (should show):**
- Notification preferences
- Language preference
- Password change
- Account settings
- Privacy settings

**Solution:** Add role detection and show different settings based on user role.

#### 3. HelpScreen (`mobile/screens/HelpScreen.tsx`)
**Current State:** Unknown - needs inspection

**Should Have:**
- Role-specific FAQs
- Role-specific contact methods
- Role-specific help topics

## Implementation Plan

### Option 1: Separate Screens (Recommended)
Create separate screens for each role:
- `mobile/screens/instructor/InstructorProfileScreen.tsx`
- `mobile/screens/instructor/InstructorSettingsScreen.tsx`
- `mobile/screens/client/ClientProfileScreen.tsx`
- `mobile/screens/client/ClientSettingsScreen.tsx`

Update `App.tsx` to route to correct screen based on role.

### Option 2: Conditional Rendering
Keep existing screens but add role-based conditional rendering:
```typescript
const { userRole } = useContext(AuthContext);

if (userRole === 'client') {
  return <ClientProfileView />;
} else {
  return <InstructorProfileView />;
}
```

## Web vs Mobile Comparison

### Web Platform
- ✅ Separate dashboards: `/dashboard` (instructor) and `/client-dashboard` (client)
- ✅ Separate navigation components
- ✅ Middleware enforces role-based access
- ✅ Completely separate page structures

### Mobile Platform
- ✅ Role-based menu (already implemented)
- ✅ Separate dashboard screens
- ✅ Separate client-specific screens (MyLessons, Wallet, Reviews, FindInstructors)
- ⚠️ Profile and Settings screens need role separation
- ⚠️ Help screen may need role-specific content

## Next Steps

1. **Inspect HelpScreen** - Check if it needs role-specific content
2. **Create Client Profile Screen** - Simple profile with name, phone, email only
3. **Create Client Settings Screen** - Basic settings without instructor features
4. **Update App.tsx routing** - Route to correct Profile/Settings based on role
5. **Test both roles** - Verify clients don't see instructor features

## Files to Modify

1. `mobile/screens/ProfileScreen.tsx` - Add role detection or create separate screens
2. `mobile/screens/SettingsScreen.tsx` - Add role detection or create separate screens
3. `mobile/screens/HelpScreen.tsx` - Add role-specific content if needed
4. `mobile/App.tsx` - Update routing logic for Profile/Settings based on role
5. Create new files:
   - `mobile/screens/client/ClientProfileScreen.tsx`
   - `mobile/screens/client/ClientSettingsScreen.tsx`

## API Endpoints Needed

Client-specific endpoints may need to be created:
- `/api/client/profile/mobile` - Get/update client profile
- `/api/client/settings/mobile` - Get/update client settings

Check if these exist or if they need to be created.
