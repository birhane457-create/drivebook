import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle, Calendar, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VOICE_NUMBER = '+1 (708) 933-5601';

const slides = [
  { id: 'call',         title: 'Call Anytime - AI Answers 24/7',    desc: 'Our AI receptionist handles calls, checks availability, and books lessons instantly' },
  { id: 'conversation', title: 'Natural Conversation Flow',          desc: 'AI understands your needs and guides you through booking' },
  { id: 'confirmation', title: 'Instant Confirmation',               desc: 'Get SMS confirmation and calendar invite immediately' },
];

export default function AIReceptionistSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => setCurrentIndex((p) => (p + 1) % slides.length), 7000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const current = slides[currentIndex];

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-accent/3 to-background" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold mb-6 uppercase tracking-wider border border-pink-500/20">
              <Phone className="w-3.5 h-3.5" /> AI-Powered
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight mb-4 text-white">
              Book by Phone — <span className="bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">AI Answers 24/7</span>
            </h2>
            <p className="text-base text-white/70 mb-2">No app download required. Just call and book.</p>
            <p className="text-lg text-white/60 leading-relaxed mb-8">
              Our AI receptionist handles availability, booking, and SMS confirmation — any time of day.
            </p>
            <div className="space-y-4">
              {[
                'Instant answers to your questions about lessons and pricing',
                'Real-time availability check while on the call',
                'SMS confirmation sent to your phone immediately',
                'No app download required - just call and book',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right - Showcase card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative max-w-md mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-1">{current.title}</h3>
                  <p className="text-purple-100 text-sm">{current.desc}</p>
                </div>

                {/* Slide content */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-100 min-h-[280px] flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="w-full p-4 md:p-6"
                    >
                      {currentIndex === 0 && <CallStep />}
                      {currentIndex === 1 && <ConversationStep />}
                      {currentIndex === 2 && <ConfirmationStep />}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Nav dots */}
                <div className="p-4 flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`transition-all rounded-full ${
                          index === currentIndex ? 'w-12 h-3 bg-purple-600' : 'w-3 h-3 bg-gray-300 hover:bg-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{currentIndex + 1} of {slides.length}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CallStep() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <p className="font-semibold text-gray-800 text-sm mb-3">Prefer to Call?</p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li><strong>Instant answers</strong> to your questions about lessons and pricing</li>
          <li><strong>Real-time availability</strong> check while on the call</li>
          <li><strong>SMS confirmation</strong> sent to your phone immediately</li>
          <li><strong>No app download</strong> required - just call and book</li>
        </ul>
      </div>
      <div className="bg-purple-600 rounded-xl p-4 text-white text-center">
        <p className="text-xs mb-1">Prefer to call? Available 24/7</p>
        <p className="text-xl font-bold">{VOICE_NUMBER}</p>
        <p className="text-xs text-purple-200 mt-1">Available 24/7</p>
      </div>
      <p className="text-xs text-gray-500 text-center">Our AI assistant will help you find an instructor, check availability, and book your lesson - all in one call.</p>
    </div>
  );
}

function ConversationStep() {
  const messages = [
    { type: 'user', text: "Hi, I'd like to book a driving lesson" },
    { type: 'ai',   text: "Hello! I'd be happy to help you book a lesson. What's your location?" },
    { type: 'user', text: "I'm in Maylands, postcode 6051" },
    { type: 'ai',   text: "Great! I found 3 instructors who service Maylands. Would you prefer manual or automatic?" },
    { type: 'user', text: "Automatic please" },
    { type: 'ai',   text: "Perfect! Sarah J. has availability this week. She has a 4.9 rating and charges $45/hour. Would you like to book with her?" },
    { type: 'user', text: "Yes, that sounds good" },
    { type: 'ai',   text: "Excellent! What day and time works best for you?" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800">DriveBook AI Assistant</p>
          <p className="text-xs text-emerald-500">Online</p>
        </div>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.type === 'user' ? 'bg-purple-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmationStep() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <p className="font-semibold text-gray-800 text-sm">Booking Confirmed!</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">Your lesson has been successfully booked</p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-gray-600"><span>Date & Time</span><span className="font-medium text-gray-800">Thursday, March 14, 2026 at 2:00 PM</span></div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Instructor</span>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">S</div>
              <span className="font-medium text-gray-800">Sarah J.</span>
            </div>
          </div>
          <div className="flex justify-between text-gray-600"><span>Duration</span><span className="font-medium text-gray-800">1 hour - $45</span></div>
        </div>
      </div>
      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
        <p className="text-xs font-semibold text-emerald-700 mb-1">📱 SMS Sent!</p>
        <p className="text-xs text-emerald-600">Confirmation sent to your phone with lesson details and instructor contact information.</p>
      </div>
      <button className="w-full py-2 text-xs bg-purple-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2">
        <Calendar className="w-3.5 h-3.5" /> Add to Calendar
      </button>
    </div>
  );
}