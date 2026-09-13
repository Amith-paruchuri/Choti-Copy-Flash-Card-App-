import { IMPORT_CAPS } from "@/lib/import/caps";

interface Message {
  sender: string;
  text: string;
}

// [15/01/2024, 9:30:12 AM] Alice: hi   (iOS, brackets)
const IOS_LINE =
  /^\[(?:‎)?[^\]]+\]\s(?<sender>[^:]+):\s(?<msg>[\s\S]*)$/;
// 15/01/2024, 09:30 - Alice: hi        (Android, dash)
const ANDROID_LINE =
  /^\d{1,2}[./]\d{1,2}[./]\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][.\s]?[Mm][.]?)?\s-\s(?<sender>[^:]+):\s(?<msg>[\s\S]*)$/;

const MEDIA_PLACEHOLDER =
  /^(?:‎)?(?:<media omitted>|.*(?:image|video|audio|sticker|GIF|document|Contact card) omitted|.*\.(?:jpg|jpeg|png|opus|mp4|webp)\s*\(file attached\))\s*$/i;

const SYSTEM_LINE =
  /(?:Messages and calls are end-to-end encrypted|created group|added you|changed the subject|changed this group's icon|left$|You deleted this message|This message was deleted)/i;

/** True if the first lines look like a WhatsApp chat export. */
export function looksLikeWhatsappChat(txt: string): boolean {
  const head = txt.replace(/\r\n/g, "\n").split("\n").slice(0, 40);
  const hits = head.filter(
    (l) => IOS_LINE.test(l) || ANDROID_LINE.test(l),
  ).length;
  return hits >= 3;
}

/**
 * Parse a WhatsApp `_chat.txt` export into messages, dropping media
 * placeholders and system notices, then render a plain transcript.
 */
export function parseWhatsappChat(txt: string): {
  transcript: string;
  messageCount: number;
  truncated: boolean;
} {
  const lines = txt.replace(/\r\n/g, "\n").split("\n");
  const messages: Message[] = [];

  for (const line of lines) {
    const m = line.match(IOS_LINE) ?? line.match(ANDROID_LINE);
    if (m?.groups) {
      messages.push({
        sender: m.groups.sender.trim(),
        text: m.groups.msg.trim(),
      });
    } else if (messages.length > 0 && line.trim()) {
      // continuation of the previous multi-line message
      messages[messages.length - 1].text += `\n${line}`;
    }
  }

  const cleaned = messages.filter(
    (msg) =>
      msg.text &&
      !MEDIA_PLACEHOLDER.test(msg.text) &&
      !SYSTEM_LINE.test(msg.text),
  );

  const truncated = cleaned.length > IMPORT_CAPS.maxWhatsappMessages;
  const kept = cleaned.slice(0, IMPORT_CAPS.maxWhatsappMessages);

  const transcript = kept.map((m) => `${m.sender}: ${m.text}`).join("\n");
  return { transcript, messageCount: kept.length, truncated };
}
