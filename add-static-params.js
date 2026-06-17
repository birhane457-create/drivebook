// Quick script to add generateStaticParams to dynamic route pages
// This allows static export to work - pages will be rendered client-side

const fs = require('fs');
const path = require('path');

const dynamicRoutes = [
  'app/admin/bookings/[id]/edit/page.tsx',
  'app/admin/clients/[id]/page.tsx',
  'app/admin/documents/review/[instructorId]/page.tsx',
  'app/admin/instructors/[id]/page.tsx',
  'app/book/[instructorId]/page.tsx',
  'app/book/[instructorId]/book-type/page.tsx',
  'app/book/[instructorId]/booking-details/page.tsx',
  'app/book/[instructorId]/confirmation/page.tsx',
  'app/book/[instructorId]/details/page.tsx',
  'app/book/[instructorId]/package/page.tsx',
  'app/book/[instructorId]/payment/page.tsx',
  'app/book/[instructorId]/registration/page.tsx',
  'app/booking/[id]/page.tsx',
  'app/booking/[id]/confirmation/page.tsx',
  'app/booking/[id]/payment/page.tsx',
  'app/cancel-booking/[id]/page.tsx',
  'app/dashboard/bookings/[id]/edit/page.tsx',
  'app/dashboard/clients/[id]/performance/page.tsx',
  'app/staff/tasks/[id]/page.tsx',
];

const staticParamsCode = `

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [];
}
`;

dynamicRoutes.forEach(route => {
  const filePath = path.join(__dirname, route);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if generateStaticParams already exists
    if (!content.includes('generateStaticParams')) {
      // Add it at the end of the file
      content += staticParamsCode;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Added generateStaticParams to ${route}`);
    } else {
      console.log(`- Skipped ${route} (already has generateStaticParams)`);
    }
  } else {
    console.log(`✗ File not found: ${route}`);
  }
});

console.log('\nDone! You can now run: npm run mobile:build');
