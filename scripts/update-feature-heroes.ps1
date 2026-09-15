# Script to update all feature pages with unified FeatureHero component

$updates = @(
  @{
    file = 'E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook\app\features\custom-domain\page.tsx'
    preset = 'blue'
    badge = 'Star'
    badgeText = 'Premium feature'
    title = "Your Own Domain.<br /><span class='bg-gradient-to-r from-indigo-300 to-blue-300 bg-clip-text text-transparent'>Your Own Brand.</span>"
    description = "drivingsydney.com.au instead of drivebook.com.au/instructors/john. Custom domains give you control, professionalism, and better SEO. All bookings flow to your DriveBook dashboard — no technical setup required."
    breadcrumb = @{parent='For Instructors'; current='Custom Domain'}
  },
  @{
    file = 'E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook\app\features\multi-instructor\page.tsx'
    preset = 'pink'
    badge = 'Building'
    badgeText = 'For schools & teams'
    title = "Run a Driving School.<br /><span class='bg-gradient-to-r from-pink-300 to-violet-300 bg-clip-text text-transparent'>Not Just a Side Gig.</span>"
    description = "One dashboard for multiple instructors. Shared calendar, team availability, centralized bookings. Students don't care who teaches them — they just want availability. DriveBook handles the complexity."
    breadcrumb = @{parent='For Instructors'; current='Multi-Instructor'}
  },
  @{
    file = 'E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook\app\features\online-booking\page.tsx'
    preset = 'violet'
    badge = 'Calendar'
    badgeText = 'Core platform feature'
    title = "Students Book Online.<br /><span class='bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent'>You Stay in the Car.</span>"
    description = "No phone tag. No back-and-forth texts. Students see your availability, choose a time, and book instantly. Automated confirmation and reminders take care of the rest."
    breadcrumb = @{parent='For Instructors'; current='Online Booking'}
  },
  @{
    file = 'E:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook\app\features\student-progress\page.tsx'
    preset = 'violet'
    badge = 'TrendingUp'
    badgeText = 'Student engagement tool'
    title = "Track Every Skill.<br /><span class='bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent'>Pass More Students.</span>"
    description = "Structured progress tracking for every lesson. Students see exactly what they've mastered and what's left. Parents see it too. Better outcomes, higher satisfaction, more referrals."
    breadcrumb = @{parent='For Instructors'; current='Student Progress'}
  }
)

Write-Host "Feature hero updates prepared. Run this to apply them manually." -ForegroundColor Yellow
Write-Host "Note: Payments page uses Shield icon and emerald preset" -ForegroundColor Cyan
