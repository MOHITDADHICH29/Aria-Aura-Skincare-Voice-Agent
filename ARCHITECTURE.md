# System Architecture: Aria Voice Support Agent

## 1. Architectural Overview

Aria is a real-time, low-latency browser voice customer support specialist for Aura Skincare (Indian D2C skincare brand).
The architecture decouples heavy streaming infrastructure by leveraging:
1. **Client-side Speech Recognition (Web Speech API)**: Native client speech transcription (`en-IN`) with interim text previews and silence detection.
2. **Stateless Server API (Next.js App Router)**: Multi-model cascaded execution with Google Gemini (`@google/genai`), server-side deterministic tool calls, and in-memory policy evaluation.
3. **Dual-Path Speech Synthesis**: Primary neural Gemini TTS via Web Audio API with seamless back-to-back buffer scheduling; zero-latency locked female browser speech synthesis as transparent fallback.

---

## 2. Sequence Diagram: Single Turn Execution

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant BrowserSTT as Web Speech API (en-IN)
    participant StateMachine as useCall State Machine
    participant ChatAPI as Next.js /api/chat
    participant Gemini as Google Gemini API
    participant PolicyEngine as lib/policy & lib/orders
    participant AudioQueue as useAudioQueue & Web Audio
    participant TTSAPI as Next.js /api/tts

    Customer->>BrowserSTT: Speaks ("Mera order ORD-101 kahan hai?")
    BrowserSTT->>StateMachine: Interim Speech Caption
    Note over StateMachine: 700ms silence detected after speech ends
    BrowserSTT->>StateMachine: Final Transcript Event
    Note over StateMachine: toDisplayText() sanitizes to Roman script
    StateMachine->>StateMachine: Set State: Thinking
    
    StateMachine->>ChatAPI: POST /api/chat { messages, language: "hinglish" }
    ChatAPI->>Gemini: generateContent() with tools & Roman Hinglish system prompt
    Gemini-->>ChatAPI: FunctionCall: get_order_details("ORD-101")
    ChatAPI->>PolicyEngine: getOrderDetails("ORD-101")
    PolicyEngine-->>ChatAPI: { status: "Out for Delivery", return_eligible: false, ... }
    ChatAPI->>Gemini: FunctionResponse: { order details & computed policy flags }
    Gemini-->>ChatAPI: Spoken Response ("Aapka order ORD-101 aaj shaam 6 baje tak deliver ho jayega.")
    
    ChatAPI-->>StateMachine: 200 OK { reply, toolCalls }
    StateMachine->>StateMachine: Set State: Speaking
    
    par Parallel TTS Chunk Fetching
        StateMachine->>TTSAPI: POST /api/tts { text: "Aapka order O R D one zero one..." }
        TTSAPI->>Gemini: Gemini Neural Audio (voice: "Kore")
        Gemini-->>TTSAPI: Audio Buffer (24kHz WAV)
        TTSAPI-->>AudioQueue: ArrayBuffer
    end
    
    Note over AudioQueue: trimAudioBufferSilence() eliminates clicks
    AudioQueue->>Customer: source.start(nextStartTime) via Web Audio API
    Note over Customer,AudioQueue: Tap orb or press Spacebar triggers immediate stop()
    
    AudioQueue-->>StateMachine: onEnd() audio complete
    Note over StateMachine: Wait 500ms turn-transition delay (prevents echo loop)
    StateMachine->>BrowserSTT: startListening() for next turn
    StateMachine->>StateMachine: Set State: Listening
```

---

## 3. Module Responsibilities

| Module | Location | Responsibility |
|---|---|---|
| **Types** | `lib/types.ts` | Strict TypeScript interfaces for `CallState`, `Language`, `MockOrder`, `ComputedOrderDetails`, `PostCallSummary`, and diagnostics. |
| **Config** | `lib/config.ts` | Centralized constants with documented rationale: silence timeout (700ms), transition delay (500ms), chunk sizes (80-200), female voice names, model fallbacks. |
| **Language & Script** | `lib/language.ts` | Pure functions for `detectLanguageChoice(transcript)` (client keyword detection), `toDisplayText(text)` (Devanagari to Roman transliteration), and `assertNoDevanagari(text)`. |
| **Business Policy** | `lib/policy.ts` | Pure deterministic business rules: return window check (<= 7 days), cancellation eligibility (`Processing` only), COD limits (<= ₹2500), and free shipping threshold (₹499). |
| **Order Store** | `lib/orders.ts` | In-memory mock database of orders (`ORD-101`, `ORD-102`, `ORD-103`), spoken digit phonetic normalization (`normalizeOrderId`), and transactional cancellation. |
| **Ticket Store** | `lib/tickets.ts` | In-memory store for support tickets (`TKT-1001`+ sequence) with 24-hour SLA. |
| **TTS & Sanitizer** | `lib/tts.ts` | Pure speakable-text sanitizer (`sanitizeForSpeech`) and sentence-level chunker (`chunkTextForSpeech`). |
| **Speech Player** | `lib/speech.ts` | Web Audio context management, silence trimming, locked female browser voice fallback, and versioned audio caching. |
| **Audio Hook** | `hooks/useAudioQueue.ts` | Client hook for audio playback lifecycle, interrupt handling, and fallback voice reporting. |
| **STT Hook** | `hooks/useSpeechRecognition.ts` | Web Speech API wrapper with 700ms silence detection and single-point transliteration. |
| **Call Machine Hook** | `hooks/useCall.ts` | High-level orchestrator: call state machine, language greeting flow, timer, mute, and API turn handling. |
