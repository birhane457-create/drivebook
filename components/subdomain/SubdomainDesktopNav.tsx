'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface Props {
  primary: string;
  hasBio: boolean;
}

function scrollTo(id: string) {
  // If the target doesn't exist, fall back to section-services
  const el = document.getElementById(id) || document.getElementById('section-services');
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

export default function SubdomainDesktopNav({ primary, hasBio }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for browsers that block clipboard
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="hidden md:flex items-center gap-1">
      {hasBio && (
        <button
          onClick={() => scrollTo('section-about')}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          About
        </button>
      )}
      <button
        onClick={() => scrollTo('section-services')}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
      >
        Services
      </button>
      <button
        onClick={() => scrollTo('section-contact')}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
      >
        Contact
      </button>
      <button
        onClick={handleShare}
        title="Copy booking link"
        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
      </button>
      <button
        onClick={() => scrollTo('booking-form')}
        className="ml-1 px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        Book Now
      </button>
    </div>
  );
}
