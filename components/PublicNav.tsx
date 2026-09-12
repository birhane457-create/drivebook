'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import FeaturedNavItem, { FeaturedNavItemCompact } from '@/components/FeaturedNavItem';
import { Menu, X, ChevronDown } from 'lucide-react';
import {
  learnerNav,
  businessNav,
  resourcesNav,
  aboutLink,
  utilityNav,
  isFeaturedItem,
  getContextAwareCTA,
  type NavItem,
  type FeaturedNavItem as FeaturedNavItemType,
  type NavSection,
  type MegaMenu,
  type Dropdown,
} from '@/lib/navigation-data';

// ============================================================================
// DESKTOP MEGA-MENU COMPONENT
// ============================================================================

interface MegaMenuPanelProps {
  config: MegaMenu;
  onClose: () => void;
}

function MegaMenuPanel({ config, onClose }: MegaMenuPanelProps) {
  const { sections, footer, layout } = config.megaMenu;
  const isThreeColumn = layout === 'three-column';

  return (
    <div
      className={`absolute top-full left-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 ${
        isThreeColumn ? 'w-[900px]' : 'w-80'
      }`}
    >
      {/* Sections */}
      <div className={`${isThreeColumn ? 'grid grid-cols-3' : 'block'} p-4 gap-6`}>
        {sections.map((section, idx) => (
          <div key={idx} className={isThreeColumn ? '' : 'mb-6 last:mb-0'}>
            {/* Section Title */}
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              {section.title}
            </div>

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item, itemIdx) => {
                if (isFeaturedItem(item)) {
                  return (
                    <FeaturedNavItem
                      key={itemIdx}
                      label={item.label}
                      href={item.href}
                      icon={item.icon}
                      benefit={item.benefit}
                      onClick={onClose}
                    />
                  );
                }

                return (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    onClick={onClose}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-secondary/80 rounded-lg transition-colors no-underline font-medium hover:text-violet-600"
                  >
                    {item.label}
                    {item.primary && (
                      <span className="ml-2 text-xs text-violet-600 font-bold">★</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer (for B2B menu) */}
      {footer && (
        <div className="border-t border-border px-6 py-4 bg-secondary/30">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            {footer.title}
          </div>
          <div className="flex flex-wrap gap-4">
            {footer.items.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                onClick={onClose}
                className="text-sm text-foreground hover:text-violet-600 transition-colors no-underline font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DESKTOP DROPDOWN COMPONENT
// ============================================================================

interface DropdownPanelProps {
  config: Dropdown;
  onClose: () => void;
}

function DropdownPanel({ config, onClose }: DropdownPanelProps) {
  const { sections } = config.dropdown;

  return (
    <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 py-2">
      {sections.map((section, idx) => (
        <div key={idx} className="px-3 py-2">
          {/* Section Title */}
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
            {section.title}
          </div>

          {/* Section Items */}
          {section.items.map((item, itemIdx) => (
            <Link
              key={itemIdx}
              href={item.href}
              onClick={onClose}
              className="block px-3 py-2 text-sm text-foreground hover:bg-secondary/80 rounded-lg transition-colors no-underline font-medium hover:text-violet-600"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// DESKTOP NAVIGATION TRIGGER
// ============================================================================

interface NavTriggerProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}

function NavTrigger({ label, isOpen, onToggle }: NavTriggerProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 text-gray-700 hover:text-foreground font-medium px-3 py-2 rounded-lg hover:bg-secondary/80 transition-all text-sm"
    >
      {label}
      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

// ============================================================================
// MOBILE SECTION COMPONENT
// ============================================================================

interface MobileSectionProps {
  title: string;
  items: (NavItem | FeaturedNavItemType)[];
  onClose: () => void;
}

function MobileSection({ title, items, onClose }: MobileSectionProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => {
          if (isFeaturedItem(item)) {
            return (
              <FeaturedNavItemCompact
                key={idx}
                label={item.label}
                href={item.href}
                icon={item.icon}
                benefit={item.benefit}
                onClick={onClose}
              />
            );
          }

          return (
            <Link
              key={idx}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 text-gray-700 hover:text-foreground no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-secondary/80 transition-colors text-sm"
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PUBLIC NAV COMPONENT
// ============================================================================

interface PublicNavProps {
  className?: string;
}

export default function PublicNav({ className = '' }: PublicNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pathname = usePathname();
  
  // Refs for click-outside detection
  const learnerMenuRef = useRef<HTMLDivElement>(null);
  const businessMenuRef = useRef<HTMLDivElement>(null);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);

  // Get context-aware CTA
  const ctaConfig = getContextAwareCTA(pathname);

  // Handle scroll for sticky header effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle window resize - close mobile menu on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      if (
        learnerMenuRef.current && !learnerMenuRef.current.contains(target) &&
        businessMenuRef.current && !businessMenuRef.current.contains(target) &&
        resourcesMenuRef.current && !resourcesMenuRef.current.contains(target)
      ) {
        setOpenMenu(null);
      }
    }

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenu]);

  const handleMenuToggle = (key: string) => {
    setOpenMenu(openMenu === key ? null : key);
  };

  const handleMenuClose = () => {
    setOpenMenu(null);
  };

  const handleMobileClose = () => {
    setMenuOpen(false);
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-background/80 backdrop-blur-xl border-b border-border/50'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline group">
          <Logo size={36} />
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-1">
          {/* Find an Instructor (Learner Mega-Menu) */}
          <div className="relative" ref={learnerMenuRef}>
            <NavTrigger
              label={learnerNav.label}
              isOpen={openMenu === 'learner'}
              onToggle={() => handleMenuToggle('learner')}
            />
            {openMenu === 'learner' && (
              <MegaMenuPanel config={learnerNav} onClose={handleMenuClose} />
            )}
          </div>

          {/* For Instructors & Schools (B2B Mega-Menu) */}
          <div className="relative" ref={businessMenuRef}>
            <NavTrigger
              label={businessNav.label}
              isOpen={openMenu === 'business'}
              onToggle={() => handleMenuToggle('business')}
            />
            {openMenu === 'business' && (
              <MegaMenuPanel config={businessNav} onClose={handleMenuClose} />
            )}
          </div>

          {/* Resources (Simple Dropdown) */}
          <div className="relative" ref={resourcesMenuRef}>
            <NavTrigger
              label={resourcesNav.label}
              isOpen={openMenu === 'resources'}
              onToggle={() => handleMenuToggle('resources')}
            />
            {openMenu === 'resources' && (
              <DropdownPanel config={resourcesNav} onClose={handleMenuClose} />
            )}
          </div>

          {/* About (Direct Link) */}
          <Link
            href={aboutLink.href}
            className="text-gray-700 hover:text-foreground no-underline font-medium px-3 py-2 rounded-lg hover:bg-secondary/80 transition-all text-sm"
          >
            {aboutLink.label}
          </Link>

          {/* Divider */}
          <div className="w-px h-5 bg-secondary mx-2" />

          {/* Login */}
          <Link
            href={utilityNav.login.href}
            className="text-gray-700 hover:text-foreground no-underline font-medium px-3 py-2 rounded-lg hover:bg-secondary/80 transition-all text-sm"
          >
            {utilityNav.login.label}
          </Link>

          {/* Get Started (Context-Aware) */}
          <Link
            href={ctaConfig.href}
            className="ml-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2 rounded-xl no-underline text-sm font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:from-violet-500 hover:to-purple-500 transition-all"
          >
            {ctaConfig.label}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-foreground hover:bg-secondary/80 transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto">
          {/* Learner Sections */}
          {learnerNav.megaMenu.sections.map((section, idx) => (
            <MobileSection
              key={idx}
              title={section.title}
              items={section.items}
              onClose={handleMobileClose}
            />
          ))}

          <div className="h-px bg-secondary my-4" />

          {/* Business Sections */}
          <div className="text-xs font-bold text-foreground uppercase tracking-wider px-3 py-2 mb-2">
            {businessNav.label}
          </div>
          {businessNav.megaMenu.sections.map((section, idx) => (
            <MobileSection
              key={idx}
              title={section.title}
              items={section.items}
              onClose={handleMobileClose}
            />
          ))}

          {/* Business Footer */}
          {businessNav.megaMenu.footer && (
            <div className="mb-4 px-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                {businessNav.megaMenu.footer.title}
              </div>
              <div className="space-y-1">
                {businessNav.megaMenu.footer.items.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={handleMobileClose}
                    className="block text-sm text-foreground hover:text-violet-600 py-1.5 no-underline font-medium"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-secondary my-4" />

          {/* Resources */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
              {resourcesNav.label}
            </div>
            {resourcesNav.dropdown.sections.map((section, idx) => (
              <div key={idx} className="mb-3">
                <div className="text-xs font-medium text-muted-foreground px-3 py-1">
                  {section.title}
                </div>
                {section.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    onClick={handleMobileClose}
                    className="block text-sm text-gray-700 hover:text-foreground py-2 px-3 rounded-lg hover:bg-secondary/80 transition-colors no-underline font-medium"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* About */}
          <div className="h-px bg-secondary my-2" />
          <Link
            href={aboutLink.href}
            onClick={handleMobileClose}
            className="block text-gray-700 hover:text-foreground no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-secondary/80 transition-colors text-sm"
          >
            {aboutLink.label}
          </Link>

          {/* Login */}
          <Link
            href={utilityNav.login.href}
            onClick={handleMobileClose}
            className="block text-gray-700 hover:text-foreground no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-secondary/80 transition-colors text-sm"
          >
            {utilityNav.login.label}
          </Link>

          {/* Get Started */}
          <Link
            href={ctaConfig.href}
            onClick={handleMobileClose}
            className="block bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-3 rounded-lg no-underline font-bold text-center text-sm shadow-lg shadow-purple-500/30 mt-2"
          >
            {ctaConfig.label}
          </Link>
        </div>
      )}
    </nav>
  );
}
