import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How do I know an instructor is qualified?",
    a: "All instructors must provide valid credentials and undergo background checks. You can also read reviews from real students before booking.",
  },
  {
    q: "Can I cancel or reschedule my lesson?",
    a: "Yes! You can cancel or reschedule through your dashboard. Each instructor's cancellation policy is clearly shown on their profile.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit/debit cards and process payments securely through Stripe.",
  },
  {
    q: "How do bulk packages work?",
    a: "Purchase 5, 10, or 20-hour packages at a discounted rate. Hours are added to your account and you can book lessons as needed.",
  },
  {
    q: "Can I choose my own instructor?",
    a: "Absolutely! Browse instructor profiles, read reviews, check their availability, and choose the one that's right for you.",
  },
  {
    q: "What if I need to contact my instructor?",
    a: "You can message your instructor directly through the platform, or call our AI receptionist 24/7 for immediate assistance.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="bg-white/5 rounded-2xl border border-white/10 px-6 overflow-hidden data-[state=open]:shadow-lg data-[state=open]:border-violet-500/30 data-[state=open]:bg-white/8 transition-all duration-300"
              >
                <AccordionTrigger className="text-left font-display font-semibold text-sm md:text-base py-5 hover:no-underline text-white hover:text-violet-300 transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-white/50 leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}