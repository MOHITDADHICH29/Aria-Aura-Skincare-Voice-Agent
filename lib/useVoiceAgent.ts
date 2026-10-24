"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { splitIntoSentences, speakSentences } from "./speech";
import { ToolCallRecord } from "./tools";
import { CallSummary } from "@/app/api/summary/route";

export type CallState = "Idle" | "Listening" | "Thinking" | "Speaking" | "Ended";

export interface TranscriptItem {
  id: string;
  speaker: "customer" | "aria";
  text: string;
  timestamp: string;
  toolCalls?: ToolCallRecord[];
}

interface IWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpeechRecognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webkitSpeechRecognition?: any;
}

export function useVoiceAgent() {
  const [callState, setCallState] = useState<CallState>("Idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);

  // References to keep callbacks and mutable state fresh
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const callStateRef = useRef<CallState>("Idle");
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silencePromptPlayedRef = useRef<boolean>(false);
  const transcriptRef = useRef<TranscriptItem[]>([]);

  // Sync ref with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Check browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const hasSpeechRecognition = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
      const hasSpeechSynthesis = "speechSynthesis" in window;
      setIsBrowserSupported(hasSpeechRecognition && hasSpeechSynthesis);
    }
  }, []);

  // Format timestamp (e.g. 10:45 AM)
  const getFormattedTime = () => {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Silence timer management
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const triggerSilencePrompt = useCallback(() => {
    if (
      !isCallActiveRef.current ||
      callStateRef.current !== "Listening" ||
      silencePromptPlayedRef.current
    ) {
      return;
    }

    silencePromptPlayedRef.current = true;
    const silenceMessage = "Are you still there? I'm happy to help whenever you're ready.";

    // Add to transcript
    const ariaItem: TranscriptItem = {
      id: "aria-silence-" + Date.now(),
      speaker: "aria",
      text: silenceMessage,
      timestamp: getFormattedTime(),
    };
    setTranscript((prev) => [...prev, ariaItem]);

    // Speak prompt
    setCallState("Speaking");
    cancelSpeechRef.current = speakSentences([silenceMessage], {
      onEnd: () => {
        if (isCallActiveRef.current) {
          setCallState("Listening");
        }
      },
      onError: () => {
        if (isCallActiveRef.current) {
          setCallState("Listening");
        }
      },
    });
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (isCallActiveRef.current && !silencePromptPlayedRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        triggerSilencePrompt();
      }, 12000); // 12 seconds
    }
  }, [clearSilenceTimer, triggerSilencePrompt]);

  // Handle incoming AI reply and speak it
  const handleAriaReply = useCallback(
    (replyText: string, toolCalls: ToolCallRecord[]) => {
      if (!isCallActiveRef.current) return;

      const ariaItem: TranscriptItem = {
        id: "aria-" + Date.now(),
        speaker: "aria",
        text: replyText,
        timestamp: getFormattedTime(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      setTranscript((prev) => [...prev, ariaItem]);
      setCallState("Speaking");
      clearSilenceTimer();

      const sentences = splitIntoSentences(replyText);

      cancelSpeechRef.current = speakSentences(sentences, {
        onStart: () => {
          // Keep recognition running in background to capture barge-in
          try {
            if (recognitionRef.current && isCallActiveRef.current) {
              recognitionRef.current.start();
            }
          } catch {
            // Already started or active
          }
        },
        onEnd: () => {
          if (isCallActiveRef.current) {
            setCallState("Listening");
            resetSilenceTimer();
          }
        },
        onError: () => {
          if (isCallActiveRef.current) {
            setCallState("Listening");
            resetSilenceTimer();
          }
        },
      });
    },
    [clearSilenceTimer, resetSilenceTimer]
  );

  // Send conversation to backend
  const sendToBackend = useCallback(
    async (messagesToSend: { role: "user" | "assistant"; content: string }[]) => {
      setCallState("Thinking");
      clearSilenceTimer();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesToSend }),
        });

        if (!res.ok) {
          throw new Error(`Chat API responded with status ${res.status}`);
        }

        const data = await res.json();
        const reply =
          data.reply ||
          "Sorry, I had a small technical hiccup. Could you please say that again?";
        const toolCalls = data.toolCalls || [];

        handleAriaReply(reply, toolCalls);
      } catch (err) {
        console.error("[Voice Agent backend error]", err);
        handleAriaReply(
          "Sorry, I had a small technical hiccup. Could you please say that again?",
          []
        );
      }
    },
    [clearSilenceTimer, handleAriaReply]
  );

  // Process customer's spoken or typed utterance
  const handleCustomerUtterance = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !isCallActiveRef.current) return;

      silencePromptPlayedRef.current = false;
      clearSilenceTimer();
      setInterimText("");

      const customerItem: TranscriptItem = {
        id: "cust-" + Date.now(),
        speaker: "customer",
        text: trimmed,
        timestamp: getFormattedTime(),
      };

      const updatedTranscript = [...transcriptRef.current, customerItem];
      setTranscript(updatedTranscript);

      // Build message payload
      const messagesPayload = updatedTranscript.map((t) => ({
        role: (t.speaker === "customer" ? "user" : "assistant") as "user" | "assistant",
        content: t.text,
      }));

      sendToBackend(messagesPayload);
    },
    [clearSilenceTimer, sendToBackend]
  );

  // Barge-in interruption
  const interruptSpeech = useCallback(() => {
    if (callStateRef.current === "Speaking") {
      console.log("[Barge-in] Speech interrupted by customer");
      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
        cancelSpeechRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setCallState("Listening");
      resetSilenceTimer();
    }
  }, [resetSilenceTimer]);

  // Setup SpeechRecognition instance
  const initRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return null;
    }

    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let finalSpeech = "";
      let interimSpeech = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalSpeech += transcriptPart + " ";
        } else {
          interimSpeech += transcriptPart;
        }
      }

      // Check barge-in: If Aria is currently speaking and user starts speaking
      if (
        callStateRef.current === "Speaking" &&
        (interimSpeech.trim().length > 1 || finalSpeech.trim().length > 1)
      ) {
        interruptSpeech();
      }

      if (interimSpeech.trim().length > 0) {
        setInterimText(interimSpeech);
      }

      if (finalSpeech.trim().length > 0) {
        setInterimText("");
        handleCustomerUtterance(finalSpeech);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      console.warn("[SpeechRecognition Error]", event.error);

      if (event.error === "no-speech") {
        // Expected when user pauses; recognition continues
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage(
          "Microphone access was denied. Please allow microphone permissions in your browser address bar to speak with Aria."
        );
        return;
      }

      if (event.error === "network") {
        console.warn("Speech recognition network hiccup; attempting restart...");
      }
    };

    rec.onend = () => {
      // Auto-restart recognition when it ends unexpectedly while the call is active
      if (isCallActiveRef.current && callStateRef.current !== "Ended") {
        try {
          rec.start();
        } catch {
          // May already be active
        }
      }
    };

    return rec;
  }, [handleCustomerUtterance, interruptSpeech]);

  // Start Call
  const startCall = useCallback(async () => {
    setErrorMessage(null);
    setSummary(null);
    setTranscript([]);
    setInterimText("");
    silencePromptPlayedRef.current = false;

    // Request microphone permission upfront
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (micErr) {
      console.error("[Mic Permission Error]", micErr);
      setErrorMessage(
        "Microphone permission is required for the voice experience. Please allow microphone access or use the fallback text input below."
      );
      return;
    }

    // Reset in-memory mock orders on server
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
    } catch (e) {
      console.warn("Failed to reset orders on server:", e);
    }

    isCallActiveRef.current = true;
    setCallState("Speaking");

    // Initialize speech recognition
    const rec = initRecognition();
    recognitionRef.current = rec;

    // Initial greeting
    const greeting = "Hi, this is Aria from Aura Skincare. How can I help you today?";
    const greetingItem: TranscriptItem = {
      id: "greeting-" + Date.now(),
      speaker: "aria",
      text: greeting,
      timestamp: getFormattedTime(),
    };
    setTranscript([greetingItem]);

    // Speak greeting, then start recognition
    cancelSpeechRef.current = speakSentences([greeting], {
      onEnd: () => {
        if (isCallActiveRef.current) {
          setCallState("Listening");
          resetSilenceTimer();
          try {
            rec?.start();
          } catch (e) {
            console.warn("Recognition start error:", e);
          }
        }
      },
      onError: () => {
        if (isCallActiveRef.current) {
          setCallState("Listening");
          resetSilenceTimer();
          try {
            rec?.start();
          } catch (e) {
            console.warn("Recognition start error:", e);
          }
        }
      },
    });
  }, [initRecognition, resetSilenceTimer]);

  // End Call & generate summary
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;
    setCallState("Ended");
    clearSilenceTimer();
    setInterimText("");

    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch {
        // Already stopped
      }
    }

    // Extract tool calls from current transcript
    const toolCalls = transcriptRef.current.flatMap((t) => t.toolCalls || []);

    // Call /api/summary
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          toolCalls,
        }),
      });

      if (!res.ok) throw new Error("Summary API failed");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("[Summary generation error]", err);
      // Fallback summary
      setSummary({
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "RESOLVED",
        call_summary: "Call ended successfully.",
        tools_used: toolCalls.map((t) => t.name),
        customer_sentiment: "NEUTRAL",
        follow_up_needed: false,
      });
    } finally {
      setIsSummarizing(false);
    }
  }, [clearSilenceTimer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isCallActiveRef.current = false;
      clearSilenceTimer();
      if (cancelSpeechRef.current) cancelSpeechRef.current();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [clearSilenceTimer]);

  return {
    callState,
    transcript,
    interimText,
    errorMessage,
    summary,
    isSummarizing,
    isBrowserSupported,
    startCall,
    endCall,
    interruptSpeech,
    handleCustomerUtterance,
    setErrorMessage,
  };
}
