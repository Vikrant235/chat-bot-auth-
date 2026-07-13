/*
# Add database-enforced rate limits

## What this does
Enforces two hard caps at the database level (cannot be bypassed by client):
1. Max 5 chats per user (BEFORE INSERT trigger on chats)
2. Max 20 messages per chat (BEFORE INSERT trigger on messages)

Also auto-updates chats.updated_at when a new message is inserted.

## Security
Trigger functions use SECURITY DEFINER so they can count rows across the
owner's data; they only read counts and never expose data.
*/

-- Max 5 chats per user
CREATE OR REPLACE FUNCTION enforce_max_chats_per_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chat_count integer;
BEGIN
  SELECT COUNT(*) INTO chat_count FROM chats WHERE user_id = NEW.user_id;
  IF chat_count >= 5 THEN
    RAISE EXCEPTION 'CHAT_LIMIT_REACHED: You can have at most 5 chats. Please delete one before creating a new chat.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_chats_per_user ON chats;
CREATE TRIGGER trg_enforce_max_chats_per_user
  BEFORE INSERT ON chats
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_chats_per_user();

-- Max 20 messages per chat
CREATE OR REPLACE FUNCTION enforce_max_messages_per_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_count integer;
  chat_owner uuid;
BEGIN
  SELECT user_id INTO chat_owner FROM chats WHERE id = NEW.chat_id;
  IF chat_owner IS NULL THEN
    RAISE EXCEPTION 'Parent chat does not exist.';
  END IF;
  SELECT COUNT(*) INTO msg_count FROM messages WHERE chat_id = NEW.chat_id;
  IF msg_count >= 20 THEN
    RAISE EXCEPTION 'MESSAGE_LIMIT_REACHED: This chat has reached the maximum of 20 messages. Start a new chat to continue.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_messages_per_chat ON messages;
CREATE TRIGGER trg_enforce_max_messages_per_chat
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_messages_per_chat();

-- Auto-touch chats.updated_at on new message
CREATE OR REPLACE FUNCTION touch_chat_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_chat_updated_at ON messages;
CREATE TRIGGER trg_touch_chat_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_chat_updated_at();
