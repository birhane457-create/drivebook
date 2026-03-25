const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.instructor.update({
  where: { id: '69901e9c97d4ad25232db3b5' },
  data: { showBrandingOnBookingPage: true },
}).then(r => {
  console.log('✅ showBrandingOnBookingPage:', r.showBrandingOnBookingPage);
  console.log('   brandLogo:', r.brandLogo);
  console.log('   brandColorPrimary:', r.brandColorPrimary);
}).catch(console.error).finally(() => prisma.$disconnect());
