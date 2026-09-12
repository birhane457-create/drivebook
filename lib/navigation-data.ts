/**
 * DriveBook Public Navigation Data
 * 
 * Single source of truth for public navigation structure.
 * Based on NAVIGATION_ARCHITECTURE.md v2.0
 * 
 * Navigation answers: "What does the customer need to find?"
 * Product taxonomy answers: "What are we selling?"
 * These should NOT be forced to match.
 */

export interface NavItem {
  label: string;
  href: string;
  primary?: boolean;
  note?: string;
}

export interface FeaturedNavItem extends NavItem {
  featured: true;
  icon: string;
  benefit: string;
}

export interface NavSection {
  title: string;
  intent: string;
  audience?: 'ALL' | 'SCHOOLS' | 'INSTRUCTORS';
  items: (NavItem | FeaturedNavItem)[];
}

export interface MegaMenu {
  label: string;
  megaMenu: {
    layout?: 'single-column' | 'three-column';
    sections: NavSection[];
    footer?: {
      title: string;
      items: NavItem[];
    };
  };
}

export interface Dropdown {
  label: string;
  dropdown: {
    sections: Array<{
      title: string;
      items: NavItem[];
    }>;
  };
}

export type NavConfig = MegaMenu | Dropdown;

// Helper function to check if item is featured
export function isFeaturedItem(item: NavItem | FeaturedNavItem): item is FeaturedNavItem {
  return 'featured' in item && item.featured === true;
}

// ============================================================================
// LEARNER NAVIGATION: "Find an Instructor"
// ============================================================================

export const learnerNav: MegaMenu = {
  label: 'Find an Instructor',
  megaMenu: {
    layout: 'single-column',
    sections: [
      {
        title: 'Find the Right Instructor',
        intent: 'Discovery, research, comparison',
        items: [
          {
            label: 'Find an Instructor',
            href: '/instructors',
            primary: true,
          },
          {
            label: 'Browse by Location',
            href: '/driving-lessons',
          },
          {
            label: 'Instructor Profiles',
            href: '/instructors',
            note: 'Embedded in search',
          },
          {
            label: 'Reviews & Ratings',
            href: '/instructors',
            note: 'Embedded in profiles',
          },
        ],
      },
      {
        title: 'Book Lessons',
        intent: 'Transaction, booking',
        items: [
          {
            label: 'Driving Lessons',
            href: '/lessons',
          },
          {
            label: 'Lesson Packages',
            href: '/lessons/packages',
            note: '5, 10, 20-hour bundles',
          },
        ],
      },
      {
        title: 'Prepare for Your Test',
        intent: 'Test preparation, specialized services',
        items: [
          {
            label: 'Test Preparation',
            href: '/test-preparation',
            note: 'Via instructor packages',
          },
          {
            label: 'PDA Test-Day Services',
            href: '/pda-guide',
            note: 'WA only',
          },
        ],
      },
      {
        title: 'Learn',
        intent: 'Education, self-help content',
        items: [
          {
            label: 'Learn to Drive',
            href: '/learn-to-drive',
          },
          {
            label: 'PDA Guide',
            href: '/pda-guide',
          },
        ],
      },
    ],
  },
};

// ============================================================================
// B2B NAVIGATION: "For Instructors & Schools"
// ============================================================================

export const businessNav: MegaMenu = {
  label: 'For Instructors & Schools',
  megaMenu: {
    layout: 'three-column',
    sections: [
      // Column 1: Run Your Business (Core Capabilities)
      {
        title: 'Run Your Business',
        intent: 'Core platform capabilities, daily operations',
        audience: 'ALL',
        items: [
          {
            label: 'DriveBook Platform',
            href: '/platform',
            primary: true,
          },
          {
            label: 'Online Booking',
            href: '/features/online-booking',
          },
          {
            label: 'Calendar & Scheduling',
            href: '/features/calendar',
          },
          {
            label: 'Client Management',
            href: '/features/client-management',
          },
          {
            label: 'Payments & Payouts',
            href: '/features/payments',
          },
          {
            label: 'Analytics',
            href: '/features/analytics',
          },
        ],
      },
      
      // Column 2: Grow Your Business (Differentiators)
      {
        title: 'Grow Your Business',
        intent: 'Differentiators, growth tools, marketing, automation',
        audience: 'ALL',
        items: [
          {
            label: 'AI Receptionist',
            href: '/features/ai-receptionist',
            featured: true,
            icon: '🤖',
            benefit: 'Answer calls 24/7, never miss a booking',
          },
          {
            label: 'Custom Domain',
            href: '/features/custom-domain',
            featured: true,
            icon: '🌐',
            benefit: 'Build your brand on your own domain',
          },
          {
            label: 'Marketing & SEO',
            href: '/features/marketing',
          },
          {
            label: 'Professional Website',
            href: '/features/online-booking',
          },
          {
            label: 'Student Progress',
            href: '/features/student-progress',
          },
        ],
      },
      
      // Column 3: For Driving Schools (School-Specific)
      {
        title: 'For Driving Schools',
        intent: 'School-specific operations, team management',
        audience: 'SCHOOLS',
        items: [
          {
            label: 'Multi-Instructor Management',
            href: '/features/multi-instructor',
            featured: true,
            icon: '👥',
            benefit: 'Manage your entire team from one place',
          },
          {
            label: 'Instructor Calendars',
            href: '/features/calendar',
            note: 'Team view',
          },
          {
            label: 'Staff & Permissions',
            href: '/features/multi-instructor',
            note: 'BUSINESS tier',
          },
          {
            label: 'School Reporting',
            href: '/features/analytics',
          },
          {
            label: 'White-Label Experience',
            href: '/features/custom-domain',
          },
        ],
      },
    ],
    
    // Footer: Get Started
    footer: {
      title: 'Get Started',
      items: [
        {
          label: 'Pricing',
          href: '/pricing',
        },
        {
          label: 'Teach with DriveBook',
          href: '/teach-with-drivebook',
        },
        {
          label: 'Instructor Resources',
          href: '/for-instructors',
        },
        {
          label: 'Contact',
          href: '/contact',
        },
      ],
    },
  },
};

// ============================================================================
// RESOURCES NAVIGATION (Simple Dropdown)
// ============================================================================

export const resourcesNav: Dropdown = {
  label: 'Resources',
  dropdown: {
    sections: [
      {
        title: 'For Learners',
        items: [
          {
            label: 'Learn to Drive',
            href: '/learn-to-drive',
          },
          {
            label: 'PDA Guide',
            href: '/pda-guide',
          },
        ],
      },
      {
        title: 'For Instructors',
        items: [
          {
            label: 'Instructor Resources',
            href: '/for-instructors',
          },
        ],
      },
      {
        title: 'Learn More',
        items: [
          {
            label: 'Blog',
            href: '/blog',
          },
          {
            label: 'Help Centre',
            href: '/help',
          },
        ],
      },
    ],
  },
};

// ============================================================================
// DIRECT LINKS
// ============================================================================

export const aboutLink: NavItem = {
  label: 'About',
  href: '/about',
};

// ============================================================================
// UTILITY NAVIGATION (Right Side)
// ============================================================================

export const utilityNav = {
  login: {
    label: 'Login',
    href: '/login',
  },
  getStarted: {
    label: 'Get Started',
    // Context-aware destination - implement in component
    href: '/register/business-type', // Default
  },
};

// ============================================================================
// COMPLETE PUBLIC NAVIGATION STRUCTURE
// ============================================================================

export const publicNavigation = {
  primary: [
    learnerNav,
    businessNav,
    resourcesNav,
    aboutLink,
  ],
  utility: utilityNav,
};

// ============================================================================
// CONTEXT-AWARE CTA CONFIGURATION
// ============================================================================

export interface CTAConfig {
  label: string;
  href: string;
  variant?: 'default' | 'secondary' | 'outline';
}

export const contextAwareCTA = {
  homepage: {
    label: 'Get Started',
    href: '/register/business-type', // Could open choice modal
  },
  learnerPages: {
    label: 'Find an Instructor',
    href: '/instructors',
  },
  instructorPages: {
    label: 'Get Started',
    href: '/register/business-type',
  },
  schoolPages: {
    label: 'Contact Us',
    href: '/contact',
  },
  platformPages: {
    label: 'Get Started',
    href: '/register/business-type',
  },
};

/**
 * Get context-aware CTA based on current page path
 */
export function getContextAwareCTA(pathname: string): CTAConfig {
  // Learner pages
  if (pathname.startsWith('/book') || 
      pathname.startsWith('/learn-to-drive') || 
      pathname.startsWith('/pda-guide') ||
      pathname.startsWith('/driving-lessons')) {
    return contextAwareCTA.learnerPages;
  }
  
  // Instructor pages
  if (pathname.startsWith('/teach-with-drivebook') || 
      pathname.startsWith('/for-instructors') ||
      pathname.startsWith('/platform')) {
    return contextAwareCTA.instructorPages;
  }
  
  // School-specific features
  if (pathname.includes('/multi-instructor')) {
    return contextAwareCTA.schoolPages;
  }
  
  // Default to homepage CTA
  return contextAwareCTA.homepage;
}

// ============================================================================
// MOBILE NAVIGATION CONFIGURATION
// ============================================================================

export const mobileNavConfig = {
  // Same structure as desktop, but sections expand vertically
  // Featured items still get icon + benefit treatment
  closeOnSelection: true,
  enableOverlay: true,
  stickyHeader: true,
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default publicNavigation;
