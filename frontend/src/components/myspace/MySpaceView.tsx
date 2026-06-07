"use client";

// SC-WP-04 C3 — 개인스페이스 오케스트레이터 (좌 목록 / 중 md 에디터).
// 디자인 SoT: myspace.jsx (.ms / .ms-main / .ms-chrome) + SC-SPEC-02 §2 UX Contract.
//
// 이 commit 범위(태스크 PLAN-104-T-002):
//   - 좌: 내 문서 평면 목록 + 새 문서(md) + 업로드 버튼(UI 만, C4).
//   - 중: md 에디터 — 보기 모드 ↔ 편집 모드(소스 textarea + react-markdown 프리뷰),
//         저장 상태(`수정됨`/`저장됨`) + `저장`(PUT). 미선택/notfound/보기전용 상태.
//   - 우: AI 도크 = SC-SPEC-04(WP-05) 범위 — 여기선 inert `AI` 토글 placeholder 만(도크 없음).
//   - 비-md(docx/xlsx/pdf) 보기 렌더 = 후속 C4 → 선택 시 `보기 전용` placeholder.
//
// BE 미기동 graceful: 목록 실패 → 빈/에러 안내, 단건 실패(404 등) → "문서를 찾을 수 없음".
// 보기/편집은 런타임 UI 상태(DB 컬럼 아님 — SC-SPEC-02 §4). 토글 버튼 UX 는 work-04 Open
// Issue 가 개발팀에 위임 → 명시 토글 버튼으로 둔다.

import { useEffect, useRef, useState } from "react";
import { Check, Eye, Pencil, Lock, Sparkles, AlertTriangle } from "lucide-react";

import { FMT_LABEL } from "@/lib/docs";
import {
  listDocs,
  getDoc,
  createDoc,
  saveDoc,
  uploadDoc,
  type PersonalDocMeta,
  type PersonalDocDetail,
} from "@/lib/personal";
import { ApiError } from "@/lib/api";
import {
  ViewerState,
  ViewerLoading,
  ViewerNotFound,
} from "@/components/library/viewer-states";
import DocList from "./DocList";
import MdEditor from "./MdEditor";

type ListState = "loading" | "loaded" | "error";
type DetailState =
  | "idle"
  | "loading"
  | "loaded"
  | "viewonly"
  | "notfound"
  | "error";
type Mode = "view" | "edit";
type Toast = { msg: string; tone: "ok" | "warn" } | null;

export default function MySpaceView() {
  const [listState, setListState] = useState<ListState>("loading");
  const [docs, setDocs] = useState<PersonalDocMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailState, setDetailState] = useState<DetailState>("idle");
  const [detail, setDetail] = useState<PersonalDocDetail | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // 최신 docs 를 detail 로드 effect 안에서 참조(effect dep 은 selectedId 만 — docs 갱신에
  // 재로드되지 않게). 새 문서는 로드 후 편집 모드로 열기 위해 id 를 기록한다.
  const docsRef = useRef<PersonalDocMeta[]>([]);
  docsRef.current = docs;
  const openInEditRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, tone: "ok" | "warn") => {
    setToast({ msg, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // 최초 진입: 내 문서 목록 로드.
  useEffect(() => {
    let alive = true;
    listDocs()
      .then((items) => {
        if (!alive) return;
        setDocs(items);
        setListState("loaded");
      })
      .catch(() => {
        if (alive) setListState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 선택 변경 시 단건 로드. md=content fetch / 비-md=보기 전용(렌더는 C4)이라 fetch 생략.
  useEffect(() => {
    if (!selectedId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }
    const meta = docsRef.current.find((d) => d.id === selectedId) ?? null;
    if (!meta) {
      setDetailState("notfound");
      return;
    }
    if (!meta.editable) {
      // 비-md(docx/xlsx/pdf): 보기 전용. 렌더 라이브러리 연동은 후속 C4.
      setDetail(null);
      setDetailState("viewonly");
      setMode("view");
      setDirty(false);
      setTitleDraft(meta.title);
      return;
    }

    let alive = true;
    setDetailState("loading");
    getDoc(selectedId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setDraft(d.content ?? "");
        setTitleDraft(d.title);
        setDirty(false);
        // 방금 만든 빈 문서는 편집 모드로, 기존 문서는 보기 모드로 연다.
        setMode(openInEditRef.current === d.id ? "edit" : "view");
        openInEditRef.current = null;
        setDetailState("loaded");
      })
      .catch(() => {
        if (!alive) return;
        // DOC_NOT_FOUND(404)/FORBIDDEN(403)/BE 미기동 → 동일 안내로 수렴.
        setDetailState("notfound");
      });
    return () => {
      alive = false;
    };
    // selectedId 만 의존(docs 변경 시 재로드 방지 — meta 는 docsRef 로 읽음).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onNew = async () => {
    try {
      const created = await createDoc("제목 없는 문서");
      setDocs((ds) => [created, ...ds]);
      openInEditRef.current = created.id;
      setSelectedId(created.id);
    } catch {
      showToast("문서를 만들 수 없습니다", "warn");
    }
  };

  const onUpload = async (file: File) => {
    try {
      const created = await uploadDoc(file);
      // 목록 최상단에 반영 + 선택. md(editable:true)면 select effect 가 보기 모드로 열고,
      // 비-md(editable:false)면 보기전용 placeholder 로 떨어진다(렌더는 C4b).
      setDocs((ds) => [created, ...ds]);
      setSelectedId(created.id);
    } catch (e) {
      if (e instanceof ApiError && e.code === "UNSUPPORTED_UPLOAD_TYPE") {
        showToast("지원하지 않는 형식입니다 (md·docx·xlsx·pdf)", "warn");
      } else {
        showToast("업로드하지 못했습니다", "warn");
      }
    }
  };

  const onSave = async () => {
    if (!detail || !dirty || saving) return;
    setSaving(true);
    try {
      const r = await saveDoc(detail.id, { content: draft, title: titleDraft });
      setDetail((d) => (d ? { ...d, content: draft, title: titleDraft } : d));
      setDocs((ds) =>
        ds.map((x) =>
          x.id === detail.id
            ? { ...x, title: titleDraft, updated_at: r.updated_at ?? x.updated_at }
            : x,
        ),
      );
      setDirty(false);
      showToast("저장되었습니다", "ok");
    } catch {
      showToast("저장하지 못했습니다", "warn");
    } finally {
      setSaving(false);
    }
  };

  const selectedMeta = docs.find((d) => d.id === selectedId) ?? null;
  const showChrome = selectedMeta != null && detailState !== "loading";
  const isMd = detailState === "loaded" && detail?.editable === true;

  // 렌더 헬퍼 — JSX `<Body/>` element 로 쓰면 MySpaceView 리렌더마다 함수 정체성이
  // 바뀌어 하위 트리(MdEditor textarea)가 언마운트→리마운트되어 포커스/커서가 소실된다
  // (PLAN-104-T-006). 함수 호출 `{renderBody()}` 로 인라인해 같은 트리를 유지한다.
  function renderBody() {
    if (!selectedId) {
      return (
        <ViewerState
          icon="doc"
          title="문서를 선택하세요"
          desc="좌측에서 문서를 열거나 새 문서를 만들어 작성을 시작하세요."
        />
      );
    }
    if (detailState === "loading") {
      return <ViewerLoading name={selectedMeta?.title ?? ""} />;
    }
    if (detailState === "notfound" || detailState === "error") {
      return <ViewerNotFound name={selectedMeta?.title ?? ""} />;
    }
    if (detailState === "viewonly") {
      // 비-md 보기 전용 — 렌더 라이브러리 연동(docx/xlsx/pdf)은 후속 C4.
      return (
        <ViewerState
          icon="doc"
          title={selectedMeta?.title ?? ""}
          desc="보기 전용 문서입니다 — 렌더는 곧 제공됩니다."
        />
      );
    }
    // md 보기/편집.
    return (
      <MdEditor
        mode={mode}
        content={draft}
        draft={draft}
        onDraftChange={(next) => {
          setDraft(next);
          setDirty(true);
        }}
      />
    );
  }

  return (
    <div className="ms">
      <DocList
        docs={docs}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={onNew}
        onUpload={onUpload}
        loadError={listState === "error"}
      />

      <section className="ms-main">
        <div className="ms-editor-col">
          {showChrome && selectedMeta && (
            <div className="ms-chrome">
              <input
                className="ms-title-input"
                value={isMd ? titleDraft : selectedMeta.title}
                key={selectedMeta.id}
                readOnly={!isMd || mode !== "edit"}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  setDirty(true);
                }}
                aria-label="문서 제목"
              />
              <span className={`fmt-badge fmt-${selectedMeta.format}`}>
                {FMT_LABEL[selectedMeta.format]}
              </span>
              <div className="ms-chrome-right">
                {isMd ? (
                  <>
                    <span className={"ms-save-state" + (dirty ? " dirty" : "")}>
                      {dirty ? "수정됨" : "저장됨"}
                    </span>
                    <button
                      type="button"
                      className="btn ms-mode-btn"
                      onClick={() => setMode((m) => (m === "edit" ? "view" : "edit"))}
                    >
                      {mode === "edit" ? (
                        <>
                          <Eye size={13} aria-hidden /> 보기
                        </>
                      ) : (
                        <>
                          <Pencil size={13} aria-hidden /> 편집
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary ms-save"
                      onClick={onSave}
                      disabled={!dirty || saving}
                    >
                      <Check size={13} aria-hidden /> 저장
                    </button>
                  </>
                ) : (
                  <span className="ms-viewonly">
                    <Lock size={12} aria-hidden /> 보기 전용
                  </span>
                )}
                <span className="ms-chrome-sep" />
                {/* AI 도크 = SC-SPEC-04(WP-05). 여기선 inert placeholder(도크 미구현). */}
                <button
                  type="button"
                  className="btn ms-ai-btn"
                  title="AI 어시스턴트 (준비 중)"
                  disabled
                >
                  <Sparkles size={14} aria-hidden /> AI
                </button>
              </div>
            </div>
          )}
          <div className="ms-body">
            {renderBody()}
          </div>
        </div>
      </section>

      {toast && (
        <div className={"ms-toast" + (toast.tone === "warn" ? " warn" : "")}>
          {toast.tone === "warn" ? (
            <AlertTriangle size={14} aria-hidden />
          ) : (
            <Check size={14} aria-hidden />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
