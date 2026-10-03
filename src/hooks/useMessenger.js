import { useEffect, useRef, useState } from 'react';
import {
  deleteNotification,
  describeInstanceState,
  getSettings,
  getStateInstance,
  receiveNotification,
  sendMessage,
} from '../lib/api.js';
import { applyNotification, createLocalChat, mergeStatus } from '../lib/messages.js';
import { isValidPhone, normalizePhone } from '../lib/phone.js';
import { clearCredentials, loadChats, loadCredentials, saveChats, saveCredentials } from '../lib/storage.js';

const RECEIVE_TIMEOUT = 20;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeCredentials(input) {
  return {
    apiUrl: String(input.apiUrl || '').trim().replace(/\/+$/, ''),
    idInstance: String(input.idInstance || '').trim(),
    apiTokenInstance: String(input.apiTokenInstance || '').trim(),
  };
}

export function useMessenger() {
  const initialCredentials = loadCredentials();
  const [credentials, setCredentials] = useState(initialCredentials);
  const [chats, setChats] = useState(() => (
    initialCredentials ? loadChats(initialCredentials.idInstance) : []
  ));
  const [activeId, setActiveId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [composeError, setComposeError] = useState('');
  const [pollError, setPollError] = useState('');
  const [webhookWarning, setWebhookWarning] = useState('');
  const [instanceState, setInstanceState] = useState('');
  const [connected, setConnected] = useState(false);
  const pendingStatus = useRef(new Map());
  const activeIdRef = useRef(activeId);
  const receiptFailures = useRef({ id: null, count: 0 });

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!credentials) return;
    saveChats(credentials.idInstance, chats);
  }, [chats, credentials]);

  useEffect(() => {
    if (!credentials) return undefined;
    const controller = new AbortController();

    (async () => {
      try {
        const state = await getStateInstance(credentials, controller.signal);
        setInstanceState(state?.stateInstance || '');
        if (state?.stateInstance && state.stateInstance !== 'authorized') {
          setPollError(describeInstanceState(state.stateInstance));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setPollError(error.message);
      }

      try {
        const settings = await getSettings(credentials, controller.signal);
        if (settings?.webhookUrl) {
          setWebhookWarning('В консоли GREEN-API заполнен webhookUrl. Очистите его, иначе ответы не появятся в этом чате. После очистки подождите около минуты.');
        } else {
          setWebhookWarning('');
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    })();

    return () => controller.abort();
  }, [credentials]);

  useEffect(() => {
    if (!credentials) return undefined;
    const controller = new AbortController();
    let stopped = false;

    (async () => {
      while (!stopped) {
        try {
          setConnected(true);
          const notification = await receiveNotification(credentials, RECEIVE_TIMEOUT, controller.signal);
          setPollError('');
          if (!notification?.receiptId) continue;

          const body = notification.body;
          if (body?.typeWebhook === 'stateInstanceChanged') {
            setInstanceState(body.stateInstance || '');
          }

          setChats((current) => applyNotification(current, body, {
            pendingStatus: pendingStatus.current,
            activeId: activeIdRef.current,
          }));

          try {
            await deleteNotification(credentials, notification.receiptId, controller.signal);
            receiptFailures.current = { id: null, count: 0 };
          } catch (error) {
            if (controller.signal.aborted) return;
            const same = receiptFailures.current.id === notification.receiptId;
            const count = same ? receiptFailures.current.count + 1 : 1;
            receiptFailures.current = { id: notification.receiptId, count };
            if (count < 3) throw error;
          }
        } catch (error) {
          if (controller.signal.aborted || stopped) return;
          setConnected(false);
          setPollError(error.message);
          try {
            await sleep(3000, controller.signal);
          } catch {
            return;
          }
        }
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [credentials]);

  async function login(input) {
    const next = normalizeCredentials(input);
    if (!next.apiUrl || !next.idInstance || !next.apiTokenInstance) {
      setAuthError('Заполните apiUrl, idInstance и apiTokenInstance.');
      return;
    }
    if (!/^https?:\/\//i.test(next.apiUrl)) {
      setAuthError('apiUrl должен начинаться с http:// или https://.');
      return;
    }
    if (!/^\d+$/.test(next.idInstance)) {
      setAuthError('idInstance должен состоять только из цифр.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const state = await getStateInstance(next);
      if (state?.stateInstance !== 'authorized') {
        throw new Error(describeInstanceState(state?.stateInstance));
      }
      saveCredentials(next);
      setChats(loadChats(next.idInstance));
      setActiveId(null);
      setInstanceState(state.stateInstance);
      setPollError('');
      setCredentials(next);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearCredentials();
    setCredentials(null);
    setChats([]);
    setActiveId(null);
    setInstanceState('');
    setPollError('');
    setWebhookWarning('');
    setConnected(false);
    setComposeError('');
  }

  function openChatByPhone(rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) {
      setComposeError('Введите номер в международном формате, например 79001234567.');
      return false;
    }
    setComposeError('');
    const existing = chats.find((chat) => chat.phone === phone);
    if (existing) {
      setActiveId(existing.id);
      setChats((current) => current.map((chat) => (
        chat.id === existing.id ? { ...chat, unread: 0 } : chat
      )));
      return true;
    }
    const chat = createLocalChat(phone);
    setChats((current) => [chat, ...current]);
    setActiveId(chat.id);
    return true;
  }

  function selectChat(chatId) {
    setActiveId(chatId);
    if (!chatId) return;
    setChats((current) => current.map((chat) => (
      chat.id === chatId ? { ...chat, unread: 0 } : chat
    )));
  }

  function removeChat(chatId) {
    setChats((current) => current.filter((chat) => chat.id !== chatId));
    setActiveId((current) => (current === chatId ? null : current));
  }

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || !credentials) return;
    if (trimmed.length > 4096) {
      setPollError('Сообщение длиннее 4096 символов.');
      return;
    }
    const chat = chats.find((item) => item.id === activeId);
    if (!chat) return;

    const localId = `local-${crypto.randomUUID()}`;
    const optimistic = {
      id: localId,
      text: trimmed,
      direction: 'out',
      timestamp: Date.now(),
      status: 'sending',
    };
    setChats((current) => current.map((item) => (
      item.id === chat.id
        ? { ...item, messages: [...item.messages, optimistic] }
        : item
    )));

    try {
      const result = await sendMessage(credentials, chat.chatId, trimmed);
      const serverId = result?.idMessage ? String(result.idMessage) : localId;
      const queuedStatus = pendingStatus.current.get(serverId) || 'sent';
      pendingStatus.current.delete(serverId);
      setChats((current) => current.map((item) => {
        if (item.id !== chat.id) return item;
        const stillLocal = item.messages.some((message) => message.id === localId);
        if (!stillLocal) {
          return {
            ...item,
            messages: item.messages.map((message) => (
              message.id === serverId
                ? { ...message, status: mergeStatus(message.status, queuedStatus) }
                : message
            )),
          };
        }
        return {
          ...item,
          messages: item.messages.map((message) => (
            message.id === localId
              ? { ...message, id: serverId, status: mergeStatus(message.status, queuedStatus) }
              : message
          )),
        };
      }));
    } catch (error) {
      setChats((current) => current.map((item) => (
        item.id === chat.id
          ? {
            ...item,
            messages: item.messages.map((message) => (
              message.id === localId
                ? { ...message, status: 'failed', error: error.message }
                : message
            )),
          }
          : item
      )));
    }
  }

  const activeChat = chats.find((chat) => chat.id === activeId) || null;

  return {
    credentials,
    chats,
    activeChat,
    authLoading,
    authError,
    composeError,
    pollError,
    webhookWarning,
    instanceState,
    connected,
    login,
    logout,
    openChatByPhone,
    selectChat,
    removeChat,
    send,
    dismissPollError: () => setPollError(''),
    dismissWebhookWarning: () => setWebhookWarning(''),
  };
}
