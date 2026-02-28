'use client';

import React from 'react';
import { HelpCircle, Mail, Phone, MessageCircle, BookOpen, CreditCard, Calendar } from 'lucide-react';

export default function ClientHelpPage() {
  const faqs = [
    {
      question: 'How do I book a lesson?',
      answer: 'Click the "Book Lesson" button in the navigation, search for instructors in your area, select your preferred instructor, choose a package or single lesson, and complete the payment.',
    },
    {
      question: 'How do I add credits to my wallet?',
      answer: 'Go to the Wallet page and click "Add More Credits". You can purchase lesson packages or add custom amounts to your wallet balance.',
    },
    {
      question: 'Can I reschedule a lesson?',
      answer: 'Yes! Go to My Bookings, find the lesson you want to reschedule, and click the "Reschedule" button. Note that rescheduling policies may vary by instructor.',
    },
    {
      question: 'How do I cancel a booking?',
      answer: 'Go to My Bookings, find the lesson, and click "Cancel". Cancellation fees may apply depending on how far in advance you cancel.',
    },
    {
      question: 'When will I receive a refund?',
      answer: 'Refunds are processed within 5-7 business days and will be credited back to your original payment method or wallet balance.',
    },
    {
      question: 'How do I leave a review?',
      answer: 'After completing a lesson, go to the Reviews page where you\'ll see pending reviews. Click "Write Review" to rate your instructor and share your experience.',
    },
  ];

  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get help via email',
      contact: 'support@drivebook.com',
      action: 'mailto:support@drivebook.com',
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'Call us for immediate help',
      contact: '1-800-DRIVE-BOOK',
      action: 'tel:1-800-374-8326',
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our support team',
      contact: 'Available 9 AM - 6 PM',
      action: '#',
    },
  ];

  const quickLinks = [
    { icon: BookOpen, title: 'Book a Lesson', href: '/book' },
    { icon: CreditCard, title: 'Manage Wallet', href: '/client-dashboard/wallet' },
    { icon: Calendar, title: 'My Bookings', href: '/client-dashboard/bookings' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <HelpCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">How Can We Help?</h1>
        <p className="text-lg text-gray-600">Find answers to common questions or get in touch with our support team</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.title}
              href={link.href}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-center"
            >
              <Icon className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900">{link.title}</h3>
            </a>
          );
        })}
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Methods */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Contact Support</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactMethods.map((method) => {
            const Icon = method.icon;
            return (
              <a
                key={method.title}
                href={method.action}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-center"
              >
                <Icon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">{method.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{method.description}</p>
                <p className="text-blue-600 font-semibold">{method.contact}</p>
              </a>
            );
          })}
        </div>
      </div>

      {/* Additional Resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Need More Help?</h2>
        <p className="text-gray-700 mb-6">
          Our support team is here to help you with any questions or issues you may have.
        </p>
        <a
          href="mailto:support@drivebook.com"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          <Mail className="w-5 h-5" />
          Email Support
        </a>
      </div>
    </div>
  );
}
