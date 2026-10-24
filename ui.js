/* Going Concern — interface. Renders state from engine.js; all game rules live there. */
(function () {
  'use strict';
  const GC = window.GC, D = GC.D;
  const { CITIES, COMMODITIES, INDUSTRIES, BACKGROUNDS, SUPPLIER_TYPES, MONTHS } = D;
  const f$ = GC.fmt$;
  const SAVE_KEY = 'goingconcern.save.v1';
  const app = document.getElementById('app');

  let S = null; // game state
  let U = { tab: 'overview', setup: null, confirm: null, toasts: [], pl: 'month', flash: null };

  // ---------- helpers ----------
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fN(x, dp) {
    const a = Math.abs(x), sg = x < 0 ? '-' : '';
    if (a >= 1e9) return sg + (a / 1e9).toFixed(dp != null ? dp : 2) + 'B';
    if (a >= 1e6) return sg + (a / 1e6).toFixed(dp != null ? dp : 2) + 'M';
    if (a >= 1e4) return sg + Math.round(a / 1e3) + 'K';
    if (a >= 1e3) return sg + (a / 1e3).toFixed(1) + 'K';
    if (a >= 10 || dp === 0 || a === Math.round(a)) return sg + Math.round(a);
    return sg + a.toFixed(dp != null ? dp : 1);
  }
  const pct = (x, dp) => (x == null || !isFinite(x)) ? '—' : (x * 100).toFixed(dp != null ? dp : 0) + '%';
  const signCls = (x) => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
  const priceFmt = (x) => x >= 1000 ? f$(x) : x >= 10 ? '$' + x.toFixed(0) : '$' + x.toFixed(2);
  const unitPrice = (x) => x >= 100 ? '$' + Math.round(x).toLocaleString('en-US') : x >= 1 ? '$' + x.toFixed(2) : '$' + x.toFixed(3);
  const ind = () => GC.indById[S.co.ind];
  const city = () => GC.cityById[S.co.city];
  const last = () => S.co.hist[S.co.hist.length - 1];
  const prev = () => S.co.hist[S.co.hist.length - 2];
  const meter = (v, cls) => `<div class="meter-l"><div class="meter ${cls || ''}" style="flex:1"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i></div><span class="num">${pct(v)}</span></div>`;
  // two-step buttons for anything hard to undo (the viewer has no confirm() dialog)
  const confirmBtn = (key, label, act, cls, id) => U.confirm === key
    ? `<button class="btn sm confirm" data-act="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}>Confirm: ${esc(label.toLowerCase())}</button> <button class="btn sm ghost" data-act="cancelConfirm">Keep</button>`
    : `<button class="btn sm ${cls || 'danger'}" data-act="askConfirm" data-key="${esc(key)}">${esc(label)}</button>`;

  function save() { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function load() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  function newSetup(existingCeo) {
    return { step: existingCeo ? 1 : 0, existing: !!existingCeo, ceoName: existingCeo ? existingCeo.name : '', bg: existingCeo ? existingCeo.bg : 'manager', ind: null, city: null, name: '', invest: null, sba: 0, angel: 0, salary: 0, marketing: 2500 };
  }

  // ---------- charts ----------
  function barChart(values, labels, opts) {
    const W = 560, H = opts.h || 170, padL = 46, padB = 20, padT = 10, padR = 6;
    const n = values.length;
    if (!n) return '<div class="empty small">No data yet. Close your first month.</div>';
    let max = Math.max(0, ...values), min = Math.min(0, ...values);
    if (max === min) max = min + 1;
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1))); return Math.ceil(v / p) * p; };
    max = max > 0 ? nice(max) : 0; min = min < 0 ? -nice(-min) : 0;
    const y = (v) => padT + (max - v) / (max - min) * (H - padT - padB);
    const bw = (W - padL - padR) / n;
    const w = Math.min(18, bw * 0.66);
    let g = '';
    const ticks = min < 0 ? [max, 0, min] : [max, max / 2, 0];
    for (const t of ticks) g += `<line class="grid-l" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${opts.money ? f$(t, 0).replace('.0', '') : fN(t)}</text>`;
    values.forEach((v, i) => {
      const x = padL + i * bw + (bw - w) / 2;
      const y0 = y(0), y1 = y(v);
      const h = Math.abs(y1 - y0);
      const col = opts.diverge ? (v >= 0 ? 'var(--pos)' : 'var(--neg)') : (i === n - 1 ? 'var(--bar)' : 'var(--bar-2)');
      const r = Math.min(4, h / 2, w / 2);
      if (h > 0.5) {
        if (v >= 0) g += `<path d="M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z" fill="${col}"/>`;
        else g += `<path d="M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z" fill="${col}"/>`;
      }
      g += `<rect class="hit" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" data-tip="${esc(labels[i] + '\n' + (opts.money ? f$(v) : fN(v)))}"/>`;
      if (n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1) g += `<text x="${padL + i * bw + bw / 2}" y="${H - 5}" text-anchor="middle">${esc(labels[i].split(' ')[0])}</text>`;
    });
    g += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || '')}">${g}</svg>`;
  }
  function lineChart(values, labels, opts) {
    const W = 560, H = opts.h || 150, padL = 46, padB = 20, padT = 10, padR = 10;
    const n = values.length;
    if (n < 2) return '<div class="empty small">Not enough history yet.</div>';
    let max = Math.max(...values), min = Math.min(0, ...values);
    if (max === min) max = min + 1;
    const x = (i) => padL + i / (n - 1) * (W - padL - padR);
    const y = (v) => padT + (max - v) / (max - min) * (H - padT - padB);
    let g = '';
    for (const t of [max, (max + min) / 2, min]) g += `<line class="grid-l" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${f$(t, 0)}</text>`;
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    g += `<polygon points="${x(0)},${y(Math.max(0, min))} ${pts} ${x(n - 1)},${y(Math.max(0, min))}" fill="var(--accent)" opacity="0.1"/>`;
    g += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += `<circle cx="${x(n - 1)}" cy="${y(values[n - 1])}" r="4.5" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/>`;
    const bw = (W - padL - padR) / (n - 1);
    values.forEach((v, i) => { g += `<rect class="hit" x="${x(i) - bw / 2}" y="${padT}" width="${bw}" height="${H - padT - padB}" data-tip="${esc(labels[i] + '\n' + f$(v))}"/>`; if (i % Math.ceil(n / 8) === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 5}" text-anchor="middle">${esc(labels[i].split(' ')[0])}</text>`; });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || '')}">${g}</svg>`;
  }
  function spark(values, w, h) {
    w = w || 96; h = h || 26;
    if (!values || values.length < 2) return '';
    const mx = Math.max(...values), mn = Math.min(...values), rg = mx - mn || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1) * (w - 6) + 1).toFixed(1)},${(h - 3 - (v - mn) / rg * (h - 6)).toFixed(1)}`).join(' ');
    const lx = w - 5, ly = h - 3 - (values[values.length - 1] - mn) / rg * (h - 6);
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="var(--accent)"/></svg>`;
  }

  // ---------- top-level render ----------
  function render() {
    const scroll = window.scrollY;
    let html = '';
    if (!S || U.setup) html = renderSetup();
    else html = renderGame();
    html += renderModals();
    html += `<div class="toasts">${U.toasts.map(t => `<div class="toast"><b>${esc(t.title)}</b>${esc(t.text)}</div>`).join('')}</div>`;
    app.innerHTML = html;
    window.scrollTo(0, scroll);
  }

  // ---------- setup wizard ----------
  function renderSetup() {
    const st = U.setup || (U.setup = newSetup());
    const steps = ['Founder', 'Industry', 'City', 'Funding'];
    let body = '';
    if (st.step === 0) body = setupFounder(st);
    else if (st.step === 1) body = setupIndustry(st);
    else if (st.step === 2) body = setupCity(st);
    else body = setupFunding(st);
    const canNext = st.step === 0 ? true : st.step === 1 ? !!st.ind : st.step === 2 ? !!st.city : true;
    const fd0 = st.ind && GC.indById[st.ind].facilities[0];
    const funded = st.step < 3 || (st.invest || 0) + (st.sba || 0) + (st.angel || 0) >= (fd0 ? fd0.capex : 0);
    return `<div class="wrap">
      <section class="setup-hero">
        <div class="audit">FORM S-1 · ${st.existing ? 'NEW VENTURE' : 'NEW FOUNDER'} · ${GC.monthLabel(S ? S.month : 0).toUpperCase()}</div>
        <div class="wordmark">Going <span>Concern</span></div>
        <p>Found a company in any industry, in any of 18 cities, and run it month by month: suppliers and ingredients, plants and leases, hiring, prices, loans and investors. Grow it into a giant, sell it, or jump to a bigger CEO job.</p>
      </section>
      <div class="steps">${steps.map((n, i) => `<span class="s ${i === st.step ? 'on' : i < st.step ? 'done' : ''}">${i + 1}. ${n}</span>`).join('')}</div>
      ${body}
      <div class="setup-foot">
        <div class="row">${st.step > (st.existing ? 1 : 0) ? `<button class="btn" data-act="setupBack">Back</button>` : ''}${st.existing ? `<button class="btn ghost" data-act="setupCancel">Cancel</button>` : (load() && !S ? `<button class="btn ghost" data-act="resume">Resume saved game</button>` : '')}</div>
        ${st.step < 3 ? `<button class="btn primary" data-act="setupNext" ${canNext ? '' : 'disabled'}>Continue</button>` : `<div class="row">${funded ? '' : '<span class="small neg">Raise enough to pay for the first site</span>'}<button class="btn primary" data-act="found" ${funded ? '' : 'disabled'}>Incorporate ${esc(st.name || 'the company')}</button></div>`}
      </div>
    </div>`;
  }
  function setupFounder(st) {
    return `<div class="panel stack">
      <div class="field" style="max-width:360px"><label for="ceoName">Your name</label><input type="text" id="ceoName" data-setup="ceoName" value="${esc(st.ceoName)}" placeholder="Alex Kahananui"></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Background</div>
      <div class="cards">${BACKGROUNDS.map(b => `<button class="card pickable ${st.bg === b.id ? 'sel' : ''}" data-act="pickBg" data-id="${b.id}">
        <h3>${esc(b.name)}</h3><div class="small muted">${esc(b.blurb)}</div>
        <dl class="facts"><dt>Savings</dt><dd>${f$(b.cash)}</dd><dt>Reputation</dt><dd>${b.rep}/100</dd></dl></button>`).join('')}</div></div>
    </div>`;
  }
  function setupIndustry(st) {
    const sectors = [...new Set(INDUSTRIES.map(i => i.sector))];
    return sectors.map(sec => `<div class="sector"><div class="eyebrow">${esc(sec)}</div><div class="cards">${INDUSTRIES.filter(i => i.sector === sec).map(i => {
      const fd = i.facilities[0];
      const first = i.products[0];
      return `<button class="card pickable ind-card ${st.ind === i.id ? 'sel' : ''}" data-act="pickInd" data-id="${i.id}">
        <div class="row spread"><h3>${esc(i.name)}</h3><span class="pill ${/High/.test(i.capital) ? 'warn' : ''} cap">${esc(i.capital)} capital</span></div>
        <div class="small muted">${esc(i.blurb)}</div>
        <dl class="facts"><dt>First product</dt><dd>${esc(i.priceTaker ? first.name : first.name)}</dd><dt>First site</dt><dd>${fd ? f$(fd.capex) : 'Laptops'}</dd><dt>Sells via</dt><dd>${i.priceTaker ? 'Commodity market' : i.recurring ? 'Subscriptions' : i.reach.mode === 'locations' ? 'Own locations' : 'Sales team + retail'}</dd></dl>
      </button>`;
    }).join('')}</div></div>`).join('');
  }
  function cityFit(c, i) {
    const out = [];
    if (i.priceTaker && i.id === 'oilgas') { out.push(c.oil >= 0.5 ? ['good', `Oil rock ${pct(c.oil)}`] : c.gas >= 0.8 ? ['good', 'Gas basin'] : ['warn', 'No local basin; you can still drill elsewhere']); }
    if (i.id === 'power') out.push([c.ppa >= 70 ? 'good' : '', `Power ${f$(c.ppa)}/MWh · sun ${pct(c.solarCF)}`]);
    if (i.id === 'solar') out.push([c.elec >= 0.25 ? 'good' : c.elec < 0.13 ? 'warn' : '', `Retail power ${(c.elec * 100).toFixed(0)}¢/kWh`]);
    if (i.id === 'datacenter') out.push([c.elec <= 0.12 ? 'good' : c.elec >= 0.25 ? 'bad' : '', `Power ${(c.elec * 100).toFixed(0)}¢/kWh`]);
    const tk = { saas: 'tech', fintech: 'tech', electronics: 'tech', datacenter: 'tech', ev: 'mfg', snacks: 'food', beverage: 'food', restaurants: 'food', airline: 'travel', oilgas: 'energy', power: 'energy' }[i.id];
    if (tk) out.push([c.talent[tk] >= 0.8 ? 'good' : c.talent[tk] < 0.4 ? 'warn' : '', `Talent: ${c.talent[tk] >= 0.8 ? 'deep' : c.talent[tk] < 0.4 ? 'thin' : 'decent'}`]);
    if (c.tourism >= 0.5 && i.tourismSens > 0.2) out.push(['good', 'Big visitor economy']);
    return out;
  }
  function setupCity(st) {
    const i = GC.indById[st.ind];
    const list = CITIES.slice();
    return `<div class="cards">${list.map(c => `<button class="card pickable city-card ${st.city === c.id ? 'sel' : ''}" data-act="pickCity" data-id="${c.id}">
      <div class="row spread"><h3>${esc(c.name)}, ${c.st}</h3><span class="small muted mono">${fN(c.metro)} people</span></div>
      <div class="small muted">${esc(c.notes)}</div>
      <div class="stats"><span>Wages <b>${c.wage.toFixed(2)}×</b></span><span>Industrial rent <b>$${c.indRent}</b></span><span>Power <b>${(c.elec * 100).toFixed(0)}¢</b></span><span>State tax <b>${pct(c.stateTax, 1)}</b></span><span>Office rent <b>$${c.officeRent}</b></span><span>Freight in <b>${c.inbound.toFixed(2)}×</b></span></div>
      <div class="row">${cityFit(c, i).map(([cls, t]) => `<span class="pill ${cls} fit">${esc(t)}</span>`).join('')}</div>
    </button>`).join('')}</div>`;
  }
  function setupFunding(st) {
    const i = GC.indById[st.ind], c = GC.cityById[st.city];
    const bg = BACKGROUNDS.find(b => b.id === st.bg);
    const personal = st.existing ? S.ceo.cash : bg.cash;
    const rep = st.existing ? S.ceo.rep : bg.rep;
    if (st.invest == null) { st.invest = Math.round(Math.min(personal, Math.max(personal * 0.85, 0)) / 1000) * 1000; if (i.recurring && !st.angel) st.angel = 500000; }
    st.invest = Math.min(st.invest, personal);
    if (!st.name) st.name = (c.id === 'honolulu' ? ['Kai', 'Mauka', 'Makai', 'Aloha', 'Pono'][INDUSTRIES.indexOf(i) % 5] : ['Northline', 'Foundry', 'Keystone', 'Lantern', 'Bluefield'][INDUSTRIES.indexOf(i) % 5]) + ' ' + D.COMPANY_WORDS[i.id][0];
    const sbaMax = Math.min(5e6, 250000 + st.invest * 4);
    st.sba = Math.min(st.sba, sbaMax);
    const pre = GC.angelPre({ ceo: { rep } }, i.id);
    st.angel = Math.min(st.angel, 1.5e6);
    const fd = i.facilities[0];
    const starterCost = fd ? fd.capex : 0;
    const lease = fd ? (fd.noRent ? fd.lease : fd.lease * c.indRent / 12) + fd.fixed : 0;
    const cash = st.invest + st.sba + st.angel - starterCost;
    const sbaPay = st.sba > 0 ? st.sba * (0.0975 / 12) / (1 - Math.pow(1 + 0.0975 / 12, -120)) : 0;
    const burn = lease + st.salary / 12 * 1.28 + st.marketing + sbaPay + 1500 + 175 * c.officeRent / 12;
    const angelPct = st.angel > 0 ? st.angel / (pre + st.angel) : 0;
    const site = fd ? (fd.res ? CITIES.filter(x => GC.resQ(x, fd.res) > 0).sort((a, b) => GC.resQ(b, fd.res) - GC.resQ(a, fd.res))[0] : c) : c;
    return `<div class="grid side">
      <div class="panel stack">
        <div class="form">
          <div class="field"><label for="coName">Company name</label><input type="text" id="coName" data-setup="name" value="${esc(st.name)}"></div>
          <div class="field"><label for="salary">Your salary (per year)</label><input type="number" id="salary" step="10000" min="0" data-setup="salary" value="${st.salary}"><span class="hint">Most founders pay themselves little or nothing at first. You pay your own rent either way: about ${f$(4200 * c.wage)}/month in ${esc(c.name)}.</span></div>
        </div>
        <div class="field"><label for="invest">Invest your savings</label><div class="slider-row"><input type="range" id="invest" min="0" max="${Math.round(personal)}" step="1000" data-setup="invest" value="${st.invest}"><span class="num">${f$(st.invest)}</span></div><span class="hint">You have ${f$(personal)}. Whatever you keep covers your living costs.</span></div>
        <div class="field"><label for="sba">SBA 7(a) loan</label><div class="slider-row"><input type="range" id="sba" min="0" max="${Math.round(sbaMax)}" step="5000" data-setup="sba" value="${st.sba}"><span class="num">${f$(st.sba)}</span></div><span class="hint">Up to ${f$(sbaMax)} (banks lend about 4× your own equity). 10 years at prime + 2.75%, personally guaranteed.</span></div>
        <div class="field"><label for="angel">Raise from angel investors</label><div class="slider-row"><input type="range" id="angel" min="0" max="1500000" step="25000" data-setup="angel" value="${st.angel}"><span class="num">${f$(st.angel)}</span></div><span class="hint">At a ${f$(pre)} pre-money valuation${st.angel > 0 ? `, you give up ${pct(angelPct, 1)} of the company` : ''}.</span></div>
        <div class="field"><label for="mkt">Starting marketing budget (per month)</label><input type="number" id="mkt" step="500" min="0" data-setup="marketing" value="${st.marketing}"></div>
      </div>
      <div class="panel stack">
        <div><div class="eyebrow">Opening balance sheet</div><h2 style="margin-top:4px">${esc(st.name)}</h2><div class="small muted">${esc(i.name)} · HQ ${esc(c.name)}, ${c.st}</div></div>
        <table class="t"><tbody>
          <tr><td>Your equity</td><td class="r num">${f$(st.invest)}</td></tr>
          <tr><td>SBA loan</td><td class="r num">${f$(st.sba)}</td></tr>
          <tr><td>Angel investment</td><td class="r num">${f$(st.angel)}</td></tr>
          <tr><td>${fd ? esc(fd.name) : 'Laptops and software'}${fd && site.id !== c.id ? ` <span class="muted">(${esc(site.name)})</span>` : ''}</td><td class="r num neg">${f$(-starterCost)}</td></tr>
          <tr class="total"><td>Cash on day one</td><td class="r num ${cash < 0 ? 'neg' : ''}">${f$(cash)}</td></tr>
          <tr><td>Fixed monthly costs before staff</td><td class="r num">${f$(burn)}</td></tr>
          <tr><td>Months of runway (before any revenue)</td><td class="r num">${burn > 0 ? Math.max(0, cash / burn).toFixed(1) : '—'}</td></tr>
        </tbody></table>
        ${cash < 0 ? `<div class="note"><b>Not enough capital.</b> The first site costs ${f$(starterCost)}. Add savings, borrow, or raise.</div>` : ''}
        <div class="note">You start in the <b>${esc(c.name)} metro</b> only, with one ${i.priceTaker ? 'asset' : 'product'}: <b>${esc(i.products[0].name)}</b>. ${i.facilities.length ? `${fd.build > 1 ? `Your ${esc(fd.name.toLowerCase())} takes ${fd.build} months to come online.` : `Your ${esc(fd.name.toLowerCase())} is ready on day one.`}` : 'Two engineers start building the MVP.'} The game hires a lean starting crew; adjust it on the People tab.</div>
      </div>
    </div>`;
  }

  // ---------- game screen ----------
  function renderGame() {
    if (!S.co) return renderBetween();
    const co = S.co, I = ind(), C = city();
    const m = GC.metrics(co);
    const h = last();
    const burn = -m.avgCashFlow3;
    const runway = burn > 0 ? co.cash / burn : Infinity;
    const val = co.valuation ? (co.public ? co.sharePrice * co.shares.total : co.valuation.equity) : 0;
    const alerts = co.lastReport ? co.lastReport.alerts : [];
    const tabs = [['overview', 'Overview'], ['ops', 'Operations'], ['supply', 'Supply chain'], ['people', 'People'], ['markets', I.priceTaker ? 'Prices & sites' : 'Markets'], ['finance', 'Finance'], ['career', 'Career']];
    const tabAlert = (k) => alerts.some(a => a.tab === k && a.sev === 'crit');
    const blocked = !!(co.crisis || S.pendingEvent);
    let body = '';
    switch (U.tab) {
      case 'ops': body = tabOps(); break;
      case 'supply': body = tabSupply(); break;
      case 'people': body = tabPeople(); break;
      case 'markets': body = I.priceTaker ? tabPrices() : tabMarkets(); break;
      case 'finance': body = tabFinance(); break;
      case 'career': body = tabCareer(); break;
      default: body = tabOverview();
    }
    return `<header class="statusbar"><div class="wrap">
        <div class="brand"><span class="co">${esc(co.name)}${co.public ? ' <span class="pill acc">PUBLIC</span>' : ''}</span><span class="sub">${esc(I.name)} · ${esc(C.name)}, ${C.st} · CEO ${esc(S.ceo.name)}</span></div>
        <div class="vitals">
          <div class="vital"><span class="k">Cash</span><span class="v ${co.cash < 0 ? 'neg' : ''}">${f$(co.cash)}</span></div>
          <div class="vital"><span class="k">Revenue / mo</span><span class="v">${h ? f$(h.rev) : '—'}</span></div>
          <div class="vital"><span class="k">Net income / mo</span><span class="v ${h ? signCls(h.ni) : ''}">${h ? f$(h.ni) : '—'}</span></div>
          <div class="vital"><span class="k">Runway</span><span class="v ${runway < 4 ? 'neg' : runway < 8 ? 'warn' : ''}">${runway === Infinity ? 'Cash +' : runway.toFixed(1) + ' mo'}</span></div>
          <div class="vital"><span class="k">${co.public ? 'Market cap' : 'Valuation'}</span><span class="v">${co.valuation ? f$(val) : '—'}</span></div>
        </div>
        <div class="close-month"><span class="date">${GC.monthLabel(S.month)}</span><button class="btn primary" data-act="advance" ${blocked ? 'disabled' : ''}>Close ${MONTHS[GC.calMonth(S.month)]}</button></div>
      </div>
      <div class="wrap"><nav class="tabs" role="tablist">${tabs.map(([k, n]) => `<button class="tab ${U.tab === k ? 'on' : ''}" role="tab" aria-selected="${U.tab === k}" data-act="tab" data-id="${k}">${n}${tabAlert(k) ? '<span class="dot" aria-label="needs attention"></span>' : ''}</button>`).join('')}</nav></div>
    </header>
    <main class="wrap">${body}</main>`;
  }

  function newsList(limit) {
    const items = (S.news || []).slice(0, limit || 14);
    if (!items.length) return '<div class="empty small">Your news wire is quiet. Close a month to see what happens.</div>';
    return `<div class="news">${items.map(n => `<div class="item ${n.tone} ${n.big ? 'big' : ''}"><span class="when">${GC.monthLabel(n.m)}</span><span class="txt"><span class="mark"></span>${esc(n.text)}</span></div>`).join('')}</div>`;
  }

  function tabOverview() {
    const co = S.co, I = ind();
    const H = co.hist.slice(-24);
    const h = last(), p = prev();
    const labels = H.map(x => GC.monthLabel(x.m));
    const alerts = co.lastReport ? co.lastReport.alerts : [];
    const delta = (a, b) => (b && Math.abs(b) > 1) ? (a - b) / Math.abs(b) : null;
    const tile = (k, v, d, good) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div>${d != null ? `<div class="d ${d === 0 ? '' : (d > 0) === (good !== false) ? 'pos' : 'neg'}">${d > 0 ? '+' : ''}${pct(d)} vs prior month</div>` : '<div class="d muted">&nbsp;</div>'}</div>`;
    const M = S.macro;
    const report = h ? `<section class="panel report">
        <div class="stack">
          <div><div class="eyebrow">Month closed</div><h2>${GC.monthLabel(h.m)}: ${h.ni >= 0 ? 'profit of ' + f$(h.ni) : 'loss of ' + f$(-h.ni).replace(/[()]/g, '')}</h2>
          <p class="muted small" style="margin:4px 0 0">Revenue ${f$(h.rev)}${p ? ` (${h.rev >= p.rev ? '+' : ''}${pct(delta(h.rev, p.rev))})` : ''} · gross margin ${h.rev > 0 ? pct(h.gp / h.rev) : '—'} · cash ${f$(h.cash)} · ${h.heads} employees</p></div>
          ${cashPanel(true)}
          ${alerts.length ? `<div class="alerts">${alerts.map(a => `<button class="alert ${a.sev}" data-act="tab" data-id="${a.tab}"><span class="ic">${a.sev === 'crit' ? '!!' : '!'}</span><span>${esc(a.text)}</span></button>`).join('')}</div>` : '<div class="note">No warnings this month. Operations ran clean.</div>'}
        </div>
        <div><div class="eyebrow" style="margin-bottom:6px">Economy</div>
          <table class="t"><tbody>
            <tr><td>Cycle</td><td class="r"><span class="pill ${M.econ === 'recession' ? 'bad' : M.econ === 'slowdown' ? 'warn' : 'good'}">${GC.ECON[M.econ].label}</span></td></tr>
            <tr><td>Fed funds / prime</td><td class="r num">${M.fed.toFixed(2)}% / ${(M.fed + 3).toFixed(2)}%</td></tr>
            <tr><td>Prices since Jan 2027</td><td class="r num">+${pct(M.cpi - 1, 1)}</td></tr>
            <tr><td>Average tariff on imports</td><td class="r num">${pct(M.tariff - 1)}</td></tr>
            <tr><td>WTI crude</td><td class="r num">$${S.prices.crude.toFixed(2)}/bbl</td></tr>
            ${GC.cityById[co.city].tourism >= 0.3 ? `<tr><td>Visitor arrivals index</td><td class="r num">${(M.tourism * 100).toFixed(0)}</td></tr>` : ''}
          </tbody></table></div>
      </section>` : `<section class="panel"><div class="eyebrow">Day one</div><h2 style="margin:4px 0 8px">Welcome to ${esc(co.name)}</h2>
        <div class="note">Look through <b>Operations</b> (your first ${I.priceTaker ? 'asset' : 'site and product price'}), <b>Supply chain</b> (who you buy from), and <b>People</b> (your crew). Then press <b>Close ${MONTHS[GC.calMonth(S.month)]}</b> to run your first month. Every month you get a P&amp;L, a balance sheet and whatever the world throws at you.</div></section>`;
    return `<div class="stack">${report}
      ${h ? `<div class="kpis">
        ${tile('Revenue', f$(h.rev), p ? delta(h.rev, p.rev) : null)}
        ${tile('Gross profit', f$(h.gp), p ? delta(h.gp, p.gp) : null)}
        ${tile('EBITDA', `<span class="${signCls(h.ebitda)}">${f$(h.ebitda)}</span>`, null)}
        ${tile('Net income', `<span class="${signCls(h.ni)}">${f$(h.ni)}</span>`, null)}
      </div>` : ''}
      <div class="grid side">
        <div class="stack">
          <div class="grid g2">
            <section class="panel"><header><h3>Revenue</h3><span class="small muted">last ${H.length} months</span></header>${barChart(H.map(x => x.rev), labels, { money: true, label: 'Monthly revenue' })}</section>
            <section class="panel"><header><h3>Net income</h3><span class="small muted">profit above the line, loss below</span></header>${barChart(H.map(x => x.ni), labels, { money: true, diverge: true, label: 'Monthly net income' })}</section>
          </div>
          <section class="panel"><header><h3>Cash balance</h3><span class="small muted">end of month</span></header>${lineChart(H.map(x => x.cash), labels, { label: 'Cash balance' })}</section>
          ${productSummary()}
        </div>
        <aside class="panel"><header><h3>News wire</h3></header>${newsList(18)}</aside>
      </div>
    </div>`;
  }

  function productSummary() {
    const co = S.co, I = ind();
    const rows = I.products.filter(p => co.products[p.id].active);
    if (!rows.length) return '';
    return `<section class="panel"><header><h3>${I.priceTaker ? 'Production' : 'Products'} last month</h3><button class="btn sm" data-act="tab" data-id="ops">Manage</button></header><div class="tbl-wrap"><table class="t">
      <thead><tr><th>${I.priceTaker ? 'Stream' : 'Product'}</th><th class="r">${I.recurring ? 'Customers' : 'Sold'}</th>${I.priceTaker || I.recurring ? '' : '<th class="r">Lost sales</th>'}<th class="r">Revenue</th><th class="r">Unit margin</th></tr></thead><tbody>
      ${rows.map(p => { const ps = co.products[p.id]; const price = I.priceTaker ? (ps.sold > 0 ? ps.rev / ps.sold : 0) : ps.price; const um = I.priceTaker ? null : price - (ps.unitCost || 0);
        return `<tr><td>${esc(p.name)}</td><td class="r num">${fN(ps.sold || 0)} <span class="muted">${esc(p.unit)}${I.recurring ? '' : 's'}</span></td>${I.priceTaker || I.recurring ? '' : `<td class="r num ${ps.lost > ps.sold * 0.05 ? 'neg' : 'muted'}">${fN(ps.lost || 0)}</td>`}<td class="r num">${f$(ps.rev || 0)}</td><td class="r num ${um != null ? signCls(um) : ''}">${um != null && ps.sold ? unitPrice(um) + ' (' + pct(um / price) + ')' : I.priceTaker && ps.sold ? unitPrice(price) + ' realized' : '—'}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  }

  // ---------- Operations ----------
  function tabOps() {
    const co = S.co, I = ind();
    const rdRate = co.staff.rd * GC.productivity(co) * 10 + (co.isFounder ? 5 : 2);
    const nextLocked = I.products.filter(p => !co.products[p.id].unlocked).sort((a, b) => a.unlock - b.unlock)[0];
    return `<div class="stack">
      <section class="panel"><header><div><h2>${I.priceTaker ? 'Production streams' : 'Products & pricing'}</h2><p class="small muted">${I.priceTaker ? 'You are a price-taker: you sell everything you produce at the market price.' : I.recurring ? 'Subscriptions renew monthly. Price affects both sign-ups and churn.' : 'Set your wholesale price. Customers compare it with the market reference price, which rises with inflation.'}</p></div>
        <div class="small muted">R&amp;D: <b class="mono">${fN(co.rdPts, 0)}</b> points, +${fN(rdRate, 0)}/month${nextLocked ? ` · next unlock at ${nextLocked.unlock}` : ''}</div></header>
        <div class="tbl-wrap">${I.priceTaker ? ptProductTable() : I.recurring ? recurringTable() : productTable()}</div>
      </section>
      ${I.storable ? `<section class="panel"><header><div><h3>Production plan</h3><p class="small muted">The plant builds to forecast demand plus a finished-goods buffer. More buffer means fewer stockouts and more cash tied up in inventory.</p></div>
        <label class="row small">Finished-goods buffer <span class="stepper"><button class="btn" data-act="buffer" data-d="-1">−</button><span class="mono">${co.bufferWeeks} wk</span><button class="btn" data-act="buffer" data-d="1">+</button></span></label></header></section>` : ''}
      ${devPanel()}
      ${facilitiesPanel()}
    </div>`;
  }
  function productTable() {
    const co = S.co, I = ind();
    return `<table class="t"><thead><tr><th>Product</th><th>Price</th><th>Quality</th><th class="r">Demand</th><th class="r">Sold</th><th class="r">Lost</th><th class="r">Unit cost</th><th class="r">Margin</th>${I.storable ? '<th class="r">Inventory</th>' : ''}<th></th></tr></thead><tbody>
      ${I.products.map(p => {
        const ps = co.products[p.id];
        const ref = p.price * S.macro.cpi;
        if (!ps.active) {
          return `<tr><td><div class="name-cell"><b>${esc(p.name)}</b><span class="muted">per ${esc(p.unit)} · list ${unitPrice(ref)}</span></div></td><td colspan="${I.storable ? 8 : 7}">${ps.unlocked ? `<span class="pill good">Ready to launch</span> <span class="small muted">launch cost ${f$((p.launch || 0) * S.macro.cpi)}</span>` : `<span class="pill">Locked</span> <span class="small muted">needs ${p.unlock} R&amp;D points (${fN(co.rdPts, 0)} so far)</span>`}</td><td class="r">${ps.unlocked ? `<button class="btn sm primary" data-act="launch" data-id="${p.id}">Launch</button>` : ''}</td></tr>`;
        }
        const margin = ps.price - (ps.unitCost || 0);
        const weeks = ps.fc > 0 ? ps.fg / ps.fc * 4.33 : 0;
        return `<tr><td><div class="name-cell"><b>${esc(p.name)}</b><span class="muted">per ${esc(p.unit)} · market ${unitPrice(ref)}</span></div></td>
          <td><input type="number" class="w-s" id="price-${p.id}" data-bind="price" data-id="${p.id}" step="${ps.price < 10 ? 0.05 : ps.price < 1000 ? 1 : 100}" min="0" value="${ps.price}" aria-label="Price for ${esc(p.name)}"></td>
          <td style="min-width:110px">${qMeter(p)}</td>
          <td class="r num">${fN(ps.dem || 0)}</td><td class="r num">${fN(ps.sold || 0)}</td><td class="r num ${ps.lost > ps.sold * 0.05 ? 'neg' : 'muted'}">${fN(ps.lost || 0)}</td>
          <td class="r num">${ps.unitCost ? unitPrice(ps.unitCost) : '—'}</td><td class="r num ${signCls(margin)}">${ps.unitCost ? pct(margin / ps.price) : '—'}</td>
          ${I.storable ? `<td class="r num">${fN(ps.fg || 0)} <span class="muted">(${weeks.toFixed(1)} wk)</span></td>` : ''}<td class="r"><button class="btn sm ghost" data-act="priceRef" data-id="${p.id}">Match market</button></td></tr>`;
      }).join('')}</tbody></table>
      <p class="small muted" style="margin:10px 0 0">Demand is what customers wanted. Lost sales come from stockouts or not enough capacity. Unit cost includes materials, contract fees, energy, freight and other variable costs; staff and site costs are fixed and sit lower in the P&amp;L.</p>`;
  }
  function qMeter(p) {
    const q = GC.qEff(S.co, p);
    return `<div class="meter-l"><div class="meter ${q < 40 ? 'bad' : q < 55 ? 'warn' : ''}" style="flex:1"><i style="width:${q.toFixed(1)}%"></i></div><span class="num">${Math.round(q)}</span></div>`;
  }
  function devPanel() {
    const co = S.co, I = ind();
    const prods = I.products.filter(p => co.products[p.id].active && GC.upgradesFor(co, p).length);
    if (!prods.length) return '';
    const sel = prods.some(p => p.id === U.devProduct) ? U.devProduct : prods[0].id;
    const p = I.products.find(x => x.id === sel), ps = co.products[p.id];
    const ing = GC.ingredientQ(co, p);
    const parts = [['R&D know-how', ps.q], ['Ingredients & farm partners', ing], ['Improvements finished', ps.qBonus || 0], ['PR & sponsorships', co._prQ || 0]];
    const speed = co.staff.rd > 0 ? Math.min(2, 1 + co.staff.rd / 20) : 0.5;
    const ups = GC.upgradesFor(co, p).map(u => {
      const done = ps.done.includes(u.id), wip = ps.projects[u.id];
      const fx = [`+${u.q} quality`];
      if (u.mat) fx.push(`${u.mat > 1 ? '+' : ''}${pct(u.mat - 1)} material cost`);
      if (u.demand) fx.push(`+${pct(u.demand - 1)} demand`);
      if (u.demandHome) fx.push(`+${pct(u.demandHome - 1)} demand at home`);
      const locked = u.rd && co.rdPts < u.rd;
      const cost = u.cost * S.macro.cpi;
      return `<div class="card"><div class="row spread"><h3>${esc(u.name)}</h3>${done ? '<span class="pill good">Done</span>' : wip ? `<span class="pill warn">${Math.ceil(wip / speed)} mo left</span>` : ''}</div>
        <div class="small muted">${esc(u.desc)}</div><div class="small">${fx.join(' · ')}</div>
        ${done || wip ? '' : `<div class="foot"><button class="btn sm primary" data-act="project" data-id="${p.id}" data-u="${u.id}" ${locked || co.cash < cost ? 'disabled' : ''}>Start · ${f$(cost)} · ${u.months} mo</button>${locked ? `<span class="small muted">Needs ${u.rd} R&amp;D points</span>` : ''}</div>`}</div>`;
    }).join('');
    return `<section class="panel"><header><div><h2>Product development</h2><p class="small muted">Quality drives demand, lets you charge more, and opens doors with picky buyers like resort hotels. It comes from four places.</p></div>
      ${prods.length > 1 ? `<select id="devProduct" data-bind="devProduct">${prods.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</header>
      <div class="grid g2" style="margin-bottom:14px">
        <div><div class="row spread"><b>${esc(p.name)}</b><span class="mono" style="font-size:20px;font-weight:600">${Math.round(GC.qEff(co, p))}<span class="muted small">/100</span></span></div>
          <table class="t" style="margin-top:6px"><tbody>${parts.map(([n, v]) => `<tr><td>${n}</td><td class="r num ${v < 0 ? 'neg' : v > 0 && n !== 'R&D know-how' ? 'pos' : ''}">${n === 'R&D know-how' ? Math.round(v) : (v >= 0 ? '+' : '') + v.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
        <div class="note"><b>How to raise it:</b> choose budget, standard or elevated ingredients on the <b>Supply chain</b> tab; partner with a local farm; finish the improvement projects below (faster with more ${esc(I.rdName.toLowerCase())}: ${speed.toFixed(1)}× speed now); hire R&amp;D to build know-how; fund PR. Competitors keep improving, so know-how slowly fades without R&amp;D.</div>
      </div>
      <div class="cards">${ups}</div></section>`;
  }
  function recurringTable() {
    const co = S.co, I = ind();
    return `<table class="t"><thead><tr><th>Plan</th><th>Price / mo</th><th>Quality</th><th class="r">Customers</th><th class="r">New</th><th class="r">Churn</th><th class="r">MRR</th><th class="r">Cost / customer</th><th></th></tr></thead><tbody>
      ${I.products.map(p => {
        const ps = co.products[p.id];
        const ref = p.price * S.macro.cpi;
        if (!ps.active) return `<tr><td><div class="name-cell"><b>${esc(p.name)}</b><span class="muted">list ${unitPrice(ref)}/mo</span></div></td><td colspan="7">${ps.unlocked ? `<span class="pill good">Ready to launch</span> <span class="small muted">launch cost ${f$((p.launch || 0) * S.macro.cpi)}</span>` : `<span class="pill">Locked</span> <span class="small muted">needs ${p.unlock} R&amp;D points</span>`}</td><td class="r">${ps.unlocked ? `<button class="btn sm primary" data-act="launch" data-id="${p.id}">Launch</button>` : ''}</td></tr>`;
        return `<tr><td><div class="name-cell"><b>${esc(p.name)}</b><span class="muted">market ${unitPrice(ref)}/mo</span></div></td>
          <td><input type="number" class="w-s" id="price-${p.id}" data-bind="price" data-id="${p.id}" step="${ps.price < 20 ? 0.5 : ps.price < 1000 ? 5 : 100}" min="0" value="${ps.price}" aria-label="Price for ${esc(p.name)}"></td>
          <td style="min-width:110px">${qMeter(p)}</td>
          <td class="r num">${fN(ps.customers || 0, 0)}</td><td class="r num pos">+${fN(ps.newCust || 0, 0)}</td><td class="r num">${pct(ps.churnRate || 0, 1)}</td>
          <td class="r num">${f$(ps.rev || 0)}</td><td class="r num">${ps.unitCost ? unitPrice(ps.unitCost) : '—'}</td><td class="r"><button class="btn sm ghost" data-act="priceRef" data-id="${p.id}">Match market</button></td></tr>`;
      }).join('')}</tbody></table>
      <p class="small muted" style="margin:10px 0 0">Churn rises when quality is low, support is understaffed, or you price above the market. Engineers (R&amp;D) raise quality; software decays fast without them.</p>`;
  }
  function ptProductTable() {
    const co = S.co, I = ind();
    return `<table class="t"><thead><tr><th>Stream</th><th class="r">Volume</th><th class="r">Realized price</th><th class="r">Revenue</th><th class="r">Royalties &amp; taxes</th><th>Engineering quality</th></tr></thead><tbody>
      ${I.products.map(p => { const ps = co.products[p.id]; const pr = ps.sold > 0 ? ps.rev / ps.sold : 0;
        return `<tr><td><div class="name-cell"><b>${esc(p.name)}</b><span class="muted">per ${esc(p.unit)}</span></div></td><td class="r num">${fN(ps.sold || 0)}</td><td class="r num">${pr ? unitPrice(pr) : '—'}</td><td class="r num">${f$(ps.rev || 0)}</td><td class="r num">${pct((p.royalty || 0) + (p.sevTax || 0))}</td><td style="min-width:120px">${qMeter(p)}</td></tr>`; }).join('')}
      </tbody></table><p class="small muted" style="margin:10px 0 0">${I.id === 'oilgas' ? 'Shale wells decline steeply: a new well loses roughly 60% of its output in year one. Keep drilling to hold production flat. Engineers raise initial production rates.' : 'Output depends on the site\'s sun or wind resource. Batteries earn capacity payments; gas peakers earn high prices but burn fuel.'}</p>`;
  }
  function facilitiesPanel() {
    const co = S.co, I = ind();
    if (!I.facilities.length) return `<section class="panel"><header><h3>Infrastructure</h3></header><div class="note">Software runs in the cloud. Compute is billed per customer on the Supply chain tab. Your constraint is people: engineers, support and sales.</div></section>`;
    const lc = GC.loanCapacity(S, co);
    const rows = co.facilities.map(f => {
      const fd = GC.facDef(co, f), c = GC.cityById[f.city];
      const capTxt = fd.cap ? `${fN(fd.cap)} units/mo` : fd.mw ? `${fd.mw} MW ${fd.tech}` : fd.out ? `${fN((fd.out.oil || 0) / (1 + fd.decline * f.age))} bbl, ${fN((fd.out.gas || 0) / (1 + fd.decline * f.age))} Mcf base` : '';
      const status = f.status === 'building' ? `<span class="pill warn">Building · ${f.left} mo left</span>` : `<span class="pill good">Operating</span>`;
      return `<tr><td><div class="name-cell"><b>${esc(fd.name)}</b><span class="muted">${esc(c.name)}${f.status === 'active' ? ' · age ' + f.age + ' mo' : ''}</span></div></td><td>${status}</td><td class="r num">${capTxt}</td><td class="r num">${f$(GC.facLease(S, co, f))}</td><td class="r num">${f$(f.status === 'active' ? f.book : f.paid)}</td>
        <td class="r">${confirmBtn('sell-' + f.uid, f.status === 'building' ? 'Cancel' : 'Sell', 'sellFac', 'danger', f.uid)}</td></tr>`;
    }).join('');
    const h = last();
    const util = h && h.capUtil ? `Capacity used last month: <b class="mono">${pct(h.capUtil)}</b>. ` : '';
    return `<section class="panel"><header><div><h2>Facilities</h2><p class="small muted">${util}Site costs are monthly lease plus fixed operating cost. Selling an operating site recovers about 55% of book value.</p></div></header>
      ${co.facilities.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Site</th><th>Status</th><th class="r">Capacity</th><th class="r">Monthly cost</th><th class="r">Book value</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No sites yet.</div>'}
      ${(co.assets || []).length ? `<p class="small muted">Other assets: ${co.assets.map(a => esc(a.label) + ' (' + f$(a.book) + ')').join(', ')}</p>` : ''}
      ${I.storable ? `<div class="note" style="margin-top:12px"><b>Where to make it.</b> Every site card lets you pick the city. Making it at home is simplest for local sales${city().id === 'honolulu' ? ', but shipping from Hawaii to the mainland costs about 60% more freight' : ''}. A plant in another state cuts freight to the rest of the country and may have cheaper labor and power. Overseas contract factories are cheapest per unit, but you pay tariffs and wait on ocean freight.${co.facilities.length ? ` <b>Freight cost index now</b>: ${co.regions.map((r, i) => `${esc(r.name)} ${GC.freightIndex(co)[i].toFixed(2)}×`).join(' · ')}.` : ''}</div>` : ''}
      <h3 style="margin:18px 0 10px">Build or contract more capacity</h3>
      <div class="cards">${I.facilities.map(fd => facilityCard(fd, lc)).join('')}</div>
    </section>`;
  }
  function facilityCard(fd, lc) {
    const co = S.co, I = ind();
    const sites = GC.buildSites(co, fd);
    const sel = U['site-' + fd.id] && sites.some(c => c.id === U['site-' + fd.id]) ? U['site-' + fd.id] : (sites.find(c => c.id === co.city) || sites.sort((a, b) => siteScore(fd, b) - siteScore(fd, a))[0] || {}).id;
    const c = GC.cityById[sel] || city();
    const capex = fd.capex * S.macro.cpi;
    const monthly = ((fd.noRent ? fd.lease : fd.lease * c.indRent / 12) + fd.fixed) * S.macro.cpi;
    const inst = capex / fd.build;
    let capTxt = fd.cap ? `${fN(fd.cap)} units/mo` : '';
    if (fd.mw) capTxt = `${fd.mw} MW`;
    if (fd.out) capTxt = `${fN((fd.out.oil || 0) * GC.resQ(c, fd.res))} bbl + ${fN((fd.out.gas || 0) * GC.resQ(c, fd.res))} Mcf first month`;
    let est = '';
    if (I.priceTaker) est = `<dt>Est. revenue</dt><dd>${f$(GC.estFacilityRevenue(S, co, fd, c, 0))}/mo</dd>`;
    const can = sites.length > 0 && co.cash >= inst;
    return `<div class="card"><h3>${esc(fd.name)}</h3>
      <dl class="facts"><dt>Capex</dt><dd>${f$(capex)}</dd><dt>Build time</dt><dd>${fd.build} mo</dd><dt>Capacity</dt><dd>${capTxt}</dd><dt>Monthly cost</dt><dd>${f$(monthly)}</dd>${fd.toll ? `<dt>Contract fee</dt><dd>${unitPrice(fd.toll * S.macro.cpi)}/unit</dd>` : ''}${fd.staffed ? `<dt>Staffing</dt><dd>${fd.crew != null ? fd.crew + ' FTE' : 'your crew'}</dd>` : '<dt>Staffing</dt><dd>included</dd>'}${fd.itc ? `<dt>Tax credit</dt><dd>${pct(fd.itc)}</dd>` : ''}${est}</dl>
      ${sites.length > 1 ? `<select id="site-${fd.id}" data-bind="site" data-id="${fd.id}" aria-label="Site for ${esc(fd.name)}">${sites.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}${siteHint(fd, x)}</option>`).join('')}</select>` : sites.length === 0 ? '<span class="small neg">No available site (land or resource limit).</span>' : ''}
      <div class="foot"><button class="btn sm primary" data-act="build" data-id="${fd.id}" data-site="${sel}" ${can ? '' : 'disabled'}>${fd.build > 1 ? `Start (${f$(inst)} now)` : `Sign (${f$(inst)})`}</button>
      ${co.cash < inst && lc.equipment > 0 ? '<span class="small muted">Short on cash? See equipment loans in Finance.</span>' : ''}</div></div>`;
  }
  function siteScore(fd, c) {
    if (fd.res) return GC.resQ(c, fd.res);
    if (fd.tech === 'solar') return c.solarCF * c.ppa;
    if (fd.tech === 'wind') return c.windCF * c.ppa;
    if (fd.tech) return c.ppa;
    return -c.elec - c.wage;
  }
  function siteHint(fd, c) {
    if (fd.res) return ` · rock ${pct(GC.resQ(c, fd.res))}`;
    if (fd.tech === 'solar') return ` · sun ${pct(c.solarCF)} · $${Math.round(GC.ppaPrice(S, c))}/MWh`;
    if (fd.tech === 'wind') return ` · wind ${pct(c.windCF)} · $${Math.round(GC.ppaPrice(S, c))}/MWh`;
    if (fd.tech) return ` · $${Math.round(GC.ppaPrice(S, c))}/MWh`;
    return ` · wages ${c.wage.toFixed(2)}× · ${(GC.elecPrice(S, c) * 100).toFixed(0)}¢/kWh`;
  }

  // ---------- Supply chain ----------
  function tabSupply() {
    const co = S.co, I = ind(), C = city();
    const all = Object.entries(co.mats);
    const activeBom = new Set(I.products.filter(p => co.products[p.id].active).flatMap(p => Object.keys(p.bom || {})));
    if (I.id === 'power' && co.facilities.some(f => GC.facDef(co, f).tech === 'gas')) activeBom.add('natgas');
    const inUse = ([c, m]) => activeBom.has(c) || m.usage > 0 || m.qty > 0.5 || m.orders.length;
    const mats = all.filter(inUse);
    const later = all.filter(x => !inUse(x)).map(([c]) => COMMODITIES[c].name.toLowerCase());
    if (!all.length) return `<section class="panel"><div class="empty">This business has no physical inputs.</div></section>`;
    const rows = mats.map(([c, m]) => {
      const cm = COMMODITIES[c];
      const hist = S.priceHist[c].slice(-12);
      const chg = hist.length > 1 ? S.prices[c] / hist[0] - 1 : 0;
      const opts = GC.supplierOptions(S, co, c);
      const t = GC.supplierTerms(S, co, c, m.sup);
      const onOrder = m.orders.reduce((a, o) => a + o.qty, 0);
      const cover = m.usage > 0 ? m.qty / m.usage : 0;
      const contract = m.contract && m.contract.until >= S.month;
      const stock = cm.stock !== false;
      const names = D.TIER_NAMES[c] || ['Budget grade', 'Standard grade', 'Premium grade'];
      const curTier = co.tier[c] || 'standard';
      const gradeSel = stock ? `<select id="tier-${c}" data-bind="tier" data-id="${c}" aria-label="Ingredient grade for ${esc(cm.name)}">${['budget', 'standard', 'elevated'].map((t, i) => `<option value="${t}" ${t === curTier ? 'selected' : ''}>${D.TIERS[t].name}: ${esc(names[i])} (${D.TIERS[t].mult === 1 ? 'list' : (D.TIERS[t].mult > 1 ? '+' : '') + pct(D.TIERS[t].mult - 1)})</option>`).join('')}</select>` : '<span class="small muted">—</span>';
      return `<tr>
        <td><div class="name-cell"><b>${esc(cm.name)}</b><span class="muted">per ${esc(cm.unit)}${co.farms[c] ? ' · <span class="pos">partner farm</span>' : ''}</span></div></td>
        <td>${gradeSel}</td>
        <td class="num">${unitPrice(S.prices[c])}<div class="small ${chg > 0.05 ? 'neg' : chg < -0.05 ? 'pos' : 'muted'}">${chg >= 0 ? '+' : ''}${pct(chg)} 12 mo</div></td>
        <td>${spark(hist)}</td>
        <td><select id="sup-${c}" data-bind="supplier" data-id="${c}" aria-label="Supplier for ${esc(cm.name)}">${opts.map(o => { const tt = GC.supplierTerms(S, co, c, o); return `<option value="${o}" ${o === m.sup ? 'selected' : ''}>${esc(tt.label)} · ${unitPrice(tt.price)}${stock ? ` · ${tt.lead} mo · ${pct(tt.rel)}` : ''}</option>`; }).join('')}</select>
          <div class="small muted" style="margin-top:3px">${esc(t.name)}${t.terms === 'prepay' ? ' · pay on order' : ' · net 30'}</div></td>
        <td class="r num">${fN(m.usage || 0)}</td>
        <td class="r">${stock ? `<input type="number" class="w-s" id="cover-${c}" data-bind="cover" data-id="${c}" step="0.25" min="0" max="12" value="${m.cover}" aria-label="Months of cover for ${esc(cm.name)}">` : '<span class="muted small">as used</span>'}</td>
        <td class="r num">${stock ? `${fN(m.qty)}<div class="small ${m.usage > 0 && cover < 0.5 ? 'neg' : 'muted'}">${m.usage > 0 ? cover.toFixed(1) + ' mo' : ''}</div>` : '—'}</td>
        <td class="r num">${stock ? (onOrder > 0 ? `${fN(onOrder)}<div class="small muted">ETA ${m.orders.map(o => MONTHS[GC.calMonth(o.eta)]).join(', ')}</div>` : '<span class="muted">—</span>') : '—'}</td>
        <td>${contract ? `<span class="pill acc">Locked ${unitPrice(m.contract.price)}</span><div class="small muted">until ${GC.monthLabel(m.contract.until)}</div>` : m.usage > 0 ? `<button class="btn sm" data-act="contract" data-id="${c}">Lock 12 mo @ ${unitPrice(t.price * 1.03)}</button>` : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="stack">
      <section class="panel"><header><div><h2>Inputs &amp; suppliers</h2><p class="small muted">Orders are placed automatically each month to keep your target months of cover, based on forecast production. Lead time, reliability and payment terms depend on the supplier.</p></div>
        <label class="toggle small"><input type="checkbox" id="emergency" data-bind="emergency" ${co.emergencyBuy ? 'checked' : ''}> Expedite shortfalls at a 40% premium</label></header>
        ${later.length ? `<p class="small muted" style="margin:0 0 8px">Products you have not launched yet will also need ${esc(later.join(', '))}.</p>` : ''}
        <div class="tbl-wrap"><table class="t"><thead><tr><th>Input</th><th>Grade</th><th>Market price</th><th>12 months</th><th>Supplier · price · lead · on-time</th><th class="r">Use / mo</th><th class="r">Target cover (mo)</th><th class="r">On hand</th><th class="r">On order</th><th>Fixed-price contract</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      ${farmPanel()}
      <div class="grid g3">
        <div class="note"><b>Local distributors</b> deliver the same month with almost no risk, at a markup. <b>Domestic producers</b> are list price with a one-month lead. <b>Overseas imports</b> are 20% cheaper before freight and tariffs, take two months, slip more often, and want cash up front.</div>
        <div class="note"><b>Perishables spoil.</b> ${Object.keys(co.mats).filter(c => COMMODITIES[c].spoil >= 0.3).map(c => COMMODITIES[c].name).join(', ') || 'None of your inputs are perishable'}${Object.keys(co.mats).some(c => COMMODITIES[c].spoil >= 0.3) ? ' lose a large share of any stock held over a month, so keep cover low and buy local.' : '.'} Shelf-stable inputs cost about 2% of their value per month to hold, in the cash they tie up.</div>
        <div class="note">${C.id === 'honolulu' ? `<b>Honolulu:</b> everything arrives by ship under the Jones Act. Mainland and overseas supplies cost about ${pct(C.inbound - 1)} more landed, and shipping finished goods to the mainland costs far more than shipping within the islands. A mainland plant can fix that.` : `<b>Tariffs</b> currently add ${pct(S.macro.tariff - 1)} to most imported inputs. Fixed-price contracts protect you from spikes, and cost you if prices fall.`}</div>
      </div>
    </div>`;
  }

  function farmPanel() {
    const co = S.co;
    const list = GC.farmInputs(co);
    if (!list.length) return '';
    const rows = list.map(c => {
      const cm = COMMODITIES[c], f = co.farms[c], m = co.mats[c];
      if (f) return `<tr><td><div class="name-cell"><b>${esc(f.name)}</b><span class="muted">${esc(cm.name)} since ${GC.monthLabel(f.since)}</span></div></td><td class="r num">${unitPrice(f.price * S.macro.cpi / f.cpi)}</td><td class="r num">${fN(f.cap)} ${esc(cm.unit)}/mo</td><td class="r num">${fN(m.usage || 0)}</td>
        <td class="r"><span class="row" style="justify-content:flex-end"><button class="btn sm" data-act="farmExpand" data-id="${c}">Help them expand</button>${confirmBtn('farm-' + c, 'End', 'farmEnd', 'ghost', c)}</span></td></tr>`;
      const d = GC.farmDeal(S, co, c);
      return `<tr><td><div class="name-cell"><b>Partner with a ${esc(d.name)}</b><span class="muted">${esc(cm.name)}${m.usage > 0 ? '' : ' · not used by your current products'}</span></div></td><td class="r num">${unitPrice(d.price)}</td><td class="r num">${fN(d.cap)} ${esc(cm.unit)}/mo</td><td class="r num">${fN(m.usage || 0)}</td>
        <td class="r"><button class="btn sm primary" data-act="farm" data-id="${c}" ${co.cash >= d.invest ? '' : 'disabled'}>Invest ${f$(d.invest)}</button></td></tr>`;
    }).join('');
    return `<section class="panel"><header><div><h2>Local farm &amp; producer partnerships</h2><p class="small muted">Invest in a nearby farm and it sells to you at a stable price, delivers almost every time, and lets you say "locally grown": +6 quality from that ingredient and about 5% more demand in your home markets. It can only grow so much; anything beyond its capacity comes from your usual supplier.</p></div></header>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Partner</th><th class="r">Price</th><th class="r">Can supply</th><th class="r">You use / mo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  // ---------- People ----------
  function tabPeople() {
    const co = S.co, I = ind();
    const rec = GC.recommendedStaff(S, co);
    const needGA = GC.gaNeed(co);
    const prod = GC.productivity(co);
    const notes = {
      ops: I.recurring ? 'Keeps the platform reliable: about one per $150K of monthly revenue.' : I.priceTaker ? 'Each operated asset needs a field crew.' : 'Staffed sites need crew hours for every unit made. Contract sites include labor.',
      sales: I.reach.mode === 'locations' ? 'Reach comes from your locations, so salespeople add little here.' : I.reach.mode === 'none' ? 'You sell into a commodity market; no sales team needed.' : `Each rep covers about ${fN(I.reach.perRep)} people of distribution. You count as ${1 + ((BACKGROUNDS.find(b => b.id === S.ceo.bg) || {}).salesBonus || 0)} in your home metro.`,
      rd: `10 R&D points a month each. Unlocks products and raises quality.`,
      support: I.recurring ? 'Too few and churn climbs.' : 'Optional for this business.',
      ga: `Finance, HR, legal. You need about one per 15 employees after the first 15 (${needGA} now).`
    };
    const recFor = { ops: rec.ops, support: rec.support, ga: rec.ga };
    const rows = GC.DEPTS.map(d => {
      const n = co.staff[d], sal = GC.salary(S, co, d);
      const r = recFor[d];
      return `<tr><td><div class="name-cell"><b>${esc(GC.deptName(co, d))}</b><span class="muted">${esc(notes[d])}</span></div></td>
        <td><span class="stepper"><button class="btn" data-act="staff" data-id="${d}" data-d="-1" aria-label="Remove one">−</button><input type="number" class="w-s" id="staff-${d}" data-bind="staff" data-id="${d}" min="0" step="1" value="${n}" aria-label="${esc(GC.deptName(co, d))} headcount"><button class="btn" data-act="staff" data-id="${d}" data-d="1" aria-label="Add one">+</button></span></td>
        <td class="r num">${f$(sal * 12)}</td><td class="r num">${f$(sal * n)}</td>
        <td class="r num">${r != null ? `<span class="${n < r ? 'warn' : n > r * 1.3 + 2 ? 'muted' : 'pos'}">${r}</span>` : '<span class="muted">your call</span>'}</td></tr>`;
    }).join('');
    const h = last();
    return `<div class="stack">
      <section class="panel"><header><div><h2>Headcount</h2><p class="small muted">Salaries are fully loaded (benefits and payroll taxes, ${esc(city().name)} pay levels). Hiring costs a recruiting fee; layoffs cost severance and hurt morale.</p></div><button class="btn" data-act="applyRec">Staff to recommended</button></header>
        <div class="tbl-wrap"><table class="t"><thead><tr><th>Team</th><th>Headcount</th><th class="r">Cost per head / yr</th><th class="r">Monthly cost</th><th class="r">Recommended</th></tr></thead><tbody>${rows}
          <tr class="total"><td>Total</td><td class="num">${GC.headcount(co)}</td><td></td><td class="r num">${f$(GC.payroll(S, co))}</td><td></td></tr></tbody></table></div>
      </section>
      <div class="grid g2">
        <section class="panel"><header><h3>Culture &amp; pay</h3></header>
          <div class="stack">
            <div><div class="small muted">Morale</div>${meter(co.morale / 100, co.morale < 40 ? 'bad' : co.morale < 55 ? 'warn' : '')}</div>
            <div class="row spread small"><span>Productivity</span><b class="mono">${pct(prod)}</b></div>
            <div class="row spread small"><span>Quit last month</span><b class="mono">${co.lastQuits || 0}</b></div>
            ${h && h.opsUtil > 0.97 ? '<div class="note">Your crew is running flat out. Overwork is dragging morale down.</div>' : ''}
            <label class="row spread small" for="pay">Pay vs. market
              <select id="pay" data-bind="pay">${[[0.9, '90%: save money, lose people'], [1, '100%: market rate'], [1.1, '110%: retain talent'], [1.25, '125%: best place to work']].map(([v, l]) => `<option value="${v}" ${co.payPolicy === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="toggle small"><input type="checkbox" id="backfill" data-bind="backfill" ${co.autoBackfill ? 'checked' : ''}> Automatically backfill people who quit (recruiting fees apply)</label>
          </div></section>
        <section class="panel"><header><h3>Your compensation</h3></header>
          <div class="stack">
            <label class="field" for="ceoSal"><span class="small">Your salary (per year)</span><input type="number" id="ceoSal" data-bind="ceoSalary" step="10000" min="0" value="${S.ceo.salary}"></label>
            <div class="small muted">Paid by the company and taxed at about 32%. Your personal living costs are ${f$(GC.ceoLiving(S))}/month; your savings are ${f$(S.ceo.cash)}.${co.board.seats > 0 ? ' Investors watch CEO pay.' : ''}</div>
          </div></section>
      </div>
    </div>`;
  }

  // ---------- Markets ----------
  function tabMarkets() {
    const co = S.co, I = ind();
    return `<div class="stack">${marketingPlan()}${regionsPanel()}${I.reach.channels ? accountsPanel() + ownRetailPanel() : ''}${competitionPanel()}</div>`;
  }
  function marketingPlan() {
    const co = S.co, I = ind();
    const chans = GC.channelsFor(co);
    const reached = co.regions.filter(r => r.unlocked).reduce((a, r) => a + Math.max(20000, r.pop * Math.max(r.reach, 0.02)), 0);
    const satS = (ch) => ch.sat * (3000 + 0.003 * reached);
    const presets = Object.entries(D.MKT_PRESETS).filter(([k]) => I.b2b ? k === 'b2b' || k === 'national' || k === 'retail' : k !== 'b2b' && (k !== 'tourist' || city().tourism >= 0.3));
    return `<section class="panel"><header><div><h2>Marketing plan</h2><p class="small muted">Split your budget across channels. Each channel gets less effective the more you pour into it, so a mix beats one big bet. TV only works above about $40K a month.</p></div>
      <div class="row"><span class="small muted">Total</span><b class="mono">${f$(co.marketing)}/mo</b></div></header>
      <div class="row small" style="margin-bottom:12px"><span class="muted">Start from a plan:</span>${presets.map(([k, pr]) => `<button class="btn sm" data-act="preset" data-id="${k}">${esc(pr.name)}</button>`).join('')}<input type="number" class="w-s" id="presetTotal" data-bind="presetTotal" step="1000" min="0" value="${Math.round(U.presetTotal != null ? U.presetTotal : co.marketing)}" aria-label="Total budget for the plan"><span class="muted">per month</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Channel</th><th>Budget / month</th><th>Saturation</th></tr></thead><tbody>
      ${chans.map(ch => { const b = co.mkt[ch.id] || 0; const sat = 1 - Math.exp(-b / satS(ch)); const weak = ch.min && b > 0 && b < ch.min;
        return `<tr><td><div class="name-cell"><b>${esc(I.b2b && ch.b2bName ? ch.b2bName : ch.name)}</b><span class="muted">${esc(ch.blurb)}${ch.regions ? ' Home and state markets only.' : ''}</span></div></td>
          <td><input type="number" class="w-s" id="mkt-${ch.id}" data-bind="mkt" data-id="${ch.id}" step="500" min="0" value="${Math.round(b)}" aria-label="${esc(ch.name)} budget"></td>
          <td style="min-width:130px">${b > 0 ? meter(sat, sat > 0.7 ? 'warn' : '') : '<span class="small muted">off</span>'}${weak ? '<div class="small warn">Below the level where TV pays off</div>' : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin:10px 0 0">High saturation means extra dollars in that channel buy little. Sampling and trade shows also raise your odds of landing retail accounts; PR makes products seem higher quality; search ads lift conversion.</p>
    </section>`;
  }
  function regionsPanel() {
    const co = S.co, I = ind();
    const label = ['Sell locally', 'Sell statewide / regionally', 'Sell nationwide', 'Sell internationally'];
    const compName = { reps: 'sales team & independent stores', web: 'online store', stores: 'your stores' };
    const rows = co.regions.map((r, i) => {
      const cost = (I.regionCost[i] || 0) * S.macro.cpi;
      const canUnlock = !r.unlocked && (i === 0 || co.regions[i - 1].unlocked);
      const comp = r.chan && r.chan.comp ? Object.entries(r.chan.comp).filter(([, v]) => v > 0.002).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.startsWith('a:') ? esc((D.ACCOUNTS.find(a => 'a:' + a.id === k) || {}).name || k) : compName[k]} ${pct(v)}`).join(' · ') : '';
      return `<tr><td><div class="name-cell"><span class="eyebrow">${label[i]}</span><b>${esc(r.name)}</b><span class="muted">${fN(r.pop)} people</span></div></td>
        <td>${r.unlocked ? '<span class="pill good">Selling</span>' : '<span class="pill">Not entered</span>'}</td>
        <td style="min-width:120px">${r.unlocked ? meter(r.aw) : '—'}</td><td style="min-width:120px">${r.unlocked ? meter(r.reach) : '—'}${I.reach.channels && comp ? `<div class="small muted" style="margin-top:3px">${comp}</div>` : ''}</td>
        <td>${!r.unlocked ? `<div class="small muted">${esc(I.regionNote[i] || '')}</div>${canUnlock ? `<button class="btn sm primary" style="margin-top:4px" data-act="unlock" data-id="${i}" ${co.cash >= cost ? '' : 'disabled'}>Enter for ${f$(cost)}</button>` : '<span class="small muted">Enter the previous market first</span>'}` : (i >= 2 && co.city === 'honolulu' && I.freightShare ? '<span class="small muted">Jones Act freight on every unit you ship from Hawaii. A mainland plant avoids it.</span>' : '')}</td></tr>`;
    }).join('');
    return `<section class="panel"><header><div><h2>Where you sell</h2><p class="small muted"><b>Awareness</b>: how many people in reach know you. <b>Reach</b>: where customers can actually buy you${I.reach.channels ? ', built from the retail accounts you win, your own shops, your online store and your sales team' : I.reach.mode === 'locations' ? ', which comes from your locations' : ', built by your sales team'}.</p></div></header>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Market</th><th>Status</th><th>Awareness</th><th>Reach</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function accountsPanel() {
    const co = S.co, I = ind();
    const hnl = co.city === 'honolulu';
    const accs = GC.accountsFor(co);
    const groups = [0, 1, 2, 3].map(i => [i, accs.filter(a => a.region === i)]).filter(([, l]) => l.length);
    const row = (a) => {
      const on = !!co.accounts[a.id];
      const r = co.regions[a.region];
      const cool = (co.acctCool[a.id] || 0) > S.month;
      const odds = GC.pitchOdds(S, co, a);
      const slot = a.slot * S.macro.cpi;
      let action;
      if (on) action = `<span class="pill good">Carried</span> ${confirmBtn('drop-' + a.id, 'Drop', 'dropAcct', 'ghost', a.id)}`;
      else if (!r.unlocked) action = '<span class="small muted">Enter this market first</span>';
      else if (cool) action = `<span class="small muted">Buyer busy until ${GC.monthLabel(co.acctCool[a.id])}</span>`;
      else if (odds <= 0) action = `<span class="small warn">Needs quality ${a.minQ}+</span>`;
      else action = `<button class="btn sm primary"  data-act="pitchAcct" data-id="${a.id}" ${co.cash >= slot ? '' : 'disabled'}>Pitch · ${pct(odds)} odds</button>`;
      return `<tr><td><div class="name-cell"><b>${esc(hnl && a.hnl ? a.hnl : a.name)}</b><span class="muted">${a.note ? esc(a.note) : `Puts you in front of about ${pct(a.cover * (a.tour && hnl ? 1.8 : 1))} of the market${a.tour ? ', more in tourist season' : ''}.`}</span></div></td>
        <td class="r num">${pct(a.mult)}</td><td class="r num">${slot ? f$(slot) : '—'}</td><td class="r num">${a.fee ? f$(a.fee * S.macro.cpi) : '—'}</td><td class="r num">${a.minQ || '—'}</td><td class="r num">${a.lag ? (a.lag >= 1 ? 'net 60' : 'net 45') : 'net 30'}</td><td class="r">${action}</td></tr>`;
    };
    const label = ['Local', 'Statewide', 'Nationwide', 'International'];
    const bestQ = Math.max(0, ...I.products.filter(p => S.co.products[p.id].active).map(p => GC.qEff(co, p)));
    return `<section class="panel"><header><div><h2>Retail accounts &amp; partners</h2><p class="small muted">Pitch hotels, shops and chains to carry your products. Odds rise with your quality (best product: <b class="mono">${Math.round(bestQ)}</b>), local awareness, your sales team, and sampling or trade-show spend. "Price you get" is what they pay you as a share of your list price.</p></div></header>
      ${U.pitchMsg ? `<div class="note" style="margin-bottom:10px">${esc(U.pitchMsg)}</div>` : ''}
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Account</th><th class="r">Price you get</th><th class="r">Slotting</th><th class="r">Monthly</th><th class="r">Min. quality</th><th class="r">Pays</th><th></th></tr></thead><tbody>
      ${groups.map(([i, l]) => `<tr class="sub"><td colspan="7" class="eyebrow" style="padding-left:8px">${label[i]}${co.regions[i].unlocked ? '' : ' · not entered'}</td></tr>` + l.map(row).join('')).join('')}
      </tbody></table></div></section>`;
  }
  function ownRetailPanel() {
    const co = S.co;
    const C = city();
    const regionOpts = co.regions.map((r, i) => r.unlocked ? `<option value="${i}" ${(+U.storeRegion || 0) === i ? 'selected' : ''}>${esc(r.name)}</option>` : '').join('');
    const rentF = C.officeRent / 40;
    const open = co.stores.map((x, i) => { const sd = D.STOREFRONTS.find(y => y.id === x.type); return `<tr><td>${esc(sd.name)}</td><td>${esc(co.regions[x.region].name)}</td><td class="r num">${f$(sd.monthly * rentF * S.macro.cpi)}</td><td>${x.until != null ? `<span class="pill warn">Ends ${GC.monthLabel(x.until)}</span>` : `<span class="small muted">since ${GC.monthLabel(x.opened)}</span>`}</td><td class="r">${confirmBtn('close-' + i, 'Close', 'closeStore', 'danger', i)}</td></tr>`; }).join('');
    return `<section class="panel"><header><div><h2>Your own shops &amp; online store</h2><p class="small muted">Sell direct at full retail price, about twice what a retailer pays you, but you carry the rent, staff and shipping. Pop-ups let you test a spot for a season. Rents follow ${esc(C.name)} prices.</p></div></header>
      <div class="row spread" style="margin-bottom:12px"><div class="small"><b>Online store</b><div class="muted">Sells to everyone in markets you've entered who knows your brand. Pick, pack and shipping take about ${pct(D.WEBSTORE.varAdd)} of the retail price${C.id === 'honolulu' ? ' (more for shipping to the mainland)' : ''}.</div></div>
        ${co.web ? `<span class="row"><span class="pill good">Live</span>${confirmBtn('web', 'Shut down', 'web', 'ghost')}</span>` : `<button class="btn primary sm" data-act="web">Launch for ${f$(D.WEBSTORE.setup * S.macro.cpi)} + ${f$(D.WEBSTORE.monthly)}/mo</button>`}</div>
      <div class="row small" style="margin-bottom:8px"><label for="storeRegion" class="muted">Open in</label><select id="storeRegion" data-bind="storeRegion">${regionOpts}</select></div>
      <div class="cards">${D.STOREFRONTS.map(sd => { const c = sd.capex * rentF * S.macro.cpi; return `<div class="card"><h3>${esc(sd.name)}</h3><div class="small muted">${esc(sd.blurb)}</div>
        <dl class="facts"><dt>Build-out</dt><dd>${f$(c)}</dd><dt>Rent + staff</dt><dd>${f$(sd.monthly * rentF * S.macro.cpi)}/mo</dd><dt>Serves</dt><dd>${fN(sd.cover)} people</dd>${sd.months ? `<dt>Runs</dt><dd>${sd.months} months</dd>` : ''}</dl>
        <div class="foot"><button class="btn sm primary" data-act="openStore" data-id="${sd.id}" ${co.cash >= c ? '' : 'disabled'}>${sd.months ? 'Book it' : 'Open'}</button></div></div>`; }).join('')}</div>
      ${open ? `<div class="tbl-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Open now</th><th>Market</th><th class="r">Monthly</th><th></th><th></th></tr></thead><tbody>${open}</tbody></table></div>` : ''}
    </section>`;
  }
  function competitionPanel() {
    const co = S.co, I = ind();
    const ms = I.products.filter(p => co.products[p.id].active).reduce((a, p) => a + GC.marketSize(S, co, p), 0);
    const rev = last() ? last().rev : 0;
    return `<div class="grid g2">
        <section class="panel"><header><h3>Competitive landscape</h3><span class="small muted">in the markets you sell in</span></header>
          <div class="row spread small"><span>Addressable market</span><b class="mono">${f$(ms)}/mo</b></div>
          <div class="row spread small" style="margin-top:4px"><span>Your share</span><b class="mono">${ms > 0 ? pct(rev / ms, 2) : '—'}</b></div>
          <div style="margin-top:10px">${I.competitors.map(c => `<span class="pill" style="margin:0 6px 6px 0">${esc(c)}</span>`).join('')}</div>
          ${(co.fx || []).some(x => x.k === 'compPrice') ? '<div class="note" style="margin-top:8px">A price war is under way: customers are comparing you with cheaper rivals.</div>' : ''}
        </section>
        <section class="panel"><header><h3>Seasonality</h3><span class="small muted">demand index by month</span></header>${barChart(I.season.map(x => x * 100), MONTHS.map(x => x + ' index'), { h: 120, label: 'Seasonal demand index' })}</section>
      </div>`;
  }
  function tabPrices() {
    const co = S.co, I = ind();
    const rows = CITIES.map(c => {
      if (I.id === 'oilgas') return [c, c.oil, c.gas, GC.resQ(c, 'offshore')];
      return [c, GC.ppaPrice(S, c), c.solarCF, c.windCF, GC.capPrice(S, c)];
    });
    const crude = S.priceHist.crude.slice(-24), gas = S.priceHist.natgas.slice(-24);
    return `<div class="stack">
      <div class="grid g2">
        <section class="panel"><header><h3>WTI crude</h3><span class="mono">$${S.prices.crude.toFixed(2)}/bbl</span></header>${lineChart(crude, crude.map((_, i) => GC.monthLabel(S.month - crude.length + i)), { h: 130, label: 'Crude price' })}</section>
        <section class="panel"><header><h3>Henry Hub natural gas</h3><span class="mono">$${S.prices.natgas.toFixed(2)}/MMBtu</span></header>${lineChart(gas, gas.map((_, i) => GC.monthLabel(S.month - gas.length + i)), { h: 130, label: 'Gas price' })}</section>
      </div>
      <section class="panel"><header><div><h2>${I.id === 'oilgas' ? 'Basins' : 'Power markets'}</h2><p class="small muted">${I.id === 'oilgas' ? 'Rock quality scales how much a well produces. You can drill anywhere there is a basin, wherever your HQ is.' : 'You can build projects in any city. Revenue is output times the local power price.'}</p></div></header>
        <div class="tbl-wrap"><table class="t"><thead><tr><th>Location</th>${I.id === 'oilgas' ? '<th>Oil rock</th><th>Gas rock</th><th>Offshore access</th>' : '<th class="r">Power price</th><th>Solar CF</th><th>Wind CF</th><th class="r">Capacity / MW-mo</th>'}</tr></thead><tbody>
        ${rows.filter(r => I.id !== 'oilgas' || r[1] > 0 || r[2] > 0 || r[3] > 0).map(r => I.id === 'oilgas' ? `<tr><td>${esc(r[0].name)}</td><td>${r[1] ? meter(r[1]) : '—'}</td><td>${r[2] ? meter(r[2]) : '—'}</td><td>${r[3] ? '<span class="pill good">Gulf of Mexico</span>' : '—'}</td></tr>` : `<tr><td>${esc(r[0].name)}</td><td class="r num">$${r[1].toFixed(0)}/MWh</td><td>${meter(r[2])}</td><td>${meter(r[3])}</td><td class="r num">${f$(r[4])}</td></tr>`).join('')}
        </tbody></table></div></section>
    </div>`;
  }

  // ---------- Finance ----------
  function plRows(cols) {
    const sum = (H, k) => H.reduce((a, x) => a + (x[k] || 0), 0);
    const L = [
      ['Revenue', 'rev', 'em'],
      ['Materials & inputs', 'cogsMat', 'sub', -1], ['Contract manufacturing', 'cogsToll', 'sub', -1], ['Direct labor', 'cogsLabor', 'sub', -1], ['Sites & leases', 'cogsSite', 'sub', -1], ['Energy', 'cogsEnergy', 'sub', -1], ['Freight & variable', 'cogsVar', 'sub', -1], ['Fuel', 'cogsFuel', 'sub', -1], ['Royalties & severance tax', 'cogsRoy', 'sub', -1], ['Spoilage', 'cogsSpoil', 'sub', -1],
      ['Gross profit', 'gp', 'total'],
      ['Salaries (non-production)', 'opPay', 'sub', -1], ['Marketing', 'opMkt', 'sub', -1], ['Retail accounts, shops & online store', 'opChan', 'sub', -1], ['Office rent', 'opOffice', 'sub', -1], ['G&A, insurance, market upkeep', 'opGA', 'sub', -1], ['Gross-receipts taxes', 'opGRT', 'sub', -1], ['One-time (hiring, launches, slotting, events)', 'opOne', 'sub', -1],
      ['EBITDA', 'ebitda', 'total'], ['Depreciation', 'dep', 'sub', -1], ['Interest', 'interest', 'sub', -1], ['Other income', 'otherInc', 'sub', 1], ['Pre-tax income', 'ebt', 'em'], ['Income tax', 'tax', 'sub', -1], ['Net income', 'ni', 'total']
    ];
    return L.filter(([, k, cls]) => cls !== 'sub' || cols.some(H => Math.abs(sum(H, k)) > 0.5)).map(([n, k, cls, sg]) => `<tr class="${cls}"><td>${n}</td>${cols.map(H => { const v = sum(H, k) * (sg || 1); return `<td class="r num ${cls === 'total' && v < 0 ? 'neg' : ''}">${H.length ? f$(v) : '—'}</td>`; }).join('')}</tr>`).join('');
  }
  function tabFinance() {
    const co = S.co, I = ind();
    const H = co.hist;
    const b = GC.balance(S, co);
    const m = GC.metrics(co);
    const val = co.valuation || GC.valuation(S, co);
    const years = [...new Set(H.map(x => GC.START_YEAR + Math.floor(x.m / 12)))].slice(-3);
    const cols = [H.slice(-1), H.slice(-3), H.slice(-12), ...years.map(y => H.filter(x => GC.START_YEAR + Math.floor(x.m / 12) === y))];
    const colNames = ['Last month', 'Last 3 mo', 'Last 12 mo', ...years.map(y => 'FY' + y)];
    const lc = GC.loanCapacity(S, co);
    const loanRows = co.loans.map(l => {
      const rate = l.floating ? GC.prime(S) + l.spread : l.rate;
      return `<tr><td><div class="name-cell"><b>${esc(l.name)}</b><span class="muted">${l.kind === 'revolver' ? 'interest only, repay anytime' : l.io ? `bullet, ${l.left} mo to maturity` : `${l.left} mo left`}</span></div></td><td class="r num">${f$(l.bal)}</td><td class="r num">${rate.toFixed(2)}%${l.floating ? ' fl' : ''}</td>
        <td class="r"><span class="row" style="justify-content:flex-end"><input type="number" class="w-s" id="repay-${l.id}" data-bind="repayAmt" data-id="${l.id}" step="10000" min="0" value="${Math.floor((U['repay-' + l.id] || Math.min(l.bal, Math.max(0, co.cash))) / 1000) * 1000}" aria-label="Repay amount"><button class="btn sm" data-act="repay" data-id="${l.id}">Repay</button></span></td></tr>`;
    }).join('');
    const offers = [
      ['sba', 'SBA 7(a) loan', 'Small businesses only, once. 10-yr amortizing.'],
      ['revolver', 'Revolving credit line', 'Borrowing base: 80% of receivables + 50% of inventory.'],
      ['equipment', 'Equipment / project loan', '65% of plant and equipment value. 10-yr.'],
      ['term', 'Bank term loan', 'Up to 3× trailing EBITDA. 5-yr.'],
      ['venture', 'Venture debt', 'For VC-backed companies. 3-yr.'],
      ['bond', 'Senior notes (bonds)', '$250M+ revenue. 7-yr bullet.']
    ].map(([k, n, d]) => {
      const capk = lc[k] || 0;
      const t = GC.loanRate(S, co, k);
      const rate = t.floating ? GC.prime(S) + t.spread : t.rate;
      return `<tr><td><div class="name-cell"><b>${n}</b><span class="muted">${d}</span></div></td><td class="r num">${capk > 0 ? f$(capk) : '<span class="muted">not available</span>'}</td><td class="r num">${rate.toFixed(2)}%</td>
        <td class="r">${capk > 0 ? `<span class="row" style="justify-content:flex-end"><input type="number" class="w-s" id="borrow-${k}" data-bind="borrowAmt" data-id="${k}" step="10000" min="0" value="${Math.floor(Math.min(capk, U['borrow-' + k] || capk) / 1000) * 1000}" aria-label="Borrow amount"><button class="btn sm primary" data-act="borrow" data-id="${k}">Borrow</button></span>` : ''}</td></tr>`;
    }).join('');
    const inv = co.shares.investors;
    const capTable = `<tr><td>${esc(S.ceo.name)} (you)</td><td class="r num">${pct(co.shares.ceo / co.shares.total, 1)}</td><td class="r num">${f$(co.shares.ceo / co.shares.total * val.equity)}</td></tr>` + inv.map(x => `<tr><td>${esc(x.name)} <span class="muted small">${esc(x.round)}</span></td><td class="r num">${pct(x.shares / co.shares.total, 1)}</td><td class="r num">${f$(x.shares / co.shares.total * val.equity)}</td></tr>`).join('');
    const rounds = GC.availableRounds(S, co);
    const ts = co.termSheet;
    const roundSel = U.round && rounds.some(r => r.r.id === U.round) ? U.round : (rounds.filter(r => r.ok).slice(-1)[0] || rounds[0] || { r: {} }).r.id;
    const R = rounds.find(r => r.r.id === roundSel);
    const amt = R ? Math.min(R.r.max, Math.max(R.r.min, U.raiseAmt || R.r.min)) : 0;
    return `<div class="stack">
      ${cashPanel()}
      <section class="panel"><header><div><h2>Income statement</h2><p class="small muted">Negative figures in parentheses. Inventory costs hit the P&amp;L when goods are sold, not when bought.</p></div></header>
        ${H.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th></th>${colNames.map(n => `<th class="r">${n}</th>`).join('')}</tr></thead><tbody>${plRows(cols)}</tbody></table></div>` : '<div class="empty">Close a month to see your first P&amp;L.</div>'}
      </section>
      <div class="grid g2">
        <section class="panel"><header><div><h3>Balance sheet</h3><p class="small muted">A snapshot of what the company owns and owes today. It shows where money is sitting, not where it went (that is the cash panel above).</p></div></header><table class="t"><tbody>
          <tr class="sub"><td colspan="2" class="eyebrow" style="padding-left:8px">What you own</td></tr>
          ${[['Cash in the bank', b.cash, ''], ['Money customers owe you', b.ar, 'Receivables: sales you made but have not collected'], ['Inventory', b.inv, 'Materials on hand and products waiting to sell'], ['Equipment & buildings', b.ppe, 'Sites you built, minus depreciation'], ['Under construction', b.cip, 'Installments paid on sites not finished yet']].map(([n, v, hint]) => `<tr><td><div class="name-cell"><span>${n}</span>${hint ? `<span class="muted">${hint}</span>` : ''}</div></td><td class="r num ${v < 0 ? 'neg' : ''}">${f$(v)}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td class="r num">${f$(b.assets)}</td></tr>
          <tr class="sub"><td colspan="2" class="eyebrow" style="padding-left:8px">What you owe</td></tr>
          <tr><td><div class="name-cell"><span>Bills due to suppliers</span><span class="muted">Payables: invoices you will pay next month</span></div></td><td class="r num">${f$(b.ap)}</td></tr>
          <tr><td>Loans</td><td class="r num">${f$(b.debt)}</td></tr>
          <tr class="total"><td><div class="name-cell"><span>Owners' equity (on paper)</span><span class="muted">What is left for shareholders after debts</span></div></td><td class="r num ${b.equity < 0 ? 'neg' : ''}">${f$(b.equity)}</td></tr>
          <tr><td><div class="name-cell"><span>Past losses you can deduct</span><span class="muted">Lowers future income tax</span></div></td><td class="r num muted">${f$(co.nol)}</td></tr>
        </tbody></table></section>
        <section class="panel"><header><h3>Valuation</h3><span class="small muted">what investors would pay today</span></header><table class="t"><tbody>
          <tr><td>Revenue run-rate</td><td class="r num">${f$(m.runRate)}</td></tr>
          <tr><td>EBITDA run-rate</td><td class="r num ${signCls(m.ebitdaRun)}">${f$(m.ebitdaRun)}</td></tr>
          <tr><td>Quarter-over-quarter growth</td><td class="r num ${signCls(m.qGrowth)}">${pct(m.qGrowth, 1)}</td></tr>
          <tr><td>Enterprise value</td><td class="r num">${f$(val.ev)}</td></tr>
          <tr class="total"><td>Equity value</td><td class="r num">${f$(val.equity)}</td></tr>
          ${co.public ? `<tr><td>Share price</td><td class="r num">$${co.sharePrice.toFixed(2)}</td></tr><tr><td>Market cap</td><td class="r num">${f$(co.sharePrice * co.shares.total)}</td></tr>` : ''}
          <tr><td>Market mood (rates, cycle)</td><td class="r num">${(val.mood).toFixed(2)}×</td></tr>
          ${co.board.seats > 0 || co.public ? `<tr><td>Board confidence</td><td class="r" style="min-width:140px">${meter(co.board.conf / 100, co.board.conf < 25 ? 'bad' : co.board.conf < 45 ? 'warn' : '')}</td></tr><tr><td>Board expects quarterly growth of</td><td class="r num">${pct(co.board.expect, 0)}</td></tr>` : '<tr><td>Board</td><td class="r small muted">You control the company</td></tr>'}
        </tbody></table></section>
      </div>
      <section class="panel"><header><div><h2>Debt</h2><p class="small muted">Prime rate is ${GC.prime(S).toFixed(2)}%. If cash goes negative the revolver is drawn automatically; beyond that, you are in a cash crisis.</p></div></header>
        ${co.loans.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Outstanding</th><th class="r">Balance</th><th class="r">Rate</th><th></th></tr></thead><tbody>${loanRows}</tbody></table></div>` : ''}
        <div class="tbl-wrap" style="margin-top:8px"><table class="t"><thead><tr><th>Borrow</th><th class="r">Available</th><th class="r">Rate</th><th></th></tr></thead><tbody>${offers}</tbody></table></div>
      </section>
      <section class="panel"><header><div><h2>Equity</h2><p class="small muted">Selling shares brings cash and partners, and dilutes you. Below 50% ownership, a board that loses confidence can replace you.</p></div></header>
        <div class="grid g2">
          <div><table class="t"><thead><tr><th>Cap table</th><th class="r">Owns</th><th class="r">Worth</th></tr></thead><tbody>${capTable}</tbody></table></div>
          <div class="stack">
            ${ts ? `<div class="termsheet"><div class="eyebrow">Term sheet · expires end of ${MONTHS[GC.calMonth(ts.expires)]}</div><h3 style="margin-top:4px">${esc(ts.investor)}</h3>
              <dl><dt>Round</dt><dd>${esc(ts.name)}</dd><dt>Investment</dt><dd>${f$(ts.amount)}</dd><dt>Pre-money valuation</dt><dd>${f$(ts.pre)}</dd><dt>Post-money</dt><dd>${f$(ts.post)}</dd><dt>Dilution</dt><dd>${pct(ts.dil, 1)}</dd><dt>Board seats</dt><dd>${ts.board}</dd><dt>Fees</dt><dd>${ts.round === 'ipo' ? '7% underwriting' : '1% legal'}</dd></dl>
              <div class="row"><button class="btn primary" data-act="acceptTS">Sign</button><button class="btn" data-act="declineTS">Walk away</button></div></div>`
              : co.public ? `<div class="note">You are public. Raise more with a follow-on offering through bankers, or return cash.</div><div class="row"><input type="number" id="buybackAmt" data-bind="buybackAmt" step="1000000" min="0" value="${Math.round(U.buybackAmt || co.cash * 0.1)}" aria-label="Buyback amount"><button class="btn" data-act="buyback">Buy back stock</button></div>`
              : `<label class="field" for="roundSel"><span class="small">Round</span><select id="roundSel" data-bind="round">${rounds.map(r => `<option value="${r.r.id}" ${r.r.id === roundSel ? 'selected' : ''}>${esc(r.r.name)}${r.ok ? '' : ' (not eligible yet)'}</option>`).join('')}</select></label>
                ${R ? `<div class="small muted">${roundReq(R.r.id)}</div>
                <label class="field" for="raiseAmt"><span class="small">Amount to raise</span><div class="slider-row"><input type="range" id="raiseAmt" data-bind="raiseAmt" min="${R.r.min}" max="${R.r.max}" step="${R.r.min}" value="${amt}"><span class="num">${f$(amt)}</span></div></label>
                <div class="row"><button class="btn primary" data-act="pitch" ${R.ok && co.cooldown === 0 ? '' : 'disabled'}>Pitch investors</button>${co.cooldown > 0 ? `<span class="small muted">Investors will take meetings again in ${co.cooldown} mo.</span>` : ''}</div>` : ''}`}
            ${U.flash ? `<div class="note">${esc(U.flash)}</div>` : ''}
          </div>
        </div>
      </section>
    </div>`;
  }
  // ---------- Cash flow in plain language ----------
  const OUT_NAMES = {
    payroll: ['Payroll', 'Salaries and benefits for everyone, including you'],
    suppliers: ['Paying suppliers', 'Ingredients and materials (net-30 bills from last month, prepaid imports, rush orders)'],
    contract: ['Contract manufacturing', 'Fees to co-packers and contract factories for each unit they make'],
    sites: ['Sites & leases', 'Rent and running costs for plants, kitchens, trucks, aircraft and wells'],
    energy: ['Electricity', 'Power for your own production sites'],
    freight: ['Freight, fees & royalties', 'Shipping, broker and card fees, trade spend, royalties'],
    marketing: ['Marketing', 'Your marketing plan'],
    channels: ['Retail accounts & your shops', 'Account fees, store rent and staff, online store'],
    overhead: ['Office, insurance & taxes', 'Office rent, insurance, software, gross-receipts taxes'],
    oneTime: ['One-time costs', 'Hiring fees, severance, launches, slotting fees, market entry, events'],
    capex: ['Construction & equipment', 'Installments on sites you are building'],
    interest: ['Interest', 'Interest on your loans'],
    principal: ['Loan repayments', 'Paying down what you borrowed'],
    tax: ['Income tax', 'Federal and state income tax']
  };
  const IN_NAMES = { customers: ['Customers paid you', 'Cash collected from sales (some customers pay a month or two later)'], financing: ['Loans & investors', 'New borrowing and money raised'], other: ['Other', 'Grants, subsidies, sold assets'] };
  function cashBars(h) {
    const cf = h.cf;
    const rows = [...Object.entries(cf.ins).map(([k, v]) => ['in', k, v]), ...Object.entries(cf.outs).map(([k, v]) => ['out', k, v])].filter(r => Math.abs(r[2]) >= 1);
    const max = Math.max(1, ...rows.map(r => Math.abs(r[2])));
    rows.sort((a, b) => (a[0] === b[0] ? Math.abs(b[2]) - Math.abs(a[2]) : a[0] === 'in' ? -1 : 1));
    return `<table class="t cash"><tbody>${rows.map(([dir, k, v]) => { const n = (dir === 'in' ? IN_NAMES : OUT_NAMES)[k];
      return `<tr><td><div class="name-cell"><b>${n[0]}</b><span class="muted">${n[1]}</span></div></td><td style="width:38%"><div class="cashbar ${dir}"><i style="width:${(Math.abs(v) / max * 100).toFixed(1)}%"></i></div></td><td class="r num ${dir === 'in' ? 'pos' : ''}">${dir === 'in' ? '+' : '−'}${f$(Math.abs(v))}</td></tr>`; }).join('')}
      ${Math.abs(cf.other) > 1 ? `<tr><td class="muted">Other adjustments</td><td></td><td class="r num">${f$(cf.other)}</td></tr>` : ''}
      <tr class="total"><td>Change in cash</td><td></td><td class="r num ${signCls(cf.end - cf.start)}">${cf.end - cf.start >= 0 ? '+' : ''}${f$(cf.end - cf.start)}</td></tr></tbody></table>`;
  }
  function bridge(h, p0) {
    const cf = h.cf;
    const prevAr = p0 ? p0.ar : 0, prevInv = p0 ? p0.inv : 0, prevAp = p0 ? p0.ap : 0;
    const items = [
      ['Net income (profit or loss)', h.ni, 'What the P&L says you earned.'],
      ['Depreciation & write-downs', h.dep + Math.max(0, h.opOne - (cf.outs.oneTime || 0)), 'Costs on the P&L that are not cash this month.'],
      ['Customers who have not paid yet', -(h.ar - prevAr), 'Retail chains pay 30–60 days later. Growth ties up cash here.'],
      ['Inventory you bought but have not sold', -(h.inv - prevInv), 'Materials on hand and finished goods waiting to sell.'],
      ['Bills you have not paid yet', h.ap - prevAp, 'Supplier invoices due next month.'],
      ['Construction & equipment', -cf.outs.capex, 'Building sites is not an expense on the P&L, but it is cash out the door.'],
      ['Loan repayments', -cf.outs.principal, 'Principal is not an expense either.'],
      ['New loans & investment', cf.ins.financing, 'Borrowing and fundraising add cash, not profit.']
    ];
    const sum = items.reduce((a, x) => a + x[1], 0);
    const resid = (cf.end - cf.start) - sum;
    if (Math.abs(resid) > 1) items.push(['Other (asset sales, timing)', resid, '']);
    return `<table class="t"><tbody>${items.filter((x, i) => i === 0 || Math.abs(x[1]) >= 1).map(([n, v, hint], i) => `<tr class="${i === 0 ? 'em' : ''}"><td><div class="name-cell"><span>${n}</span>${hint ? `<span class="muted">${hint}</span>` : ''}</div></td><td class="r num ${signCls(v)}">${v >= 0 ? '+' : ''}${f$(v)}</td></tr>`).join('')}
      <tr class="total"><td>Change in cash</td><td class="r num ${signCls(cf.end - cf.start)}">${cf.end - cf.start >= 0 ? '+' : ''}${f$(cf.end - cf.start)}</td></tr></tbody></table>`;
  }
  // one plain sentence on what is driving the burn
  function diagnosis(h, p0) {
    if (!h || !h.cf) return '';
    const cf = h.cf, rev = h.rev;
    const outs = Object.entries(cf.outs).filter(([k]) => k !== 'principal').sort((a, b) => b[1] - a[1]);
    const [bk, bv] = outs[0] || ['', 0];
    const delta = cf.end - cf.start - cf.ins.financing;
    const parts = [];
    if (delta < 0) parts.push(`Before any new loans or investment, you burned <b>${f$(-delta).replace(/[()]/g, '')}</b> last month.`);
    else parts.push(`Operations added <b>${f$(delta)}</b> of cash last month.`);
    if (bv > 0) parts.push(`Your biggest cost is <b>${OUT_NAMES[bk][0].toLowerCase()}</b> at ${f$(bv)}${rev > 0 ? ` (${pct(bv / rev)} of revenue)` : ''}.`);
    const tips = {
      payroll: 'Check the People tab for teams above the recommended size, and your own salary.',
      suppliers: 'Check ingredient grades, months of cover (stock you are holding), and overseas suppliers you prepay.',
      contract: 'Contract manufacturers charge per unit; at your volume your own site may be cheaper.',
      sites: 'You may have more capacity than you use. Check utilization on Operations.',
      marketing: 'See which channels are saturated on the Markets tab.',
      channels: 'Shops and account fees: close stores that do not pay for themselves.',
      capex: 'Construction is a one-off; consider an equipment loan to spread it out.',
      oneTime: 'Mostly one-off: hiring fees, launches, slotting.'
    };
    if (tips[bk]) parts.push(tips[bk]);
    const arUp = h.ar - (p0 ? p0.ar : 0), invUp = h.inv - (p0 ? p0.inv : 0);
    if (h.ni > 0 && delta < 0) parts.push(`You are profitable on paper but short on cash because ${arUp > invUp ? 'customers have not paid yet' : 'inventory is piling up'}.`);
    return parts.join(' ');
  }
  function cashPanel(compact) {
    const co = S.co, h = last(), p0 = prev();
    if (!h || !h.cf) return '';
    if (compact) {
      const outs = Object.entries(h.cf.outs).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const max = Math.max(1, ...outs.map(x => x[1]));
      return `<div><div class="eyebrow" style="margin-bottom:6px">Where your cash went</div><p class="small" style="margin:0 0 8px">${diagnosis(h, p0)}</p>
        <table class="t cash"><tbody>${outs.map(([k, v]) => `<tr><td>${OUT_NAMES[k][0]}</td><td style="width:40%"><div class="cashbar out"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div></td><td class="r num">${f$(v)}</td></tr>`).join('')}</tbody></table>
        <button class="btn sm" style="margin-top:8px" data-act="tab" data-id="finance">Full cash breakdown</button></div>`;
    }
    return `<section class="panel"><header><div><h2>Where your cash went · ${GC.monthLabel(h.m)}</h2><p class="small" style="margin-top:4px;max-width:90ch">${diagnosis(h, p0)}</p></div></header>
      <div class="grid g2"><div><div class="eyebrow" style="margin-bottom:6px">Every dollar in and out</div>${cashBars(h)}</div>
      <div><div class="eyebrow" style="margin-bottom:6px">Why cash is not the same as profit</div>${bridge(h, p0)}</div></div></section>`;
  }

  function roundReq(id) {
    return { ff: 'Anyone will listen, once. Small checks.', angel: 'Any stage. Local angels and syndicates.', seed: 'Needs a $300K revenue run-rate or 200 R&D points.', a: 'Needs a $2M run-rate growing 8%+ a quarter.', b: 'Needs a $10M run-rate growing 5%+ a quarter.', c: 'Needs a $40M run-rate.', pe: 'Needs $5M+ EBITDA run-rate.', ipo: 'Needs a $150M run-rate and either profits or 40%+ annual growth.' }[id] || '';
  }

  // ---------- Career ----------
  function careerCore() {
    const c = S.ceo;
    const nw = GC.netWorth(S);
    const offers = c.offers;
    const offerHtml = offers.length ? offers.map(o => o.kind === 'acquire' ? `<div class="offer"><div class="eyebrow">Acquisition offer · expires ${GC.monthLabel(o.expires)}</div><div class="co">${esc(o.buyer)}</div>
        <div class="small">Offers <b class="mono">${f$(o.price)}</b> for all of ${esc(S.co ? S.co.name : 'the company')}, a ${pct(o.prem - 1)} premium to today's valuation. Your stake would pay <b class="mono">${f$(GC.ceoStake(S.co) * o.price)}</b> before ~20% capital-gains tax.</div>
        <div class="row">${confirmBtn('acq-' + o.id, 'Sell the company', 'acceptOffer', 'primary', o.id)}<button class="btn" data-act="declineOffer" data-id="${o.id}">Decline</button></div></div>`
      : `<div class="offer"><div class="eyebrow">CEO search · expires ${GC.monthLabel(o.expires)}</div><div class="co">${esc(o.company)}</div>
        <div class="small muted">${esc(GC.indById[o.ind].name)} · ${esc(GC.cityById[o.city].name)} · about ${f$(o.revenue)} revenue · ${esc(o.situation)}</div>
        <dl class="facts small" style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px"><dt class="muted">Base salary</dt><dd class="mono" style="margin:0;text-align:right">${f$(o.salary)}/yr</dd><dt class="muted">Equity grant</dt><dd class="mono" style="margin:0;text-align:right">${pct(o.equity, 2)}</dd><dt class="muted">Sign-on bonus</dt><dd class="mono" style="margin:0;text-align:right">${f$(o.signOn)}</dd></dl>
        <div class="row">${confirmBtn('job-' + o.id, 'Take the job', 'acceptOffer', 'primary', o.id)}<button class="btn" data-act="declineOffer" data-id="${o.id}">Decline</button></div>
        ${S.co ? `<div class="small muted">You would resign from ${esc(S.co.name)} and keep your vested shares.</div>` : ''}</div>`).join('') : '<div class="empty small">No offers right now. Headhunters call more often as your reputation grows.</div>';
    const hist = c.history.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Company</th><th>Years</th><th class="r">Peak run-rate</th><th>Outcome</th></tr></thead><tbody>${c.history.map(hh => `<tr><td><div class="name-cell"><b>${esc(hh.name)}</b><span class="muted">${esc(GC.indById[hh.ind].name)} · ${esc(GC.cityById[hh.city].name)}${hh.founder ? ' · founder' : ''}</span></div></td><td class="num">${GC.monthLabel(hh.from)} – ${GC.monthLabel(hh.to)}</td><td class="r num">${f$(hh.peakRunRate)}</td><td>${esc(hh.outcome)}${hh.extra ? `<div class="small muted">${esc(hh.extra)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Your first chapter is being written.</div>';
    const holdings = c.holdings.length ? `<table class="t"><tbody>${c.holdings.map((x, i) => `<tr><td>${esc(x.name)} <span class="muted small">${pct(x.pct, 1)}</span></td><td class="r num">${f$(x.value)}</td><td class="r"><button class="btn sm" data-act="sellHolding" data-id="${i}">Sell${x.public ? '' : ' at 30% discount'}</button></td></tr>`).join('')}</tbody></table>` : '<div class="small muted">None.</div>';
    return { nw, offerHtml, hist, holdings };
  }
  function tabCareer() {
    const c = S.ceo, co = S.co;
    const { nw, offerHtml, hist, holdings } = careerCore();
    return `<div class="stack">
      <section class="panel career-hero">
        <div><div class="eyebrow">Net worth</div><div class="big">${f$(nw)}</div></div>
        <div style="flex:1;min-width:220px"><div class="small muted">Reputation</div>${meter(c.rep / 100)}</div>
        <div class="small"><div>Savings <b class="mono">${f$(c.cash)}</b></div><div>Stake in ${esc(co.name)} <b class="mono">${pct(GC.ceoStake(co), 1)}</b></div><div>Salary <b class="mono">${f$(c.salary)}</b>/yr</div></div>
      </section>
      <div class="grid g2">
        <section class="panel"><header><h3>Offers</h3></header><div class="stack">${offerHtml}</div></section>
        <section class="panel"><header><h3>Moves</h3></header><div class="stack">
          <div class="row spread"><div class="small"><b>Hire bankers to sell the company</b><div class="muted">Buyers pay a premium, if one shows up. Needs six months of books.</div></div><button class="btn" data-act="seekBuyer">Run a sale process</button></div>
          <div class="row spread"><div class="small"><b>Resign and start something new</b><div class="muted">Keep your shares; found a new company with your savings.</div></div>${confirmBtn('resign', 'Resign', 'resign')}</div>
          <div class="row spread"><div class="small"><b>Start over</b><div class="muted">Erase this career and begin a new founder.</div></div>${confirmBtn('wipe', 'New game', 'wipe')}</div>
          ${U.flash ? `<div class="note">${esc(U.flash)}</div>` : ''}
          <div><div class="eyebrow" style="margin:6px 0">Stakes you still hold</div>${holdings}</div>
        </div></section>
      </div>
      <section class="panel"><header><h3>Track record</h3></header>${hist}</section>
    </div>`;
  }
  function renderBetween() {
    const c = S.ceo;
    const { nw, offerHtml, hist, holdings } = careerCore();
    return `<header class="statusbar"><div class="wrap"><div class="brand"><span class="co">${esc(c.name)}</span><span class="sub">Between roles · ${GC.monthLabel(S.month)}</span></div>
      <div class="vitals"><div class="vital"><span class="k">Savings</span><span class="v">${f$(c.cash)}</span></div><div class="vital"><span class="k">Net worth</span><span class="v">${f$(nw)}</span></div><div class="vital"><span class="k">Reputation</span><span class="v">${Math.round(c.rep)}</span></div></div>
      <div class="close-month"><button class="btn primary" data-act="advance">Wait a month</button></div></div></header>
      <main class="wrap"><div class="stack">
        <section class="panel"><div class="eyebrow">Your next chapter</div><h2 style="margin:4px 0 8px">What now?</h2><p class="muted" style="margin:0 0 12px;max-width:64ch">Take a CEO job when a headhunter calls, or found a new company with your savings (${f$(c.cash)}). Living costs keep running at ${f$(GC.ceoLiving(S))} a month.</p>
          <div class="row"><button class="btn primary" data-act="newVenture">Found a new company</button>${confirmBtn('wipe', 'Start a new career', 'wipe')}</div></section>
        <div class="grid g2"><section class="panel"><header><h3>Offers</h3></header><div class="stack">${offerHtml}</div></section>
        <section class="panel"><header><h3>Stakes you hold</h3></header>${holdings}</section></div>
        <section class="panel"><header><h3>Track record</h3></header>${hist}</section>
        <section class="panel"><header><h3>News wire</h3></header>${newsList(10)}</section>
      </div></main>`;
  }

  // ---------- Modals ----------
  function renderModals() {
    if (!S || U.setup) return '';
    const pe = S.pendingEvent;
    if (pe) {
      return `<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="evTitle"><div class="modal"><div class="eyebrow">${GC.monthLabel(S.month)} · decision needed</div><h2 id="evTitle">${esc(pe.title)}</h2><p>${esc(pe.text)}</p>
        <div class="choices">${pe.choices.map((c, i) => `<button class="choice" data-act="choose" data-id="${i}"><b>${esc(c.label)}</b>${c.hint ? `<span>${esc(c.hint)}</span>` : ''}</button>`).join('')}</div></div></div>`;
    }
    const co = S.co;
    if (co && co.crisis) {
      const o = GC.crisisOptions(S, co);
      const opt = (act, label, hint, ok, extra) => `<button class="choice" data-act="crisis" data-id="${act}" ${extra || ''} ${ok ? '' : 'disabled'}><b>${label}</b><span>${hint}</span></button>`;
      return `<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="crTitle"><div class="modal"><div class="eyebrow neg">Cash crisis</div><h2 id="crTitle">${esc(co.name)} is ${f$(co.crisis.deficit)} short</h2>
        <p>Payroll and suppliers are due and the credit line is maxed. You have to close the gap before the next month.</p>
        <div class="choices">
          ${opt('bridge', 'Emergency bridge loan', o.bridge ? `Borrow ${f$(o.bridge)} at 16%, secured on your assets, 24 months.` : 'Lenders see too little collateral.', o.bridge)}
          ${opt('personal', 'Put in your own savings', o.personal ? `Inject ${f$(Math.min(S.ceo.cash, o.personal))} for new shares.` : `You have only ${f$(S.ceo.cash)} in savings.`, o.personal)}
          ${opt('downround', 'Emergency down round', o.downround ? `Existing investors put in ${f$(o.downround)} at half the last valuation. The board will not forget.` : 'No investors with the appetite.', o.downround)}
          ${o.sellable.map(sv => `<button class="choice" data-act="crisis" data-id="sell" data-fac="${sv.uid}"><b>Sell ${esc(sv.name)}</b><span>Raises about ${f$(sv.proceeds)}.</span></button>`).join('')}
          <button class="choice" data-act="crisis" data-id="bankrupt"><b>File for bankruptcy</b><span>The company is liquidated and your equity is wiped out. Your reputation takes a hit, but your career goes on.</span></button>
        </div></div></div>`;
    }
    return '';
  }

  // ---------- Actions ----------
  function toast(title, text) {
    U.toasts = [{ title, text }];
    const mine = U.toasts[0];
    setTimeout(() => { if (U.toasts[0] === mine) { U.toasts = []; render(); } }, 6000);
  }
  function doAdvance() {
    const co = S.co;
    GC.advance(S);
    if (S.toast) { toast(S.toast.title, S.toast.text); S.toast = null; }
    if (!S.co && co) U.tab = 'career';
    U.flash = null;
    save(); render();
    if (U.tab !== 'overview' && S.co) { /* stay on current tab */ }
  }
  const act = {
    tab: (el) => { U.tab = el.dataset.id; U.flash = null; U.pitchMsg = null; window.scrollTo(0, 0); },
    advance: () => { doAdvance(); return true; },
    askConfirm: (el) => { U.confirm = el.dataset.key; },
    cancelConfirm: () => { U.confirm = null; },
    setupNext: () => { const st = U.setup; st.step = Math.min(3, st.step + 1); window.scrollTo(0, 0); },
    setupBack: () => { const st = U.setup; st.step = Math.max(st.existing ? 1 : 0, st.step - 1); window.scrollTo(0, 0); },
    setupCancel: () => { U.setup = null; },
    pickBg: (el) => { U.setup.bg = el.dataset.id; U.setup.invest = null; },
    pickInd: (el) => { U.setup.ind = el.dataset.id; U.setup.name = ''; },
    pickCity: (el) => { U.setup.city = el.dataset.id; U.setup.name = ''; },
    resume: () => { S = load(); U.setup = null; if (S && S.co) GC.compat(S.co); },
    found: () => {
      const st = U.setup;
      const setup = { ceoName: st.ceoName || 'You', bg: st.bg, ind: st.ind, city: st.city, name: st.name || 'New Co', invest: st.invest || 0, sba: st.sba || 0, angel: st.angel || 0, salary: +st.salary || 0, marketing: +st.marketing || 0 };
      const fd = GC.indById[st.ind].facilities[0];
      if (setup.invest + setup.sba + setup.angel < (fd ? fd.capex : 0)) { return; }
      if (st.existing) { GC.startCompany(S, setup); S.news.unshift({ m: S.month, text: `You founded ${setup.name}.`, tone: 'good', big: true }); }
      else { S = GC.newGame(setup); S.news.unshift({ m: 0, text: `${setup.name} is incorporated in ${GC.cityById[setup.city].name}. Day one.`, tone: 'good', big: true }); }
      U.setup = null; U.tab = 'overview'; save(); window.scrollTo(0, 0);
    },
    preset: (el) => { GC.applyPreset(S.co, el.dataset.id, U.presetTotal != null ? U.presetTotal : S.co.marketing); },
    pitchAcct: (el) => { const r = GC.pitchAccount(S, S.co, el.dataset.id); U.pitchMsg = r.err || r.msg; if (r.ok) S.news.unshift({ m: S.month, text: r.msg, tone: 'good' }); },
    dropAcct: (el) => { GC.dropAccount(S.co, el.dataset.id); },
    web: () => { const e = GC.toggleWeb(S, S.co); if (e) toast('Cannot launch', e); else if (S.co.web) toast('Online store live', 'Customers who know you can now order directly.'); },
    openStore: (el) => { const e = GC.openStore(S, S.co, el.dataset.id, +U.storeRegion || 0); if (e) toast('Cannot open', e); else toast('Opening soon', 'Your new shop starts selling this month.'); },
    closeStore: (el) => { GC.closeStore(S.co, +el.dataset.id); },
    project: (el) => { const e = GC.startProject(S, S.co, el.dataset.id, el.dataset.u); if (e) toast('Cannot start', e); else toast('Project started', 'Your team is on it.'); },
    farm: (el) => { const e = GC.partnerFarm(S, S.co, el.dataset.id); if (e) toast('Cannot partner', e); else toast('Partnership signed', 'Your partner farm now supplies you first.'); },
    farmExpand: (el) => { const e = GC.expandFarm(S, S.co, el.dataset.id); if (e) toast('Cannot expand', e); else toast('Farm expanding', 'Your partner can now supply twice as much.'); },
    farmEnd: (el) => { GC.endFarm(S.co, el.dataset.id); },
    launch: (el) => { const e = GC.launchProduct(S, S.co, el.dataset.id); if (e) toast('Cannot launch', e); else toast('Launched', GC.indById[S.co.ind].products.find(p => p.id === el.dataset.id).name + ' is on sale next month.'); },
    priceRef: (el) => { const p = ind().products.find(x => x.id === el.dataset.id); S.co.products[p.id].price = Math.round(p.price * S.macro.cpi * 100) / 100; },
    buffer: (el) => { S.co.bufferWeeks = Math.max(0, Math.min(12, S.co.bufferWeeks + +el.dataset.d)); },
    build: (el) => { const e = GC.buildFacility(S, S.co, el.dataset.id, el.dataset.site); if (e) toast('Cannot build', e); else toast('Contract signed', 'Construction has started. Check Operations for progress.'); },
    sellFac: (el) => { const pr = GC.sellFacility(S, S.co, el.dataset.id); U.confirm = null; toast('Site sold', 'Recovered ' + f$(pr || 0) + '.'); },
    contract: (el) => { const p = GC.lockContract(S, S.co, el.dataset.id); toast('Price locked', `${COMMODITIES[el.dataset.id].name} fixed at ${unitPrice(p)} for 12 months.`); },
    staff: (el) => { const d = el.dataset.id; GC.setStaff(S, S.co, d, S.co.staff[d] + +el.dataset.d); },
    applyRec: () => { const r = GC.recommendedStaff(S, S.co); for (const k of ['ops', 'support', 'ga']) GC.setStaff(S, S.co, k, r[k]); },
    unlock: (el) => { const e = GC.unlockRegion(S, S.co, +el.dataset.id); if (e) toast('Cannot expand', e); else toast('New market', `You are now selling in ${S.co.regions[+el.dataset.id].name}. Build awareness and reach there.`); },
    borrow: (el) => { const k = el.dataset.id; const cap = GC.loanCapacity(S, S.co)[k]; const amt = Math.min(cap, U['borrow-' + k] || cap); const e = GC.takeLoan(S, S.co, k, amt); if (e) toast('Loan declined', e); else toast('Loan funded', f$(amt) + ' is in your account.'); U['borrow-' + k] = null; },
    repay: (el) => { const id = el.dataset.id; const l = S.co.loans.find(x => x.id === id); GC.repayLoan(S, S.co, id, U['repay-' + id] || Math.min(l.bal, S.co.cash)); U['repay-' + id] = null; },
    pitch: () => { const co = S.co; const rounds = GC.availableRounds(S, co); const id = U.round && rounds.some(r => r.r.id === U.round) ? U.round : (rounds.filter(r => r.ok).slice(-1)[0] || rounds[0]).r.id; const R = rounds.find(r => r.r.id === id).r; const e = GC.requestTermSheet(S, co, id, Math.min(R.max, Math.max(R.min, U.raiseAmt || R.min))); U.flash = e || null; },
    acceptTS: () => { const t = GC.acceptTermSheet(S, S.co); if (t) { S.news.unshift({ m: S.month, text: `${S.co.name} raises ${f$(t.amount)} (${t.name}) from ${t.investor} at a ${f$(t.pre)} pre-money valuation.`, tone: 'good', big: true }); toast('Round closed', `${f$(t.amount)} raised.`); } },
    declineTS: () => { S.co.termSheet = null; },
    buyback: () => { GC.buyback(S, S.co, U.buybackAmt || S.co.cash * 0.1); },
    choose: (el) => { const r = GC.resolveEvent(S, +el.dataset.id); if (r) toast('Decision made', r); if (!S.co) U.tab = 'career'; },
    crisis: (el) => { const id = el.dataset.id; if (id === 'bankrupt') { GC.bankrupt(S); U.tab = 'career'; } else GC.resolveCrisis(S, S.co, id, el.dataset.fac); },
    acceptOffer: (el) => { const o = S.ceo.offers.find(x => x.id === el.dataset.id); GC.acceptOffer(S, el.dataset.id); U.confirm = null; U.tab = S.co ? 'overview' : 'career'; if (o && o.kind === 'job') toast('New job', `Welcome to ${S.co.name}. Read the books before you change anything.`); },
    declineOffer: (el) => { S.ceo.offers = S.ceo.offers.filter(x => x.id !== el.dataset.id); },
    seekBuyer: () => { const e = GC.seekBuyer(S); U.flash = e || 'A buyer has made an offer. See Offers.'; },
    resign: () => { const co = S.co; const stake = GC.endTenure(S, 'Resigned'); if (GC.ceoStake(co) > 0) S.ceo.holdings.push({ name: co.name, pct: GC.ceoStake(co), value: stake, public: co.public, since: S.month }); S.news.unshift({ m: S.month, text: `You stepped down as CEO of ${co.name}.`, tone: 'neutral', big: true }); S.co = null; S.ceo.salary = 0; U.confirm = null; U.tab = 'career'; },
    newVenture: () => { U.setup = newSetup(S.ceo); },
    sellHolding: (el) => { const p = GC.sellHolding(S, +el.dataset.id); toast('Stake sold', `You received ${f$(p || 0)} after tax.`); },
    wipe: () => { clearSave(); S = null; U = { tab: 'overview', setup: newSetup(), confirm: null, toasts: [], pl: 'month' }; }
  };

  // A field's change event fires on blur, which happens on pointerdown of whatever is clicked next.
  // Re-rendering then would replace the button mid-click and swallow it, so wait for the click.
  let ptrDown = false, pending = false;
  const softRender = () => { if (ptrDown) pending = true; else render(); };
  document.addEventListener('pointerdown', () => { ptrDown = true; }, true);
  document.addEventListener('pointerup', () => { ptrDown = false; if (pending) setTimeout(() => { if (pending) { pending = false; render(); } }, 0); }, true);

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = act[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    if (el.dataset.act !== 'advance') U.toasts = [];
    const handled = fn(el);
    if (el.dataset.act !== 'askConfirm') U.confirm = null;
    if (handled) return;
    if (S && !U.setup) save();
    pending = false;
    render();
  });

  function onField(e) {
    const el = e.target;
    if (el.dataset.setup) {
      const st = U.setup;
      const k = el.dataset.setup;
      st[k] = el.type === 'range' || el.type === 'number' ? +el.value : el.value;
      if (e.type === 'input' && el.type === 'text') return; // keep typing without re-render
      if (e.type === 'input' && el.type === 'range') { const n = el.parentElement.querySelector('.num'); if (n) n.textContent = f$(+el.value); return; }
      softRender();
      return;
    }
    const b = el.dataset.bind;
    if (!b || !S) return;
    if (e.type === 'input' && el.type !== 'range') return;
    const co = S.co, id = el.dataset.id, v = el.type === 'checkbox' ? el.checked : el.value;
    switch (b) {
      case 'price': co.products[id].price = Math.max(0, +v || 0); break;
      case 'site': U['site-' + id] = v; break;
      case 'supplier': co.mats[id].sup = v; break;
      case 'cover': co.mats[id].cover = Math.max(0, Math.min(12, +v || 0)); break;
      case 'emergency': co.emergencyBuy = v; break;
      case 'staff': GC.setStaff(S, co, id, +v || 0); break;
      case 'pay': co.payPolicy = +v; break;
      case 'backfill': co.autoBackfill = v; break;
      case 'ceoSalary': S.ceo.salary = Math.max(0, +v || 0); break;
      case 'marketing': co.marketing = Math.max(0, +v || 0); break;
      case 'repayAmt': U['repay-' + id] = +v; return;
      case 'borrowAmt': U['borrow-' + id] = +v; return;
      case 'round': U.round = v; U.raiseAmt = null; break;
      case 'mkt': GC.setMkt(co, id, +v || 0); break;
      case 'presetTotal': U.presetTotal = Math.max(0, +v || 0); return;
      case 'storeRegion': U.storeRegion = +v; break;
      case 'tier': GC.setTier(co, id, v); break;
      case 'devProduct': U.devProduct = v; break;
      case 'raiseAmt': U.raiseAmt = +v; { const n = el.parentElement.querySelector('.num'); if (n) n.textContent = f$(+v); } if (e.type === 'input') return; break;
      case 'buybackAmt': U.buybackAmt = +v; return;
    }
    save(); softRender();
  }
  document.addEventListener('change', onField);
  document.addEventListener('input', onField);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[type="number"]')) e.target.blur();
  });

  // tooltip for chart marks
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  });

  // ---------- boot ----------
  function start(data) {
    if (data && data.S) { S = data.S; U = Object.assign(U, data.U || {}, { toasts: [] }); }
    else {
      const saved = load();
      if (saved && saved.v === 1) { S = saved; U.setup = null; if (S.co) GC.compat(S.co); }
      else U.setup = newSetup();
    }
    render();
  }
  if (window.claude && window.claude.hot) {
    try { window.claude.hot.snapshot(() => ({ S, U: Object.assign({}, U, { toasts: [] }) })); } catch (e) { /* not available */ }
  }
  window.claude && window.claude.hot && window.claude.hot.ready ? window.claude.hot.ready(start) : start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
