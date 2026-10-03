import { digitsFromPersonalChatId, formatPhone, phoneToChatId } from './phone.js';

const STATUS_RANK = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function mergeStatus(current, next) {
  if (!next) return current || 'sent';
  if (next === 'failed' || next === 'noAccount') return next;
  if (current === 'failed' || current === 'noAccount') return next;
  const left = STATUS_RANK[current] ?? 0;
  const right = STATUS_RANK[next] ?? 0;
  return right >= left ? next : current;
}

export function extractText(messageData) {
  if (!messageData) return null;
  if (messageData.typeMessage === 'textMessage') {
    return messageData.textMessageData?.textMessage ?? '';
  }
  if (messageData.typeMessage === 'extendedTextMessage') {
    return messageData.extendedTextMessageData?.text ?? '';
  }
  return null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

export function chatMatches(chat, chatId, phone) {
  const id = chatId == null ? '' : String(chatId);
  if (id && (chat.chatId === id || chat.aliases?.includes(id))) return true;
  const phoneDigits = phone ? String(phone).replace(/\D/g, '') : '';
  if (phoneDigits && chat.phone === phoneDigits) return true;
  const fromId = digitsFromPersonalChatId(id);
  if (fromId && chat.phone === fromId) return true;
  return false;
}

function addAlias(chat, chatId) {
  if (!chatId) return chat.aliases || [];
  return unique([...(chat.aliases || []), chat.chatId, String(chatId)]);
}

function messageTime(body) {
  const seconds = Number(body?.timestamp);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return Date.now();
}

function senderPhone(body) {
  const value = body?.senderData?.senderPhoneNumber;
  if (value == null || value === '') return '';
  return String(value).replace(/\D/g, '');
}

function preferTitle(current, incoming, phone) {
  const formatted = phone ? formatPhone(phone) : '';
  const name = String(incoming || '').trim();
  if (!name) return current;
  if (!current || current === formatted || current === phone) return name;
  return current;
}

function dedupeMessages(messages) {
  const byId = new Map();
  messages.forEach((message) => {
    const previous = byId.get(message.id);
    if (!previous) {
      byId.set(message.id, message);
      return;
    }
    byId.set(message.id, {
      ...previous,
      ...message,
      status: mergeStatus(previous.status, message.status),
      error: message.error || previous.error,
    });
  });
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function replacePendingOutgoing(messages, nextMessage) {
  const pendingIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => (
      message.direction === 'out'
      && String(message.id).startsWith('local-')
      && message.text === nextMessage.text
    ))?.index;

  if (pendingIndex == null) return null;
  const copy = messages.slice();
  const pending = copy[pendingIndex];
  copy[pendingIndex] = {
    ...pending,
    id: nextMessage.id,
    timestamp: nextMessage.timestamp || pending.timestamp,
    status: mergeStatus(pending.status === 'sending' ? 'sent' : pending.status, nextMessage.status),
  };
  return copy;
}

export function createLocalChat(phone) {
  const chatId = phoneToChatId(phone);
  return {
    id: phone,
    phone,
    chatId,
    aliases: [chatId],
    title: formatPhone(phone),
    messages: [],
    unread: 0,
    createdAt: Date.now(),
  };
}

function blankChat({ chatId, phone, title }) {
  const personal = phone ? phoneToChatId(phone) : '';
  return {
    id: phone || String(chatId),
    phone: phone || '',
    chatId: personal || String(chatId),
    aliases: unique([personal, chatId]),
    title: title || (phone ? formatPhone(phone) : String(chatId)),
    messages: [],
    unread: 0,
    createdAt: Date.now(),
  };
}

function mergeChatList(chats, activeId) {
  const merged = [];
  chats.forEach((chat) => {
    const index = merged.findIndex((existing) => (
      (chat.phone && existing.phone && chat.phone === existing.phone)
      || (chat.aliases || []).some((alias) => (existing.aliases || []).includes(alias))
    ));
    if (index === -1) {
      merged.push({ ...chat, aliases: unique(chat.aliases) });
      return;
    }
    const existing = merged[index];
    const primary = chat.id === activeId ? chat : existing;
    const secondary = primary === existing ? chat : existing;
    const phone = primary.phone || secondary.phone;
    merged[index] = {
      ...primary,
      id: primary.id,
      phone,
      chatId: phone ? phoneToChatId(phone) : primary.chatId,
      aliases: unique([
        ...(primary.aliases || []),
        ...(secondary.aliases || []),
        primary.chatId,
        secondary.chatId,
      ]),
      title: preferTitle(primary.title, secondary.title, phone),
      messages: dedupeMessages([...(primary.messages || []), ...(secondary.messages || [])]),
      unread: (primary.unread || 0) + (secondary.unread || 0),
      createdAt: Math.min(primary.createdAt || Date.now(), secondary.createdAt || Date.now()),
    };
  });
  return merged;
}

export function sortChats(chats) {
  return [...chats].sort((a, b) => {
    const aTime = a.messages?.at(-1)?.timestamp || a.createdAt || 0;
    const bTime = b.messages?.at(-1)?.timestamp || b.createdAt || 0;
    return bTime - aTime;
  });
}

function applyStatus(chats, body, pendingStatus) {
  const idMessage = body.idMessage == null ? '' : String(body.idMessage);
  if (!idMessage) return chats;
  let found = false;
  const next = chats.map((chat) => {
    const index = chat.messages.findIndex((message) => message.id === idMessage);
    if (index === -1) return chat;
    found = true;
    const messages = chat.messages.slice();
    messages[index] = {
      ...messages[index],
      status: mergeStatus(messages[index].status, body.status),
    };
    return {
      ...chat,
      aliases: addAlias(chat, body.chatId),
      messages,
    };
  });
  if (!found) pendingStatus?.set(idMessage, body.status);
  return next;
}

function applyChatMessage(chats, body, activeId) {
  const chatId = body.senderData?.chatId ?? body.chatId;
  const phone = senderPhone(body);
  const text = extractText(body.messageData);
  const direction = body.typeWebhook === 'incomingMessageReceived' ? 'in' : 'out';
  const id = body.idMessage == null ? `local-${crypto.randomUUID()}` : String(body.idMessage);
  const incoming = {
    id,
    text: text == null ? 'Нетекстовое сообщение' : text,
    direction,
    timestamp: messageTime(body),
    status: direction === 'out' ? 'sent' : undefined,
  };

  let found = false;
  const next = chats.map((chat) => {
    if (!chatMatches(chat, chatId, phone)) return chat;
    found = true;
    const existing = chat.messages.find((message) => message.id === incoming.id);
    let messages;
    if (existing) {
      messages = chat.messages.map((message) => (
        message.id === incoming.id
          ? { ...message, status: mergeStatus(message.status, incoming.status) }
          : message
      ));
    } else if (direction === 'out') {
      messages = replacePendingOutgoing(chat.messages, incoming) || [...chat.messages, incoming];
    } else {
      messages = [...chat.messages, incoming];
    }
    const titleSource = direction === 'in'
      ? (body.senderData?.chatName || body.senderData?.senderName)
      : '';
    const isActive = chat.id === activeId;
    const addedIncoming = direction === 'in' && !existing;
    return {
      ...chat,
      phone: chat.phone || phone,
      aliases: addAlias(chat, chatId),
      title: preferTitle(chat.title, titleSource, chat.phone || phone),
      messages: dedupeMessages(messages),
      unread: addedIncoming && !isActive ? (chat.unread || 0) + 1 : chat.unread || 0,
    };
  });

  if (found) return mergeChatList(next, activeId);

  const created = blankChat({
    chatId,
    phone,
    title: body.senderData?.chatName || body.senderData?.senderName,
  });
  created.messages = [incoming];
  created.unread = direction === 'in' && created.id !== activeId ? 1 : 0;
  return mergeChatList([...chats, created], activeId);
}

export function applyNotification(chats, body, { pendingStatus, activeId } = {}) {
  if (!body || typeof body !== 'object') return chats;
  if (body.typeWebhook === 'outgoingMessageStatus') {
    return sortChats(mergeChatList(applyStatus(chats, body, pendingStatus), activeId));
  }
  if (
    body.typeWebhook === 'incomingMessageReceived'
    || body.typeWebhook === 'outgoingMessageReceived'
    || body.typeWebhook === 'outgoingAPIMessageReceived'
  ) {
    return sortChats(applyChatMessage(chats, body, activeId));
  }
  return chats;
}

export function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function formatDayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left, right) => (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
  if (sameDay(date, today)) return 'Сегодня';
  if (sameDay(date, yesterday)) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function statusLabel(status) {
  switch (status) {
    case 'sending':
      return 'отправка';
    case 'sent':
      return 'отправлено';
    case 'delivered':
      return 'доставлено';
    case 'read':
      return 'прочитано';
    case 'failed':
      return 'не отправлено';
    case 'noAccount':
      return 'нет Telegram на этом номере';
    default:
      return '';
  }
}
