# Aria · Aura Skincare Voice Support Specialist

> **Live AI Voice Customer Support Agent for Aura Skincare (Indian D2C Skincare Brand)**
> Built with Next.js (App Router), TypeScript, Tailwind CSS, Google Gemini (`@google/genai`), and Web Speech API.

---

## 1. Overview

**Aria** is a browser-based AI voice customer support specialist for **Aura Skincare**, a premium organic Indian D2C skincare brand. Customers click **"Start Call"**, are welcomed with an upfront language choice, speak naturally in Indian English or Hinglish, and hear Aria's spoken replies within 1-2 seconds.

Aria executes real-time server-side function calling to look up orders, process cancellations, check return eligibility, and create escalation support tickets — all while adhering strictly to brand policy. When the call ends a structured JSON summary (with sentiment, escalation status, and language used) is displayed and ready for CRM logging.

---

## 2. Key Features

### 🌐 Language Choice Greeting Flow (New)
- On every call, Aria speaks a pre-synthesised, cached greeting: *"Hi, this is Aria from Aura Skincare. Would you like to continue in English, or in Hinglish?"*
- Client-side keyword matching detects the choice without any LLM call (fast, deterministic).
  - **Hinglish triggers:** `hinglish`, `hindi`, `हिंदी`, `हिन्दी`, `mix`, `hindi mein`, `hinglish mein`
  - **English triggers:** `english`, `angrezi`, `अंग्रेज़ी`, `अंग्रेजी`, `eng`
- If unclear, Aria asks once more (*"Sorry, English or Hinglish?"*), then defaults to English.
- If the customer ignores the greeting and states a request (e.g. *"Mera order kahan hai?"*), the language is detected from Devanagari script or common Hindi words (`mera`, `kahan`, `hai`, `kya`, `chahiye`, etc.) and the call continues in the detected language.
- Language choice syncs with the header selector and can be changed mid-call.

### 🗣️ Hinglish Voice Support (New)
- A language selector in the header switches between **English (India)** and **हिन्दी / Hinglish**.
- Switching sets speech recognition to `en-IN` (English) or `hi-IN` (Hinglish).
- Hinglish replies use simple Roman script with order IDs, product names, and statuses in English (e.g. *"Aapka order ORD-101 aaj shaam 6 baje tak pahunch jayega."*).
- TTS uses `hi-IN` browser voice for Hinglish or the configured Gemini voice. **No style instruction text is ever spoken aloud.**
- If the customer switches language mid-call, Aria detects the shift and continues in the new language.

### ❓ Ambiguous Request Handling (New)
- When a request is vague (*"I want to return it"*, *"cancel my order"*, *"where is my stuff"*, *"it's not working"*), Aria asks **exactly one** short clarifying question — never guesses and never calls a tool.
- If an order ID is given without an intent, Aria asks what the customer would like to do.
- If two intents appear in one message, Aria handles them one at a time and confirms before moving on.
- Contextual pronouns (*"yes"*, *"no"*, *"that one"*, *"it"*) are resolved from the previous turn.
- **Never more than one question per reply.**

### 🎫 Support Ticket Tool: `create_support_ticket` (New)
- Signature: `create_support_ticket(issue_summary: string, order_id?: string, priority: "LOW" | "MEDIUM" | "HIGH")`
- Creates an in-memory mock ticket returning `{ ticket_id: "TKT-1001", eta: "within 24 hours" }`.
- Used **only** when the customer asks for a human, reports a damaged product, is upset after policy was explained, or asks something Aria cannot answer.
- Aria announces intent first, then creates the ticket, then gives the ticket ID and SLA. **Never promises a refund or replacement outcome.**
- The ticket appears as a chip badge in the live transcript.
- Post-call JSON summary includes `tickets_created: string[]` and `escalation: boolean`.

### 🔊 Simplified & Reliable Voice Pipeline (New)
- **Standard 24kHz WAV Playback**: Raw 16-bit mono PCM (24000 Hz) returned by Gemini is wrapped in a valid 44-byte WAV header on the server and returned as `audio/wav`.
- **Pure HTMLAudioElement Playback**: Uses standard HTML5 `Audio` elements with preloading (`audio.load()`), completely eliminating Web Audio scheduling, silence-trimming artifacts, and audio clipping.
- **Single Request per Reply**: Replies up to 400 characters are sent as ONE `/api/tts` request. Long replies are split at sentence boundaries into at most two chunks of at least 120 characters.
- **Seamless Back-to-Back Chaining**: When a second chunk exists, it preloads early and begins instantly in the first chunk's `"ended"` event with zero gap.
- **Strict Female-Only Fallback**: Browser `SpeechSynthesis` is only used if Gemini TTS fails after one retry (12s timeout). Uses exclusively `en-IN` or English female voices (never `hi-IN` for English text). If unavailable, displays text only. Spoken as a single utterance at rate 1.0 and pitch 1.0.
- **Diagnostic Telemetry**: Every spoken reply logs engine used (`gemini` or `browser`), fallback reason, voice name, sample rate, and audio duration to the browser developer console.
- **Developer Voice Evaluation Suite**: Visit [`/voice-test`](file:///d:/projects/Project%20voice%20agent/app/voice-test/page.tsx) to listen to candidate Gemini prebuilt voices (Kore, Erinome, Sulafat, Aoede, Leda, Zephyr, Autonoe, Callirrhoe, Despina) using the same WAV playback pipeline.

### 🎧 Headphone & Half-Duplex Echo Control (New)
- **Default Half-Duplex Mode**: Recognition is aborted when Aria speaks; restarts after speech ends plus a 500ms safety buffer. Prevents laptop speaker loopback.
- **Headphone Mode Toggle**: Header button toggles full-duplex mode for headphone users with natural speech barge-in.
- **Echo Filtering**: Last spoken response is tracked; echoed transcriptions are automatically discarded.

### ⚡ Confident Voice Delivery & Prompt Engineering (New)
- **Answers First**: Aria answers the question directly before asking clarifying questions.
- **No Hedging or Fillers**: Prohibits hedging words (*"maybe"*, *"perhaps"*, *"I think"*) and filler openers (*"Well"*, *"Um"*, *"Actually"*, *"Alright"*).
- **Concise Word Cap**: Maximum 30 words per turn with short, crisp declarative sentences and no ellipses or trailing pauses.
- **Clean Pronunciation**: Order IDs (*"ORD-101"* -> *"O R D one zero one"*), ticket IDs (*"TKT-1001"* -> *"T K T one zero zero one"*), and currencies (*"₹699"* -> *"699 rupees"*) are phonetically sanitized before TTS.

### ⏱️ Improved Call Experience (New)
- **Live Call Timer**: `MM:SS` counter next to the state badge, starts when the call begins.
- **Mute Mic Toggle**: Button during a call; stops the microphone without ending the call.
- **Last Response Time Readout**: Shows *"Last response time: X.Xs"* — time from end of customer speech to first audio.
- **Pre-cached Phrases**: Greeting, clarifications, and common acknowledgements are synthesised once and replayed from cache for 0ms playback.
- **Space Bar Interrupt**: Press Space while Aria is speaking to instantly interrupt her (unless focus is in a text input).
- **Tap-to-Interrupt Orb**: Click the central orb while Aria speaks to interrupt immediately.

### 🔁 Half-Duplex Turn-Taking (Preserved & Enhanced)
- Microphone is off during Aria's speaking phase; recognition restarts only after TTS finishes + 500ms delay.
- Eliminates acoustic echo loops without requiring hardware headphones.

### 🛒 Deterministic Policy Engine (Preserved)
- `can_cancel`, `return_eligible`, `days_since_delivery`, `return_note` all computed server-side — the LLM never guesses dates or policy.
- Safety confirmation required before `cancel_order` is invoked.

### 📋 Post-Call JSON Summary (Extended)

```json
{
  "customer_intent": "...",
  "order_id": "ORD-XXX",
  "resolution_status": "Resolved | Unresolved | Escalated | Partial",
  "call_summary": "...",
  "tools_used": ["get_order_details", "create_support_ticket"],
  "customer_sentiment": "Positive | Neutral | Frustrated | Angry",
  "follow_up_needed": true,
  "language": "en | hinglish",
  "tickets_created": ["TKT-1001"],
  "escalation": true
}
```

---

## 3. Architecture

```
Browser (Chrome / Edge)
  Microphone --> Web Speech API (en-IN or hi-IN)
             --> Language Keyword Detector (client-side, no LLM)
             --> Voice State Machine
                 (idle -> awaiting_language_choice -> listening -> thinking -> speaking -> ended)
  Space / Orb Tap  -->  Interrupt Audio Playback
  Voice State Machine --> HTMLAudioElement (Gemini 24kHz WAV + SpeechSynthesis fallback)

Next.js Server
  /api/chat    POST (history + language) from State Machine
               buildAriaSystemPrompt(language) -> Gemini (gemini-3.1-flash-lite)
               Function Calling Loop (max 4 turns)
                 -> lib/orders.ts  (Deterministic Policy Engine)
                 -> lib/tickets.ts (In-memory Ticket Store)
  /api/summary POST (transcript + toolCalls + language)
               -> Gemini Structured Summary (language, tickets_created, escalation)
  /api/tts     POST (clean text only, no style prefix)
               serverAudioCache -> Gemini TTS audio bytes
```

---

## 4. Setup and Local Run

### Prerequisites
- Node.js v18+ (tested on Node v22)
- npm / pnpm / yarn
- Google Gemini API Key (free tier sufficient; the app cascades through fallback models automatically)

### Installation

```bash
cd "Project voice agent"
npm install
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY
```

### Environment Configuration (.env.local)

```env
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-3.1-flash-lite"
GEMINI_TTS_VOICE="Kore"
```

> `GEMINI_TTS_STYLE` has been removed. Confident delivery comes from a well-chosen prebuilt voice, sentence-level chunking, and prompt-level direction — no instruction prefix is ever spoken aloud.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Google Chrome** or **Microsoft Edge**.

---

## 5. Deployment to Vercel

```bash
npm install -g vercel
vercel login
vercel                                  # preview deployment
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
vercel env add GEMINI_TTS_VOICE production
vercel --prod                           # production deployment
```

> Web Speech API requires HTTPS. Vercel provisions SSL automatically, so microphone permissions work out of the box on the deployed domain.

---

## 6. Test Script and Evaluation Conversations

```bash
node --dns-result-order=ipv4first test-scenarios.js
```

### Verified Test Scenarios

| # | Customer Input | Language | Expected Behaviour | Status |
|---|---|---|---|---|
| 1 | *"Where is my order ORD-101?"* | English | Calls `get_order_details`, reports Out for Delivery. | ✅ PASS |
| 2 | *"I received ORD-102 two weeks ago, can I return it?"* | English | Detects `return_eligible: false`, explains 7-day policy. | ✅ PASS |
| 3 | **"I want to return it"** | English | No tool call. Asks for order ID only. | ✅ PASS |
| 4 | **"cancel my order"** | English | No tool call. Asks for order ID only. | ✅ PASS |
| 5a | *"I want to cancel ORD-103"* | English | Asks confirmation before cancellation. | ✅ PASS |
| 5b | *"Yes, please go ahead"* (follow-up) | English | Calls `cancel_order`, confirms cancellation. | ✅ PASS |
| 6 | **"Mera order ORD-101 kahan hai?"** | **Hinglish** | Calls `get_order_details`, replies in Roman Hinglish. | ✅ PASS |
| 7 | **"I want to talk to a human, my serum arrived shattered!"** | English | Calls `create_support_ticket(HIGH)`, returns TKT-1001, 24h SLA, no refund promise. | ✅ PASS |
| 8 | Post-call summary `/api/summary` | — | Returns `language`, `tickets_created: ["TKT-1001"]`, `escalation: true`. | ✅ PASS |

---

## 7. Known Limitations

1. **Browser Support**: Web Speech API works natively in Chromium browsers (Chrome, Edge, Brave) only. Firefox shows a clear banner and falls back to text input.
2. **Headphones Recommended**: Half-duplex mode prevents mic pickup of Aria's speech; headphones give the best experience.
3. **Free-Tier TTS Quota**: Gemini TTS Preview has a 3 req/min free-tier limit. The app transparently falls back to browser `SpeechSynthesis`. A server-side audio cache eliminates duplicate requests for greetings and common phrases.
4. **In-Memory Data**: Orders and support tickets reset on server restart. Production would use a real OMS/CRM.

---

## 8. Design Decisions

### Why Aria asks for language first
The Web Speech API uses a single `lang` attribute at start-of-recognition. Choosing the wrong language (`en-IN` for a Hindi speaker or `hi-IN` for an English speaker) causes the recogniser to mishear words, mangle proper nouns, and fail to recognise order IDs like `ORD-101`. Asking for language preference before any domain query ensures the recogniser is tuned correctly from the first real utterance. The greeting is pre-synthesised and cached, so there is zero added latency. Explicit selection also gives the customer agency and signals the product is genuinely built for India.

### Why ambiguous requests get a clarifying question instead of a guess
A voice agent that guesses intent and calls the wrong tool creates errors that cannot be undone (e.g. cancelling the wrong order). Asking exactly one clarifying question costs at most one extra turn but eliminates an entire class of policy violations. The rule "never more than one question per reply" prevents interrogating the customer and keeps the conversation natural.

### Why `create_support_ticket` never promises an outcome
Support tickets route to human agents who investigate physical damage, courier issues, and exceptions. The agent cannot unilaterally authorise refunds or replacements. Promising an outcome the system cannot guarantee erodes customer trust. The ticket ID and a firm 24-hour SLA satisfy the customer while keeping expectations accurate.

### Why tickets appear as chips in the transcript
Tool calls are invisible in a voice conversation. Showing a visible chip (*"Created Support Ticket: TKT-1001"*) gives the customer evidence that something real happened, reduces anxiety, and makes the post-call summary easier to audit. It also helps QA reviewers immediately spot escalations when scanning transcripts.

### Why multi-brand support was intentionally skipped
Supporting multiple brands would require per-brand system prompts, per-brand order schemas, and per-brand policy rules injected at runtime. This introduces context bloat (longer prompts mean higher latency and cost), risks cross-brand prompt contamination, and complicates the data model. For this assignment the goal is a reliable, low-latency single-brand experience. Multi-tenancy would be the correct next step for production — implemented via a brand configuration table and prompt template interpolation — but it adds no value to the evaluation and would introduce fragility.

### Why TTS style instructions were removed
Early builds prepended a delivery instruction to each TTS request (e.g. *"Say in a confident, calm voice: ..."*). Gemini TTS Preview occasionally spoke the instruction aloud. Confident delivery is achieved more reliably through: a well-chosen prebuilt voice (`Kore`), prompt-level instructions asking for short declarative filler-free sentences, and sentence-level audio chunking that gives TTS natural intonation boundaries.

### Why Hinglish replies use Roman script, not Devanagari
Indian consumers writing or speaking casual Hinglish overwhelmingly use Roman script (WhatsApp, SMS, social media). Devanagari output requires a dedicated Hindi TTS voice to sound correct; Roman Hinglish is readable and pronounceable by any `en-IN` voice engine. It also keeps the transcript readable for QA reviewers who may not read Devanagari.

---

## 9. Architecture Q&A

### a) Why this stack?
Next.js App Router + browser Web Speech API + server-side Gemini function calling achieves the lowest possible round-trip latency without heavy audio-streaming infrastructure. Browser STT and TTS eliminate the 300–800ms transit delay of streaming raw PCM over WebSockets to an external speech server. The Next.js API route acts as a secure stateless gateway that holds the API key, runs the tool-calling loop, and returns clean speakable text.

### b) What was the hardest part?
**Half-duplex turn-taking + spoken ID normalisation + echo suppression.** When Aria speaks through laptop speakers, the mic picks up her voice and creates a feedback loop. Implementing half-duplex (abort recognition while speaking, restart after TTS `onend` + 500ms) solved this. Spoken order IDs (*"o r d one zero one"*) required a phonetic digit-normaliser mapping number words to digits before reconstructing canonical `ORD-XXX`. All policy flags are computed server-side to avoid LLM date-arithmetic hallucinations.

### c) If you had one more week?
Upgrade from browser Web Speech API to **bidirectional audio streaming** via WebSockets using Gemini Live (multimodal audio-to-audio) or Deepgram Nova-2 + ElevenLabs Indic voice models. This would give sub-100ms STT latency, natural Indian English prosody, and true full-duplex barge-in with hardware-level acoustic echo cancellation via WebRTC. I would also add a CI/CD evaluation harness (promptfoo + synthetic audio) to regression-test policy edge cases.

### d) At 1,000 calls/day?
- Replace the in-memory mock DB with a real OMS API (Shopify / Shiprocket) + Redis cache for sub-20ms order lookups.
- Add SMS/WhatsApp OTP verification before allowing cancellations.
- Rate-limit per session with Redis token buckets; cascade to Anthropic Claude as a fallback LLM.
- Add OpenTelemetry + Langfuse for latency percentiles (P95/P99), sentiment trends, PII redaction, and human-agent escalation triggers.

---

## 10. License

MIT © Aura Skincare. Built for hiring evaluation assignment.
