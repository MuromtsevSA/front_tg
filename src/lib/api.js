function endpoint(credentials, method) {
  const base = credentials.apiUrl.replace(/\/+$/, '');
  return `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}`;
}

function parseBody(text) {
  if (!text || text === 'null') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(data, text, status) {
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  }
  if (typeof data === 'string' && data.trim()) return data;
  if (text && text.trim() && text !== 'null') return text.trim();
  return `Ошибка GREEN-API (${status})`;
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Нет соединения с GREEN-API. Проверьте apiUrl и доступ в интернет.');
  }

  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok) {
    throw new Error(errorMessage(data, text, response.status));
  }
  return data;
}

export function getStateInstance(credentials, signal) {
  return request(endpoint(credentials, 'getStateInstance'), { signal });
}

export function getSettings(credentials, signal) {
  return request(endpoint(credentials, 'getSettings'), { signal });
}

export function sendMessage(credentials, chatId, message, signal) {
  return request(endpoint(credentials, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
    signal,
  });
}

export function receiveNotification(credentials, receiveTimeout, signal) {
  const url = `${endpoint(credentials, 'receiveNotification')}?receiveTimeout=${receiveTimeout}`;
  return request(url, { signal });
}

export function deleteNotification(credentials, receiptId, signal) {
  return request(`${endpoint(credentials, 'deleteNotification')}/${receiptId}`, {
    method: 'DELETE',
    signal,
  });
}

export function describeInstanceState(state) {
  switch (state) {
    case 'authorized':
      return 'Инстанс авторизован';
    case 'notAuthorized':
      return 'Инстанс не авторизован. Привяжите Telegram в консоли GREEN-API.';
    case 'pendingPassword':
      return 'Нужен пароль двухфакторной защиты Telegram.';
    case 'blocked':
      return 'Инстанс заблокирован.';
    case 'suspended':
      return 'На аккаунте временные ограничения на отправку.';
    case 'starting':
      return 'Инстанс запускается. Подождите до нескольких минут и войдите снова.';
    default:
      return state ? `Состояние инстанса: ${state}` : 'Не удалось прочитать состояние инстанса.';
  }
}
