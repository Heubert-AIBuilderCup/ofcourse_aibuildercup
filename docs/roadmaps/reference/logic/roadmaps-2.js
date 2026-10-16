// Your roadmaps (/roadmaps): every roadmap she has made, as cards or as a table. Never ranked.
// Cards: compact rows with a small vertical road glyph (a line ending in a diamond; accent on the one opened last),
// the name, course · university · city, Point B, chips for changed answers, and where it came from.
// Table: the same roadmaps as rows (the same glyph in the name cell), sortable by name, date made or last opened (never by "best").
// (bigCards is a design alternative only: big cards with key facts. Not part of this build.)
// Open: the whole card or row opens that roadmap's board. New roadmap: copy one and change some answers,
// or start from scratch. Creating runs the full-screen loader, then the new one is first, marked New.
// Archive folds a roadmap away (restorable); Delete removes it, with Undo. All figures are mock.
const BASE_RMS = [
  { id: 'perth', name: 'Cyber Security in Perth', course: 'Cyber Security', uni: 'ECU', city: 'Perth', walked: 4, steps: 9, next: 'Student visa', nextWhen: 'late 2026', end: 'Permanent residency', endY: 2032, scene: 'course', from: 'From onboarding', diffs: [], made: 4, opened: 0 },
  { id: 'budget', name: 'On a AUD 24k budget', course: 'Cyber Security', uni: 'UniSA', city: 'Adelaide', walked: 3, steps: 9, next: 'Pick a course in Adelaide', nextWhen: '', end: '191 · permanent', endY: 2034, scene: 'cost', from: 'Copy of Cyber Security in Perth', diffs: ['Budget: AUD 24k'], made: 3, opened: 1 },
  { id: 'ds', name: 'Data Science instead', course: 'Data Science', uni: 'UWA', city: 'Perth', walked: 4, steps: 9, next: 'Student visa', nextWhen: 'late 2026', end: 'Permanent residency', endY: 2032, scene: 'swapped', from: 'Copy of Cyber Security in Perth', diffs: ['Course: Data Science'], made: 2, opened: 3 },
  { id: 'syd', name: 'Sydney, career first', course: 'Cyber Security', uni: 'UTS', city: 'Sydney', walked: 3, steps: 8, next: 'Pick a course in Sydney', nextWhen: '', end: 'Employer sponsorship', endY: 2031, scene: 'career', from: 'Copy of Cyber Security in Perth', diffs: ['Kind of place: big city', 'Career-focused'], made: 1, opened: 14, archived: true }
];
const OPENED = (d) => d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? d + ' days ago' : Math.round(d / 7) + (Math.round(d / 7) === 1 ? ' week ago' : ' weeks ago');
const SORTS = [['opened', 'Last opened'], ['made', 'Date made'], ['name', 'Name']];
const STEPS_FIRST = ['Reading your answers', 'Drawing your first roadmap', 'Opening your roadmaps'];
const STEPS_NEW = ['Reading your answers', 'Drawing your new roadmap', 'Adding it to your roadmaps'];
const LT = { L1: 1300, L2: 2800, L3: 3900, FADE: 450 };
const LFRAME = { loading: 2000, slow: 2000, error: 2000 };
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const st = props.state || 'live';
    const firstKind = props.arrive || props.kind === 'first';
    let list = BASE_RMS.map(r => Object.assign({}, r));
    if (st === 'first' || firstKind) list = [Object.assign({}, BASE_RMS[0], { isNew: true })];
    this.seq = 0;
    if (st === 'ready') list = [this.made(BASE_RMS[0], ['Budget: AUD 24k', 'English test: IELTS 7.5 or more'])].concat(list);
    let view = props.view === 'table' ? 'table' : 'cards';
    try { const v = window.localStorage.getItem('ofc.roadmaps.view'); if (!props.view && (v === 'table' || v === 'cards')) view = v; } catch (e) {}
    this.state = {
      list, view: 'list', mode: view, sort: 'opened', openId: null,
      dlg: st === 'new' ? 'new' : st === 'delete' ? 'del' : st === 'rename' ? 'ren' : null,
      choice: 'copy', fromId: 'perth', menuFor: st === 'menu' ? 'budget' : null, delFor: st === 'delete' ? 'ds' : null, renFor: null, renameVal: '',
      showArchived: st === 'archived', toast: st === 'ready' ? 'ready' : null, removed: null,
      t: LFRAME[st] ?? (props.arrive ? 0 : null), kind: firstKind ? 'first' : 'new', loadErr: st === 'error',
      first: st === 'first' || firstKind, draftFrom: null, away: null, status: ''
    };
  }
  componentDidMount() { this.watchOS(); if (this.props.arrive) this.play('first'); }
  componentWillUnmount() { this.unwatchOS(); if (this.raf) cancelAnimationFrame(this.raf); }
  // ── Theme: one toggle, light ↔ dark (starts from the device setting when theme is "auto"). The steel panel stays light in both (data-theme="light" on it). ──
  watchOS() { try { this.mq = window.matchMedia('(prefers-color-scheme: dark)'); this.mqf = () => this.setState({ osDark: this.mq.matches }); this.mq.addEventListener('change', this.mqf); } catch (e) {} }
  unwatchOS() { try { if (this.mq) this.mq.removeEventListener('change', this.mqf); } catch (e) {} }
  setTheme(v) { this.setState({ themePref: v }); if (this.props.onTheme) this.props.onTheme(v); }
  themeVals() {
    const pref = (this.state && this.state.themePref) || this.props.theme || 'light';
    let os = this.state && this.state.osDark;
    if (os === undefined) { try { os = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { os = false; } }
    const now = pref === 'auto' ? (os ? 'dark' : 'light') : pref;
    return {
      themeAttr: now,
      showMoon: now === 'light', showSun: now === 'dark', darkChecked: now === 'dark' ? 'true' : 'false',
      toggleLabel: now === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      toggleTheme: () => this.setTheme(now === 'dark' ? 'light' : 'dark'),
      themePref: pref,
      setTheme: (v) => this.setTheme(v)
    };
  }
  // ── Header menu (top right, on the logo's line): Dark theme and Sign out ──
  toggleMenu() {
    const open = !this.state.menuOpen;
    this.setState({ menuOpen: open });
    if (open) setTimeout(() => { if (this.firstItem && this.firstItem.focus) this.firstItem.focus(); }, 0);
  }
  closeMenu(refocus) {
    this.setState({ menuOpen: false });
    if (refocus && this.menuBtn && this.menuBtn.focus) setTimeout(() => this.menuBtn.focus(), 0);
  }
  menuVals(signOut) {
    const open = !!this.state.menuOpen;
    return {
      menuOpen: open, menuExpanded: open ? 'true' : 'false',
      toggleMenu: () => this.toggleMenu(),
      closeMenu: () => this.closeMenu(false),
      menuKey: (e) => { if (e.key === 'Escape' && this.state.menuOpen) { e.preventDefault(); this.closeMenu(true); } },
      menuBtnRef: (el) => { this.menuBtn = el; },
      firstItemRef: (el) => { this.firstItem = el; },
      menuSignOut: () => { this.setState({ menuOpen: false }); signOut(); }
    };
  }
  reduced() { try { return !(this.props.motion ?? true) || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  // a copy, with what is different from the roadmap it came from (mock)
  made(src, diffs) {
    this.seq += 1;
    const budget = diffs.some(d => /^Budget/.test(d));
    return Object.assign({}, src, { id: 'new' + this.seq, name: 'Copy of ' + src.name, from: 'Copy of ' + src.name, diffs, made: -1, opened: -1, isNew: true, archived: false,
      walked: budget ? 3 : src.walked, next: budget ? 'Pick a city that fits AUD 24k' : src.next, nextWhen: budget ? '' : src.nextWhen, scene: budget ? 'budget-saved' : src.scene });
  }
  play(kind) {
    if (this.raf) cancelAnimationFrame(this.raf);
    const steps = kind === 'first' ? STEPS_FIRST : STEPS_NEW;
    this.setState({ view: 'list', t: 0, kind, loadErr: false, status: steps[0] });
    const t0 = performance.now(); let said = 0;
    const tick = (now) => {
      const t = now - t0;
      if (t >= LT.L3 + LT.FADE) {
        this.setState({ t: null, toast: kind === 'first' ? null : 'ready', status: kind === 'first' ? 'Your first roadmap is ready' : 'Your new roadmap is ready' });
        return setTimeout(() => { const h = this.headEl; if (h && h.focus) h.focus({ preventScroll: true }); }, 0);
      }
      const k = t >= LT.L2 ? 2 : t >= LT.L1 ? 1 : 0;
      this.setState(k !== said ? { t, status: steps[k] } : { t }); said = k;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  open(id) {
    const r = this.state.list.find(x => x.id === id); if (!r) return;
    const list = this.state.list.map(x => x.id === id ? Object.assign({}, x, { opened: -1, isNew: false }) : x);
    // the first time a roadmap opens, its board shows the map key
    this.setState({ list, view: 'board', openId: id, boardKey: !!r.isNew, menuFor: null, toast: null, first: false, status: 'Opened ' + r.name });
  }
  setMode(m) { try { window.localStorage.setItem('ofc.roadmaps.view', m); } catch (e) {} this.setState({ mode: m, menuFor: null, status: m === 'table' ? 'Table view' : 'Card view' }); }
  setArchived(id, on) {
    const r = this.state.list.find(x => x.id === id); if (!r) return;
    this.setState({ list: this.state.list.map(x => x.id === id ? Object.assign({}, x, { archived: on, isNew: false }) : x), menuFor: null, toast: on ? 'archived' : 'restored', undoArch: on ? id : null, status: on ? 'Archived ' + r.name : 'Restored ' + r.name });
  }
  renderVals() {
    const s = this.state;
    const motion = this.props.motion ?? true;
    const mv = this.menuVals(() => this.setState({ away: 'login', status: 'Signed out' }));
    const tv = this.themeVals();
    const by = { opened: (a, b) => a.opened - b.opened, made: (a, b) => a.made - b.made, name: (a, b) => a.name.localeCompare(b.name) }[s.sort];
    const active = s.list.filter(r => !r.archived).slice().sort(by), archived = s.list.filter(r => r.archived).slice().sort(by);
    const one = active.length === 1;
    // the one she opened last is marked (accent edge and road)
    const lastId = (s.list.filter(x => !x.archived).slice().sort((a, b) => a.opened - b.opened)[0] || {}).id;
    const item = (r) => {
      const menuOpen = s.menuFor === r.id;
      return {
        name: r.name, line: r.course + ' · ' + r.uni + ' · ' + r.city, courseName: r.course, uni: r.uni,
        hereWord: r.walked >= 4 ? 'At the course' : 'Choosing a course', pbShort: (r.end === 'Permanent residency' ? 'PR' : r.end) + ' · ' + r.endY, course: r.course + ' · ' + r.uni, city: r.city,
        pb: r.end + ' · ' + r.endY, end: r.end, endY: String(r.endY),
        next: r.next + (r.nextWhen ? ' · ' + r.nextWhen : ''), hasNext: !!r.next,
        prog: r.walked + ' of ' + r.steps + ' steps walked', progPct: Math.round(r.walked / r.steps * 100) + '%', progVal: String(r.walked), progMax: String(r.steps),
        from: r.from, when: r.opened < 0 ? 'Just now' : OPENED(r.opened), isNew: !!r.isNew,
        hasDiffs: r.diffs.length > 0, diffs: r.diffs.map(t => ({ t })), diffsText: r.diffs.length ? r.diffs.join(' · ') : '—',
        cls: 'rm-card' + (r.isNew ? ' is-new' : '') + (menuOpen ? ' has-menu' : '') + (r.archived ? ' is-arch' : ''),
        cardCls: 'rm-row' + (r.id === lastId && !r.archived ? ' is-on' : '') + (r.isNew ? ' is-new' : '') + (menuOpen ? ' has-menu' : '') + (r.archived ? ' is-arch' : ''),
        rowCls: 'rm-tr' + (r.id === lastId && !r.archived ? ' is-on' : '') + (r.isNew ? ' is-new' : '') + (menuOpen ? ' has-menu' : '') + (r.archived ? ' is-arch' : ''),
        moreLabel: 'More for ' + r.name, menuOpen, menuExpanded: menuOpen ? 'true' : 'false',
        canDelete: r.archived || !one, canArchive: !r.archived && !one, isArch: !!r.archived, notArch: !r.archived,
        openLabel: r.archived ? 'Restore ' + r.name : 'Open ' + r.name,
        open: () => r.archived ? this.setArchived(r.id, false) : this.open(r.id),
        toggleMenu: () => this.setState({ menuFor: menuOpen ? null : r.id }),
        copy: () => this.setState({ menuFor: null, view: 'draft', draftFrom: r.id, status: 'New roadmap, a copy of ' + r.name }),
        rename: () => this.setState({ menuFor: null, dlg: 'ren', renFor: r.id, renameVal: r.name }),
        archive: () => this.setArchived(r.id, true), restore: () => this.setArchived(r.id, false),
        del: () => this.setState({ menuFor: null, dlg: 'del', delFor: r.id })
      };
    };
    const head = (key, label) => ({ label, key, on: s.sort === key, sortAttr: s.sort === key ? (key === 'name' ? 'ascending' : key === 'opened' ? 'ascending' : 'ascending') : 'none', cls: 'rm-th-btn' + (s.sort === key ? ' is-on' : ''), go: () => this.setState({ sort: key, status: 'Sorted by ' + label.toLowerCase() }) });
    // ── the loader ──
    const steps = s.kind === 'first' ? STEPS_FIRST : STEPS_NEW;
    const at = s.t, loading = at != null;
    const stepAt = [LT.L1, LT.L2, LT.L3];
    const failed = s.loadErr, slow = this.props.state === 'slow';
    const loadSteps = steps.map((t, i) => {
      const bad = failed && i === 1;
      const done = loading && at >= stepAt[i] && !(failed && i >= 1);
      const now = loading && !done && (i === 0 || at >= stepAt[i - 1]) && !(failed && i > 1);
      return { t, cls: 'rb-ls' + (bad ? ' is-bad' : done ? ' is-done' : now ? ' is-now' : ' is-next'), isDone: done && !bad, isBad: bad };
    });
    const from = active.find(x => x.id === s.fromId) || active[0];
    const opened = s.list.find(x => x.id === s.openId);
    const draftSrc = s.list.find(x => x.id === s.draftFrom);
    const delR = s.list.find(x => x.id === s.delFor);
    const close = () => this.setState({ dlg: null });
    const TOAST = { ready: 'Your new roadmap is ready.', deleted: 'Roadmap deleted.', archived: 'Archived. Restore it any time from Archived.', restored: 'Restored.', scratch: 'In the product, this opens onboarding at question 00, your character.', renamed: 'Renamed.' };
    const cards = s.mode === 'cards';
    return {
      menuOpen: mv.menuOpen, menuExpanded: mv.menuExpanded, toggleMenu: mv.toggleMenu, closeMenu: mv.closeMenu, menuKey: mv.menuKey, menuBtnRef: mv.menuBtnRef, firstItemRef: mv.firstItemRef, menuSignOut: mv.menuSignOut,
      themeAttr: tv.themeAttr, themePref: tv.themePref, setTheme: tv.setTheme, showMoon: tv.showMoon, showSun: tv.showSun, darkChecked: tv.darkChecked, toggleLabel: tv.toggleLabel, toggleTheme: tv.toggleTheme,
      menuRoadmaps: () => this.setState({ menuOpen: false }), menuAnswers: () => this.setState({ menuOpen: false }),
      rootClass: 'rd rm ' + (motion ? 'motion-on' : 'motion-off') + (loading ? ' is-loading-full' : '') + ' v-' + s.mode,
      showSelf: !s.away && s.view === 'list', showLogin: s.away === 'login', showBoard: !s.away && s.view === 'board', showDraft: !s.away && s.view === 'draft',
      backHere: () => this.setState({ away: null, status: '' }), motion, headRef: (el) => { this.headEl = el; },
      lead: s.first ? 'Your first roadmap is ready. Open it to explore, or make another with different answers.' : 'Each roadmap is one set of answers and where it leads. Copy one and change a few answers to see another way.',
      count: active.length + (active.length === 1 ? ' roadmap' : ' roadmaps'),
      isCards: cards && !this.props.bigCards, isFacts: cards && !!this.props.bigCards, isTable: !cards,
      cardsOn: cards ? 'true' : 'false', tableOn: cards ? 'false' : 'true', cardsCls: 'rm-seg' + (cards ? ' is-on' : ''), tableCls: 'rm-seg' + (cards ? '' : ' is-on'),
      showCards: () => this.setMode('cards'), showTable: () => this.setMode('table'),
      sorts: SORTS.map(([k, l]) => ({ key: k, label: l })), sortVal: s.sort,
      pickSort: (e) => { const k = e.target.value; const l = (SORTS.find(x => x[0] === k) || SORTS[0])[1]; this.setState({ sort: k, status: 'Sorted by ' + l.toLowerCase() }); },
      sortLabel: (SORTS.find(x => x[0] === s.sort) || SORTS[0])[1],
      hName: head('name', 'Name'), hMade: head('made', 'Made'), hOpened: head('opened', 'Last opened'),
      items: active.map(item), archItems: archived.map(item), hasArch: archived.length > 0, archCount: 'Archived (' + archived.length + ')',
      archOpen: !!s.showArchived, archExpanded: s.showArchived ? 'true' : 'false', toggleArch: () => this.setState({ showArchived: !s.showArchived }),
      openNew: () => this.setState({ dlg: 'new', choice: 'copy', fromId: (active[0] || {}).id, menuFor: null }),
      dlgNew: s.dlg === 'new', dlgDel: s.dlg === 'del' && !!delR, dlgRename: s.dlg === 'ren', closeDlg: close,
      dlgKey: (e) => { if (e.key === 'Escape') close(); },
      copyOn: s.choice === 'copy' ? 'true' : 'false', scratchOn: s.choice === 'scratch' ? 'true' : 'false', copyIs: s.choice === 'copy',
      copyCls: 'rm-choice' + (s.choice === 'copy' ? ' is-on' : ''), scratchCls: 'rm-choice' + (s.choice === 'scratch' ? ' is-on' : ''),
      pickCopy: () => this.setState({ choice: 'copy' }), pickScratch: () => this.setState({ choice: 'scratch' }),
      fromList: active.map(r => ({ name: r.name, on: from && r.id === from.id ? 'true' : 'false', cls: 'rm-fromrow' + (from && r.id === from.id ? ' is-on' : ''), pick: () => this.setState({ fromId: r.id }) })),
      goNewLabel: s.choice === 'copy' ? 'Copy and change answers' : 'Start the questions',
      goNew: () => s.choice === 'copy' ? this.setState({ dlg: null, view: 'draft', draftFrom: from.id, status: 'New roadmap, a copy of ' + from.name }) : this.setState({ dlg: null, toast: 'scratch' }),
      delTitle: delR ? 'Delete “' + delR.name + '”?' : '',
      doDelete: () => { const i = s.list.findIndex(x => x.id === s.delFor); if (i < 0) return close(); this.setState({ list: s.list.filter(x => x.id !== s.delFor), removed: { r: s.list[i], i }, dlg: null, toast: 'deleted', status: 'Roadmap deleted' }); },
      undoToast: () => { if (s.toast === 'deleted' && s.removed) { const list = s.list.slice(); list.splice(s.removed.i, 0, s.removed.r); return this.setState({ list, removed: null, toast: null, status: 'Restored ' + s.removed.r.name }); } if (s.toast === 'archived' && s.undoArch) { const id = s.undoArch; this.setState({ list: s.list.map(x => x.id === id ? Object.assign({}, x, { archived: false }) : x), undoArch: null, toast: null, status: 'Restored' }); } },
      renameVal: s.renameVal, renameInput: (e) => this.setState({ renameVal: e.target.value }),
      doRename: () => { const v = (s.renameVal || '').trim(); if (!v) return; this.setState({ list: s.list.map(x => x.id === s.renFor ? Object.assign({}, x, { name: v }) : x), dlg: null, toast: 'renamed', status: 'Renamed to ' + v }); },
      hasToast: !!s.toast && !loading, toastText: TOAST[s.toast] || '', toastOpen: s.toast === 'ready', toastUndo: s.toast === 'deleted' || s.toast === 'archived',
      openNewest: () => this.open((active.find(r => r.isNew) || active[0]).id),
      // the board of the roadmap she opened, and a new one's draft
      boardScene: opened ? opened.scene : 'course', boardName: opened ? opened.name : '', boardKey: !!s.boardKey, backToList: () => this.setState({ view: 'list', status: 'Your roadmaps' }),
      draftScene: draftSrc ? draftSrc.scene : 'course', draftFrom: draftSrc ? draftSrc.name : '',
      create: (diffs) => { const nr = this.made(draftSrc || active[0], diffs || []); this.setState({ list: [nr].concat(s.list.map(x => Object.assign({}, x, { isNew: false }))), sort: 'opened', draftFrom: null }); this.play('new'); },
      cancelDraft: () => this.setState({ view: 'list', draftFrom: null, status: 'No new roadmap made' }),
      loadOn: loading, loadOp: (failed ? 1 : 1 - Math.max(0, Math.min(1, (at - LT.L3) / LT.FADE))).toFixed(2), loadSteps,
      loadSlow: slow && !failed, loadErr: failed,
      errText: s.kind === 'first' ? 'We couldn’t draw your roadmap. Your answers are saved.' : 'We couldn’t draw this roadmap. Your answers are saved.',
      retry: () => this.play(s.kind),
      statusText: s.status
    };
  }
}
