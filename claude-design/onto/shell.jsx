// onto/shell.jsx — 사이드바 + 페이지 셸 (헤더 없음)

const { useState } = React;

const NAV = [
  { id: "library", label: "도서관", icon: "Library" },
  { id: "myspace", label: "개인스페이스", icon: "Workspace" },
  { id: "chat", label: "채팅", icon: "Chat" },
];

function Brand({ collapsed, onToggle }) {
  return (
    <div className="nav-brand">
      <button
        className="nav-logo nav-logo-btn"
        onClick={collapsed ? onToggle : undefined}
        title={collapsed ? "확장" : undefined}
      >M</button>
      {!collapsed && (
        <div className="nav-brand-meta" style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
          <div className="nav-title">mediness</div>
          <span className="nav-title-sub">workspace · v0.4</span>
        </div>
      )}
      {!collapsed && (
        <button className="nav-collapse" onClick={onToggle} title="접기">
          <window.OI.ChevronLeft size={14} />
        </button>
      )}
    </div>
  );
}

function NavItem({ item, active, setActive, collapsed }) {
  const Icon = window.OI[item.icon];
  return (
    <button
      className={"nav-item" + (active === item.id ? " active" : "")}
      onClick={() => setActive(item.id)}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="nav-item-icon" />
      <span className="nav-item-label">{item.label}</span>
    </button>
  );
}

function Shell({ children, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("library");
  const u = user || { display_name: "게스트", org: "—", initial: "G" };

  return (
    <div className="onto-app" data-nav={collapsed ? "collapsed" : "expanded"}>
      <aside className="nav">
        <Brand collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="nav-search" onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
          <window.OI.Search size={15} />
          {!collapsed && <input placeholder="온톨로지 · 개념 검색" />}
          {!collapsed && <span className="kbd">⌘K</span>}
        </div>

        <div className="nav-scroll">
          <div className="nav-section">워크스페이스</div>
          <div className="nav-list">
            {NAV.map((it) => (
              <NavItem key={it.id} item={it} active={active} setActive={setActive} collapsed={collapsed} />
            ))}
          </div>
        </div>

        <div className="nav-footer">
          <div className="nav-avatar">{u.initial}</div>
          {!collapsed && (
            <div className="nav-user-info">
              <div className="nav-user-name">{u.display_name}</div>
              <div className="nav-user-org">mediness / {u.org}</div>
            </div>
          )}
          {!collapsed && (
            <button className="nav-collapse" onClick={onLogout} title="로그아웃">
              <window.OI.LogOut size={14} />
            </button>
          )}
        </div>
      </aside>

      <main className="page">
        <div className="page-body">
          {typeof children === "function" ? children(active) : children}
        </div>
      </main>
    </div>
  );
}

window.Shell = Shell;
