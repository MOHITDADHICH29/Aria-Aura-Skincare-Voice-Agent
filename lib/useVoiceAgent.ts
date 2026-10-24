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

/**
 * Echo filter: Checks if customer speech is a reflection of Aria's last TTS utterance.
 * Returns true if more than 60% of customer words appear in Aria's last reply.
 */
function isEchoOfAria(customerText: string, lastAriaText: string): boolean {
  if (!customerText || !lastAriaText) return false;

  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

  const customerWords = tokenize(customerText);
  if (customerWords.length === 0) return false;

  const ariaWords = new Set(tokenize(lastAriaText));
  let matchCount = 0;

  for (const word of customerWords) {
    if (ariaWords.has(word)) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / customerWords.length;
  // If > 60% of words were just spoken by Aria, discard as acoustic feedback
  const isEcho = matchRatio > 0.6;
  if (isEcho) {
    console.warn(
      `[Echo Filter] Discarding TTS acoustic echo (${(matchRatio * 100).toFixed(0)}% match): "${customerText}"`
    );
  }
  return isEcho;
}

export function useVoiceAgent() {
  const [callState, setCallState] = useState<CallState>("Idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);

  // Headphones mode: default OFF (half-duplex). When ON, allows full-duplex voice barge-in.
  const [headphonesMode, setHeadphonesMode] = useState<boolean>(false);

  // References to prevent race conditions and capture mutable state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const callStateRef = useRef<CallState>("Idle");
  const headphonesModeRef = useRef<boolean>(false);
  const lastAriaReplyRef = useRef<string>("");

  const isRecognitionRunningRef = useRef<boolean>(false);
  const isStartingRecognitionRef = useRef<boolean>(false);

  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silencePromptPlayedRef = useRef<boolean>(false);
  const transcriptRef = useRef<TranscriptItem[]>([]);

  // Synchronize refs with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    headphonesModeRef.current = headphonesMode;
  }, [headphonesMode]);

  // Check browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const hasSpeechRecognition = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
      const hasSpeechSynthesis = "speechSynthesis" in window;
      setIsBrowserSupported(hasSpeechRecognition && hasSpeechSynthesis);
    }
  }, []);

  const getFormattedTime = () => {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearSpeechEndTimer = useCallback(() => {
    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
  }, []);

  // Safe SpeechRecognition start guarded against race conditions
  const startRecognitionSafely = useCallback(() => {
    if (
      !recognitionRef.current ||
      !isCallActiveRef.current ||
      isRecognitionRunningRef.current ||
      isStartingRecognitionRef.current
    ) {
      return;
    }

    isStartingRecognitionRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "InvalidStateError" || e?.message?.includes("already started")) {
        isRecognitionRunningRef.current = true;
      } else {
        console.warn("[SpeechRecognition start error]", err);
      }
    } finally {
      isStartingRecognitionRef.current = false;
    }
  }, []);

  // Safe SpeechRecognition stop / abort
  const stopRecognitionSafely = useCallback((abort = false) => {
    if (!recognitionRef.current) return;
    try {
      if (abort) {
        recognitionRef.current.abort();
      } else {
        recognitionRef.current.stop();
      }
    } catch (err) {
      console.warn("[SpeechRecognition stop/abort error]", err);
    } finally {
      isRecognitionRunningRef.current = false;
      isStartingRecognitionRef.current = false;
    }
  }, []);

  // Tap-to-interrupt handler
  const interruptSpeech = useCallback(() => {
    if (callStateRef.current === "Speaking") {
      console.log("[Tap-to-Interrupt] Speech cancelled by user");
      clearSpeechEndTimer();

      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
        cancelSpeechRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      setCallState("Listening");
      resetSilenceTimer();
      // Immediately start listening when interrupted
      startRecognitionSafely();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSpeechEndTimer, startRecognitionSafely]);

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
    lastAriaReplyRef.current = silenceMessage;

    const ariaItem: TranscriptItem = {
      id: "aria-silence-" + Date.now(),
      speaker: "aria",
      text: silenceMessage,
      timestamp: getFormattedTime(),
    };
    setTranscript((prev) => [...prev, ariaItem]);
    setCallState("Speaking");

    // Half-duplex: abort recognition while speaking unless in headphones mode
    if (!headphonesModeRef.current) {
      stopRecognitionSafely(true);
    }

    cancelSpeechRef.current = speakSentences([silenceMessage], {
      onEnd: () => {
        if (isCallActiveRef.current) {
          clearSpeechEndTimer();
          // Requirement 1: Restart only after 500 ms delay
          speechEndTimerRef.current = setTimeout(() => {
            if (isCallActiveRef.current) {
              setCallState("Listening");
              startRecognitionSafely();
            }
          }, 500);
        }
      },
      onError: () => {
        if (isCallActiveRef.current) {
          clearSpeechEndTimer();
          speechEndTimerRef.current = setTimeout(() => {
            if (isCallActiveRef.current) {
              setCallState("Listening");
              startRecognitionSafely();
            }
          }, 500);
        }
      },
    });
  }, [clearSpeechEndTimer, startRecognitionSafely, stopRecognitionSafely]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (isCallActiveRef.current && !silencePromptPlayedRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        triggerSilencePrompt();
      }, 12000);
    }
  }, [clearSilenceTimer, triggerSilencePrompt]);

  // Handle incoming AI reply and speak it
  const handleAriaReply = useCallback(
    (replyText: string, toolCalls: ToolCallRecord[]) => {
      if (!isCallActiveRef.current) return;

      lastAriaReplyRef.current = replyText;

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
      clearSpeechEndTimer();

      // Requirement 1: Call recognition.abort() when state becomes Speaking in default mode
      if (!headphonesModeRef.current) {
        stopRecognitionSafely(true);
      }

      const sentences = splitIntoSentences(replyText);

      cancelSpeechRef.current = speakSentences(sentences, {
        onStart: () => {
          // If in headphones mode, keep recognition active to support voice barge-in
          if (headphonesModeRef.current && isCallActiveRef.current) {
            startRecognitionSafely();
          }
        },
        onEnd: () => {
          if (isCallActiveRef.current) {
            clearSpeechEndTimer();
            // Requirement 1: Only restart recognition after speechSynthesis finishes after a 500 ms delay
            speechEndTimerRef.current = setTimeout(() => {
              if (isCallActiveRef.current) {
                setCallState("Listening");
                resetSilenceTimer();
                startRecognitionSafely();
              }
            }, 500);
          }
        },
        onError: () => {
          if (isCallActiveRef.current) {
            clearSpeechEndTimer();
            speechEndTimerRef.current = setTimeout(() => {
              if (isCallActiveRef.current) {
                setCallState("Listening");
                resetSilenceTimer();
                startRecognitionSafely();
              }
            }, 500);
          }
        },
      });
    },
    [clearSilenceTimer, clearSpeechEndTimer, resetSilenceTimer, startRecognitionSafely, stopRecognitionSafely]
  );

  // Send conversation to backend
  const sendToBackend = useCallback(
    async (messagesToSend: { role: "user" | "assistant"; content: string }[]) => {
      setCallState("Thinking");
      clearSilenceTimer();

      // Half-duplex: abort recognition during thinking in default mode
      if (!headphonesModeRef.current) {
        stopRecognitionSafely(true);
      }

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
    [clearSilenceTimer, handleAriaReply, stopRecognitionSafely]
  );

  // Process customer's spoken or typed utterance
  const handleCustomerUtterance = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !isCallActiveRef.current) return;

      // Requirement 4: Echo filter before sending to /api/chat
      if (isEchoOfAria(trimmed, lastAriaReplyRef.current)) {
        setInterimText("");
        return;
      }

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

      const messagesPayload = updatedTranscript.map((t) => ({
        role: (t.speaker === "customer" ? "user" : "assistant") as "user" | "assistant",
        content: t.text,
      }));

      sendToBackend(messagesPayload);
    },
    [clearSilenceTimer, sendToBackend]
  );

  // Initialize single SpeechRecognition instance
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

    rec.onstart = () => {
      isRecognitionRunningRef.current = true;
      isStartingRecognitionRef.current = false;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      // Requirement 1: Ignore ALL recognition results while state is Thinking or Speaking in default mode
      if (
        !headphonesModeRef.current &&
        (callStateRef.current === "Thinking" || callStateRef.current === "Speaking")
      ) {
        return;
      }

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

      // Requirement 3: When Headphones mode is ON, allow voice barge-in on first interim result
      if (
        headphonesModeRef.current &&
        callStateRef.current === "Speaking" &&
        (interimSpeech.trim().length > 1 || finalSpeech.trim().length > 1)
      ) {
        interruptSpeech();
      }

      if (callStateRef.current === "Listening") {
        if (interimSpeech.trim().length > 0) {
          setInterimText(interimSpeech);
        }

        if (finalSpeech.trim().length > 0) {
          setInterimText("");
          handleCustomerUtterance(finalSpeech);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      console.warn("[SpeechRecognition Error]", event.error);

      if (event.error === "no-speech") {
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage(
          "Microphone access was denied. Please allow microphone permissions in your browser address bar to speak with Aria."
        );
        return;
      }

      if (event.error === "already-started") {
        isRecognitionRunningRef.current = true;
        isStartingRecognitionRef.current = false;
      }
    };

    rec.onend = () => {
      isRecognitionRunningRef.current = false;
      isStartingRecognitionRef.current = false;

      // Auto-restart recognition ONLY when call is active and state is Listening
      // (or in headphones mode while active)
      if (
        isCallActiveRef.current &&
        callStateRef.current !== "Ended" &&
        (callStateRef.current === "Listening" || headphonesModeRef.current)
      ) {
        startRecognitionSafely();
      }
    };

    return rec;
  }, [handleCustomerUtterance, interruptSpeech, startRecognitionSafely]);

  // Start Call
  const startCall = useCallback(async () => {
    setErrorMessage(null);
    setSummary(null);
    setTranscript([]);
    setInterimText("");
    clearSpeechEndTimer();
    silencePromptPlayedRef.current = false;

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

    // Initialize single recognition instance
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    const greeting = "Hi, this is Aria from Aura Skincare. How can I help you today?";
    lastAriaReplyRef.current = greeting;

    const greetingItem: TranscriptItem = {
      id: "greeting-" + Date.now(),
      speaker: "aria",
      text: greeting,
      timestamp: getFormattedTime(),
    };
    setTranscript([greetingItem]);

    // Ensure recognition is stopped while greeting plays in default mode
    if (!headphonesModeRef.current) {
      stopRecognitionSafely(true);
    }

    cancelSpeechRef.current = speakSentences([greeting], {
      onEnd: () => {
        if (isCallActiveRef.current) {
          clearSpeechEndTimer();
          // Requirement 1: 500 ms delay before starting recognition after speech finishes
          speechEndTimerRef.current = setTimeout(() => {
            if (isCallActiveRef.current) {
              setCallState("Listening");
              resetSilenceTimer();
              startRecognitionSafely();
            }
          }, 500);
        }
      },
      onError: () => {
        if (isCallActiveRef.current) {
          clearSpeechEndTimer();
          speechEndTimerRef.current = setTimeout(() => {
            if (isCallActiveRef.current) {
              setCallState("Listening");
              resetSilenceTimer();
              startRecognitionSafely();
            }
          }, 500);
        }
      },
    });
  }, [clearSpeechEndTimer, initRecognition, resetSilenceTimer, startRecognitionSafely, stopRecognitionSafely]);

  // End Call & generate summary
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;
    setCallState("Ended");
    clearSilenceTimer();
    clearSpeechEndTimer();
    setInterimText("");

    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    stopRecognitionSafely(true);
    recognitionRef.current = null;

    const toolCalls = transcriptRef.current.flatMap((t) => t.toolCalls || []);

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
  }, [clearSilenceTimer, clearSpeechEndTimer, stopRecognitionSafely]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isCallActiveRef.current = false;
      clearSilenceTimer();
      clearSpeechEndTimer();
      if (cancelSpeechRef.current) cancelSpeechRef.current();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      stopRecognitionSafely(true);
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer, clearSpeechEndTimer, stopRecognitionSafely]);

  return {
    callState,
    transcript,
    interimText,
    errorMessage,
    summary,
    isSummarizing,
    isBrowserSupported,
    headphonesMode,
    setHeadphonesMode,
    startCall,
    endCall,
    interruptSpeech,
    handleCustomerUtterance,
    setErrorMessage,
  };
}
