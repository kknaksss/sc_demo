// onto/library.jsx — 도서관: 좌측 트리 + 우측 뷰어 (읽기 전용)

const { useState } = React;

// ---------- 트리 노드 ----------
function FmtBadge({ fmt }) {
  return <span className={"fmt-badge fmt-" + fmt}>{window.ONTO_LIB.FMT_LABEL[fmt]}</span>;
}

function TreeNode({ node, depth, openMap, toggle, selectedId, onSelect }) {
  const OI = window.OI;
  const isDir = node.type === "dir";
  const open = !!openMap[node.id];
  const pad = 8 + depth * 14;

  if (isDir) {
    return (
      <div>
        <div
          className={"lib-node" + (selectedId === node.id ? " active" : "")}
          style={{ paddingLeft: pad }}
          onClick={() => { toggle(node.id); onSelect(node); }}
        >
          <span className={"lib-caret" + (open ? " open" : "")}><OI.Chevron size={11} /></span>
          <OI.Folder className="lib-node-icon" size={15} />
          <span className="lib-node-label">{node.name}</span>
          <span className="lib-node-count">{node.children.length}</span>
        </div>
        {open && node.children.map((c) => (
          <TreeNode key={c.id} node={c} depth={depth + 1} openMap={openMap} toggle={toggle} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={"lib-node lib-file" + (selectedId === node.id ? " active" : "")}
      style={{ paddingLeft: pad + 18 }}
      onClick={() => onSelect(node)}
    >
      <span className="lib-node-label">{node.name}</span>
      <FmtBadge fmt={node.fmt} />
    </div>
  );
}

// ---------- 뷰어 상태 화면 ----------
function ViewerState({ icon, title, desc, tone }) {
  const OI = window.OI;
  const Icon = OI[icon];
  return (
    <div className={"viewer-state" + (tone ? " tone-" + tone : "")}>
      <div className="viewer-state-icon"><Icon size={26} /></div>
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  );
}

// ---------- 뷰어 헤더 ----------
function ViewerChrome({ node }) {
  const segs = (node.path || node.name).split("/");
  return (
    <div className="viewer-chrome">
      <div className="viewer-path">
        {segs.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="viewer-path-sep">/</span>}
            <span className={i === segs.length - 1 ? "viewer-path-cur" : ""}>{s}</span>
          </React.Fragment>
        ))}
        <FmtBadge fmt={node.fmt} />
      </div>
      <div className="viewer-meta">
        <span className="mono">{node.size}</span>
        <span className="viewer-meta-dot" />
        <span className="mono">{node.updated}</span>
        <span className="viewer-readonly">읽기 전용</span>
      </div>
    </div>
  );
}

// ---------- 뷰어 본문 ----------
function Viewer({ node }) {
  // 폴더 선택
  if (node && node.type === "dir") {
    if (!node.children || node.children.length === 0) {
      return <ViewerState icon="Folder" title="빈 폴더" desc="이 폴더에는 표시할 문서가 없습니다." />;
    }
    return (
      <ViewerState icon="Folder" title={node.name} desc={`${node.children.length}개 항목 · 좌측 트리에서 문서를 선택하세요.`} />
    );
  }
  // 미선택
  if (!node) {
    return <ViewerState icon="Library" title="문서를 선택하세요" desc="좌측 트리에서 문서를 열면 이 영역에 브라우저 렌더 결과가 표시됩니다." />;
  }
  // 미지원 포맷
  if (node.fmt === "unsupported") {
    return <ViewerState icon="Doc" tone="warn" title="지원하지 않는 포맷" desc={`${node.name} — md · docx · xlsx · pdf 만 렌더할 수 있습니다.`} />;
  }
  // 정상 렌더
  const Render = window.ONTO_LIB.DOC_RENDER[node.docId];
  if (!Render) {
    return <ViewerState icon="Doc" tone="warn" title="문서를 찾을 수 없음" desc={`${node.name} 의 콘텐츠를 불러올 수 없습니다.`} />;
  }
  return (
    <div className="viewer-scroll" key={node.id}>
      <Render />
    </div>
  );
}

// ---------- 도서관 ----------
function Library() {
  const OI = window.OI;
  const tree = window.ONTO_LIB.LIB_TREE;
  const initOpen = {};
  const walk = (ns) => ns.forEach((n) => { if (n.type === "dir" && n.open) { initOpen[n.id] = true; walk(n.children || []); } });
  walk(tree);

  const [openMap, setOpenMap] = useState(initOpen);
  const toggle = (id) => setOpenMap((o) => ({ ...o, [id]: !o[id] }));

  // 기본 선택: 온톨로지 개요
  const [selected, setSelected] = useState(() => {
    let found = null;
    const dig = (ns) => ns.forEach((n) => { if (n.docId === "onto-overview") found = n; if (n.children) dig(n.children); });
    dig(tree);
    return found;
  });

  return (
    <div className="lib">
      <aside className="lib-tree">
        <div className="lib-search">
          <OI.Search size={14} />
          <input placeholder="문서 · 폴더 검색" />
        </div>
        <div className="lib-tree-scroll">
          {tree.map((n) => (
            <TreeNode key={n.id} node={n} depth={0} openMap={openMap} toggle={toggle} selectedId={selected ? selected.id : null} onSelect={setSelected} />
          ))}
        </div>
        <div className="lib-tree-foot">
          <OI.Database size={12} />
          <span className="mono">seed · read-only</span>
        </div>
      </aside>

      <section className="lib-viewer">
        {selected && selected.type === "file" && selected.fmt !== "unsupported" && <ViewerChrome node={selected} />}
        <Viewer node={selected} />
      </section>
    </div>
  );
}

window.Library = Library;
