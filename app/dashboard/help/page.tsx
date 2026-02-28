'use client'

import { BookOpen, Calendar, Clock, AlertCircle, CheckCircle, Info } from 'lucide-react'

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-gray-600">Learn how to use DriveBook effectively</p>
        </div>

        {/* Google Calendar Sync */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Google Calendar Integration</h2>
          </div>

          <div className="space-y-6">
            {/* How It Works */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                How It Works
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>2-Way Sync:</strong> Events sync between DriveBook and Google Calendar</p>
                <p>✅ Bookings created in DriveBook → Appear in Google Calendar</p>
                <p>✅ Events created in Google Calendar → Block booking slots in DriveBook</p>
                <p>✅ Cancelled bookings → Removed from Google Calendar</p>
              </div>
            </div>

            {/* Event Types */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                Event Types & Keywords
              </h3>
              
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ IMPORTANT: Driving Keywords Required</p>
                <p className="text-sm text-yellow-800">
                  To prevent personal reminders from blocking booking slots, events MUST contain at least one driving-related keyword.
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Driving Keywords */}
                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <h4 className="font-semibold text-green-900">Driving-Related Keywords (Required)</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Include AT LEAST ONE of these keywords to sync the event:
                  </p>
                  <div className="bg-white rounded p-3 space-y-1 text-sm font-mono">
                    <p>• "Lesson"</p>
                    <p>• "Driving"</p>
                    <p>• "PDA"</p>
                    <p>• "Test"</p>
                    <p>• "Student"</p>
                    <p>• "Client"</p>
                    <p>• "Pickup"</p>
                    <p>• "Practice"</p>
                    <p>• "Training"</p>
                    <p>• "Instruction"</p>
                  </div>
                  <div className="mt-3 bg-green-100 border border-green-300 rounded p-3 text-sm">
                    <strong>✅ Examples:</strong> "John - Lesson", "Driving with Sarah", "Student Pickup", "Practice Session"
                  </div>
                  <div className="mt-2 bg-red-50 border border-red-200 rounded p-3 text-sm">
                    <strong>❌ Will NOT sync:</strong> "Doctor Appointment", "Buy Groceries", "Meeting", "Lunch"
                  </div>
                </div>

                {/* Regular Lessons */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                    <h4 className="font-semibold">Regular Driving Lessons</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Use driving keywords WITHOUT PDA keywords:
                  </p>
                  <div className="bg-gray-50 rounded p-3 space-y-1 text-sm font-mono">
                    <p>• "Driving Lesson - John"</p>
                    <p>• "Student Pickup - Sarah"</p>
                    <p>• "Practice Session"</p>
                    <p>• "Client Training"</p>
                  </div>
                  <div className="mt-3 bg-green-50 border border-green-200 rounded p-3 text-sm">
                    <strong>Blocking:</strong> Blocks exact event time only
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <strong>Example:</strong> Event 2:00-3:00 PM → Blocks 2:00-3:00 PM
                  </div>
                </div>

                {/* PDA Tests */}
                <div className="border rounded-lg p-4 border-orange-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 bg-orange-500 rounded-full"></div>
                    <h4 className="font-semibold text-orange-900">PDA Tests (Extended Blocking)</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Include ANY of these PDA keywords:
                  </p>
                  <div className="bg-orange-50 rounded p-3 space-y-1 text-sm font-mono">
                    <p>• "PDA Test"</p>
                    <p>• "Driving Test"</p>
                    <p>• "Practical Test"</p>
                    <p>• "Assessment"</p>
                    <p>• "Examination"</p>
                    <p>• "Test Center"</p>
                    <p>• "Licensing Center"</p>
                  </div>
                  <div className="mt-3 bg-orange-100 border border-orange-300 rounded p-3 text-sm">
                    <strong>⚠️ Extended Blocking:</strong> Blocks 2 hours BEFORE + 1 hour AFTER
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <strong>Example:</strong> Test 10:00-11:00 AM → Blocks 8:00 AM - 12:00 PM
                  </div>
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                    <strong>Why?</strong> Gives you prep time before and debrief time after the test
                  </div>
                </div>
              </div>
            </div>

            {/* Step by Step Guide */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Step-by-Step Guide
              </h3>

              <div className="space-y-4">
                {/* Scenario 1 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">📅 Scenario 1: Manual Booking in Google Calendar</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open Google Calendar</li>
                    <li>Create new event with client name (e.g., "John Smith - Lesson")</li>
                    <li>Set date and time (e.g., Tomorrow 2:00-3:00 PM)</li>
                    <li>Add client phone/address in description (optional)</li>
                    <li>Save event</li>
                    <li>Go to DriveBook → Settings → Click "Sync Now"</li>
                    <li>✅ That time slot is now blocked for online bookings</li>
                  </ol>
                </div>

                {/* Scenario 2 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">🚗 Scenario 2: PDA Test Scheduled</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open Google Calendar</li>
                    <li>Create event: "PDA Test - Sarah Johnson"</li>
                    <li>Set test time (e.g., Feb 25, 10:00-11:00 AM)</li>
                    <li>Add test center address in location</li>
                    <li>Save event</li>
                    <li>Go to DriveBook → Settings → Click "Sync Now"</li>
                    <li>✅ System blocks 8:00 AM - 12:00 PM (2 hours before + 1 hour after)</li>
                  </ol>
                </div>

                {/* Scenario 3 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">💻 Scenario 3: Client Books Online</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Client visits your booking page</li>
                    <li>Selects date, time, and enters details</li>
                    <li>Confirms booking</li>
                    <li>✅ Booking appears in DriveBook dashboard</li>
                    <li>✅ Event automatically created in your Google Calendar</li>
                    <li>✅ You receive email notification</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Important Notes
              </h3>
              
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                  <strong>🚗 Travel Time Buffer:</strong> The system automatically adds travel time between bookings. If you finish a lesson at one location and the next student is 10 minutes away, that travel time is blocked so the next student gets their full lesson time.
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                  <strong>⏰ All-Day Events:</strong> All-day events are ignored. Only events with specific start/end times are synced.
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <strong>🔄 Sync Frequency:</strong> Automatic sync runs every hour. Click "Sync Now" for immediate sync.
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                  <strong>🔒 Privacy:</strong> We only read/write calendar events. We never access your emails or other Google services.
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <strong>⚠️ Case Insensitive:</strong> Keywords work in any case - "PDA Test", "pda test", "PDA TEST" all work the same.
                </div>
              </div>
            </div>

            {/* Quick Reference */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                Quick Reference Card
              </h3>
              
              <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-300">
                      <th className="text-left py-2 font-semibold">Event Type</th>
                      <th className="text-left py-2 font-semibold">Required Keywords</th>
                      <th className="text-left py-2 font-semibold">Blocking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-purple-200">
                      <td className="py-2">Regular Lesson</td>
                      <td className="py-2 font-mono text-xs">Driving keyword (no PDA)</td>
                      <td className="py-2">Exact time</td>
                    </tr>
                    <tr className="border-b border-purple-200">
                      <td className="py-2">PDA Test</td>
                      <td className="py-2 font-mono text-xs">Driving + PDA keyword</td>
                      <td className="py-2">-2h to +1h</td>
                    </tr>
                    <tr>
                      <td className="py-2">Personal</td>
                      <td className="py-2 font-mono text-xs">No driving keywords</td>
                      <td className="py-2">Not synced</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t border-purple-300 text-xs">
                  <p className="font-semibold mb-2">Driving Keywords:</p>
                  <p className="text-purple-800">Lesson, Driving, PDA, Test, Student, Client, Pickup, Practice, Training, Instruction</p>
                </div>
              </div>
            </div>

            {/* Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-3">✅ Good Examples</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <strong>Regular Lesson:</strong> "John Smith - Driving Lesson" → Syncs & blocks exact time
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <strong>PDA Test:</strong> "Sarah - PDA Test at Licensing Center" → Syncs & blocks -2h to +1h
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <strong>Practice:</strong> "Student Practice Session" → Syncs & blocks exact time
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3 mt-6">❌ Will NOT Sync (No Driving Keywords)</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-100 border border-gray-300 rounded p-3">
                  <strong>Personal:</strong> "Doctor Appointment" → Not synced (no driving keyword)
                </div>
                <div className="bg-gray-100 border border-gray-300 rounded p-3">
                  <strong>Reminder:</strong> "Buy Groceries" → Not synced (no driving keyword)
                </div>
                <div className="bg-gray-100 border border-gray-300 rounded p-3">
                  <strong>Meeting:</strong> "Lunch with Friend" → Not synced (no driving keyword)
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div>
              <h3 className="text-lg font-semibold mb-3">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Q: Event not blocking slots?</strong>
                  <p className="text-gray-600 ml-4">→ Click "Sync Now" in Settings. Check event has specific times (not all-day).</p>
                </div>
                <div>
                  <strong>Q: PDA test not getting extended buffer?</strong>
                  <p className="text-gray-600 ml-4">→ Make sure title/description contains one of the PDA keywords.</p>
                </div>
                <div>
                  <strong>Q: Booking not appearing in Google Calendar?</strong>
                  <p className="text-gray-600 ml-4">→ Check "Connected to Google Calendar" in Settings. May need to reconnect.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Need More Help?</h3>
          <p className="mb-4">Contact support or check our detailed documentation</p>
          <div className="flex gap-4 justify-center">
            <a href="/dashboard/settings" className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100">
              Go to Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
