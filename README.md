# Aria: AI Voice Support Agent for Aura Skincare

I built Aria for the Datastraw AI assessment. She is a browser-based voice agent for a fictional Indian skincare brand, Aura Skincare. You click Start Call, talk to her, and she answers out loud. She can look up orders, cancel eligible ones, raise a support ticket, and she sticks to the brand's policies.

- **Live app**: https://aria-aura-skincare-voice-agent.vercel.app/
- **Demo video**: https://youtu.be/gmwi2inE9lI
- **Repo**: https://github.com/MOHITDADHICH29/Aria-Aura-Skincare-Voice-Agent

Use Chrome or Edge, allow the microphone, and click **Start Call**. The page has a Test Orders panel with the three sample orders and a list of sentences you can try.

---

## What she can do

- Starts the call by asking whether you want English or Hinglish, then continues in that language. You can speak your choice or click a button.
- Looks up orders (`ORD-101`, `ORD-102`, `ORD-103`) and tells you the status, delivery details, and what you are allowed to do with the order.
- Cancels an order only if it is still Processing, and asks for confirmation first.
- Declines things the policy doesn't allow (for example returning an opened product after 20 days, or cancelling an order that is out for delivery) and doesn't promise refunds.
- Creates a support ticket when a customer asks for a human or reports a damaged product.
- Says no politely to unrelated requests (like booking a flight).
- Asks one short question when a request is vague (*"I want to return it"*), instead of guessing.
- Handles unknown or missing order IDs and unclear audio by asking the customer to repeat.
- After the call, shows the full transcript and a JSON summary.

**Optional items from the brief that I chose to build**: interruption (tap the orb or press Space; Headphones Mode adds voice interruption), Hinglish, multiple tools (`get_order_details`, `cancel_order`, `create_support_ticket`), ambiguous-request handling, and a few call-experience touches (call timer, mute button, response-time readout). I skipped multi-brand support on purpose (see Design decisions).

---

## How it works

```
Browser (Chrome / Edge)
  Microphone -> Web Speech API (speech to text)
             -> language check (keyword matching in code)
             -> call state machine (idle, language choice, listening, thinking, speaking, ended)
  Reply audio <- HTMLAudioElement (Gemini TTS as WAV), browser voice as fallback

Next.js server (API routes, the API key stays here)
  /api/chat    history + language -> Gemini with function calling (max 4 rounds)
               tools: lib/orders.ts, lib/tickets.ts
  /api/tts     clean reply text -> Gemini TTS -> WAV
  /api/summary transcript + tool calls -> structured JSON summary
```

One turn goes like this: the browser turns my speech into text, sends the conversation to `/api/chat`, Gemini decides whether it needs a tool, the server runs the tool and gives the result back, Gemini writes a short reply, and `/api/tts` turns the reply into audio that the browser plays.

Three decisions shape most of the behaviour:

1. **Policy rules live in code, not in the prompt.** `get_order_details` returns computed flags such as `can_cancel`, `return_eligible`, and `days_since_delivery`. The model reads these flags and explains them, so it never does date maths or decides policy by itself. `cancel_order` re-checks the rule on the server.
2. **The language choice is detected in code.** A small function matches keywords in what the customer said (*"English"*, *"Hinglish"*, and so on). It is instant and predictable, and it avoids an extra LLM call.
3. **Half-duplex by default.** The microphone is off while Aria speaks and comes back on about half a second after she finishes. This stops her from hearing herself through laptop speakers.

---

## Setup

**Requirements**: Node.js 18 or newer and a Gemini API key (the free tier is enough).

```bash
npm install
cp .env.example .env.local  # put your key in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

### Environment variables (`.env.local`)

```env
GEMINI_API_KEY=""      # server-side only, never exposed to the browser
GEMINI_MODEL=""        # chat model, for example a Gemini flash-lite model
GEMINI_TTS_VOICE=""    # one female prebuilt voice, for example Kore
```

Browser speech recognition needs HTTPS, so the microphone works on localhost and on the deployed site.

---

## Deployment

I deployed it on Vercel. Import the GitHub repo, add the three environment variables in the project settings, and deploy. After changing a variable, redeploy.

---

## Tests

```bash
npm test
```

The unit tests cover the pure logic: order ID normalisation, the policy flags for all three orders, the language detection, and the text clean-up before speech. I also ran these conversations by hand on the app:

| # | What I said | Expected | Result |
|---|---|---|---|
| 1 | *"Where is my order ORD-101?"* | Looks up the order, says it is out for delivery | Pass |
| 2 | *"I received ORD-102 two weeks ago, can I return it?"* | Explains the 7-day return window, no refund promise | Pass |
| 3 | *"I want to return it"* | One question asking for the order ID, no tool call | Pass |
| 4 | *"Cancel my order"* | One question asking for the order ID, no tool call | Pass |
| 5 | *"Cancel ORD-103"*, then *"yes"* | Asks to confirm, then cancels | Pass |
| 6 | *"Mera order ORD-101 kahan hai?"* | Replies in Roman-script Hinglish | Pass |
| 7 | *"I want to talk to a human, my serum arrived shattered"* | Creates a high-priority ticket, no promise of a replacement | Pass |
| 8 | Ending the call | Transcript and JSON summary appear | Pass |

---

## Post-call summary

```json
{
  "customer_intent": "ORDER_TRACKING",
  "order_id": "ORD-101",
  "resolution_status": "RESOLVED",
  "call_summary": "Customer asked where ORD-101 is. It is out for delivery, expected by 6 PM today.",
  "tools_used": ["get_order_details"],
  "customer_sentiment": "Neutral",
  "follow_up_needed": false,
  "language": "en",
  "tickets_created": [],
  "escalation": false
}
```

---

## Limitations

- **Chrome and Edge only.** The browser speech API is missing or unreliable in other browsers, so those users get a text box instead.
- **Speech recognition quality** depends on the browser, microphone, and accent. Hinglish is the weakest area because the recogniser expects one language at a time.
- **Echo**: on speakers, the mic is switched off while Aria talks, so interrupting by voice only works in Headphones Mode. Tapping the orb or pressing Space always works.
- **The Gemini TTS free tier** has a low request limit. When it fails, the app falls back to a browser voice, which sounds different. Common phrases are cached to reduce this.
- **Orders and tickets are in memory** and reset when the server restarts. A real version would use an order system and a database.
- **Typical response time on my setup**: ~1.5s–2.5s turn-taking latency.

---

## Design decisions

- **Why she asks for the language first.** The browser recogniser takes one language setting at the start. If it is wrong, words and order IDs get misheard. Asking first sets it correctly from the first real sentence.
- **Why vague requests get one question instead of a guess.** A wrong guess can cancel the wrong order, and a cancellation can't be undone. One extra question is cheaper than that mistake.
- **Why tickets never promise an outcome.** A ticket sends the case to a human who can check damage or courier problems. Aria isn't allowed to promise a refund or replacement, so she gives the ticket ID and the 24-hour follow-up time.
- **Why tool calls show as chips in the transcript.** Tools are invisible in a voice call. A small chip such as *"Support ticket TKT-1001 created"* shows that something actually happened and makes calls easier to review.
- **Why I removed the spoken style instruction.** My first version added a line like *"say this in a confident voice"* before each reply, and the TTS sometimes read it aloud. I removed it and now get a confident sound from a fixed voice, short direct sentences, and a prompt that bans hedging and filler words.
- **Why Hinglish is written in Roman letters.** Most people type and read Hinglish in Roman script, and it is easier for the voice to pronounce and for a reviewer to read. The app converts any Devanagari from the recogniser to Roman letters before showing it.
- **Why no multi-brand support.** It needs per-brand prompts, data, and rules, and it adds latency and risk without helping this assignment. I preferred one reliable brand.

---

## How I think

1. **Why this architecture and stack?** I wanted a pipeline I could build in two days, run for free, and explain end to end: browser speech recognition, then Gemini with function calling, then text to speech. A speech-to-speech API would be faster, but it hides the steps I wanted to control, especially tool calling and guardrails. Next.js lets me keep the API key and the tool logic on the server and deploy to Vercel easily.
2. **What was the hardest part?** Turn-taking. Aria's voice came back through the microphone, so she answered herself and the speech kept breaking. I made the call half-duplex by default, added a filter that drops transcripts that mostly repeat her last reply, and made interruption a deliberate action (tap, Space, or Headphones Mode). The second hard part was the voice itself: gaps, clicks, and an unwanted switch to a browser voice. I fixed this by sending a whole reply as one TTS request and playing it as a standard WAV file instead of stitching small pieces together.
3. **What would I improve first with one more week?** The speech layer. I'd move to streaming speech recognition and a streaming Indian-English voice for lower latency and better Hinglish accuracy, with proper echo cancellation for true barge-in. Then I'd build an automated set of scripted calls to catch policy regressions.
4. **What changes at 1,000 calls a day?** Cost per call and API rate limits become the first problem, so I would track both and add a second provider as a backup. I would replace the mock data with the real order system, verify the customer's identity before sharing order details or cancelling, store calls and tickets in a database, and handle personal data properly. I'd also add monitoring for latency and failures, a real human handoff, and regression tests for the policy answers.

---

## AI tools

I used AI coding tools (Antigravity with Gemini, and Claude for planning and debugging) as the assignment encourages. I tested the app myself, and I can walk through any part of it: how the voice pipeline works, how a tool call happens, and where the guardrails are.
