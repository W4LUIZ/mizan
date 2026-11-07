/* Mizan: turns the text read from a nutrition label photo into calories and macros.
   OCR often reads the "g" unit as "9" and drops decimal points, so each number gets a few
   candidate readings and the set that best fits 4 kcal/g protein and carbs, 9 kcal/g fat wins. */
(function (root) {
  const NUM = /(\d+(?:[.,]\d+)?)\s*(mg|kcal|kj|g|ml|%)?/gi;
  function tokens(s) {
    const out = []; let m; NUM.lastIndex = 0;
    while ((m = NUM.exec(s))) { const u = (m[2] || '').toLowerCase(); if (u === '%' || u === 'mg') continue; out.push({ raw: m[1].replace(',', '.'), unit: u }); }
    return out;
  }
  function candidates(t) {
    const v = parseFloat(t.raw); const out = [];
    if (t.unit === 'g') {
      out.push([v, 0]);
      if (!t.raw.includes('.') && v >= 10) out.push([v / 10, 0.2]);
      return out;
    }
    const twoDec9 = /\.\d9$/.test(t.raw);
    out.push([v, twoDec9 ? 0.4 : 0.02]);
    if (/9$/.test(t.raw) && t.raw.length > 1) {
      const d = t.raw.slice(0, -1).replace(/\.$/, ''); const dv = parseFloat(d);
      out.push([dv, 0]);
      if (!d.includes('.') && dv >= 10) out.push([dv / 10, 0.15]);
    }
    if (!t.raw.includes('.') && v >= 10) out.push([v / 10, 0.25]);
    if (!t.raw.includes('.') && v >= 100) out.push([v / 100, 0.35]);
    return out;
  }
  function findLine(lines, re, not) {
    for (const l of lines) { const m = re.exec(l); if (m && !(not && not.test(l))) return l.slice(m.index + m[0].length); }
    return null;
  }
  function pick(list, col) { return list.length ? list[Math.min(col, list.length - 1)] : null; }
  function parseLabel(text) {
    const lines = String(text || '').split(/\n+/).map((l) => l.trim().toLowerCase()).filter(Boolean);
    const all = lines.join('\n');
    const per100 = /100\s*(g|9|ml|mi|m1)\b/.test(all);
    // Column: where the "per 100" column sits relative to a per-serving column on the header line
    let col = 0; let servG = null;
    const hdr = lines.find((l) => /100\s*(g|9|ml|mi)/.test(l) && /(per|serving|portion)/.test(l));
    if (hdr) {
      const nums = tokens(hdr).map((t) => t.raw);
      const i100 = nums.findIndex((n) => n === '100' || n === '1009');
      if (i100 > 0) col = i100;
      const other = nums.filter((n, i) => i !== i100).map((n) => parseFloat(/9$/.test(n) && n.length > 2 ? n.slice(0, -1) : n)).find((n) => n > 0 && n < 1000);
      if (other) servG = other;
    }
    const ss = /serving size[^\n]*?\(\s*(\d+(?:\.\d+)?)\s*(g|ml)?\s*\)/.exec(all) || /serving size[^\n]*?(\d+(?:\.\d+)?)\s*(g|ml)\b/.exec(all);
    if (ss && !servG) {
      let r = ss[1]; if (!ss[2] && /9$/.test(r) && r.length > 2) r = r.slice(0, -1);
      const v = parseFloat(r); if (v > 0 && v < 2000) servG = v;
    }
    // Energy
    let kcal = null;
    const kcalAll = []; let m; const reK = /(\d+(?:[.,]\d+)?)\s*kcal|kcal\s*[:\/]?\s*(\d+(?:[.,]\d+)?)/g;
    while ((m = reK.exec(all))) kcalAll.push(parseFloat((m[1] || m[2]).replace(',', '.')));
    if (kcalAll.length) kcal = pick(kcalAll, per100 ? col : 0);
    if (kcal == null) { const c = findLine(lines, /calories/); if (c) { const t = tokens(c)[0]; if (t) kcal = parseFloat(t.raw); } }
    if (kcal == null) {
      const kj = []; const reJ = /(\d+(?:[.,]\d+)?)\s*kj/g; while ((m = reJ.exec(all))) kj.push(parseFloat(m[1].replace(',', '.')));
      if (kj.length) kcal = Math.round(pick(kj, per100 ? col : 0) / 4.184);
    }
    const macro = (re, not) => { const l = findLine(lines, re, not); if (l == null) return null; const t = pick(tokens(l), per100 ? col : 0); return t ? candidates(t) : null; };
    const P = macro(/protein/); const C = macro(/carbohydrates?|carbs?\b|total carb/, /sugar/); const F = macro(/\bfat\b|\bfats\b|total fat/, /saturat|trans|mono|poly/);
    const max = per100 || !servG ? 100 : servG;
    let best = null;
    const opts = (x) => (x || [[null, 0]]).filter(([v]) => v == null || v <= max);
    for (const [p, pp] of opts(P)) for (const [c, cp] of opts(C)) for (const [f, fp] of opts(F)) {
      let err = pp + cp + fp;
      if (kcal && p != null && c != null && f != null) err += Math.abs(4 * p + 4 * c + 9 * f - kcal) / Math.max(kcal, 1);
      if (!best || err < best.err) best = { err, p, c, f };
    }
    const found = [kcal, best && best.p, best && best.c, best && best.f].filter((x) => x != null).length;
    return { basis: per100 ? '100' : 'serving', servingG: servG, k: kcal, p: best ? best.p : null, c: best ? best.c : null, f: best ? best.f : null, found };
  }
  root.parseLabel = parseLabel;
})(typeof window !== 'undefined' ? window : globalThis);
