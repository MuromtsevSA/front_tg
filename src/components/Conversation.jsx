import { useEffect, useRef, useState } from 'react';
import { formatDayLabel, formatMessageTime, statusLabel } from '../lib/messages.js';
import { formatPhone } from '../lib/phone.js';

function dayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function Conversation({ chat, onSend, onBack, onRemove }) {
  const [text, setText] = useState('');
  const messagesRef = useRef(null);

  useEffect(() => {
    setText('');
  }, [chat?.id]);

  useEffect(() => {
    const scroller = messagesRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [chat?.id, chat?.messages?.length]);

  if (!chat) {
    return (
      <section className="conversation conversation--empty">
        <div>
          <h2>Выберите чат</h2>
          <p>Создайте диалог по номеру телефона слева и отправьте текстовое сообщение.</p>
        </div>
      </section>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const value = text;
    if (!value.trim()) return;
    setText('');
    onSend(value);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  let lastDay = '';

  return (
    <section className="conversation">
      <header className="conversation__header">
        <button className="text-button conversation__back" type="button" onClick={onBack}>
          Назад
        </button>
        <div>
          <h2>{chat.title}</h2>
          <p>{chat.phone ? formatPhone(chat.phone) : chat.chatId}</p>
        </div>
        <button className="text-button" type="button" onClick={() => onRemove(chat.id)}>
          Удалить
        </button>
      </header>

      <div className="messages" ref={messagesRef}>
        {chat.messages.length === 0 ? (
          <p className="messages__empty">Напишите первое сообщение. Ответ из Telegram появится здесь.</p>
        ) : null}
        {chat.messages.map((message) => {
          const day = dayKey(message.timestamp);
          const showDay = day !== lastDay;
          lastDay = day;
          const outgoing = message.direction === 'out';
          return (
            <div key={message.id}>
              {showDay ? <div className="day">{formatDayLabel(message.timestamp)}</div> : null}
              <article className={outgoing ? 'bubble bubble--out' : 'bubble'}>
                <p>{message.text}</p>
                <footer>
                  <time>{formatMessageTime(message.timestamp)}</time>
                  {outgoing ? (
                    <span className={`status status--${message.status || 'sent'}`}>
                      {statusLabel(message.status)}
                    </span>
                  ) : null}
                </footer>
                {message.error ? <small className="bubble__error">{message.error}</small> : null}
              </article>
            </div>
          );
        })}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4096}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
        />
        <button className="button" type="submit" disabled={!text.trim()}>
          Отправить
        </button>
      </form>
    </section>
  );
}
