-- Migration v4 — Outlook draft on close (run this in Supabase SQL Editor)
--
-- Purely additive. Used by the "Close Ticket & Open Outlook Draft" button
-- (src/outlookDraft.js, api/outlook.js).
--
--   outlook_message_id  Graph id of Herfy's original email in info@altases.sa
--                       (set with "Link original email"). When present the
--                       draft is created with createReply in that thread.
--   outlook_message_subject  Subject of that email, for display only.
--   outlook_draft_id    Graph id of the draft created for this request. Reused
--                       when the button is pressed again.
--   outlook_draft_link  Outlook Web link that opens the draft.

alter table requests add column if not exists outlook_message_id      text default '';
alter table requests add column if not exists outlook_message_subject text default '';
alter table requests add column if not exists outlook_draft_id        text default '';
alter table requests add column if not exists outlook_draft_link      text default '';
