# Account chat deletion

Players can delete a single question/reply or the selected conversation. The UI requires confirmation, retains local text on an unconfirmed failure, clears the message preview after closing confirmation, and keeps deletion controls disabled during generation or conversation switching. Deleting a question updates the conversation title so it does not retain the deleted question. Existing daily usage is preserved.

Deletion uses existing Supabase ownership and valid-session RLS policies. Both filters and delete-returning IDs are checked; an empty result requires a fresh active-player check. Deleting a conversation cascades to its messages through the existing composite foreign key. No schema changes or alternate chat store are introduced.

Before deletion, `/forget` authenticates the active player server-side and invalidates that account/conversation's model memory, scoped answer/intent caches, and successful request cache. It never takes the owner from the request body. An epoch prevents an already-running reply from restoring forgotten memory or being returned as a successful answer. Unknown conversations do not create unlimited epoch records. Empty successfully read Supabase history is authoritative instead of falling back to old model memory. Legacy unscoped caches are not reused by the new cache version and expire through existing cleanup; no other accounts' caches are purged.

Refresh checks a previously synced conversation still exists before uploading pending content. Already synced messages are excluded from legacy migration, preventing unnecessary reuploads. A deleted conversation produces a fresh draft locally and does not recreate its old ID. Other updated clients observe deletion when they next synchronize/open/focus their chat. This is not realtime push.

Validation on 2026-10-08:

- 81 automated tests passed, including real worker-source tests for owner isolation, pagination, quota preservation, malformed/unauthenticated deletion requests, and an in-flight response crossing deletion.
- Headless desktop and 320px browser fixtures passed single-message delete/cancel, whole-conversation cascade, title cleanup, two independent contexts for one account, another account's isolation, failed deletion keeping local content, no resurrection, and no page errors. Database and AI endpoint are mocked.
- Existing retry/synchronization browser checks passed against the new UI.
- Live Supabase read queries confirmed the DELETE/SELECT/UPDATE ownership policies, valid-session checks, and ON DELETE CASCADE foreign key. A privileged rollback-only write verification could not complete: the connector returned `Invalid or expired requestState`. No live player-account deletion or two physical-device acceptance test is claimed.

UI proof uses disposable fixture content, saved under `work/chat-delete-mobile-2026-10-08.png` and `work/chat-delete-desktop-2026-10-08.png` in the maintenance workspace.
