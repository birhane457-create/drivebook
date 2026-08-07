/**
 * POST /api/instructor/bio-generate
 *
 * Generates a draft bio for the instructor using their existing profile data.
 * The instructor must review and edit the draft before saving — it is never
 * auto-saved. This is a writing aid, not a publish action.
 *
 * Uses OpenAI gpt-4o-mini. If OPENAI_API_KEY is not set, returns a
 * template-based fallback so the endpoint works in dev without a key.
 *
 * Quality rules baked into both the prompt and the fallback template:
 *   ✗ No price mention — price is on the booking page, not the bio
 *   ✗ No AI tell-tales: "passionate about", "mastering", "journey",
 *       "understanding the road", "improve your driving skills",
 *       "dedicated", "committed to excellence", "Book now!"
 *   ✓ First-person, direct, explains who the instructor helps and how
 *   ✓ Sounds like something a real instructor would write
 *   ✓ 80–100 words, 2–3 paragraphs
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bioGenerateRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 bio generations per hour per instructor
    const rateLimitId = getRateLimitIdentifier(session.user.id, null, 'bio-generate');
    const rl = await checkRateLimit(bioGenerateRateLimit, rateLimitId);
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error ?? 'Too many requests. Please wait before generating again.' },
        { status: 429, headers: rl.headers }
      );
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        name: true,
        baseAddress: true,
        vehicleTypes: true,
        yearsExperience: true,
        languages: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const { name, baseAddress, vehicleTypes, yearsExperience, languages } = instructor;

    // Shared data prep used by both fallback and AI path
    const transmissions = vehicleTypes
      ? vehicleTypes.split(',').map((v: string) => v.trim().toLowerCase()).join(' and ')
      : 'automatic and manual';
    const years = yearsExperience ? `${yearsExperience} years of` : 'several years of';
    const location = baseAddress
      ? baseAddress.split(',').slice(0, 2).join(',').trim()
      : 'Perth, WA';
    const langs = languages
      ? languages.split(',').map((l: string) => l.trim()).filter(Boolean)
      : ['English'];
    const multiLang = langs.length > 1
      ? ` I teach in ${langs.join(' and ')}, which means I can work with a wider range of students.`
      : '';

    // ── Template fallback (no OpenAI key) ─────────────────────────────────────
    if (!process.env.OPENAI_API_KEY) {
      const draft =
        `Hi, I'm ${name}, a driving instructor based in ${location}. ` +
        `With ${years} experience teaching ${transmissions} vehicles, ` +
        `I help learners build the confidence and skills they need to drive safely and independently.\n\n` +
        `My lessons are tailored to each student's experience level and goals — whether you're taking ` +
        `your first lesson, preparing for your driving assessment, or returning to the road after a break. ` +
        `I focus on making each session relaxed and productive so you can progress at your own pace.` +
        `${multiLang}\n\n` +
        `I look forward to helping you get on the road.`;

      return NextResponse.json({ bio: draft });
    }

    // ── OpenAI generation ─────────────────────────────────────────────────────
    const prompt = `Write a short professional bio for a driving instructor's booking profile.

Instructor details:
- Name: ${name}
- Location: ${location}
- Teaches: ${transmissions} vehicles
- Experience: ${years} experience
${langs.length > 1 ? `- Languages: ${langs.join(', ')}` : ''}

Style rules — follow every one:
1. First person ("I"), 80–100 words, 2–3 short paragraphs
2. Open with: "Hi, I'm [full name], a driving instructor based in [location]."
3. Sentence 2: mention transmission type and years of experience naturally
4. Paragraph 2: who you help — beginners, learners preparing for their PDA or driving test, people returning after a break
5. One sentence on approach — tailored lessons, patient, relaxed environment — pick one or two, don't list all
${langs.length > 1 ? '6. Mention languages naturally in one sentence.' : ''}
6. Close with a single low-key sentence (no exclamation mark, no "Book now", no price)

BANNED — do not use any of these:
"passionate", "mastering", "journey", "understanding the road",
"improve your driving skills", "driving skills", "dedicated instructor",
"committed to excellence", "take you to the next level",
"I look forward to working with you to achieve your goals",
"ready to improve", "unlock your potential"

Do not mention price or hourly rate.
Write in Australian English.
Return the bio text only — no heading, no quotation marks, no markdown.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5,   // lower = less hallucination of generic filler phrases
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', response.status, await response.text());
      return NextResponse.json({ error: 'Failed to generate bio' }, { status: 502 });
    }

    const data = await response.json();
    const bio = data.choices?.[0]?.message?.content?.trim();

    if (!bio) {
      return NextResponse.json({ error: 'No bio generated' }, { status: 502 });
    }

    return NextResponse.json({ bio });
  } catch (error) {
    console.error('Bio generate error:', error);
    return NextResponse.json({ error: 'Failed to generate bio' }, { status: 500 });
  }
}
