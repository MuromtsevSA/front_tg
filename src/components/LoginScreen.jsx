export default function LoginScreen({ onSubmit, loading, error }) {
  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      apiUrl: form.get('apiUrl'),
      idInstance: form.get('idInstance'),
      apiTokenInstance: form.get('apiTokenInstance'),
    });
  }

  return (
    <main className="login">
      <section className="login__intro">
        <p className="eyebrow">GREEN-API · Telegram</p>
        <h1>Чат для текстовых сообщений</h1>
        <p className="login__lead">
          Войдите данными инстанса из консоли GREEN-API, укажите номер получателя и переписывайтесь текстом.
        </p>
        <ol>
          <li>Создайте Telegram-инстанс и авторизуйте его по QR.</li>
          <li>Скопируйте apiUrl, idInstance и apiTokenInstance.</li>
          <li>Очистите webhook URL, чтобы ответы приходили в этот чат.</li>
        </ol>
      </section>
      <form className="login__card" onSubmit={handleSubmit}>
        <h2>Вход</h2>
        <label>
          apiUrl
          <input
            name="apiUrl"
            defaultValue="https://api.green-api.com"
            autoComplete="off"
            spellCheck="false"
            required
          />
        </label>
        <label>
          idInstance
          <input
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            spellCheck="false"
            placeholder="4100000000"
            required
          />
        </label>
        <label>
          apiTokenInstance
          <input
            name="apiTokenInstance"
            type="password"
            autoComplete="off"
            spellCheck="false"
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Проверяем инстанс…' : 'Войти в чат'}
        </button>
        <p className="login__note">
          Ключ хранится только в этом браузере и уходит в запросы GREEN-API. В репозиторий его сохранять не нужно.
        </p>
      </form>
    </main>
  );
}
