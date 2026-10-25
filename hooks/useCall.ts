"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  CallState,
  Language,
  TranscriptItem,
  PostCallSummary,
  TimingDiagnostics,
} from "@/lib/types";
import {
  TURN_TRANSITION_DELAY_MS,
  LANGUAGE_CHOICE_TIMEOUT_MS,
} from "@/lib/config";
import {
  toDisplayText,
  detectLanguageChoice,
  inferLanguageFromMessage,
} from "@/lib/language";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAudioQueue } from "./useAudioQueue";
import { resetLockedVoice, resumeAudioContext } from "@/lib/speech";

export function useCall() {
  // Helper for timestamped logs
  const log = (...args: any[]) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}]`, ...args);
  };
  const [callState, setCallState] = useState<CallState>("Idle");
  const [language, setLanguage] = useState<Language>("en");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [summary, setSummary] = useState<PostCallSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [timing, setTiming] = useState<TimingDiagnostics | null>(null);

  // References for state machine operations
  const callStateRef = useRef<CallState>("Idle");
  const languageRef = useRef<Language>("en");
  const languageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const languageRetryCountRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndTimeRef = useRef<number>(0);
  const toolCallsRef = useRef<any[]>([]);
  // New: Headphone mode state (false = half‑duplex, true = full‑duplex)
  const [headphoneMode, setHeadphoneMode] = useState<boolean>(false);
  const toggleHeadphoneMode = useCallback(() => setHeadphoneMode(prev => !prev), []);
  // New: Ref to store last Aria reply for echo filtering
  const lastAriaReplyRef = useRef<string>('');


  

  // Child hooks
  const audioQueue = useAudioQueue();
  const recognition = useSpeechRecognition(language);

  // Sync ref with state
  useEffect(() => {
    callStateRef.current = callState;
    log('CallState changed to', callState);
  }, [callState]);

  useEffect(() => {
    languageRef.current = language;
    log('Language set to', language);
  }, [language]);

  // Live call timer
  useEffect(() => {
    if (callState !== "Idle" && callState !== "Ended") {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [callState]);

  // Helper to add transcript item with guaranteed clean Latin display text
  const addTranscript = useCallback(
    (speaker: "Customer" | "Aria", rawText: string, toolCalls?: any[]) => {
      const clean = toDisplayText(rawText);
      if (!clean) return;

      const item: TranscriptItem = {
        id: Math.random().toString(36).substring(2, 9),
        speaker,
        text: clean,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        toolCalls,
      };

      setTranscript((prev) => [...prev, item]);
      return item;
    },
    []
  );

  // Keyboard shortcut: Spacebar to interrupt Aria while she is speaking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;

        if (callStateRef.current === "Speaking") {
          e.preventDefault();
          interruptSpeech();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Half-duplex turn-taking: start listening only when speech finishes + 500ms delay
  const startHalfDuplexListening = useCallback(() => {
    if (headphoneMode) return; // Full‑duplex mode handles listening elsewhere
    if (callStateRef.current === "Ended" || isMuted) return;

    setCallState("Listening");
    console.log("[Voice Agent] Starting recognition (half-duplex)...");

    recognition.startListening({
      onInterimResult: (_caption) => {
        // Caption state is maintained inside recognition hook
      },
      onFinalResult: (cleanTranscript, rawTranscript) => {
        // Echo filtering: ignore if the user speech matches the last Aria reply
        if (lastAriaReplyRef.current && rawTranscript.includes(lastAriaReplyRef.current)) {
          console.log("[Voice Agent] Detected echoed speech, ignoring.");
          // Reset the stored reply to avoid repeated blocks
          lastAriaReplyRef.current = '';
          // Resume listening for new input
          startHalfDuplexListening();
          return;
        }
        speechEndTimeRef.current = Date.now();
        log('Customer final result', cleanTranscript);
        // Check if we are currently waiting for language selection
        if (callStateRef.current === "LanguageChoice") {
          handleLanguageTurn(cleanTranscript, rawTranscript);
        } else {
          handleConversationTurn(cleanTranscript);
        }
      },
      onError: (err) => {
        console.warn("[Voice Agent] Recognition error:", err);
      },
    });
  }, [headphoneMode, isMuted, recognition]);
  // Interrupt Aria's speech immediately
  const interruptSpeech = useCallback(() => {
    if (callStateRef.current === "Speaking") {
      console.log("[Voice Agent] Barge-in triggered. Interrupting Aria...");
      audioQueue.stop();
      startHalfDuplexListening();
    }
  }, [audioQueue, startHalfDuplexListening]);

  // Execute language selection transition
  const chooseLanguage = useCallback(
    (chosen: Language, isFallback = false) => {
      if (languageTimeoutRef.current) {
        clearTimeout(languageTimeoutRef.current);
        languageTimeoutRef.current = null;
      }
      if (!headphoneMode) {
        recognition.stopListening();
      }

      setLanguage(chosen);
      languageRef.current = chosen;
      console.log(`[Voice Agent] Language confirmed: ${chosen} (fallback: ${isFallback})`);

      const confirmationPhrase = isFallback
        ? "No problem, we will continue in English. How can I help you today?"
        : chosen === "hinglish"
        ? "Bilkul, main aapki kaise madad kar sakti hoon?"
        : "Great, how can I help you today?";

      addTranscript("Aria", confirmationPhrase);
      setCallState("Speaking");
      log('Aria speaking (chooseLanguage)', confirmationPhrase);

      // Ensure microphone is not listening during speech in half‑duplex mode
      if (!headphoneMode) {
        recognition.stopListening();
        log('Recognition stopped before speaking (half‑duplex)');
      }

      // Full‑duplex: keep mic open while speaking; start listening on start callback for barge‑in
      const onStartCb = headphoneMode
        ? () => {
            // Start listening for possible barge‑in
            recognition.startListening({
              onInterimResult: () => {
                // Bar‑ge‑in detected – interrupt Aria immediately
                interruptSpeech();
              },
              onFinalResult: (clean, raw) => {
                // This will be handled after the interruption returns to normal flow
              },
            });
          }
        : undefined;

      log('TTS request (chooseLanguage)', { text: confirmationPhrase, length: confirmationPhrase.length, language: chosen });
      // Store the phrase for echo filtering
      lastAriaReplyRef.current = confirmationPhrase;
      audioQueue.play(confirmationPhrase, {
        onStart: () => {
          log('Audio playback started (chooseLanguage)');
          onStartCb?.();
        },
        onEnd: () => {
          log('Audio playback ended (chooseLanguage)');
          setTimeout(() => {
            // In half‑duplex mode we resume listening after speech ends
            if (!headphoneMode) startHalfDuplexListening();
          }, TURN_TRANSITION_DELAY_MS);
        },
      }, chosen);
    },
    [addTranscript, audioQueue, recognition, startHalfDuplexListening, headphoneMode]
  );

  // Process customer input during LanguageChoice phase
  const handleLanguageTurn = useCallback(
    (cleanTranscript: string, rawTranscript: string) => {
      if (languageTimeoutRef.current) {
        clearTimeout(languageTimeoutRef.current);
        languageTimeoutRef.current = null;
      }

      addTranscript("Customer", cleanTranscript);

      // Section A.3: Pure keyword detection in lib/language.ts
      const detected = detectLanguageChoice(rawTranscript);
      console.log(`[Voice Agent] Language match result: ${detected} for "${cleanTranscript}"`);

      if (detected === "en" || detected === "hinglish") {
        chooseLanguage(detected);
        return;
      }

      // Section A.6: Check if user skipped greeting and stated an order request directly
      const inferred = inferLanguageFromMessage(cleanTranscript);
      const isSpecificRequest =
        /(\bord\b|\border\b|\breturn\b|\bcancel\b|\btrack\b|\bwhere\b|\bmera\b|\bstatus\b)/i.test(
          cleanTranscript
        );

      if (isSpecificRequest) {
        console.log(`[Voice Agent] Direct request detected. Inferred language: ${inferred}`);
        setLanguage(inferred);
        languageRef.current = inferred;
        // Proceed directly with conversation turn
        handleConversationTurn(cleanTranscript, inferred);
        return;
      }

      // Section A.5: Unclear response -> repeat once shorter
      if (languageRetryCountRef.current === 0) {
        languageRetryCountRef.current = 1;
        const promptShort = "Sorry, English or Hinglish?";
        addTranscript("Aria", promptShort);
        setCallState("Speaking");

        audioQueue.play(promptShort, {
          onEnd: () => {
            setTimeout(() => {
              setCallState("LanguageChoice");
              startLanguageListening();
            }, TURN_TRANSITION_DELAY_MS);
          },
        }, languageRef.current);
      } else {
        // Second failure -> default to English
        chooseLanguage("en", true);
      }
    },
    [addTranscript, audioQueue, chooseLanguage]
  );

  // Start listening during LanguageChoice with 8-second timeout
  const startLanguageListening = useCallback(() => {
    if (callStateRef.current === "Ended") return;

    setCallState("LanguageChoice");
    console.log("[Voice Agent] Listening for language choice...");

    // In full‑duplex mode we keep the mic open during speech; otherwise we start half‑duplex listening
    if (!headphoneMode) {
      recognition.startListening({
        onFinalResult: (cleanTranscript, rawTranscript) => {
          handleLanguageTurn(cleanTranscript, rawTranscript);
        },
        onStart: () => log('Recognition started for language choice'),
        onEnd: () => log('Recognition ended for language choice'),
      });
    } else {
      // Full‑duplex: start listening now and also allow barge‑in during Aria's prompts
      recognition.startListening({
        onInterimResult: () => {
          // No special handling for language choice interim results
        },
        onFinalResult: (cleanTranscript, rawTranscript) => {
          handleLanguageTurn(cleanTranscript, rawTranscript);
        },
      });
    }

    // 8-second silence timeout (only relevant for half‑duplex language choice)
    if (languageTimeoutRef.current) clearTimeout(languageTimeoutRef.current);
    languageTimeoutRef.current = setTimeout(() => {
      console.log("[Voice Agent] Language selection timed out (8s).");
      if (languageRetryCountRef.current === 0) {
        languageRetryCountRef.current = 1;
        const promptShort = "English or Hinglish?";
        addTranscript("Aria", promptShort);
        setCallState("Speaking");

        audioQueue.play(promptShort, {
          onEnd: () => {
            setTimeout(() => {
              setCallState("LanguageChoice");
              startLanguageListening();
            }, TURN_TRANSITION_DELAY_MS);
          },
        }, languageRef.current);
      } else {
        chooseLanguage("en", true);
      }
    }, LANGUAGE_CHOICE_TIMEOUT_MS);
  }, [headphoneMode, addTranscript, audioQueue, chooseLanguage, handleLanguageTurn, recognition]);
  // Process standard customer conversational turns
  const handleConversationTurn = useCallback(
    async (customerText: string, forcedLang?: Language) => {
      const activeLang = forcedLang || languageRef.current;
      addTranscript("Customer", customerText);
      setCallState("Thinking");

      // Mid-call language switch detection
      const inferred = inferLanguageFromMessage(customerText);
      if (inferred !== activeLang) {
        if (
          /\b(speak in english|english mein bolo|english please)\b/i.test(customerText) ||
          (/\b(hinglish|hindi mein)\b/i.test(customerText) && inferred === "hinglish")
        ) {
          console.log(`[Voice Agent] Mid-call language switch to: ${inferred}`);
          setLanguage(inferred);
          languageRef.current = inferred;
        }
      }

      const turnStartTime = speechEndTimeRef.current || Date.now();
      let llmFirstTokenTime = 0;
      let ttsFirstAudioTime = 0;

      try {
        const historyForApi = transcript
          .concat({
            id: "current",
            speaker: "Customer",
            text: customerText,
            timestamp: "",
          })
          .map((m) => ({
            role: m.speaker === "Aria" ? "assistant" : "user",
            content: m.text,
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForApi,
            language: languageRef.current,
          }),
        });

        const data = await res.json();
        llmFirstTokenTime = Date.now();

        if (data.toolCalls && data.toolCalls.length > 0) {
          toolCallsRef.current.push(...data.toolCalls);
        }

        const reply = data.reply || "I am here to help with your Aura Skincare order.";
        addTranscript("Aria", reply, data.toolCalls);
        setCallState("Speaking");

        ttsFirstAudioTime = Date.now();
        setTiming({
          speechEndToFinalTranscriptMs: Math.max(0, turnStartTime - (speechEndTimeRef.current || turnStartTime)),
          llmFirstTokenMs: Math.max(0, llmFirstTokenTime - turnStartTime),
          ttsFirstAudioMs: Math.max(0, ttsFirstAudioTime - llmFirstTokenTime),
          totalTurnMs: Math.max(0, ttsFirstAudioTime - turnStartTime),
        });

        // Store Aria's reply for echo filtering
      lastAriaReplyRef.current = reply;
      // Ensure microphone is not listening during speech in half‑duplex mode
      if (!headphoneMode) {
        recognition.stopListening();
        log('Recognition stopped before speaking (half‑duplex)');
      }
      audioQueue.play(reply, {
          onEnd: () => {
            setTimeout(() => {
              startHalfDuplexListening();
            }, TURN_TRANSITION_DELAY_MS);
          },
        }, languageRef.current);
      } catch (err) {
        console.error("[Voice Agent] Conversation turn failed:", err);
        const errReply = "Sorry, I had a momentary connection hiccup. Could you please say that again?";
        addTranscript("Aria", errReply);
        setCallState("Speaking");

        // Store error reply for echo filtering
      lastAriaReplyRef.current = errReply;
      // Ensure microphone is not listening during speech in half‑duplex mode
      if (!headphoneMode) {
        recognition.stopListening();
        log('Recognition stopped before speaking (half‑duplex)');
      }
      audioQueue.play(errReply, {
          onEnd: () => {
            setTimeout(() => {
              startHalfDuplexListening();
            }, TURN_TRANSITION_DELAY_MS);
          },
        }, languageRef.current);
      }
    },
    [addTranscript, audioQueue, startHalfDuplexListening, transcript]
  );

  // Section A.1: Start Call initial greeting sequence
  const startCall = useCallback(async () => {
    console.log("[Voice Agent] Starting call...");
    setCallDuration(0);
    setTranscript([]);
    setSummary(null);
    toolCallsRef.current = [];
    languageRetryCountRef.current = 0;

    // Reset voice lock and resume audio context
    resetLockedVoice();
    await resumeAudioContext();

    // Warm-up tiny request to TTS route
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hi" }),
    }).catch(() => {});

    const greetingText =
      "Hi, this is Aria from Aura Skincare. Would you like to continue in English, or in Hinglish?";

    addTranscript("Aria", greetingText);
    setCallState("Greeting");

    console.log("[Voice Agent] Playing initial greeting...");
    audioQueue.play(greetingText, {
      onEnd: () => {
        console.log("[Voice Agent] Greeting ended. Waiting 500ms before listening...");
        setTimeout(() => {
          startLanguageListening();
        }, TURN_TRANSITION_DELAY_MS);
      },
    }, languageRef.current);
  }, [addTranscript, audioQueue, startLanguageListening]);

  // End Call & trigger Post-Call JSON Summary
  const endCall = useCallback(async () => {
    console.log("[Voice Agent] Ending call...");
    if (languageTimeoutRef.current) {
      clearTimeout(languageTimeoutRef.current);
      languageTimeoutRef.current = null;
    }

    recognition.stopListening();
    audioQueue.stop();
    setCallState("Ended");
    log('Call ended');

    if (transcript.length === 0) return;

    setIsSummarizing(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          toolCalls: toolCallsRef.current,
          language: languageRef.current,
        }),
      });

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("[Voice Agent] Summary failed:", err);
    } finally {
      setIsSummarizing(false);
    }
  }, [audioQueue, recognition, transcript]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        recognition.stopListening();
        log('Muted: recognition stopped');
      } else if (callStateRef.current === "Listening") {
        startHalfDuplexListening();
        log('Unmuted: resumed half‑duplex listening');
      }
      return next;
    });
  }, [recognition, startHalfDuplexListening]);

  // Switch language explicitly from UI selector
  const switchLanguage = useCallback(
    (newLang: Language) => {
      setLanguage(newLang);
      languageRef.current = newLang;
      if (callStateRef.current === "Listening") {
        recognition.stopListening();
        setTimeout(() => {
          startHalfDuplexListening();
        }, 100);
      }
    },
    [recognition, startHalfDuplexListening]
  );

  return {
    callState,
    language,
    transcript,
    interimCaption: recognition.interimCaption,
    isMuted,
    callDuration,
    summary,
    isSummarizing,
    timing,
    headphoneMode,
    toggleHeadphoneMode,
    startCall,
    endCall,
    chooseLanguage,
    switchLanguage,
    toggleMute,
    interruptSpeech,
    sendManualMessage: (text: string) => handleConversationTurn(text),
  };
}
