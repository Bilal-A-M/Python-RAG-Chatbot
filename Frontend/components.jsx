// Shared chat components: Citation chip, CodeBlock, Drawer, Sidebar, Topbar, Composer.

const { useState, useEffect, useRef, useCallback } = React;

// ── icons (tiny inline SVGs) ───────────────────────────────────────────────
const Icon = {
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>,
  copy:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  send:    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5 21 3l-8.5 18-2.5-7.5L3 11.5Z"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" strokeLinecap="round"/></svg>,
  share:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>,
  thumbup: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-3l1-4a2 2 0 0 0-4 0v6H7" strokeLinejoin="round"/></svg>,
  thumbdn: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 2v11M22 11V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3l-1 4a2 2 0 0 0 4 0v-6h4" strokeLinejoin="round"/></svg>,
  caret:   <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4h8L6 9 2 4z"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round"/></svg>,
  ext:     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 5h5v5M19 5l-9 9M14 14v5H5V10h5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  sidebarT:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>,
  book:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M18 17H7a3 3 0 0 0-3 3"/></svg>,
};

// ── Citation chip — behavior depends on tweak `citationStyle` ─────────────
function Cite({ n, ctx }) {
  const [hover, setHover] = useState(false);
  const ref = useRef(null);
  const cit = ctx.citationsByN[n];
  if (!cit) return <span className="cite" data-active="0">[{n}]</span>;

  const onClick = (e) => {
    e.stopPropagation();
    if (ctx.citationStyle === 'drawer') ctx.openDrawer(n);
    else if (ctx.citationStyle === 'footnote') {
      const el = document.getElementById(`cite-foot-${n}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        el.animate(
          [{ background: 'var(--accent-soft)' }, { background: 'transparent' }],
          { duration: 1000 },
        );
      }
    } else {
      ctx.openDrawer(n);
    }
  };

  return (
    <span
      ref={ref}
      className="cite"
      data-active={ctx.activeCite === n ? '1' : '0'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {n}
      {ctx.citationStyle === 'popover' && hover && (
        <span className="cite-popover" style={{
          left: 0, top: '100%', marginTop: 6, transform: 'translateX(-30%)',
        }}>
          <span className="ttl">{cit.title}</span>
          <span className="pth">{cit.path}{cit.anchor}</span>
          <span>{cit.quote}</span>
        </span>
      )}
    </span>
  );
}

// ── Code block with header + copy button + syntax highlighting ────────────
function CodeBlock({ lang, body }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const tokens = lang === 'py' || lang === 'python'
    ? highlightPython(body)
    : body;
  return (
    <div className="code-wrap">
      <div className="code-hd">
        <span className="dots"><i/><i/><i/></span>
        <span className="lang">{lang === 'py' ? 'python' : lang}</span>
        <button className="code-copy" data-copied={copied ? '1' : '0'} onClick={copy}>
          {copied ? Icon.check : Icon.copy}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{tokens}</code></pre>
    </div>
  );
}

// ── Citation drawer ───────────────────────────────────────────────────────
function CitationDrawer({ cit, onClose }) {
  // Lock scroll while open
  useEffect(() => {
    if (!cit) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cit, onClose]);

  const open = !!cit;
  const renderQuote = (q, hl) => {
    if (!hl || !q) return q;
    const idx = q.toLowerCase().indexOf(hl.toLowerCase());
    if (idx < 0) return q;
    return (
      <>
        {q.slice(0, idx)}
        <em>{q.slice(idx, idx + hl.length)}</em>
        {q.slice(idx + hl.length)}
      </>
    );
  };

  return (
    <>
      <div className="drawer-backdrop" data-open={open ? '1' : '0'} onClick={onClose} />
      <div className="drawer" data-open={open ? '1' : '0'}>
        {cit && (
          <>
            <div className="drawer-hd">
              <span className="n">{cit.n}</span>
              <span className="ttl">{cit.title}</span>
              <button className="x" onClick={onClose}>{Icon.x}</button>
            </div>
            <div className="drawer-meta">
              <div className="row"><span className="key">source</span><span className="pth">docs.python.org / {cit.path}</span></div>
              <div className="row"><span className="key">section</span><span className="val">{cit.anchor.replace('#','').replace(/-/g,' ')}</span></div>
              <div className="row"><span className="key">version</span><span className="val">{cit.version}</span></div>
            </div>
            <div className="drawer-body">
              <h4>Retrieved chunk</h4>
              <blockquote className="quote">{renderQuote(cit.quote, cit.highlight)}</blockquote>
              <h4>Surrounding context</h4>
              <p>{cit.excerpt}</p>
            </div>
            <div className="drawer-foot">
              <a className="primary" href={`https://docs.python.org/3/${cit.path}${cit.anchor}`} target="_blank" rel="noreferrer">
                Open in docs {Icon.ext}
              </a>
              <button>Copy citation</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ conversations }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">py</span>
        <span className="brand-name">py<span>.docs</span></span>
      </div>

      <div className="side-card">
        <div className="side-card-hd">
          <span className="side-card-dot" />
          <span className="side-card-ttl">Grounded in docs.python.org</span>
        </div>
        <p className="side-card-body">
          Every answer is retrieved from the official Python documentation. Click a citation chip to see the exact paragraph that backed the claim.
        </p>
      </div>

      <div className="side-label">Browse the index</div>
      <ul className="side-list">
        <li className="side-item"><span className="mono">asyncio</span><span className="ago">1.2k</span></li>
        <li className="side-item"><span className="mono">typing</span><span className="ago">880</span></li>
        <li className="side-item"><span className="mono">dataclasses</span><span className="ago">412</span></li>
        <li className="side-item"><span className="mono">functools</span><span className="ago">298</span></li>
        <li className="side-item"><span className="mono">pathlib</span><span className="ago">221</span></li>
        <li className="side-item"><span className="mono">collections</span><span className="ago">615</span></li>
        <li className="side-item"><span className="mono">itertools</span><span className="ago">344</span></li>
      </ul>

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <div className="version-pill">
          <span className="dot" />
          <span className="label">indexing</span>
          <span className="val">Python 3.13</span>
          <span className="caret">{Icon.caret}</span>
        </div>
        <div className="user-pill">
          <span className="av">ad</span>
          <div style={{display:'flex',flexDirection:'column',lineHeight:1.2}}>
            <span className="name">alex.dev</span>
            <span className="role">Pro · 12k queries</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ started }) {
  return (
    <header className="topbar">
      <span className="brand">
        <span className="brand-mark">py</span>
        <span className="brand-name">py<span>.docs</span></span>
      </span>
      <span className="crumb">
        <span style={{color:'var(--text-4)', margin:'0 6px'}}>/</span>
        <b>{started ? 'asyncio.gather vs TaskGroup' : 'new chat'}</b>
      </span>
      <span className="grow" />
      <button className="icon-btn" title="Search">{Icon.search}</button>
      <button className="icon-btn" title="Share">{Icon.share}</button>
      <span className="topbar-divider" />
      <div className="topbar-version">
        <span className="dot" />
        <span className="val">Python 3.13</span>
      </div>
    </header>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────
function Composer({ onSubmit, busy }) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  const submit = () => {
    if (!val.trim() || busy) return;
    onSubmit(val);
    setVal('');
  };
  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(180, el.scrollHeight) + 'px';
  }, [val]);

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          rows={1}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask the Python docs anything…"
        />
        <div className="composer-bot">
          <button className="compose-chip">{Icon.book} 3.13 stdlib</button>
          <button className="compose-chip">@module</button>
          <span className="compose-grow" />
          <button className="send-btn" onClick={submit} disabled={!val.trim() || busy}>
            {Icon.send} Send
          </button>
        </div>
      </div>
      <div className="composer-hint">
        <span><b>Enter</b> to send</span>
        <span><b>Shift</b>+<b>Enter</b> for newline</span>
        <span><b>⌘K</b> to search docs</span>
      </div>
    </div>
  );
}

Object.assign(window, { Cite, CodeBlock, CitationDrawer, Sidebar, Topbar, Composer, Icon });
