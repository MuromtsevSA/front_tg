import { applyNotification, createLocalChat } from '../src/lib/messages.js';
import { normalizePhone, phoneToChatId } from '../src/lib/phone.js';

const phone = normalizePhone('+7 (900) 123-45-67');
if (phone !== '79001234567') throw new Error(`phone ${phone}`);
if (normalizePhone('89001234567') !== '79001234567') throw new Error('8 prefix');

const pending = new Map();
let chats = [createLocalChat(phone)];
chats = [{
  ...chats[0],
  messages: [{
    id: 'local-1',
    text: 'Привет',
    direction: 'out',
    timestamp: 1_700_000_000_000,
    status: 'sending',
  }],
}];

chats = applyNotification(chats, {
  typeWebhook: 'outgoingAPIMessageReceived',
  timestamp: 1700000001,
  idMessage: '555',
  senderData: { chatId: '10000000', senderPhoneNumber: 79001234567, senderName: 'Анна' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
}, { pendingStatus: pending, activeId: phone });

if (chats.length !== 1) throw new Error(`expected 1 chat, got ${chats.length}`);
if (chats[0].messages.length !== 1) throw new Error('duplicate outgoing');
if (chats[0].messages[0].id !== '555') throw new Error('local id was not replaced');
if (!chats[0].aliases.includes('10000000')) throw new Error('alias missing');
if (chats[0].title !== '+7 900 123-45-67') throw new Error(`title ${chats[0].title}`);

chats = applyNotification(chats, {
  typeWebhook: 'outgoingMessageStatus',
  chatId: '10000000',
  idMessage: '555',
  status: 'delivered',
}, { pendingStatus: pending, activeId: phone });
if (chats[0].messages[0].status !== 'delivered') throw new Error('status');

chats = applyNotification(chats, {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1700000002,
  idMessage: '777',
  senderData: {
    chatId: '10000000',
    senderPhoneNumber: 79001234567,
    senderName: 'Анна',
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'И тебе привет' } },
}, { pendingStatus: pending, activeId: 'other' });

if (chats.length !== 1) throw new Error('incoming created a second chat');
if (chats[0].messages.at(-1).text !== 'И тебе привет') throw new Error('reply missing');
if (chats[0].unread !== 1) throw new Error(`unread ${chats[0].unread}`);
if (chats[0].title !== 'Анна') throw new Error(`reply title ${chats[0].title}`);
if (chats[0].chatId !== phoneToChatId(phone)) throw new Error('send id changed');

const unknown = applyNotification([], {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1700000003,
  idMessage: '888',
  senderData: { chatId: '42', senderName: 'Борис', senderPhoneNumber: 79007654321 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Есть кто?' } },
}, { pendingStatus: pending, activeId: null });
if (unknown.length !== 1 || unknown[0].phone !== '79007654321') throw new Error('new incoming chat');

console.log('ok');
