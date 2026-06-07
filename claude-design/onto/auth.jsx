// onto/auth.jsx — 유저 인증: 시드 계정 3개 + 로그인 화면 (가입 없음)

const { useState: useAuthState } = React;

// 시드 테스트 계정 (역할 동등). 비밀번호는 데모용.
const AUTH_USERS = [
  { id: "u1", email: "minjun@mediness.ai",  password: "mediness", display_name: "김민준", org: "임상개발", initial: "민" },
  { id: "u2", email: "seoyeon@mediness.ai", password: "mediness", display_name: "이서연", org: "데이터팀", initial: "서" },
  { id: "u3", email: "jihoon@mediness.ai",  password: "mediness", display_name: "박지훈", org: "플랫폼",   initial: "지" },
];

const AUTH_KEY = "onto_auth_user";

const Auth = {
  load() {
    try { const id = localStorage.getItem(AUTH_KEY); return AUTH_USERS.find((u) => u.id === id) || null; }
    catch (e) { return null; }
  },
  save(user) { try { localStorage.setItem(AUTH_KEY, user.id); } catch (e) {} },
  clear() { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} },
  USERS: AUTH_USERS,
};

function LoginScreen({ onLogin }) {
  const OI = window.OI;
  const [email, setEmail] = useAuthState("");
  const [password, setPassword] = useAuthState("");
  const [error, setError] = useAuthState(null);

  const submit = (e) => {
    if (e) e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !password) { setError("이메일과 비밀번호를 입력하세요."); return; }
    // 이메일 존재 여부를 구분하지 않고 단일 실패 처리 (INVALID_CREDENTIALS)
    const user = AUTH_USERS.find((u) => u.email === em && u.password === password);
    if (!user) { setError("이메일 또는 비밀번호가 올바르지 않습니다."); return; }
    Auth.save(user);
    onLogin(user);
  };

  const quickFill = (u) => { setEmail(u.email); setPassword(u.password); setError(null); };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="nav-logo">M</div>
          <div>
            <div className="login-brand-name">mediness</div>
            <div className="login-brand-sub">온톨로지 워크스페이스</div>
          </div>
        </div>

        <h1 className="login-title">로그인</h1>
        <p className="login-desc">시드된 테스트 계정으로 로그인하세요. 가입 절차는 없습니다.</p>

        <label className="login-field">
          <span className="login-label">이메일</span>
          <span className="login-input">
            <OI.Mail size={15} />
            <input
              type="email"
              value={email}
              placeholder="name@mediness.ai"
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoFocus
            />
          </span>
        </label>

        <label className="login-field">
          <span className="login-label">비밀번호</span>
          <span className="login-input">
            <OI.Lock size={15} />
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
            />
          </span>
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn btn-primary login-submit">로그인</button>

        <div className="login-seed">
          <div className="login-seed-head">테스트 계정 · 클릭하면 자동 입력</div>
          <div className="login-seed-list">
            {AUTH_USERS.map((u) => (
              <button type="button" key={u.id} className="login-seed-item" onClick={() => quickFill(u)}>
                <span className="login-seed-av">{u.initial}</span>
                <span className="login-seed-main">
                  <span className="login-seed-name">{u.display_name} · {u.org}</span>
                  <span className="login-seed-email">{u.email}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="login-seed-pw">공통 비밀번호 <code>mediness</code></div>
        </div>
      </form>
      <div className="login-foot">데모 · 3 테스트 계정 · 역할 동등</div>
    </div>
  );
}

window.Auth = Auth;
window.LoginScreen = LoginScreen;
