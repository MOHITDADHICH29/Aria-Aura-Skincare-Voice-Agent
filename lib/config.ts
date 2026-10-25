/**
 * Centralized Configuration Constants with Rationale
 */

// Voice Recognition Language Settings
// "en-IN" recognizes Indian English and phonetically transcribes common Hinglish terms in Roman letters.
export const RECOGNITION_LANG_ENGLISH = "en-IN";
// Default "en-IN" as recommended; if "hi-IN" is preferred, set here.
export const RECOGNITION_LANG_HINGLISH = "en-IN";

// Silence and Speech Detection Timings
// End of speech detection: 700ms of silence after an interim result finalizes the customer turn.
export const SPEECH_SILENCE_TIMEOUT_MS = 700;
// Wait 500ms after Aria finishes speaking before starting SpeechRecognition to prevent audio loopback.
export const TURN_TRANSITION_DELAY_MS = 500;
// Language greeting question timeout: repeat prompt once if no response in 8 seconds.
export const LANGUAGE_CHOICE_TIMEOUT_MS = 8000;

// Gemini Model Configuration
// Default fast flash model for sub-second first-token latency
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
// Default female voice for Gemini TTS
export const DEFAULT_GEMINI_TTS_VOICE = "Kore";
// Audio cache version to invalidate stale cached audio
export const AUDIO_CACHE_VERSION = "v3_wav_kore";

// TTS Chunking Limits
// Send whole reply up to 400 characters as ONE request; if longer, at most two chunks of >= 120 chars
export const TTS_CHUNK_MIN_CHARS = 120;
export const TTS_CHUNK_TARGET_CHARS = 240;
export const TTS_CHUNK_MAX_CHARS = 400;

// Conversation Trimming
// Keep maximum 12 history turns to minimize token load and LLM prompt processing latency
export const MAX_HISTORY_TURNS = 12;
// Limit max output tokens for fast voice generation
export const MAX_OUTPUT_TOKENS = 120;
// Network timeout for TTS requests before triggering female browser fallback (12 seconds)
export const TTS_NETWORK_TIMEOUT_MS = 12000;

// Browser TTS Primary Flag
// Set to false: Gemini TTS is primary; browser voice is used only as fallback after retry fails
export const USE_BROWSER_TTS_PRIMARY = false;
