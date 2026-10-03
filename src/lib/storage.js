const CREDS_KEY = 'front-tg:credentials';

function chatsKey(idInstance) {
  return `front-tg:chats:${idInstance}`;
}

export function loadCredentials() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.apiUrl || !data?.idInstance || !data?.apiTokenInstance) return null;
    return {
      apiUrl: String(data.apiUrl).replace(/\/+$/, ''),
      idInstance: String(data.idInstance).trim(),
      apiTokenInstance: String(data.apiTokenInstance).trim(),
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(credentials));
}

export function clearCredentials() {
  localStorage.removeItem(CREDS_KEY);
}

export function loadChats(idInstance) {
  if (!idInstance) return [];
  try {
    const raw = localStorage.getItem(chatsKey(idInstance));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveChats(idInstance, chats) {
  if (!idInstance) return;
  localStorage.setItem(chatsKey(idInstance), JSON.stringify(chats));
}
