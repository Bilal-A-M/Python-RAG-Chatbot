import React from 'react';

const PY_KEYWORDS = new Set([
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from','global',
  'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return',
  'try','while','with','yield','match','case',
]);

const PY_BUILTINS = new Set([
  'print','len','range','str','int','float','list','dict','set','tuple','bool',
  'enumerate','zip','map','filter','sorted','min','max','sum','abs','round',
  'isinstance','type','open','iter','next','super','object','any','all',
  'Exception','ValueError','TypeError','RuntimeError','KeyError','ExceptionGroup',
]);

function tokenizePython(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const push = (t, s) => { if (s) out.push({ t, s }); };

  while (i < n) {
    const c = src[i];

    // newline / whitespace
    if (c === '\n' || c === ' ' || c === '\t') {
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
      push('ws', src.slice(i, j));
      i = j;
      continue;
    }

    // comment
    if (c === '#') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      push('com', src.slice(i, j));
      i = j;
      continue;
    }

    // string (triple or single)
    if (c === '"' || c === "'") {
      const quote = c;
      const isTriple = src.slice(i, i + 3) === quote.repeat(3);
      let j = i + (isTriple ? 3 : 1);
      const end = isTriple ? quote.repeat(3) : quote;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (!isTriple && src[j] === '\n') break;
        if (src.slice(j, j + end.length) === end) { j += end.length; break; }
        j++;
      }
      push('str', src.slice(i, j));
      i = j;
      continue;
    }

    // f-string prefix (very small handling: treat f"..." as string)
    if ((c === 'f' || c === 'r' || c === 'b') && (src[i+1] === '"' || src[i+1] === "'")) {
      const quote = src[i+1];
      let j = i + 2;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n' || src[j] === quote) { j++; break; }
        j++;
      }
      push('str', src.slice(i, j));
      i = j;
      continue;
    }

    // number
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && /[0-9_.exXoObB]/.test(src[j])) j++;
      push('num', src.slice(i, j));
      i = j;
      continue;
    }

    // decorator
    if (c === '@' && i + 1 < n && /[A-Za-z_]/.test(src[i+1])) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++;
      push('dec', src.slice(i, j));
      i = j;
      continue;
    }

    // identifier
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (PY_KEYWORDS.has(word))        push('key', word);
      else if (word === 'self' || word === 'cls') push('self', word);
      else if (PY_BUILTINS.has(word))   push('bi', word);
      else if (src[j] === '(')          push('fn', word);
      else                              push('id', word);
      i = j;
      continue;
    }

    // punctuation / other
    push('p', c);
    i++;
  }
  return out;
}

function highlightPython(src) {
  const toks = tokenizePython(src);
  return toks.map((t, i) => {
    const cls = {
      key: 'tok-key', str: 'tok-str', num: 'tok-num', com: 'tok-com',
      fn: 'tok-fn', bi: 'tok-bi', self: 'tok-self', dec: 'tok-dec',
    }[t.t];
    return cls
      ? <span key={i} className={cls}>{t.s}</span>
      : <React.Fragment key={i}>{t.s}</React.Fragment>;
  });
}

export { highlightPython };
