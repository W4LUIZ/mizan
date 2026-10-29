/* Mizan — Phase 1. Personal calorie and macro tracker. */
(function () {
'use strict';

// ---------------------------------------------------------------- utils
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey(new Date());
const r0 = (n) => Math.round(n || 0);
const r1 = (n) => Math.round((n || 0) * 10) / 10;
const fmt = (n) => r0(n).toLocaleString('en-US');
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (k) => { const d = parseKey(k); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };

const ICON = {
  today: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  progress: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  doc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  scale: '<path d="M5 21h14M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8"/>'
};
const icon = (n, s = 22, extra = '') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${extra === 'fill' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---------------------------------------------------------------- reference data
const WORKOUTS = [
  { id: 'Run', met: 9.8 }, { id: 'Gym', met: 5.0 }, { id: 'Pilates', met: 3.5 }, { id: 'Lagree', met: 5.5 },
  { id: 'Walk', met: 3.5 }, { id: 'Padel', met: 6.0 }, { id: 'Cycling', met: 7.0 }, { id: 'Swim', met: 7.0 },
  { id: 'HIIT', met: 8.0 }, { id: 'Other', met: 4.0 }
];
const CREDIT = 0.78; // share of watch calories credited (resting burn is already in the base target)
const GROUPS = ['Carbs', 'Protein', 'Dairy', 'Vegetables', 'Fruits', 'Legumes', 'Fats & extras', 'Snacks', 'Supplements', 'Drinks', 'Dishes', 'Other'];

const STARTER = {};
(window.MIZAN_FOODS || []).forEach(([id, name, group, rawLabel, raw, cooked, units, note]) => {
  const v = (a) => a ? { k: a[0], p: a[1], c: a[2], f: a[3] } : null;
  STARTER[id] = { id, name, group, rawLabel, per: 100, raw: v(raw), cooked: v(cooked), units: (units || []).map(([l, g]) => ({ l, g })), starter: true, typical: note === 'typical' };
});

// ---------------------------------------------------------------- state
const freshCore = () => ({ profile: null, targets: null, settings: { accent: 'purple', maintenance: false }, favs: [], recent: [], saved: {}, weights: {}, checkins: {} });
const S = {
  core: freshCore(),
  foods: {},     // household foods and edited starter foods, by id (shared)
  recipes: {},   // by id (shared)
  months: {},    // 'YYYY-MM' -> { days: { 'YYYY-MM-DD': { entries: [], workouts: [] } } } (private)
  members: [],
  partner: {},
  ui: { view: 'today', day: today(), libTab: 'foods', libGroup: 'All', libQuery: '', sheets: [], setupStep: 0, setup: null,
        auth: { mode: 'signin', email: '', password: '', msg: '', busy: false }, hh: { name: '', display: '', code: '', msg: '', busy: false }, recovery: false, phase: 'loading', bootError: '' }
};
const clone = (o) => JSON.parse(JSON.stringify(o == null ? {} : o));

// ---------------------------------------------------------------- persistence (Supabase)
const CFG = window.MIZAN_CONFIG || {};
const Store = {
  sb: null, user: null, hh: null, timer: null, saving: false,
  dirty: new Set(), fUp: new Set(), fDel: new Set(), rUp: new Set(), rDel: new Set(),
  init() {
    if (!window.supabase || !CFG.url || !CFG.key) throw new Error('Mizan is missing its database settings.');
    this.sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  },
  async session() {
    const { data } = await this.sb.auth.getSession();
    this.user = data && data.session ? data.session.user : null;
    return this.user;
  },
  async loadHousehold() {
    const { data, error } = await this.sb.from('members').select('household_id, display_name, households(id, name, invite_code)').eq('user_id', this.user.id).maybeSingle();
    if (error) throw error;
    const h = data && (Array.isArray(data.households) ? data.households[0] : data.households);
    this.hh = data ? { id: data.household_id, name: h ? h.name : 'Home', code: h ? h.invite_code : '', me: data.display_name || '' } : null;
    return this.hh;
  },
  async loadMembers() {
    if (!this.hh) return;
    let res = await this.sb.from('members').select('user_id, display_name, share_log').eq('household_id', this.hh.id);
    if (res.error) res = await this.sb.from('members').select('user_id, display_name').eq('household_id', this.hh.id);
    S.members = res.data || [];
  },
  async loadPartnerMonth(uid, m) {
    const key = uid + '|' + m;
    S.partner[key] = S.partner[key] || { loading: true };
    const { data, error } = await this.sb.from('user_docs').select('data').eq('user_id', uid).eq('doc_id', 'm-' + m).maybeSingle();
    S.partner[key] = error ? { error: true } : { data: (data && data.data) || { days: {} } };
  },
  cacheKey() { return 'mizan.cache.' + (this.user ? this.user.id : 'none'); },
  readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(this.cacheKey()) || 'null');
      if (!c || !c.hh) return false;
      this.hh = c.hh; S.core = Object.assign(freshCore(), c.core); S.foods = c.foods || {}; S.recipes = c.recipes || {}; S.months = c.months || {}; S.members = c.members || [];
      return true;
    } catch (e) { return false; }
  },
  writeCache() {
    try { localStorage.setItem(this.cacheKey(), JSON.stringify({ hh: this.hh, core: S.core, foods: S.foods, recipes: S.recipes, months: S.months, members: S.members })); } catch (e) { /* storage full or blocked */ }
  },
  clearCache() { try { localStorage.removeItem(this.cacheKey()); } catch (e) { /* ignore */ } },
  async loadAll() {
    const sb = this.sb; const hid = this.hh.id;
    const [d, f, r] = await Promise.all([
      sb.from('user_docs').select('doc_id, data').eq('user_id', this.user.id),
      sb.from('foods').select('id, data').eq('household_id', hid),
      sb.from('recipes').select('id, data').eq('household_id', hid)
    ]);
    const err = d.error || f.error || r.error; if (err) throw err;
    const core = freshCore(); const months = {};
    (d.data || []).forEach((x) => { if (x.doc_id === 'core') Object.assign(core, x.data); else if (x.doc_id.startsWith('m-')) months[x.doc_id.slice(2)] = x.data; });
    const foods = {}; (f.data || []).forEach((x) => { foods[x.id] = x.data; });
    const recipes = {}; (r.data || []).forEach((x) => { recipes[x.id] = x.data; });
    // keep local changes that have not reached the server yet
    this.fUp.forEach((id) => { if (S.foods[id]) foods[id] = S.foods[id]; }); this.fDel.forEach((id) => { delete foods[id]; });
    this.rUp.forEach((id) => { if (S.recipes[id]) recipes[id] = S.recipes[id]; }); this.rDel.forEach((id) => { delete recipes[id]; });
    if (!this.dirty.has('core')) S.core = core;
    Object.keys(months).forEach((m) => { if (!this.dirty.has('m-' + m)) S.months[m] = months[m]; });
    S.foods = foods; S.recipes = recipes;
    await this.loadMembers().catch(() => {});
    this.writeCache();
  },
  body(id) {
    if (id === 'core') return S.core;
    if (id.startsWith('m-')) return S.months[id.slice(2)];
  },
  mark(id) { this.dirty.add(id); this.schedule(); },
  food(id, del) { (del ? this.fDel : this.fUp).add(id); (del ? this.fUp : this.fDel).delete(id); this.schedule(); },
  recipe(id, del) { (del ? this.rDel : this.rUp).add(id); (del ? this.rUp : this.rDel).delete(id); this.schedule(); },
  pending() { return this.dirty.size + this.fUp.size + this.fDel.size + this.rUp.size + this.rDel.size; },
  schedule(ms) { this.writeCache(); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms || 600); },
  async flush() {
    if (this.saving || !this.user || !this.hh || !this.pending()) return;
    this.saving = true;
    const sets = { d: this.dirty, fu: this.fUp, fd: this.fDel, ru: this.rUp, rd: this.rDel };
    const take = {}; Object.keys(sets).forEach((k) => { take[k] = [...sets[k]]; sets[k].clear(); });
    const now = new Date().toISOString(); const u = this.user.id; const hid = this.hh.id; const sb = this.sb;
    const jobs = [];
    const docs = take.d.filter((id) => this.body(id));
    if (docs.length) jobs.push(['d', take.d, sb.from('user_docs').upsert(docs.map((id) => ({ user_id: u, doc_id: id, data: clone(this.body(id)), updated_at: now })))]);
    const fu = take.fu.filter((id) => S.foods[id]);
    if (fu.length) jobs.push(['fu', take.fu, sb.from('foods').upsert(fu.map((id) => ({ household_id: hid, id, data: clone(S.foods[id]), updated_at: now })))]);
    if (take.fd.length) jobs.push(['fd', take.fd, sb.from('foods').delete().eq('household_id', hid).in('id', take.fd)]);
    const ru = take.ru.filter((id) => S.recipes[id]);
    if (ru.length) jobs.push(['ru', take.ru, sb.from('recipes').upsert(ru.map((id) => ({ household_id: hid, id, data: clone(S.recipes[id]), updated_at: now })))]);
    if (take.rd.length) jobs.push(['rd', take.rd, sb.from('recipes').delete().eq('household_id', hid).in('id', take.rd)]);
    const res = await Promise.all(jobs.map((j) => Promise.resolve(j[2]).then((x) => x, (e) => ({ error: e || { message: 'network' } }))));
    let failed = false;
    res.forEach((x, i) => { if (x && x.error) { failed = true; jobs[i][1].forEach((id) => sets[jobs[i][0]].add(id)); } });
    this.saving = false;
    syncState(failed);
    if (failed) this.schedule(10000);
    else if (this.pending()) this.schedule();
  }
};
const save = (...ids) => ids.forEach((id) => Store.mark(id));
function syncState(failed) {
  if (failed && !S.syncWarned) { S.syncWarned = true; toast('Can’t reach the server. Changes are kept on this phone and will save when you’re back online.'); }
  if (!failed && S.syncWarned) { S.syncWarned = false; toast('Back online. Changes saved.'); }
}

// ---------------------------------------------------------------- data access
const profile = () => S.core.profile;
const monthOf = (k) => k.slice(0, 7);
function dayData(k, create) {
  const m = monthOf(k);
  if (!S.months[m]) { if (!create) return { entries: [], workouts: [] }; S.months[m] = { days: {} }; }
  const days = S.months[m].days || (S.months[m].days = {});
  if (!days[k]) { if (!create) return { entries: [], workouts: [] }; days[k] = { entries: [], workouts: [] }; }
  return days[k];
}
const saveDay = (k) => save('m-' + monthOf(k));
function food(id) { return S.foods[id] || STARTER[id] || null; }
function allFoods() {
  const m = Object.assign({}, STARTER, S.foods);
  return Object.values(m).filter((f) => !f.deleted);
}
function mealsList() {
  const p = profile();
  const n = p ? p.mealsCount : 2;
  const base = n >= 3 ? ['Breakfast', 'Lunch', 'Dinner'] : ['Breakfast', 'Dinner'];
  return base.concat('Snacks');
}
function autoMeal() {
  const h = new Date().getHours(); const meals = mealsList();
  if (h < 11) return 'Breakfast';
  if (h < 16 && meals.includes('Lunch')) return 'Lunch';
  if (h < 18) return 'Snacks';
  return 'Dinner';
}

// macros of a food for an amount
function valsFor(f, state) { return (state === 'cooked' && f.cooked) ? f.cooked : f.raw; }
function macrosOf(f, state, qty, unitIdx) {
  const v = valsFor(f, state);
  if (!v) return { k: 0, p: 0, c: 0, f: 0 };
  let mult;
  if (f.per === 'serving') mult = qty;
  else { const u = unitIdx >= 0 ? f.units[unitIdx] : null; mult = (u ? u.g * qty : qty) / 100; }
  return { k: v.k * mult, p: v.p * mult, c: v.c * mult, f: v.f * mult };
}
function recipeTotals(r) {
  const t = { k: 0, p: 0, c: 0, f: 0, g: 0 };
  (r.items || []).forEach((it) => {
    const f = food(it.foodId); if (!f) return;
    const m = macrosOf(f, 'raw', it.g, -1);
    t.k += m.k; t.p += m.p; t.c += m.c; t.f += m.f; t.g += it.g;
  });
  const s = Math.max(r.servings || 1, 0.5);
  return { total: t, per: { k: t.k / s, p: t.p / s, c: t.c / s, f: t.f / s } };
}
function unitLabelState(label) { const l = (label || '').toLowerCase(); if (l.includes('cooked')) return 'cooked'; if (l.includes('raw') || l.includes('dry')) return 'raw'; return null; }

// ---------------------------------------------------------------- targets
function calcTargets(p) {
  const male = p.sex === 'male';
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (male ? 5 : -161);
  const act = { sit: 1.2, feet: 1.3, active: 1.45 }[p.activity] || 1.3;
  const maint = bmr * act;
  let pace = p.goal === 'maintain' || p.pregnant ? 0 : Math.min(p.pace || 0.5, p.weight * 0.01);
  let delta = pace * 1100;
  if (p.goal === 'gain') delta = -Math.min(delta, 500);
  let kcal = maint - (p.goal === 'gain' ? -Math.abs(delta) : delta);
  if (p.goal === 'gain') kcal = maint + Math.min(pace * 1100, 500);
  const floor = male ? 1500 : 1200;
  if (!p.pregnant) kcal = Math.max(kcal, floor); else kcal = maint;
  kcal = Math.round(kcal / 10) * 10;
  const protein = Math.round((p.goal === 'maintain' ? 1.6 : 1.8) * p.weight / 5) * 5;
  const fat = Math.round(kcal * 0.28 / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, maint: Math.round(maint / 10) * 10, floor };
}
function baseFor(k) {
  const t = S.core.targets; if (!t) return { kcal: 2000, protein: 120, carbs: 220, fat: 65 };
  if (S.core.settings.maintenance && t.maint) {
    const extra = t.maint - t.kcal;
    return { kcal: t.maint, protein: t.protein, fat: t.fat, carbs: t.carbs + Math.max(0, extra) / 4 };
  }
  return t;
}
function exerciseFor(k) { return dayData(k).workouts.reduce((s, w) => s + (w.credit || 0), 0); }
function totalsFor(k) {
  return dayData(k).entries.reduce((t, e) => { t.k += e.k; t.p += e.p; t.c += e.c; t.f += e.f; return t; }, { k: 0, p: 0, c: 0, f: 0 });
}
function workoutCredit(type, min, km, watch) {
  const w = (profile() && latestWeight()) || 70;
  if (watch > 0) return Math.round(watch * CREDIT);
  if (type === 'Run' && km > 0) return Math.round(w * km * CREDIT);
  const met = (WORKOUTS.find((x) => x.id === type) || { met: 4 }).met;
  return Math.round(Math.max(0, met - 1) * 3.5 * w / 200 * (min || 0));
}
function dayTag(k) {
  const ws = dayData(k).workouts;
  if (!ws.length) return 'Rest day';
  const top = ws.slice().sort((a, b) => (b.credit || 0) - (a.credit || 0))[0];
  return top.type + ' day';
}

// ---------------------------------------------------------------- weight + trend
function latestWeight() {
  const keys = Object.keys(S.core.weights).sort();
  if (keys.length) return S.core.weights[keys[keys.length - 1]];
  return profile() ? profile().weight : null;
}
function trendSeries() {
  const keys = Object.keys(S.core.weights).sort();
  if (!keys.length) return [];
  const out = []; let t = null; let k = keys[0]; const end = today();
  let guard = 0;
  while (k <= end && guard++ < 1000) {
    const w = S.core.weights[k];
    if (w != null) t = t == null ? w : t + 0.1 * (w - t);
    out.push({ k, w: w != null ? w : null, t });
    k = addDays(k, 1);
  }
  return out;
}

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------------------------------------------------------------- theme
function applyAccent() { document.documentElement.setAttribute('data-accent', S.core.settings.accent || 'purple'); }

// ================================================================= RENDER
function render() {
  applyAccent();
  const app = $('#app');
  if (S.ui.recovery) { app.innerHTML = renderRecovery(); renderSheet(); return; }
  if (S.ui.phase === 'loading') { app.innerHTML = '<div class="loading">Loading Mizan…</div>'; return; }
  if (S.ui.phase === 'error') { app.innerHTML = renderBootError(); return; }
  if (S.ui.phase === 'notice') { app.innerHTML = renderNotice(); return; }
  if (S.ui.phase === 'auth') { app.innerHTML = renderAuth(); renderSheet(); return; }
  if (S.ui.phase === 'household') { app.innerHTML = renderHousehold(); renderSheet(); return; }
  if (!profile() || S.ui.editing) { app.innerHTML = renderSetup(); renderSheet(); return; }
  const v = S.ui.view;
  const body = v === 'library' ? renderLibrary() : v === 'progress' ? renderProgress() : v === 'settings' ? renderSettings() : renderToday();
  app.innerHTML = body + renderNav();
  renderSheet();
}
function renderNav() {
  const t = (id, label) => `<button class="tab" data-act="nav" data-v="${id}" ${S.ui.view === id ? 'aria-current="page"' : ''}>${icon(id)}${label}</button>`;
  return `<nav class="nav" aria-label="Main"><div class="in">${t('today', 'Today')}${t('library', 'Library')}
    <button class="plus" data-act="openLog" aria-label="Log food">${icon('plus', 26)}</button>${t('progress', 'Progress')}${t('settings', 'Settings')}</div></nav>`;
}

// ---------------------------------------------------------------- Today
function sharingPartners() { return S.members.filter((m) => Store.user && m.user_id !== Store.user.id && m.share_log); }
function viewSwitch() {
  const ps = sharingPartners(); if (!ps.length) return '';
  const v = S.ui.viewing;
  return `<div class="seg" role="group" aria-label="Whose log">
    <button data-act="viewLog" data-u="" aria-pressed="${!v}">My log</button>
    ${ps.map((m) => `<button data-act="viewLog" data-u="${esc(m.user_id)}" aria-pressed="${v === m.user_id}">${esc(m.display_name || 'Member')}'s log</button>`).join('')}</div>`;
}
function dayHeader(k, pill) {
  const isToday = k === today();
  const label = isToday ? 'Today' : k === addDays(today(), -1) ? 'Yesterday' : k === addDays(today(), 1) ? 'Tomorrow' : longDate(k).split(',')[0];
  return `<div class="hdr"><div><div class="eyebrow">${esc(longDate(k))}</div>
      <div class="row" style="gap:6px"><button class="icon-btn" data-act="day" data-d="-1" aria-label="Previous day" style="width:32px;height:32px;background:none">${icon('left', 20)}</button>
      <h1>${label}</h1><button class="icon-btn" data-act="day" data-d="1" aria-label="Next day" style="width:32px;height:32px;background:none">${icon('right', 20)}</button></div></div>
      <span class="pill">${esc(pill)}</span></div>`;
}
function partnerDay(uid, k) {
  const e = S.partner[uid + '|' + monthOf(k)];
  if (!e) { Store.loadPartnerMonth(uid, monthOf(k)).then(() => { if (S.ui.viewing === uid) softRender(); }); return null; }
  if (e.loading) return null;
  if (e.error) return { error: true };
  return (e.data.days && e.data.days[k]) || { entries: [], workouts: [] };
}
function renderPartnerToday(uid) {
  const k = S.ui.day; const m = S.members.find((x) => x.user_id === uid) || {}; const name = m.display_name || 'Member';
  const dd = partnerDay(uid, k);
  let body;
  if (!dd) body = `<div class="card note">Loading ${esc(name)}'s log…</div>`;
  else if (dd.error) body = `<div class="card note">Couldn't load ${esc(name)}'s log. Check your connection and try again.</div>`;
  else {
    const tot = dd.entries.reduce((t, e) => { t.k += e.k; t.p += e.p; t.c += e.c; t.f += e.f; return t; }, { k: 0, p: 0, c: 0, f: 0 });
    const burned = dd.workouts.reduce((a, w) => a + (w.credit || 0), 0);
    const workouts = dd.workouts.map((w) => `<div class="item"><span class="add-btn" style="background:var(--soft)">${icon('pulse', 20)}</span>
      <span class="grow"><span class="name">${esc(w.type)}${w.km ? ' · ' + r1(w.km) + ' km' : ''}</span><span class="sub">${w.min ? r0(w.min) + ' min' : ''}${w.watch ? ' · ' + fmt(w.watch) + ' kcal on watch' : ''}</span></span>
      <span class="num" style="color:var(--acc)">+${fmt(w.credit)}</span></div>`).join('');
    const mealNames = []; dd.entries.forEach((e) => { if (!mealNames.includes(e.meal)) mealNames.push(e.meal); });
    const order = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']; mealNames.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const meals = mealNames.map((meal) => {
      const es = dd.entries.filter((e) => e.meal === meal);
      return `<section class="list" aria-label="${esc(meal)}"><div class="meal-head"><div><h2>${esc(meal)}</h2><span class="small muted">${fmt(es.reduce((a, e) => a + e.k, 0))} kcal</span></div>
        <button class="pill" data-act="copyFrom" data-meal="${esc(meal)}">Copy meal</button></div>
        ${es.map((e) => `<div class="item"><span class="grow"><span class="name">${esc(e.name)}${e.out ? '<span class="badge">Out</span>' : ''}</span><span class="sub">${esc(e.detail)} · ${fmt(e.k)} kcal</span></span>
          <button class="add-btn" data-act="copyFrom" data-id="${esc(e.id)}" aria-label="Copy ${esc(e.name)} to my log">${icon('copy', 18)}</button></div>`).join('')}</section>`;
    }).join('');
    body = `<section class="card ring-card" aria-label="${esc(name)}'s day">
        <div class="small muted">Eaten</div><div class="num" style="font-size:40px;line-height:1">${fmt(tot.k)}</div><div class="small muted">kcal${burned ? ' · +' + fmt(burned) + ' from workouts' : ''}</div>
        <div class="trio"><div><div class="num" style="color:var(--p)">${r0(tot.p)} g</div><div class="small muted">Protein</div></div><div><div class="num" style="color:var(--c)">${r0(tot.c)} g</div><div class="small muted">Carbs</div></div><div><div class="num" style="color:var(--f)">${r0(tot.f)} g</div><div class="small muted">Fat</div></div></div></section>
      ${workouts ? `<section class="list"><div class="meal-head"><h2>Workouts</h2></div>${workouts}</section>` : ''}
      ${meals || `<div class="card note">${esc(name)} hasn't logged any food on this day.</div>`}
      <p class="note" style="margin:0">Tap the copy button on a food, or Copy meal, to add it to your own log. ${esc(name)}'s weight and targets stay private.</p>`;
  }
  return `<main class="screen">${dayHeader(k, 'Read only')}${viewSwitch()}${body}</main>`;
}
function renderToday() {
  if (S.ui.viewing && sharingPartners().some((m) => m.user_id === S.ui.viewing)) return renderPartnerToday(S.ui.viewing);
  S.ui.viewing = null;
  const k = S.ui.day; const isToday = k === today();
  const base = baseFor(k); const ex = exerciseFor(k); const tot = totalsFor(k);
  const allowance = base.kcal + ex; const left = allowance - tot.k;
  const C = 2 * Math.PI * 84; const frac = clamp(tot.k / Math.max(allowance, 1), 0, 1);
  const over = left < 0;
  const carbsT = base.carbs + ex / 4;
  const macro = (name, val, goal, col) => `<div class="macro"><div class="top"><b>${name}</b><span class="muted" style="font-weight:600">${r0(val)} / ${r0(goal)} g</span></div>
    <div class="bar"><i style="width:${clamp(val / Math.max(goal, 1) * 100, 0, 100)}%;background:var(${col})"></i></div></div>`;
  const label = isToday ? 'Today' : k === addDays(today(), -1) ? 'Yesterday' : k === addDays(today(), 1) ? 'Tomorrow' : longDate(k).split(',')[0];
  const dd = dayData(k);
  const workouts = dd.workouts.map((w) => `<button class="item" data-act="editWorkout" data-id="${w.id}">
      <span class="add-btn" style="background:var(--soft)">${icon('pulse', 20)}</span>
      <span class="grow"><span class="name">${esc(w.type)}${w.km ? ' · ' + r1(w.km) + ' km' : ''}</span><span class="sub">${w.src === 'strava' ? 'Strava · ' : ''}${w.min ? r0(w.min) + ' min' : ''}${w.watch ? ' · ' + fmt(w.watch) + ' kcal on watch' : ' · estimated'}</span></span>
      <span class="num" style="color:var(--acc)">+${fmt(w.credit)}</span></button>`).join('');
  const w = S.core.weights[k];
  const meals = mealsList().map((m) => {
    const es = dd.entries.filter((e) => e.meal === m);
    const sum = es.reduce((s, e) => s + e.k, 0);
    const rows = es.map((e) => `<button class="item" data-act="editEntry" data-id="${e.id}">
        <span class="grow"><span class="name">${esc(e.name)}${e.out ? '<span class="badge">Out</span>' : ''}</span><span class="sub">${esc(e.detail)}</span></span>
        <span class="num">${fmt(e.k)}</span></button>`).join('');
    return `<section class="list" aria-label="${m}"><div class="meal-head"><div><h2>${m}</h2><span class="small muted">${es.length ? fmt(sum) + ' kcal' : 'Nothing logged'}</span></div>
      <div class="row" style="gap:8px">${es.length ? `<button class="link small" data-act="saveMeal" data-meal="${m}">Save meal</button>` : ''}<button class="add-btn" data-act="openLog" data-meal="${m}" aria-label="Add to ${m}">+</button></div></div>${rows}</section>`;
  }).join('');
  return `<main class="screen">
    ${dayHeader(k, dayTag(k))}${viewSwitch()}
    <section class="card ring-card" aria-label="Calories">
      <div class="ring"><svg width="196" height="196" viewBox="0 0 196 196" aria-hidden="true">
        <circle cx="98" cy="98" r="84" fill="none" stroke="var(--track)" stroke-width="14"/>
        <circle cx="98" cy="98" r="84" fill="none" stroke="${over ? 'var(--bad)' : 'var(--acc)'}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 98 98)"/></svg>
        <div class="center"><div class="num big" style="${over ? 'color:var(--bad)' : ''}">${fmt(Math.abs(left))}</div><div class="small muted" style="font-weight:600;margin-top:6px">${over ? 'kcal over' : 'kcal left'}</div></div></div>
      <div class="trio"><div><div class="num">${fmt(base.kcal)}</div><div class="small muted">${S.core.settings.maintenance ? 'Maintenance' : 'Base target'}</div></div>
        <div><div class="num" style="color:var(--acc)">+${fmt(ex)}</div><div class="small muted">Exercise</div></div>
        <div><div class="num">${fmt(tot.k)}</div><div class="small muted">Eaten</div></div></div>
    </section>
    <section class="card stack" aria-label="Macros">${macro('Protein', tot.p, base.protein, '--p')}${macro('Carbs', tot.c, carbsT, '--c')}${macro('Fat', tot.f, base.fat, '--f')}</section>
    <section class="list" aria-label="Workouts"><div class="meal-head"><div><h2>Workouts</h2><span class="small muted">${dd.workouts.length ? '' : 'No workout logged'}</span></div>
      <button class="add-btn" data-act="addWorkout" aria-label="Add workout">+</button></div>${workouts}</section>
    <button class="card row" data-act="logWeight" style="border:0;text-align:left;color:inherit">
      <span class="add-btn">${icon('scale', 18)}</span><span class="grow"><b>Weight</b><br><span class="small muted">${w != null ? 'Logged for this day' : 'Tap to log your morning weight'}</span></span>
      <span class="num" style="font-size:18px">${w != null ? r1(w) + ' kg' : '—'}</span></button>
    ${meals}
  </main>`;
}

// ---------------------------------------------------------------- Library
function renderLibrary() {
  const tab = S.ui.libTab; const q = S.ui.libQuery.trim().toLowerCase();
  let list;
  if (tab === 'foods') {
    let fs = allFoods();
    if (S.ui.libGroup !== 'All') fs = fs.filter((f) => f.group === S.ui.libGroup);
    if (q) fs = fs.filter((f) => f.name.toLowerCase().includes(q));
    fs.sort((a, b) => a.name.localeCompare(b.name));
    const groups = ['All'].concat(GROUPS.filter((g) => allFoods().some((f) => f.group === g)));
    list = `<div class="chips" role="group" aria-label="Food groups">${groups.map((g) => `<button class="chip" data-act="libGroup" data-g="${esc(g)}" aria-pressed="${S.ui.libGroup === g}">${esc(g)}</button>`).join('')}</div>
      <div class="list">${fs.length ? fs.map((f) => foodRow(f, 'openFood')).join('') : '<div class="empty">No foods match.</div>'}</div>`;
  } else {
    let rs = Object.values(S.recipes);
    if (q) rs = rs.filter((r) => r.name.toLowerCase().includes(q));
    rs.sort((a, b) => a.name.localeCompare(b.name));
    list = rs.length ? rs.map((r) => {
      const t = recipeTotals(r).per;
      return `<button class="card" data-act="openRecipe" data-id="${r.id}" style="border:0;text-align:left;color:inherit;width:100%">
        <div class="row" style="align-items:flex-start"><div class="grow"><div style="font-weight:800;font-size:16px">${esc(r.name)}</div><div class="small muted">Serves ${r1(r.servings)} · ${r.items.length} ingredients${r.by ? ' · by ' + esc(r.by) : ''}</div></div>
        <div style="text-align:right"><div class="num" style="font-size:18px">${fmt(t.k)}</div><div class="small muted">kcal / serving</div></div></div>
        <div class="row" style="gap:6px;margin-top:10px"><span class="mchip" style="color:var(--p)">P ${r0(t.p)} g</span><span class="mchip" style="color:var(--c)">C ${r0(t.c)} g</span><span class="mchip" style="color:var(--f)">F ${r0(t.f)} g</span></div></button>`;
    }).join('') : `<div class="card note">No recipes yet. Add your regular home dishes once, by their raw or dry ingredients, and log them by the serving after that.</div>`;
  }
  return `<main class="screen">
    <div class="hdr"><div><div class="eyebrow">Foods and recipes</div><h1>Library</h1></div>
      <button class="pill" data-act="${tab === 'foods' ? 'newFood' : 'newRecipe'}" style="background:var(--acc);color:var(--on)">+ New ${tab === 'foods' ? 'food' : 'recipe'}</button></div>
    <div class="seg" role="group"><button data-act="libTab" data-t="foods" aria-pressed="${tab === 'foods'}">Foods &amp; ingredients</button><button data-act="libTab" data-t="recipes" aria-pressed="${tab === 'recipes'}">Recipes</button></div>
    <label class="search">${icon('search', 20)}<input id="libSearch" data-in="libSearch" type="search" placeholder="Search ${tab === 'foods' ? 'foods' : 'recipes'}" value="${esc(S.ui.libQuery)}" aria-label="Search"></label>
    <div id="libList" class="stack">${list}</div>
  </main>`;
}
function foodRow(f, act, extra = '') {
  const v = f.raw || { k: 0 };
  const basis = f.per === 'serving' ? 'per serving' : 'per 100 g' + (f.rawLabel ? ' ' + f.rawLabel.toLowerCase() : '');
  return `<button class="item" data-act="${act}" data-id="${esc(f.id)}" ${extra}>
    <span class="grow"><span class="name">${esc(f.name)}${!S.foods[f.id] ? '' : `<span class="badge">${STARTER[f.id] ? 'Edited' : 'Custom'}</span>`}</span><br>
    <span class="sub">${esc(f.group || '')} · ${fmt(v.k)} kcal ${basis}${f.cooked ? ' · cooked values' : ''}${f.typical && !S.foods[f.id] ? ' · typical' : ''}${f.by ? ' · by ' + esc(f.by) : ''}</span></span>
    <span class="muted">${icon('right', 18)}</span></button>`;
}

// ---------------------------------------------------------------- Progress
function renderProgress() {
  const series = trendSeries(); const p = profile();
  const last = series.length ? series[series.length - 1] : null;
  const trend = last ? last.t : latestWeight();
  let rate = null;
  if (series.length >= 10) { const back = series[Math.max(0, series.length - 15)]; const days = series.length - 1 - series.indexOf(back); rate = (last.t - back.t) / days * 7; }
  const h = p.height / 100; const bmi = trend / (h * h);
  let msBmi = Math.floor(bmi); if (Math.abs(msBmi - bmi) < 0.05) msBmi -= 1;
  let milestone = p.goal === 'lose' ? Math.max(msBmi * h * h, p.goalWeight || 0) : p.goalWeight;
  const weeks = rate && rate < -0.05 && milestone && trend > milestone ? Math.ceil((trend - milestone) / -rate) : null;

  // weight chart
  const pts = series.slice(-30);
  let chart = `<div class="note">Log your weight each morning. The trend line appears after a few weigh-ins.</div>`;
  if (pts.length >= 2) {
    const W = 320, H = 130, padL = 6, padR = 40;
    const vals = pts.flatMap((x) => [x.w, x.t]).filter((x) => x != null);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    const X = (i) => padL + i * (W - padL - padR) / (pts.length - 1);
    const Y = (v) => 10 + (hi - v) / (hi - lo) * (H - 20);
    const dots = pts.map((x, i) => x.w != null ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.w).toFixed(1)}" r="3" fill="var(--muted)" opacity=".55"/>` : '').join('');
    const line = pts.map((x, i) => `${X(i).toFixed(1)},${Y(x.t).toFixed(1)}`).join(' ');
    const lx = X(pts.length - 1), ly = Y(pts[pts.length - 1].t);
    chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Weight trend, last ${pts.length} days">
      <text x="${W}" y="14" text-anchor="end" font-size="10" fill="var(--muted)" font-family="var(--num)">${r1(hi)}</text>
      <text x="${W}" y="${H - 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="var(--num)">${r1(lo)}</text>
      ${dots}<polyline points="${line}" fill="none" stroke="var(--acc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="5" fill="var(--acc)"/></svg>`;
  }

  // week bars
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(today(), -i));
  const maxV = Math.max(...days.map((k) => Math.max(totalsFor(k).k, baseFor(k).kcal + exerciseFor(k))), 1);
  let pDays = 0, logged = 0;
  const bars = days.map((k) => {
    const e = totalsFor(k).k; const tgt = baseFor(k).kcal + exerciseFor(k);
    if (e > 0) { logged++; if (totalsFor(k).p >= baseFor(k).protein * 0.95) pDays++; }
    const over = e > tgt + 50;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
      <div style="position:relative;height:90px;width:22px;display:flex;align-items:flex-end">
        <div style="width:22px;height:${(e / maxV * 90).toFixed(0)}px;border-radius:6px;background:${over ? 'var(--bad)' : 'var(--acc)'}"></div>
        <div style="position:absolute;left:-4px;right:-4px;bottom:${(tgt / maxV * 90).toFixed(0)}px;height:2px;background:var(--fg);opacity:.6"></div></div>
      <div class="small muted" style="font-weight:700">${DAYS[parseKey(k).getDay()][0]}</div></div>`;
  }).join('');

  // breakdown
  const cats = {}; let all = 0;
  days.forEach((k) => dayData(k).entries.forEach((e) => {
    const c = e.out ? 'Eating out' : e.group === 'Drinks' ? 'Drinks' : e.meal; cats[c] = (cats[c] || 0) + e.k; all += e.k;
  }));
  const palette = ['var(--acc)', 'var(--c)', 'var(--p)', 'var(--f)', 'var(--muted)', 'var(--fg)'];
  const parts = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const breakdown = all > 0 ? `<div style="display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px;margin:12px 0 10px">${parts.map(([n, v], i) => `<i style="width:${v / all * 100}%;background:${palette[i % palette.length]}"></i>`).join('')}</div>
    <div class="grid2" style="gap:6px 10px">${parts.map(([n, v], i) => `<div class="row small" style="gap:6px"><span style="width:9px;height:9px;border-radius:3px;background:${palette[i % palette.length]};flex:none"></span><span class="muted grow">${esc(n)}</span><b>${r0(v / all * 100)}%</b></div>`).join('')}</div>`
    : `<div class="note" style="margin-top:8px">Log a few days of meals to see where your calories come from.</div>`;

  return `<main class="screen">
    <div class="hdr"><div><div class="eyebrow">Your trend</div><h1>Progress</h1></div>
      <button class="pill" data-act="logWeight">+ Weight</button></div>
    <section class="card">
      <div class="row" style="align-items:flex-end"><div class="grow"><div class="small muted">Trend weight</div><div class="num" style="font-size:34px;line-height:1.1">${trend ? r1(trend) : '—'} <span class="muted" style="font-size:16px">kg</span></div></div>
        <div style="text-align:right"><div class="num" style="font-size:18px;color:var(--acc)">${rate == null ? '—' : (rate > 0 ? '+' : '−') + Math.abs(r1(rate)) + ' kg/wk'}</div><div class="small muted">${p.goal === 'lose' ? 'goal −' + p.pace : p.goal === 'gain' ? 'goal +' + p.pace : 'goal: hold steady'}</div></div></div>
      <div style="margin-top:10px">${chart}</div>
      <div class="small muted" style="margin-top:6px">BMI ${trend ? r1(bmi) : '—'}${milestone && trend && p.goal === 'lose' ? ` · Next milestone <b style="color:var(--fg)">${r1(milestone)} kg${milestone > (p.goalWeight || 0) ? ' (BMI ' + msBmi + ')' : ''}</b>${weeks ? ' · about ' + weeks + ' week' + (weeks > 1 ? 's' : '') : ''}` : ''}${p.goalWeight ? ' · Goal ' + r1(p.goalWeight) + ' kg' : ''}</div>
      ${series.length < 10 ? '<div class="small muted" style="margin-top:4px">Weekly rate shows after about 10 days of weigh-ins.</div>' : ''}
    </section>
    <section class="card"><div class="row"><h2 class="grow">Last 7 days</h2><span class="small muted">Protein hit ${pDays} of ${logged || 7} days</span></div>
      <div style="display:flex;gap:4px;margin-top:14px">${bars}</div>
      <div class="small muted" style="margin-top:8px">Bars show calories eaten; the line marks that day's allowance.</div></section>
    <section class="card"><h2>Where calories come from</h2>${breakdown}</section>
    ${renderCheckin()}
  </main>`;
}
function weekKey(k) { const d = parseKey(k); d.setDate(d.getDate() - d.getDay()); return dkey(d); }
function checkinCalc() {
  const series = trendSeries(); const p = profile(); const t = S.core.targets;
  const end = today(); const start = addDays(end, -14);
  const daysLogged = []; for (let i = 1; i <= 14; i++) { const k = addDays(end, -i); if (totalsFor(k).k > 400) daysLogged.push(k); }
  const ws = Object.keys(S.core.weights).filter((k) => k >= start).length;
  if (daysLogged.length < 10 || ws < 8 || series.length < 14) return { ready: false, daysLogged: daysLogged.length, ws };
  const tEnd = series[series.length - 1].t; const tStart = (series.find((x) => x.k >= start) || series[0]).t;
  const avgIn = daysLogged.reduce((s, k) => s + totalsFor(k).k, 0) / daysLogged.length;
  const avgEx = daysLogged.reduce((s, k) => s + exerciseFor(k), 0) / daysLogged.length;
  const expend = avgIn - (tEnd - tStart) * 7700 / 14;
  const wantDelta = p.goal === 'lose' ? -p.pace * 1100 : p.goal === 'gain' ? Math.min(p.pace * 1100, 500) : 0;
  let suggested = expend - avgEx + wantDelta;
  suggested = clamp(suggested, t.kcal - 150, t.kcal + 150);
  suggested = Math.max(suggested, p.sex === 'male' ? 1500 : 1200);
  suggested = Math.round(suggested / 10) * 10;
  return { ready: true, rate: (tEnd - tStart) / 2, avgIn, suggested, current: t.kcal, expend };
}
function renderCheckin() {
  const wk = weekKey(today()); const done = S.core.checkins[wk];
  const c = checkinCalc();
  if (!c.ready) return `<section class="card"><h2>Weekly check-in</h2><div class="note" style="margin-top:6px">Each Sunday Mizan compares what you ate with how your trend weight moved, then suggests a target adjustment if needed. It needs 2 weeks of data: at least 10 logged days (you have ${c.daysLogged}) and 8 weigh-ins (you have ${c.ws}).</div></section>`;
  if (done) return `<section class="card"><h2>Weekly check-in</h2><div class="note" style="margin-top:6px">Done for this week: ${done.applied ? 'base target set to ' + fmt(done.to) + ' kcal' : 'target kept at ' + fmt(done.to) + ' kcal'}.</div></section>`;
  const same = Math.abs(c.suggested - c.current) < 20;
  return `<section class="card"><h2>Weekly check-in</h2>
    <div class="note" style="margin-top:6px">Over the last 2 weeks you averaged ${fmt(c.avgIn)} kcal a day and your trend moved ${c.rate > 0 ? '+' : '−'}${Math.abs(r1(c.rate))} kg per week. Your estimated daily burn is about ${fmt(c.expend)} kcal.</div>
    <div class="row" style="margin-top:12px"><div class="grow"><div class="small muted">Suggested base target</div><div class="num" style="font-size:24px">${fmt(c.suggested)} kcal</div><div class="small muted">Currently ${fmt(c.current)}</div></div></div>
    <div class="row" style="margin-top:12px">${same ? '<button class="btn block" data-act="checkin" data-apply="0">Keep my target</button>' : `<button class="btn ghost grow" data-act="checkin" data-apply="0">Keep ${fmt(c.current)}</button><button class="btn grow" data-act="checkin" data-apply="1" data-to="${c.suggested}">Use ${fmt(c.suggested)}</button>`}</div></section>`;
}

// ---------------------------------------------------------------- Settings
function renderSettings() {
  const p = profile(); const t = S.core.targets; const st = S.core.settings;
  const row = (label, value, act, extra = '') => `<button class="item" data-act="${act}" ${extra}><span class="grow" style="font-weight:700">${label}</span><span class="muted">${value}</span><span class="muted">${icon('right', 18)}</span></button>`;
  return `<main class="screen">
    <div class="hdr"><div><div class="eyebrow">${esc(p.name || 'You')}</div><h1>Settings</h1></div></div>
    <button class="card row" data-act="editProfile" style="border:0;text-align:left;color:inherit">
      <span class="add-btn" style="width:44px;height:44px;font-size:18px">${esc((p.name || '?')[0].toUpperCase())}</span>
      <span class="grow"><b>${esc(p.name || 'Profile')}</b><br><span class="small muted">${p.height} cm · ${p.age} y · ${r1(latestWeight())} → ${p.goalWeight ? r1(p.goalWeight) : '—'} kg</span></span>${icon('right', 18)}</button>
    <div class="eyebrow">Targets</div>
    <div class="list">${row('Base calories', fmt(t.kcal) + ' kcal', 'editTargets')}${row('Protein', t.protein + ' g', 'editTargets')}
      ${row('Weekly goal', p.goal === 'maintain' ? 'Maintain' : (p.goal === 'lose' ? '−' : '+') + p.pace + ' kg', 'editProfile')}
      <div class="item"><span class="grow"><b>Maintenance mode</b><span class="sub wrap">For taper and race weeks: eat at maintenance (${fmt(t.maint)} kcal)</span></span>
        <button class="toggle" role="switch" aria-checked="${!!st.maintenance}" aria-label="Maintenance mode" data-act="toggleMaint"></button></div></div>
    <div class="eyebrow">Appearance</div>
    <div class="list"><div class="item"><span class="grow"><b>Colour</b><span class="sub wrap">Light or dark follows your phone</span></span>
      <div class="row" style="gap:12px">${[['purple', '#A78BFA'], ['green', '#4ADE80'], ['blue', '#7DD3FC']].map(([n, c]) => `<button class="swatch" style="background:${c}" data-act="accent" data-a="${n}" aria-pressed="${st.accent === n}" aria-label="${n}"></button>`).join('')}</div></div></div>
    <div class="eyebrow">Connections</div>
    ${renderStravaSettings()}
    <div class="eyebrow">Reminders</div>
    <div class="list"><div class="item"><span class="grow"><b>Weigh-in, meal and check-in reminders</b><span class="sub wrap">Phone notifications arrive in Phase 4, once Mizan is installed on your home screen.</span></span></div></div>
    <div class="eyebrow">Household</div>
    <div class="list">
      <div class="item"><span class="grow"><b>${esc(Store.hh ? Store.hh.name : '')}</b><span class="sub">${S.members.length ? S.members.map((m) => esc(m.display_name || 'Member')).join(' · ') : ''}</span></span></div>
      <div class="item"><span class="grow"><b>Invite code</b><span class="sub wrap">Share it so someone can join and use the same foods and recipes</span></span>
        <span class="num" style="font-size:18px;letter-spacing:.12em">${esc(Store.hh ? Store.hh.code : '')}</span><button class="pill" data-act="copyCode">Copy</button></div>
      <div class="item"><span class="grow"><b>Share my food log</b><span class="sub wrap">Household members can see your meals and workouts and copy foods from them. Your weight and targets stay private.</span></span>
        <button class="toggle" role="switch" aria-checked="${!!((S.members.find((m) => Store.user && m.user_id === Store.user.id) || {}).share_log)}" aria-label="Share my food log" data-act="toggleShare"></button></div></div>
    <div class="eyebrow">Account</div>
    <div class="list"><div class="item"><span class="grow"><b>Signed in</b><span class="sub">${esc(Store.user ? Store.user.email : '')}</span></span><button class="pill" data-act="signOut">Sign out</button></div></div>
    <div class="eyebrow">Your data</div>
    <div class="list">
      <div class="item"><span class="grow"><b>Saved</b><span class="sub wrap">Your logs, weight and targets are private to you. Foods and recipes are shared with your household.</span></span></div>
      ${row('Export log as spreadsheet (CSV)', '', 'exportCsv')}${row('Download full backup', '', 'exportBackup')}
      <label class="item" style="cursor:pointer"><span class="grow" style="font-weight:700">Restore from backup</span><input type="file" accept="application/json,.json" data-in="restore" style="display:none"><span class="muted">${icon('right', 18)}</span></label></div>
    <p class="note">Mizan · ${Object.keys(STARTER).length} starter foods, based on USDA FoodData Central.</p>
  </main>`;
}

// ================================================================= ACCOUNT
const LOGO = `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><rect width="56" height="56" rx="16" fill="var(--acc)"/>
  <g fill="none" stroke="var(--on)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M28 13v29M19 42h18M14 19h28"/>
  <path d="M14 19l-5 11a5 5 0 0 0 10 0zM42 19l-5 11a5 5 0 0 0 10 0z"/></g></svg>`;
function renderAuth() {
  const a = S.ui.auth; const up = a.mode === 'signup'; const reset = a.mode === 'reset';
  return `<main class="screen" style="padding-top:calc(40px + env(safe-area-inset-top, 0px));max-width:420px;margin:0 auto">
    <div class="stack" style="align-items:flex-start;gap:12px">${LOGO}<div><h1 style="font-size:34px">Mizan</h1><p class="note" style="margin:4px 0 0">Calories, training and weight, in balance.</p></div></div>
    ${reset ? '' : `<div class="seg" role="group"><button data-act="authMode" data-m="signin" aria-pressed="${!up}">Sign in</button><button data-act="authMode" data-m="signup" aria-pressed="${up}">Create account</button></div>`}
    <form class="stack" data-form="auth" novalidate>
      ${reset ? '<p class="note">Enter your email and Mizan will send you a link to set a new password.</p>' : ''}
      <label class="f">Email<input class="input" id="au-email" data-in="auF" data-f="email" type="email" autocomplete="email" inputmode="email" value="${esc(a.email)}"></label>
      ${reset ? '' : `<label class="f">Password<input class="input" id="au-pass" data-in="auF" data-f="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" value="${esc(a.password)}">${up ? '<span class="small muted" style="font-weight:600">At least 8 characters</span>' : ''}</label>`}
      ${a.msg ? `<p class="note" role="status" style="color:${a.ok ? 'var(--good)' : 'var(--bad)'};font-weight:700">${esc(a.msg)}</p>` : ''}
      <button class="btn block" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Please wait…' : reset ? 'Send reset link' : up ? 'Create account' : 'Sign in'}</button>
    </form>
    ${reset ? '<button class="link" data-act="authMode" data-m="signin">Back to sign in</button>' : up ? '' : '<button class="link" data-act="authMode" data-m="reset" style="align-self:flex-start">Forgot password?</button>'}
  </main>`;
}
function renderRecovery() {
  const a = S.ui.auth;
  return `<main class="screen" style="padding-top:calc(40px + env(safe-area-inset-top, 0px));max-width:420px;margin:0 auto">
    ${LOGO}<h1>Set a new password</h1>
    <form class="stack" data-form="recovery" novalidate>
      <label class="f">New password<input class="input" id="au-new" data-in="auF" data-f="password" type="password" autocomplete="new-password" value=""></label>
      ${a.msg ? `<p class="note" style="color:var(--bad);font-weight:700">${esc(a.msg)}</p>` : ''}
      <button class="btn block" type="submit" ${a.busy ? 'disabled' : ''}>Save password</button>
    </form></main>`;
}
function renderHousehold() {
  const h = S.ui.hh;
  return `<main class="screen" style="padding-top:calc(28px + env(safe-area-inset-top, 0px))">
    <div><div class="eyebrow">Welcome to Mizan</div><h1>Your household</h1></div>
    <p class="note" style="margin:0">Foods and recipes are shared within a household. Your log, weight and targets stay private to you.</p>
    <label class="f">Your first name<input class="input" id="hh-display" data-in="hhF" data-f="display" autocomplete="given-name" value="${esc(h.display)}"></label>
    <section class="card stack"><h2>Start a new household</h2><p class="note" style="margin:0">You'll get an invite code to share.</p>
      <label class="f">Household name<input class="input" id="hh-name" data-in="hhF" data-f="name" placeholder="Our home" value="${esc(h.name)}"></label>
      <button class="btn block" data-act="hhCreate" ${h.busy ? 'disabled' : ''}>Create household</button></section>
    <section class="card stack"><h2>Join with an invite code</h2><p class="note" style="margin:0">Find the code in Settings on the other person's phone.</p>
      <label class="f">Invite code<input class="input" id="hh-code" data-in="hhF" data-f="code" autocapitalize="characters" autocomplete="off" placeholder="ABC234" value="${esc(h.code)}" style="text-transform:uppercase;letter-spacing:.15em;font-family:var(--num)"></label>
      <button class="btn ghost block" data-act="hhJoin" ${h.busy ? 'disabled' : ''}>Join household</button></section>
    ${h.msg ? `<p class="note" role="status" style="color:var(--bad);font-weight:700">${esc(h.msg)}</p>` : ''}
    <button class="link" data-act="signOut" style="align-self:flex-start">Sign out (${esc(Store.user ? Store.user.email : '')})</button>
  </main>`;
}
function renderBootError() {
  return `<main class="screen" style="padding-top:calc(40px + env(safe-area-inset-top, 0px))">${LOGO}<h1>Can't reach Mizan</h1>
    <p class="note">${esc(S.ui.bootError || 'Check your internet connection and try again.')}</p>
    <button class="btn" data-act="retryBoot">Try again</button></main>`;
}
const authError = (e) => {
  const m = (e && (e.message || e.error_description)) || 'Something went wrong. Try again.';
  if (/invalid login/i.test(m)) return 'Email or password is incorrect.';
  if (/already registered|already been registered/i.test(m)) return 'This email already has an account. Sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first, using the link Mizan sent you.';
  if (/failed to fetch|network/i.test(m)) return 'No connection. Check your internet and try again.';
  return m;
};

// ================================================================= SETUP
const SETUP_STEPS = ['About you', 'Goal', 'Daily activity', 'Training', 'Eating pattern', 'Food notes', 'Pregnancy', 'Your targets'];
function setupDefaults() {
  const p = profile();
  return p ? JSON.parse(JSON.stringify(p)) : { name: (Store.hh && Store.hh.me) || '', sex: '', age: '', height: '', weight: '', goal: 'lose', goalWeight: '', pace: 0.5, activity: 'feet', training: [], trainDays: 3, mealsCount: 2, snacks: true, avoid: '', pregnant: false };
}
function renderSetup() {
  const st = S.ui.setupStep; const d = S.ui.setup || (S.ui.setup = setupDefaults());
  const dots = SETUP_STEPS.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('');
  const choice = (field, val, title, sub) => `<button class="choice" data-act="setPick" data-f="${field}" data-v="${val}" aria-pressed="${String(d[field]) === String(val)}"><span class="grow"><span class="t">${title}</span>${sub ? `<br><span class="small muted">${sub}</span>` : ''}</span></button>`;
  let body = '', valid = true;
  if (st === 0) {
    body = `<p class="note">Mizan uses this to work out your daily targets. It stays private to you.</p>
      ${profile() ? '' : `<label class="card row" style="cursor:pointer"><span class="grow"><b>Used the first version of Mizan?</b><span class="small muted" style="display:block">Restore your backup file instead of starting over.</span></span><span class="pill">Restore</span><input type="file" accept="application/json,.json" data-in="restore" style="display:none"></label>`}
      <label class="f">Name<input class="input" id="s-name" data-in="setF" data-f="name" value="${esc(d.name)}" autocomplete="given-name"></label>
      <div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">Sex (for the calorie formula)</div>
      <div class="seg" role="group"><button data-act="setPick" data-f="sex" data-v="male" aria-pressed="${d.sex === 'male'}">Male</button><button data-act="setPick" data-f="sex" data-v="female" aria-pressed="${d.sex === 'female'}">Female</button></div>
      <div class="grid2"><label class="f">Age<input class="input" id="s-age" data-in="setF" data-f="age" inputmode="numeric" value="${esc(d.age)}"></label>
      <label class="f">Height (cm)<input class="input" id="s-height" data-in="setF" data-f="height" inputmode="decimal" value="${esc(d.height)}"></label></div>
      <label class="f">Current weight (kg)<input class="input" id="s-weight" data-in="setF" data-f="weight" inputmode="decimal" value="${esc(d.weight)}"></label>`;
    valid = d.name && d.sex && num(d.age) >= 14 && num(d.height) > 100 && num(d.weight) > 30;
  } else if (st === 1) {
    const h = num(d.height) / 100;
    body = `${choice('goal', 'lose', 'Lose weight')}${choice('goal', 'maintain', 'Maintain')}${choice('goal', 'gain', 'Gain weight')}
      ${d.goal !== 'maintain' ? `<label class="f">Goal weight (kg)<input class="input" id="s-goalWeight" data-in="setF" data-f="goalWeight" inputmode="decimal" value="${esc(d.goalWeight)}"></label>
      ${num(d.goalWeight) && h ? `<div class="small muted">That's a BMI of ${r1(num(d.goalWeight) / (h * h))}.</div>` : ''}
      <div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">Pace per week</div>
      <div class="seg" role="group">${[0.25, 0.5, 0.75].map((v) => `<button data-act="setPick" data-f="pace" data-v="${v}" aria-pressed="${num(d.pace) === v}">${v} kg</button>`).join('')}</div>
      <p class="note">0.5 kg a week is a steady pace that protects training and muscle. Mizan caps the pace at 1% of body weight per week.</p>` : ''}`;
    valid = d.goal === 'maintain' || num(d.goalWeight) > 30;
  } else if (st === 2) {
    body = `<p class="note">Your usual day, not counting workouts. Workouts are added separately each day.</p>
      ${choice('activity', 'sit', 'Mostly sitting', 'Desk work, driving, little walking')}
      ${choice('activity', 'feet', 'On your feet part of the day', 'Clinic, ward rounds, teaching, errands')}
      ${choice('activity', 'active', 'Very active', 'Physical job or on your feet most of the day')}`;
  } else if (st === 3) {
    body = `<p class="note">Pick what you usually do. This is for your day tags; calories come from each logged workout.</p>
      <div class="chips" style="flex-wrap:wrap">${WORKOUTS.map((w) => `<button class="chip" data-act="setTrain" data-v="${w.id}" aria-pressed="${d.training.includes(w.id)}">${w.id}</button>`).join('')}</div>
      <label class="f">Training days per week<input class="input" id="s-trainDays" data-in="setF" data-f="trainDays" inputmode="numeric" value="${esc(d.trainDays)}"></label>`;
  } else if (st === 4) {
    body = `<div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">Main meals a day</div>
      <div class="seg" role="group">${[2, 3].map((v) => `<button data-act="setPick" data-f="mealsCount" data-v="${v}" aria-pressed="${num(d.mealsCount) === v}">${v} meals</button>`).join('')}</div>
      <p class="note">${num(d.mealsCount) === 3 ? 'Your day will have Breakfast, Lunch, Dinner and Snacks.' : 'Your day will have Breakfast, Dinner and Snacks.'}</p>`;
  } else if (st === 5) {
    body = `<label class="f">Foods you avoid or don't tolerate (optional)<textarea class="input" id="s-avoid" data-in="setF" data-f="avoid" rows="3" placeholder="For example: regular milk, labneh">${esc(d.avoid)}</textarea></label>
      <p class="note">This is kept as a note on your profile.</p>`;
  } else if (st === 6) {
    body = `<p class="note">If you're pregnant or breastfeeding, Mizan won't set a calorie deficit and will track only.</p>
      ${choice('pregnant', 'false', 'No')}${choice('pregnant', 'true', 'Yes, pregnant or breastfeeding')}`;
  } else {
    const p = normalizeProfile(d); const t = d.__t || (d.__t = calcTargets(p));
    body = `<section class="card ring-card"><div class="small muted">Base calories</div><div class="num" style="font-size:44px;line-height:1">${fmt(t.kcal)}</div><div class="small muted">kcal a day before workouts</div>
      <div class="trio"><div><div class="num" style="color:var(--p)">${t.protein} g</div><div class="small muted">Protein</div></div><div><div class="num" style="color:var(--c)">${t.carbs} g</div><div class="small muted">Carbs</div></div><div><div class="num" style="color:var(--f)">${t.fat} g</div><div class="small muted">Fat</div></div></div></section>
      <p class="note">Your estimated maintenance is about ${fmt(t.maint)} kcal a day. ${p.pregnant ? 'No deficit is set.' : p.goal === 'lose' ? `A ${p.pace} kg a week loss takes about ${fmt(p.pace * 1100)} kcal a day off that.` : ''} ${t.kcal === t.floor ? 'This is the minimum Mizan allows.' : ''} Workouts you log add to this each day. The weekly check-in fine-tunes it after 2 weeks.</p>
      <div class="grid2"><label class="f">Base calories<input class="input" id="s-kcal" data-in="setT" data-f="kcal" inputmode="numeric" value="${t.kcal}"></label>
      <label class="f">Protein (g)<input class="input" id="s-protein" data-in="setT" data-f="protein" inputmode="numeric" value="${t.protein}"></label></div>`;
  }
  const last = st === SETUP_STEPS.length - 1;
  return `<main class="screen" style="padding-bottom:40px">
    <div class="progress-dots" aria-hidden="true">${dots}</div>
    <div><div class="eyebrow">${profile() ? 'Update your profile' : 'Welcome to Mizan'} · ${st + 1} of ${SETUP_STEPS.length}</div><h1>${SETUP_STEPS[st]}</h1></div>
    <div class="stack" id="setupBody">${body}</div>
    <div class="row" style="margin-top:8px">${st > 0 ? '<button class="btn ghost" data-act="setBack">Back</button>' : profile() ? '<button class="btn ghost" data-act="setCancel">Cancel</button>' : ''}
      <button class="btn grow" data-act="${last ? 'setFinish' : 'setNext'}" id="setNextBtn" ${valid ? '' : 'disabled'}>${last ? 'Start using Mizan' : 'Continue'}</button></div>
  </main>`;
}
function normalizeProfile(d) {
  return { name: (d.name || '').trim(), sex: d.sex, age: num(d.age), height: num(d.height), weight: num(d.weight), goal: d.goal, goalWeight: d.goal === 'maintain' ? null : num(d.goalWeight),
    pace: d.goal === 'maintain' ? 0 : num(d.pace) || 0.5, activity: d.activity, training: d.training || [], trainDays: num(d.trainDays), mealsCount: num(d.mealsCount) || 2, snacks: true, avoid: d.avoid || '', pregnant: d.pregnant === true || d.pregnant === 'true' };
}
function setupValidity() {
  const d = S.ui.setup; const st = S.ui.setupStep; const btn = $('#setNextBtn'); if (!btn) return;
  let ok = true;
  if (st === 0) ok = d.name && d.sex && num(d.age) >= 14 && num(d.height) > 100 && num(d.weight) > 30;
  if (st === 1) ok = d.goal === 'maintain' || num(d.goalWeight) > 30;
  btn.disabled = !ok;
}

// ================================================================= SHEETS
function pushSheet(s) { S.ui.sheets.push(s); renderSheet(true); }
function popSheet() { S.ui.sheets.pop(); render(); }
function closeSheets() { S.ui.sheets = []; render(); }
function topSheet() { return S.ui.sheets[S.ui.sheets.length - 1]; }
let sheetRendering = false;
function renderSheet(scrollTop) {
  if (sheetRendering) return;
  sheetRendering = true;
  try { renderSheetInner(scrollTop); } finally { sheetRendering = false; }
}
function renderSheetInner(scrollTop) {
  const el = $('#sheet'); const s = topSheet();
  if (!s) { Scanner.stop(); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; return; }
  const html = { log: sheetLog, amount: sheetAmount, quick: sheetQuick, foodEdit: sheetFoodEdit, recipe: sheetRecipe, pickIng: sheetPickIng, workout: sheetWorkout, weight: sheetWeight, entry: sheetAmount, saveMeal: sheetSaveMeal, copyMeal: sheetCopyMeal, targets: sheetTargets, copyFrom: sheetCopyFrom, scan: sheetScan, linkCode: sheetLinkCode }[s.type](s);
  el.innerHTML = `<div class="in">${html}</div>`; el.hidden = false; document.body.style.overflow = 'hidden';
  if (scrollTop) el.scrollTop = 0;
  if (s.type === 'scan') Scanner.attach(); else Scanner.stop();
}
const sheetTop = (title, sub, closeAll) => `<div class="bar-top"><button class="icon-btn" data-act="${S.ui.sheets.length > 1 && !closeAll ? 'back' : 'close'}" aria-label="${S.ui.sheets.length > 1 && !closeAll ? 'Back' : 'Close'}">${icon(S.ui.sheets.length > 1 && !closeAll ? 'back' : 'x', 20)}</button>
  <div class="grow">${sub ? `<div class="eyebrow">${esc(sub)}</div>` : ''}<h1>${esc(title)}</h1></div></div>`;

// ---- log sheet
function sheetLog(s) {
  const meals = mealsList();
  return `${sheetTop('Log food', 'Logging to ' + s.meal)}
    <div class="seg" role="group">${meals.map((m) => `<button data-act="logMeal" data-m="${m}" aria-pressed="${s.meal === m}">${m}</button>`).join('')}</div>
    <label class="search">${icon('search', 20)}<input id="logSearch" data-in="logSearch" type="search" placeholder="Search foods &amp; recipes" value="${esc(s.q || '')}" aria-label="Search foods and recipes"></label>
    <div class="tiles">
      <button class="card tile" data-act="scanOpen"><span style="color:var(--acc)">${icon('scan', 20)}</span>Scan</button>
      <button class="card tile" data-act="quickAdd"><span style="color:var(--acc)">${icon('bolt', 20)}</span>Quick add</button>
      <button class="card tile" data-act="newFood"><span style="color:var(--acc)">${icon('doc', 20)}</span>New food</button>
      <button class="card tile" data-act="copyMeal"><span style="color:var(--acc)">${icon('copy', 20)}</span>Copy meal</button></div>
    <div id="logResults">${logResults(s)}</div>`;
}
function logResults(s) {
  const q = (s.q || '').trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/);
    const match = (n) => { const l = n.toLowerCase(); return words.every((w) => l.includes(w)); };
    const rs = Object.values(S.recipes).filter((r) => match(r.name)).map((r) => recipeRow(r));
    const code = /^\d{8,14}$/.test(q) ? normCode(q) : '';
    const fs = allFoods().filter((f) => match(f.name) || (code && f.barcode && normCode(f.barcode) === code)).sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q) || a.name.localeCompare(b.name)).slice(0, 40).map((f) => pickRow(f));
    const rows = rs.concat(fs);
    return `<div class="list">${rows.length ? rows.join('') : `<div class="empty">Nothing matches “${esc(s.q)}”. Add it with <button class="link" data-act="newFood" data-name="${esc(s.q)}">New food</button>.</div>`}</div>`;
  }
  const tab = s.tab || 'recent';
  let rows = [];
  if (tab === 'recent') rows = S.core.recent.map(refRow).filter(Boolean);
  if (tab === 'favs') rows = S.core.favs.map(refRow).filter(Boolean);
  if (tab === 'saved') rows = Object.values(S.core.saved).map((m) => `<button class="item" data-act="logSaved" data-id="${m.id}"><span class="grow"><span class="name">${esc(m.name)}<span class="badge">Meal</span></span><span class="sub">${m.items.length} items · ${fmt(m.items.reduce((a, e) => a + e.k, 0))} kcal</span></span><span class="add-btn">+</span></button>`);
  const empty = { recent: 'Foods you log will show up here.', favs: 'Star a food when logging it to keep it here.', saved: 'Save a whole meal from the Today screen to log it in one tap.' }[tab];
  return `<div class="tabs" role="group" style="margin-bottom:10px">${[['recent', 'Recent'], ['favs', 'Favourites'], ['saved', 'Saved meals']].map(([t, l]) => `<button data-act="logTab" data-t="${t}" aria-pressed="${tab === t}">${l}</button>`).join('')}</div>
    <div class="list">${rows.length ? rows.join('') : `<div class="empty">${empty}</div>`}</div>`;
}
function refRow(ref) {
  if (ref.startsWith('r:')) { const r = S.recipes[ref.slice(2)]; return r ? recipeRow(r) : null; }
  const f = food(ref.slice(2)); return f && !f.deleted ? pickRow(f) : null;
}
function pickRow(f) {
  const v = f.raw || { k: 0 }; const u = f.units[0];
  const uv = u && unitLabelState(u.l) === 'cooked' && f.cooked ? f.cooked : v;
  const sub = f.per === 'serving' ? `${fmt(v.k)} kcal per serving` : u ? `${u.l} · ${fmt(uv.k * u.g / 100)} kcal` : `100 g${f.rawLabel ? ' ' + f.rawLabel.toLowerCase() : ''} · ${fmt(v.k)} kcal`;
  return `<button class="item" data-act="pickFood" data-id="${esc(f.id)}"><span class="grow"><span class="name">${esc(f.name)}</span><span class="sub">${esc(sub)}${f.cooked ? ' · raw or cooked' : ''}</span></span><span class="add-btn">+</span></button>`;
}
function recipeRow(r) {
  const t = recipeTotals(r).per;
  return `<button class="item" data-act="pickRecipe" data-id="${r.id}"><span class="grow"><span class="name">${esc(r.name)}<span class="badge">Recipe</span></span><span class="sub">1 serving · ${fmt(t.k)} kcal · P ${r0(t.p)} g</span></span><span class="add-btn">+</span></button>`;
}

// ---- amount sheet (new entry or editing an entry)
function sheetAmount(s) {
  const isRecipe = s.kind === 'recipe';
  const item = isRecipe ? S.recipes[s.id] : food(s.id);
  if (!item) return sheetTop('Not found') + '<p class="note">This item was deleted.</p>';
  const m = amountMacros(s);
  const favKey = (isRecipe ? 'r:' : 'f:') + s.id; const fav = S.core.favs.includes(favKey);
  let controls = '';
  if (isRecipe) {
    controls = `<label class="f">Servings<div class="qty"><button class="icon-btn" data-act="qtyStep" data-d="-0.5" aria-label="Less">−</button><input class="input" id="qtyIn" data-in="qty" inputmode="decimal" value="${s.qty}"><button class="icon-btn" data-act="qtyStep" data-d="0.5" aria-label="More">+</button></div></label>
      <p class="note">This recipe makes ${r1(item.servings)} servings.</p>`;
  } else {
    const f = item;
    const stateSeg = f.cooked && f.per !== 'serving' ? `<div class="seg" role="group" aria-label="Weighed as"><button data-act="amtState" data-v="raw" aria-pressed="${s.state !== 'cooked'}">${f.rawLabel || 'Raw'}</button><button data-act="amtState" data-v="cooked" aria-pressed="${s.state === 'cooked'}">Cooked</button></div>` : '';
    const units = f.per === 'serving' ? `<option value="-1">serving</option>` : `<option value="-1" ${s.unit === -1 ? 'selected' : ''}>grams</option>` + f.units.map((u, i) => `<option value="${i}" ${s.unit === i ? 'selected' : ''}>${esc(u.l)} (${r1(u.g)} g)</option>`).join('');
    const step = s.unit === -1 && f.per !== 'serving' ? 10 : 0.5;
    controls = `${stateSeg}<div class="grid2"><label class="f">Amount<div class="qty"><button class="icon-btn" data-act="qtyStep" data-d="-${step}" aria-label="Less">−</button><input class="input" id="qtyIn" data-in="qty" inputmode="decimal" value="${s.qty}"><button class="icon-btn" data-act="qtyStep" data-d="${step}" aria-label="More">+</button></div></label>
      <label class="f">Unit<select class="input" id="unitSel" data-in="unit">${units}</select></label></div>
      ${s.state === 'cooked' ? '<p class="note">Cooked weight. Restaurant food often has extra oil, so treat this as an estimate.</p>' : ''}`;
  }
  const editing = s.type === 'entry';
  return `${sheetTop(item.name, editing ? 'Edit · ' + s.meal : 'Add to ' + s.meal)}
    <div class="row"><span class="small muted grow">${isRecipe ? 'Recipe' : esc(item.group || '')}${!isRecipe && item.per !== 'serving' ? ' · per 100 g ' + ((s.state === 'cooked' ? 'cooked' : (item.rawLabel || '').toLowerCase())) + ': ' + fmt(valsFor(item, s.state).k) + ' kcal' : ''}</span>
      <button class="icon-btn" data-act="toggleFav" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}" style="color:${fav ? 'var(--c)' : 'var(--muted)'}">${icon('star', 20, fav ? 'fill' : '')}</button></div>
    ${!isRecipe && item.typical && !S.foods[item.id] ? '<p class="note" style="margin:0">Typical values. Brands and recipes vary, so check the label and edit this food if it differs.</p>' : ''}
    ${controls}
    <div class="item" style="border:0;padding:4px 0"><span class="grow"><b>Eating out</b><span class="sub wrap">Counts under “Eating out” in Progress</span></span><button class="toggle" role="switch" aria-checked="${!!s.out}" aria-label="Eating out" data-act="amtOut"></button></div>
    <section class="card ring-card" id="amtMacros" style="padding:16px">${macroBlock(m)}</section>
    <div class="stack">${editing ? `<button class="btn block" data-act="amtSave">Save changes</button><button class="btn danger block" data-act="entryDelete">Remove from ${esc(s.meal)}</button>` : `<button class="btn block" data-act="amtSave">Add to ${esc(s.meal)}</button>`}
      ${!isRecipe ? `<button class="link" data-act="openFood" data-id="${esc(s.id)}">View or edit this food</button>` : `<button class="link" data-act="openRecipe" data-id="${esc(s.id)}">View or edit this recipe</button>`}</div>`;
}
function macroBlock(m) {
  return `<div class="num" style="font-size:40px;line-height:1">${fmt(m.k)}</div><div class="small muted">kcal</div>
    <div class="trio"><div><div class="num" style="color:var(--p)">${r1(m.p)} g</div><div class="small muted">Protein</div></div><div><div class="num" style="color:var(--c)">${r1(m.c)} g</div><div class="small muted">Carbs</div></div><div><div class="num" style="color:var(--f)">${r1(m.f)} g</div><div class="small muted">Fat</div></div></div>`;
}
function amountMacros(s) {
  if (s.kind === 'recipe') { const r = S.recipes[s.id]; if (!r) return { k: 0, p: 0, c: 0, f: 0 }; const per = recipeTotals(r).per; const q = num(s.qty); return { k: per.k * q, p: per.p * q, c: per.c * q, f: per.f * q }; }
  const f = food(s.id); if (!f) return { k: 0, p: 0, c: 0, f: 0 };
  return macrosOf(f, s.state, num(s.qty), f.per === 'serving' ? -1 : s.unit);
}
function entryDetail(s) {
  if (s.kind === 'recipe') return `${r1(num(s.qty))} serving${num(s.qty) === 1 ? '' : 's'}`;
  const f = food(s.id);
  if (f.per === 'serving') return `${r1(num(s.qty))} serving${num(s.qty) === 1 ? '' : 's'}`;
  const st = s.state === 'cooked' ? 'cooked' : (f.rawLabel || '').toLowerCase();
  if (s.unit >= 0) { const u = f.units[s.unit]; return `${r1(num(s.qty))} × ${u.l} · ${r0(u.g * num(s.qty))} g${st && !unitLabelState(u.l) ? ' ' + st : ''}`; }
  return `${r0(num(s.qty))} g${st ? ' ' + st : ''}`;
}

// ---- copy from a household member's log
function sheetCopyFrom(s) {
  const dd = partnerDay(s.uid, s.day) || { entries: [] };
  const items = (dd.entries || []).filter((e) => s.ids.includes(e.id));
  const meals = mealsList(); const days = [[today(), 'Today'], [addDays(today(), -1), 'Yesterday']];
  if (!days.some(([k]) => k === s.day)) days.push([s.day, longDate(s.day).split(',')[0] + ' ' + parseKey(s.day).getDate()]);
  const total = items.reduce((a, e) => a + e.k, 0);
  return `${sheetTop('Copy to my log', 'From ' + (s.name || 'household'))}
    <div class="list">${items.map((e) => `<div class="item"><span class="grow"><span class="name">${esc(e.name)}</span><span class="sub">${esc(e.detail)}</span></span><span class="num">${fmt(e.k)}</span></div>`).join('')}</div>
    <div class="small muted" style="font-weight:700">Add to</div>
    <div class="seg" role="group">${meals.map((m) => `<button data-act="cfMeal" data-m="${m}" aria-pressed="${s.meal === m}">${m}</button>`).join('')}</div>
    <div class="chips" role="group">${days.map(([k, l]) => `<button class="chip" data-act="cfDay" data-k="${k}" aria-pressed="${s.to === k}">${esc(l)}</button>`).join('')}</div>
    <p class="note" style="margin:0">Copies the same amounts. You can change an amount afterwards by tapping it in your log.</p>
    <button class="btn block" data-act="cfSave" ${items.length ? '' : 'disabled'}>Copy ${items.length} item${items.length === 1 ? '' : 's'} · ${fmt(total)} kcal</button>`;
}

// ---- quick add
function sheetQuick(s) {
  return `${sheetTop('Quick add', 'Add to ' + s.meal)}
    <p class="note">For meals out when you only know the rough numbers.</p>
    <label class="f">Name (optional)<input class="input" id="qa-name" data-in="qaF" data-f="name" value="${esc(s.name || '')}" placeholder="Chicken shawarma plate"></label>
    <div class="grid2"><label class="f">Calories<input class="input" id="qa-k" data-in="qaF" data-f="k" inputmode="numeric" value="${esc(s.k || '')}"></label>
    <label class="f">Protein (g)<input class="input" id="qa-p" data-in="qaF" data-f="p" inputmode="decimal" value="${esc(s.p || '')}"></label>
    <label class="f">Carbs (g, optional)<input class="input" id="qa-c" data-in="qaF" data-f="c" inputmode="decimal" value="${esc(s.c || '')}"></label>
    <label class="f">Fat (g, optional)<input class="input" id="qa-f" data-in="qaF" data-f="f" inputmode="decimal" value="${esc(s.f || '')}"></label></div>
    <div class="item" style="border:0;padding:4px 0"><span class="grow"><b>Eating out</b></span><button class="toggle" role="switch" aria-checked="${s.out !== false}" aria-label="Eating out" data-act="qaOut"></button></div>
    <button class="btn block" data-act="qaSave">Add to ${esc(s.meal)}</button>`;
}

// ---- food editor (new or existing)
function sheetFoodEdit(s) {
  const d = s.d; const isNew = !s.id; const starter = !isNew && STARTER[s.id];
  const vfields = (pre, vals) => `<div class="grid4">${[['k', 'kcal'], ['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']].map(([k, l]) => `<label class="f">${l}<input class="input" id="fe-${pre}${k}" data-in="feV" data-set="${pre}" data-k="${k}" inputmode="decimal" value="${vals && vals[k] !== '' && vals[k] != null ? esc(vals[k]) : ''}"></label>`).join('')}</div>`;
  return `${sheetTop(isNew ? 'New food' : 'Edit food', isNew ? 'Saved to your library' : (starter ? 'Starter food' : 'Your food'))}
    <label class="f">Name<input class="input" id="fe-name" data-in="feF" data-f="name" value="${esc(d.name)}" placeholder="Kinder Bueno"></label>
    <label class="f">Group<select class="input" id="fe-group" data-in="feF" data-f="group">${GROUPS.map((g) => `<option ${d.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    ${isNew && d.barcode ? `<button class="btn ghost block" data-act="linkOpen">Already in the library? Link this barcode to it</button>` : ''}
    <div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">The label gives values</div>
    <div class="seg" role="group"><button data-act="feBasis" data-v="100" aria-pressed="${d.basis === '100'}">Per 100 g</button><button data-act="feBasis" data-v="serving" aria-pressed="${d.basis === 'serving'}">Per serving</button></div>
    ${d.basis === 'serving' ? `<div class="grid2"><label class="f">Serving name<input class="input" id="fe-sname" data-in="feF" data-f="sName" value="${esc(d.sName)}" placeholder="1 bar"></label>
      <label class="f">Serving weight (g, if known)<input class="input" id="fe-sg" data-in="feF" data-f="sG" inputmode="decimal" value="${esc(d.sG)}"></label></div>
      <p class="note">With the serving weight, Mizan converts to per 100 g so you can log any number of grams.</p>` : ''}
    ${d.basis === '100' || num(d.sG) > 0 ? `<div class="item" style="border:0;padding:4px 0"><span class="grow"><b>${d.basis === 'serving' ? 'Values are for' : 'Weighed'}</b></span></div>` : ''}
    ${d.basis === '100' ? `<div class="seg" role="group"><button data-act="feRawLabel" data-v="" aria-pressed="${!d.rawLabel}">As sold</button><button data-act="feRawLabel" data-v="Raw" aria-pressed="${d.rawLabel === 'Raw'}">Raw</button><button data-act="feRawLabel" data-v="Dry" aria-pressed="${d.rawLabel === 'Dry'}">Dry</button></div>` : ''}
    ${vfields('raw', d.raw)}
    ${d.basis === '100' && d.rawLabel ? `<div class="item" style="border:0;padding:4px 0"><span class="grow"><b>Also has cooked values</b><span class="sub wrap">Lets you log it by cooked weight too</span></span><button class="toggle" role="switch" aria-checked="${!!d.hasCooked}" aria-label="Has cooked values" data-act="feCooked"></button></div>
      ${d.hasCooked ? '<div class="small muted">Cooked, per 100 g</div>' + vfields('cooked', d.cooked) : ''}` : ''}
    ${d.basis === '100' ? `<div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">Handy units (optional)</div>
      ${d.units.map((u, i) => `<div class="row"><input class="input grow" id="fe-ul${i}" data-in="feU" data-i="${i}" data-k="l" value="${esc(u.l)}" placeholder="1 bar" aria-label="Unit name"><input class="input" style="width:96px" id="fe-ug${i}" data-in="feU" data-i="${i}" data-k="g" inputmode="decimal" value="${esc(u.g)}" placeholder="grams" aria-label="Grams"><button class="icon-btn" data-act="feUnitDel" data-i="${i}" aria-label="Remove unit">${icon('x', 18)}</button></div>`).join('')}
      <button class="link" data-act="feUnitAdd" style="align-self:flex-start">+ Add a unit</button>` : ''}
    <div class="f" style="font-size:13px;font-weight:700;color:var(--muted)">Barcode (optional)</div>
    <div class="row"><input class="input grow" id="fe-code" data-in="feF" data-f="barcode" inputmode="numeric" autocomplete="off" value="${esc(d.barcode || '')}" placeholder="Scan or type it" aria-label="Barcode"><button class="icon-btn" data-act="scanAttach" aria-label="Scan barcode">${icon('scan', 20)}</button></div>
    <button class="btn block" data-act="feSave">${s.thenLog ? 'Save and log it' : 'Save food'}</button>
    ${!isNew ? `<button class="btn ghost block" data-act="feLog">Log this food</button>` : ''}
    ${!isNew ? `<button class="btn danger block" data-act="feDelete">${starter && S.foods[s.id] && !S.foods[s.id].deleted ? 'Reset to starter values' : 'Delete food'}</button>` : ''}`;
}
function foodToDraft(f) {
  const str = (v) => v ? { k: v.k, p: v.p, c: v.c, f: v.f } : { k: '', p: '', c: '', f: '' };
  return { name: f ? f.name : '', group: f ? f.group : 'Other', basis: f && f.per === 'serving' ? 'serving' : '100', sName: f && f.per === 'serving' ? (f.units[0] || {}).l || '1 serving' : '1 serving', sG: '',
    rawLabel: f ? f.rawLabel || '' : '', raw: str(f && f.raw), hasCooked: !!(f && f.cooked), cooked: str(f && f.cooked), units: f && f.per !== 'serving' ? f.units.map((u) => ({ l: u.l, g: u.g })) : [], barcode: f && f.barcode || '' };
}

// ---- recipe editor
function sheetRecipe(s) {
  const d = s.d; const tot = recipeTotals({ items: d.items, servings: num(d.servings) || 1 });
  const rows = d.items.map((it, i) => {
    const f = food(it.foodId); if (!f) return '';
    const m = macrosOf(f, 'raw', num(it.g), -1);
    return `<div class="item"><span class="grow"><span class="name">${esc(f.name)}</span><span class="sub">${fmt(m.k)} kcal · P ${r0(m.p)} g</span></span>
      <input class="input" style="width:90px;text-align:right" id="ri-${i}" data-in="riG" data-i="${i}" inputmode="decimal" value="${esc(it.g)}" aria-label="Grams of ${esc(f.name)}"><span class="small muted">g ${esc((f.rawLabel || '').toLowerCase())}</span>
      <button class="icon-btn" data-act="riDel" data-i="${i}" aria-label="Remove ${esc(f.name)}" style="background:none">${icon('x', 18)}</button></div>`;
  }).join('');
  return `${sheetTop(s.id ? 'Edit recipe' : 'New recipe', 'Shared library')}
    <label class="f">Recipe name<input class="input" id="re-name" data-in="reF" data-f="name" value="${esc(d.name)}" placeholder="Chicken pasta"></label>
    <label class="f">Makes how many servings?<input class="input" id="re-serv" data-in="reF" data-f="servings" inputmode="decimal" value="${esc(d.servings)}"></label>
    <div class="list"><div class="meal-head"><div><h2>Ingredients</h2><span class="small muted">Raw or dry weight, as they go in the pot</span></div><button class="add-btn" data-act="riAdd" aria-label="Add ingredient">+</button></div>
      ${rows || '<div class="empty">Add the ingredients and their weights.</div>'}</div>
    <section class="card" id="reTotals"><div class="row"><div class="grow"><div class="small muted">Per serving</div><div class="num" style="font-size:26px">${fmt(tot.per.k)} kcal</div></div>
      <div style="text-align:right" class="small muted">Whole dish<br><b class="num" style="color:var(--fg)">${fmt(tot.total.k)} kcal</b></div></div>
      <div class="row" style="gap:6px;margin-top:8px"><span class="mchip" style="color:var(--p)">P ${r0(tot.per.p)} g</span><span class="mchip" style="color:var(--c)">C ${r0(tot.per.c)} g</span><span class="mchip" style="color:var(--f)">F ${r0(tot.per.f)} g</span></div></section>
    <button class="btn block" data-act="reSave" ${d.name && d.items.length ? '' : 'disabled'} id="reSaveBtn">Save recipe</button>
    ${s.id ? `<button class="btn ghost block" data-act="reLog">Log a serving</button><button class="btn danger block" data-act="reDelete">Delete recipe</button>` : ''}`;
}
function sheetPickIng(s) {
  return `${sheetTop('Add ingredient', 'Recipe')}
    <label class="search">${icon('search', 20)}<input id="ingSearch" data-in="ingSearch" type="search" placeholder="Search ingredients" value="${esc(s.q || '')}" aria-label="Search ingredients"></label>
    <div id="ingResults">${ingResults(s)}</div>`;
}
function ingResults(s) {
  const q = (s.q || '').trim().toLowerCase();
  const fs = allFoods().filter((f) => f.per !== 'serving' && (!q || f.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
  return `<div class="list">${fs.length ? fs.map((f) => `<button class="item" data-act="ingPick" data-id="${esc(f.id)}"><span class="grow"><span class="name">${esc(f.name)}</span><span class="sub">${fmt(f.raw.k)} kcal per 100 g${f.rawLabel ? ' ' + f.rawLabel.toLowerCase() : ''}</span></span><span class="add-btn">+</span></button>`).join('') : `<div class="empty">No match. <button class="link" data-act="newFood" data-name="${esc(s.q || '')}">Create it as a new food</button></div>`}</div>`;
}

// ---- workout
function sheetWorkout(s) {
  const d = s.d; const credit = workoutCredit(d.type, num(d.min), num(d.km), num(d.watch));
  return `${sheetTop(s.id ? 'Edit workout' : 'Add workout', longDate(S.ui.day))}
    ${s.src === 'strava' ? `<p class="note" style="margin:0">Synced from Strava${s.name ? ': “' + esc(s.name) + '”' : ''}. You can change the type, for example to Lagree.</p>` : ''}
    <div class="chips" style="flex-wrap:wrap">${WORKOUTS.map((w) => `<button class="chip" data-act="woType" data-v="${w.id}" aria-pressed="${d.type === w.id}">${w.id}</button>`).join('')}</div>
    <div class="grid2"><label class="f">Duration (min)<input class="input" id="wo-min" data-in="woF" data-f="min" inputmode="numeric" value="${esc(d.min)}"></label>
    ${d.type === 'Run' || d.type === 'Walk' || d.type === 'Cycling' ? `<label class="f">Distance (km)<input class="input" id="wo-km" data-in="woF" data-f="km" inputmode="decimal" value="${esc(d.km)}"></label>` : '<span></span>'}</div>
    <label class="f">Calories from your watch (optional)<input class="input" id="wo-watch" data-in="woF" data-f="watch" inputmode="numeric" value="${esc(d.watch)}" placeholder="From Garmin, Strava or Fitbit"></label>
    <section class="card" id="woCredit"><div class="small muted">Added to today's allowance</div><div class="num" style="font-size:30px;color:var(--acc)">+${fmt(credit)} kcal</div>
      <div class="note">${num(d.watch) > 0 ? 'About 78% of the watch figure, because your resting burn is already in your base target.' : d.type === 'Run' && num(d.km) > 0 ? 'Estimated from distance and your weight, with resting burn taken off.' : 'Estimated from the workout type, duration and your weight, with resting burn taken off.'}</div></section>
    <button class="btn block" data-act="woSave" ${credit > 0 ? '' : 'disabled'} id="woSaveBtn">${s.id ? 'Save changes' : 'Add workout'}</button>
    ${s.id ? '<button class="btn danger block" data-act="woDelete">Delete workout</button>' : ''}`;
}

// ---- weight
function sheetWeight(s) {
  const k = s.day; const cur = S.core.weights[k];
  return `${sheetTop('Weight', longDate(k))}
    <p class="note">Weigh in the morning, after the bathroom and before eating, for the most consistent trend.</p>
    <label class="f">Weight (kg)<input class="input" id="wt-in" data-in="wtF" inputmode="decimal" value="${esc(s.v != null ? s.v : cur != null ? cur : '')}" style="font-size:24px;font-family:var(--num)"></label>
    <button class="btn block" data-act="wtSave">Save weight</button>
    ${cur != null ? '<button class="btn danger block" data-act="wtDelete">Remove this weigh-in</button>' : ''}`;
}

// ---- save meal
function sheetSaveMeal(s) {
  const es = dayData(S.ui.day).entries.filter((e) => e.meal === s.meal);
  return `${sheetTop('Save meal', s.meal)}
    <p class="note">Saves these ${es.length} items together so you can log them in one tap from Saved meals.</p>
    <div class="list">${es.map((e) => `<div class="item"><span class="grow"><span class="name">${esc(e.name)}</span><span class="sub">${esc(e.detail)}</span></span><span class="num">${fmt(e.k)}</span></div>`).join('')}</div>
    <label class="f">Name<input class="input" id="sm-name" data-in="smF" value="${esc(s.name || '')}" placeholder="My usual breakfast"></label>
    <button class="btn block" data-act="smSave">Save meal</button>`;
}
function sheetCopyMeal(s) {
  const opts = []; for (let i = 1; i <= 7; i++) { const k = addDays(S.ui.day, -i); mealsList().forEach((m) => { const es = dayData(k).entries.filter((e) => e.meal === m); if (es.length) opts.push({ k, m, es }); }); }
  return `${sheetTop('Copy a meal', 'Into ' + s.meal)}
    <div class="list">${opts.length ? opts.map((o, i) => `<button class="item" data-act="copyPick" data-i="${i}"><span class="grow"><span class="name">${esc(o.m)} · ${esc(longDate(o.k))}</span><span class="sub">${esc(o.es.map((e) => e.name).join(', '))}</span></span><span class="num">${fmt(o.es.reduce((a, e) => a + e.k, 0))}</span></button>`).join('') : '<div class="empty">No meals logged in the past week.</div>'}</div>`;
}
function copyOptions() { const opts = []; for (let i = 1; i <= 7; i++) { const k = addDays(S.ui.day, -i); mealsList().forEach((m) => { const es = dayData(k).entries.filter((e) => e.meal === m); if (es.length) opts.push({ k, m, es }); }); } return opts; }

// ---- targets
function sheetTargets(s) {
  const t = S.core.targets;
  return `${sheetTop('Targets', 'Settings')}
    <p class="note">Mizan's estimate from your profile is ${fmt(t.calc || t.kcal)} kcal. You can set your own; carbs and fat are worked out from the rest.</p>
    <div class="grid2"><label class="f">Base calories<input class="input" id="tg-k" data-in="tgF" data-f="kcal" inputmode="numeric" value="${esc(s.kcal)}"></label>
    <label class="f">Protein (g)<input class="input" id="tg-p" data-in="tgF" data-f="protein" inputmode="numeric" value="${esc(s.protein)}"></label></div>
    <button class="btn block" data-act="tgSave">Save targets</button>
    <button class="btn ghost block" data-act="tgReset">Use Mizan's estimate</button>`;
}

// ================================================================= ACTIONS
function addRecent(ref) { const r = S.core.recent.filter((x) => x !== ref); r.unshift(ref); S.core.recent = r.slice(0, 25); }
function setTargetsFromMacros(kcal, protein) {
  const t = S.core.targets; t.kcal = Math.round(kcal); t.protein = Math.round(protein);
  t.fat = Math.round(t.kcal * 0.28 / 9); t.carbs = Math.max(0, Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4));
}
// ================================================================= BARCODES
// Barcodes are stored as digits; 12-digit UPC-A becomes the matching 13-digit EAN.
function normCode(c) { let d = String(c || '').replace(/\D/g, ''); if (d.length === 12) d = '0' + d; return d; }
function foodByCode(code) { const c = normCode(code); return c ? allFoods().find((f) => f.barcode && normCode(f.barcode) === c) : null; }
function loadScript(src) {
  return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(el); });
}
const Scanner = {
  stream: null, timer: null, starting: false, detector: null, reader: null, canvas: null, last: '', ready: false,
  status(t) { const el = $('#scanStatus'); if (el) el.textContent = t; },
  async attach() {
    const s = topSheet(); const v = $('#scanVideo');
    if (!v || !s || s.err || s.busy) { this.stop(); return; }
    if (this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); this.status('Hold the barcode inside the frame'); this.loop(); return; }
    if (this.starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.fail('nocam'); return; }
    this.starting = true;
    let st;
    try {
      st = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) { this.starting = false; this.fail(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'nocam'); return; }
    this.starting = false;
    const top = topSheet();
    if (!top || top.type !== 'scan' || top.busy || top.err || document.hidden) { st.getTracks().forEach((t) => t.stop()); return; }
    this.stream = st;
    const v2 = $('#scanVideo'); if (v2) { v2.srcObject = st; v2.play().catch(() => {}); }
    try { await this.prepare(); } catch (e) { this.stop(); this.fail('noreader'); return; }
    this.status('Hold the barcode inside the frame');
    this.loop();
  },
  async prepare() {
    if (this.ready) return;
    if ('BarcodeDetector' in window) {
      try {
        const sup = await window.BarcodeDetector.getSupportedFormats();
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter((f) => sup.includes(f));
        if (want.includes('ean_13')) { this.detector = new window.BarcodeDetector({ formats: want }); this.ready = true; return; }
      } catch (e) { /* fall back to ZXing */ }
    }
    if (!window.ZXing) await loadScript('zxing.min.js');
    const Z = window.ZXing;
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    this.reader = new Z.MultiFormatReader(); this.reader.setHints(hints);
    this.canvas = document.createElement('canvas');
    this.ready = true;
  },
  loop() { clearTimeout(this.timer); this.timer = setTimeout(() => this.tick(), 150); },
  async tick() {
    const s = topSheet(); const v = $('#scanVideo');
    if (!this.stream || !s || s.type !== 'scan' || !v) return;
    if (v.readyState < 2 || !v.videoWidth) { this.loop(); return; }
    let text = '';
    try {
      if (this.detector) {
        const codes = await this.detector.detect(v);
        if (codes && codes.length) text = codes[0].rawValue;
      } else {
        const Z = window.ZXing; const w = v.videoWidth; const h = v.videoHeight;
        const sw = w; const sh = Math.round(h * 0.6); const scale = Math.min(1, 960 / sw);
        const c = this.canvas; c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
        c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, Math.round((h - sh) / 2), sw, sh, 0, 0, c.width, c.height);
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c)));
        try { text = this.reader.decode(bmp).getText(); } catch (e) { text = ''; }
      }
    } catch (e) { text = ''; }
    if (!this.stream) return;
    const code = normCode(text);
    // Accept a code once it has been read twice in a row, to avoid misreads.
    if (code.length >= 8 && code === this.last) { this.last = ''; this.found(code); return; }
    this.last = code;
    this.loop();
  },
  found(code) {
    this.stop();
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* ignore */ }
    handleCode(code);
  },
  fail(kind) { const s = topSheet(); if (s && s.type === 'scan') { s.err = kind; renderSheet(); } },
  stop() {
    clearTimeout(this.timer); this.timer = null; this.last = '';
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    const v = $('#scanVideo'); if (v) v.srcObject = null;
  }
};
document.addEventListener('visibilitychange', () => {
  const s = topSheet();
  if (document.hidden) Scanner.stop(); else if (s && s.type === 'scan') Scanner.attach();
});

function sheetScan(s) {
  const sub = s.mode === 'attach' ? 'Add a barcode to this food' : 'Logging to ' + s.meal;
  const msg = {
    denied: 'Mizan isn’t allowed to use the camera. Allow camera access for this site in your browser’s settings, then tap Try again. You can also type the numbers under the barcode.',
    nocam: 'The camera isn’t available here. Type the numbers under the barcode instead.',
    noreader: 'The scanner couldn’t start. Check your connection and tap Try again, or type the numbers under the barcode.'
  }[s.err];
  let top;
  if (s.busy) top = `<div class="card" style="text-align:center;padding:28px 16px"><div class="eyebrow">Barcode ${esc(s.code || '')}</div><b>Looking it up…</b></div>`;
  else if (msg) top = `<div class="card"><p class="note" style="margin:0 0 10px">${msg}</p><button class="btn ghost block" data-act="scanRetry">Try again</button></div>`;
  else top = `<div class="scanbox"><video id="scanVideo" playsinline muted autoplay></video><div class="scanframe"></div></div>
    <p class="note" id="scanStatus" style="text-align:center;margin:0">Starting the camera…</p>`;
  return `${sheetTop('Scan barcode', sub)}${top}
    <div class="row"><input class="input grow" id="sc-code" data-in="scF" inputmode="numeric" autocomplete="off" value="${esc(s.code || '')}" placeholder="Or type the barcode numbers" aria-label="Barcode number"><button class="btn" data-act="scanManual" ${s.busy ? 'disabled' : ''}>Look up</button></div>
    <p class="note">Products come from <b>Open Food Facts</b>, a free public database. Anything you save keeps its barcode in your shared library, so the next scan is instant for both of you.</p>`;
}

async function offLookup(code) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => { if (ctl) ctl.abort(); }, 9000);
  try {
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '?fields=product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,categories_tags', { signal: ctl ? ctl.signal : undefined });
    if (r.status === 404) return { found: false };
    if (!r.ok) return { found: false, offline: true };
    const j = await r.json();
    if (!j || j.status !== 1 || !j.product) return { found: false };
    return { found: true, p: j.product };
  } catch (e) { return { found: false, offline: true }; } finally { clearTimeout(t); }
}
function guessGroup(tags) {
  const t = (tags || []).join(' ');
  const rules = [[/protein-powder|whey|protein-bar|sports-nutrition|dietary-supplement/, 'Supplements'], [/chocolate|confection|biscuit|cookie|crisps|chips|candies|sweet-snack|salty-snack|wafer|cake/, 'Snacks'],
    [/dair|milk|yogurt|yoghurt|cheese|laban|labneh|cream/, 'Dairy'], [/beverage|drink|water|juice|coffee|tea/, 'Drinks'], [/bread|pasta|rice|cereal|oat|flour|noodle/, 'Carbs'],
    [/meat|chicken|poultry|fish|tuna|seafood|egg/, 'Protein'], [/fruit|dates/, 'Fruits'], [/vegetable/, 'Vegetables'], [/legume|bean|lentil|chickpea|hummus/, 'Legumes'],
    [/oil|butter|sauce|spread|nut|seed|condiment/, 'Fats & extras'], [/snack/, 'Snacks']];
  const hit = rules.find(([re]) => re.test(t));
  return hit ? hit[1] : 'Other';
}
function offToDraft(p, code) {
  const n = p.nutriments || {}; const sq = Number(p.serving_quantity) || 0;
  const g = (k) => { let v = n[k + '_100g']; if ((v == null || v === '') && n[k + '_serving'] != null && sq > 0) v = n[k + '_serving'] * 100 / sq; return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); };
  let kcal = g('energy-kcal'); if (kcal == null) { const kj = g('energy-kj') != null ? g('energy-kj') : g('energy'); if (kj != null) kcal = kj / 4.184; }
  const vals = { k: kcal, p: g('proteins'), c: g('carbohydrates'), f: g('fat') };
  const name = String(p.product_name_en || p.product_name || '').trim(); const brand = String(p.brands || '').split(',')[0].trim();
  const d = foodToDraft(null);
  d.name = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? (brand + ' ' + name).trim() : (name || brand);
  d.group = guessGroup(p.categories_tags); d.basis = '100'; d.barcode = code;
  d.raw = { k: vals.k == null ? '' : Math.round(vals.k), p: vals.p == null ? '' : r1(vals.p), c: vals.c == null ? '' : r1(vals.c), f: vals.f == null ? '' : r1(vals.f) };
  if (sq > 0) { const m = /^\s*(\d+(?:[.,]\d+)?\s*[a-z][a-z\s]*?)\s*\(/i.exec(p.serving_size || ''); d.units = [{ l: m && !/^\d+(?:[.,]\d+)?\s*(g|ml|gr|grams?)$/i.test(m[1].trim()) ? m[1].trim() : '1 serving', g: r1(sq) }]; }
  const missing = Object.values(vals).some((v) => v == null);
  return { d, missing };
}
async function handleCode(raw) {
  const code = normCode(raw); const s = topSheet();
  if (!s || s.type !== 'scan') return;
  if (s.mode === 'attach') {
    S.ui.sheets.pop(); const fe = topSheet(); if (fe && fe.type === 'foodEdit') fe.d.barcode = code;
    renderSheet(); toast('Barcode added'); return;
  }
  const hit = foodByCode(code);
  if (hit) { S.ui.sheets.pop(); openAmount('food', hit.id); return; }
  s.busy = true; s.code = code; s.err = null; renderSheet();
  const res = await offLookup(code);
  if (topSheet() !== s) return; // closed while looking up
  S.ui.sheets.pop();
  let draft; let note;
  if (res.found) {
    const o = offToDraft(res.p, code); draft = o.d;
    note = o.missing ? 'Found on Open Food Facts, but some values are missing. Fill them in from the label, then save.' : 'Found on Open Food Facts. Check the numbers against the label, then save.';
  } else {
    draft = foodToDraft(null); draft.basis = '100'; draft.barcode = code;
    note = res.offline ? 'Couldn’t reach the food database. Enter the label once and Mizan will remember this barcode for both of you.' : 'This barcode isn’t in Open Food Facts yet. Enter the label once and Mizan will remember it for both of you.';
  }
  pushSheet({ type: 'foodEdit', id: null, d: draft, thenLog: topSheet() && topSheet().type === 'log', note });
}

function sheetLinkCode(s) {
  const q = (s.q || '').trim().toLowerCase(); const words = q.split(/\s+/).filter(Boolean);
  const list = words.length ? allFoods().filter((f) => words.every((w) => f.name.toLowerCase().includes(w))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40) : [];
  return `${sheetTop('Link barcode', 'Barcode ' + s.code)}
    <p class="note">Pick the food this barcode belongs to. Next time it’ll open straight away.</p>
    <label class="search">${icon('search', 20)}<input id="lcSearch" data-in="lcSearch" type="search" placeholder="Search your foods" value="${esc(s.q || '')}" aria-label="Search foods"></label>
    <div id="lcResults">${linkRows(list, words.length)}</div>`;
}
function linkRows(list, searched) {
  if (!searched) return '<div class="empty">Type to find the food.</div>';
  return `<div class="list">${list.length ? list.map((f) => `<button class="item" data-act="linkPick" data-id="${esc(f.id)}"><span class="grow"><span class="name">${esc(f.name)}</span><span class="sub">${esc(f.group)}${f.barcode ? ' · has a barcode' : ''}</span></span><span class="add-btn">+</span></button>`).join('') : '<div class="empty">No foods match.</div>'}</div>`;
}

function openAmount(kind, id, extra) {
  const f = kind === 'food' ? food(id) : null;
  const s = Object.assign({ type: 'amount', kind, id, meal: (topSheet() && topSheet().meal) || autoMeal(), qty: 1, unit: -1, state: 'raw', out: false }, extra || {});
  if (f && !extra) { if (f.per === 'serving') s.qty = 1; else if (f.units.length) { s.unit = 0; s.qty = 1; const us = unitLabelState(f.units[0].l); if (us) s.state = us; } else s.qty = 100; }
  pushSheet(s);
}
function refreshAmount() { const s = topSheet(); const el = $('#amtMacros'); if (el && s) el.innerHTML = macroBlock(amountMacros(s)); }

const A = {
  nav(d) { S.ui.view = d.v; if (d.v === 'today') S.ui.day = S.ui.day; render(); window.scrollTo(0, 0); },
  day(d) { S.ui.day = addDays(S.ui.day, num(d.d)); render(); },
  viewLog(d) { S.ui.viewing = d.u || null; render(); window.scrollTo(0, 0); },
  copyFrom(d) {
    const uid = S.ui.viewing; const dd = partnerDay(uid, S.ui.day); if (!dd || dd.error) return;
    const ids = d.id ? [d.id] : dd.entries.filter((e) => e.meal === d.meal).map((e) => e.id);
    const first = dd.entries.find((e) => e.id === ids[0]) || {};
    const m = mealsList().includes(first.meal) ? first.meal : 'Snacks';
    const name = (S.members.find((x) => x.user_id === uid) || {}).display_name;
    pushSheet({ type: 'copyFrom', uid, day: S.ui.day, ids, meal: m, to: today(), name });
  },
  cfMeal(d) { topSheet().meal = d.m; renderSheet(); },
  cfDay(d) { topSheet().to = d.k; renderSheet(); },
  cfSave() {
    const s = topSheet(); const dd = partnerDay(s.uid, s.day) || { entries: [] };
    const items = dd.entries.filter((e) => s.ids.includes(e.id)); const mine = dayData(s.to, true);
    items.forEach((e) => mine.entries.push(Object.assign(clone(e), { id: uid(), meal: s.meal })));
    items.forEach((e) => { if (e.src && e.src.kind !== 'quick' && e.src.id) addRecent((e.src.kind === 'recipe' ? 'r:' : 'f:') + e.src.id); });
    saveDay(s.to); save('core');
    toast(`Copied ${items.length} item${items.length === 1 ? '' : 's'} to your ${s.meal}${s.to === today() ? ' today' : ''}`); closeSheets();
  },
  async toggleShare() {
    const me = S.members.find((m) => Store.user && m.user_id === Store.user.id); if (!me) return;
    const next = !me.share_log;
    const { error } = await Store.sb.from('members').update({ share_log: next }).eq('user_id', Store.user.id);
    if (error) { toast('Couldn’t change sharing. Try again.'); return; }
    me.share_log = next; Store.writeCache(); render();
    toast(next ? 'Your food log is now shared with your household' : 'Your food log is now private');
  },
  close() { closeSheets(); },
  scanOpen() { const t = topSheet(); pushSheet({ type: 'scan', mode: 'log', meal: (t && t.meal) || autoMeal() }); },
  scanAttach() { pushSheet({ type: 'scan', mode: 'attach' }); },
  scanRetry() { const s = topSheet(); s.err = null; renderSheet(); },
  scanManual() {
    const s = topSheet(); const c = normCode(s.code);
    if (!/^\d{8,14}$/.test(c)) { toast('Enter the 8 to 13 numbers under the barcode'); return; }
    Scanner.stop(); handleCode(c);
  },
  linkOpen() { const fe = topSheet(); pushSheet({ type: 'linkCode', code: normCode(fe.d.barcode), q: fe.d.name ? fe.d.name.split(/\s+/).slice(0, 2).join(' ') : '' }); },
  linkPick(d) {
    const s = topSheet(); const f = food(d.id); if (!f) return;
    const clash = foodByCode(s.code);
    if (clash && clash.id !== f.id) { toast('That barcode is already on ' + clash.name); return; }
    const copy = Object.assign(clone(f), { barcode: s.code, updated: Date.now() }); delete copy.deleted;
    S.foods[f.id] = copy; Store.food(f.id);
    S.ui.sheets.pop(); S.ui.sheets.pop();
    if (topSheet() && topSheet().type === 'log') openAmount('food', f.id); else { renderSheet(); toast('Barcode linked to ' + f.name); }
  },
  back() { popSheet(); },
  openLog(d) { S.ui.sheets = []; pushSheet({ type: 'log', meal: d.meal || autoMeal(), q: '', tab: 'recent' }); },
  logMeal(d) { topSheet().meal = d.m; renderSheet(); },
  logTab(d) { topSheet().tab = d.t; $('#logResults').innerHTML = logResults(topSheet()); },
  pickFood(d) { openAmount('food', d.id); },
  pickRecipe(d) { openAmount('recipe', d.id, { qty: 1 }); },
  quickAdd() { pushSheet({ type: 'quick', meal: topSheet().meal, out: true }); },
  copyMeal() { pushSheet({ type: 'copyMeal', meal: topSheet().meal }); },
  copyPick(d) {
    const o = copyOptions()[num(d.i)]; const s = topSheet(); const dd = dayData(S.ui.day, true);
    o.es.forEach((e) => dd.entries.push(Object.assign({}, e, { id: uid(), meal: s.meal })));
    saveDay(S.ui.day); toast(`Copied ${o.es.length} items to ${s.meal}`); closeSheets();
  },
  logSaved(d) {
    const m = S.core.saved[d.id]; const s = topSheet(); const dd = dayData(S.ui.day, true);
    m.items.forEach((e) => dd.entries.push(Object.assign({}, e, { id: uid(), meal: s.meal })));
    saveDay(S.ui.day); toast(`Logged ${m.name}`); closeSheets();
  },
  qtyStep(d) { const s = topSheet(); s.qty = Math.max(0, r1(num(s.qty) + num(d.d))); const i = $('#qtyIn'); if (i) i.value = s.qty; refreshAmount(); },
  amtState(d) { const s = topSheet(); const f = food(s.id); s.state = d.v; if (s.unit >= 0) { const us = unitLabelState(f.units[s.unit].l); if (us && us !== d.v) { s.unit = -1; s.qty = 100; } } renderSheet(); },
  amtOut() { const s = topSheet(); s.out = !s.out; renderSheet(); },
  toggleFav() {
    const s = topSheet(); const key = (s.kind === 'recipe' ? 'r:' : 'f:') + s.id;
    const i = S.core.favs.indexOf(key); if (i >= 0) S.core.favs.splice(i, 1); else S.core.favs.unshift(key);
    save('core'); renderSheet(); toast(i >= 0 ? 'Removed from favourites' : 'Added to favourites');
  },
  amtSave() {
    const s = topSheet(); const m = amountMacros(s);
    if (!(num(s.qty) > 0)) { toast('Enter an amount above zero'); return; }
    const item = s.kind === 'recipe' ? S.recipes[s.id] : food(s.id);
    const entry = { id: s.entryId || uid(), meal: s.meal, name: item.name, detail: entryDetail(s), k: m.k, p: m.p, c: m.c, f: m.f, out: !!s.out, group: s.kind === 'recipe' ? 'Dishes' : item.group,
      src: { kind: s.kind, id: s.id, qty: num(s.qty), unit: s.unit, state: s.state } };
    const k = s.day || S.ui.day; const dd = dayData(k, true);
    if (s.type === 'entry') { const i = dd.entries.findIndex((e) => e.id === s.entryId); if (i >= 0) dd.entries[i] = entry; }
    else dd.entries.push(entry);
    addRecent((s.kind === 'recipe' ? 'r:' : 'f:') + s.id); save('core'); saveDay(k);
    toast(s.type === 'entry' ? 'Saved' : `Added to ${s.meal}`); closeSheets();
  },
  editEntry(d) {
    const e = dayData(S.ui.day).entries.find((x) => x.id === d.id); if (!e) return;
    if (!e.src || e.src.kind === 'quick' || (e.src.kind === 'food' && !food(e.src.id)) || (e.src.kind === 'recipe' && !S.recipes[e.src.id])) {
      pushSheet({ type: 'quick', meal: e.meal, entryId: e.id, name: e.name, k: r0(e.k), p: r1(e.p), c: r1(e.c), f: r1(e.f), out: e.out }); return;
    }
    pushSheet({ type: 'entry', kind: e.src.kind, id: e.src.id, meal: e.meal, qty: e.src.qty, unit: e.src.unit, state: e.src.state || 'raw', out: e.out, entryId: e.id, day: S.ui.day });
  },
  entryDelete() {
    const s = topSheet(); const k = s.day || S.ui.day; const dd = dayData(k, true);
    dd.entries = dd.entries.filter((e) => e.id !== s.entryId); saveDay(k); toast('Removed'); closeSheets();
  },
  qaOut() { const s = topSheet(); s.out = s.out === false ? true : false; renderSheet(); },
  qaSave() {
    const s = topSheet(); if (!(num(s.k) > 0)) { toast('Enter the calories'); return; }
    const dd = dayData(S.ui.day, true);
    const e = { id: s.entryId || uid(), meal: s.meal, name: (s.name || '').trim() || 'Quick add', detail: 'Quick add', k: num(s.k), p: num(s.p), c: num(s.c), f: num(s.f), out: s.out !== false, group: 'Dishes', src: { kind: 'quick' } };
    if (s.entryId) { const i = dd.entries.findIndex((x) => x.id === s.entryId); if (i >= 0) dd.entries[i] = e; } else dd.entries.push(e);
    saveDay(S.ui.day); toast(`Added to ${s.meal}`); closeSheets();
  },
  saveMeal(d) { pushSheet({ type: 'saveMeal', meal: d.meal, name: '' }); },
  smSave() {
    const s = topSheet(); const name = (s.name || '').trim(); if (!name) { toast('Give the meal a name'); return; }
    const es = dayData(S.ui.day).entries.filter((e) => e.meal === s.meal).map((e) => Object.assign({}, e));
    const id = uid(); S.core.saved[id] = { id, name, items: es }; save('core'); toast('Meal saved'); closeSheets();
  },
  // library
  libTab(d) { S.ui.libTab = d.t; S.ui.libQuery = ''; render(); },
  libGroup(d) { S.ui.libGroup = d.g; render(); },
  openFood(d) { const f = food(d.id); if (!f) return; pushSheet({ type: 'foodEdit', id: d.id, d: foodToDraft(f) }); },
  newFood(d) {
    const fromLog = topSheet() && (topSheet().type === 'log' || topSheet().type === 'pickIng');
    const draft = foodToDraft(null); draft.name = d.name || ''; draft.basis = '100';
    pushSheet({ type: 'foodEdit', id: null, d: draft, thenLog: fromLog && topSheet().type === 'log', forRecipe: fromLog && topSheet().type === 'pickIng' });
  },
  feBasis(d) { topSheet().d.basis = d.v; renderSheet(); },
  feRawLabel(d) { const x = topSheet().d; x.rawLabel = d.v; if (!d.v) x.hasCooked = false; renderSheet(); },
  feCooked() { const x = topSheet().d; x.hasCooked = !x.hasCooked; renderSheet(); },
  feUnitAdd() { topSheet().d.units.push({ l: '', g: '' }); renderSheet(); },
  feUnitDel(d) { topSheet().d.units.splice(num(d.i), 1); renderSheet(); },
  feSave() {
    const s = topSheet(); const d = s.d; const name = d.name.trim();
    if (!name) { toast('Give the food a name'); return; }
    const v = (o) => ({ k: num(o.k), p: num(o.p), c: num(o.c), f: num(o.f) });
    let raw = v(d.raw); let per = 100; let units = [];
    if (d.basis === 'serving') {
      const g = num(d.sG);
      if (g > 0) { raw = { k: raw.k * 100 / g, p: raw.p * 100 / g, c: raw.c * 100 / g, f: raw.f * 100 / g }; units = [{ l: d.sName || '1 serving', g }]; }
      else { per = 'serving'; units = [{ l: d.sName || '1 serving', g: null }]; }
    } else units = d.units.filter((u) => u.l && num(u.g) > 0).map((u) => ({ l: u.l.trim(), g: num(u.g) }));
    if (!(raw.k >= 0) || (raw.k === 0 && raw.p === 0 && raw.c === 0 && raw.f === 0 && d.group !== 'Drinks')) { toast('Enter the calories and macros'); return; }
    const id = s.id || ('u-' + uid());
    const prevBy = S.foods[id] && S.foods[id].by;
    const f = { id, name, group: d.group, rawLabel: d.basis === '100' ? (d.rawLabel || null) : null, per, raw, cooked: d.basis === '100' && d.rawLabel && d.hasCooked ? v(d.cooked) : null, units, by: prevBy || profile().name || '', updated: Date.now() };
    const code = normCode(d.barcode || '');
    if (code) {
      const clash = allFoods().find((x) => x.id !== id && x.barcode && normCode(x.barcode) === code);
      if (clash) { toast('That barcode is already on ' + clash.name); return; }
      f.barcode = code;
    }
    S.foods[id] = f; Store.food(id);
    if (s.forRecipe) { S.ui.sheets.pop(); S.ui.sheets.pop(); const r = topSheet(); r.d.items.push({ foodId: id, g: 100 }); renderSheet(); toast('Added to recipe'); return; }
    if (s.thenLog) { S.ui.sheets.pop(); openAmount('food', id); return; }
    toast('Food saved'); popSheet();
  },
  feLog() { const s = topSheet(); S.ui.sheets = [{ type: 'log', meal: autoMeal(), q: '' }]; openAmount('food', s.id); },
  feDelete() {
    const s = topSheet();
    if (STARTER[s.id]) { delete S.foods[s.id]; Store.food(s.id, true); toast('Reset to starter values'); }
    else { S.foods[s.id] = Object.assign({}, S.foods[s.id], { deleted: true }); Store.food(s.id); toast('Food deleted'); }
    popSheet();
  },
  // recipes
  newRecipe() { pushSheet({ type: 'recipe', id: null, d: { name: '', servings: 4, items: [] } }); },
  openRecipe(d) { const r = S.recipes[d.id]; if (!r) return; pushSheet({ type: 'recipe', id: d.id, d: JSON.parse(JSON.stringify({ name: r.name, servings: r.servings, items: r.items })) }); },
  riAdd() { pushSheet({ type: 'pickIng', q: '' }); },
  ingPick(d) { S.ui.sheets.pop(); const r = topSheet(); const f = food(d.id); r.d.items.push({ foodId: d.id, g: f && f.units[0] && !unitLabelState(f.units[0].l) ? f.units[0].g : 100 }); renderSheet(); },
  riDel(d) { topSheet().d.items.splice(num(d.i), 1); renderSheet(); },
  reSave() {
    const s = topSheet(); const d = s.d; const id = s.id || ('r-' + uid());
    S.recipes[id] = { id, name: d.name.trim(), servings: num(d.servings) || 1, items: d.items.map((it) => ({ foodId: it.foodId, g: num(it.g) })), by: (S.recipes[id] && S.recipes[id].by) || profile().name || '', updated: Date.now() };
    Store.recipe(id); toast('Recipe saved'); popSheet();
  },
  reLog() { const s = topSheet(); S.ui.sheets = [{ type: 'log', meal: autoMeal(), q: '' }]; openAmount('recipe', s.id, { qty: 1 }); },
  reDelete() { const s = topSheet(); delete S.recipes[s.id]; Store.recipe(s.id, true); toast('Recipe deleted'); popSheet(); },
  // workouts
  addWorkout() { const p = profile(); pushSheet({ type: 'workout', id: null, d: { type: (p.training && p.training[0]) || 'Run', min: '', km: '', watch: '' } }); },
  editWorkout(d) { const w = dayData(S.ui.day).workouts.find((x) => x.id === d.id); if (!w) return; pushSheet({ type: 'workout', id: w.id, src: w.src, name: w.name, d: { type: w.type, min: w.min || '', km: w.km || '', watch: w.watch || '' } }); },
  woType(d) { topSheet().d.type = d.v; renderSheet(); },
  woSave() {
    const s = topSheet(); const d = s.d; const dd = dayData(S.ui.day, true);
    const w = { id: s.id || uid(), type: d.type, min: num(d.min), km: num(d.km), watch: num(d.watch), credit: workoutCredit(d.type, num(d.min), num(d.km), num(d.watch)) };
    if (s.id) { const i = dd.workouts.findIndex((x) => x.id === s.id); dd.workouts[i] = Object.assign({}, dd.workouts[i], w); } else dd.workouts.push(w);
    saveDay(S.ui.day); toast(`+${fmt(w.credit)} kcal added`); closeSheets();
  },
  woDelete() { const s = topSheet(); const dd = dayData(S.ui.day, true); dd.workouts = dd.workouts.filter((w) => w.id !== s.id); saveDay(S.ui.day); toast('Workout deleted'); closeSheets(); },
  // weight
  logWeight() { pushSheet({ type: 'weight', day: S.ui.view === 'today' ? S.ui.day : today() }); },
  wtSave() {
    const s = topSheet(); const v = num(s.v != null ? s.v : ($('#wt-in') || {}).value);
    if (!(v > 25 && v < 400)) { toast('Enter your weight in kg'); return; }
    S.core.weights[s.day] = r1(v); save('core'); toast('Weight saved'); closeSheets();
  },
  wtDelete() { const s = topSheet(); delete S.core.weights[s.day]; save('core'); toast('Weigh-in removed'); closeSheets(); },
  // check-in
  checkin(d) {
    const wk = weekKey(today()); const t = S.core.targets;
    if (d.apply === '1') { const to = num(d.to); setTargetsFromMacros(to, t.protein); S.core.checkins[wk] = { applied: true, from: t.kcal, to }; }
    else S.core.checkins[wk] = { applied: false, to: t.kcal };
    save('core'); render(); toast('Check-in done');
  },
  // settings
  editProfile() { S.ui.setup = setupDefaults(); S.ui.setup.weight = r1(latestWeight()); S.ui.setupStep = 0; S.ui.editing = true; renderEditProfile(); },
  editTargets() { const t = S.core.targets; pushSheet({ type: 'targets', kcal: t.kcal, protein: t.protein }); },
  tgSave() { const s = topSheet(); const k = num(s.kcal); const p = num(s.protein); const fl = profile().sex === 'male' ? 1500 : 1200; if (k < fl) { toast(`Base calories can't go below ${fl}`); return; } setTargetsFromMacros(k, p); save('core'); toast('Targets saved'); closeSheets(); },
  tgReset() { const t = calcTargets(profile()); Object.assign(S.core.targets, t, { calc: t.kcal }); save('core'); toast("Using Mizan's estimate"); closeSheets(); },
  toggleMaint() { S.core.settings.maintenance = !S.core.settings.maintenance; save('core'); render(); },
  accent(d) { S.core.settings.accent = d.a; save('core'); render(); },
  async exportCsv() {
    const rows = [['date', 'meal', 'item', 'amount', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'eating_out']];
    Object.keys(S.months).sort().forEach((m) => Object.keys(S.months[m].days || {}).sort().forEach((k) => {
      S.months[m].days[k].entries.forEach((e) => rows.push([k, e.meal, e.name, e.detail, r0(e.k), r1(e.p), r1(e.c), r1(e.f), e.out ? 'yes' : 'no']));
      S.months[m].days[k].workouts.forEach((w) => rows.push([k, 'Workout', w.type, (w.min ? w.min + ' min' : '') + (w.km ? ' ' + w.km + ' km' : ''), -w.credit, '', '', '', '']));
    }));
    Object.keys(S.core.weights).sort().forEach((k) => rows.push([k, 'Weight', 'Weigh-in', S.core.weights[k] + ' kg', '', '', '', '', '']));
    const csv = rows.map((r) => r.map((c) => /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(',')).join('\n');
    await offerFile('mizan-log-' + today() + '.csv', csv);
  },
  async exportBackup() {
    const data = JSON.stringify({ app: 'mizan', v: 1, at: new Date().toISOString(), core: S.core, foods: S.foods, recipes: S.recipes, months: S.months });
    await offerFile('mizan-backup-' + today() + '.json', data);
  },
  // account
  authMode(d) { Object.assign(S.ui.auth, { mode: d.m, msg: '', ok: false }); render(); },
  async hhCreate() {
    const h = S.ui.hh; if (!h.display.trim()) { h.msg = 'Enter your first name.'; render(); return; }
    h.busy = true; h.msg = ''; render();
    const { error } = await Store.sb.rpc('create_household', { p_name: h.name.trim() || 'Our home', p_display: h.display.trim() });
    h.busy = false; if (error) { h.msg = authError(error); render(); return; }
    await enterApp();
  },
  async hhJoin() {
    const h = S.ui.hh; if (!h.display.trim()) { h.msg = 'Enter your first name.'; render(); return; }
    if (!h.code.trim()) { h.msg = 'Enter the invite code.'; render(); return; }
    h.busy = true; h.msg = ''; render();
    const { error } = await Store.sb.rpc('join_household', { p_code: h.code.trim().toUpperCase(), p_display: h.display.trim() });
    h.busy = false; if (error) { h.msg = authError(error); render(); return; }
    await enterApp(); toast('Joined ' + (Store.hh ? Store.hh.name : 'household'));
  },
  async copyCode() {
    const code = Store.hh ? Store.hh.code : '';
    try { await navigator.clipboard.writeText(code); toast('Invite code copied'); } catch (e) { toast('Invite code: ' + code); }
  },
  async signOut() {
    try { await Store.flush(); } catch (e) { /* ignore */ }
    Store.clearCache();
    try { await Store.sb.auth.signOut(); } catch (e) { /* ignore */ }
    Store.user = null; Store.hh = null; S.ui.viewing = null; S.partner = {}; S.core = freshCore(); S.foods = {}; S.recipes = {}; S.months = {}; S.members = [];
    S.ui.sheets = []; S.ui.view = 'today'; S.ui.editing = false; S.ui.setup = null; S.ui.setupStep = 0;
    S.ui.auth = { mode: 'signin', email: '', password: '', msg: '', busy: false }; S.ui.hh = { name: '', display: '', code: '', msg: '', busy: false };
    S.ui.phase = 'auth'; render(); window.scrollTo(0, 0);
  },
  retryBoot() { boot(); },
  async stravaConnect() {
    const res = await callStrava('start', { redirect: location.origin + location.pathname });
    if (res.error) { toast(res.error); return; }
    S.core.strava = Object.assign({ seen: [] }, S.core.strava, { pending: true }); save('core'); await Store.flush();
    location.href = res.url;
  },
  stravaSync() { stravaSync(true); },
  async stravaDisconnect() {
    if (!S.ui.confirmDisconnect) { S.ui.confirmDisconnect = true; render(); setTimeout(() => { S.ui.confirmDisconnect = false; }, 6000); return; }
    S.ui.confirmDisconnect = false;
    const res = await callStrava('disconnect');
    if (res.error) { toast(res.error); return; }
    S.core.strava = { connected: false, seen: (S.core.strava && S.core.strava.seen) || [] }; save('core'); render(); toast('Strava disconnected');
  },
  noticeContinue() { S.ui.notice = null; boot(); },
  // setup
  setPick(d) { const x = S.ui.setup; x[d.f] = d.f === 'pace' || d.f === 'mealsCount' ? num(d.v) : d.f === 'pregnant' ? d.v === 'true' : d.v; delete x.__t; rerenderSetup(); },
  setTrain(d) { const x = S.ui.setup; const i = x.training.indexOf(d.v); if (i >= 0) x.training.splice(i, 1); else x.training.push(d.v); rerenderSetup(); },
  setNext() { S.ui.setupStep++; rerenderSetup(); window.scrollTo(0, 0); },
  setBack() { S.ui.setupStep--; rerenderSetup(); window.scrollTo(0, 0); },
  setCancel() { S.ui.editing = false; S.ui.setupStep = 0; S.ui.setup = null; render(); },
  setFinish() {
    const d = S.ui.setup; const p = normalizeProfile(d); const calc = calcTargets(p);
    const t = d.__t || calc; const kcal = num(t.kcal) || calc.kcal; const prot = num(t.protein) || calc.protein;
    const fl = calc.floor; const firstTime = !profile();
    S.core.profile = p;
    S.core.targets = Object.assign({}, calc, { calc: calc.kcal });
    setTargetsFromMacros(Math.max(kcal, p.pregnant ? calc.maint : fl), prot);
    if (firstTime || !S.core.weights[today()]) { if (firstTime) S.core.weights[today()] = r1(p.weight); }
    save('core'); S.ui.editing = false; S.ui.setupStep = 0; S.ui.setup = null; S.ui.view = firstTime ? 'today' : 'settings';
    render(); window.scrollTo(0, 0); toast(firstTime ? 'Welcome to Mizan' : 'Profile updated');
  }
};

function rerenderSetup() { if (S.ui.editing) renderEditProfile(); else $('#app').innerHTML = renderSetup(); }
function renderEditProfile() { $('#app').innerHTML = renderSetup(); $('#sheet').hidden = true; }

async function offerFile(filename, data) {
  try {
    const dl = window.claude && window.claude.use ? await Promise.race([window.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 4000))]) : null;
    if (dl) { await dl.save({ filename, data }); return; }
  } catch (e) { if (e && e.code && /declin|cancel/i.test(e.code)) return; }
  try {
    const blob = new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast('Download isn’t available here'); }
}

// ---------------------------------------------------------------- input handlers
const IN = {
  libSearch(el) { S.ui.libQuery = el.value; const html = renderLibrary(); const tmp = document.createElement('div'); tmp.innerHTML = html; $('#libList').innerHTML = tmp.querySelector('#libList').innerHTML; },
  logSearch(el) { const s = topSheet(); s.q = el.value; $('#logResults').innerHTML = logResults(s); },
  ingSearch(el) { const s = topSheet(); s.q = el.value; $('#ingResults').innerHTML = ingResults(s); },
  qty(el) { topSheet().qty = el.value; refreshAmount(); },
  unit(el) {
    const s = topSheet(); const f = food(s.id); s.unit = parseInt(el.value, 10);
    if (s.unit >= 0) { s.qty = 1; const us = unitLabelState(f.units[s.unit].l); if (us) s.state = us; } else s.qty = 100;
    renderSheet();
  },
  qaF(el) { topSheet()[el.dataset.f] = el.value; },
  scF(el) { topSheet().code = el.value; },
  lcSearch(el) { const s = topSheet(); s.q = el.value; const w = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean); $('#lcResults').innerHTML = linkRows(w.length ? allFoods().filter((f) => w.every((x) => f.name.toLowerCase().includes(x))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40) : [], w.length); },
  feF(el) { topSheet().d[el.dataset.f] = el.value; if (el.dataset.f === 'sG') { /* re-render to show raw toggle */ } },
  feV(el) { topSheet().d[el.dataset.set][el.dataset.k] = el.value; },
  feU(el) { topSheet().d.units[num(el.dataset.i)][el.dataset.k] = el.value; },
  reF(el) { topSheet().d[el.dataset.f] = el.value; updateRecipeTotals(); },
  riG(el) { topSheet().d.items[num(el.dataset.i)].g = el.value; updateRecipeTotals(); },
  woF(el) {
    const s = topSheet(); s.d[el.dataset.f] = el.value; const c = workoutCredit(s.d.type, num(s.d.min), num(s.d.km), num(s.d.watch));
    const box = $('#woCredit .num'); if (box) box.textContent = '+' + fmt(c) + ' kcal'; const b = $('#woSaveBtn'); if (b) b.disabled = !(c > 0);
  },
  wtF(el) { topSheet().v = el.value; },
  auF(el) { S.ui.auth[el.dataset.f] = el.value; },
  hhF(el) { S.ui.hh[el.dataset.f] = el.value; },
  smF(el) { topSheet().name = el.value; },
  tgF(el) { topSheet()[el.dataset.f] = el.value; },
  setF(el) { S.ui.setup[el.dataset.f] = el.value; delete S.ui.setup.__t; setupValidity(); },
  setT(el) { const d = S.ui.setup; if (!d.__t) d.__t = calcTargets(normalizeProfile(d)); d.__t[el.dataset.f] = el.value; },
  restore(el) {
    const file = el.files && el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const b = JSON.parse(rd.result); if (b.app !== 'mizan') throw new Error('not mizan');
        S.core = Object.assign(freshCore(), b.core); S.months = b.months || {};
        Object.entries(b.foods || {}).forEach(([id, f]) => { S.foods[id] = f; Store.food(id); });
        Object.entries(b.recipes || {}).forEach(([id, r]) => { S.recipes[id] = r; Store.recipe(id); });
        save('core', ...Object.keys(S.months).map((m) => 'm-' + m));
        S.ui.setup = null; S.ui.setupStep = 0; S.ui.editing = false; S.ui.view = 'today'; render(); toast('Backup restored');
      } catch (e) { toast('That file isn’t a Mizan backup'); }
    };
    rd.readAsText(file);
  }
};
function updateRecipeTotals() {
  const s = topSheet(); const d = s.d; const tot = recipeTotals({ items: d.items.map((i) => ({ foodId: i.foodId, g: num(i.g) })), servings: num(d.servings) || 1 });
  const box = $('#reTotals'); if (box) box.querySelector('.num').textContent = fmt(tot.per.k) + ' kcal';
  const b = $('#reSaveBtn'); if (b) b.disabled = !(d.name && d.name.trim() && d.items.length);
  const chips = box && box.querySelectorAll('.mchip'); if (chips && chips.length === 3) { chips[0].textContent = 'P ' + r0(tot.per.p) + ' g'; chips[1].textContent = 'C ' + r0(tot.per.c) + ' g'; chips[2].textContent = 'F ' + r0(tot.per.f) + ' g'; }
  const whole = box && box.querySelector('b.num'); if (whole) whole.textContent = fmt(tot.total.k) + ' kcal';
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  ev.preventDefault(); fn(el.dataset, el);
});
document.addEventListener('input', (ev) => { const el = ev.target; const fn = el.dataset && IN[el.dataset.in]; if (fn && el.type !== 'file' && el.tagName !== 'SELECT') fn(el); });
document.addEventListener('change', (ev) => { const el = ev.target; const fn = el.dataset && IN[el.dataset.in]; if (fn && (el.type === 'file' || el.tagName === 'SELECT')) fn(el); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && topSheet()) popSheet(); });
// Food form: re-render after serving weight changes so the right fields show
document.addEventListener('change', (ev) => { if (ev.target.id === 'fe-sg') setTimeout(() => { if (topSheet() && topSheet().type === 'foodEdit') renderSheet(); }, 0); });
window.addEventListener('pagehide', () => { if (Store.pending()) Store.flush(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (Store.pending()) Store.flush(); return; }
  S.partner = {};
  if (S.ui.phase === 'app' && Store.hh && !Store.pending()) Store.loadAll().then(() => { softRender(); stravaAuto(); }, () => {});
});

document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  const a = S.ui.auth; if (a.busy) return;
  const email = (a.email || '').trim(); const pass = a.password || '';
  if (f.dataset.form === 'recovery') {
    if (pass.length < 8) { a.msg = 'Use at least 8 characters.'; render(); return; }
    a.busy = true; render();
    const { error } = await Store.sb.auth.updateUser({ password: pass });
    a.busy = false; a.password = '';
    if (error) { a.msg = authError(error); render(); return; }
    S.ui.recovery = false; a.msg = ''; try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    toast('Password updated'); await boot(); return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) { a.msg = 'Enter a valid email address.'; a.ok = false; render(); return; }
  a.busy = true; a.msg = ''; render();
  let res;
  try {
    if (a.mode === 'reset') {
      res = await Store.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      a.busy = false;
      if (res.error) { a.msg = authError(res.error); a.ok = false; } else { a.msg = 'Check your email for a link to set a new password.'; a.ok = true; }
      render(); return;
    }
    if (a.mode === 'signup' && pass.length < 8) { a.busy = false; a.msg = 'Use at least 8 characters for your password.'; a.ok = false; render(); return; }
    res = a.mode === 'signup'
      ? await Store.sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } })
      : await Store.sb.auth.signInWithPassword({ email, password: pass });
  } catch (e) { res = { error: e }; }
  a.busy = false;
  if (res.error) { a.msg = authError(res.error); a.ok = false; render(); return; }
  if (!res.data || !res.data.session) { a.mode = 'signin'; a.msg = 'Account created. Open the confirmation link sent to ' + email + ', then sign in here.'; a.ok = true; a.password = ''; render(); return; }
  a.password = ''; a.msg = '';
  Store.user = res.data.session.user;
  await afterSignIn();
});

function softRender() { if (S.ui.phase === 'app' && !topSheet() && !S.ui.editing) render(); }
async function enterApp() {
  S.ui.phase = 'loading'; render();
  await Store.loadHousehold();
  if (!Store.hh) { S.ui.phase = 'household'; render(); return; }
  await Store.loadAll();
  S.ui.phase = 'app'; S.ui.view = 'today'; render(); window.scrollTo(0, 0);
  stravaAuto();
}
async function afterSignIn() {
  try { await enterApp(); }
  catch (e) { S.ui.phase = 'error'; S.ui.bootError = authError(e); render(); }
}

// ---------------------------------------------------------------- Strava
const STRAVA_TYPES = { Run: 'Run', TrailRun: 'Run', VirtualRun: 'Run', Walk: 'Walk', Hike: 'Walk', Ride: 'Cycling', VirtualRide: 'Cycling', EBikeRide: 'Cycling',
  MountainBikeRide: 'Cycling', GravelRide: 'Cycling', EMountainBikeRide: 'Cycling', Swim: 'Swim', WeightTraining: 'Gym', Crossfit: 'Gym', Workout: 'Gym',
  HighIntensityIntervalTraining: 'HIIT', Pilates: 'Pilates', Padel: 'Padel', Tennis: 'Padel', Squash: 'Padel', Badminton: 'Padel', Pickleball: 'Padel' };
function stravaType(a) {
  const n = (a.name || '').toLowerCase();
  if (/lagree|megaformer/.test(n)) return 'Lagree';
  if (/pilates|reformer/.test(n)) return 'Pilates';
  if (/padel/.test(n)) return 'Padel';
  return STRAVA_TYPES[a.type] || 'Other';
}
async function callStrava(action, extra) {
  try {
    const { data, error } = await Store.sb.functions.invoke('strava', { body: Object.assign({ action }, extra || {}) });
    if (error) {
      let msg = error.message || 'Could not reach Strava.';
      try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) { /* keep message */ }
      return { error: msg };
    }
    return data || {};
  } catch (e) { return { error: 'No connection. Try again in a moment.' }; }
}
function renderStravaSettings() {
  const st = S.core.strava || {};
  const last = st.lastSync ? new Date(st.lastSync * 1000) : null;
  const when = last ? (dkey(last) === today() ? 'today ' : longDate(dkey(last)).split(',')[0] + ' ') + pad(last.getHours()) + ':' + pad(last.getMinutes()) : '';
  if (st.connected) {
    return `<div class="list">
      <div class="item"><span class="grow"><b>Strava</b><span class="sub wrap">Connected${st.athlete ? ' as ' + esc(st.athlete) : ''}${when ? ' · last synced ' + when : ''}. New workouts come in each time you open Mizan.</span></span>
        <button class="pill" data-act="stravaSync">${S.stravaBusy ? 'Syncing…' : 'Sync now'}</button></div>
      <div class="item"><span class="grow"><span class="sub wrap">Workouts already brought in stay in your log if you disconnect.</span></span>
        <button class="pill" data-act="stravaDisconnect" style="background:transparent;color:var(--bad);border:1px solid var(--line)">${S.ui.confirmDisconnect ? 'Tap again to disconnect' : 'Disconnect'}</button></div></div>`;
  }
  return `<div class="list">
    <div class="item"><span class="grow"><b>Strava</b><span class="sub wrap">Bring in runs, gym, Pilates and other workouts automatically, with the calories from your watch.</span></span>
      <button class="pill" data-act="stravaConnect" style="background:var(--acc);color:var(--on)">Connect</button></div>
    <div class="item"><span class="grow"><span class="sub wrap">Wearing a Fitbit? In the Google Health app, open Connections, choose Strava and turn sharing on. Then connect Strava here.</span></span></div></div>`;
}
function renderNotice() {
  const n = S.ui.notice || {};
  return `<main class="screen" style="padding-top:calc(40px + env(safe-area-inset-top, 0px));max-width:420px;margin:0 auto">${LOGO}
    <h1>${esc(n.title || 'Mizan')}</h1><p class="note">${esc(n.text || '')}</p>
    <button class="btn" data-act="noticeContinue">Continue to Mizan</button></main>`;
}
async function handleStravaReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has('state') || !(q.has('code') || q.has('error'))) return false;
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
  let title = 'Strava connected', text = 'Your workouts will now come into Mizan automatically. If you came here from the Mizan app on your home screen, you can close this page and go back to it.';
  if (q.get('error')) { title = 'Strava not connected'; text = 'The connection was cancelled. You can try again from Settings.'; }
  else if (!(q.get('scope') || '').includes('activity:read')) { title = 'Permission needed'; text = 'Mizan needs permission to view your activities. Tap Connect Strava again and leave the activity boxes ticked.'; }
  else {
    const res = await callStrava('exchange', { code: q.get('code'), state: q.get('state') });
    if (res.error) { title = 'Strava not connected'; text = res.error; }
  }
  S.ui.notice = { title, text }; S.ui.phase = 'notice'; render();
  return true;
}
function stravaAuto() {
  const st = S.core.strava; if (!st || !(st.connected || st.pending)) return;
  if (st.connected && st.lastSync && Date.now() / 1000 - st.lastSync < 600) return;
  stravaSync(false);
}
async function stravaSync(manual) {
  if (S.stravaBusy || !Store.user) return;
  const st = S.core.strava = Object.assign({ seen: [] }, S.core.strava);
  S.stravaBusy = true; if (manual && S.ui.view === 'settings') softRender();
  try {
    const after = st.lastSync ? st.lastSync - 3 * 86400 : Math.floor(Date.now() / 1000) - 14 * 86400;
    const res = await callStrava('sync', { after, skip: st.seen.slice(-300) });
    if (res.error) { if (manual) toast(res.error); return; }
    if (!res.connected) {
      if (st.connected || st.pending) { st.connected = false; st.pending = false; save('core'); softRender(); }
      if (manual) toast('Strava is not connected');
      return;
    }
    const firstTime = !st.connected;
    st.connected = true; st.pending = false; st.athlete = res.athlete || st.athlete;
    let added = 0; const touched = new Set();
    (res.activities || []).forEach((a) => {
      if (st.seen.includes(a.id)) return;
      st.seen.push(a.id);
      const k = String(a.start || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const dd = dayData(k, true); if (dd.workouts.some((w) => w.sid === a.id)) return;
      const type = stravaType(a); const min = Math.round((a.moving || a.elapsed || 0) / 60);
      const km = a.distance > 0 && ['Run', 'Walk', 'Cycling', 'Swim'].includes(type) ? r1(a.distance / 1000) : 0;
      const watch = a.calories ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules) : 0;
      dd.workouts.push({ id: uid(), sid: a.id, src: 'strava', name: a.name || '', type, min, km, watch, credit: workoutCredit(type, min, km, watch) });
      touched.add(k); added++;
    });
    st.seen = st.seen.slice(-400); st.lastSync = Math.floor(Date.now() / 1000);
    save('core'); touched.forEach((k) => saveDay(k));
    if (firstTime) toast('Strava connected' + (added ? ` · ${added} workout${added > 1 ? 's' : ''} from the last 2 weeks` : ''));
    else if (added) toast(`${added} workout${added > 1 ? 's' : ''} synced from Strava`);
    else if (manual) toast('Up to date with Strava');
  } finally { S.stravaBusy = false; softRender(); }
}

// ---------------------------------------------------------------- boot
let authSubscribed = false;
async function boot() {
  applyAccent();
  try { if (!Store.sb) Store.init(); }
  catch (e) { S.ui.phase = 'error'; S.ui.bootError = e.message; render(); return; }
  if (!authSubscribed) {
    authSubscribed = true;
    Store.sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') { S.ui.recovery = true; S.ui.auth.msg = ''; render(); } });
  }
  S.ui.phase = 'loading'; render();
  if (await handleStravaReturn()) return;
  let user = null;
  try { user = await Store.session(); } catch (e) { user = null; }
  if (!user) { S.ui.phase = 'auth'; render(); return; }
  if (Store.readCache()) {
    S.ui.phase = 'app'; render();
    Store.loadHousehold().then((hh) => {
      if (!hh) { Store.clearCache(); S.ui.phase = 'household'; render(); return; }
      return Store.loadAll().then(() => { softRender(); stravaAuto(); });
    }).catch(() => syncState(true));
    return;
  }
  try { await enterApp(); }
  catch (e) { S.ui.phase = 'error'; S.ui.bootError = authError(e); render(); }
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// expose for testing
window.__mizan = { S, A, Store, calcTargets, render };
})();
