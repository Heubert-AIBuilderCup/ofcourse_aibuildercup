// Your roadmaps (/roadmaps) — every roadmap she has made, last opened first. Never ranked.
// A roadmap = one set of answers and the choices she made on its board (swaps, courses put on it).
// Open one: its board (RoadB) with "Your roadmaps" in the header to come back.
// New roadmap: copy one and change some answers (its board opens as a draft, the answers panel ready),
// or start from scratch (onboarding from question 00). Creating runs the full-screen loader, then lands here
// with the new card marked New. First time (from "You're all set"): the loader, then this page with one card.
// All figures are mock.
const BASE_RMS = [
  { id: 'perth', name: 'Cyber Security in Perth', line: 'Master’s · ECU · Perth', pb: 'Permanent residency · 2032', from: 'From onboarding', diffs: [], when: 'Opened today', scene: 'course', place: 'Australia · Perth', here: 3 },
  { id: 'budget', name: 'On a AUD 30k budget', line: 'Master’s · ECU · Perth · a stretch on budget', pb: 'Permanent residency · 2032', from: 'Copy of Cyber Security in Perth', diffs: ['Budget: AUD 30k'], when: 'Opened yesterday', scene: 'budget-saved', place: 'Australia · Perth', here: 3 },
  { id: 'ds', name: 'Data Science instead', line: 'Master’s · UWA · Perth', pb: 'Permanent residency · 2032', from: 'Copy of Cyber Security in Perth', diffs: ['Course: Data Science, swapped on its board'], when: 'Opened 3 days ago', scene: 'swapped', place: 'Australia · Perth', here: 3 }
];
const STEPS_FIRST = ['Reading your answers', 'Drawing your first roadmap', 'Opening your roadmaps'];
const STEPS_NEW = ['Reading your answers', 'Drawing your new roadmap', 'Adding it to your roadmaps'];
const LT = { L1: 1300, L2: 2800, L3: 3900, FADE: 450 };
const LFRAME = { loading: 2000, slow: 2000, error: 2000 };
// a small drawing of the road for each card: tiles on a diagonal, walked ones lit
const tilePts = (cx, cy) => {
  const w = 17, h = 8.5, d = 5;
  const T = [cx, cy - h], R = [cx + w, cy], B = [cx, cy + h], L = [cx - w, cy];
  const p = (a) => a.map(v => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' ');
  return { t: p([T, R, B, L]), l: p([L, B, [B[0], B[1] + d], [L[0], L[1] + d]]), r: p([B, R, [R[0], R[1] + d], [B[0], B[1] + d]]) };
};
const thumb = (here, alt) => {
  const pts = [0, 1, 2, 3, 4, 5, 6].map(i => [46 + i * 32, 42 + i * 13]);
  const tiles = pts.map((c, i) => Object.assign({ cls: 'rd-tile ' + (i <= here ? 's-lit' : i === here + 1 ? 's-next' : 's-fog') }, tilePts(c[0], c[1])));
  if (alt) { const a = tilePts(pts[here][0] + 30, pts[here][1] - 26); tiles.splice(here, 0, Object.assign({ cls: 'rd-tile s-alt' }, a)); }
  return { tiles, roadD: 'M' + pts.map(c => c[0] + ' ' + c[1]).join(' L'), duckX: ((pts[here][0] - 9) / 260 * 100).toFixed(1), duckY: ((pts[here][1] - 26) / 132 * 100).toFixed(1) };
};

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const st = props.state || 'live';
    let list = BASE_RMS.slice();
    const firstKind = props.arrive || props.kind === 'first';
    if (st === 'first' || firstKind) list = [Object.assign({}, BASE_RMS[0], { isNew: true })];
    this.seq = 0;
    if (st === 'ready') list = [this.made(BASE_RMS[0], ['Budget: AUD 24k', 'English test: IELTS 7.5 or more'])].concat(list);
    this.seq = 0;
    this.state = {
      list, view: 'list', openId: null, dlg: st === 'new' ? 'new' : st === 'delete' ? 'del' : st === 'rename' ? 'ren' : null,
      choice: 'copy', fromId: 'perth', menuFor: st === 'menu' ? 'budget' : null, delFor: st === 'delete' ? 'ds' : null, renFor: null, renameVal: '',
      toast: st === 'ready' ? 'ready' : null, newest: st === 'ready' ? list[0].id : null, removed: null,
      t: LFRAME[st] ?? (props.arrive ? 0 : null), kind: firstKind ? 'first' : 'new', loadErr: st === 'error',
      first: st === 'first' || firstKind, draftFrom: null, away: null, status: ''
    };
    this.seq = 0;
  }
  componentDidMount() { this.watchOS(); if (this.props.arrive) this.play('first'); }
  componentWillUnmount() { this.unwatchOS(); if (this.raf) cancelAnimationFrame(this.raf); }
/*THEME_MENU*/
  reduced() { try { return !(this.props.motion ?? true) || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  // a new roadmap from another one, with what is different from it
  made(src, diffs) {
    this.seq += 1;
    return Object.assign({}, src, { id: 'new' + this.seq, name: 'Copy of ' + src.name, from: 'Copy of ' + src.name, diffs, when: 'Made just now', isNew: true,
      scene: diffs.some(d => /^Budget: AUD (24|30)k|^Budget: Not sure/.test(d)) ? 'budget-saved' : src.scene });
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
    const list = this.state.list.map(x => x.id === id ? Object.assign({}, x, { when: 'Opened today', isNew: false }) : x);
    // last opened first
    list.sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0));
    // the first time a roadmap opens, its board shows the map key
    this.setState({ list, view: 'board', openId: id, boardKey: !!r.isNew, menuFor: null, toast: null, first: false, status: 'Opened ' + r.name });
  }
  renderVals() {
    const s = this.state;
    const motion = this.props.motion ?? true;
    const mv = this.menuVals(() => this.setState({ away: 'login', status: 'Signed out' }));
    const tv = this.themeVals();
    const one = s.list.length === 1;
    const cards = s.list.map((r, i) => {
      const th = thumb(r.here, r.scene === 'swapped');
      const menuOpen = s.menuFor === r.id;
      return Object.assign({
        name: r.name, line: r.line, pb: r.pb, from: r.from, when: r.when, place: r.place, isNew: !!r.isNew,
        hasDiffs: r.diffs.length > 0, diffs: r.diffs.map(t => ({ t })),
        cls: 'rm-card' + (r.isNew ? ' is-new' : '') + (menuOpen ? ' has-menu' : ''),
        moreLabel: 'More for ' + r.name, menuOpen, menuExpanded: menuOpen ? 'true' : 'false', canDelete: !one,
        open: () => this.open(r.id),
        toggleMenu: () => this.setState({ menuFor: menuOpen ? null : r.id }),
        copy: () => this.setState({ menuFor: null, view: 'draft', draftFrom: r.id, status: 'New roadmap, a copy of ' + r.name }),
        rename: () => this.setState({ menuFor: null, dlg: 'ren', renFor: r.id, renameVal: r.name }),
        del: () => this.setState({ menuFor: null, dlg: 'del', delFor: r.id })
      }, th);
    });
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
    const from = s.list.find(x => x.id === s.fromId) || s.list[0];
    const opened = s.list.find(x => x.id === s.openId);
    const draftSrc = s.list.find(x => x.id === s.draftFrom);
    const delR = s.list.find(x => x.id === s.delFor);
    const close = () => this.setState({ dlg: null });
    const toastText = s.toast === 'ready' ? 'Your new roadmap is ready.' : s.toast === 'deleted' ? 'Roadmap deleted.' : s.toast === 'scratch' ? 'In the product, this opens onboarding at question 00, your character.' : s.toast === 'renamed' ? 'Renamed.' : '';
    return {
      menuOpen: mv.menuOpen, menuExpanded: mv.menuExpanded, toggleMenu: mv.toggleMenu, closeMenu: mv.closeMenu, menuKey: mv.menuKey, menuBtnRef: mv.menuBtnRef, firstItemRef: mv.firstItemRef, menuSignOut: mv.menuSignOut,
      themeAttr: tv.themeAttr, themePref: tv.themePref, setTheme: tv.setTheme, showMoon: tv.showMoon, showSun: tv.showSun, darkChecked: tv.darkChecked, toggleLabel: tv.toggleLabel, toggleTheme: tv.toggleTheme,
      menuRoadmaps: () => this.setState({ menuOpen: false }), menuAnswers: () => this.setState({ menuOpen: false }),
      rootClass: 'rd rm ' + (motion ? 'motion-on' : 'motion-off') + (loading ? ' is-loading-full' : ''),
      showSelf: !s.away && s.view === 'list', showLogin: s.away === 'login', showBoard: !s.away && s.view === 'board', showDraft: !s.away && s.view === 'draft',
      backHere: () => this.setState({ away: null, status: '' }), motion,
      lead: s.first ? 'Your first roadmap is ready. Open it to explore, or make another with different answers.' : 'Each roadmap is one set of answers and the road it draws. Copy one and change a few answers to see another way.',
      cards,
      openNew: () => this.setState({ dlg: 'new', choice: 'copy', fromId: s.list[0].id, menuFor: null }),
      dlgNew: s.dlg === 'new', dlgDel: s.dlg === 'del' && !!delR, dlgRename: s.dlg === 'ren', closeDlg: close,
      dlgKey: (e) => { if (e.key === 'Escape') close(); },
      copyOn: s.choice === 'copy' ? 'true' : 'false', scratchOn: s.choice === 'scratch' ? 'true' : 'false', copyIs: s.choice === 'copy',
      copyCls: 'rm-choice' + (s.choice === 'copy' ? ' is-on' : ''), scratchCls: 'rm-choice' + (s.choice === 'scratch' ? ' is-on' : ''),
      pickCopy: () => this.setState({ choice: 'copy' }), pickScratch: () => this.setState({ choice: 'scratch' }),
      fromList: s.list.map(r => ({ name: r.name, on: r.id === from.id ? 'true' : 'false', cls: 'rm-fromrow' + (r.id === from.id ? ' is-on' : ''), pick: () => this.setState({ fromId: r.id }) })),
      goNewLabel: s.choice === 'copy' ? 'Copy and change answers' : 'Start the questions',
      goNew: () => s.choice === 'copy' ? this.setState({ dlg: null, view: 'draft', draftFrom: from.id, status: 'New roadmap, a copy of ' + from.name }) : this.setState({ dlg: null, toast: 'scratch' }),
      delTitle: delR ? 'Delete “' + delR.name + '”?' : '',
      doDelete: () => { const i = s.list.findIndex(x => x.id === s.delFor); if (i < 0) return close(); this.setState({ list: s.list.filter(x => x.id !== s.delFor), removed: { r: s.list[i], i }, dlg: null, toast: 'deleted', status: 'Roadmap deleted' }); },
      undoDelete: () => { const rm = s.removed; if (!rm) return; const list = s.list.slice(); list.splice(rm.i, 0, rm.r); this.setState({ list, removed: null, toast: null, status: 'Restored ' + rm.r.name }); },
      renameVal: s.renameVal, renameInput: (e) => this.setState({ renameVal: e.target.value }),
      doRename: () => { const v = (s.renameVal || '').trim(); if (!v) return; this.setState({ list: s.list.map(x => x.id === s.renFor ? Object.assign({}, x, { name: v }) : x), dlg: null, toast: 'renamed', status: 'Renamed to ' + v }); },
      hasToast: !!s.toast && !loading, toastText, toastOpen: s.toast === 'ready', toastUndo: s.toast === 'deleted',
      openNewest: () => this.open(s.list[0].id),
      // the board of the roadmap she opened, and a new one's draft
      boardScene: opened ? opened.scene : 'course', boardKey: !!s.boardKey, boardName: opened ? opened.name : '', backToList: () => this.setState({ view: 'list', status: 'Your roadmaps' }),
      draftScene: draftSrc ? draftSrc.scene : 'course', draftFrom: draftSrc ? draftSrc.name : '',
      create: (diffs) => { const nr = this.made(draftSrc || s.list[0], diffs || []); this.setState({ list: [nr].concat(s.list.map(x => Object.assign({}, x, { isNew: false }))), newest: nr.id, draftFrom: null }); this.play('new'); },
      cancelDraft: () => this.setState({ view: 'list', draftFrom: null, status: 'No new roadmap made' }),
      loadOn: loading, loadOp: (failed ? 1 : 1 - Math.max(0, Math.min(1, (at - LT.L3) / LT.FADE))).toFixed(2), loadSteps,
      loadSlow: slow && !failed, loadErr: failed,
      errText: s.kind === 'first' ? 'We couldn’t draw your roadmap. Your answers are saved.' : 'We couldn’t draw this roadmap. Your answers are saved.',
      retry: () => this.play(s.kind),
      headRef: (el) => { this.headEl = el; },
      statusText: s.status
    };
  }
}
