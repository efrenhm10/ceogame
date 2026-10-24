/* Going Concern — simulation engine. Pure state + rules, no DOM. */
(function (G) {
  'use strict';
  const D = G.GC_DATA;
  const { CITIES, COMMODITIES, SUPPLIER_TYPES, INDUSTRIES, BACKGROUNDS, ROUNDS, MONTHS, MKT_CHANNELS, MKT_PRESETS, ACCOUNTS, STOREFRONTS, WEBSTORE, FARM_INPUTS, FARM_NAMES, TIERS, UPGRADES } = D;
  const cityById = Object.fromEntries(CITIES.map(c => [c.id, c]));
  const indById = Object.fromEntries(INDUSTRIES.map(i => [i.id, i]));
  const START_YEAR = 2027;
  const US_POP = 335e6, INTL_POP = 600e6;
  const DEPTS = ['ops', 'sales', 'rd', 'support', 'ga'];
  const BASE_SAL = { sales: 72000, support: 52000, ga: 85000 };
  const LOAD = 1.28; // benefits + payroll taxes

  // ---------- RNG (seeded, saveable) ----------
  function rand(s) {
    s.seed = (s.seed + 0x6D2B79F5) | 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randn(s) {
    const u = Math.max(1e-9, rand(s)), v = rand(s);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  const uid = (s) => 'x' + Math.floor(rand(s) * 1e9).toString(36);

  const monthLabel = (m) => MONTHS[((m % 12) + 12) % 12] + ' ' + (START_YEAR + Math.floor(m / 12));
  const calMonth = (m) => ((m % 12) + 12) % 12;

  // ---------- Macro & prices ----------
  function initMacro(s) {
    s.macro = { econ: 'expansion', fed: 3.5, cpi: 1, wageIdx: 1, tariff: 1.15, tourism: 1, sentiment: 1, shocks: {}, hiMinWage: 16 };
    s.prices = {}; s.priceHist = {};
    for (const [id, c] of Object.entries(COMMODITIES)) {
      let p = c.base;
      const hist = [];
      for (let i = 0; i < 24; i++) {
        p = Math.exp(Math.log(p) + c.theta * (Math.log(c.base) - Math.log(p)) + c.vol * randn(s));
        hist.push(p);
      }
      s.prices[id] = p; s.priceHist[id] = hist;
    }
  }

  const ECON = {
    expansion: { mult: 1.0, next: [['slowdown', 0.025]], label: 'Expansion' },
    slowdown: { mult: 0.97, next: [['recession', 0.12], ['expansion', 0.1]], label: 'Slowdown' },
    recession: { mult: 0.88, next: [['recovery', 0.12]], label: 'Recession' },
    recovery: { mult: 0.95, next: [['expansion', 0.15]], label: 'Recovery' }
  };
  const FOMC = [0, 2, 4, 5, 6, 8, 9, 11];

  function stepMacro(s, news) {
    const M = s.macro;
    const prev = M.econ;
    for (const [to, p] of ECON[M.econ].next) { if (rand(s) < p) { M.econ = to; break; } }
    if (M.econ !== prev) {
      const msg = { slowdown: 'Economists warn of a slowdown: hiring cools and consumers trim spending.', recession: 'The U.S. economy has entered a recession. Discretionary demand is falling.', recovery: 'The recession is over. Demand is starting to recover.', expansion: 'The economy is back in full expansion.' }[M.econ];
      news(msg, M.econ === 'recession' || M.econ === 'slowdown' ? 'bad' : 'good', true);
    }
    if (FOMC.includes(calMonth(s.month))) {
      let d = 0;
      if (M.econ === 'recession') d = -0.5;
      else if (M.econ === 'slowdown' && rand(s) < 0.6) d = -0.25;
      else if (M.econ === 'expansion' && rand(s) < 0.22 && M.fed < 5.5) d = 0.25;
      else if (M.econ === 'expansion' && rand(s) < 0.08 && M.fed > 2) d = -0.25;
      if (d) {
        M.fed = clamp(M.fed + d, 0.25, 7);
        news(`The Fed ${d > 0 ? 'raises' : 'cuts'} rates by ${Math.abs(d * 100)} bp to ${(M.fed).toFixed(2)}%. Prime is now ${(M.fed + 3).toFixed(2)}%.`, d > 0 ? 'bad' : 'good');
      }
    }
    M.cpi *= 1 + 0.0023 + 0.001 * randn(s);
    M.wageIdx *= 1 + 0.0028;
    M.tourism += (1 - M.tourism) * 0.12 + 0.015 * randn(s);
    if (M.econ === 'recession') M.tourism -= 0.01;
    M.sentiment = clamp(M.sentiment + (1 - M.sentiment) * 0.1 + 0.04 * randn(s), 0.6, 1.4);
    for (const [id, c] of Object.entries(COMMODITIES)) {
      const sh = M.shocks[id];
      let mult = 1;
      if (sh) { if (sh.until < s.month) delete M.shocks[id]; else mult = sh.mult; }
      const target = c.base * M.cpi * mult;
      const p = s.prices[id];
      s.prices[id] = clamp(Math.exp(Math.log(p) + c.theta * (Math.log(target) - Math.log(p)) * (sh ? 2 : 1) + c.vol * randn(s)), c.base * 0.25, c.base * 6);
      s.priceHist[id].push(s.prices[id]);
      if (s.priceHist[id].length > 36) s.priceHist[id].shift();
    }
    // Hawaii's scheduled minimum-wage step: $18/hr from Jan 2028
    if (s.month === 12) { M.hiMinWage = 18; news('Hawaii\'s minimum wage rises to $18/hour, the last scheduled step of the 2022 law.', 'neutral'); }
  }

  const prime = (s) => s.macro.fed + 3;
  const econMult = (s, ind) => 1 - (1 - ECON[s.macro.econ].mult) * ind.cyc;
  function elecPrice(s, city) { return city.elec * (0.75 + 0.25 * s.prices.natgas / COMMODITIES.natgas.base) * s.macro.cpi; }
  function ppaPrice(s, city) { return city.ppa * (0.7 + 0.3 * s.prices.natgas / COMMODITIES.natgas.base) * s.macro.cpi; }
  function capPrice(s, city) { return 9000 * Math.sqrt(city.ppa / 60) * s.macro.cpi; }

  // ---------- Effects ----------
  function fxList(co, k) { return (co.fx || []).filter(f => f.k === k); }
  function fxMul(co, k, filter) { return fxList(co, k).filter(f => !filter || filter(f)).reduce((a, f) => a * f.v, 1); }
  function fxAdd(co, k, filter) { return fxList(co, k).filter(f => !filter || filter(f)).reduce((a, f) => a + f.v, 0); }
  function addFx(s, co, k, v, months, extra) { co.fx.push(Object.assign({ k, v, until: months === Infinity ? 1e9 : s.month + months }, extra || {})); }

  // ---------- Company construction ----------
  function regionDefs(city) {
    const hnl = city.id === 'honolulu';
    return [
      { key: 'local', name: city.name + ' metro', pop: city.metro },
      { key: 'state', name: city.regionName, pop: Math.max(2e5, city.regionPop - city.metro) },
      { key: 'national', name: hnl ? 'U.S. Mainland' : 'Rest of the U.S.', pop: US_POP - city.regionPop },
      { key: 'intl', name: hnl ? 'International (Asia-Pacific first)' : 'International', pop: INTL_POP }
    ];
  }

  function defaultCover(c) { const cm = COMMODITIES[c]; return cm.spoil >= 0.3 ? 0.15 : 1.5; }
  function defaultSupplier(c, city) {
    const src = COMMODITIES[c].src;
    if (src === 'S') return 'S';
    if (city.id === 'honolulu' && src.includes('L') && city.localSpecialty.includes(c)) return 'L';
    if (COMMODITIES[c].spoil >= 0.3 && src.includes('L')) return 'L';
    return src.includes('D') ? 'D' : src[0];
  }

  function makeCompany(s, opts) {
    const ind = indById[opts.ind], city = cityById[opts.city];
    const co = {
      name: opts.name, ind: ind.id, city: city.id, founded: s.month, isFounder: !!opts.isFounder,
      cash: 0, ar: 0, ap: 0, loans: [], fx: [], acc: newAcc(),
      facilities: [], products: {}, regions: regionDefs(city).map((r, i) => Object.assign(r, { unlocked: i === 0, aw: i === 0 ? 0.05 : 0, reach: i === 0 ? (ind.reach.init || 0) : 0 })),
      assets: [], emergencyBuy: true, mkt: {}, accounts: {}, acctCool: {}, web: false, stores: [], farms: {}, tier: {}, mats: {}, staff: { ops: 0, sales: 0, rd: 0, support: 0, ga: 0 }, payPolicy: 1.0, morale: 70, autoBackfill: true,
      marketing: 0, rdPts: 0, nol: 0, hist: [], bufferWeeks: 2,
      shares: { total: 10e6, ceo: opts.isFounder ? 10e6 : 0, investors: [] }, board: { seats: 0, conf: 65, expect: 0 },
      public: false, sentiment: 1, sharePrice: 0, rounds: [], cooldown: 0, sbaUsed: false, termSheet: null,
      owned: {}, milestones: {}, lastReport: null, crisis: null, fundedBy: 0
    };
    for (const p of ind.products) {
      co.products[p.id] = { active: p.unlock === 0 || p.market, unlocked: !p.unlock, price: Math.round((p.price || 0) * s.macro.cpi * 100) / 100, q: p.q0 || 50, qBonus: 0, bomMult: 1, demandMult: 1, homeMult: 1, projects: {}, done: [], fc: 0, fg: 0, fgVal: 0, customers: 0, dem: 0, sold: 0, lost: 0, prod: 0, rev: 0 };
    }
    for (const c of usedCommodities(ind)) {
      co.mats[c] = { qty: 0, val: 0, sup: defaultSupplier(c, city), cover: defaultCover(c), contract: null, orders: [], usage: 0 };
    }
    return co;
  }
  function newAcc() { return { recruit: 0, severance: 0, launch: 0, expansion: 0, events: 0, otherInc: 0, capex: 0, assetSales: 0, prepaid: 0 }; }

  function usedCommodities(ind) {
    const set = new Set();
    for (const p of ind.products) for (const c of Object.keys(p.bom || {})) set.add(c);
    if (ind.id === 'power') set.add('natgas');
    return [...set];
  }

  // ---------- Labor ----------
  const minWageOf = (s, c) => c.id === 'honolulu' ? s.macro.hiMinWage : c.minWage;
  function opsWageCity(s, co) {
    const hq = cityById[co.city];
    const staffed = co.facilities.filter(f => f.status === 'active' && facDef(co, f).staffed);
    if (!staffed.length) return { wage: hq.wage, minWage: minWageOf(s, hq) };
    let w = 0, tot = 0, min = 0;
    for (const f of staffed) { const fd = facDef(co, f); const wt = fd.capex + 1; const c = cityById[f.city]; w += c.wage * wt; min += minWageOf(s, c) * wt; tot += wt; }
    return { wage: w / tot, minWage: min / tot };
  }
  function salary(s, co, dept) {
    const ind = indById[co.ind], hq = cityById[co.city];
    let base, wage = hq.wage;
    if (dept === 'ops') {
      const c = opsWageCity(s, co); wage = c.wage;
      base = ind.wages.ops * wage * s.macro.wageIdx * fxMul(co, 'opsWage');
      base = Math.max(base, c.minWage * 2080 * 1.15);
    } else if (dept === 'rd') base = ind.wages.rd * wage * s.macro.wageIdx;
    else base = BASE_SAL[dept] * wage * s.macro.wageIdx;
    return base * co.payPolicy * LOAD / 12;
  }
  function payroll(s, co) { let t = 0; for (const d of DEPTS) t += co.staff[d] * salary(s, co, d); return t; }
  function headcount(co) { return DEPTS.reduce((a, d) => a + co.staff[d], 0); }
  function gaNeed(co) { const other = headcount(co) - co.staff.ga; return Math.max(0, Math.ceil(other / 15) - 1); }
  function productivity(co) {
    const need = gaNeed(co);
    const admin = need > 0 ? 0.15 * Math.max(0, 1 - co.staff.ga / need) : 0;
    return (0.8 + 0.4 * co.morale / 100) * (1 - admin);
  }

  // ---------- Facilities ----------
  function facDef(co, f) { return indById[co.ind].facilities.find(x => x.id === f.type); }
  function facLease(s, co, f) {
    const fd = facDef(co, f), c = cityById[f.city];
    const rent = fd.noRent ? fd.lease : fd.lease * c.indRent / 12;
    return (rent + fd.fixed) * s.macro.cpi * fxMul(co, 'fixedCost');
  }
  function resQ(city, res) { if (res === 'offshore') return city.id === 'houston' ? 1 : 0; return city[res] || 0; }
  function canBuildIn(co, fd, city) {
    const ind = indById[co.ind];
    if (fd.res) return resQ(city, fd.res) > 0;
    if (ind.siteAnywhere || ind.storable) {
      if (city.land && fd.capex >= 50e6) {
        const n = co.facilities.filter(f => f.city === city.id && facDef(co, f).capex >= 50e6).length;
        if (n >= city.land) return false;
      }
      return true;
    }
    return city.id === co.city;
  }
  function buildSites(co, fd) {
    const ind = indById[co.ind];
    if (!fd.res && !ind.siteAnywhere && !ind.storable) return [cityById[co.city]];
    return CITIES.filter(c => canBuildIn(co, fd, c));
  }
  function buildFacility(s, co, type, cityId) {
    const fd = indById[co.ind].facilities.find(x => x.id === type);
    const city = cityById[cityId || co.city];
    if (!fd || !canBuildIn(co, fd, city)) return 'That site is not available.';
    const first = Math.min(fd.capex, fd.capex / fd.build);
    if (co.cash < first) return 'Not enough cash for the first construction installment.';
    co.facilities.push({ uid: uid(s), type, city: city.id, status: 'building', left: fd.build, paid: 0, book: 0, age: 0, started: s.month, cost: fd.capex * s.macro.cpi });
    stepConstruction(s, co, co.facilities[co.facilities.length - 1], true);
    return null;
  }
  // Capex is a fixed-price contract set at signing, paid in equal installments during construction.
  function stepConstruction(s, co, f, immediate) {
    const fd = facDef(co, f);
    const cost = f.cost || fd.capex;
    const inst = cost / fd.build;
    if (immediate) { co.cash -= inst; co.acc.capex += inst; f.paid += inst; f.prepaidMonth = s.month; return; }
    if (f.status !== 'building') return;
    if (f.prepaidMonth !== s.month && f.paid < cost * 0.999 && f.left > 1) { co.cash -= inst; co.acc.capex += inst; f.paid += inst; }
    f.left -= 1;
    if (f.left <= 0) {
      if (f.paid < cost * 0.999) { const rest = cost - f.paid; co.cash -= rest; co.acc.capex += rest; f.paid += rest; }
      f.status = 'active'; f.age = 0; f.activeSince = s.month;
      const itc = fd.itc || 0;
      f.book = f.paid * (1 - itc);
      if (itc) { co.cash += f.paid * itc; co.acc.otherInc += 0; s._news && s._news(`${fd.name} reached commercial operation and earned a ${Math.round(itc * 100)}% investment tax credit (${fmt$(f.paid * itc)}).`, 'good'); }
      else s._news && s._news(`${fd.name} in ${cityById[f.city].name} is now operational.`, 'good');
    }
  }
  function sellFacility(s, co, fuid) {
    const i = co.facilities.findIndex(f => f.uid === fuid);
    if (i < 0) return;
    const f = co.facilities[i];
    const proceeds = f.status === 'active' ? f.book * 0.55 : f.paid * 0.4;
    co.cash += proceeds; co.acc.assetSales += proceeds;
    const loss = (f.status === 'active' ? f.book : f.paid) - proceeds;
    co.acc.events += loss; // write-down hits the P&L
    co.facilities.splice(i, 1);
    return proceeds;
  }

  // ---------- Supply ----------
  function supplierOptions(s, co, c) {
    const cm = COMMODITIES[c];
    const types = cm.src.split('').filter(Boolean);
    if (co.owned[c]) types.unshift('V');
    if (co.farms && co.farms[c]) types.unshift('F');
    return types;
  }
  function supplierTerms(s, co, c, type) {
    const city = cityById[co.city], cm = COMMODITIES[c];
    const spot = s.prices[c];
    if (type === 'F') { const f = co.farms[c]; return { label: 'Partner farm', price: f.price * s.macro.cpi / f.cpi, lead: 0, rel: 0.995, terms: 'net30', name: 'Partner ' + f.name + ' (up to ' + Math.round(f.cap).toLocaleString('en-US') + ' ' + cm.unit + '/mo)', cap: f.cap }; }
    if (type === 'V') return { label: 'Your own supplier', price: spot * 0.82 * (city.id === 'honolulu' ? 1.06 : 1), lead: 1, rel: 1, terms: 'net30', name: 'In-house subsidiary' };
    const T = SUPPLIER_TYPES[type];
    let mult = T.mult, lead = T.lead, rel = T.rel;
    if (type === 'L') mult = city.localSpecialty && city.localSpecialty.includes(c) ? 0.97 : (city.id === 'honolulu' ? 1.28 : 1.15);
    if (type === 'D') { mult *= city.inbound * fxMul(co, 'freight'); lead += fxAdd(co, 'leadD'); rel += fxAdd(co, 'relD'); }
    if (type === 'O') { mult *= city.inbound * 0.97 * fxMul(co, 'freight') * (cm.tariff ? s.macro.tariff : 1); lead += fxAdd(co, 'leadO'); rel += fxAdd(co, 'relO'); }
    const names = cm.names || [];
    const name = type === 'L' ? names[0] : type === 'D' ? names[1] : type === 'O' ? names[2] : 'Spot market';
    return { label: T.label, price: spot * mult, lead, rel: clamp(rel, 0.3, 1), terms: T.terms, name: name || T.label };
  }
  function buyPrice(s, co, c, sup) {
    const m = co.mats[c];
    const tm = COMMODITIES[c].stock === false ? 1 : tierOf(co, c).mult;
    if (!sup && m.contract && m.contract.until >= s.month) return m.contract.price / (m.contract.tm || 1) * tm;
    return supplierTerms(s, co, c, sup || m.sup).price * tm;
  }
  function lockContract(s, co, c) {
    const m = co.mats[c];
    const tm = COMMODITIES[c].stock === false ? 1 : tierOf(co, c).mult;
    const price = supplierTerms(s, co, c, m.sup).price * tm * 1.03;
    m.contract = { price, until: s.month + 11, sup: m.sup, tm };
    return price;
  }
  // ---------- Farm & producer partnerships ----------
  function farmInputs(co) {
    const list = new Set([...(FARM_INPUTS[co.city] || FARM_INPUTS._all)]);
    return [...list].filter(c => co.mats[c]);
  }
  function farmDeal(s, co, c) {
    const m = co.mats[c];
    const use = Math.max(m.usage || 0, 200);
    return { invest: Math.round((use * s.prices[c] * 6 + 12000) / 1000) * 1000, cap: use * 1.3, price: s.prices[c] * 1.08, name: FARM_NAMES[c] || 'local producer' };
  }
  function partnerFarm(s, co, c) {
    const d = farmDeal(s, co, c);
    if (co.cash < d.invest) return 'Not enough cash for the partnership investment.';
    co.cash -= d.invest; co.acc.expansion += d.invest;
    co.farms[c] = { since: s.month, cap: d.cap, price: d.price, cpi: s.macro.cpi, name: d.name };
    co.mats[c].prevSup = co.mats[c].sup; co.mats[c].sup = 'F';
    return null;
  }
  function expandFarm(s, co, c) {
    const f = co.farms[c]; if (!f) return;
    const cost = Math.round((f.cap * s.prices[c] * 4 + 10000) / 1000) * 1000;
    if (co.cash < cost) return 'Not enough cash.';
    co.cash -= cost; co.acc.expansion += cost; f.cap *= 2;
    return null;
  }
  function endFarm(co, c) { delete co.farms[c]; const m = co.mats[c]; m.sup = m.prevSup && m.prevSup !== 'F' ? m.prevSup : defaultSupplier(c, cityById[co.city]); }

  // ---------- Compatibility (older saves, companies built before these systems) ----------
  function compat(co) {
    for (const k of ['mkt', 'accounts', 'acctCool', 'farms', 'tier']) if (!co[k]) co[k] = {};
    if (!co.stores) co.stores = [];
    if (co.web == null) co.web = false;
    for (const ps of Object.values(co.products)) { if (ps.qBonus == null) Object.assign(ps, { qBonus: 0, bomMult: 1, demandMult: 1, homeMult: 1, projects: {}, done: [] }); }
    const sum = Object.values(co.mkt).reduce((a, x) => a + x, 0);
    if (Math.abs(sum - co.marketing) > 1) {
      if (sum > 0) { const f = co.marketing / sum; for (const k of Object.keys(co.mkt)) co.mkt[k] *= f; }
      else if (co.marketing > 0) applyPreset(co, defaultPreset(co), co.marketing);
    }
  }
  function defaultPreset(co) { const ind = indById[co.ind]; return ind.b2b ? 'b2b' : ind.reach.channels ? 'local' : 'local'; }
  function channelsFor(co) {
    const ind = indById[co.ind];
    if (ind.reach.mode === 'none') return [];
    return MKT_CHANNELS.filter(c => !(ind.b2b && c.consumer));
  }
  function setMkt(co, ch, amt) { co.mkt[ch] = Math.max(0, Math.round(amt)); co.marketing = Object.values(co.mkt).reduce((a, x) => a + x, 0); }
  function applyPreset(co, id, total) {
    const pr = MKT_PRESETS[id]; if (!pr) return;
    const allowed = new Set(channelsFor(co).map(c => c.id));
    const mix = Object.entries(pr.mix).filter(([k]) => allowed.has(k));
    const w = mix.reduce((a, [, v]) => a + v, 0) || 1;
    co.mkt = {};
    for (const [k, v] of mix) co.mkt[k] = Math.round(total * v / w);
    co.marketing = Object.values(co.mkt).reduce((a, x) => a + x, 0);
  }

  // ---------- Ingredient grades & product quality ----------
  const PACKAGING = new Set(['film', 'carton', 'jars', 'alcan', 'glass', 'co2']);
  function tierOf(co, c) { return TIERS[co.tier[c] || 'standard'] || TIERS.standard; }
  function bomOf(co, p) {
    const ps = co.products[p.id], out = {};
    for (const [c, q] of Object.entries(p.bom || {})) out[c] = q * (COMMODITIES[c].stock === false ? 1 : (ps.bomMult || 1));
    return out;
  }
  // quality contributed by ingredient choices and farm partners, weighted by each input's share of material cost
  function ingredientQ(co, p) {
    let w = 0, q = 0;
    for (const [c, qty] of Object.entries(p.bom || {})) {
      const cm = COMMODITIES[c];
      if (cm.stock === false) continue;
      const wt = qty * cm.base * (PACKAGING.has(c) ? 0.5 : 1);
      w += wt;
      q += wt * (tierOf(co, c).q + (co.farms[c] ? 6 : 0));
    }
    return w > 0 ? q / w : 0;
  }
  function qEff(co, p) {
    const ps = co.products[p.id];
    return clamp(ps.q + (ps.qBonus || 0) + ingredientQ(co, p) + (co._prQ || 0), 5, 99);
  }

  // ---------- Demand model ----------
  function refPrice(s, co, p) { return (p.price || 1) * s.macro.cpi * fxMul(co, 'compPrice', f => !f.p || f.p === p.id); }
  function appeal(s, co, p, ps) {
    const qF = 0.55 + 0.9 * qEff(co, p) / 100;
    const pF = clamp(Math.pow(refPrice(s, co, p) / Math.max(0.01, ps.price), p.el || 1.5), 0.02, 2.5);
    return qF * pF;
  }
  function growthIdx(s, p) { if (!p.growth) return 1; return Math.exp(p.growth * (1 - Math.pow(0.985, s.month)) / 0.015); }
  function regionPot(s, co, p, r, i, monthOffset) {
    const ind = indById[co.ind], city = cityById[co.city];
    const m = calMonth(s.month + (monthOffset || 0));
    let pot = r.pop * p.perCap * ind.season[m] * econMult(s, ind) * growthIdx(s, p);
    if (i <= 1) {
      const tx = p.tourismX != null ? p.tourismX : ind.tourismSens;
      pot *= 1 + city.tourism * tx * s.macro.tourism * (i === 0 ? 1 : 0.7);
      if (ind.elecSens) pot *= Math.pow(elecPrice(s, city) / 0.17, ind.elecSens);
    }
    return pot;
  }
  function productDemand(s, co, p, ps, opts) {
    const ind = indById[co.ind];
    const a = appeal(s, co, p, ps);
    const byR = [];
    let tot = 0;
    co.regions.forEach((r, i) => {
      if (!r.unlocked) { byR.push(0); return; }
      const pot = regionPot(s, co, p, r, i, opts && opts.offset);
      let d = pot * r.aw * r.reach * a * ind.shareCap * (ps.demandMult || 1) * (i <= 1 ? homeMult(co, p) : 1) * (co._searchLift || 1);
      d = Math.min(d, pot * 0.45);
      byR.push(d); tot += d;
    });
    const mult = fxMul(co, 'demand', f => !f.p || f.p === p.id);
    return { tot: tot * mult, byR: byR.map(x => x * mult) };
  }
  // "made locally" claims: upgrades plus farm partners for the product's inputs lift home-market demand
  function homeMult(co, p) {
    let m = co.products[p.id].homeMult || 1;
    for (const c of Object.keys(p.bom || {})) if (co.farms[c]) m *= 1.05;
    return Math.min(m, 1.25);
  }
  function marketSize(s, co, p) {
    let tot = 0;
    co.regions.forEach((r, i) => { if (r.unlocked) tot += regionPot(s, co, p, r, i) * (p.price || 0) * s.macro.cpi; });
    return tot;
  }

  function regionFreight(co, fcity, i) {
    const hq = cityById[co.city];
    if (!fcity || fcity.id === hq.id) return [1, hq.id === 'honolulu' ? 1.15 : 1.05, hq.nationalFreight * 1.08, hq.intlFreight * 1.3][i];
    if (i <= 1) return hq.id === 'honolulu' ? 1.6 : 1.08;
    return i === 2 ? fcity.nationalFreight : fcity.intlFreight * 1.3;
  }

  // freight cost multiplier to each market given where your capacity sits
  function freightIndex(co) {
    const city = cityById[co.city];
    const caps = co.facilities.filter(f => f.status === 'active').map(f => ({ f, fd: facDef(co, f) })).filter(x => x.fd.cap);
    const tot = caps.reduce((a, x) => a + x.fd.cap, 0);
    return [0, 1, 2, 3].map(i => tot ? caps.reduce((a, x) => a + x.fd.cap / tot * (x.fd.offshore ? 1.15 * city.inbound : regionFreight(co, cityById[x.f.city], i)), 0) : regionFreight(co, null, i));
  }

  // ---------- Monthly simulation ----------
  function advance(s) {
    const newsBuf = [];
    const news = (text, tone, big) => { newsBuf.push({ m: s.month, text, tone: tone || 'neutral', big: !!big }); };
    s._news = news;
    stepMacro(s, news);
    const co = s.co;
    if (co) stepCompany(s, co, news, false);
    stepCareer(s, news);
    s.month++;
    if (s.co && !s.silent) rollEvents(s, s.co, news);
    if (!s.silent) rollOffers(s, news);
    if (!s.silent) { s.news = newsBuf.concat(s.news || []).slice(0, 80); }
    delete s._news;
    return newsBuf;
  }

  function stepCompany(s, co, news) {
    const ind = indById[co.ind], city = cityById[co.city];
    compat(co);
    co.fx = co.fx.filter(f => f.until >= s.month);
    const acc = co.acc;
    const prod = productivity(co);
    const isPT = !!ind.priceTaker;
    const st = { rev: 0, revBy: {}, units: {}, cogsMat: 0, cogsToll: 0, cogsEnergy: 0, cogsVar: 0, cogsRoy: 0, cogsLabor: 0, cogsSite: 0, cogsSpoil: 0, cogsFuel: 0 };
    const cashOut = { purchasesPrepay: 0 };
    let apNew = 0, tollPaid = 0;
    acc.otherInc += fxAdd(co, 'subsidy');

    // 1. Construction & depreciation
    let dep = 0;
    for (const f of co.facilities) {
      if (f.status === 'building') { stepConstruction(s, co, f, false); continue; }
      const fd = facDef(co, f);
      const d = Math.min(f.book, (f.paid * (1 - (fd.itc || 0))) / (fd.life * 12));
      f.book -= d; dep += d; f.age++;
    }
    const active = co.facilities.filter(f => f.status === 'active' && !f.justBuilt);

    // 2. Demand
    const activeProducts = ind.products.filter(p => co.products[p.id].active && !p.market);
    const dem = {};
    for (const p of activeProducts) {
      const ps = co.products[p.id];
      if (p.recurring) continue;
      const d = productDemand(s, co, p, ps);
      const noise = Math.exp(0.06 * randn(s));
      dem[p.id] = { tot: d.tot * noise, byR: d.byR.map(x => x * noise) };
      if (!ps.fc) ps.fc = d.tot;
    }

    // 3. Procurement: arrivals then new orders
    for (const [c, m] of Object.entries(co.mats)) {
      const cm = COMMODITIES[c];
      if (cm.stock === false) continue;
      const keep = [];
      for (const o of m.orders) {
        if (o.eta <= s.month) {
          m.qty += o.qty; m.val += o.qty * o.unit;
          if (o.terms === 'net30') apNew += o.qty * o.unit;
        } else keep.push(o);
      }
      m.orders = keep;
    }
    const usageFc = {};
    for (const p of activeProducts) {
      const ps = co.products[p.id];
      // plan purchases against what you can actually make: forecast demand, capped near last month's output
      let base = ps.fc || 0;
      if (ps.prod > 0 && ps.lost > ps.sold * 0.05) base = Math.min(base, ps.prod * 1.2);
      const fcUnits = p.recurring ? 0 : base * (ind.storable ? 1 + co.bufferWeeks / 4.33 * 0.3 : 1);
      for (const [c, q] of Object.entries(bomOf(co, p))) usageFc[c] = (usageFc[c] || 0) + fcUnits * q;
    }
    for (const [c, m] of Object.entries(co.mats)) {
      const cm = COMMODITIES[c];
      if (cm.stock === false) continue;
      m.usage = usageFc[c] || 0;
      if (!m.usage) continue;
      if (m.sup === 'F' && !co.farms[c]) m.sup = defaultSupplier(c, city);
      const t = supplierTerms(s, co, c, m.sup);
      const pipeline = m.qty + m.orders.reduce((a, o) => a + o.qty, 0);
      let qty = m.usage * (t.lead + 1 + m.cover) - pipeline;
      if (qty <= m.usage * 0.05) continue;
      if (t.cap && qty > t.cap) {
        // the partner farm can only grow so much; buy the rest from your usual supplier
        const extra = qty - t.cap; qty = t.cap;
        const alt = m.prevSup && m.prevSup !== 'F' ? m.prevSup : defaultSupplier(c, city);
        const at = supplierTerms(s, co, c, alt), au = buyPrice(s, co, c, alt);
        const eta2 = s.month + at.lead;
        if (at.terms === 'prepay') { co.cash -= extra * au; }
        if (eta2 <= s.month) { m.qty += extra; m.val += extra * au; if (at.terms === 'net30') apNew += extra * au; }
        else m.orders.push({ qty: extra, unit: au, eta: eta2, terms: at.terms, sup: alt, placed: s.month });
      }
      const unit = buyPrice(s, co, c);
      if (t.terms === 'prepay') {
        const maxAff = Math.max(0, co.cash - 0) / unit;
        qty = Math.min(qty, maxAff);
        if (qty <= 0) continue;
      }
      let eta = s.month + t.lead;
      let note = null;
      if (rand(s) > t.rel) {
        eta += 1;
        if (rand(s) < 0.3) { qty *= 0.6; note = 'short-shipped'; }
        else note = 'delayed';
        if (!s.silent) news(`${t.name}: your ${cm.name.toLowerCase()} shipment was ${note}${note === 'delayed' ? ' a month' : ' (60% delivered)'}.`, 'bad');
      }
      const o = { qty, unit, eta, terms: t.terms, sup: m.sup, placed: s.month };
      if (t.terms === 'prepay') { co.cash -= qty * unit; cashOut.purchasesPrepay += qty * unit; }
      if (eta <= s.month) { m.qty += qty; m.val += qty * unit; if (t.terms === 'net30') apNew += qty * unit; }
      else m.orders.push(o);
    }

    // 4. Production & sales
    const opsAvailHrs = co.staff.ops * 160 * prod;
    let crewNeed = 0;
    for (const f of active) crewNeed += facDef(co, f).crew || 0;
    let opsUtil = 0, capUtil = 0, laborLimited = false, capLimited = false, matLimited = {};
    if (isPT) {
      const opsRatio = crewNeed > 0 ? Math.min(1, (co.staff.ops * prod) / crewNeed) : 1;
      opsUtil = crewNeed > 0 ? crewNeed / Math.max(0.01, co.staff.ops * prod) : 0;
      laborLimited = opsRatio < 0.999;
      const qp = co.products[ind.products[0].id];
      const qf = 0.85 + 0.3 * qEff(co, ind.products[0]) / 100;
      const capFx = fxMul(co, 'capacity');
      for (const p of ind.products) { st.units[p.id] = 0; st.revBy[p.id] = 0; }
      if (co.mats.natgas) co.mats.natgas.usage = 0;
      for (const f of active) {
        const fd = facDef(co, f), fc = cityById[f.city];
        const r = fd.staffed ? opsRatio : 1;
        const outs = {};
        if (fd.out) {
          const q = resQ(fc, fd.res);
          for (const [pid, amt] of Object.entries(fd.out)) outs[pid] = amt * q * qf * r * capFx / (1 + fd.decline * f.age);
        } else if (fd.tech === 'solar' || fd.tech === 'wind') {
          outs.mwh = fd.mw * 730 * (fd.tech === 'solar' ? fc.solarCF : fc.windCF) * 0.97 * qf * r * capFx;
        } else if (fd.tech === 'battery') {
          outs.grid = fd.mw * r * qf * capFx;
        } else if (fd.tech === 'gas') {
          outs.mwh = fd.mw * 730 * 0.15 * r * capFx; outs.grid = fd.mw * r * capFx;
        }
        for (const [pid, u] of Object.entries(outs)) {
          const p = ind.products.find(x => x.id === pid);
          let price;
          if (p.market === 'crude') price = s.prices.crude * p.priceMult;
          else if (p.market === 'natgas') price = s.prices.natgas * p.priceMult;
          else if (p.market === 'ppa') price = ppaPrice(s, fc) * (fd.tech === 'gas' ? 1.6 : 1);
          else price = capPrice(s, fc);
          const fixedPPA = fxList(co, 'ppaLock').find(x => x.city === f.city && pid === 'mwh');
          if (fixedPPA) price = fixedPPA.price;
          const rev = u * price;
          st.units[pid] += u; st.revBy[pid] += rev; st.rev += rev;
          st.cogsVar += u * p.var * s.macro.cpi;
          st.cogsRoy += rev * ((p.royalty || 0) + (p.sevTax || 0));
          if (fd.tech === 'gas' && pid === 'mwh') {
            const gasQty = u * 8.5; const gp = buyPrice(s, co, 'natgas');
            st.cogsFuel += gasQty * gp; apNew += gasQty * gp; co.mats.natgas.usage += gasQty;
          }
        }
        st.cogsSite += facLease(s, co, f);
      }
      for (const p of ind.products) { const ps = co.products[p.id]; ps.sold = st.units[p.id]; ps.prod = ps.sold; ps.rev = st.revBy[p.id]; ps.dem = ps.sold; ps.lost = 0; }
    } else {
      // set-price products
      const capFx = fxMul(co, 'capacity');
      let staffedCap = 0, tollCap = 0, tollCost = 0, elecW = 0, elecWt = 0;
      const capByFac = [];
      for (const f of active) {
        const fd = facDef(co, f);
        if (!fd.cap) continue;
        const cap = fd.cap * capFx;
        if (fd.staffed) { staffedCap += cap; elecW += elecPrice(s, cityById[f.city]) * cap; elecWt += cap; }
        else { tollCap += cap; tollCost += cap * fd.toll * s.macro.cpi * (fd.offshore ? s.macro.tariff : 1); }
        capByFac.push({ f, fd, cap });
        st.cogsSite += facLease(s, co, f);
      }
      const tollRate = tollCap > 0 ? tollCost / tollCap : 0;
      const elecAvg = elecWt > 0 ? elecW / elecWt : elecPrice(s, city);
      const need = {};
      let D = 0, Lsum = 0;
      for (const p of activeProducts) {
        if (p.recurring) continue;
        const ps = co.products[p.id];
        const d = dem[p.id].tot;
        let n = d;
        if (ind.storable) {
          const nextFc = ps.fc * ind.season[calMonth(s.month + 1)] / ind.season[calMonth(s.month)];
          n = Math.max(0, d + nextFc * co.bufferWeeks / 4.33 - ps.fg);
        }
        need[p.id] = n; D += n * (p.capW || 1); Lsum += n * (p.labor || 0);
      }
      const L = D > 0 ? Lsum / D : 0;
      const hasStaffedFacilities = staffedCap > 0;
      const opsHrsForProd = Math.max(0, opsAvailHrs - crewNeed * 160);
      const staffedUsable = L > 0 && hasStaffedFacilities ? Math.min(staffedCap, opsHrsForProd / L) : staffedCap;
      if (L > 0 && hasStaffedFacilities && opsHrsForProd / L < staffedCap && D > staffedUsable + tollCap) laborLimited = true;
      const totalUsable = staffedUsable + tollCap;
      const sfrac = D > 0 ? Math.min(1, totalUsable / D) : 0;
      if (D > 0 && totalUsable < D * 0.999 && !laborLimited) capLimited = true;
      const plan = {};
      for (const pid of Object.keys(need)) plan[pid] = need[pid] * sfrac;
      // materials limits
      const req = {};
      for (const p of activeProducts) if (plan[p.id]) for (const [c, q] of Object.entries(bomOf(co, p))) req[c] = (req[c] || 0) + plan[p.id] * q;
      const ratio = {};
      let expedite = 0;
      for (const [c, r] of Object.entries(req)) {
        if (COMMODITIES[c].stock === false) { ratio[c] = 1; continue; }
        const m = co.mats[c];
        if (co.emergencyBuy && m.qty < r) {
          // expedite the shortfall: local distributor or air freight at a steep premium, paid now
          const unit = Math.max(...supplierOptions(s, co, c).filter(t => t !== 'V' && t !== 'F').map(t => supplierTerms(s, co, c, t).price)) * tierOf(co, c).mult * 1.4;
          const short = r - m.qty;
          const q = Math.min(short, Math.max(0, co.cash) / unit);
          if (q > 0) { m.qty += q; m.val += q * unit; co.cash -= q * unit; expedite += q * unit; m.expedited = (m.expedited || 0) + q; }
        }
        ratio[c] = r > 0 ? Math.min(1, m.qty / r) : 1;
        if (ratio[c] < 0.999) matLimited[c] = true;
      }
      if (expedite > 2000 && !s.silent) news(`Production nearly stopped for lack of materials. You expedited ${fmt$(expedite)} of emergency supply at a 40% premium.`, 'bad');
      const made = {};
      let U = 0;
      for (const p of activeProducts) {
        if (!plan[p.id]) { made[p.id] = 0; continue; }
        let r = 1;
        for (const c of Object.keys(p.bom || {})) r = Math.min(r, ratio[c]);
        made[p.id] = plan[p.id] * r; U += made[p.id] * (p.capW || 1);
      }
      // consume materials
      const matCostBy = {};
      for (const p of activeProducts) {
        matCostBy[p.id] = 0;
        if (!made[p.id]) continue;
        for (const [c, q] of Object.entries(bomOf(co, p))) {
          const used = made[p.id] * q;
          const m = co.mats[c];
          if (COMMODITIES[c].stock === false) {
            const cost = used * buyPrice(s, co, c);
            matCostBy[p.id] += cost; apNew += cost; m.usage = (m.usage || 0);
          } else {
            const avg = m.qty > 0 ? m.val / m.qty : 0;
            const u2 = Math.min(used, m.qty);
            m.qty -= u2; m.val = Math.max(0, m.val - u2 * avg);
            matCostBy[p.id] += u2 * avg;
          }
        }
      }
      const staffedUsed = Math.min(U, staffedUsable);
      const tollUsed = Math.max(0, U - staffedUsed);
      opsUtil = opsHrsForProd > 0 ? (staffedUsed * L) / opsHrsForProd : (L > 0 && staffedUsed > 0 ? 9 : 0);
      capUtil = (staffedCap + tollCap) > 0 ? U / (staffedCap + tollCap) : 0;
      const tollTotal = tollUsed * tollRate;
      tollPaid = tollTotal;
      const staffShare = U > 0 ? staffedUsed / U : 0;
      // regional freight multiplier weighted by capacity location
      const totalCapW = capByFac.reduce((a, x) => a + x.cap, 0) || 1;
      const rfm = [0, 1, 2, 3].map(i => capByFac.length ? capByFac.reduce((a, x) => a + x.cap / totalCapW * (x.fd.offshore ? 1.15 * city.inbound : regionFreight(co, cityById[x.f.city], i)), 0) : regionFreight(co, null, i));
      for (const p of activeProducts) {
        if (p.recurring) continue;
        const ps = co.products[p.id];
        const u = made[p.id] || 0;
        const cw = U > 0 ? u * (p.capW || 1) / U : 0;
        const tollShare = tollTotal * cw;
        const energy = u * (p.kwh || 0) * elecAvg * staffShare;
        st.cogsEnergy += energy;
        const unitCost = u > 0 ? (matCostBy[p.id] + tollShare) / u : 0;
        st.cogsToll += tollShare;
        let soldUnits, cogsMatSold;
        if (ind.storable) {
          ps.fg += u; ps.fgVal += u * unitCost;
          soldUnits = Math.min(dem[p.id].tot, ps.fg);
          const avg = ps.fg > 0 ? ps.fgVal / ps.fg : 0;
          cogsMatSold = soldUnits * avg;
          ps.fg -= soldUnits; ps.fgVal = Math.max(0, ps.fgVal - cogsMatSold);
          // storable: toll & materials capitalized into inventory, expensed when sold
          st.cogsToll -= tollShare;
          st.cogsMat += cogsMatSold;
        } else {
          soldUnits = Math.min(dem[p.id].tot, u);
          st.cogsMat += matCostBy[p.id];
        }
        const d = dem[p.id];
        const share = d.tot > 0 ? d.byR.map(x => x / d.tot) : [1, 0, 0, 0];
        const fm = share.reduce((a, x, i) => a + x * rfm[i], 0);
        const varMult = (1 + (fm - 1) * (ind.freightShare || 0)) * (p.varEcon ? (1 + 1.5 * (1 - ECON[s.macro.econ].mult) / 0.12) : 1);
        st.cogsVar += soldUnits * p.var * s.macro.cpi * varMult;
        // where each unit was sold decides the price you realize: retail accounts take a cut, your own
        // stores and website sell at retail but carry their own costs
        const disc = fxList(co, 'natDiscount').reduce((a, f) => a * f.v, 1);
        let pm = 0, va = 0;
        share.forEach((x, i) => { const ch = co.regions[i].chan; pm += x * (ch ? ch.pm : 1) * (i === 2 ? disc : 1); va += x * (ch ? ch.va : 0); });
        const rev = soldUnits * ps.price * pm;
        st.cogsVar += soldUnits * ps.price * va;
        ps.dem = d.tot; ps.sold = soldUnits; ps.lost = Math.max(0, d.tot - soldUnits); ps.prod = u; ps.rev = rev;
        ps.unitCost = soldUnits > 0 ? (cogsMatSold != null ? cogsMatSold / soldUnits : unitCost) + p.var * s.macro.cpi * varMult + ps.price * va + (p.kwh || 0) * elecAvg * staffShare : 0;
        ps.realized = pm * ps.price;
        ps.regionSold = share.map(x => x * soldUnits);
        st.rev += rev; st.revBy[p.id] = rev; st.units[p.id] = soldUnits;
        ps.fc = ps.fc * 0.5 + d.tot * 0.5;
      }
      // storable: toll was added to inventory not expense; cogsMat holds cost of goods sold
    }

    // 5. Recurring products
    let supportNeed = 0;
    const opsNeedRec = ind.recurring ? (co.hist.length ? co.hist[co.hist.length - 1].rev : 0) / 150000 : 0;
    for (const p of activeProducts) {
      if (!p.recurring) continue;
      const ps = co.products[p.id];
      supportNeed += ps.customers / p.recurring.support;
    }
    const supportShort = supportNeed > 0 ? Math.max(0, 1 - co.staff.support * prod / supportNeed) : 0;
    const opsShort = opsNeedRec > 0 ? Math.max(0, 1 - co.staff.ops * prod / opsNeedRec) : 0;
    for (const p of activeProducts) {
      if (!p.recurring) continue;
      const ps = co.products[p.id];
      const d = productDemand(s, co, p, ps);
      const target = d.tot;
      const gain = Math.max(0, target - ps.customers) * 0.12 * Math.exp(0.08 * randn(s));
      const priceChurn = Math.pow(Math.max(0.2, ps.price) / refPrice(s, co, p), 0.5);
      const churnRate = p.recurring.churn * (1.7 - 1.4 * qEff(co, p) / 100) * (1 + 0.8 * supportShort) * (1 + 0.5 * opsShort) * priceChurn * fxMul(co, 'churn');
      let churned = ps.customers * churnRate;
      if (ps.customers > target) churned += (ps.customers - target) * 0.04;
      ps.customers = Math.max(0, ps.customers + gain - churned);
      ps.dem = target; ps.newCust = gain; ps.churned = churned; ps.churnRate = churnRate;
      const rev = ps.customers * ps.price;
      ps.rev = rev; ps.sold = ps.customers;
      ps.regionSold = d.tot > 0 ? d.byR.map(x => x / d.tot * ps.customers) : [ps.customers, 0, 0, 0];
      st.rev += rev; st.revBy[p.id] = rev; st.units[p.id] = ps.customers;
      let cloud = 0;
      for (const [c, q] of Object.entries(p.bom || {})) { const cost = ps.customers * q * buyPrice(s, co, c); cloud += cost; co.mats[c].usage = (co.mats[c].usage || 0) + ps.customers * q; }
      st.cogsMat += cloud; apNew += cloud;
      const varMult = p.varEcon ? (1 + 1.5 * (1 - ECON[s.macro.econ].mult) / 0.12) : 1;
      st.cogsVar += ps.customers * p.var * s.macro.cpi * varMult;
      ps.unitCost = ps.customers > 0 ? (cloud + ps.customers * p.var * s.macro.cpi * varMult) / ps.customers : 0;
    }
    for (const c of Object.keys(co.mats)) if (COMMODITIES[c].stock === false && !activeProducts.some(p => p.bom && p.bom[c]) && c !== 'natgas') co.mats[c].usage = 0;

    // spoilage
    for (const [c, m] of Object.entries(co.mats)) {
      const sp = COMMODITIES[c].spoil;
      if (sp > 0 && m.qty > 0) { const lost = m.val * sp; m.qty *= 1 - sp; m.val -= lost; st.cogsSpoil += lost; }
    }

    // 6. Labor, morale, attrition
    const pay = payroll(s, co);
    const opsPay = co.staff.ops * salary(s, co, 'ops');
    st.cogsLabor = opsPay;
    const ceoSal = s.ceo.salary / 12 * LOAD;
    const otherPay = pay - opsPay + ceoSal;
    const lastRev = co.hist.length ? co.hist[co.hist.length - 1].rev : 0;
    let mTarget = 55 + (co.payPolicy - 1) * 120 + (st.rev > lastRev * 1.02 ? 5 : 0) - (opsUtil > 0.97 ? 10 : 0) + fxAdd(co, 'moraleT');
    co.morale = clamp(co.morale + (mTarget - co.morale) * 0.15 + 1.5 * randn(s), 5, 98);
    let quits = 0;
    for (const d of DEPTS) {
      const n = co.staff[d];
      if (!n) continue;
      const rate = 0.012 + 0.025 * Math.max(0, (60 - co.morale) / 60);
      let q = 0;
      if (n < 20) { for (let i = 0; i < n; i++) if (rand(s) < rate) q++; }
      else q = Math.round(n * rate * (0.8 + 0.4 * rand(s)));
      if (!q) continue;
      quits += q;
      if (co.autoBackfill) { acc.recruit += q * salary(s, co, d) * 12 / LOAD * (d === 'ops' ? 0.04 : 0.12); co.cash -= q * salary(s, co, d) * 12 / LOAD * (d === 'ops' ? 0.04 : 0.12); }
      else co.staff[d] -= q;
    }
    co.lastQuits = quits;

    // 7. Marketing & reach
    // marketing is spent where you are actually available: the reached population of each region
    const covered = (r) => Math.max(20000, r.pop * Math.max(r.reach, 0.02));
    const totW = co.regions.filter(r => r.unlocked).reduce((a, r) => a + Math.pow(covered(r), 0.85), 0);
    const totW01 = co.regions.filter((r, i) => r.unlocked && i <= 1).reduce((a, r) => a + Math.pow(covered(r), 0.85), 0) || 1;
    const avgQ = activeProducts.length ? activeProducts.reduce((a, p) => a + qEff(co, p), 0) / activeProducts.length : 50;
    // each channel has diminishing returns; spreading money across channels works better than piling into one
    const coveredAll = co.regions.filter(r => r.unlocked).reduce((a, r) => a + covered(r), 0);
    let effAll = 0, effLocal = 0;
    const satOf = (ch) => ch.sat * (3000 + 0.003 * coveredAll);
    const chEff = {};
    for (const ch of channelsFor(co)) {
      const b = co.mkt[ch.id] || 0;
      if (b <= 0) continue;
      const S = satOf(ch);
      const base = ind.b2b && ch.b2bBase ? ch.b2bBase : ch.base;
      let e = base * S * Math.log(1 + b / S);
      if (ch.min && b < ch.min) e *= 0.3;
      chEff[ch.id] = 1 - Math.exp(-b / S);
      if (ch.regions) effLocal += e; else effAll += e;
    }
    co._searchLift = 1 + 0.12 * (chEff.search || 0);
    co._prQ = 4 * (chEff.pr || 0);
    co._pitchBonus = 0.18 * (chEff.trade || 0) + 0.1 * (chEff.sampling || 0);
    if ((co.mkt.influencer || 0) >= 1500 && !s.silent && activeProducts.length && rand(s) < 0.012 + co.mkt.influencer / 2e6) {
      const vp = pick(s, activeProducts);
      addFx(s, co, 'demand', 1.5, 1, { p: vp.id });
      news(`A creator's video about your ${vp.name.toLowerCase()} took off. Demand is spiking.`, 'good', true);
    }
    // farmers markets, pop-ups and flagships also build awareness at home
    for (const st0 of co.stores) { const sd = STOREFRONTS.find(x => x.id === st0.type); if (sd && sd.aw && co.regions[st0.region]) co.regions[st0.region].aw = Math.min(0.95, co.regions[st0.region].aw + sd.aw * 0.25); }
    // own stores: pop-ups expire
    co.stores = co.stores.filter(x => !(x.until != null && x.until < s.month));
    let coverPop = 0;
    if (ind.reach.mode === 'locations') for (const f of active) coverPop += facDef(co, f).cover || 0;
    co.regions.forEach((r, i) => {
      if (!r.unlocked || ind.reach.mode === 'none') return;
      const share = Math.pow(covered(r), 0.85) / totW;
      const popShare = r.pop / co.regions.filter(x => x.unlocked).reduce((a, x) => a + x.pop, 0);
      const spend = effAll * share + (i <= 1 ? effLocal * Math.pow(covered(r), 0.85) / totW01 : 0);
      const g = 1 - Math.exp(-spend / (ind.cpp * Math.pow(covered(r), 0.85)));
      let soldR = 0, potR = 0;
      for (const p of activeProducts) { const ps = co.products[p.id]; soldR += (ps.regionSold ? ps.regionSold[i] : 0) / (p.recurring ? 10 : 1); potR += regionPot(s, co, p, r, i) / (p.recurring ? 10 : 1); }
      const wom = potR > 0 ? 0.08 * (soldR / (potR * Math.max(r.reach, 0.02))) * (0.55 + 0.9 * avgQ / 100) : 0;
      r.aw = clamp(r.aw * (1 - ind.decay) + (1 - r.aw) * (g + wom), 0, 0.97);
      let tgt;
      if (ind.reach.mode === 'locations') {
        // fill nearest regions first
        let before = 0;
        for (let j = 0; j < i; j++) if (co.regions[j].unlocked) before += co.regions[j].pop;
        const cov = clamp(coverPop - before, 0, r.pop);
        tgt = Math.min(ind.reach.max, cov / r.pop);
        r.reach += (tgt - r.reach) * 0.5;
      } else {
        const repsR = (i === 0 ? founderReps(s, co) : 0) + co.staff.sales * prod * popShare;
        const comp = { reps: (ind.reach.base || 0) + repsR * ind.reach.perRep / r.pop * (1 + (co._pitchBonus || 0)) };
        if (ind.reach.channels) {
          const tour = 1 + city.tourism * s.macro.tourism * 0.8;
          for (const id of Object.keys(co.accounts)) { const a = ACCOUNTS.find(x => x.id === id); if (a && a.region === i) comp['a:' + id] = a.cover * (a.tour && i <= 1 ? tour : 1); }
          if (co.web) comp.web = 0.03 + 0.12 * r.aw;
          let sc = 0;
          for (const x of co.stores) if (x.region === i) sc += STOREFRONTS.find(y => y.id === x.type).cover;
          if (sc) comp.stores = sc / r.pop;
          // brokers and independent stores need less of your own sales force once chains carry you
          comp.reps = Math.min(comp.reps, 0.5);
        }
        const raw = Object.values(comp).reduce((a, x) => a + x, 0);
        tgt = Math.min(ind.reach.max, raw);
        // realized price and extra variable cost depend on the channel mix
        let pm = 0, va = 0, lag = 0;
        for (const [k, v] of Object.entries(comp)) {
          const w = raw > 0 ? v / raw : 0;
          if (k === 'reps') pm += w;
          else if (k === 'web') { pm += w * WEBSTORE.mult; va += w * WEBSTORE.varAdd * (co.city === 'honolulu' && i >= 2 ? 1.3 : 1); }
          else if (k === 'stores') pm += w * 2.0;
          else { const a = ACCOUNTS.find(x => 'a:' + x.id === k); pm += w * a.mult; va += w * (a.varAdd || 0); lag += w * (a.lag || 0); }
        }
        r.chan = { comp, raw, pm: raw > 0 ? pm : 1, va, lag };
        r.reach += (tgt - r.reach) * 0.25;
      }
    });

    // 8. R&D & quality
    const rdEff = co.staff.rd * prod + founderRD(s, co) / 10;
    co.rdPts += co.staff.rd * prod * 10 + founderRD(s, co);
    const nA = Math.max(1, isPT ? 1 : activeProducts.length);
    for (const p of ind.products) {
      const ps = co.products[p.id];
      if (!ps.active) continue;
      ps.q = clamp(ps.q + 0.6 * Math.sqrt(rdEff / nA) * (1 - ps.q / 100) - (ind.qDecay != null ? ind.qDecay : 0.15) - (opsShort > 0.3 ? 0.3 : 0), 15, 99);
    }
    // product-development projects
    const devSpeed = co.staff.rd > 0 ? Math.min(2, 1 + co.staff.rd / 20) : 0.5;
    for (const p of ind.products) {
      const ps = co.products[p.id];
      for (const [uid2, left] of Object.entries(ps.projects || {})) {
        const nl = left - devSpeed;
        if (nl > 0) { ps.projects[uid2] = nl; continue; }
        delete ps.projects[uid2];
        const u = upgradesFor(co, p).find(x => x.id === uid2);
        if (!u) continue;
        ps.done.push(uid2);
        ps.qBonus = (ps.qBonus || 0) + u.q;
        if (u.mat) ps.bomMult = (ps.bomMult || 1) * u.mat;
        if (u.demand) ps.demandMult = (ps.demandMult || 1) * u.demand;
        if (u.demandHome) ps.homeMult = (ps.homeMult || 1) * u.demandHome;
        if (!s.silent) news(`Product development: "${u.name}" is done for ${p.name.toLowerCase()} (+${u.q} quality).`, 'good');
      }
    }
    for (const p of ind.products) { const ps = co.products[p.id]; if (!ps.unlocked && p.unlock && co.rdPts >= p.unlock) { ps.unlocked = true; if (!s.silent) news(`R&D milestone: ${p.name} is ready to launch (one-time launch cost ${fmt$(p.launch || 0)}).`, 'good'); } }

    // retail accounts can drop you for poor quality or empty shelves
    if (ind.reach.channels && !s.silent && activeProducts.length) {
      const bestQ = Math.max(...activeProducts.map(p => qEff(co, p)));
      const demT = activeProducts.reduce((a, p) => a + (co.products[p.id].dem || 0), 0), lostT = activeProducts.reduce((a, p) => a + (co.products[p.id].lost || 0), 0);
      for (const id of Object.keys(co.accounts)) {
        const a = ACCOUNTS.find(x => x.id === id);
        if (!a) continue;
        if (bestQ < a.minQ - 6) { delete co.accounts[id]; co.acctCool[id] = s.month + 6; news(`${a.name} dropped your line: quality fell below what their shoppers expect.`, 'bad'); }
        else if (demT > 0 && lostT / demT > 0.3 && a.slot > 0 && rand(s) < 0.25) { delete co.accounts[id]; co.acctCool[id] = s.month + 6; news(`${a.name} pulled you from the shelves after repeated out-of-stocks.`, 'bad'); }
      }
    }
    let chanCost = 0;
    for (const id of Object.keys(co.accounts)) { const a = ACCOUNTS.find(x => x.id === id); if (a) chanCost += a.fee; }
    if (co.web) chanCost += WEBSTORE.monthly;
    for (const x of co.stores) chanCost += STOREFRONTS.find(y => y.id === x.type).monthly * city.officeRent / 40;
    chanCost *= s.macro.cpi;
    // 9. Overheads
    const officeHeads = headcount(co) - co.staff.ops + 1;
    const office = officeHeads * 175 * city.officeRent / 12 * s.macro.cpi;
    const gaOther = (1500 + headcount(co) * 150 + st.rev * 0.006) * s.macro.cpi * fxMul(co, 'fixedCost');
    const grt = st.rev * city.grossTax[ind.retail ? 0 : 1];
    const regionUpkeep = co.regions.reduce((a, r, i) => a + (r.unlocked && i > 0 ? (ind.regionCost[i] || 0) * 0.004 : 0), 0) * s.macro.cpi;

    // 10. Finance
    let interest = 0, principal = 0;
    const pr = prime(s);
    for (const l of co.loans) {
      const rate = (l.floating ? pr + l.spread : l.rate) / 100;
      const i = l.bal * rate / 12;
      interest += i;
      if (l.kind === 'revolver') continue;
      if (l.io) {
        l.left--;
        if (l.left <= 0) { principal += l.bal; l.bal = 0; }
      } else {
        const n = Math.max(1, l.left);
        const r = rate / 12;
        const pmt = r > 0 ? l.bal * r / (1 - Math.pow(1 + r, -n)) : l.bal / n;
        const pp = Math.min(l.bal, pmt - i);
        principal += pp; l.bal -= pp; l.left--;
      }
    }
    co.loans = co.loans.filter(l => l.bal > 1 || l.kind === 'revolver');

    // 11. Statement
    const cogs = st.cogsMat + st.cogsToll + st.cogsEnergy + st.cogsVar + st.cogsRoy + st.cogsLabor + st.cogsSite + st.cogsSpoil + st.cogsFuel;
    const oneTime = acc.recruit + acc.severance + acc.launch + acc.expansion + acc.events;
    const opex = otherPay + co.marketing + office + gaOther + grt + regionUpkeep + oneTime + chanCost;
    const ebitda = st.rev - cogs - opex;
    const ebit = ebitda - dep;
    const ebt = ebit - interest + acc.otherInc;
    let tax = 0;
    if (ebt < 0) co.nol += -ebt;
    else {
      const use = Math.min(co.nol, ebt * 0.8);
      co.nol -= use;
      tax = (ebt - use) * (0.21 + city.stateTax * 0.79);
    }
    const ni = ebt - tax;

    // 12. Cash
    // retail chains pay slower than farmers-market shoppers: weight each market's payment lag by what sold there
    const soldBy = [0, 1, 2, 3].map(i => activeProducts.reduce((a, p) => a + ((co.products[p.id].regionSold || [])[i] || 0) * (co.products[p.id].price || 0), 0));
    const soldTot = soldBy.reduce((a, x) => a + x, 0);
    const chanLag = soldTot > 0 ? co.regions.reduce((a, r, i) => a + (r.chan ? r.chan.lag : 0) * soldBy[i] / soldTot, 0) : 0;
    const lag = clamp(ind.lag + fxAdd(co, 'lag') + chanLag, 0, 2);
    const arPrev = co.ar;
    const arNew = st.rev * Math.min(1, lag) + (lag > 1 ? st.rev * (lag - 1) : 0);
    const collections = st.rev - arNew + arPrev;
    co.ar = arNew;
    const apPrev = co.ap;
    co.ap = apNew;
    // contract-manufacturing fees are paid in cash when units are made (capitalized into inventory for storable goods)
    const cashCosts = st.cogsEnergy + st.cogsVar + st.cogsRoy + st.cogsLabor + st.cogsSite + tollPaid + otherPay + co.marketing + office + gaOther + grt + regionUpkeep + chanCost;
    co.cash += collections - apPrev - cashCosts - interest - principal - tax;
    co.cash += acc.otherInc;
    s.ceo.cash += s.ceo.salary / 12 * 0.68;

    // inventory value
    let invVal = 0;
    for (const m of Object.values(co.mats)) invVal += m.val;
    for (const p of ind.products) invVal += co.products[p.id].fgVal || 0;
    const ppe = co.facilities.reduce((a, f) => a + (f.status === 'active' ? f.book : f.paid), 0) + co.assets.reduce((a, x) => a + x.book, 0);
    const debt = co.loans.reduce((a, l) => a + l.bal, 0);

    const h = Object.assign(st, {
      m: s.month, cogs, gp: st.rev - cogs, opPay: otherPay, opMkt: co.marketing, opChan: chanCost, opOffice: office, opGA: gaOther + regionUpkeep, opGRT: grt, opOne: oneTime,
      oneDetail: { recruit: acc.recruit, severance: acc.severance, launch: acc.launch, expansion: acc.expansion, events: acc.events },
      opex, ebitda, dep, ebit, interest, otherInc: acc.otherInc, ebt, tax, ni, cash: co.cash, debt, ar: co.ar, ap: co.ap, inv: invVal, ppe,
      capex: acc.capex, principal, heads: headcount(co), morale: co.morale, opsUtil, capUtil, laborLimited, capLimited, matLimited: Object.keys(matLimited), quits
    });
    co.hist.push(h);
    if (co.hist.length > 240) co.hist.shift();
    co.acc = newAcc();

    // 13. Valuation, board, milestones
    const val = valuation(s, co);
    co.valuation = val;
    if (co.public) {
      co.sentiment = clamp(co.sentiment + (1 - co.sentiment) * 0.1 + 0.05 * randn(s), 0.4, 1.8);
      if (calMonth(s.month) % 3 === 2 && co.hist.length >= 6 && !s.silent) {
        const q = co.hist.slice(-3).reduce((a, x) => a + x.rev, 0), pq = co.hist.slice(-6, -3).reduce((a, x) => a + x.rev, 0);
        const exp = pq * (1 + co.board.expect);
        if (q >= exp) { co.sentiment *= 1.08; news(`Earnings beat: quarterly revenue ${fmt$(q)} vs ${fmt$(exp)} expected. The stock jumps.`, 'good', true); co.board.conf = clamp(co.board.conf + 4, 0, 100); }
        else { co.sentiment *= 0.88; news(`Earnings miss: quarterly revenue ${fmt$(q)} vs ${fmt$(exp)} expected. The stock slides.`, 'bad', true); co.board.conf = clamp(co.board.conf - 5, 0, 100); }
      }
      co.sharePrice = val.equity * co.sentiment / co.shares.total;
    }
    if (co.board.seats > 0 || co.public) {
      const m = metrics(co);
      let d = 0;
      if (co.hist.length >= 6) d += m.qGrowth >= co.board.expect ? 1.5 : -Math.min(5, 1.5 + (co.board.expect - m.qGrowth) * 12);
      if (ni > 0) d += 1;
      const burn = -(m.avgNi3);
      if (burn > 0 && co.cash / burn < 4) d -= 3;
      if (co.morale < 35) d -= 1;
      co.board.conf = clamp(co.board.conf + d + (65 - co.board.conf) * 0.03, 0, 100);
      if (co.board.conf < 12 && ceoStake(co) < 0.5 && !s.silent && !s.pendingEvent) {
        s.pendingEvent = { id: 'fired', title: 'The board has voted to remove you as CEO', text: `After months of missed targets, ${co.name}'s board met without you and voted to replace you. You keep your vested shares.`, choices: [{ label: 'Clean out your office', fx: 'fired' }] };
      }
    }
    if (!s.silent) {
      const rr = st.rev * 12;
      for (const [k, th, rep, label] of [['1m', 1e6, 4, '$1M'], ['10m', 10e6, 7, '$10M'], ['100m', 100e6, 10, '$100M'], ['1b', 1e9, 14, '$1B'], ['10b', 10e9, 15, '$10B']]) {
        if (rr >= th && !co.milestones[k]) { co.milestones[k] = s.month; s.ceo.rep = clamp(s.ceo.rep + rep, 0, 100); news(`${co.name} crosses a ${label} annual revenue run-rate.`, 'good', true); }
      }
    }
    co.cooldown = Math.max(0, co.cooldown - 1);
    if (co.termSheet && co.termSheet.expires < s.month + 1) co.termSheet = null;

    // 14. Report & crisis
    const alerts = computeAlerts(s, co);
    co.lastReport = { m: s.month, rev: st.rev, ni, cash: co.cash, alerts };
    if (co.cash < 0) {
      const rv = revolverRoom(s, co);
      if (rv > 0) { const draw = Math.min(rv, -co.cash + 1000); revolver(s, co, draw); news(`Cash went negative; ${fmt$(draw)} was drawn automatically on the revolving credit line.`, 'bad'); h.cash = co.cash; }
    }
    if (co.cash < 0 && !s.silent) co.crisis = { deficit: -co.cash };
    if (co.cash < 0 && s.silent) co.cash = 0;
  }

  function founderReps(s, co) { if (!s.ceo) return 0; const bg = BACKGROUNDS.find(b => b.id === s.ceo.bg) || {}; return headcount(co) > 300 ? 0 : 1 + (bg.salesBonus || 0); }
  function founderRD(s, co) { if (!s.ceo) return 0; const bg = BACKGROUNDS.find(b => b.id === s.ceo.bg) || {}; return co.isFounder ? 5 + (bg.rdBonus || 0) : 2; }

  // ---------- Metrics & valuation ----------
  function metrics(co) {
    const H = co.hist;
    const n = H.length;
    const sum = (a, b, k) => H.slice(Math.max(0, n - b), n - a).reduce((t, x) => t + x[k], 0);
    const r3 = sum(0, 3, 'rev'), p3 = sum(3, 6, 'rev'), y3 = sum(12, 15, 'rev');
    const e3 = sum(0, 3, 'ebitda');
    const len3 = Math.min(3, n) || 1;
    return {
      runRate: r3 / len3 * 12, ebitdaRun: e3 / len3 * 12,
      qGrowth: p3 > 0 ? r3 / p3 - 1 : (r3 > 0 ? 0.5 : 0), yGrowth: y3 > 0 ? r3 / y3 - 1 : (r3 > 0 ? 1 : 0),
      ttmRev: sum(0, 12, 'rev'), ttmEbitda: sum(0, 12, 'ebitda'), ttmNi: sum(0, 12, 'ni'),
      avgNi3: sum(0, 3, 'ni') / len3, avgCashFlow3: n >= 2 ? (H[n - 1].cash - H[Math.max(0, n - 4)].cash) / Math.min(3, n - 1) : 0,
      rdPts: co.rdPts
    };
  }
  function balance(s, co) {
    const ind = indById[co.ind];
    let inv = 0;
    for (const m of Object.values(co.mats)) inv += m.val;
    for (const p of ind.products) inv += co.products[p.id].fgVal || 0;
    const ppe = co.facilities.filter(f => f.status === 'active').reduce((a, f) => a + f.book, 0) + (co.assets || []).reduce((a, x) => a + x.book, 0);
    const cip = co.facilities.filter(f => f.status === 'building').reduce((a, f) => a + f.paid, 0);
    const debt = co.loans.reduce((a, l) => a + l.bal, 0);
    const assets = co.cash + co.ar + inv + ppe + cip;
    return { cash: co.cash, ar: co.ar, inv, ppe, cip, assets, ap: co.ap, debt, liabilities: co.ap + debt, equity: assets - co.ap - debt };
  }
  function valuation(s, co) {
    const ind = indById[co.ind];
    const m = metrics(co), b = balance(s, co);
    const mood = clamp(1.15 - (s.macro.fed - 3) * 0.08, 0.6, 1.4) * (s.macro.econ === 'recession' ? 0.8 : 1) * s.macro.sentiment;
    const g = clamp(m.qGrowth, -0.3, 0.6);
    const growthMult = clamp(1 + 2.5 * g, 0.4, 2.5);
    const margin = m.runRate > 0 ? m.ebitdaRun / m.runRate : -1;
    const evRev = m.runRate * ind.revMult * growthMult * mood * (margin < -0.5 ? 0.7 : 1);
    const evE = m.ebitdaRun > 0 ? m.ebitdaRun * ind.ebitdaMult * mood * (0.8 + 0.8 * clamp(g, 0, 0.5)) : 0;
    const assets = (b.ppe + b.cip) * (ind.priceTaker ? 1.05 : 0.8) + b.inv * 0.6 + b.ar * 0.9;
    const ip = 0.4e6 + co.rdPts * (ind.recurring ? 6000 : 2500);
    const ev = ind.priceTaker ? Math.max(evE, assets, evRev * 0.5) : Math.max(evRev, evE, assets, co.hist.length < 24 ? ip : 0);
    const equity = Math.max(ev + co.cash - b.debt, ev * 0.03);
    return { ev, equity, mood, evRev, evE, assets };
  }
  function ceoStake(co) { return co.shares.ceo / co.shares.total; }

  // ---------- Recommendations ----------
  function recommendedStaff(s, co) {
    const ind = indById[co.ind];
    const prod = productivity(co);
    const active = co.facilities.filter(f => f.status === 'active');
    let crew = 0, staffedCap = 0, tollCap = 0;
    for (const f of active) { const fd = facDef(co, f); crew += fd.crew || 0; if (fd.cap) { if (fd.staffed) staffedCap += fd.cap; else tollCap += fd.cap; } }
    let hrs = 0;
    if (!ind.priceTaker) {
      let D = 0, Lsum = 0;
      for (const p of ind.products) { const ps = co.products[p.id]; if (!ps.active || p.recurring || p.market) continue; const d = ps.fc || ps.dem || 0; D += d * (p.capW || 1); Lsum += d * (p.labor || 0); }
      const staffedNeeded = Math.max(0, Math.min(staffedCap, D * 1.1 - Math.min(tollCap, 0)));
      const L = D > 0 ? Lsum / D : 0;
      const stShare = staffedCap > 0 ? Math.min(1, staffedCap / Math.max(1, D * 1.1)) : 0;
      hrs = L * Math.min(staffedCap, D * 1.1) * (staffedCap > 0 ? 1 : 0);
      void staffedNeeded; void stShare;
    }
    let ops = Math.ceil((hrs / 160 + crew) / Math.max(0.6, prod));
    if (ind.recurring) { const rev = co.hist.length ? co.hist[co.hist.length - 1].rev : 0; ops = Math.ceil(rev / 150000); }
    let support = 0;
    for (const p of ind.products) { const ps = co.products[p.id]; if (ps.active && p.recurring) support += ps.customers / p.recurring.support; }
    support = Math.ceil(support / Math.max(0.6, prod));
    const others = ops + co.staff.sales + co.staff.rd + support;
    const ga = Math.max(0, Math.ceil(others / 15) - 1);
    return { ops, support, ga };
  }

  // ---------- Player actions ----------
  function setStaff(s, co, dept, n) {
    n = Math.max(0, Math.round(n));
    const cur = co.staff[dept];
    if (n === cur) return;
    const sal = salary(s, co, dept);
    if (n > cur) {
      const fee = (n - cur) * sal * 12 / LOAD * (dept === 'ops' ? 0.04 : 0.12);
      co.cash -= fee; co.acc.recruit += fee;
    } else {
      const cut = cur - n;
      const sev = cut * sal * (dept === 'ops' ? 0.5 : 1);
      co.cash -= sev; co.acc.severance += sev;
      const frac = cut / Math.max(1, headcount(co));
      co.morale = clamp(co.morale - Math.min(25, frac * 60), 5, 98);
      if (frac > 0.1 && s._newsNow) s._newsNow(`Layoffs at ${co.name}: ${cut} ${deptName(co, dept).toLowerCase()} roles cut.`, 'bad');
      if (frac > 0.15) s.ceo.rep = clamp(s.ceo.rep - 1, 0, 100);
    }
    co.staff[dept] = n;
  }
  function deptName(co, d) {
    const ind = indById[co.ind];
    return { ops: ind.opsName, sales: 'Sales & marketing', rd: ind.rdName, support: 'Customer support', ga: 'G&A (finance, HR, legal)' }[d];
  }
  function launchProduct(s, co, pid) {
    const p = indById[co.ind].products.find(x => x.id === pid);
    const ps = co.products[pid];
    if (!ps.unlocked) return 'Not enough R&D yet.';
    const cost = (p.launch || 0) * s.macro.cpi;
    if (co.cash < cost) return 'Not enough cash for the launch.';
    co.cash -= cost; co.acc.launch += cost;
    ps.active = true; ps.launched = s.month;
    ps.fc = productDemand(s, co, p, ps).tot;
    return null;
  }
  function unlockRegion(s, co, i) {
    const ind = indById[co.ind];
    const r = co.regions[i];
    if (r.unlocked || (i > 0 && !co.regions[i - 1].unlocked)) return 'Expand into the previous market first.';
    const cost = (ind.regionCost[i] || 0) * s.macro.cpi;
    if (co.cash < cost) return 'Not enough cash.';
    co.cash -= cost; co.acc.expansion += cost;
    r.unlocked = true; r.aw = Math.max(r.aw, 0.005); r.reach = Math.max(r.reach, ind.reach.mode === 'sales' ? Math.min(ind.reach.base || 0.02, 0.6) : 0);
    return null;
  }

  // ---------- Sales channels, stores, product development ----------
  function accountsFor(co) { return ACCOUNTS.filter(a => a.inds.includes(co.ind)); }
  function pitchOdds(s, co, a) {
    const ind = indById[co.ind];
    const r = co.regions[a.region];
    const bestQ = Math.max(0, ...ind.products.filter(p => co.products[p.id].active).map(p => qEff(co, p)));
    if (bestQ < a.minQ) return 0;
    const qEdge = (bestQ - a.minQ) / 40;
    return clamp(a.chance * (0.65 + r.aw * 1.6 + qEdge + Math.min(0.25, co.staff.sales * 0.03) + (co._pitchBonus || 0)), 0.05, 0.95);
  }
  function pitchAccount(s, co, id) {
    const a = ACCOUNTS.find(x => x.id === id);
    if (!a || co.accounts[id]) return { err: 'Already carried there.' };
    if (!co.regions[a.region].unlocked) return { err: 'Enter that market first.' };
    if ((co.acctCool[id] || 0) > s.month) return { err: 'The buyer will not take another meeting yet.' };
    const odds = pitchOdds(s, co, a);
    if (odds <= 0) return { err: 'The buyer needs higher quality than you offer.' };
    const slot = a.slot * s.macro.cpi;
    if (co.cash < slot) return { err: `You need ${fmt$(slot)} for slotting and onboarding.` };
    if (rand(s) < odds) {
      co.cash -= slot; co.acc.expansion += slot;
      co.accounts[id] = { since: s.month };
      return { ok: true, msg: `${a.name} agreed to carry you${slot ? ` (${fmt$(slot)} in slotting and onboarding)` : ''}.` };
    }
    co.acctCool[id] = s.month + 3;
    return { ok: false, msg: `${a.name} passed for now. ${a.minQ > 55 ? 'Buyers mentioned quality and brand awareness.' : 'They want to see more brand awareness.'} You can pitch again in three months.` };
  }
  function dropAccount(co, id) { delete co.accounts[id]; }
  function toggleWeb(s, co) {
    if (co.web) { co.web = false; return null; }
    const c = WEBSTORE.setup * s.macro.cpi;
    if (co.cash < c) return 'Not enough cash.';
    co.cash -= c; co.acc.expansion += c; co.web = true; return null;
  }
  function openStore(s, co, type, region) {
    const sd = STOREFRONTS.find(x => x.id === type);
    if (!co.regions[region] || !co.regions[region].unlocked) return 'Enter that market first.';
    const c = sd.capex * s.macro.cpi * cityById[co.city].officeRent / 40;
    if (co.cash < c) return 'Not enough cash.';
    co.cash -= c; co.acc.expansion += c;
    co.stores.push({ type, region, opened: s.month, until: sd.months ? s.month + sd.months - 1 : null });
    return null;
  }
  function closeStore(co, idx) { co.stores.splice(idx, 1); }
  function setTier(co, c, tier) { if (TIERS[tier]) co.tier[c] = tier; }
  function upgradesFor(co, p) { return (UPGRADES[p.id] || []).concat(UPGRADES['_' + co.ind] || []); }
  function startProject(s, co, pid, uid2) {
    const p = indById[co.ind].products.find(x => x.id === pid), ps = co.products[pid];
    const u = upgradesFor(co, p).find(x => x.id === uid2);
    if (!u || ps.done.includes(uid2) || ps.projects[uid2]) return 'Already done or under way.';
    if (u.rd && co.rdPts < u.rd) return `Needs ${u.rd} R&D points first.`;
    const c = u.cost * s.macro.cpi;
    if (co.cash < c) return 'Not enough cash.';
    co.cash -= c; co.acc.launch += c;
    ps.projects[uid2] = u.months;
    return null;
  }

  // ---------- Debt ----------
  function loanCapacity(s, co) {
    const ind = indById[co.ind];
    const b = balance(s, co), m = metrics(co);
    const secured = co.loans.filter(l => l.kind === 'equipment').reduce((a, l) => a + l.bal, 0);
    const cf = co.loans.filter(l => l.kind === 'term').reduce((a, l) => a + l.bal, 0);
    const out = {};
    out.sba = (!co.sbaUsed && m.runRate < 8e6) ? Math.min(5e6, 250000 + Math.max(0, co.fundedBy) * 4 + b.assets * 0.5) : 0;
    out.revolver = revolverRoom(s, co);
    out.equipment = Math.max(0, 0.65 * (b.ppe + b.cip) - secured);
    out.term = m.ttmEbitda > 0 && co.hist.length >= 12 ? Math.max(0, 3 * m.ttmEbitda - cf) : 0;
    const raisedVC = co.rounds.filter(r => ['seed', 'a', 'b', 'c'].includes(r.id));
    out.venture = raisedVC.length && !ind.priceTaker ? Math.max(0, 0.3 * raisedVC[raisedVC.length - 1].amount - co.loans.filter(l => l.kind === 'venture').reduce((a, l) => a + l.bal, 0)) : 0;
    const debt = b.debt;
    out.bond = m.runRate >= 250e6 && m.ttmEbitda > 0 ? Math.max(0, 4 * m.ttmEbitda - debt) : 0;
    return out;
  }
  function loanRate(s, co, kind) {
    const m = metrics(co), pr = prime(s);
    switch (kind) {
      case 'sba': return { floating: true, spread: 2.75, term: 120, label: 'SBA 7(a) loan' };
      case 'equipment': return { floating: true, spread: m.ttmEbitda > 0 ? 1.75 : 3.0, term: 120, label: 'Equipment / project loan' };
      case 'term': return { floating: true, spread: 2.5, term: 60, label: 'Bank term loan' };
      case 'venture': return { floating: true, spread: 5.0, term: 36, label: 'Venture debt' };
      case 'bond': {
        const lev = m.ttmEbitda > 0 ? (co.loans.reduce((a, l) => a + l.bal, 0)) / m.ttmEbitda : 9;
        const spread = lev < 2 ? 1.4 : lev < 3.5 ? 2.6 : 4.8;
        return { floating: false, rate: s.macro.fed + 0.9 + spread, term: 84, io: true, label: `Senior notes (${lev < 2 ? 'BBB' : lev < 3.5 ? 'BB' : 'B'})` };
      }
      case 'revolver': return { floating: true, spread: 1.5, label: 'Revolving credit line' };
      case 'bridge': return { floating: false, rate: 16, term: 24, label: 'Emergency bridge loan' };
    }
    void pr;
  }
  function takeLoan(s, co, kind, amt) {
    const cap = kind === 'bridge' ? amt : loanCapacity(s, co)[kind];
    amt = Math.min(amt, cap);
    if (amt <= 0) return 'No capacity for that loan.';
    if (kind === 'revolver') return revolver(s, co, amt);
    const t = loanRate(s, co, kind);
    co.loans.push({ id: uid(s), kind, name: t.label, bal: amt, floating: t.floating, spread: t.spread, rate: t.rate, left: t.term, io: !!t.io, orig: amt, start: s.month });
    co.cash += amt;
    if (kind === 'sba') co.sbaUsed = true;
    return null;
  }
  function revolverRoom(s, co) {
    const b = balance(s, co);
    const lim = 0.8 * co.ar + 0.5 * b.inv;
    const rv = co.loans.find(l => l.kind === 'revolver');
    return Math.max(0, lim - (rv ? rv.bal : 0));
  }
  function revolver(s, co, amt) {
    let rv = co.loans.find(l => l.kind === 'revolver');
    if (!rv) { rv = { id: uid(s), kind: 'revolver', name: 'Revolving credit line', bal: 0, floating: true, spread: 1.5, left: 0, io: true }; co.loans.push(rv); }
    rv.bal += amt; co.cash += amt;
    return null;
  }
  function repayLoan(s, co, id, amt) {
    const l = co.loans.find(x => x.id === id);
    if (!l) return;
    amt = Math.min(amt, l.bal, Math.max(0, co.cash));
    l.bal -= amt; co.cash -= amt;
    if (l.bal <= 1 && l.kind !== 'revolver') co.loans = co.loans.filter(x => x !== l);
  }

  // ---------- Equity ----------
  function availableRounds(s, co) {
    const m = metrics(co);
    const done = new Set(co.rounds.map(r => r.id));
    return ROUNDS.filter(r => {
      if (co.public) return false;
      if (r.id === 'ff' && (done.has('ff') || co.rounds.length > 1)) return false;
      if (r.id === 'angel' && ['seed', 'a', 'b', 'c', 'pe'].some(x => done.has(x))) return false;
      if (r.id === 'seed' && ['a', 'b', 'c', 'pe'].some(x => done.has(x))) return false;
      return true;
    }).map(r => ({ r, ok: r.req(m) }));
  }
  function requestTermSheet(s, co, roundId, amount) {
    if (co.cooldown > 0) return `Investors want to see more progress. Try again in ${co.cooldown} month(s).`;
    const r = ROUNDS.find(x => x.id === roundId);
    const m = metrics(co);
    if (!r.req(m)) return 'You do not meet what investors expect for this round yet.';
    amount = clamp(amount, r.min, r.max);
    const val = valuation(s, co);
    const rep = s.ceo.rep;
    const mood = val.mood;
    let chance = 0.45 + rep / 250 + clamp(m.qGrowth, -0.2, 0.4) * 0.8 + (mood - 1) * 0.5;
    if (r.id === 'ff') chance = 0.9;
    if (r.id === 'ipo') chance = 0.6 + (mood - 1);
    co.cooldown = 2;
    if (rand(s) > clamp(chance, 0.1, 0.95)) {
      co.cooldown = 3;
      return `Investors passed on the ${r.name}. Most cited ${m.qGrowth < 0.05 ? 'flat growth' : mood < 0.95 ? 'the market environment' : 'valuation expectations'}.`;
    }
    let pre = Math.max(r.floor * mood * (0.7 + rep / 120), val.equity * (0.85 + 0.35 * rand(s)));
    if (r.id === 'ff') pre = Math.max(1.5e6, val.equity);
    if (r.id === 'ipo') pre = val.equity * (0.95 + 0.25 * rand(s));
    if (r.id === 'pe') pre = Math.max(val.equity, m.ebitdaRun * indById[co.ind].ebitdaMult * 0.9 + co.cash - balance(s, co).debt);
    const maxDil = r.id === 'pe' ? 0.45 : r.id === 'ipo' ? 0.3 : 0.35;
    amount = Math.min(amount, pre * maxDil / (1 - maxDil));
    co.termSheet = { round: r.id, name: r.name, amount, pre, post: pre + amount, dil: amount / (pre + amount), board: r.board, expires: s.month + 1,
      investor: r.id === 'ipo' ? 'Underwriters (Goldman / Morgan Stanley syndicate)' : pick(s, { ff: ['Friends and family'], angel: ['A syndicate of local angels', 'Angel investors via AngelList'], seed: ['Founders Fund', 'First Round', 'Initialized', 'a local seed fund'], a: ['Sequoia', 'Benchmark', 'General Catalyst', 'Accel'], b: ['Insight Partners', 'Lightspeed', 'Bessemer'], c: ['Tiger Global', 'Coatue', 'SoftBank Vision Fund'], pe: ['KKR', 'Blackstone Growth', 'Bain Capital', 'TPG'] }[r.id]) };
    return null;
  }
  function acceptTermSheet(s, co) {
    const t = co.termSheet;
    if (!t) return;
    const fee = t.round === 'ipo' ? t.amount * 0.07 : t.amount * 0.01;
    const newShares = co.shares.total * t.amount / t.pre;
    co.shares.total += newShares;
    co.shares.investors.push({ name: t.investor, shares: newShares, round: t.name });
    co.cash += t.amount - fee;
    co.acc.events += fee;
    co.rounds.push({ id: t.round, name: t.name, amount: t.amount, pre: t.pre, m: s.month });
    co.board.seats += t.board;
    co.board.expect = { ff: 0, angel: 0.05, seed: 0.15, a: 0.12, b: 0.09, c: 0.07, pe: 0.04, ipo: 0.03 }[t.round];
    if (t.round === 'ipo') { co.public = true; co.sentiment = 1.05; co.board.conf = 70; s.ceo.rep = clamp(s.ceo.rep + 12, 0, 100); }
    co.termSheet = null;
    co.cooldown = 4;
    return t;
  }
  function buyback(s, co, amt) {
    if (!co.public) return;
    amt = Math.min(amt, co.cash * 0.9);
    const price = co.sharePrice;
    const shares = amt / price;
    // retire shares pro-rata from investors (public float)
    const inv = co.shares.investors.reduce((a, x) => a + x.shares, 0);
    if (inv <= shares) return;
    for (const x of co.shares.investors) x.shares -= shares * x.shares / inv;
    co.shares.total -= shares; co.cash -= amt;
  }

  // ---------- Crisis resolution ----------
  function crisisOptions(s, co) {
    const b = balance(s, co);
    const deficit = co.crisis ? co.crisis.deficit : 0;
    const secured = co.loans.reduce((a, l) => a + l.bal, 0);
    const collat = b.ppe * 0.5 + co.ar * 0.7 + b.inv * 0.4 - secured * 0.5;
    const val = valuation(s, co);
    return {
      bridge: collat > deficit * 1.3 ? deficit * 1.25 : 0,
      personal: s.ceo.cash > deficit ? deficit * 1.2 : 0,
      downround: (co.shares.investors.length > 0 || co.public) && val.equity > deficit * 3 ? deficit * 1.5 : 0,
      sellable: co.facilities.filter(f => f.status === 'active').map(f => ({ uid: f.uid, name: facDef(co, f).name, proceeds: f.book * 0.55 }))
    };
  }
  function resolveCrisis(s, co, opt, arg) {
    const o = crisisOptions(s, co);
    if (opt === 'bridge' && o.bridge) takeLoan(s, co, 'bridge', o.bridge);
    if (opt === 'personal' && o.personal) {
      const amt = Math.min(s.ceo.cash, o.personal);
      const val = Math.max(valuation(s, co).equity, 1e5);
      const ns = co.shares.total * amt / val;
      co.shares.total += ns; co.shares.ceo += ns; s.ceo.cash -= amt; co.cash += amt; co.fundedBy += amt;
    }
    if (opt === 'downround' && o.downround) {
      const val = valuation(s, co).equity * 0.5;
      const ns = co.shares.total * o.downround / val;
      co.shares.total += ns; co.shares.investors.push({ name: 'Insider down-round', shares: ns, round: 'Emergency round' });
      co.cash += o.downround; co.board.conf = clamp(co.board.conf - 15, 0, 100);
    }
    if (opt === 'sell') sellFacility(s, co, arg);
    if (co.cash >= 0) co.crisis = null; else co.crisis = { deficit: -co.cash };
  }

  // ---------- Career ----------
  function ceoLiving(s) {
    const c = s.co ? cityById[s.co.city] : cityById[s.ceo.home || 'honolulu'];
    return 4200 * c.wage * s.macro.cpi;
  }
  function stepCareer(s) {
    const c = s.ceo;
    c.cash -= ceoLiving(s);
    if (!s.co) { /* between roles */ }
    if (c.cash < 0) c.cash = 0;
    c.months = (c.months || 0) + 1;
    for (const h of c.holdings) if (h.public && h.drift !== false) h.value *= Math.exp(0.006 + 0.05 * randn(s));
    c.offers = c.offers.filter(o => o.expires >= s.month);
  }
  function netWorth(s) {
    const c = s.ceo;
    let nw = c.cash + c.holdings.reduce((a, h) => a + h.value, 0);
    if (s.co) nw += ceoStake(s.co) * (s.co.public ? s.co.sharePrice * s.co.shares.total : (s.co.valuation ? s.co.valuation.equity : 0));
    return nw;
  }
  function endTenure(s, outcome, extra) {
    const co = s.co;
    if (!co) return;
    const m = metrics(co);
    const peak = Math.max(0, ...co.hist.map(h => h.rev)) * 12;
    const stakeVal = ceoStake(co) * (co.valuation ? co.valuation.equity : 0) * (co.public ? co.sentiment : 1);
    s.ceo.history.unshift({ name: co.name, ind: co.ind, city: co.city, from: co.joined != null ? co.joined : co.founded, to: s.month, outcome, peakRunRate: peak, lastRunRate: m.runRate, founder: co.isFounder, stake: ceoStake(co), extra: extra || '' });
    return stakeVal;
  }
  function acceptOffer(s, oid) {
    const o = s.ceo.offers.find(x => x.id === oid);
    if (!o) return;
    if (o.kind === 'acquire') {
      const co = s.co;
      const proceeds = ceoStake(co) * o.price;
      endTenure(s, 'Sold', `Acquired by ${o.buyer} for ${fmt$(o.price)}`);
      s.ceo.cash += proceeds * 0.8; // after capital gains tax
      s.ceo.rep = clamp(s.ceo.rep + 6 + Math.log10(Math.max(1e6, o.price)) - 6, 0, 100);
      s.news.unshift({ m: s.month, text: `${co.name} agrees to be acquired by ${o.buyer} for ${fmt$(o.price)}. Your stake pays out ${fmt$(proceeds)} before taxes.`, tone: 'good', big: true });
      s.co = null; s.ceo.offers = s.ceo.offers.filter(x => x.kind !== 'acquire');
      s.ceo.salary = 0;
      return;
    }
    // job offer
    if (s.co) {
      const co = s.co;
      const stakeVal = endTenure(s, 'Resigned', `Left to run ${o.company}`);
      if (ceoStake(co) > 0) s.ceo.holdings.push({ name: co.name, pct: ceoStake(co), value: stakeVal, public: co.public, since: s.month });
    }
    const co = scaffoldCompany(s, o.ind, o.city, o.revenue, o.company, o.situation);
    co.joined = s.month;
    const grant = co.shares.total * o.equity / (1 - o.equity);
    co.shares.total += grant; co.shares.ceo = grant;
    s.co = co;
    s.ceo.salary = o.salary;
    s.ceo.cash += o.signOn || 0;
    s.ceo.offers = s.ceo.offers.filter(x => x.id !== oid && x.kind !== 'acquire');
    s.news.unshift({ m: s.month, text: `You start as CEO of ${co.name} (${indById[o.ind].name}, ${cityById[o.city].name}).`, tone: 'good', big: true });
  }
  function sellHolding(s, i) {
    const h = s.ceo.holdings[i];
    if (!h) return;
    const proceeds = h.value * (h.public ? 1 : 0.7) * 0.8;
    s.ceo.cash += proceeds;
    s.ceo.holdings.splice(i, 1);
    return proceeds;
  }
  function seekBuyer(s) {
    const co = s.co;
    if (!co || co.hist.length < 6) return 'Buyers want at least six months of financials.';
    if (s.ceo.offers.some(o => o.kind === 'acquire')) return 'You already have an offer on the table.';
    const val = valuation(s, co);
    if (rand(s) < 0.35) { co.cooldown = Math.max(co.cooldown, 2); return 'Your bankers ran a process. No buyer came in above your floor this time.'; }
    makeAcquireOffer(s, co, val, true);
    return null;
  }
  function makeAcquireOffer(s, co, val, solicited) {
    const prem = 1.1 + rand(s) * 0.45 - (solicited ? 0.1 : 0);
    const price = val.equity * prem;
    const buyer = pick(s, indById[co.ind].competitors.filter(x => !/Private|Local|Independent|Small|startups/.test(x)).concat(['Berkshire Hathaway', 'a private-equity consortium', 'a Japanese conglomerate']));
    s.ceo.offers.push({ id: uid(s), kind: 'acquire', buyer, price, prem, expires: s.month + 2, m: s.month });
  }
  function rollOffers(s, news) {
    const c = s.ceo;
    const pJob = s.co ? 0.012 + c.rep / 2200 : 0.35;
    if (rand(s) < pJob && c.offers.filter(o => o.kind === 'job').length < 3) {
      const offer = makeJobOffer(s);
      c.offers.push(offer);
      news(`A headhunter calls: ${offer.company} wants you as CEO.`, 'good', true);
    }
    const co = s.co;
    if (co && co.hist.length > 12 && co.valuation && co.valuation.equity > 8e6 && !c.offers.some(o => o.kind === 'acquire') && rand(s) < 0.015) {
      makeAcquireOffer(s, co, co.valuation, false);
      news(`An unsolicited acquisition offer for ${co.name} has arrived.`, 'good', true);
    }
  }
  function companyName(s, indId) {
    const W = D.COMPANY_WORDS;
    return pick(s, W.a) + ' ' + pick(s, W[indId]);
  }
  function makeJobOffer(s) {
    const c = s.ceo;
    const ind = pick(s, INDUSTRIES);
    let cityList = CITIES;
    if (ind.id === 'oilgas') cityList = CITIES.filter(x => x.oil >= 0.5 || x.gas >= 0.8);
    const city = pick(s, cityList);
    const exp = 6 + c.rep / 26 + (rand(s) - 0.5);
    const revenue = Math.pow(10, clamp(exp, 6.3, 10.3));
    const situation = pick(s, ['growth', 'growth', 'turnaround', 'steady', 'pre-IPO']);
    const salary = Math.round(Math.min(1.8e6, 200000 + Math.sqrt(revenue) * 25) / 10000) * 10000;
    const equity = clamp(0.06 / Math.pow(revenue / 1e7, 0.35), 0.003, 0.08);
    return { id: uid(s), kind: 'job', company: companyName(s, ind.id), ind: ind.id, city: city.id, revenue, situation, salary, equity, signOn: Math.round(salary * 0.25 / 1000) * 1000, expires: s.month + 2, m: s.month };
  }

  // ---------- Build an existing company at scale (for job offers) ----------
  function scaffoldCompany(s, indId, cityId, targetRev, name, situation) {
    const ind = indById[indId], city = cityById[cityId];
    const co = makeCompany(s, { ind: indId, city: cityId, name, isFounder: false });
    co.founded = s.month - 120;
    const scale = clamp(Math.log10(targetRev) - 6, 0, 4.5); // 0 => $1M, 4 => $10B
    co.rdPts = 80 * Math.pow(scale + 1, 2.3);
    for (const p of ind.products) { const ps = co.products[p.id]; if (!p.unlock || co.rdPts >= p.unlock) { ps.unlocked = true; ps.active = true; } ps.q = clamp(55 + scale * 6 + (rand(s) - 0.5) * 10, 40, 92); }
    co.morale = situation === 'turnaround' ? 48 : 66;
    const monthly = targetRev / 12;
    if (ind.priceTaker) {
      // add assets until revenue target met
      const types = ind.facilities.slice().sort((a, b) => b.capex - a.capex);
      let est = 0, guard = 0;
      const sites = (fd) => buildSites(co, fd);
      while (est < monthly && guard++ < 400) {
        const fd = types.find(t => t.capex * 0.12 < targetRev && sites(t).length) || types[types.length - 1];
        const site = sites(fd).includes(city) ? city : pick(s, sites(fd));
        const age = fd.decline ? Math.floor(rand(s) * 48) : 0;
        co.facilities.push({ uid: uid(s), type: fd.id, city: site.id, status: 'active', left: 0, paid: fd.capex, book: fd.capex * (0.4 + 0.5 * rand(s)), age });
        est += estFacilityRevenue(s, co, fd, site, age);
      }
    } else {
      // regions
      let ri = 0;
      const aw = clamp(0.06 + scale * 0.1, 0.06, 0.55), reach = clamp(0.25 + scale * 0.14, 0.25, 0.88);
      co.regions.forEach(r => { r.aw = aw; r.reach = reach; });
      const estRev = () => ind.products.reduce((a, p) => { const ps = co.products[p.id]; if (!ps.active) return a; const d = productDemand(s, co, p, ps).tot; return a + d * ps.price; }, 0);
      while (estRev() < monthly && ri < 3) { ri++; co.regions[ri].unlocked = true; }
      const e = estRev();
      const f = clamp(monthly / Math.max(1, e), 0.05, 1.6);
      co.regions.forEach(r => { r.aw = clamp(r.aw * Math.sqrt(f), 0.01, 0.9); r.reach = clamp(r.reach * Math.sqrt(f), 0.02, ind.reach.max || 0.9); });
      // capacity
      let capNeed = 0;
      for (const p of ind.products) { const ps = co.products[p.id]; if (!ps.active || p.recurring) continue; const d = productDemand(s, co, p, ps).tot; ps.fc = d; capNeed += d * (p.capW || 1) * 1.3; if (p.recurring) ps.customers = d; }
      for (const p of ind.products) { const ps = co.products[p.id]; if (ps.active && p.recurring) ps.customers = productDemand(s, co, p, ps).tot; }
      const fts = ind.facilities.filter(x => x.staffed || !x.toll || ind.facilities.length === 1).slice().reverse();
      let cap = 0, guard = 0;
      while (cap < capNeed && guard++ < 300 && ind.facilities.length) {
        const fd = fts.find(t => t.cap * 0.6 <= capNeed - cap) || fts[fts.length - 1];
        co.facilities.push({ uid: uid(s), type: fd.id, city: city.id, status: 'active', left: 0, paid: fd.capex, book: fd.capex * (0.4 + 0.5 * rand(s)), age: 24 });
        cap += fd.cap;
      }
      if (ind.reach.mode === 'locations') {
        let cov = co.facilities.reduce((a, f) => a + (facDef(co, f).cover || 0), 0);
        const regPop = co.regions.filter(r => r.unlocked).reduce((a, r) => a + r.pop, 0);
        let i = 0;
        while (cov < regPop * reach * 0.5 && i++ < 200) { const fd = ind.facilities[ind.facilities.length - 1]; co.facilities.push({ uid: uid(s), type: fd.id, city: city.id, status: 'active', left: 0, paid: fd.capex, book: fd.capex * 0.6, age: 24 }); cov += fd.cover; }
      }
      // marketing to sustain awareness
      let mk = 0;
      co.regions.forEach(r => { if (!r.unlocked) return; const g = ind.decay * r.aw / Math.max(0.03, 1 - r.aw); mk += -Math.log(1 - Math.min(0.9, g)) * ind.cpp * Math.pow(Math.max(20000, r.pop * r.reach), 0.85); });
      // established companies carry a realistic marketing and sales load for their industry
      const OV = { snacks: [0.07, 2.5e6], beverage: [0.09, 2.5e6], beauty: [0.14, 2e6], apparel: [0.08, 2.5e6], restaurants: [0.04, 0], saas: [0.14, 1.1e6], fintech: [0.12, 2.5e6], electronics: [0.06, 3e6], solar: [0.06, 1.2e6], ev: [0.05, 4e6], airline: [0.03, 0], logistics: [0.02, 2.5e6], datacenter: [0.03, 4e6] }[ind.id] || [0.05, 3e6];
      co.marketing = Math.round(Math.max(mk, targetRev * OV[0] / 12));
      if (ind.reach.mode === 'sales') {
        let reps = 0;
        co.regions.forEach(r => { if (r.unlocked) reps += Math.max(0, (r.reach - (ind.reach.base || 0))) * r.pop / ind.reach.perRep; });
        co.staff.sales = Math.ceil(Math.max(reps * 1.05, targetRev / OV[1]));
      } else co.staff.sales = Math.ceil(targetRev / 6e6);
      applyPreset(co, ind.b2b ? 'b2b' : scale > 1.5 ? 'national' : 'retail', co.marketing);
      if (ind.reach.channels) { for (const a of ACCOUNTS) if (a.inds.includes(ind.id) && co.regions[a.region].unlocked && a.minQ <= 50 + scale * 8 && rand(s) < 0.7) co.accounts[a.id] = { since: s.month - 24 }; if (scale > 1) co.web = true; }
      if (situation === 'turnaround') for (const p of ind.products) { const ps = co.products[p.id]; ps.q -= 10; ps.price = Math.round(ps.price * 0.94 * 100) / 100; }
      for (const [c, m] of Object.entries(co.mats)) { m.usage = 0; }
      for (const p of ind.products) { const ps = co.products[p.id]; if (!ps.active || p.recurring) continue; for (const [c, q] of Object.entries(p.bom || {})) if (COMMODITIES[c].stock !== false) { const m = co.mats[c]; const u = ps.fc * q; m.qty += u * 1.5; m.val += u * 1.5 * s.prices[c]; } if (ind.storable) { ps.fg = ps.fc * 0.4; ps.fgVal = ps.fg * ps.price * 0.3; } }
    }
    co.staff.rd = Math.max(1, Math.round(targetRev / 1e6 * ind.rdPerM * 1.5));
    if (situation === 'turnaround') co.fx.push({ k: 'fixedCost', v: 1.25, until: 1e9 });
    for (let k = 0; k < 3; k++) { const r = recommendedStaff(s, co); co.staff.ops = r.ops; co.staff.support = r.support; co.staff.ga = r.ga; }
    co.cash = monthly * 2 + 2e5;
    co.ar = monthly * ind.lag;
    const debtAmt = targetRev * (ind.priceTaker ? 0.9 : ind.storable ? 0.25 : 0.15) * (situation === 'turnaround' ? 1.6 : 1);
    if (debtAmt > 0) co.loans.push({ id: uid(s), kind: 'term', name: 'Bank term loan', bal: debtAmt, floating: true, spread: 2.25, left: 60, io: false, orig: debtAmt, start: s.month });
    co.shares = { total: 100e6, ceo: 0, investors: [{ name: targetRev > 6e8 ? 'Public shareholders' : pick(s, ['Founding family', 'KKR', 'Bain Capital', 'Sequoia', 'Carlyle']), shares: 100e6, round: 'Existing' }] };
    co.public = targetRev > 6e8;
    co.board = { seats: 5, conf: situation === 'turnaround' ? 50 : 62, expect: situation === 'growth' || situation === 'pre-IPO' ? 0.04 : 0.02 };
    if (co.public) co.rounds.push({ id: 'ipo', name: 'IPO', amount: 0, pre: 0, m: s.month - 60 });
    co.sbaUsed = true;
    for (const [k, th] of [['1m', 1e6], ['10m', 10e6], ['100m', 100e6], ['1b', 1e9], ['10b', 10e9]]) if (targetRev * 1.6 >= th) co.milestones[k] = s.month;
    // warm up 3 silent months so the books have history
    const save = { month: s.month, co: s.co, silent: s.silent, macro: JSON.stringify(s.macro), prices: JSON.stringify(s.prices), hist: JSON.stringify(s.priceHist), ceoCash: s.ceo.cash, rep: s.ceo.rep, offers: s.ceo.offers, salary: s.ceo.salary };
    s.silent = true; s.co = co; s.month -= 3;
    const tmpCeo = Object.assign({}, s.ceo); s.ceo.salary = 0;
    for (let k = 0; k < 3; k++) { s._news = () => {}; stepCompany(s, co, () => {}); s.month++; }
    co.hist.forEach(h => { h.m = h.m; });
    s.month = save.month; s.co = save.co; s.silent = save.silent; s.macro = JSON.parse(save.macro); s.prices = JSON.parse(save.prices); s.priceHist = JSON.parse(save.hist);
    s.ceo.cash = save.ceoCash; s.ceo.rep = save.rep; s.ceo.offers = save.offers; s.ceo.salary = save.salary; void tmpCeo;
    co.cash = Math.max(co.cash, monthly * 1.5);
    { const r = recommendedStaff(s, co); co.staff.ops = r.ops; co.staff.support = r.support; co.staff.ga = r.ga; }
    co.crisis = null; co.fx = co.fx.filter(f => f.k === 'fixedCost'); co.acc = newAcc();
    co.valuation = valuation(s, co);
    if (co.public) co.sharePrice = co.valuation.equity / co.shares.total;
    return co;
  }
  function estFacilityRevenue(s, co, fd, city, age) {
    if (fd.out) { const q = resQ(city, fd.res); return ((fd.out.oil || 0) * s.prices.crude + (fd.out.gas || 0) * s.prices.natgas) * q / (1 + fd.decline * (age + 6)); }
    if (fd.tech === 'solar') return fd.mw * 730 * city.solarCF * ppaPrice(s, city);
    if (fd.tech === 'wind') return fd.mw * 730 * city.windCF * ppaPrice(s, city);
    if (fd.tech === 'battery') return fd.mw * capPrice(s, city);
    if (fd.tech === 'gas') return fd.mw * 730 * 0.15 * ppaPrice(s, city) * 1.6 + fd.mw * capPrice(s, city);
    return 0;
  }

  // ---------- Alerts ----------
  function computeAlerts(s, co) {
    const out = [];
    const ind = indById[co.ind];
    const h = co.hist[co.hist.length - 1];
    if (!h) return out;
    const m = metrics(co);
    const burn = -m.avgCashFlow3;
    if (burn > 0 && co.cash / burn < 6) out.push({ sev: co.cash / burn < 3 ? 'crit' : 'warn', text: `Runway: about ${Math.max(0, co.cash / burn).toFixed(1)} months of cash at the current burn.`, tab: 'finance' });
    if (h.laborLimited) out.push({ sev: 'warn', text: `Output was capped by staffing: ${ind.opsName.toLowerCase()} are short.`, tab: 'people' });
    if (h.capLimited) out.push({ sev: 'warn', text: 'You sold out: demand exceeded your capacity. Build or contract more.', tab: 'ops' });
    if (h.matLimited && h.matLimited.length) out.push({ sev: 'crit', text: `Stockout of ${h.matLimited.map(c => COMMODITIES[c].name.toLowerCase()).join(', ')} stopped production.`, tab: 'supply' });
    const need = gaNeed(co);
    if (co.staff.ga < need) out.push({ sev: 'warn', text: `G&A is understaffed (${co.staff.ga} of ${need} needed). Everyone is less productive.`, tab: 'people' });
    if (ind.recurring) { const r = recommendedStaff(s, co); if (co.staff.support < r.support * 0.9) out.push({ sev: 'warn', text: `Support is understaffed (${co.staff.support} of ~${r.support}); churn is rising.`, tab: 'people' }); }
    if (co.morale < 40) out.push({ sev: 'warn', text: `Morale is low (${Math.round(co.morale)}). Expect quits and lower productivity.`, tab: 'people' });
    if ((co.board.seats > 0 || co.public) && co.board.conf < 30) out.push({ sev: 'crit', text: `Board confidence is ${Math.round(co.board.conf)}/100. Below 12, they can replace you.`, tab: 'finance' });
    const products = ind.products.filter(p => co.products[p.id].active && !p.market);
    if (!ind.priceTaker && products.length && co.facilities.filter(f => f.status === 'active').length === 0 && ind.facilities.length) out.push({ sev: 'crit', text: 'You have no operating facility, so nothing can be produced.', tab: 'ops' });
    if (ind.priceTaker && co.facilities.length === 0) out.push({ sev: 'crit', text: 'You own no producing assets yet.', tab: 'ops' });
    return out;
  }

  // ---------- Events ----------
  const has = (co, c) => !!co.mats[c] && co.mats[c].usage > 0;
  const usesOverseas = (co) => Object.values(co.mats).some(m => m.sup === 'O' && m.usage > 0);
  const anyProduct = (co) => { const ind = indById[co.ind]; return ind.products.filter(p => co.products[p.id].active && !p.market); };
  const revMo = (co) => co.hist.length ? co.hist[co.hist.length - 1].rev : 0;

  const EVENTS = [
    { id: 'port', w: 3, cond: (s, co) => usesOverseas(co), title: 'Trans-Pacific port congestion',
      text: () => 'A labor dispute and vessel bunching at West Coast ports are backing up container traffic. Overseas shipments will take an extra month for the next four months, and more will slip.',
      auto: (s, co) => { addFx(s, co, 'leadO', 1, 4); addFx(s, co, 'relO', -0.1, 4); } },
    { id: 'matson', w: 3, cond: (s, co) => co.city === 'honolulu', title: 'Jones Act carriers raise Hawaii freight rates',
      text: () => 'Ocean carriers serving Hawaii announce a 10% rate increase and a fuel surcharge. Everything you import from the mainland or abroad costs more for the next year.',
      auto: (s, co) => addFx(s, co, 'freight', 1.10, 12) },
    { id: 'hurricane', w: 5, cond: (s, co) => { const c = cityById[co.city]; const m = calMonth(s.month); return c.risk.hurricane > 0 && m >= 5 && m <= 10 && rand(s) < c.risk.hurricane * 25; },
      title: (s, co) => `Hurricane heading for ${cityById[co.city].name}`,
      text: (s, co) => `Forecasters give a major hurricane a 40% chance of a direct hit in four days. You can shut down early, board up and move inventory to high ground, or keep operating and hope it turns.`,
      choices: [
        { label: 'Shut down and prepare', hint: 'Lose about a week of output, pay for hardening', fx: (s, co) => { const cost = 15000 + revMo(co) * 0.05; co.cash -= cost; co.acc.events += cost; addFx(s, co, 'capacity', 0.78, 0); addFx(s, co, 'demand', 0.85, 0); return 'You lost a week but came through with minor damage.'; } },
        { label: 'Keep operating', hint: 'Full output if it misses; serious damage if it hits', fx: (s, co) => { if (rand(s) < 0.4) { const dmg = 40000 + co.facilities.reduce((a, f) => a + f.book, 0) * 0.06; co.cash -= dmg; co.acc.events += dmg; addFx(s, co, 'capacity', 0.45, 1); addFx(s, co, 'demand', 0.7, 1); return `Direct hit. Damage costs ${fmt$(dmg)} and output is cut for two months.`; } return 'The storm turned away at the last minute. No damage.'; } }
      ] },
    { id: 'freeze', w: 3, cond: (s, co) => { const c = cityById[co.city]; const m = calMonth(s.month); return (c.risk.freeze || 0) > 0 && (m === 0 || m === 1); }, title: 'Arctic blast knocks out power',
      text: (s, co) => `A deep freeze hits ${cityById[co.city].name}. Rolling blackouts close sites for days and natural-gas prices spike.`,
      auto: (s, co) => { addFx(s, co, 'capacity', 0.8, 0); s.macro.shocks.natgas = { mult: 1.8, until: s.month + 2 }; } },
    { id: 'quake', w: 2, cond: (s, co) => (cityById[co.city].risk.quake || 0) > 0 && rand(s) < 0.15, title: 'Earthquake shakes the region',
      text: () => 'A magnitude 6.4 earthquake damages roads and buildings. Your sites need inspections and repairs.',
      auto: (s, co) => { const dmg = 25000 + co.facilities.reduce((a, f) => a + f.book, 0) * 0.03; co.cash -= dmg; co.acc.events += dmg; addFx(s, co, 'capacity', 0.85, 1); } },
    { id: 'cocoa', w: 3, cond: (s, co) => has(co, 'cocoa'), title: 'West African cocoa harvest fails',
      text: () => 'Black-pod disease and drought in Côte d\'Ivoire and Ghana cut the crop again. Cocoa futures are surging and will stay high for most of a year.',
      auto: (s) => { s.macro.shocks.cocoa = { mult: 1.7, until: s.month + 9 }; } },
    { id: 'coffee', w: 3, cond: (s, co) => has(co, 'coffee'), title: 'Frost hits Brazil\'s coffee belt',
      text: () => 'A rare frost in Minas Gerais damaged next season\'s arabica. Green coffee prices are climbing.',
      auto: (s) => { s.macro.shocks.coffee = { mult: 1.45, until: s.month + 8 }; } },
    { id: 'beef', w: 2, cond: (s, co) => has(co, 'beef'), title: 'Cattle herd at a 70-year low',
      text: () => 'After years of drought, the U.S. cattle herd is the smallest since the 1950s. Beef prices are rising.',
      auto: (s) => { s.macro.shocks.beef = { mult: 1.3, until: s.month + 12 }; } },
    { id: 'co2', w: 2, cond: (s, co) => has(co, 'co2'), title: 'CO2 shortage',
      text: () => 'Maintenance shutdowns at ammonia plants have cut beverage-grade CO2 supply. Prices double and deliveries are unreliable.',
      auto: (s, co) => { s.macro.shocks.co2 = { mult: 2.0, until: s.month + 3 }; addFx(s, co, 'relD', -0.15, 3); } },
    { id: 'tariff_up', w: 3, cond: (s, co) => usesOverseas(co) || anyProduct(co).length > 0, title: 'New tariffs announced',
      text: (s) => `The administration raises tariffs on a broad range of imports. The effective rate on your overseas inputs rises from ${Math.round((s.macro.tariff - 1) * 100)}% to ${Math.round((s.macro.tariff - 1 + 0.12) * 100)}%.`,
      auto: (s) => { s.macro.tariff = clamp(s.macro.tariff + 0.12, 1, 1.8); } },
    { id: 'tariff_down', w: 2, cond: (s) => s.macro.tariff > 1.1, title: 'Trade deal cuts tariffs',
      text: () => 'A new trade agreement lowers tariffs on many imported components.',
      auto: (s) => { s.macro.tariff = clamp(s.macro.tariff - 0.08, 1, 1.8); } },
    { id: 'chips', w: 3, cond: (s, co) => has(co, 'semis'), title: 'Chip shortage',
      text: () => 'A fab fire in Taiwan and booming AI demand have tightened supply of the chips you use. Prices jump and deliveries slip.',
      auto: (s, co) => { s.macro.shocks.semis = { mult: 1.5, until: s.month + 6 }; addFx(s, co, 'relO', -0.15, 6); addFx(s, co, 'relD', -0.1, 6); } },
    { id: 'cells_cheap', w: 2, cond: (s, co) => has(co, 'cells'), title: 'Battery cell prices fall',
      text: () => 'New LFP capacity in China and Nevada has driven lithium-ion cell prices down sharply.',
      auto: (s) => { s.macro.shocks.cells = { mult: 0.78, until: s.month + 12 }; } },
    { id: 'opec', w: 3, cond: () => true, title: 'OPEC+ cuts production',
      text: () => 'OPEC+ announces a surprise cut of 1.5 million barrels a day. Crude, diesel and jet fuel prices jump.',
      auto: (s) => { s.macro.shocks.crude = { mult: 1.3, until: s.month + 6 }; s.macro.shocks.diesel = { mult: 1.2, until: s.month + 6 }; s.macro.shocks.jetfuel = { mult: 1.25, until: s.month + 6 }; } },
    { id: 'oilcrash', w: 2, cond: () => true, title: 'Oil prices collapse',
      text: () => 'A price war between producers and weak demand send WTI down more than 30%.',
      auto: (s) => { s.macro.shocks.crude = { mult: 0.65, until: s.month + 8 }; s.macro.shocks.diesel = { mult: 0.8, until: s.month + 8 }; s.macro.shocks.jetfuel = { mult: 0.78, until: s.month + 8 }; } },
    { id: 'gasspike', w: 2, cond: (s, co) => ['power', 'oilgas', 'datacenter'].includes(co.ind) || has(co, 'natgas'), title: 'LNG exports tighten gas markets',
      text: () => 'New LNG export terminals and a cold forecast push Henry Hub gas prices up sharply. Power prices follow.',
      auto: (s) => { s.macro.shocks.natgas = { mult: 1.7, until: s.month + 5 }; } },
    { id: 'recall', w: 3, cond: (s, co) => ['snacks', 'beverage', 'beauty', 'electronics', 'ev', 'restaurants'].includes(co.ind) && revMo(co) > 20000,
      ctx: (s, co) => pick(s, anyProduct(co)).id,
      title: (s, co, ctx) => `Quality problem with ${indById[co.ind].products.find(p => p.id === ctx).name.toLowerCase()}`,
      text: (s, co, ctx) => `QA traced several customer complaints to one supplier lot. ${co.ind === 'electronics' || co.ind === 'ev' ? 'A battery defect could cause overheating.' : 'Some units may be contaminated.'} A voluntary recall is expensive; staying quiet is a gamble.`,
      choices: [
        { label: 'Voluntary recall', hint: 'Costly now, protects the brand', fx: (s, co, ctx) => { const ps = co.products[ctx]; const cost = 20000 + ps.rev * 0.6; co.cash -= cost; co.acc.events += cost; co.regions.forEach(r => r.aw *= 0.95); s.ceo.rep = clamp(s.ceo.rep + 1, 0, 100); return `The recall cost ${fmt$(cost)}. Regulators praised the quick response.`; } },
        { label: 'Fix it quietly', hint: '60% nothing happens; 40% lawsuit and a news story', fx: (s, co, ctx) => { if (rand(s) < 0.4) { const cost = 150000 + co.products[ctx].rev * 3; co.cash -= cost; co.acc.events += cost; co.regions.forEach(r => r.aw *= 0.7); s.ceo.rep = clamp(s.ceo.rep - 8, 0, 100); return `It leaked. Lawsuits and a forced recall cost ${fmt$(cost)} and your brand took a hit.`; } return 'Nobody noticed. This time.'; } }
      ] },
    { id: 'megamart', w: 3, cond: (s, co) => ['snacks', 'beverage', 'beauty', 'apparel', 'electronics'].includes(co.ind) && !co.regions[2].unlocked && co.regions[1].unlocked && revMo(co) > 60000 && !co.flagMega && !co.accounts.bigbox,
      title: 'A national big-box retailer wants you',
      text: (s, co) => `A national big-box retailer's buyer offers shelf placement in 4,000 stores and will waive the usual $500K slotting fee. You get their standard terms: about 18% below your list price and net-60 payment. You would need the capacity and working capital to keep up.`,
      choices: [
        { label: 'Sign the deal', hint: 'Instant national distribution, thinner margins, slower cash', fx: (s, co) => { co.flagMega = true; co.regions[2].unlocked = true; co.regions[2].aw = Math.max(co.regions[2].aw, 0.02); co.accounts.bigbox = { since: s.month }; return 'You are in 4,000 stores. Make sure the plant can keep up.'; } },
        { label: 'Decline', hint: 'Grow on your own terms', fx: (s, co) => { co.flagMega = true; return 'You passed. The buyer says the door is open later.'; } }
      ] },
    { id: 'viral', w: 3, cond: (s, co) => !indById[co.ind].priceTaker && anyProduct(co).length && revMo(co) > 5000, ctx: (s, co) => pick(s, anyProduct(co)).id,
      title: (s, co, ctx) => `${indById[co.ind].products.find(p => p.id === ctx).name} goes viral`,
      text: () => 'A creator with eight million followers posted an unpaid rave review. Demand is spiking for the next two months, if you can supply it.',
      auto: (s, co, ctx) => { addFx(s, co, 'demand', 1.7, 2, { p: ctx }); co.regions.forEach(r => { if (r.unlocked) r.aw = Math.min(0.95, r.aw + 0.03); }); } },
    { id: 'backlash', w: 2, cond: (s, co) => !indById[co.ind].priceTaker && revMo(co) > 50000, title: 'Social-media backlash',
      text: () => 'An old ad campaign resurfaced and is being called tone-deaf. You can apologize and donate, or ride it out.',
      choices: [
        { label: 'Apologize and donate $50k', hint: 'Limits the damage', fx: (s, co) => { co.cash -= 50000; co.acc.events += 50000; co.regions.forEach(r => r.aw *= 0.97); return 'The story faded within a week.'; } },
        { label: 'Say nothing', hint: 'Free, but awareness drops', fx: (s, co) => { co.regions.forEach(r => r.aw *= 0.85); addFx(s, co, 'demand', 0.9, 2); return 'The story ran for two weeks and sales dipped.'; } }
      ] },
    { id: 'union', w: 3, cond: (s, co) => co.staff.ops >= 30 && co.morale < 58, title: (s, co) => `${indById[co.ind].opsName} are organizing a union`,
      text: (s, co) => `Organizers have signatures from most of your ${co.staff.ops} ${indById[co.ind].opsName.toLowerCase()}. They want higher pay and better scheduling.`,
      choices: [
        { label: 'Recognize the union', hint: '+8% ops wages, morale up', fx: (s, co) => { addFx(s, co, 'opsWage', 1.08, Infinity); co.morale = clamp(co.morale + 15, 0, 98); return 'You signed a first contract. Morale improved.'; } },
        { label: 'Negotiate a raise without a union', hint: '+4% ops wages', fx: (s, co) => { addFx(s, co, 'opsWage', 1.04, Infinity); co.morale = clamp(co.morale + 5, 0, 98); return 'The organizing drive stalled after the raise.'; } },
        { label: 'Fight it with consultants', hint: '$150k; 30% chance of a strike', fx: (s, co) => { co.cash -= 150000; co.acc.events += 150000; co.morale = clamp(co.morale - 15, 0, 98); if (rand(s) < 0.3) { addFx(s, co, 'capacity', 0.5, 0); return 'A one-month strike halved output.'; } return 'The vote failed, but resentment lingers.'; } }
      ] },
    { id: 'poach', w: 3, cond: (s, co) => co.staff.rd >= 4, title: 'Your top engineer has an offer from a rival',
      text: (s, co) => `Your lead from the ${indById[co.ind].rdName.toLowerCase()} team has an offer from ${pick(s, indById[co.ind].competitors)} at 40% more.`,
      choices: [
        { label: 'Counter-offer and retention grant', hint: 'Costs about a year of their salary', fx: (s, co) => { const c = salary(s, co, 'rd') * 12; co.cash -= c; co.acc.events += c; return 'They stayed.'; } },
        { label: 'Let them go', hint: 'Product quality slips', fx: (s, co) => { for (const ps of Object.values(co.products)) if (ps.active) ps.q = Math.max(15, ps.q - 4); co.staff.rd = Math.max(0, co.staff.rd - 1); return 'They left and took some know-how with them.'; } }
      ] },
    { id: 'ransom', w: 2, cond: (s, co) => headcount(co) > 25, title: 'Ransomware attack',
      text: (s, co) => `Attackers encrypted ${co.name}'s ERP and order systems and want ${fmt$(Math.max(150000, revMo(co) * 0.5))} in bitcoin.`,
      choices: [
        { label: 'Pay the ransom', hint: 'Back online in days (usually)', fx: (s, co) => { const c = Math.max(150000, revMo(co) * 0.5); co.cash -= c; co.acc.events += c; if (rand(s) < 0.2) { addFx(s, co, 'capacity', 0.7, 0); return 'You paid, and the decryptor only half worked.'; } return 'You paid. Systems are restored.'; } },
        { label: 'Restore from backups', hint: 'Slower, no payment', fx: (s, co) => { const c = 60000 + revMo(co) * 0.08; co.cash -= c; co.acc.events += c; addFx(s, co, 'capacity', 0.75, 0); addFx(s, co, 'demand', 0.9, 0); return `Recovery took three weeks and cost ${fmt$(c)}.`; } }
      ] },
    { id: 'tourism_down', w: 3, cond: (s, co) => cityById[co.city].tourism >= 0.3 && indById[co.ind].tourismSens > 0, title: 'Tourism slump',
      text: (s, co) => `A strong dollar and an airfare spike have cut visitor arrivals to ${cityById[co.city].name}. Visitor-driven demand drops for several months.`,
      auto: (s) => { s.macro.tourism = Math.max(0.6, s.macro.tourism - 0.25); } },
    { id: 'tourism_up', w: 2, cond: (s, co) => cityById[co.city].tourism >= 0.3 && indById[co.ind].tourismSens > 0, title: 'Record visitor arrivals',
      text: (s, co) => `${cityById[co.city].name} is seeing record visitor counts this season.`,
      auto: (s) => { s.macro.tourism = Math.min(1.4, s.macro.tourism + 0.2); } },
    { id: 'privacy', w: 2, cond: (s, co) => ['saas', 'fintech', 'datacenter'].includes(co.ind) && revMo(co) > 50000, title: 'New data-privacy law',
      text: () => 'A sweeping new state privacy law takes effect. You can invest in compliance now or risk fines.',
      choices: [
        { label: 'Invest in compliance', hint: 'One-time cost', fx: (s, co) => { const c = 80000 + revMo(co) * 0.4; co.cash -= c; co.acc.events += c; return `Compliance program cost ${fmt$(c)}.`; } },
        { label: 'Do the minimum', hint: '35% chance of a large fine later', fx: (s, co) => { if (rand(s) < 0.35) { const c = 250000 + revMo(co) * 2; co.cash -= c; co.acc.events += c; s.ceo.rep = clamp(s.ceo.rep - 4, 0, 100); return `Regulators fined you ${fmt$(c)}.`; } return 'No enforcement action, for now.'; } }
      ] },
    { id: 'consent', w: 2, cond: (s, co) => co.ind === 'fintech' && revMo(co) > 100000, title: 'Regulators open an investigation',
      text: () => 'A state regulator alleges your overdraft and dispute practices harmed consumers.',
      choices: [
        { label: 'Settle', hint: 'Pay restitution, change practices', fx: (s, co) => { const c = 200000 + revMo(co) * 1.5; co.cash -= c; co.acc.events += c; addFx(s, co, 'churn', 1.05, 6); return `You settled for ${fmt$(c)}.`; } },
        { label: 'Fight in court', hint: '50/50 outcome, big legal bills', fx: (s, co) => { const legal = 300000; co.cash -= legal; co.acc.events += legal; if (rand(s) < 0.5) { const c = revMo(co) * 4; co.cash -= c; co.acc.events += c; s.ceo.rep = clamp(s.ceo.rep - 6, 0, 100); return `You lost: ${fmt$(c)} in penalties plus legal fees.`; } return 'You won. Legal fees were $300k.'; } }
      ] },
    { id: 'methane', w: 2, cond: (s, co) => co.ind === 'oilgas' && co.facilities.length > 0, title: 'New methane and flaring rules',
      text: () => 'Regulators tighten flaring limits. Each operated well needs vapor-recovery equipment.',
      choices: [
        { label: 'Retrofit now', hint: '$120k per operated well', fx: (s, co) => { const n = co.facilities.filter(f => facDef(co, f).staffed).length; const c = n * 120000; co.cash -= c; co.acc.events += c; return `Retrofits cost ${fmt$(c)}.`; } },
        { label: 'Seek a waiver', hint: 'Likely fines, some shut-ins', fx: (s, co) => { addFx(s, co, 'capacity', 0.9, 6); return 'The waiver was denied; some wells are shut in for months.'; } }
      ] },
    { id: 'interconnect', w: 3, cond: (s, co) => ['power', 'datacenter'].includes(co.ind) && co.facilities.some(f => f.status === 'building' && facDef(co, f).capex > 5e6),
      ctx: (s, co) => pick(s, co.facilities.filter(f => f.status === 'building' && facDef(co, f).capex > 5e6)).uid,
      title: 'Interconnection delay', text: (s, co, ctx) => `The grid operator pushed your ${facDef(co, co.facilities.find(f => f.uid === ctx)).name.toLowerCase()} back in the interconnection queue. Expect a six-month delay.`,
      auto: (s, co, ctx) => { const f = co.facilities.find(x => x.uid === ctx); if (f) f.left += 6; } },
    { id: 'ppa', w: 3, cond: (s, co) => co.ind === 'power' && co.facilities.some(f => f.status === 'active' && ['solar', 'wind'].includes(facDef(co, f).tech)) && !fxList(co, 'ppaLock').length,
      ctx: (s, co) => co.facilities.find(f => f.status === 'active' && ['solar', 'wind'].includes(facDef(co, f).tech)).city,
      title: 'A utility offers a 15-year power purchase agreement',
      text: (s, co, ctx) => `The local utility offers to buy all output from your ${cityById[ctx].name} projects at a fixed ${fmt$(ppaPrice(s, cityById[ctx]) * 0.92)}/MWh for 15 years, about 8% below today's price.`,
      choices: [
        { label: 'Sign the PPA', hint: 'Predictable cash flow, banks love it', fx: (s, co, ctx) => { addFx(s, co, 'ppaLock', 1, 180, { city: ctx, price: ppaPrice(s, cityById[ctx]) * 0.92 }); return 'Signed. Your revenue there is now fixed.'; } },
        { label: 'Stay merchant', hint: 'Keep the upside and the risk', fx: () => 'You stay exposed to the wholesale market.' }
      ] },
    { id: 'grounding', w: 3, cond: (s, co) => co.ind === 'airline' && co.facilities.some(f => ['a321', 'atr'].includes(f.type)), title: 'Engine inspections ground part of your fleet',
      text: () => 'The engine maker ordered accelerated inspections for a powder-metal defect. Part of your fleet is grounded for six months while you wait for spare engines.',
      auto: (s, co) => addFx(s, co, 'capacity', 0.85, 6) },
    { id: 'eas', w: 2, cond: (s, co) => co.ind === 'airline' && co.facilities.length > 0 && !co.flagEAS, title: 'Essential Air Service contract',
      text: () => 'The DOT offers a two-year subsidy to serve a small community route. The subsidy covers the route\'s losses with a margin.',
      choices: [
        { label: 'Accept', hint: '+$60k/month for 24 months', fx: (s, co) => { co.flagEAS = true; addFx(s, co, 'subsidy', 60000, 24); return 'You now fly the route under contract.'; } },
        { label: 'Decline', hint: 'Keep aircraft on your best routes', fx: (s, co) => { co.flagEAS = true; return 'Declined.'; } }
      ] },
    { id: 'drivers', w: 3, cond: (s, co) => co.ind === 'logistics' && co.staff.ops > 10, title: 'Driver shortage',
      text: () => 'Competitors are offering $10k sign-on bonuses. To keep your drivers you need to raise pay.',
      choices: [
        { label: 'Raise driver pay 8%', hint: 'Keeps the fleet staffed', fx: (s, co) => { addFx(s, co, 'opsWage', 1.08, Infinity); return 'Pay raised. Turnover stabilized.'; } },
        { label: 'Hold the line', hint: 'Quits jump', fx: (s, co) => { const q = Math.round(co.staff.ops * 0.12); co.staff.ops -= q; co.morale = clamp(co.morale - 8, 0, 98); return `${q} drivers quit.`; } }
      ] },
    { id: 'anchor', w: 3, cond: (s, co) => co.ind === 'datacenter' && revMo(co) > 50000, title: 'An AI lab wants a three-year reservation',
      text: () => 'A fast-growing AI lab offers to reserve a large block of capacity at 10% below list price on a three-year take-or-pay contract.',
      choices: [
        { label: 'Sign', hint: 'Demand +35% for 36 months, prices locked lower', fx: (s, co) => { addFx(s, co, 'demand', 1.35, 36); addFx(s, co, 'compPrice', 0.97, 36); return 'Signed. You will need more capacity.'; } },
        { label: 'Pass', hint: 'Keep flexibility', fx: () => 'You passed.' }
      ] },
    { id: 'netmeter', w: 2, cond: (s, co) => co.ind === 'solar', title: 'Utility changes rooftop solar rules',
      text: () => 'Regulators cut what utilities pay for exported rooftop power. Solar-only systems pay back more slowly; batteries look better.',
      auto: (s, co) => { addFx(s, co, 'demand', 0.85, 12, { p: 'rooftop' }); addFx(s, co, 'demand', 1.4, 12, { p: 'battery' }); } },
    { id: 'pricewar', w: 3, cond: (s, co) => !indById[co.ind].priceTaker && revMo(co) > 30000, title: (s, co) => `${pick(s, indById[co.ind].competitors)} starts a price war`,
      text: () => 'A major competitor cut prices about 10% across the board. Customers now compare you to the lower price.',
      auto: (s, co) => addFx(s, co, 'compPrice', 0.9, 6) },
    { id: 'insurance', w: 2, cond: (s, co) => ['honolulu', 'miami', 'houston', 'losangeles'].includes(co.city), title: 'Insurance premiums jump',
      text: (s, co) => `After a run of catastrophe losses, insurers raise commercial property premiums in ${cityById[co.city].name}.`,
      auto: (s, co) => addFx(s, co, 'fixedCost', 1.06, 24) },
    { id: 'supplier_bust', w: 2, cond: (s, co) => Object.values(co.mats).some(m => m.orders.length), title: 'A supplier went bankrupt',
      ctx: (s, co) => pick(s, Object.entries(co.mats).filter(([c, m]) => m.orders.length).map(([c]) => c)),
      text: (s, co, ctx) => `Your ${COMMODITIES[ctx].name.toLowerCase()} supplier filed for bankruptcy. Open orders are canceled; you recover about half of any prepayments.`,
      auto: (s, co, ctx) => { const m = co.mats[ctx]; for (const o of m.orders) if (o.terms === 'prepay') { const r = o.qty * o.unit * 0.5; co.cash += r; co.acc.events += o.qty * o.unit * 0.5; } m.orders = []; } },
    { id: 'buy_supplier', w: 2, cond: (s, co) => Object.entries(co.mats).some(([c, m]) => m.usage > 0 && COMMODITIES[c].stock !== false && !co.owned[c]) && revMo(co) > 150000,
      ctx: (s, co) => { const opts = Object.entries(co.mats).filter(([c, m]) => m.usage > 0 && COMMODITIES[c].stock !== false && !co.owned[c]); opts.sort((a, b) => b[1].usage * s.prices[b[0]] - a[1].usage * s.prices[a[0]]); return opts[0][0]; },
      title: (s, co, ctx) => `A ${COMMODITIES[ctx].name.toLowerCase()} supplier is for sale`,
      text: (s, co, ctx) => { const v = co.mats[ctx].usage * s.prices[ctx] * 12 * 1.6 + 400000; return `A struggling ${COMMODITIES[ctx].name.toLowerCase()} producer is looking for a buyer at ${fmt$(v)}. Owning it would cut that input's cost about 18% and make supply fully reliable.`; },
      choices: [
        { label: 'Buy it (vertical integration)', hint: 'Lower cost, guaranteed supply', fx: (s, co, ctx) => { const v = co.mats[ctx].usage * s.prices[ctx] * 12 * 1.6 + 400000; if (co.cash < v) return 'You could not fund the deal.'; co.cash -= v; co.assets.push({ label: COMMODITIES[ctx].name + ' subsidiary', book: v }); co.owned[ctx] = true; co.mats[ctx].sup = 'V'; return `You now own your ${COMMODITIES[ctx].name.toLowerCase()} supply.`; } },
        { label: 'Pass', hint: '', fx: () => 'You passed on the deal.' }
      ] },
    { id: 'competitor_sale', w: 2, cond: (s, co) => !indById[co.ind].priceTaker && revMo(co) > 200000 && co.cash > revMo(co) * 3,
      title: 'A smaller competitor is for sale',
      text: (s, co) => `A regional competitor with about ${fmt$(revMo(co) * 0.4 * 12)} in annual sales wants to sell for ${fmt$(revMo(co) * 0.4 * 12 * 1.4)}. You would absorb its customers and brand awareness.`,
      choices: [
        { label: 'Acquire it', hint: 'Awareness and reach jump in your markets', fx: (s, co) => { const p = revMo(co) * 0.4 * 12 * 1.4; if (co.cash < p) return 'You could not fund the deal.'; co.cash -= p; co.assets.push({ label: 'Acquired competitor (goodwill)', book: p * 0.6 }); co.regions.forEach(r => { if (r.unlocked) { r.aw = Math.min(0.95, r.aw * 1.3 + 0.02); r.reach = Math.min(0.95, r.reach * 1.2); } }); for (const p2 of indById[co.ind].products) { const ps = co.products[p2.id]; if (p2.recurring && ps.active) ps.customers *= 1.35; } return 'Deal closed. Integration begins.'; } },
        { label: 'Pass', hint: '', fx: () => 'You passed.' }
      ] },
    { id: 'heatwave', w: 2, cond: (s, co) => ['beverage', 'beauty'].includes(co.ind) && [5, 6, 7].includes(calMonth(s.month)), title: 'Record heat wave',
      text: () => 'Weeks of record heat are driving demand for cold drinks and sun protection.',
      auto: (s, co) => addFx(s, co, 'demand', 1.25, 0) },
    { id: 'troll', w: 2, cond: (s, co) => ['saas', 'electronics', 'fintech', 'ev'].includes(co.ind) && revMo(co) > 100000, title: 'Patent lawsuit',
      text: () => 'A patent-assertion entity claims your product infringes a 2009 patent and offers to settle for $350k.',
      choices: [
        { label: 'Settle', hint: '$350k', fx: (s, co) => { co.cash -= 350000; co.acc.events += 350000; return 'Settled.'; } },
        { label: 'Fight', hint: '$200k in fees; 30% chance of a $2M judgment', fx: (s, co) => { co.cash -= 200000; co.acc.events += 200000; if (rand(s) < 0.3) { co.cash -= 2e6; co.acc.events += 2e6; return 'The jury found infringement. $2M judgment.'; } return 'The patent was invalidated.'; } }
      ] },
    { id: 'endorse', w: 2, cond: (s, co) => ['snacks', 'beverage', 'beauty', 'apparel', 'restaurants', 'electronics'].includes(co.ind) && revMo(co) > 40000, title: 'An athlete offers an endorsement deal',
      text: (s, co) => `A pro athlete with Hawaii roots and a big following offers a 12-month endorsement for ${fmt$(Math.max(120000, revMo(co) * 1.5))}.`,
      choices: [
        { label: 'Sign the athlete', hint: 'Awareness boost in every market', fx: (s, co) => { const c = Math.max(120000, revMo(co) * 1.5); co.cash -= c; co.acc.events += c; co.regions.forEach(r => { if (r.unlocked) r.aw = Math.min(0.95, r.aw + 0.04 + r.aw * 0.15); }); return 'The campaign launched to strong reviews.'; } },
        { label: 'Pass', hint: '', fx: () => 'You passed.' }
      ] },
    { id: 'activist', w: 2, cond: (s, co) => co.public, title: 'An activist investor builds a stake',
      text: () => 'An activist fund disclosed a 6% stake and is demanding a $500M buyback or two board seats.',
      choices: [
        { label: 'Give them board seats', hint: 'Board gets tougher', fx: (s, co) => { co.board.conf = clamp(co.board.conf - 10, 0, 100); co.board.expect += 0.01; return 'Two activist directors join the board.'; } },
        { label: 'Announce a buyback', hint: 'Spend cash, stock rises', fx: (s, co) => { const amt = Math.min(co.cash * 0.3, 5e8); buyback(s, co, amt); co.sentiment *= 1.05; return `You bought back ${fmt$(amt)} of stock.`; } }
      ] },
    { id: 'grant', w: 2, cond: (s, co) => ['solar', 'ev', 'power'].includes(co.ind) && revMo(co) > 0, title: 'Clean-energy grant awarded',
      text: () => 'The state energy office awarded you a grant for workforce training and grid-resilience equipment.',
      auto: (s, co) => { const g = 150000 + revMo(co) * 0.3; co.acc.otherInc += g; } },
    { id: 'restaurant_inspect', w: 2, cond: (s, co) => co.ind === 'restaurants' && co.facilities.length > 0, title: 'Health inspection flags one location',
      text: () => 'An inspector issued a yellow placard at one location for cold-holding violations.',
      choices: [
        { label: 'Retrain staff and upgrade coolers', hint: '$40k per location (one location)', fx: (s, co) => { co.cash -= 40000; co.acc.events += 40000; return 'Re-inspection passed with a green placard.'; } },
        { label: 'Quick fix only', hint: 'Cheap; risk of a red placard', fx: (s, co) => { if (rand(s) < 0.35) { addFx(s, co, 'demand', 0.85, 1); co.regions[0].aw *= 0.9; return 'A red placard closed the location for a week and made the news.'; } return 'You passed re-inspection.'; } }
      ] }
  ];

  function rollEvents(s, co, news) {
    if (s.pendingEvent || co.crisis) return;
    if (co.hist.length < 2) return;
    if (rand(s) > 0.3) return;
    const elig = EVENTS.filter(e => { try { return e.cond(s, co); } catch (err) { return false; } });
    if (!elig.length) return;
    const tot = elig.reduce((a, e) => a + e.w, 0);
    let r = rand(s) * tot, ev = elig[0];
    for (const e of elig) { r -= e.w; if (r <= 0) { ev = e; break; } }
    const ctx = ev.ctx ? ev.ctx(s, co) : null;
    const title = typeof ev.title === 'function' ? ev.title(s, co, ctx) : ev.title;
    const text = ev.text(s, co, ctx);
    if (ev.auto) {
      ev.auto(s, co, ctx);
      news(`${title}. ${text}`, 'event', true);
      s.toast = { title, text };
    } else {
      s.pendingEvent = { id: ev.id, title, text, ctx, choices: ev.choices.map(c => ({ label: c.label, hint: c.hint })) };
    }
  }
  function resolveEvent(s, idx) {
    const pe = s.pendingEvent;
    if (!pe) return;
    s.pendingEvent = null;
    if (pe.id === 'fired') {
      const co = s.co;
      const stakeVal = endTenure(s, 'Fired by the board');
      if (ceoStake(co) > 0) s.ceo.holdings.push({ name: co.name, pct: ceoStake(co), value: stakeVal, public: co.public, since: s.month });
      s.ceo.rep = clamp(s.ceo.rep - 12, 0, 100);
      s.co = null; s.ceo.salary = 0;
      s.news.unshift({ m: s.month, text: `You were removed as CEO of ${co.name}.`, tone: 'bad', big: true });
      return 'You are between roles. Headhunters will call; or start something new.';
    }
    const ev = EVENTS.find(e => e.id === pe.id);
    const res = ev.choices[idx].fx(s, s.co, pe.ctx);
    s.news.unshift({ m: s.month, text: `${pe.title}: ${res}`, tone: 'event' });
    return res;
  }

  function bankrupt(s) {
    const co = s.co;
    endTenure(s, 'Bankrupt (Chapter 7)');
    s.ceo.rep = clamp(s.ceo.rep - 20, 0, 100);
    s.news.unshift({ m: s.month, text: `${co.name} filed for Chapter 7. Creditors take the assets; your equity is wiped out.`, tone: 'bad', big: true });
    s.co = null; s.ceo.salary = 0;
  }

  // ---------- New game ----------
  function newGame(setup, seed) {
    const s = { v: 1, seed: seed || (Date.now() & 0x7fffffff), month: 0, news: [], pendingEvent: null };
    initMacro(s);
    const bg = BACKGROUNDS.find(b => b.id === setup.bg);
    s.ceo = { name: setup.ceoName || 'You', bg: bg.id, cash: bg.cash, rep: bg.rep, salary: 0, history: [], holdings: [], offers: [], home: setup.city };
    startCompany(s, setup);
    return s;
  }
  function startCompany(s, setup) {
    const co = makeCompany(s, { ind: setup.ind, city: setup.city, name: setup.name, isFounder: true });
    const invest = Math.min(setup.invest, s.ceo.cash);
    s.ceo.cash -= invest;
    co.cash = invest; co.fundedBy = invest;
    s.ceo.salary = setup.salary || 0;
    s.ceo.home = setup.city;
    s.co = co;
    if (setup.sba > 0) { const cap = loanCapacity(s, co).sba; takeLoan(s, co, 'sba', Math.min(setup.sba, cap)); }
    if (setup.angel > 0) {
      const pre = angelPre(s, setup.ind);
      const ns = co.shares.total * setup.angel / pre;
      co.shares.total += ns; co.shares.investors.push({ name: 'Angel investors', shares: ns, round: 'Angel round' });
      co.cash += setup.angel; co.rounds.push({ id: 'angel', name: 'Angel round', amount: setup.angel, pre, m: s.month }); co.board.expect = 0.05;
    }
    const ind = indById[setup.ind];
    // starter setup: first facility type, first-tier suppliers, founder's starting team
    if (ind.facilities.length) {
      const fd = ind.facilities[0];
      const site = buildSites(co, fd).find(c => c.id === co.city) || buildSites(co, fd).sort((a, b) => resQ(b, fd.res || 'oil') - resQ(a, fd.res || 'oil'))[0];
      co.facilities.push({ uid: uid(s), type: fd.id, city: site.id, status: fd.build <= 1 ? 'active' : 'building', left: fd.build - 1, paid: fd.capex * s.macro.cpi, cost: fd.capex * s.macro.cpi, book: fd.capex * s.macro.cpi, age: 0, started: s.month, activeSince: s.month });
      co.cash -= fd.capex * (s.macro.cpi - 1);
      co.cash -= fd.capex; co.acc.capex += fd.capex;
    }
    co.marketing = setup.marketing != null ? setup.marketing : 0;
    applyPreset(co, defaultPreset(co), co.marketing);
    if (ind.reach.channels) co.accounts.markets = { since: s.month };
    for (const p of ind.products) { const ps = co.products[p.id]; if (ps.active && !p.market) ps.fc = productDemand(s, co, p, ps).tot; }
    const start = setup.team || starterTeam(s, co);
    for (const d of DEPTS) co.staff[d] = start[d] || 0;
    return co;
  }
  function angelPre(s, indId) { const ind = indById[indId]; return (2.5e6 + s.ceo.rep * 60000) * (ind.recurring ? 1.4 : 1) * (ind.capital === 'High' || ind.capital === 'Very high' ? 1.3 : 1); }
  // a lean founding team sized to what the first site and early demand need
  function starterTeam(s, co) {
    const ind = indById[co.ind];
    const t = { ops: 0, sales: 0, rd: 0, support: 0, ga: 0 };
    const fd = ind.facilities[0];
    if (ind.recurring) { t.rd = 1; }
    else if (ind.priceTaker) { t.ops = fd && fd.staffed ? Math.ceil(fd.crew || 0) : 0; }
    else if (fd && fd.staffed) {
      let hrs = 0;
      for (const p of ind.products) { const ps = co.products[p.id]; if (ps.active) hrs += Math.min(fd.cap / (p.capW || 1), (ps.fc || 0) * 2) * (p.labor || 0); }
      t.ops = Math.max(1, Math.ceil(hrs / 160));
    }
    return t;
  }

  // ---------- formatting helpers (shared with UI) ----------
  function fmt$(x, dp) {
    const neg = x < 0; x = Math.abs(x);
    let s;
    if (x >= 1e9) s = '$' + (x / 1e9).toFixed(dp != null ? dp : x >= 1e10 ? 1 : 2) + 'B';
    else if (x >= 1e6) s = '$' + (x / 1e6).toFixed(dp != null ? dp : x >= 1e7 ? 1 : 2) + 'M';
    else if (x >= 1e4) s = '$' + Math.round(x / 1e3) + 'K';
    else if (x >= 1000) s = '$' + (x / 1e3).toFixed(1) + 'K';
    else if (x >= 10) s = '$' + Math.round(x);
    else s = '$' + x.toFixed(2);
    return neg ? '(' + s + ')' : s;
  }

  G.GC = {
    D, cityById, indById, DEPTS, START_YEAR, monthLabel, calMonth, ECON,
    newGame, startCompany, advance, stepCompany, makeCompany, scaffoldCompany,
    metrics, balance, valuation, ceoStake, netWorth, recommendedStaff, salary, payroll, headcount, gaNeed, productivity, deptName,
    setStaff, launchProduct, unlockRegion, buildFacility, sellFacility, facDef, facLease, buildSites, canBuildIn, resQ,
    supplierOptions, supplierTerms, buyPrice, lockContract, productDemand, marketSize, appeal, regionPot,
    loanCapacity, loanRate, takeLoan, repayLoan, revolverRoom, revolver,
    availableRounds, requestTermSheet, acceptTermSheet, buyback,
    crisisOptions, resolveCrisis, bankrupt, resolveEvent, acceptOffer, sellHolding, seekBuyer, endTenure,
    freightIndex, compat, channelsFor, setMkt, applyPreset, accountsFor, pitchOdds, pitchAccount, dropAccount, toggleWeb, openStore, closeStore,
    setTier, tierOf, ingredientQ, qEff, upgradesFor, startProject, farmInputs, farmDeal, partnerFarm, expandFarm, endFarm, bomOf, homeMult,
    elecPrice, ppaPrice, capPrice, prime, angelPre, starterTeam, estFacilityRevenue, computeAlerts, fmt$, clamp, ceoLiving, rand
  };
})(typeof window !== 'undefined' ? window : globalThis);
