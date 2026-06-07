// onto/icons.jsx — minimal stroke icon set (Lucide-ish), shared via window.OI

const OIco = ({ size = 16, stroke = "currentColor", strokeWidth = 1.6, children, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={stroke} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

const OI = {
  Library:   (p) => <OIco {...p}><path d="M4 4h3v16H4z"/><path d="M9 4h3v16H9z"/><path d="m15 5 3-1 4 14-3 1z"/></OIco>,
  Workspace: (p) => <OIco {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></OIco>,
  Graph:     (p) => <OIco {...p}><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M7.8 7.6 10.4 16M13.7 16l3-7M8.2 6.4 15.6 6.7"/></OIco>,
  Folder:    (p) => <OIco {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></OIco>,
  Doc:       (p) => <OIco {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6M9 9h2"/></OIco>,
  Search:    (p) => <OIco {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></OIco>,
  Plus:      (p) => <OIco {...p}><path d="M12 5v14M5 12h14"/></OIco>,
  Chevron:   (p) => <OIco {...p}><path d="m9 6 6 6-6 6"/></OIco>,
  ChevronDown:(p) => <OIco {...p}><path d="m6 9 6 6 6-6"/></OIco>,
  ChevronLeft:(p) => <OIco {...p}><path d="m15 6-6 6 6 6"/></OIco>,
  More:      (p) => <OIco {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></OIco>,
  Database:  (p) => <OIco {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></OIco>,
  Link:      (p) => <OIco {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 1 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 1 0 7.1 7.1l1.7-1.7"/></OIco>,
  Settings:  (p) => <OIco {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></OIco>,
  Tag:       (p) => <OIco {...p}><path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0L3 13.8V3h10.8L21 10.2a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/></OIco>,
  Clock:     (p) => <OIco {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></OIco>,
  Upload:    (p) => <OIco {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8 12 3 7 8M12 3v12"/></OIco>,
  Eye:       (p) => <OIco {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></OIco>,
  Edit:      (p) => <OIco {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></OIco>,
  Lock:      (p) => <OIco {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></OIco>,
  Check:     (p) => <OIco {...p}><path d="M20 6 9 17l-5-5"/></OIco>,
  FilePlus:  (p) => <OIco {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6M9 15h6"/></OIco>,
  Chat:      (p) => <OIco {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></OIco>,
  Sparkles:  (p) => <OIco {...p}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4M5 17v4M7 19H3"/></OIco>,
  Send:      (p) => <OIco {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></OIco>,
  AtSign:    (p) => <OIco {...p}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></OIco>,
  Paperclip: (p) => <OIco {...p}><path d="m21.4 11.1-9.1 9.1a5 5 0 0 1-7.1-7.1l9.1-9.1a3.5 3.5 0 0 1 5 5l-9.2 9.1a2 2 0 1 1-2.8-2.8l8.5-8.5"/></OIco>,
  X:         (p) => <OIco {...p}><path d="M18 6 6 18M6 6l12 12"/></OIco>,
  LogOut:    (p) => <OIco {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></OIco>,
  Mail:      (p) => <OIco {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></OIco>,
};

window.OI = OI;
