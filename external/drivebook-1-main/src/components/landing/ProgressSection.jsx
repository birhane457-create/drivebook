import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  { id: 'dashboard',  title: 'Your Performance Dashboard', desc: 'See your overall score and progress at a glance' },
  { id: 'categories', title: 'Category Breakdown',          desc: 'Track your performance across 8 key driving skills' },
  { id: 'progress',   title: 'Progress Over Time',          desc: 'Watch your skills improve from first lesson to test day' },
];

const categories = [
  { name: 'Signal',            score: 90, color: 'bg-green-500' },
  { name: 'Look Behind',       score: 85, color: 'bg-green-500' },
  { name: 'Movement',          score: 80, color: 'bg-green-500' },
  { name: 'Path',              score: 88, color: 'bg-green-500' },
  { name: 'Vehicle Management',score: 75, color: 'bg-yellow-500' },
  { name: 'Responsiveness',    score: 92, color: 'bg-green-500' },
  { name: 'Flow',              score: 78, color: 'bg-yellow-500' },
  { name: 'Overall',           score: 85, color: 'bg-green-500' },
];

const lessonData = [
  { lesson: 1, score: 60 }, { lesson: 2, score: 62 }, { lesson: 3, score: 65 },
  { lesson: 4, score: 68 }, { lesson: 5, score: 70 }, { lesson: 6, score: 73 },
  { lesson: 7, score: 75 }, { lesson: 8, score: 78 }, { lesson: 9, score: 80 },
  { lesson: 10, score: 82 }, { lesson: 11, score: 84 }, { lesson: 12, score: 85 },
];

export default function ProgressSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => setCurrentIndex((p) => (p + 1) % slides.length), 7000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (i) => { setCurrentIndex(i); setIsAutoPlaying(false); setTimeout(() => setIsAutoPlaying(true), 10000); };
  const nextSlide = () => goToSlide((currentIndex + 1) % slides.length);
  const prevSlide = () => goToSlide((currentIndex - 1 + slides.length) % slides.length);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) nextSlide();
    if (diff < -50) prevSlide();
  };

  const current = slides[currentIndex];

  return (
    <section className="py-24 md:py-32 relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/3 to-background" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold mb-6 uppercase tracking-wider border border-violet-500/20">
              <TrendingUp className="w-3.5 h-3.5" /> Progress Tracking
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight mb-4 text-white">Track Your Progress</h2>
            <p className="text-lg text-white/70 mb-2">See exactly where you stand and what to improve</p>
            <p className="text-base text-white/60 leading-relaxed mb-4">
              After every lesson, your instructor logs your performance directly into DriveBook — giving you personalised feedback on exactly what to work on next.
            </p>
            <p className="text-sm text-white/40 italic">
              Scores are based on your instructor's observations and are a learning guide only. Always follow your instructor's advice on test readiness — DriveBook does not certify when you are ready to sit your test.
            </p>
          </motion.div>

          {/* Right — showcase card */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div
              className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl overflow-hidden border border-gray-200"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Gradient header bar */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-800 text-white p-4 md:p-6">
                <h3 className="text-xl md:text-2xl font-bold mb-1">{current.title}</h3>
                <p className="text-indigo-100 text-sm md:text-base">{current.desc}</p>
              </div>

              {/* Light panel */}
              <div className="p-4 md:p-8 bg-gradient-to-br from-indigo-50 to-purple-100 min-h-[300px] md:min-h-[360px] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
                  >
                    {currentIndex === 0 && <DashboardStep />}
                    {currentIndex === 1 && <CategoriesStep />}
                    {currentIndex === 2 && <ProgressStep />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Nav dots */}
            <div className="flex flex-col items-center gap-3 mt-6">
              <div className="flex justify-center gap-2 md:gap-3">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`transition-all rounded-full ${
                      i === currentIndex ? 'w-10 md:w-12 h-2.5 md:h-3 bg-violet-400' : 'w-2.5 md:w-3 h-2.5 md:h-3 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={prevSlide} className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden">
                  <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>
                <span className="text-sm text-white/60">{currentIndex + 1} / {slides.length}</span>
                <button onClick={nextSlide} className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden">
                  <ChevronRight className="w-5 h-5 text-white/60" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DashboardStep() {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
      <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-indigo-100 text-center">
        <p className="text-5xl font-extrabold text-indigo-600">85</p>
        <p className="text-sm font-semibold text-gray-600 mt-1">Overall Score</p>
        <p className="text-xs text-emerald-600 font-bold mt-1">✓ Test Ready!</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 text-center">
        <p className="text-2xl font-extrabold text-gray-900">12</p>
        <p className="text-xs text-gray-500">Lessons Completed</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 text-center">
        <p className="text-2xl font-extrabold text-emerald-600">+25</p>
        <p className="text-xs text-gray-500">Points Improved</p>
      </div>
      <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 text-center">
        <p className="text-2xl font-extrabold text-amber-500">3</p>
        <p className="text-xs text-gray-500">Areas to Focus</p>
      </div>
    </div>
  );
}

function CategoriesStep() {
  return (
    <div className="max-w-sm mx-auto space-y-1">
      <p className="text-sm font-bold text-gray-800 mb-3 text-center">Performance by Category</p>
      {categories.map((cat) => (
        <div key={cat.name} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-28 text-right flex-shrink-0">{cat.name}</span>
          <div className="flex-1 h-2.5 bg-white/70 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${cat.score}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className={`h-full rounded-full ${cat.color}`}
            />
          </div>
          <span className="text-xs font-bold text-gray-800 w-8">{cat.score}</span>
        </div>
      ))}
      <div className="mt-3 bg-white/80 rounded-xl p-3 border border-indigo-100">
        <p className="text-xs font-semibold text-gray-700 mb-1">💡 Areas to Focus On</p>
        <p className="text-xs text-gray-600">• <strong>Vehicle Management (75)</strong> - Practice smooth gear changes</p>
        <p className="text-xs text-gray-600">• <strong>Flow (78)</strong> - Work on coordinating all skills together</p>
      </div>
    </div>
  );
}

function ProgressStep() {
  const points = lessonData.map((l, i) => ({
    x: (i / (lessonData.length - 1)) * 260,
    y: 100 - l.score,
    score: l.score,
    lesson: l.lesson,
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="max-w-xs mx-auto">
      <p className="text-sm font-bold text-gray-800 mb-3 text-center">Your Journey to Test Ready</p>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100">
        <svg viewBox="0 0 280 120" className="w-full">
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {/* Test ready line */}
          <line x1="0" y1="20" x2="280" y2="20" stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          <text x="5" y="16" fontSize="7" fill="#10b981" opacity="0.9">Test Ready (80+)</text>
          <polyline points={polyline} fill="none" stroke="url(#progressGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" />
          ))}
        </svg>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Lesson 1 · 60</span>
          <span>Lesson 6</span>
          <span>Lesson 12 · 85 ✓</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { label: 'Lesson 1', sub: 'Started journey - Score: 60' },
          { label: 'Lesson 6', sub: 'Parallel parking mastered' },
          { label: 'Lesson 12', sub: 'Test Ready! Score: 85' },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
            <span className="font-semibold text-gray-700">{m.label}</span>
            <span className="text-gray-500">{m.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}