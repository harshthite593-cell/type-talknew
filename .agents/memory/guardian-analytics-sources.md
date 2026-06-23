---
name: Guardian Analytics Data Sources
description: Where each of the 5 Guardian Dashboard widgets gets its data.
---

## Rule
All guardian analytics are derived from existing AsyncStorage data — no new server calls needed.

**Why:** App is locally-first; guardian data is on the same device as the user.

**How to apply:**

| Widget | Source key | What's read |
|--------|-----------|-------------|
| Words Spoken Today | `tts_speech_logs_v1` | `SpeechLog[]` filtered to today |
| Emergency Panel Usage | `tts_emergency_events_v1` | `EmergencyEvent[]` filtered to today |
| Speaking Analysis | `tts_speech_logs_v1` | Clarity score, avg word length, tone, language list |
| Mood Analysis | `tts_speech_logs_v1` | Keyword sentiment (positive vs urgent keywords) |
| App Activity | `tts_speech_logs_v1` + `guardian_session_log_v1` | Session count, active minutes, first/last seen |

`guardian_session_log_v1` stores `SessionEntry[]` with `{id, startTs, endTs}` — written by `recordSessionStart/recordSessionEnd` from `guardianAnalytics.ts`.

All data reads are in `artifacts/mobile/utils/guardianAnalytics.ts` via the `getGuardianStats()` function.
