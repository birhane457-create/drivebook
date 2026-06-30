'use client'

import { BookOpen, Calendar, Clock, AlertCircle, CheckCircle, Info } from 'lucide-react'
import Link from 'next/link'

export default function HelpCenterPage() {
  return (
          <div className="max-w-4xl mx-auto px-1 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Help Center</h1>
          <p className="text-slate-400">Learn how to use DriveBook effectively</p>
        </div>

        {/* Google Calendar Sync */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-0 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-6 w-6 text-sky-400" />
            <h2 className="text-2xl font-bold text-slate-100">Google Calendar Integration</h2>
          </div>

          <div className="space-y-6">
            {/* How It Works */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-100">
                <Info className="h-5 w-5 text-sky-400" />
                How It Works
              </h3>
              <div className="bg-sky-900/20 border border-sky-700/40 rounded-lg p-4 space-y-2 text-sm text-sky-300">
                <p><strong className="text-sky-200">2-Way Sync:</strong> Events sync between DriveBook and Google Calendar</p>
                <p>✅ Bookings created in DriveBook → Appear in Google Calendar</p>
                <p>✅ Events created in Google Calendar → Block booking slots in DriveBook</p>
                <p>✅ Cancelled bookings → Removed from Google Calendar</p>
              </div>
            </div>

            {/* Event Types */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-100">
                <BookOpen className="h-5 w-5 text-green-400" />
                Event Types &amp; Keywords
              </h3>

              <div className="bg-amber-900/30 border-2 border-amber-600/50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-amber-300 mb-2">⚠️ IMPORTANT: Driving Keywords Required</p>
                <p className="text-sm text-amber-400">
                  To prevent personal reminders from blocking booking slots, events MUST contain at least one driving-related keyword.
                </p>
              </div>

              <div className="space-y-4">
                {/* Driving Keywords */}
                <div className="border-2 border-green-700/50 rounded-lg p-4 bg-green-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-green-500 rounded-full" />
                    <h4 className="font-semibold text-green-300">Driving-Related Keywords (Required)</h4>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Include AT LEAST ONE of these keywords to sync the event:</p>
                  <div className="bg-slate-950 rounded p-3 space-y-1 text-sm font-mono text-slate-300">
                    <p>• &quot;Lesson&quot;</p>
                    <p>• &quot;Driving&quot;</p>
                    <p>• &quot;PDA&quot;</p>
                    <p>• &quot;Test&quot;</p>
                    <p>• &quot;Student&quot;</p>
                    <p>• &quot;Client&quot;</p>
                    <p>• &quot;Pickup&quot;</p>
                    <p>• &quot;Practice&quot;</p>
                    <p>• &quot;Training&quot;</p>
                    <p>• &quot;Instruction&quot;</p>
                  </div>
                  <div className="mt-3 bg-green-900/30 border border-green-700/40 rounded p-3 text-sm text-green-300">
                    <strong>✅ Examples:</strong> &quot;John - Lesson&quot;, &quot;Driving with Sarah&quot;, &quot;Student Pickup&quot;, &quot;Practice Session&quot;
                  </div>
                  <div className="mt-2 bg-red-900/20 border border-red-700/40 rounded p-3 text-sm text-red-300">
                    <strong>❌ Will NOT sync:</strong> &quot;Doctor Appointment&quot;, &quot;Buy Groceries&quot;, &quot;Meeting&quot;, &quot;Lunch&quot;
                  </div>
                </div>

                {/* Regular Lessons */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-950">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-sky-500 rounded-full" />
                    <h4 className="font-semibold text-slate-100">Regular Driving Lessons</h4>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Use driving keywords WITHOUT PDA keywords:</p>
                  <div className="bg-slate-900 rounded p-3 space-y-1 text-sm font-mono text-slate-300">
                    <p>• &quot;Driving Lesson - John&quot;</p>
                    <p>• &quot;Student Pickup - Sarah&quot;</p>
                    <p>• &quot;Practice Session&quot;</p>
                    <p>• &quot;Client Training&quot;</p>
                  </div>
                  <div className="mt-3 bg-green-900/20 border border-green-700/40 rounded p-3 text-sm text-green-300">
                    <strong>Blocking:</strong> Blocks exact event time only
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    <strong className="text-slate-300">Example:</strong> Event 2:00-3:00 PM → Blocks 2:00-3:00 PM
                  </div>
                </div>

                {/* PDA Tests */}
                <div className="border border-orange-700/50 rounded-lg p-4 bg-orange-900/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-orange-500 rounded-full" />
                    <h4 className="font-semibold text-orange-300">PDA Tests (Extended Blocking)</h4>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Include ANY of these PDA keywords:</p>
                  <div className="bg-slate-950 rounded p-3 space-y-1 text-sm font-mono text-slate-300">
                    <p>• &quot;PDA Test&quot;</p>
                    <p>• &quot;Driving Test&quot;</p>
                    <p>• &quot;Practical Test&quot;</p>
                    <p>• &quot;Assessment&quot;</p>
                    <p>• &quot;Examination&quot;</p>
                    <p>• &quot;Test Center&quot;</p>
                    <p>• &quot;Licensing Center&quot;</p>
                  </div>
                  <div className="mt-3 bg-orange-900/30 border border-orange-700/40 rounded p-3 text-sm text-orange-300">
                    <strong>⚠️ Extended Blocking:</strong> Blocks 2 hours BEFORE + 1 hour AFTER
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    <strong className="text-slate-300">Example:</strong> Test 10:00-11:00 AM → Blocks 8:00 AM - 12:00 PM
                  </div>
                  <div className="mt-2 bg-amber-900/20 border border-amber-700/40 rounded p-2 text-xs text-amber-400">
                    <strong>Why?</strong> Gives you prep time before and debrief time after the test
                  </div>
                </div>
              </div>
            </div>

            {/* Step by Step Guide */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-100">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Step-by-Step Guide
              </h3>
              <div className="space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-slate-100">📅 Scenario 1: Manual Booking in Google Calendar</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                    <li>Open Google Calendar</li>
                    <li>Create new event with client name (e.g., &quot;John Smith - Lesson&quot;)</li>
                    <li>Set date and time (e.g., Tomorrow 2:00-3:00 PM)</li>
                    <li>Add client phone/address in description (optional)</li>
                    <li>Save event</li>
                    <li>Go to DriveBook → Settings → Click &quot;Sync Now&quot;</li>
                    <li className="text-green-400">✅ That time slot is now blocked for online bookings</li>
                  </ol>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-slate-100">🚗 Scenario 2: PDA Test Scheduled</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                    <li>Open Google Calendar</li>
                    <li>Create event: &quot;PDA Test - Sarah Johnson&quot;</li>
                    <li>Set test time (e.g., Feb 25, 10:00-11:00 AM)</li>
                    <li>Add test center address in location</li>
                    <li>Save event</li>
                    <li>Go to DriveBook → Settings → Click &quot;Sync Now&quot;</li>
                    <li className="text-green-400">✅ System blocks 8:00 AM - 12:00 PM (2 hours before + 1 hour after)</li>
                  </ol>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-slate-100">💻 Scenario 3: Client Books Online</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                    <li>Client visits your booking page</li>
                    <li>Selects date, time, and enters details</li>
                    <li>Confirms booking</li>
                    <li className="text-green-400">✅ Booking appears in DriveBook dashboard</li>
                    <li className="text-green-400">✅ Event automatically created in your Google Calendar</li>
                    <li className="text-green-400">✅ You receive email notification</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-100">
                <AlertCircle className="h-5 w-5 text-red-400" />
                Important Notes
              </h3>
              <div className="space-y-3">
                <div className="bg-violet-900/20 border border-violet-700/40 rounded-lg p-3 text-sm text-violet-300">
                  <strong>🚗 Travel Time Buffer:</strong> The system automatically adds travel time between bookings. If you finish a lesson at one location and the next student is 10 minutes away, that travel time is blocked so the next student gets their full lesson time.
                </div>
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-sm text-amber-300">
                  <strong>⏰ All-Day Events:</strong> All-day events are ignored. Only events with specific start/end times are synced.
                </div>
                <div className="bg-sky-900/20 border border-sky-700/40 rounded-lg p-3 text-sm text-sky-300">
                  <strong>🔄 Sync Frequency:</strong> Automatic sync runs every hour. Click &quot;Sync Now&quot; for immediate sync.
                </div>
                <div className="bg-violet-900/20 border border-violet-700/40 rounded-lg p-3 text-sm text-violet-300">
                  <strong>🔒 Privacy:</strong> We only read/write calendar events. We never access your emails or other Google services.
                </div>
                <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-sm text-red-300">
                  <strong>⚠️ Case Insensitive:</strong> Keywords work in any case — &quot;PDA Test&quot;, &quot;pda test&quot;, &quot;PDA TEST&quot; all work the same.
                </div>
              </div>
            </div>

            {/* Quick Reference */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-100">
                <Clock className="h-5 w-5 text-violet-400" />
                Quick Reference Card
              </h3>
              <div className="border-2 border-violet-700/50 rounded-lg p-4 bg-violet-900/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-violet-700/40">
                      <th className="text-left py-2 font-semibold text-slate-200">Event Type</th>
                      <th className="text-left py-2 font-semibold text-slate-200">Required Keywords</th>
                      <th className="text-left py-2 font-semibold text-slate-200">Blocking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-violet-800/30">
                      <td className="py-2 text-slate-300">Regular Lesson</td>
                      <td className="py-2 font-mono text-xs text-slate-400">Driving keyword (no PDA)</td>
                      <td className="py-2 text-slate-300">Exact time</td>
                    </tr>
                    <tr className="border-b border-violet-800/30">
                      <td className="py-2 text-slate-300">PDA Test</td>
                      <td className="py-2 font-mono text-xs text-slate-400">Driving + PDA keyword</td>
                      <td className="py-2 text-slate-300">-2h to +1h</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-300">Personal</td>
                      <td className="py-2 font-mono text-xs text-slate-400">No driving keywords</td>
                      <td className="py-2 text-slate-400">Not synced</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t border-violet-700/40 text-xs">
                  <p className="font-semibold mb-2 text-slate-200">Driving Keywords:</p>
                  <p className="text-violet-300">Lesson, Driving, PDA, Test, Student, Client, Pickup, Practice, Training, Instruction</p>
                </div>
              </div>
            </div>

            {/* Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-slate-100">✅ Good Examples</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-green-900/20 border border-green-700/40 rounded p-3 text-green-300">
                  <strong>Regular Lesson:</strong> &quot;John Smith - Driving Lesson&quot; → Syncs &amp; blocks exact time
                </div>
                <div className="bg-orange-900/20 border border-orange-700/40 rounded p-3 text-orange-300">
                  <strong>PDA Test:</strong> &quot;Sarah - PDA Test at Licensing Center&quot; → Syncs &amp; blocks -2h to +1h
                </div>
                <div className="bg-sky-900/20 border border-sky-700/40 rounded p-3 text-sky-300">
                  <strong>Practice:</strong> &quot;Student Practice Session&quot; → Syncs &amp; blocks exact time
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3 mt-6 text-slate-100">❌ Will NOT Sync (No Driving Keywords)</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-slate-800 border border-slate-700 rounded p-3 text-slate-400">
                  <strong className="text-slate-300">Personal:</strong> &quot;Doctor Appointment&quot; → Not synced (no driving keyword)
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-3 text-slate-400">
                  <strong className="text-slate-300">Reminder:</strong> &quot;Buy Groceries&quot; → Not synced (no driving keyword)
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-3 text-slate-400">
                  <strong className="text-slate-300">Meeting:</strong> &quot;Lunch with Friend&quot; → Not synced (no driving keyword)
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-slate-100">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div>
                  <p className="font-semibold text-slate-200">Q: Event not blocking slots?</p>
                  <p className="text-slate-400 ml-4">→ Click &quot;Sync Now&quot; in Settings. Check event has specific times (not all-day).</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Q: PDA test not getting extended buffer?</p>
                  <p className="text-slate-400 ml-4">→ Make sure title/description contains one of the PDA keywords.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Q: Booking not appearing in Google Calendar?</p>
                  <p className="text-slate-400 ml-4">→ Check &quot;Connected to Google Calendar&quot; in Settings. May need to reconnect.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-3xl p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
          <p className="text-white/80 mb-4">Contact support or check your settings</p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      </div>
  
  )
}
