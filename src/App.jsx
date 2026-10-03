import Conversation from './components/Conversation.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import { useMessenger } from './hooks/useMessenger.js';

export default function App() {
  const messenger = useMessenger();

  if (!messenger.credentials) {
    return (
      <LoginScreen
        onSubmit={messenger.login}
        loading={messenger.authLoading}
        error={messenger.authError}
      />
    );
  }

  return (
    <div className={messenger.activeChat ? 'shell shell--chat-open' : 'shell'}>
      <Sidebar
        chats={messenger.chats}
        activeId={messenger.activeChat?.id}
        connected={messenger.connected}
        instanceState={messenger.instanceState}
        idInstance={messenger.credentials.idInstance}
        composeError={messenger.composeError}
        onOpenChat={messenger.openChatByPhone}
        onSelectChat={messenger.selectChat}
        onLogout={messenger.logout}
      />
      <div className="main-column">
        {messenger.webhookWarning ? (
          <div className="banner banner--warn">
            <span>{messenger.webhookWarning}</span>
            <button type="button" onClick={messenger.dismissWebhookWarning}>Скрыть</button>
          </div>
        ) : null}
        {messenger.pollError ? (
          <div className="banner">
            <span>{messenger.pollError}</span>
            <button type="button" onClick={messenger.dismissPollError}>Скрыть</button>
          </div>
        ) : null}
        <Conversation
          chat={messenger.activeChat}
          onSend={messenger.send}
          onBack={() => messenger.selectChat(null)}
          onRemove={messenger.removeChat}
        />
      </div>
    </div>
  );
}
