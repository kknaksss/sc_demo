"use client";

// SC-WP-02 C4 — 사이드바 워크스페이스 셸(헤더 없음).
// 디자인 SoT: claude-design/onto/shell.jsx + SC-SPEC-05(셸).
// 3탭(도서관/개인스페이스/채팅) 네비 — 각 탭 본문은 placeholder(콘텐츠는 WP-03/04/05).
// 검색란은 v1 비활성(표시만). 푸터에 로그인 유저 + 로그아웃.

import { useState } from "react";
import {
  Library,
  LayoutGrid,
  MessageSquare,
  Search,
  ChevronLeft,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { userInitial, type User } from "@/lib/auth";
import LibraryView from "@/components/library/LibraryView";

type TabId = "library" | "myspace" | "chat";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** placeholder 본문 안내 — 실제 화면은 후속 WP. */
  note: string;
}

const TABS: TabDef[] = [
  { id: "library", label: "도서관", icon: Library, note: "도서관 뷰어는 곧 제공됩니다." },
  { id: "myspace", label: "개인스페이스", icon: LayoutGrid, note: "개인스페이스 에디터는 곧 제공됩니다." },
  { id: "chat", label: "채팅", icon: MessageSquare, note: "채팅은 곧 제공됩니다." },
];

interface ShellProps {
  user: User;
  onLogout: () => void;
}

function TabPlaceholder({ tab }: { tab: TabDef }) {
  const Icon = tab.icon;
  return (
    <div className="page-empty">
      <div className="page-empty-icon">
        <Icon size={26} aria-hidden />
      </div>
      <h2>{tab.label}</h2>
      <p>{tab.note}</p>
    </div>
  );
}

export default function Shell({ user, onLogout }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<TabId>("library");
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <div className="onto-app" data-nav={collapsed ? "collapsed" : "expanded"}>
      <aside className="nav">
        {/* 브랜드 */}
        <div className="nav-brand">
          <button
            type="button"
            className="nav-logo nav-logo-btn"
            onClick={collapsed ? () => setCollapsed(false) : undefined}
            title={collapsed ? "확장" : undefined}
          >
            M
          </button>
          {!collapsed && (
            <div className="nav-brand-meta" style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
              <div className="nav-title">mediness</div>
              <span className="nav-title-sub">workspace · v0.4</span>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              className="nav-collapse"
              onClick={() => setCollapsed(true)}
              title="접기"
            >
              <ChevronLeft size={14} aria-hidden />
            </button>
          )}
        </div>

        {/* 검색 — v1 비활성(표시만) */}
        <div className="nav-search" aria-disabled>
          <Search size={15} aria-hidden />
          {!collapsed && (
            <input placeholder="온톨로지 · 개념 검색" disabled aria-label="검색 (준비 중)" />
          )}
          {!collapsed && <span className="kbd">⌘K</span>}
        </div>

        {/* 워크스페이스 네비 */}
        <div className="nav-scroll">
          <div className="nav-section">워크스페이스</div>
          <div className="nav-list">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={"nav-item" + (active === tab.id ? " active" : "")}
                  onClick={() => setActive(tab.id)}
                  title={collapsed ? tab.label : undefined}
                  aria-current={active === tab.id ? "page" : undefined}
                >
                  <Icon className="nav-item-icon" aria-hidden />
                  <span className="nav-item-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 푸터 — 유저 + 로그아웃 */}
        <div className="nav-footer">
          <div className="nav-avatar">{userInitial(user)}</div>
          {!collapsed && (
            <div className="nav-user-info">
              <div className="nav-user-name">{user.display_name}</div>
              <div className="nav-user-org">mediness / {user.org}</div>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              className="nav-collapse"
              onClick={onLogout}
              title="로그아웃"
            >
              <LogOut size={14} aria-hidden />
            </button>
          )}
        </div>
      </aside>

      <main className="page">
        {active === "library" ? (
          <LibraryView />
        ) : (
          <div className="page-body">
            <TabPlaceholder tab={activeTab} />
          </div>
        )}
      </main>
    </div>
  );
}
