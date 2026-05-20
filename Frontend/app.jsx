// Main app — assembles layout, streams the assistant answer, wires tweaks.
// Real API calls go to http://localhost:5000/api/query (Backend/server.py).

const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM, useCallback: useC } = React;

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // Apply theme attrs to <html> so CSS vars switch.
  useE(() => {
    const h = document.documentElement;
    h.setAttribute('data-dark', t.darkness);
    h.setAttribute('data-accent', t.accent);
    h.setAttribute('data-density', t.density);
    h.setAttribute('data-font', t.fontMode);
  }, [t.darkness, t.accent, t.density, t.fontMode]);

  // ── conversation state ─────────────────────────────────────────────
  const data = window.PYDOCS_DATA;
  const [started, setStarted] = useS(false);
  const [messages, setMessages] = useS([]);
  const [progress, setProgress] = useS(0);   // chars revealed for seeded streaming
  const [streaming, setStreaming] = useS(false);
  const [activeCite, setActiveCite] = useS(null);
  const [activeCiteObj, setActiveCiteObj] = useS(null);
  const scrollRef = useR(null);

  // Multi-turn chat history as [[question, answer], ...]
  const chatHistoryRef = useR([]);

  // Per-message citations: maps messageId -> citationsArray
  const msgCitationsRef = useR({});

  const fullText = data.answer;

  // ── kick off the seeded asyncio Q&A ──────────────────────────────────
  const startSeededConversation = useC(() => {
    setStarted(true);
    setProgress(0);
    setStreaming(true);
    chatHistoryRef.current = [];
    msgCitationsRef.current = {};
    setMessages([
      { id: 'm-u1', role: 'user', text: data.userQuestion, ts: '11:42' },
      { id: 'm-r1', role: 'retrieving', sources: 4, done: false },
      { id: 'm-a1', role: 'assistant', text: '', ts: '11:42', streaming: true, msgId: 'm-a1' },
    ]);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) =>
        m.role === 'retrieving' ? { ...m, done: true } : m));
    }, 800);
  }, [data.userQuestion]);

  // ── streaming for the seeded demo ─────────────────────────────────────
  useE(() => {
    if (!streaming) return;
    const tick = () => {
      setProgress((p) => {
        if (p >= fullText.length) {
          setStreaming(false);
          return fullText.length;
        }
        const inFence = (fullText.slice(0, p).match(/```/g) || []).length % 2 === 1;
        const step = inFence ? 6 : 3 + Math.floor(Math.random() * 3);
        return Math.min(fullText.length, p + step);
      });
    };
    const id = setInterval(tick, 16);
    return () => clearInterval(id);
  }, [streaming, fullText]);

  // Sync streaming text into the seeded assistant message.
  useE(() => {
    if (!started) return;
    setMessages((prev) => prev.map((m) =>
      m.id === 'm-a1' ? { ...m, text: fullText.slice(0, progress), streaming } : m
    ));
  }, [progress, streaming, fullText, started]);

  // Auto-scroll on streaming or new messages.
  useE(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [progress, messages.length]);

  // ── citation drawer: open/close ──────────────────────────────────────
  const openDrawer = useC((n, msgId) => {
    setActiveCite(n);
    const cits = msgId === 'm-a1'
      ? data.citations
      : (msgCitationsRef.current[msgId] || []);
    const byN = {};
    for (const c of cits) byN[c.n] = c;
    setActiveCiteObj(byN[n] || null);
  }, [data]);

  const closeDrawer = useC(() => {
    setActiveCite(null);
    setActiveCiteObj(null);
  }, []);

  // ── build ctx per message (citations, openDrawer bound to msgId) ──────
  const buildCtx = useC((msgId) => {
    const cits = msgId === 'm-a1'
      ? data.citations
      : (msgCitationsRef.current[msgId] || []);
    const byN = {};
    for (const c of cits) byN[c.n] = c;
    return {
      citationsByN: byN,
      activeCite,
      openDrawer: (n) => openDrawer(n, msgId),
      citationStyle: t.citationStyle,
    };
  }, [activeCite, openDrawer, t.citationStyle, data]);

  // Enter on the start screen launches the demo.
  useEnterToStart(!started, startSeededConversation);

  // ── real API submit ───────────────────────────────────────────────────
  const submit = useC(async (text) => {
    const uid = 'u-' + Math.random().toString(36).slice(2, 8);
    const rid = 'r-' + uid;
    const aid = 'a-' + uid;

    setMessages((prev) => [
      ...prev,
      { id: uid, role: 'user', text, ts: nowStamp() },
      { id: rid, role: 'retrieving', sources: null, done: false },
      { id: aid, role: 'assistant', text: '', ts: nowStamp(), streaming: true, msgId: aid },
    ]);

    try {
      const res = await fetch('http://localhost:5000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          chat_history: chatHistoryRef.current,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const apiData = await res.json();

      // Store this message's citations in the ref
      const cits = apiData.citations || [];
      msgCitationsRef.current[aid] = cits;

      // Mark retrieval done
      setMessages((prev) => prev.map((m) =>
        m.id === rid ? { ...m, done: true, sources: cits.length } : m
      ));

      // Simulate streaming of the answer
      const fullAnswer = apiData.answer || 'Sorry, no answer available.';
      let p = 0;
      const tick = () => {
        const inFence = (fullAnswer.slice(0, p).match(/```/g) || []).length % 2 === 1;
        const step = inFence ? 8 : 3 + Math.floor(Math.random() * 3);
        p = Math.min(fullAnswer.length, p + step);
        const done = p >= fullAnswer.length;
        setMessages((prev) => prev.map((m) =>
          m.id === aid ? { ...m, text: fullAnswer.slice(0, p), streaming: !done } : m
        ));
        if (!done) {
          setTimeout(tick, 16);
        } else {
          // Append to chat history once streaming is complete
          chatHistoryRef.current = [...chatHistoryRef.current, [text, fullAnswer]];
        }
      };
      setTimeout(tick, 300);

    } catch (err) {
      setMessages((prev) => prev.map((m) => {
        if (m.id === rid) return { ...m, done: true, sources: 0 };
        if (m.id === aid) return {
          ...m,
          text: '⚠️ Could not reach the backend. Make sure `server.py` is running (`python server.py` in the Backend folder).',
          streaming: false,
        };
        return m;
      }));
    }
  }, []);

  // Detect whether the seeded streaming is still going (for FootnoteList/Followups gate)
  const seededStreaming = streaming;

  return (
    <div className="app"
         data-sidebar="off"
         data-bubble={t.bubbleStyle}>

      <main className="main">
        <Topbar started={started} />

        {!started ? (
          <StartScreen
            onStart={startSeededConversation}
            seededQuestion={data.userQuestion}
          />
        ) : (
          <div className="chat-scroll" ref={scrollRef}>
            <div className="thread">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  m={m}
                  ctx={buildCtx(m.role === 'assistant' ? (m.msgId || m.id) : null)}
                  isLastAssistant={i === messages.length - 1 && m.role === 'assistant'}
                />
              ))}

              {/* Show follow-ups + footnote-style citations only when the seeded answer finishes */}
              {!seededStreaming && messages.length > 0 && (
                <>
                  {t.citationStyle === 'footnote' && (
                    <FootnoteList citations={data.citations} openDrawer={(n) => openDrawer(n, 'm-a1')} />
                  )}
                  <Followups items={data.followups} onPick={submit} />
                </>
              )}
            </div>
          </div>
        )}

        {started && <Composer onSubmit={submit} busy={seededStreaming} />}
      </main>

      <CitationDrawer cit={activeCiteObj} onClose={closeDrawer} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakColor label="Accent"
            value={t.accent}
            options={['amber','cyan','lime','violet'].map(k => ({ amber:'#f5c878', cyan:'#5ed6c4', lime:'#b8e060', violet:'#b69dff' }[k]))}
            onChange={(hex) => setTweak('accent', { '#f5c878':'amber','#5ed6c4':'cyan','#b8e060':'lime','#b69dff':'violet' }[hex])} />
          <TweakRadio label="Darkness"
            value={t.darkness}
            options={['abyss','midnight','navy']}
            onChange={(v) => setTweak('darkness', v)} />
        </TweakSection>

        <TweakSection label="Typography">
          <TweakRadio label="Font" value={t.fontMode}
            options={['sans','mono']}
            onChange={(v) => setTweak('fontMode', v)} />
          <TweakRadio label="Density" value={t.density}
            options={['compact','regular','comfy']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio label="Messages" value={t.bubbleStyle}
            options={[{value:'flat',label:'Flat'},{value:'bubble',label:'Bubble'}]}
            onChange={(v) => setTweak('bubbleStyle', v)} />
        </TweakSection>

        <TweakSection label="Citations">
          <TweakSelect label="Style"
            value={t.citationStyle}
            options={[
              { value:'drawer',   label:'Chip → drawer' },
              { value:'footnote', label:'Footnote list' },
              { value:'popover',  label:'Hover popover' },
              { value:'inline',   label:'Inline cards'  },
            ]}
            onChange={(v) => setTweak('citationStyle', v)} />
        </TweakSection>

        <TweakSection label="Demo">
          <TweakButton label={started ? 'Back to start screen' : 'Start seeded demo'} onClick={() => {
            if (started) {
              setStarted(false);
              setStreaming(false);
              setProgress(0);
              setMessages([]);
              setActiveCite(null);
              setActiveCiteObj(null);
              chatHistoryRef.current = [];
              msgCitationsRef.current = {};
            } else {
              startSeededConversation();
            }
          }} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function nowStamp() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

// ── StartScreen ──────────────────────────────────────────────────────────
function StartScreen({ onStart, seededQuestion }) {
  const examples = [
    { q: seededQuestion, badge: 'seeded demo', seeded: true },
    { q: "How do I add a timeout to an asyncio task?", badge: 'asyncio' },
    { q: "What's the difference between @cache and @lru_cache?", badge: 'functools' },
    { q: "Show me a dataclass with slots and frozen=True", badge: 'dataclasses' },
  ];
  return (
    <div className="start-scroll">
      <div className="start">
        <div className="start-mark">
          <span>py</span>
        </div>
        <h1 className="start-title">Ask the Python docs<span className="start-dot">.</span></h1>
        <p className="start-sub">
          Grounded answers from <b>docs.python.org</b>, with inline citations to the exact paragraph that supports each claim.
        </p>

        <div className="start-stats">
          <div className="start-stat">
            <span className="num">3.13</span>
            <span className="lbl">Python version</span>
          </div>
          <span className="start-divider" />
          <div className="start-stat">
            <span className="num">1.24<i>M</i></span>
            <span className="lbl">chunks indexed</span>
          </div>
          <span className="start-divider" />
          <div className="start-stat">
            <span className="num">237</span>
            <span className="lbl">stdlib modules</span>
          </div>
          <span className="start-divider" />
          <div className="start-stat">
            <span className="num">2&nbsp;<i>min</i></span>
            <span className="lbl">last reindex</span>
          </div>
        </div>

        <button className="start-cta" onClick={onStart}>
          <span>Start chatting</span>
          <span className="start-cta-arrow">→</span>
        </button>
        <div className="start-cta-hint">
          Press <b>Enter</b> to launch the seeded asyncio walkthrough
        </div>

        <div className="start-examples-label">Try an example</div>
        <div className="start-examples">
          {examples.map((ex, i) => (
            <button key={i} className="start-example" onClick={onStart}>
              <span className="start-example-badge" data-seeded={ex.seeded ? '1' : '0'}>{ex.badge}</span>
              <span className="start-example-q">{ex.q}</span>
              <span className="start-example-arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Enter-to-start handler — global key listener while on the start screen.
function useEnterToStart(active, onStart) {
  useE(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onStart]);
}

// ── Message ──────────────────────────────────────────────────────────────
function Message({ m, ctx }) {
  if (m.role === 'retrieving') return <Retrieving m={m} />;

  return (
    <div className="msg" data-role={m.role}>
      <div className="msg-av">{m.role === 'user' ? 'you' : 'py'}</div>
      <div style={{flex:1, minWidth:0}}>
        <div className="msg-role">
          {m.role === 'user' ? 'You' : 'py.docs'}
          <span className="ts">{m.ts}</span>
        </div>
        <div className="msg-body">
          {m.role === 'user'
            ? <p>{m.text}</p>
            : <AssistantBody text={m.text} streaming={m.streaming} ctx={ctx} />}
        </div>
        {m.role === 'assistant' && !m.streaming && m.text && (
          <div className="msg-actions">
            <button title="Good answer">{Icon.thumbup}</button>
            <button title="Bad answer">{Icon.thumbdn}</button>
            <button title="Copy">{Icon.copy}</button>
            <button title="Share">{Icon.share}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Retrieving({ m }) {
  return (
    <div className="msg" data-role="system">
      <div className="msg-av" style={{background:'transparent', color:'var(--text-3)'}}>·</div>
      <div className={'retrieving' + (m.done ? ' done' : '')}>
        <span className="spin" />
        {m.done
          ? <span>Retrieved <b>{m.sources} chunks</b> from <b>docs.python.org</b></span>
          : <span>Searching <b>Python {3.13} docs</b>…</span>}
      </div>
    </div>
  );
}

// ── Assistant body ────────────────────────────────────────────────────────
function AssistantBody({ text, streaming, ctx }) {
  const blocks = useM(() => parseBlocks(text), [text]);

  return (
    <>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        if (b.kind === 'p') {
          if (!b.body.trim()) return null;
          return (
            <React.Fragment key={i}>
              <p>
                {renderInline(b.body, ctx)}
                {streaming && last && <span className="caret" />}
              </p>
              {ctx && ctx.citationStyle === 'inline' && pickCiteInParagraph(b.body, ctx, i)}
            </React.Fragment>
          );
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  {renderInline(it, ctx)}
                  {streaming && last && j === b.items.length - 1 && <span className="caret" />}
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'code') {
          return <CodeBlock key={i} lang={b.lang} body={b.body} />;
        }
        return null;
      })}
      {streaming && blocks.length > 0 && blocks[blocks.length-1].kind === 'code' && (
        <p style={{margin:0}}><span className="caret" /></p>
      )}
      {streaming && blocks.length === 0 && (
        <p><span className="dots"><i/><i/><i/></span></p>
      )}
    </>
  );
}

// Inline-card citation mode: render an expanded card under each para that referenced a citation.
function pickCiteInParagraph(body, ctx, key) {
  if (!ctx) return null;
  const seen = new Set();
  const m = body.match(/\[\[(\d+)\]\]/g) || [];
  return m.map((tok, i) => {
    const n = Number(tok.slice(2, -2));
    if (seen.has(n)) return null;
    seen.add(n);
    const c = ctx.citationsByN[n];
    if (!c) return null;
    return (
      <div key={`${key}-${i}`} className="cite-inline" onClick={() => ctx.openDrawer(n)}>
        <span className="ttl">[{n}] {c.title}</span>
        <span className="pth">docs.python.org / {c.path}{c.anchor}</span>
      </div>
    );
  });
}

// ── Footnote-style citation list ─────────────────────────────────────────
function FootnoteList({ citations, openDrawer }) {
  return (
    <div className="cite-foot">
      <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-3)', fontWeight:600, marginBottom:2}}>
        Sources
      </div>
      {citations.map((c) => (
        <div key={c.n} id={`cite-foot-${c.n}`} className="row" onClick={() => openDrawer(c.n)}>
          <span className="n">{c.n}</span>
          <div className="meta">
            <div className="ttl">{c.title}</div>
            <div className="pth">docs.python.org / {c.path}{c.anchor}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Followups ────────────────────────────────────────────────────────────
function Followups({ items, onPick }) {
  return (
    <div className="suggest">
      <div className="suggest-ttl">Suggested follow-ups</div>
      {items.map((q, i) => (
        <button key={i} onClick={() => onPick(q)}>{q}</button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
