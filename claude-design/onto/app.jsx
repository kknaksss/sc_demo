// onto/app.jsx — 마운트 + 인증 게이팅

const { useState: useAppState } = React;

function App() {
  const [user, setUser] = useAppState(() => window.Auth.load());

  const logout = () => { window.Auth.clear(); setUser(null); };

  if (!user) {
    return <window.LoginScreen onLogin={setUser} />;
  }

  return (
    <window.Shell user={user} onLogout={logout}>
      {(active) =>
        active === "library" ? <window.Library />
        : active === "chat" ? <window.Chat user={user} />
        : <window.MySpace user={user} />
      }
    </window.Shell>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
