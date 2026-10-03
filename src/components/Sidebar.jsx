import { useState } from 'react';
import { formatPhone } from '../lib/phone.js';
import { formatMessageTime } from '../lib/messages.js';

function preview(chat) {
  const last = chat.messages?.at(-1);
  if (!last) return 'Нет сообщений';
  const prefix = last.direction === 'out' ? 'Вы: ' : '';
  return `${prefix}${last.text}`;
}

export default function Sidebar({
  chats,
  activeId,
  connected,
  instanceState,
  idInstance,
  composeError,
  onOpenChat,
  onSelectChat,
  onLogout,
}) {
  const [phone, setPhone] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (onOpenChat(phone)) setPhone('');
  }

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div>
          <p className="eyebrow">Telegram</p>
          <h1>Чаты</h1>
        </div>
        <button className="text-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <form className="new-chat" onSubmit={handleSubmit}>
        <label htmlFor="phone">Новый чат по номеру</label>
        <div className="new-chat__row">
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="79001234567"
            autoComplete="off"
          />
          <button className="button" type="submit">Создать</button>
        </div>
        {composeError ? <p className="form-error">{composeError}</p> : null}
      </form>

      <div className="chat-list">
        {chats.length === 0 ? (
          <p className="empty-list">Чатов пока нет. Создайте первый по номеру телефона.</p>
        ) : (
          chats.map((chat) => {
            const last = chat.messages?.at(-1);
            const selected = chat.id === activeId;
            return (
              <button
                key={chat.id}
                type="button"
                className={selected ? 'chat-row chat-row--active' : 'chat-row'}
                onClick={() => onSelectChat(chat.id)}
              >
                <span className="avatar">{(chat.phone || chat.title || '?').slice(-2)}</span>
                <span className="chat-row__body">
                  <span className="chat-row__top">
                    <strong>{chat.title || formatPhone(chat.phone)}</strong>
                    {last ? <time>{formatMessageTime(last.timestamp)}</time> : null}
                  </span>
                  <span className="chat-row__bottom">
                    <span>{preview(chat)}</span>
                    {chat.unread > 0 ? <em>{chat.unread}</em> : null}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <footer className="sidebar__footer">
        <span className={connected ? 'dot dot--on' : 'dot'} />
        <span>
          {connected ? 'Получение включено' : 'Нет связи с очередью'}
          {instanceState ? ` · ${instanceState}` : ''}
          <br />
          <small>{idInstance}</small>
        </span>
      </footer>
    </aside>
  );
}
