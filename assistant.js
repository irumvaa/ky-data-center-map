/* Ask the map: a built-in chat assistant.
 *
 * It runs entirely in the page. It reads the same `projects` and `regulations`
 * arrays the map draws, so it always matches what visitors see, and it sends
 * nothing anywhere. It is not a language model: it understands questions by
 * matching names, topics and patterns, then answers from the data and links
 * to the map. Anything it cannot answer from the map, it says so and points to
 * outside sources. See the README section "Ask the map" for how to extend it.
 */
(function () {
  'use strict';
  if (window.__askMapLoaded) return;
  window.__askMapLoaded = true;

  // ---------------------------------------------------------------- helpers
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const P = s => '<p>' + rich(s) + '</p>';
  const UL = a => a.length ? '<ul>' + a.map(x => '<li>' + rich(x) + '</li>').join('') + '</ul>' : '';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const cap = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());
  const safeUrl = u => /^https?:\/\/\S+$/i.test(String(u || '').trim());
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  const unknownVal = v => !v || /^(n\/?a|not (publicly )?(disclosed|available|announced|named)|undisclosed|unknown|none|not yet announced)\b/i.test(String(v).trim());
  const STOP = new Set('a an the of and or to in on at for with about is are was were be been do does did can could would should will what whats which who whom whose where when why how tell me us you i we they it its their there this that these those any all some please show list give find get know more than from by as if into over under near around between versus vs county counties data center centers centre project projects campus kentucky ky'.split(' '));
  const AMBIGUOUS_COUNTY = new Set(['green', 'union', 'clay', 'grant', 'lee', 'hart', 'bath', 'casey', 'carter', 'henry', 'hancock', 'ohio', 'owen', 'pike', 'rowan', 'russell', 'taylor', 'trigg', 'washington', 'wayne', 'webster', 'marion', 'warren', 'todd', 'logan', 'knox', 'bell', 'boone', 'butler', 'campbell', 'christian', 'crittenden', 'edmonson', 'estill', 'fleming', 'franklin', 'garrard', 'harrison', 'jackson', 'lincoln', 'madison', 'mason', 'monroe', 'morgan', 'nelson', 'perry', 'powell', 'scott', 'shelby', 'simpson', 'spencer']);
  // A small gazetteer so a city the map has no record for still resolves to its county.
  const CITY_COUNTY = { 'berea': 'Madison', 'richmond': 'Madison', 'lexington': 'Fayette', 'louisville': 'Jefferson', 'bowling green': 'Warren', 'owensboro': 'Daviess', 'covington': 'Kenton', 'georgetown': 'Scott', 'florence': 'Boone', 'elizabethtown': 'Hardin', 'hopkinsville': 'Christian', 'frankfort': 'Franklin', 'henderson': 'Henderson', 'nicholasville': 'Jessamine', 'jeffersontown': 'Jefferson', 'paducah': 'McCracken', 'ashland': 'Boyd', 'radcliff': 'Hardin', 'murray': 'Calloway', 'danville': 'Boyle', 'winchester': 'Clark', 'shelbyville': 'Shelby', 'lawrenceburg': 'Anderson', 'somerset': 'Pulaski', 'pikeville': 'Pike', 'hazard': 'Perry', 'harlan': 'Harlan', 'middlesboro': 'Bell', 'london': 'Laurel', 'corbin': 'Whitley', 'glasgow': 'Barren', 'bardstown': 'Nelson', 'russellville': 'Logan', 'madisonville': 'Hopkins', 'mount sterling': 'Montgomery', 'maysville': 'Mason', 'paris': 'Bourbon', 'versailles': 'Woodford', 'morehead': 'Rowan', 'campbellsville': 'Taylor', 'prestonsburg': 'Floyd', 'whitesburg': 'Letcher', 'pineville': 'Bell', 'lebanon': 'Marion', 'mayfield': 'Graves', 'fort thomas': 'Campbell', 'erlanger': 'Kenton', 'independence': 'Kenton', 'burlington': 'Boone', 'shepherdsville': 'Bullitt', 'la grange': 'Oldham', 'cave city': 'Barren', 'ludlow': 'Kenton', 'hawesville': 'Hancock', 'calvert city': 'Marshall', 'kevil': 'McCracken', 'wilmore': 'Jessamine', 'west point': 'Hardin', 'ekron': 'Meade', 'burgin': 'Mercer', 'harrodsburg': 'Mercer', 'franklin': 'Simpson', 'prospect': 'Jefferson', 'campton': 'Wolfe', 'simpsonville': 'Shelby', 'russell': 'Greenup', 'ghent': 'Carroll', 'carrollton': 'Carroll', 'ivel': 'Floyd', 'mount washington': 'Bullitt', 'vine grove': 'Hardin', 'flemingsburg': 'Fleming', 'cynthiana': 'Harrison', 'princeton': 'Caldwell', 'benton': 'Marshall', 'elkton': 'Todd', 'taylorsville': 'Spencer', 'eminence': 'Henry', 'new castle': 'Henry', 'liberty': 'Casey', 'columbia': 'Adair', 'monticello': 'Wayne', 'williamsburg': 'Whitley', 'manchester': 'Clay', 'hyden': 'Leslie', 'jackson': 'Breathitt', 'salyersville': 'Magoffin', 'paintsville': 'Johnson', 'louisa': 'Lawrence', 'grayson': 'Carter', 'olive hill': 'Carter', 'greenup': 'Greenup', 'flatwoods': 'Greenup', 'russell springs': 'Russell', 'edmonton': 'Metcalfe' };

  // -------------------------------------------------------------- resources
  // Outside links, each checked when this was written. Used only when a question
  // goes beyond what the map holds. Topic words decide which are offered.
  const RES = [
    { id: 'mta', title: 'Mountain Association: Data center resources in Kentucky', url: 'https://mtassociation.org/communities/data-center-resources-in-kentucky/', topics: 'resources guide communities county counties moratoria moratorium general local government ordinance' },
    { id: 'epic', title: 'EPIC Report 2026-001: Data Centers in Kentucky, Policy Analysis for the General Assembly (June 2026)', url: 'https://caer.uky.edu/sites/default/files/2026-06/epic-report-no-2026-001.pdf', topics: 'policy ratepayer ratepayers cost costs grid electric electricity rates bills general assembly state economic development legislature study analysis' },
    { id: 'beshear', title: 'Governor’s executive order on data centers (Kentucky Association of Counties, Aug 2026)', url: 'https://kaco.org/articles/beshear-issues-executive-order-establishing-framework-for-data-centers/', topics: 'governor beshear executive order state statewide framework policy' },
    { id: 'klc', title: 'Kentucky League of Cities: Cities vary responses to data center interest (July 2026)', url: 'https://www.klc.org/News/13328/cities-vary-responses-to-data-center-interest', topics: 'city cities municipal mayor council local government response' },
    { id: 'ekpc', title: 'East Kentucky Power Cooperative: Data centers', url: 'https://ekpc.coop/data-centers', topics: 'ekpc east kentucky power cooperative co-op coop rural electric member tariff utility' },
    { id: 'ekpctariff', title: 'EKPC data center tariff as approved by the PSC (Oct 2025)', url: 'https://ekpc.coop/sites/default/files/PDFs/2025/2025-10-31__EKPC_Data_Center_tariff_approved_by_PSC2.pdf', topics: 'tariff rate rates large load ekpc contract charges' },
    { id: 'psc', title: 'Kentucky Public Service Commission (case filings and orders)', url: 'https://psc.ky.gov/', topics: 'psc public service commission case filing filings order rate tariff utility lge ku kentucky power big rivers application' },
    { id: 'tracker', title: 'Kentucky Lantern: See where data center developers are looking to build in Kentucky', url: 'https://www.newsfromthestates.com/article/see-where-data-center-developers-are-looking-build-kentucky', topics: 'news developers tracker locations who building proposals lantern reporting' },
    { id: 'pause', title: 'Kentucky Lantern: Some Kentucky counties and cities are hitting pause on data centers', url: 'https://www.newsfromthestates.com/article/some-kentucky-counties-and-cities-are-hitting-pause-data-centers', topics: 'news moratorium moratoria pause counties cities local latest' },
    { id: 'lantern', title: 'Kentucky Lantern', url: 'https://kentuckylantern.com/', topics: 'news reporting latest headlines articles' },
    { id: 'dcmap', title: 'datacentermap.com: Kentucky data centers', url: 'https://www.datacentermap.com/usa/kentucky/', topics: 'colocation hosting commercial facility facilities directory listing operating' },
    { id: 'peering', title: 'PeeringDB (network and facility directory)', url: 'https://www.peeringdb.com/', topics: 'peering network facility facilities colocation verify verification carrier' },
    { id: 'eia', title: 'U.S. Energy Information Administration: Kentucky profile', url: 'https://www.eia.gov/state/?sid=KY', topics: 'electricity prices generation power plants energy statistics natural gas pipelines supply demand' },
    { id: 'leg', title: 'Kentucky General Assembly', url: 'https://legislature.ky.gov/', topics: 'bill bills law laws legislation legislature senate house statute session' },
    { id: 'eec', title: 'Kentucky Energy and Environment Cabinet', url: 'https://eec.ky.gov/', topics: 'environment environmental water air quality permit permits pollution emissions noise wastewater' },
    { id: 'ced', title: 'Kentucky Cabinet for Economic Development', url: 'https://ced.ky.gov/', topics: 'incentive incentives tax abatement kedfa jobs economic development investment employment' },
    { id: 'lex', title: 'City of Lexington: Data centers', url: 'https://engage.lexingtonky.gov/DataCenters', topics: 'lexington fayette zoning ordinance moratorium planning commission' },
    { id: 'contact', title: 'Email the Mountain Association Energy Team', url: 'mailto:energy@mtassociation.org', topics: 'contact staff question email reach' }
  ];
  const resById = id => RES.find(r => r.id === id);
  // Which topic words in a question suggest which outside links.
  const OFFMAP = [
    { re: /\b(rate|rates|bill|bills|price|prices|cost|costs|ratepayers?|tariffs?|electricity|kilowatt|kwh)\b/, ids: ['psc', 'epic', 'ekpctariff', 'eia'], label: 'electric rates and tariffs' },
    { re: /\b(water|environment\w*|pollution|air quality|emissions?|noise|permits?|wastewater|wetlands?|karst|sinkholes?|diesel|generators?)\b/, ids: ['eec', 'epic'], label: 'environmental and water impacts' },
    { re: /\b(tax|taxes|incentives?|abatements?|jobs|employment|economic|kedfa|investment|payroll|workers?)\b/, ids: ['ced', 'epic', 'tracker'], label: 'jobs, taxes and incentives' },
    { re: /\b(laws?|legislat\w*|statutes?|bills?|governor|executive order|statewide|general assembly|policy|policies)\b/, ids: ['leg', 'beshear', 'epic'], label: 'state law and policy' },
    { re: /\b(council|fiscal court|minutes|meetings?|agenda|hearings?|planning commission|zoning board|vote|votes|voted)\b/, ids: ['klc', 'mta', 'tracker'], label: 'local meetings and votes' },
    { re: /\b(news|latest|recent|headlines?|articles?|reporting|reported|press)\b/, ids: ['tracker', 'pause', 'lantern'], label: 'recent news' },
    { re: /\b(colocation|colo|hosting|carrier|peering|isp)\b/, ids: ['dcmap', 'peering'], label: 'commercial facilities' },
    { re: /\b(power plants?|generation|grid|pjm|capacity market|natural gas|solar|nuclear|wind|batter\w+|storage|renewables?|coal|hydro\w*)\b/, ids: ['eia', 'epic', 'ekpc'], label: 'the power grid and energy supply' },
    { re: /\b(lexington|fayette)\b/, ids: ['lex'], label: 'Lexington’s process' }
  ];
  function linksFor(q, max) {
    const out = []; const seen = new Set();
    OFFMAP.forEach(o => { if (o.re.test(q)) o.ids.forEach(id => { if (!seen.has(id)) { seen.add(id); out.push(resById(id)); } }); });
    return out.slice(0, max || 4);
  }
  function linkBlock(list, heading) {
    list = list.filter(Boolean);
    if (!list.length) return '';
    return '<div class="ask-links"><strong>' + esc(heading || 'Outside sources that may help') + '</strong><ul>' +
      list.map(r => '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a></li>').join('') + '</ul></div>';
  }
  function sourceBlock(links, heading) {
    const ok = (links || []).filter(safeUrl).slice(0, 4);
    if (!ok.length) return '';
    return '<div class="ask-links"><strong>' + esc(heading || 'Sources on the map') + '</strong><ul>' +
      ok.map(u => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {} return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(h) + '</a></li>'; }).join('') + '</ul></div>';
  }

  // ------------------------------------------------------------ knowledge base
  const COMPANIES = ['anthropic', 'meta', 'amazon', 'aws', 'google', 'microsoft', 'oracle', 'openai', 'apple', 'nvidia', 'coreweave', 'crusoe'];
  const UTILS = [
    { key: 'ekpc', label: 'East Kentucky Power Cooperative (EKPC)', re: /\bekpc\b|east kentucky power/i },
    { key: 'lgeku', label: 'LG&E and KU (Kentucky Utilities)', re: /lg&e|lg&amp;e|\blge[- ]|lg and e|\bku\b|kentucky utilities|louisville gas/i },
    { key: 'kypower', label: 'Kentucky Power (AEP)', re: /kentucky power|\baep\b/i },
    { key: 'bigrivers', label: 'Big Rivers Electric', re: /big rivers/i },
    { key: 'owen', label: 'Owen Electric Cooperative', re: /owen electric/i },
    { key: 'farmers', label: 'Farmers RECC', re: /farmers recc|farmers rural/i },
    { key: 'jpec', label: 'Jackson Purchase Energy', re: /jackson purchase/i },
    { key: 'paducahpower', label: 'Paducah Power System', re: /paducah power/i }
  ];
  const UTIL_ALIASES = { ekpc: ['ekpc', 'east kentucky power'], lgeku: ['lg e', 'lge', 'ku', 'lg and e', 'lg e ku', 'kentucky utilities', 'lg e and ku'], kypower: ['kentucky power', 'aep'], bigrivers: ['big rivers'], owen: ['owen electric'], farmers: ['farmers recc'], jpec: ['jackson purchase'], paducahpower: ['paducah power'] };
  let KB = null, KBSIG = '';
  // Content hash, so any edit in the Sheet (not just added or removed rows) rebuilds the chat's knowledge.
  function sig() {
    let h = 5381;
    const feed = x => { for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; };
    try { feed(JSON.stringify(projects, (k, v) => k === '_blob' ? undefined : v)); feed(JSON.stringify(regulations, (k, v) => k === '_blob' ? undefined : v)); } catch (e) {}
    return projects.length + '|' + regulations.length + '|' + h;
  }
  function devKeys(s) {
    return String(s || '').replace(/\([^)]*\)/g, ' ').split(/\s*(?:\/|;|,|\band\b|\bvia\b|\bwith\b|\bbacked by\b|\bpower supplied by\b)\s*/i)
      .map(x => norm(x).replace(/\b(llc|inc|co|corp|corporation|companies|company|data centers?|holdings|group|properties|partners)\b/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(x => x.length >= 3 && !/^(n a|na|none|undisclosed|not named|unknown|multiple|not applicable)/.test(x));
  }
  function buildKB() {
    const kb = { dev: {}, devLabel: {}, util: {}, tenant: {}, byCounty: {}, regByCounty: {}, cityNames: new Set(), countyKeys: new Map() };
    allCounties.forEach(c => kb.countyKeys.set(norm(c), c));
    projects.forEach((p, i) => {
      p._k = { devs: devKeys(p.developer), utils: [], tenants: [] };
      p._k.devs.forEach(k => { (kb.dev[k] = kb.dev[k] || []).push(i); if (!kb.devLabel[k]) kb.devLabel[k] = cap(k); });
      const txt = [p.utility, p.tariff, p.notes].join(' ');
      UTILS.forEach(u => { if (u.re.test(txt)) { p._k.utils.push(u.key); (kb.util[u.key] = kb.util[u.key] || []).push(i); } });
      const tt = norm([p.tenant, p.notes].join(' '));
      COMPANIES.forEach(c => { if (new RegExp('\\b' + c + '\\b').test(tt)) { p._k.tenants.push(c); (kb.tenant[c] = kb.tenant[c] || []).push(i); } });
      const ck = norm(p.county); (kb.byCounty[ck] = kb.byCounty[ck] || []).push(i);
      if (p.city) kb.cityNames.add(norm(p.city));
    });
    regulations.forEach((r, i) => { const ck = norm(r.county); (kb.regByCounty[ck] = kb.regByCounty[ck] || []).push(i); if (r.city) kb.cityNames.add(norm(r.city)); });
    // Prefer the developer's own wording for display.
    Object.keys(kb.dev).forEach(k => {
      const p = projects[kb.dev[k][0]];
      const seg = String(p.developer || '').replace(/\([^)]*\)/g, ' ').split(/\s*(?:\/|;|,)\s*/).find(x => norm(x).indexOf(k) === 0);
      if (seg) kb.devLabel[k] = seg.trim();
    });
    return kb;
  }
  function kb() { const s = sig(); if (!KB || s !== KBSIG) { KBSIG = s; KB = buildKB(); } return KB; }

  // ----------------------------------------------------------- map accessors
  const isCountyLevel = r => /^county$/i.test(String(r.level || '').trim());
  const regKind = r => (typeof regTypeKey === 'function' ? regTypeKey(r.type) : norm(r.type));
  function describeReg(r) {
    const place = isCountyLevel(r) ? r.county + ' County' : (r.city ? r.city + ' (' + r.county + ' County)' : r.county + ' County');
    const d = daysUntilExpiry(r);
    let tail = '';
    if (norm(r.type) === 'moratorium') {
      if (r.expiration && d !== null) tail = ', ends ' + r.expiration + (d <= 90 && d >= 0 ? ' (' + plural(d, 'day') + ' left)' : '');
      else tail = ', no end date on file';
    }
    return r.type + ' in ' + place + (isCountyLevel(r) ? ' (county-wide)' : ' (city-level)') + tail;
  }
  function regsFor(county) { return (kb().regByCounty[norm(county)] || []).map(i => ({ i, r: regulations[i] })); }
  function projectsFor(county) { return (kb().byCounty[norm(county)] || []).map(i => ({ i, p: projects[i] })); }
  function expiredFor(county) { return (typeof droppedMoratoria !== 'undefined' ? droppedMoratoria : []).filter(r => norm(r.county) === norm(county)); }
  function regContext(p) {
    const out = [];
    regsFor(p.county).forEach(({ r }) => {
      if (isCountyLevel(r)) out.push(r);
      else if (p.city && norm(r.city) === norm(p.city)) out.push(r);
    });
    return out;
  }
  function mw(p) { return capacityMW(p.size); }
  function projLabel(p) { return p.name + ' (' + p.county + ' Co.)'; }
  function projItem(i) { const p = projects[i]; return { kind: 'proj', i, p, lat: p.lat, lng: p.lng }; }
  function regItem(i) { const r = regulations[i]; return { kind: 'reg', i, r, lat: r.lat, lng: r.lng }; }
  function nearby(p, miles, max) {
    return projects.map((q, i) => ({ q, i, d: milesBetween(p.lat, p.lng, q.lat, q.lng) })).filter(o => o.q !== p && o.d <= miles).sort((a, b) => a.d - b.d).slice(0, max || 5);
  }
  function stageCounts(list) { const c = { Rumored: 0, Proposed: 0, Operating: 0 }; list.forEach(p => { c[p.stage] = (c[p.stage] || 0) + 1; }); return c; }
  function mwSum(list) { let t = 0, n = 0; list.forEach(p => { const m = mw(p); if (m != null) { t += m; n++; } }); return { total: t, counted: n }; }
  const fmtMW = v => v >= 1000 ? (Math.round(v / 100) / 10) + ' GW' : Math.round(v) + ' MW';

  // ---------------------------------------------------------- entity finding
  function qTokens(qn) { return qn.split(' ').filter(Boolean); }
  function tokenHit(tok, qt, qn) {
    if (qt.indexOf(tok) !== -1) return true;
    if (tok.length >= 6) return qt.some(w => w.length >= 5 && editDistance(tok, w) <= 1);
    return false;
  }
  function sigTokens(name, skip) {
    const all = qTokens(norm(name)).filter(t => t.length > 1 && !STOP.has(t));
    const t2 = all.filter(t => !skip.has(t));
    return t2.length ? t2 : all;
  }
  function findEntities(q) {
    const K = kb(); const qn = norm(q), qt = qTokens(qn);
    const ents = { projects: [], counties: [], cities: [], devs: [], utils: [], tenants: [] };
    const geoWords = new Set();
    allCounties.forEach(c => norm(c).split(' ').forEach(t => geoWords.add(t)));
    K.cityNames.forEach(c => c.split(' ').forEach(t => geoWords.add(t)));
    // counties
    allCounties.forEach(c => {
      const k = norm(c);
      const has = new RegExp('\\b' + k + '\\b').test(qn);
      const withWord = new RegExp('\\b' + k + ' county\\b').test(qn) || new RegExp('\\b(in|near|of|at|around|from|for|within) ' + k + '\\b').test(qn);
      if ((has && !AMBIGUOUS_COUNTY.has(k)) || withWord) ents.counties.push(c);
      else if (!has && k.length >= 7 && qt.some(w => w.length >= 6 && editDistance(k, w) <= 1) && !STOP.has(k)) ents.counties.push(c);
    });
    // cities (from records, then the gazetteer)
    const cityKeys = new Set([...K.cityNames, ...Object.keys(CITY_COUNTY)]);
    cityKeys.forEach(k => {
      if (k.length < 3) return;
      if (new RegExp('\\b' + k + '\\b').test(qn)) {
        const county = (typeof cityToCounty !== 'undefined' && cityToCounty[k]) || CITY_COUNTY[k] || '';
        const c = allCounties.find(x => norm(x) === norm(county)) || county;
        if (!ents.cities.some(e => e.key === k)) ents.cities.push({ key: k, county: c });
      }
    });
    // drop a city that is a substring of a longer matched city ("york" inside "new york")
    ents.cities = ents.cities.filter(e => !ents.cities.some(o => o !== e && o.key.indexOf(e.key) !== -1 && o.key.length > e.key.length));
    // projects
    projects.forEach((p, i) => {
      const nn = norm(p.name);
      const nn2 = norm(String(p.name).replace(/\([^)]*\)/g, ' '));
      let score = 0;
      if (nn.length >= 4 && new RegExp('\\b' + nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(qn)) score = 100 + nn.length;
      else if (nn2.length >= 6 && new RegExp('\\b' + nn2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(qn)) score = 100 + nn2.length;
      else {
        const toks = sigTokens(p.name, geoWords);
        if (!toks.length) return;
        const hits = toks.filter(t => tokenHit(t, qt, qn)).length;
        const cov = hits / toks.length;
        if (hits >= 1 && (cov >= 0.6 || (hits >= 1 && toks.length === 1))) score = Math.round(cov * 60) + hits * 5;
      }
      if (score >= 30) ents.projects.push({ i, score });
    });
    ents.projects.sort((a, b) => b.score - a.score);
    if (ents.projects.length > 1 && ents.projects[0].score >= 100 && ents.projects[1].score < 100) ents.projects = ents.projects.filter(o => o.score >= 100);
    // developers
    Object.keys(K.dev).forEach(k => {
      if (k.length < 3) return;
      const rx = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (rx.test(qn) || (k.length >= 6 && !k.includes(' ') && qt.some(w => w.length >= 5 && editDistance(k, w) <= 1))) ents.devs.push(k);
    });
    // utilities
    UTILS.forEach(u => {
      const al = UTIL_ALIASES[u.key];
      if (al.some(a => (a.length <= 3 ? new RegExp('\\b' + a + '\\b').test(qn) && /\b(utility|power|electric|served|supplier|tariff|serves|co op|cooperative)\b|\b(lge|ku)\b/.test(qn) : new RegExp('\\b' + a + '\\b').test(qn)))) ents.utils.push(u.key);
    });
    // tenants
    COMPANIES.forEach(c => { if (new RegExp('\\b' + c + '\\b').test(qn)) ents.tenants.push(c); });
    // a developer match that is just the project's own name should not shadow it
    return ents;
  }

  // ------------------------------------------------------- knowledge: how to
  const HELP_PAGE = 'help.html';
  const FAQ = [
    { id: 'purpose', kw: 'purpose made built maintained mountain association', a: () => [P('This map tracks data center projects and local data center rules (moratoria, ordinances and pending proposals) across Kentucky. The Mountain Association Energy Team, a Kentucky nonprofit, maintains it using public filings, local news and the Kentucky Lantern. The Ask the map helper was built for the team and runs only on this page. To reach the people behind it, email energy@mtassociation.org.'), P('Everything on the map comes from a tracking spreadsheet that staff review before anything is published. Nothing here is legal advice, so check the source links on each entry.')], chips: ['How do I read the colors?', 'What’s the big picture?'] },
    { id: 'colors', kw: 'color colors colour colours legend shading blue teal red amber gray grey stripe stripes diagonal mean meaning county shading regulation', a: () => [P('County shading shows local rules:'), UL(['**Blue** is a moratorium, a temporary pause on new data center construction.', '**Teal** is an ordinance, a permanent zoning rule.', '**Red** is pending or proposed, not yet passed.', '**Amber** means a city inside the county has a rule but the county does not.', '**Diagonal stripes** mean both a county-wide rule and a separate city rule.', '**Gray** means nothing on file at any level. That means nothing is tracked, not proof that nothing exists.']), P('Project pins are colored by stage: green for Rumored, indigo for Proposed and magenta for Operating.')], chips: ['What does a square mean?', 'What does a dashed pin mean?'] },
    { id: 'pins', kw: 'pin pins dot dots dashed solid teardrop marker markers icon icons stage rumored proposed operating approximate exact site zoom', a: () => [P('Each teardrop pin is one data center project. A solid pin means the exact site is known. A dashed pin means only the county is known so far. When the map is zoomed out or projects overlap, they show as small dots, and each dot turns into a pin once there is room.'), P('Color shows stage: **Rumored** (green), **Proposed** (indigo) and **Operating** (magenta). Every project is always shown on the map.')], chips: ['How many projects are in each stage?'] },
    { id: 'squares', kw: 'square squares city level city rules municipal small square', a: () => [P('A small square marks a rule that applies to one city, not the whole county. Squares use the same colors as the county shading (blue moratorium, teal ordinance, red pending), so they stand out from the round project dots when you zoom out.')], chips: ['Which city-level rules are there?'] },
    { id: 'filters', kw: 'filter filters button buttons toggle toggles pill pills regulation all expiring soon show projects stage layers turn off hide select multiple', a: () => [P('The strip above the map has three groups:'), UL(['**Regulation** filters the county shading by type. Click one or more types to keep them colored and fade the rest. Click a selected type again to turn it off. **All** shows everything, and clicking All again while selected turns the shading off.', '**Projects** filters pins by stage (Rumored, Proposed, Operating), and Show projects hides or shows them all.', '**Layers** adds transmission lines and gas pipelines.']), P('The number on each button is how many items match right now. Turning on a filter also zooms the map to the places that match.')], chips: ['What does Expiring soon mean?'] },
    { id: 'expiring', kw: 'expiring soon expire expires expired expiry end ends ending hidden removed fall off gone disappear days 60', a: () => [P('Expiring soon picks moratoria that end within 60 days, and their popups show a tag like “Expires in 16 days”. When a moratorium passes its end date it is removed from the map automatically but stays in the tracking sheet. If one was extended, staff update its end date and it comes back.')], chips: ['Which moratoria end soon?'] },
    { id: 'search', kw: 'search bar searching find look type query typing question questions natural plain english', a: () => [P('The search box takes county, city and project names, developers, keywords like “moratorium”, and even plain-English questions such as “moratoria ending this year”, “proposed projects near Louisville” or “projects over 500 MW”. It forgives typos and understands words like “ban” or “pause”. Press Enter to take the top result.')], chips: ['Proposed projects near Louisville', 'Projects over 500 MW'] },
    { id: 'share', kw: 'share sharing link copy url send address bookmark same view', a: () => [P('Click **Copy link to this view** in the left panel. The address updates as you use the map, so the link remembers your filters, the county you picked and where you zoomed. Anyone who opens it sees the same view.')], chips: [] },
    { id: 'layers', kw: 'layer layers transmission line lines gas pipeline pipelines infrastructure voltage', a: () => [P('The **Transmission lines** and **Gas pipelines** buttons pull public government data each time you turn them on. The transmission data is about 2025 and roughly half of it has no voltage listed at the source. The pipeline data is a January 2020 snapshot, so treat it as historical.'), linkBlock([resById('eia')], 'For current energy data')], chips: [] },
    { id: 'verification', kw: 'verification verified verify confirmed likely unverified commercial facility facilities datacentermap colocation hosting independent', a: () => [P('Some Operating pins are ordinary commercial hosting and colocation facilities from datacentermap.com. Each is marked: **confirmed** (checked against independent sources such as the operator’s site, PeeringDB or news), **likely** (independent sources point to it, details only partly confirmed) or **unverified** (listed on datacentermap.com and not independently verified).')], chips: ['How many facilities are unverified?'] },
    { id: 'report', kw: 'report problem wrong error mistake correct correction fix update add submit new information form suggest missing contribute', a: () => [P('You can add a new project or rule, or report a mistake, with the two forms. Nothing goes on the map automatically: staff review every submission first.'), '<p><a href="' + esc(ADD_FORM_URL) + '" target="_blank" rel="noopener">Add new information</a> · <a href="' + esc(REPORT_FORM_URL) + '" target="_blank" rel="noopener">Report a problem</a></p>'], chips: [] },
    { id: 'popups', kw: 'click clicking popup popups details county pin open info information', a: () => [P('Click any county or pin to open a popup with the details on file and a link to the source. A county popup also lists the projects in that county, and clicking one zooms to it. When a field says “Not available”, that information is not public yet. The map does not guess to fill gaps.')], chips: [] },
    { id: 'mobile', kw: 'mobile phone iphone android tablet small screen touch', a: () => [P('On a phone everything stacks in one column: filters first, then the map, with the legend below it. Pinch to zoom and tap any county or pin for its popup.')], chips: [] },
    { id: 'source', kw: 'data source sources come from where how often updated current fresh last updated live snapshot accurate reliable trust', a: () => [P('Regulations and projects come from a tracking spreadsheet maintained by the Mountain Association, built from news, public filings and datacentermap.com for the commercial facilities. The footer shows when the data was last updated. The transmission and gas layers come straight from government sources.'), P('Entries link to their sources so you can check them. If you spot something wrong, use the Report a problem form.')], chips: [] },
    { id: 'missing', kw: 'missing not on map not here why isnt why is not where is cant find couldnt find absent', a: () => [P('The map only shows what has been tracked and reviewed, so a county with nothing on file is gray. If something is missing, it may not be public yet or may not have been added. Use the **Add new information** form and staff will review it.')], chips: [] },
    { id: 'check', kw: 'data check checks quality staff admin check=1 problems errors audit', a: () => [P('Staff can add **?check=1** to the end of the map’s address to see a list of possible data problems, such as an end date that does not match the start and length, sources that are not links, and moratoria hidden because they expired.')], chips: [] },
    { id: 'assistant', kw: 'you assistant chat bot ai what can you do help abilities capabilities who are you', a: () => [P('I’m the map’s built-in helper. I read the same data the map shows, so I can look things up, count and compare, connect projects to local rules, and show results on the map. I can also explain how the map works. I’m not an AI language model and I only know what is on this map, so for anything else I’ll point you to outside sources.'), UL(['Look up a project, county, city, developer or utility', 'Answer questions like “which proposed projects are in counties with a moratorium?”', 'Find gaps, such as counties with proposed projects and no rule', 'Explain the legend, filters and sharing'])], chips: ['What’s the big picture?', 'Which proposed projects are in counties with a moratorium?'] },
    { id: 'contact', kw: 'contact reach email phone staff who do i contact who to contact talk to person human question feedback help team', a: () => [P('You can email the Mountain Association Energy Team at **energy@mtassociation.org**. To add or correct information, the forms are quicker because staff review each one.'), '<p><a href="mailto:energy@mtassociation.org">Email the Energy Team</a> \u00b7 <a href="' + esc(ADD_FORM_URL) + '" target="_blank" rel="noopener">Add new information</a> \u00b7 <a href="' + esc(REPORT_FORM_URL) + '" target="_blank" rel="noopener">Report a problem</a></p>'], chips: [] },
    { id: 'download', kw: 'download export csv excel spreadsheet raw data copy data get the data api dataset print printing pdf screenshot save', a: () => [P('The map does not have a download or print button. The data lives in a Google Sheet that Mountain Association staff maintain, so for the data itself, email energy@mtassociation.org. To save what you see, take a screenshot, or use **Copy link to this view** to share the exact view.')], chips: ['How do I share this view?'] },
    { id: 'zoom', kw: 'zoom zooming pan move drag scroll navigate reset recenter fit whole state plus minus', a: () => [P('Use the + and \u2212 buttons on the map, scroll or pinch to zoom, and drag to move. Searching or picking a county zooms to it, and turning on a filter zooms to the places that match. To see the whole state again, clear the search.')], chips: [] },
    { id: 'findcounty', kw: 'find a county look up county find my county search county locate city find a city find a project', a: () => [P('Type a county, city or project name in the search box at the top and choose a result, and the map zooms to it. You can also click any county on the map, or ask me, for example **Is there a moratorium in Madison County?**')], chips: ['Is there a moratorium in Madison County?'] },
    { id: 'gray', kw: 'gray grey why is my county gray nothing no regulation counties gray what counties are gray uncolored white blank empty', a: () => [P('Gray means no regulation is on file for that county or any city in it. That means nothing is tracked on this map, not proof that no rule exists. If you know of one, use the Add new information form.'), P('On the current data, ' + Math.max(0, allCounties.length - new Set(regulations.map(r => norm(r.county))).size) + ' of ' + allCounties.length + ' counties are gray.')], chips: ['Which counties have no regulation but a proposed project?'] },
    { id: 'helppage', kw: 'help page guide tutorial documentation manual', a: () => ['<p>There is a fuller guide on the <a href="' + HELP_PAGE + '">How this map works</a> page.</p>'], chips: [] }
  ];
  const GLOSS = [
    { t: ['moratorium', 'moratoria'], a: 'A moratorium is a temporary pause on new data center construction or applications, usually for months or a couple of years, while a local government writes permanent rules.', f: () => { const n = regulations.filter(r => norm(r.type) === 'moratorium').length; return 'The map currently shows ' + plural(n, 'active moratorium', 'active moratoria') + '.'; }, chip: 'Which moratoria end soon?' },
    { t: ['ordinance'], a: 'An ordinance is a permanent local rule, for example zoning standards a data center must meet.', f: () => { const n = regulations.filter(r => norm(r.type) === 'ordinance').length; return 'The map shows ' + plural(n, 'ordinance') + '.'; }, chip: 'Show me the ordinances' },
    { t: ['pending', 'proposed regulation'], a: 'Pending or proposed means a rule that has been put forward but has not passed yet.' },
    { t: ['rumored'], a: 'Rumored is the earliest stage on the map: a project that has been talked about or reported, with little confirmed yet.' },
    { t: ['operating'], a: 'Operating means the facility is built and running. Many Operating pins are ordinary commercial hosting facilities rather than new hyperscale projects.' },
    { t: ['tsr', 'transmission service request'], a: 'A TSR (Transmission Service Request) is an application to a utility to reserve capacity on the power grid. For large data centers it is an early sign that a project is moving forward.', util: true },
    { t: ['esa', 'electric service agreement'], a: 'An ESA (Electric Service Agreement) is the contract between a utility and a large customer for power. It usually comes after a TSR.' },
    { t: ['ehlf', 'extremely high load factor'], a: 'EHLF is LG&E and KU’s “Extremely High Load Factor” tariff for very large, steady customers such as data centers using about 100 MW or more.' },
    { t: ['hyperscale', 'hyperscaler', 'hyperscalers'], a: 'A hyperscale data center is a very large facility, often hundreds of megawatts, built for the biggest cloud and AI companies. A hyperscaler is one of those companies.' },
    { t: ['mw', 'megawatt', 'megawatts', 'gw', 'gigawatt', 'gigawatts'], a: 'A megawatt (MW) measures how much power a facility can draw. 1,000 MW equals 1 gigawatt (GW). For scale, one MW powers roughly several hundred homes, and hyperscale campuses are planned in the hundreds of MW to multiple GW.' },
    { t: ['colocation', 'colo'], a: 'Colocation means a company rents space, power and cooling in a shared data center instead of building its own. Many of the commercial facilities on the map are colocation sites.' },
    { t: ['behind the meter', 'behind-the-meter'], a: 'Behind-the-meter means a site generates its own power on site, for example with gas turbines, instead of buying all of it from the utility grid.' },
    { t: ['tariff'], a: 'A tariff is the approved set of rates and rules a utility charges a customer class. Data centers often have their own large-load tariffs, approved by the Kentucky Public Service Commission.', util: true },
    { t: ['psc', 'public service commission'], a: 'The Kentucky Public Service Commission (PSC) regulates investor-owned utilities in the state, including their rates and tariffs. Utility filings for data centers appear in its case files.' },
    { t: ['kedfa'], a: 'KEDFA is the Kentucky Economic Development Finance Authority. It approves state tax incentives for qualifying projects.' },
    { t: ['ekpc', 'east kentucky power cooperative'], a: 'EKPC (East Kentucky Power Cooperative) generates and transmits power for rural electric cooperatives across much of eastern and central Kentucky. It has a data center tariff approved by the PSC.', util: 'ekpc' },
    { t: ['lge', 'lg e', 'ku', 'lg and e', 'kentucky utilities'], a: 'LG&E and KU are the Louisville and Lexington area utilities (Louisville Gas and Electric and Kentucky Utilities), which share an owner and a transmission system.', util: 'lgeku' },
    { t: ['pjm'], a: 'PJM is the regional grid operator for much of the eastern United States. Parts of Kentucky, including Kentucky Power’s area, sit inside PJM.' },
    { t: ['fiscal court'], a: 'A fiscal court is the governing body of a Kentucky county, made up of the county judge/executive and magistrates. Most county-wide moratoria on the map were passed by fiscal courts.' },
    { t: ['annexation', 'annex'], a: 'Annexation is when a city takes in land from the surrounding county. It matters here because a city’s land can fall outside county zoning, so a county moratorium may not cover it.' },
    { t: ['rezoning', 'rezone'], a: 'Rezoning changes what a piece of land may be used for, for example from agricultural to industrial. It is often the first public vote a data center project faces.' },
    { t: ['countywide', 'county wide', 'city level'], a: 'County-wide means a rule applies across the unincorporated county. City-level means it applies only inside one city. The map shows county rules as shading and city rules as small squares.' },
    { t: ['hifld'], a: 'HIFLD (Homeland Infrastructure Foundation-Level Data) is the federal dataset the map uses for the transmission lines layer. The map\u2019s copy is from about 2025, and about half of the lines have no voltage listed at the source.' },
    { t: ['transmission line', 'transmission lines', 'transmission'], a: 'Transmission lines are the high-voltage power lines that carry electricity across long distances. Large data centers usually need to connect to them or to a nearby substation. You can turn the layer on with the Transmission lines button.' },
    { t: ['gas pipeline', 'gas pipelines', 'pipeline', 'pipelines'], a: 'Natural gas pipelines matter because some data centers plan on-site gas power. The map\u2019s pipeline layer is a January 2020 snapshot, so treat it as historical.' },
    { t: ['voltage', 'kv', 'kilovolt'], a: 'Voltage measures how much electrical pressure a line carries. Transmission lines are usually 69 kV or higher. Larger data centers often need 138 kV or more.' },
    { t: ['substation', 'substations'], a: 'A substation steps electricity up or down between the transmission grid and local lines. Big data centers often need their own or a new one.' },
    { t: ['load', 'large load', 'large-load'], a: 'Load is how much electricity a customer uses. A large-load customer, such as a data center, can use as much as a small city, which is why utilities treat them under special tariffs.' },
    { t: ['city rules only', 'amber'], a: 'Amber (\u201cCity rules only\u201d) means a city inside the county has a rule but the county itself does not. Those rules show as small squares.' },
    { t: ['datacentermap', 'datacentermap com'], a: 'datacentermap.com is a public directory of commercial data centers. The map uses it for existing hosting and colocation facilities, which are marked confirmed, likely or unverified.' },
    { t: ['p z', 'pz', 'planning and zoning', 'zoning'], a: 'Planning and zoning (P&Z) is the local process that decides what land can be used for. For a data center, the key steps are usually a rezoning vote and a planning commission review.' },
    { t: ['ratepayer', 'ratepayers'], a: 'Ratepayers are the customers who pay a utility\u2019s rates. A common concern is whether the cost of power for a large data center ends up on other customers\u2019 bills.' },
    { t: ['data center', 'data centre', 'datacenter'], a: 'A data center is a building full of computers, servers and networking gear that store and process information, plus the power and cooling systems that keep them running. The large new projects on this map mostly serve cloud and AI computing, and some use as much electricity as a small city.' },
    { t: ['planning commission'], a: 'A planning commission is the local board that reviews zoning and land-use requests and makes recommendations to the city council or fiscal court. For a data center, its review is often the first public step.' },
    { t: ['investment', 'capital investment'], a: 'Investment figures on the map are the dollar amounts reported in news or filings for a project, often in the billions. They are announced numbers, not audited, and can change.' },
    { t: ['karst'], a: 'Karst is landscape with limestone caves and sinkholes. It is a concern for large construction, for example near Mammoth Cave in the Cave City area.' }
  ];

  // --------------------------------------------------------------- UI plumbing
  const state = { ctx: null, acts: [], open: false, asked: new Set() };
  function act(fn) { state.acts.push(fn); return state.acts.length - 1; }
  function btn(label, fn, cls) { return '<button type="button" class="ask-act ' + (cls || '') + '" data-act="' + act(fn) + '">' + esc(label) + '</button>'; }
  function showOnMap(items, title) {
    if (!items.length) return;
    closePanel(true);
    lastAnswer = { items: items, title: title, summary: title, note: '' };
    showAnswerOnMap();
    const m = document.getElementById('map'); if (m && m.scrollIntoView && window.innerWidth < 1000) m.scrollIntoView({ block: 'start' });
  }
  function mapBtn(items, title, label) { return btn(label || ('Show ' + (items.length === 1 ? 'it' : 'all ' + items.length) + ' on the map'), () => showOnMap(items, title)); }
  function projBtn(i, label) { return btn(label || 'Show on the map', () => { closePanel(true); selectProject(i); const m = document.getElementById('map'); if (m && window.innerWidth < 1000) m.scrollIntoView({ block: 'start' }); }); }
  function countyBtn(c, label) { return btn(label || ('Show ' + c + ' County on the map'), () => { closePanel(true); selectCounty(c); const m = document.getElementById('map'); if (m && window.innerWidth < 1000) m.scrollIntoView({ block: 'start' }); }); }
  function regBtn(i, label) { return btn(label || 'Show on the map', () => { closePanel(true); selectRegulation(i); const m = document.getElementById('map'); if (m && window.innerWidth < 1000) m.scrollIntoView({ block: 'start' }); }); }
  function chipRow(list) { list = (list || []).filter(Boolean).slice(0, 4); return list.length ? '<div class="ask-chips" aria-label="Suggested questions">' + list.map(c => '<button type="button" class="ask-chip" data-q="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : ''; }
  const R = (html, chips, ctx) => ({ html, chips: chips || [], ctx: ctx || null });

  // ---------------------------------------------------------------- answerers
  function projectCard(i, opts) {
    opts = opts || {}; const p = projects[i];
    const bits = [];
    bits.push('**' + p.name + '**: ' + (p._facility ? 'an Operating commercial facility' : 'a ' + String(p.stage).toLowerCase() + ' project') + ' in ' + p.county + ' County' + (p.city ? ' (' + p.city + ')' : '') + '.');
    const rows = [];
    const add = (label, v) => { if (!unknownVal(v)) rows.push('**' + label + ':** ' + clip(v, 200)); };
    add('Developer', p.developer); add('Size', p.size); add('Planning and zoning', p.pz); add('Power', expandUtilityStatus(p.utility)); add('Tariff', p.tariff); add('Expected completion', p.completionDate); add('Tenant', p.tenant);
    if (p._facility && p.verification) rows.push('**Verification:** ' + p.verification + ' (see the Verification note under “Commercial facilities” in the help page)');
    if (p.countyWide) rows.push('Only the county is known, so the pin sits at the county’s center.');
    return P(bits[0]) + UL(rows) + (p.notes && !p._facility ? P('Notes: ' + clip(p.notes, 320)) : '');
  }
  function connectionsFor(i) {
    const p = projects[i], K = kb(), lines = [];
    const regs = regContext(p);
    if (regs.length) regs.forEach(r => lines.push('**Local rule:** ' + describeReg(r) + '. Check whether this project is covered or exempt.'));
    else lines.push('**Local rule:** no regulation is on file for ' + p.county + ' County' + (p.city ? ' or ' + p.city : '') + ' on this map.');
    const exp = expiredFor(p.county); if (exp.length) lines.push('A moratorium here expired on ' + exp[0].expiration + ' and was removed from the map. It may have been replaced or extended.');
    p._k.devs.forEach(k => { const others = (K.dev[k] || []).filter(j => j !== i); if (others.length) lines.push('**Same developer:** ' + (K.devLabel[k]) + ' also appears on ' + others.slice(0, 4).map(j => projLabel(projects[j])).join(', ') + (others.length > 4 ? ' and ' + (others.length - 4) + ' more' : '') + '.'); });
    p._k.utils.forEach(k => { const others = (K.util[k] || []).filter(j => j !== i); const u = UTILS.find(x => x.key === k); if (others.length) lines.push('**Same power supplier:** ' + plural(others.length, 'other project') + ' on the map mention ' + u.label + '.'); });
    p._k.tenants.forEach(c => { const others = (K.tenant[c] || []).filter(j => j !== i); if (others.length) lines.push('**Tenant link:** ' + cap(c) + ' is also named for ' + others.slice(0, 3).map(j => projLabel(projects[j])).join(', ') + ' (some of these are reports, not confirmed).'); });
    if (isFinite(p.lat)) { const nb = nearby(p, 25, 4).filter(o => !o.q._facility || p._facility); if (nb.length) lines.push('**Nearby (within 25 miles):** ' + nb.map(o => o.q.name + ' (' + Math.round(o.d) + ' mi)').join(', ') + '.'); }
    return lines;
  }
  function answerProject(i, qn) {
    const p = projects[i]; state.ctx = { type: 'project', i };
    const want = [];
    const m = (re) => re.test(qn);
    if (m(/\b(who|developer|developing|developed|building|built|builds|behind|owner|owns|company|builder)\b/) && !m(/\b(tenant|customer)\b/)) want.push('dev');
    if (m(/\b(tenant|tenants|customer|lease\w*|occupant|end user|who will use|who is using)\b/)) want.push('tenant');
    if (m(/\b(size|big|large|capacity|mw|gw|megawatts?|gigawatts?|acres?|square feet|sq ft|how much power)\b/)) want.push('size');
    if (m(/\b(when|completion|complete|online|energized|timeline|open|opens|finish|ready|schedule|built by|done)\b/)) want.push('when');
    if (m(/\b(utility|power|electric\w*|tariff|grid|tsr|esa|energy|supplier|served by)\b/)) want.push('power');
    if (m(/\b(status|stage|approved|approval|zoning|rezon\w*|planning|denied|permitted|permit)\b/)) want.push('status');
    if (m(/\b(moratorium|allowed|legal|rules?|regulation|ban|banned|blocked|covered|exempt)\b/)) want.push('rule');
    if (m(/\b(source|sources|link|links|proof|evidence|verify|verified|reference|article)\b/)) want.push('sources');
    if (m(/\b(nearby|near it|close by|around it|neighbors?|other projects)\b/)) want.push('near');
    const chips = ['Show it on the map', p._k.devs[0] ? 'What else does ' + kb().devLabel[p._k.devs[0]] + ' have?' : null, 'Is there a moratorium in ' + p.county + ' County?'];
    const acts = projBtn(i);
    if (!want.length) {
      return R(projectCard(i) + '<div class="ask-sub"><strong>Connections</strong></div>' + UL(connectionsFor(i)) + sourceBlock(p.links) + '<div class="ask-actions">' + acts + '</div>' + (unknownVal(p.tenant) || unknownVal(p.utility) ? linkBlock(linksFor('tenant news power tariff', 3), 'For details the map does not have yet') : ''), chips, state.ctx);
    }
    const out = [];
    const miss = (what, extra) => out.push(P('The map does not have ' + what + ' for **' + p.name + '** yet' + (p[extra] ? ' (it says “' + clip(p[extra], 80) + '”)' : '') + '.'));
    if (want.includes('dev')) unknownVal(p.developer) ? miss('a named developer', 'developer') : out.push(P('The developer of **' + p.name + '** is listed as ' + p.developer + '.'));
    if (want.includes('tenant')) unknownVal(p.tenant) ? miss('a confirmed tenant', 'tenant') : out.push(P('Tenant for **' + p.name + '**: ' + clip(p.tenant, 260)));
    if (want.includes('size')) unknownVal(p.size) ? miss('a size', 'size') : out.push(P('Size of **' + p.name + '**: ' + clip(p.size, 220)));
    if (want.includes('when')) unknownVal(p.completionDate) ? miss('a completion date', 'completionDate') : out.push(P('Timeline for **' + p.name + '**: ' + clip(p.completionDate, 240)));
    if (want.includes('power')) { const v = [p.utility ? expandUtilityStatus(p.utility) : '', p.tariff].filter(x => !unknownVal(x)); v.length ? out.push(P('Power for **' + p.name + '**: ' + v.map(x => clip(x, 200)).join(' ') )) : miss('power or tariff details', 'utility'); }
    if (want.includes('status')) out.push(P('**' + p.name + '** is ' + (p._facility ? 'an Operating commercial facility' : 'at the ' + p.stage + ' stage') + (unknownVal(p.pz) ? '. The map has no planning and zoning status for it.' : '. Planning and zoning: ' + clip(p.pz, 220))));
    if (want.includes('rule')) { const regs = regContext(p); out.push(P(regs.length ? 'Local rules affecting **' + p.name + '**:' : 'No regulation is on file for ' + p.county + ' County on this map, so none is shown for **' + p.name + '**.')); if (regs.length) out.push(UL(regs.map(r => describeReg(r)))); }
    if (want.includes('sources') ) out.push(sourceBlock(p.links) || P('The map lists no source link for **' + p.name + '**.'));
    if (want.includes('near')) { const nb = nearby(p, 25, 5); out.push(P(nb.length ? 'Within 25 miles of **' + p.name + '**:' : 'Nothing else on the map is within 25 miles of **' + p.name + '**.')); if (nb.length) out.push(UL(nb.map(o => o.q.name + ' (' + o.q.stage + ', ' + Math.round(o.d) + ' mi)'))); }
    const needsLinks = (want.includes('tenant') && unknownVal(p.tenant)) || (want.includes('power') && unknownVal(p.utility) && unknownVal(p.tariff)) || (want.includes('when') && unknownVal(p.completionDate));
    return R(out.join('') + (needsLinks ? linkBlock(linksFor('news tariff power', 3), 'The map does not have this yet. These may help') : '') + '<div class="ask-actions">' + acts + btn('Full profile', () => ask('Tell me about ' + p.name)) + '</div>', chips, state.ctx);
  }

  function answerRegStatus(place) {
    // place: {county, city?}
    const county = place.county; state.ctx = { type: 'county', county };
    const regs = regsFor(county); const exp = expiredFor(county);
    const projs = projectsFor(county);
    const label = place.city ? cap(place.city) + ' (' + county + ' County)' : county + ' County';
    let h = '';
    const rel = regs.filter(({ r }) => place.city ? (isCountyLevel(r) || norm(r.city) === norm(place.city)) : true);
    if (rel.length) {
      h += P('Yes. These rules are on the map for ' + label + ':') + UL(rel.map(({ r }) => describeReg(r) + (r.notes ? '. ' + clip(r.notes, 160) : '')));
      h += sourceBlock([].concat(...rel.map(({ r }) => r.links || [])));
    } else {
      h += P('No regulation is on file for ' + label + ' on this map.' + (place.city && !CITY_COUNTY[place.city] ? '' : '') + ' That does not prove there is none. It may not have been tracked yet.');
      if (place.city) h += P(cap(place.city) + ' is in ' + county + ' County' + (regs.length ? ', which has its own rule listed above.' : '.'));
      const near = regulations.map((r, i) => ({ r, i, d: milesBetween((countyCenter(county) || {}).lat || r.lat, (countyCenter(county) || {}).lng || r.lng, r.lat, r.lng) })).filter(o => norm(o.r.county) !== norm(county) && norm(o.r.type) === 'moratorium' && o.d <= 45).sort((a, b) => a.d - b.d).slice(0, 4);
      if (near.length) h += P('Nearby moratoria: ' + near.map(o => (o.r.city && !isCountyLevel(o.r) ? o.r.city + ', ' : '') + o.r.county + ' County (about ' + Math.round(o.d) + ' mi)').join('; ') + '.');
    }
    if (exp.length) h += P('Expired and removed from the map: ' + exp.map(r => r.type + (r.city ? ' in ' + r.city : '') + ' (ended ' + r.expiration + ')').join('; ') + '. If it was extended, tell the team with the Report a problem form.');
    if (projs.length) h += P('Projects in ' + county + ' County: ' + projs.slice(0, 5).map(o => o.p.name + ' (' + o.p.stage + ')').join(', ') + (projs.length > 5 ? ', and ' + (projs.length - 5) + ' more' : '') + '.');
    const items = [].concat(rel.map(({ i }) => regItem(i)));
    const a = '<div class="ask-actions">' + countyBtn(county) + (items.length > 1 ? mapBtn(items, 'Rules in ' + label) : '') + '</div>';
    const chips = [projs.length ? 'Tell me about ' + county + ' County' : null, 'Which moratoria end soon?', rel.length ? null : 'Which counties have no regulation but a proposed project?'];
    return R(h + a + (rel.length ? '' : linkBlock([resById('mta'), resById('pause')], 'To check for newer local action')), chips, state.ctx);
  }
  function countyCenter(county) { const f = countyGeo && countyGeo.features.find(f => f.properties.NAME === county); if (!f) return null; const c = L.geoJSON(f).getBounds().getCenter(); return { lat: c.lat, lng: c.lng }; }

  function answerCounty(county) {
    state.ctx = { type: 'county', county };
    const regs = regsFor(county), projs = projectsFor(county), exp = expiredFor(county);
    let h = P('**' + county + ' County**');
    if (regs.length) h += P('Local rules on the map:') + UL(regs.map(({ r }) => describeReg(r)));
    else h += P('No regulation is on file for ' + county + ' County.');
    if (exp.length) h += P('Expired and removed: ' + exp.map(r => r.type + (r.city ? ' in ' + r.city : '') + ' (ended ' + r.expiration + ')').join('; ') + '.');
    if (projs.length) {
      const sc = stageCounts(projs.map(o => o.p)); const ms = mwSum(projs.map(o => o.p));
      h += P(plural(projs.length, 'project') + ' (' + sc.Rumored + ' rumored, ' + sc.Proposed + ' proposed, ' + sc.Operating + ' operating)' + (ms.counted ? ', about ' + fmtMW(ms.total) + ' where a size is given' : '') + ':') + UL(projs.slice(0, 8).map(o => '**' + o.p.name + '** (' + o.p.stage + (unknownVal(o.p.developer) ? '' : ', ' + clip(o.p.developer, 50)) + ')'));
    } else h += P('No data center projects are tracked in this county.');
    const lines = [];
    projs.forEach(({ i }) => projects[i]._k.devs.forEach(k => { const others = (kb().dev[k] || []).filter(j => norm(projects[j].county) !== norm(county)); if (others.length && !lines.some(l => l.k === k)) lines.push({ k, t: kb().devLabel[k] + ' also has ' + others.slice(0, 3).map(j => projLabel(projects[j])).join(', ') }); }));
    if (lines.length) h += '<div class="ask-sub"><strong>Connections</strong></div>' + UL(lines.slice(0, 3).map(l => l.t + '.'));
    const proposedHere = projs.filter(o => o.p.stage !== 'Operating').length; const moratoriumHere = regs.some(({ r }) => norm(r.type) === 'moratorium' && isCountyLevel(r));
    if (proposedHere && moratoriumHere) h += P('Worth a closer look: this county has a county-wide moratorium and also lists ' + plural(proposedHere, 'proposed or rumored project') + '. Projects may be exempt or filed earlier, so check the sources.');
    if (proposedHere && !regs.length) h += P('Worth a closer look: ' + plural(proposedHere, 'proposed or rumored project') + ' here and no regulation on file.');
    const items = projs.map(({ i }) => projItem(i)).concat(regs.map(({ i }) => regItem(i)));
    return R(h + '<div class="ask-actions">' + countyBtn(county) + (items.length > 1 ? mapBtn(items, county + ' County: rules and projects') : '') + '</div>', ['Is there a moratorium in ' + county + ' County?', projs[0] ? 'Tell me about ' + projs[0].p.name : null, 'Compare ' + county + ' and Fayette'], state.ctx);
  }

  function answerDeveloper(k) {
    const K = kb(), idxs = K.dev[k] || [], list = idxs.map(i => projects[i]); const label = K.devLabel[k];
    state.ctx = { type: 'dev', key: k };
    const sc = stageCounts(list), ms = mwSum(list);
    const counties = [...new Set(list.map(p => p.county))];
    let h = P('**' + label + '** appears on ' + plural(list.length, 'project') + ' across ' + plural(counties.length, 'county', 'counties') + ' (' + sc.Rumored + ' rumored, ' + sc.Proposed + ' proposed, ' + sc.Operating + ' operating)' + (ms.counted ? ', about ' + fmtMW(ms.total) + ' where sizes are given (figures can overlap or be phases of the same site)' : '') + '.');
    h += UL(list.map((p, n) => '**' + p.name + '**, ' + p.county + ' County, ' + p.stage + (mw(p) != null ? ', ' + fmtMW(mw(p)) : '')));
    const lines = [];
    list.forEach(p => { const r = regContext(p).filter(x => norm(x.type) === 'moratorium'); if (r.length && p.stage !== 'Operating') lines.push(p.name + ' is in ' + p.county + ' County, which has a ' + describeReg(r[0]).toLowerCase() + '.'); });
    const ten = [...new Set(list.map(p => p.tenant).filter(t => !unknownVal(t)))]; if (ten.length) lines.push('Tenant information: ' + ten.slice(0, 2).map(t => clip(t, 110)).join(' | '));
    if (lines.length) h += '<div class="ask-sub"><strong>Connections</strong></div>' + UL(lines);
    const items = idxs.map(projItem);
    return R(h + sourceBlock([].concat(...list.map(p => p.links || [])).slice(0, 3)) + '<div class="ask-actions">' + mapBtn(items, label + ' projects') + '</div>', ['Which counties does ' + label + ' work in?', 'Who are the biggest developers?'], state.ctx);
  }
  function answerUtility(key) {
    const K = kb(), idxs = K.util[key] || [], u = UTILS.find(x => x.key === key), list = idxs.map(i => projects[i]);
    state.ctx = { type: 'util', key };
    let h = list.length ? P('**' + u.label + '** is mentioned for ' + plural(list.length, 'project') + ' on the map (' + list.filter(p => p.stage !== 'Operating').length + ' not yet operating).') + UL(list.slice(0, 10).map(p => '**' + p.name + '**, ' + p.county + ' County, ' + p.stage)) : P('No project on the map mentions ' + u.label + '.');
    h += '<p class="ask-note">Based on the utility, tariff and notes text of each project. A project can mention a utility without being confirmed as served by it.</p>';
    return R(h + (list.length ? '<div class="ask-actions">' + mapBtn(idxs.map(projItem), u.label + ' projects') + '</div>' : '') + linkBlock([resById(key === 'ekpc' ? 'ekpc' : 'psc'), key === 'ekpc' ? resById('ekpctariff') : null], 'Tariffs and filings'), ['What is a tariff?', 'Which developers are in these projects?'], state.ctx);
  }
  function answerTenant(c) {
    const idxs = kb().tenant[c] || []; state.ctx = { type: 'tenant', c };
    if (!idxs.length) return R(P('No project on the map names ' + cap(c) + ' as a tenant or mentions it.') + linkBlock(linksFor('news developers'), 'To look for newer reporting'), ['What’s the big picture?']);
    return R(P('**' + cap(c) + '** is named in ' + plural(idxs.length, 'project') + ' on the map. Some of these are reports, not confirmed deals.') + UL(idxs.map(i => '**' + projects[i].name + '**, ' + projects[i].county + ' County: ' + clip(projects[i].tenant, 140))) + '<div class="ask-actions">' + mapBtn(idxs.map(projItem), cap(c) + ' mentions') + '</div>', ['Which developers are the biggest?']);
  }
  function answerCity(c) {
    const county = c.county; if (!county) return null;
    const regs = regulations.map((r, i) => ({ r, i })).filter(o => norm(o.r.city) === c.key);
    const projs = projects.map((p, i) => ({ p, i })).filter(o => norm(o.p.city) === c.key);
    if (!regs.length && !projs.length) return answerRegStatus({ county, city: c.key });
    state.ctx = { type: 'county', county };
    let h = P('**' + cap(c.key) + '** is in ' + county + ' County.');
    if (regs.length) h += P('Rules naming the city:') + UL(regs.map(o => describeReg(o.r)));
    h += P(regsFor(county).some(({ r }) => isCountyLevel(r)) ? 'The county also has: ' + regsFor(county).filter(({ r }) => isCountyLevel(r)).map(({ r }) => describeReg(r)).join('; ') + '.' : 'No county-wide rule is on file for ' + county + ' County.');
    if (projs.length) h += P('Projects in the city: ' + projs.map(o => o.p.name + ' (' + o.p.stage + ')').join(', ') + '.');
    return R(h + '<div class="ask-actions">' + countyBtn(county) + '</div>', ['Tell me about ' + county + ' County']);
  }

  function compareEntities(a, b) {
    const col = x => x.type === 'county' ? (() => { const projs = projectsFor(x.name), regs = regsFor(x.name); const ms = mwSum(projs.map(o => o.p)); const sc = stageCounts(projs.map(o => o.p)); return { title: x.name + ' County', rows: [['Rules', regs.length ? regs.map(({ r }) => r.type + (isCountyLevel(r) ? '' : ' (' + r.city + ')')).join(', ') : 'none on file'], ['Projects', projs.length + ' (' + sc.Rumored + ' rumored, ' + sc.Proposed + ' proposed, ' + sc.Operating + ' operating)'], ['Size where given', ms.counted ? fmtMW(ms.total) : 'n/a']] }; })() : (() => { const p = projects[x.i]; const rc = regContext(p); return { title: p.name, rows: [['County', p.county], ['Stage', p.stage], ['Size', unknownVal(p.size) ? 'n/a' : clip(p.size, 50)], ['Developer', unknownVal(p.developer) ? 'n/a' : clip(p.developer, 50)], ['Local rule', rc.length ? rc.map(r => r.type).join(', ') : 'none on file']] }; })();
    const A = col(a), B = col(b);
    const labels = [...new Set(A.rows.map(r => r[0]).concat(B.rows.map(r => r[0])))];
    const get = (c, l) => (c.rows.find(r => r[0] === l) || ['', 'n/a'])[1];
    return R('<table class="ask-table"><thead><tr><th></th><th>' + esc(A.title) + '</th><th>' + esc(B.title) + '</th></tr></thead><tbody>' + labels.map(l => '<tr><th scope="row">' + esc(l) + '</th><td>' + esc(get(A, l)) + '</td><td>' + esc(get(B, l)) + '</td></tr>').join('') + '</tbody></table>', []);
  }

  // ------------------------------------------------------------- insights
  function overview() {
    const regsM = regulations.filter(r => norm(r.type) === 'moratorium'), regsO = regulations.filter(r => norm(r.type) === 'ordinance'), regsP = regulations.filter(r => regKind(r) === 'pending');
    const nonOp = projects.filter(p => p.stage !== 'Operating' && !p._facility), sc = stageCounts(projects), ms = mwSum(nonOp);
    const regCounties = new Set(regulations.map(r => norm(r.county)));
    const soon = regulations.filter(isExpiringSoon).sort((a, b) => daysUntilExpiry(a) - daysUntilExpiry(b));
    const gaps = gapCounties();
    const conf = conflicts();
    const devs = devRanking().slice(0, 3);
    const lines = [
      '**Rules:** ' + regsM.length + ' active moratoria, ' + regsO.length + ' ordinance' + (regsO.length === 1 ? '' : 's') + ' and ' + regsP.length + ' pending. ' + regCounties.size + ' of ' + allCounties.length + ' counties have some rule on file.',
      '**Projects:** ' + projects.length + ' tracked (' + sc.Rumored + ' rumored, ' + sc.Proposed + ' proposed, ' + sc.Operating + ' operating, many of the operating ones commercial hosting sites).',
      ms.counted ? '**Scale:** the ' + ms.counted + ' not-yet-operating projects with a stated size add up to roughly ' + fmtMW(ms.total) + '. Figures are approximate and some overlap.' : null,
      soon.length ? '**Ending soon:** ' + soon.slice(0, 3).map(r => r.county + ' (' + daysUntilExpiry(r) + ' days)').join(', ') + (soon.length > 3 ? ', and ' + (soon.length - 3) + ' more' : '') + ' within 60 days.' : null,
      devs.length ? '**Repeat developers:** ' + devs.map(d => d.label + ' (' + d.n + ' projects)').join(', ') + '.' : null,
      conf.length ? '**Worth a look:** ' + plural(conf.length, 'proposed or rumored project') + ' sit in counties with a county-wide moratorium, such as ' + conf.slice(0, 2).map(o => o.p.name).join(' and ') + '.' : null,
      gaps.length ? '**Gaps:** ' + plural(gaps.length, 'county', 'counties') + ' have a proposed or rumored project and no rule on file, for example ' + gaps.slice(0, 3).map(g => g.county).join(', ') + '.' : null
    ].filter(Boolean);
    return R(P('Here is the picture from the data on the map:') + UL(lines), ['Which proposed projects are in counties with a moratorium?', 'Which counties have no regulation but a proposed project?', 'Who are the biggest developers?', 'Which moratoria end soon?']);
  }
  function devRanking() {
    const K = kb();
    return Object.keys(K.dev).map(k => ({ k, label: K.devLabel[k], n: K.dev[k].length, idxs: K.dev[k], counties: new Set(K.dev[k].map(i => projects[i].county)).size })).filter(d => d.n >= 2 || true).sort((a, b) => b.n - a.n || b.counties - a.counties);
  }
  function gapCounties() {
    const reg = new Set(regulations.map(r => norm(r.county))); const out = {};
    projects.forEach((p, i) => { if (p.stage === 'Operating' || p._facility) return; const k = norm(p.county); if (reg.has(k)) return; (out[p.county] = out[p.county] || []).push(i); });
    return Object.keys(out).map(c => ({ county: c, idxs: out[c] })).sort((a, b) => b.idxs.length - a.idxs.length);
  }
  function conflicts() {
    return projects.map((p, i) => ({ p, i, regs: regContext(p).filter(r => norm(r.type) === 'moratorium') })).filter(o => o.p.stage !== 'Operating' && !o.p._facility && o.regs.length);
  }
  function answerConflicts() {
    const c = conflicts();
    if (!c.length) return R(P('No proposed or rumored project on the map sits in a county or city with an active moratorium.'), ['What’s the big picture?']);
    return R(P(plural(c.length, 'proposed or rumored project') + ' sit in places with an active moratorium on the map. A moratorium may not cover a project that was already approved, that sits inside a city that annexed the land, or that is otherwise exempt, so check each source.') + UL(c.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + '): ' + describeReg(o.regs[0]))) + '<div class="ask-actions">' + mapBtn(c.map(o => projItem(o.i)), 'Projects inside moratorium areas') + '</div>', ['Which counties have no regulation but a proposed project?', 'Tell me about ' + c[0].p.name]);
  }
  function answerGaps() {
    const g = gapCounties();
    if (!g.length) return R(P('Every county with a proposed or rumored project has at least one rule on file.'), []);
    return R(P(plural(g.length, 'county', 'counties') + ' have a proposed or rumored project and no rule on file on this map. That may mean no rule exists, or just that none is tracked yet.') + UL(g.map(x => '**' + x.county + ' County:** ' + x.idxs.map(i => projects[i].name).join(', '))) + '<div class="ask-actions">' + mapBtn([].concat(...g.map(x => x.idxs.map(projItem))), 'Projects in counties with no rule on file') + '</div>', ['Which proposed projects are in counties with a moratorium?', 'Tell me about ' + g[0].county + ' County']);
  }
  function answerRanking(kind, qn) {
    if (kind === 'dev') {
      const r = devRanking().slice(0, 6);
      return R(P('Developers with the most projects on the map:') + UL(r.map(d => '**' + d.label + ':** ' + plural(d.n, 'project') + ' in ' + plural(d.counties, 'county', 'counties'))) + P('Names are matched as written in the data, so a company listed under two spellings may be split.'), ['Tell me about ' + r[0].label]);
    }
    if (kind === 'county') {
      const rows = allCounties.map(c => ({ c, n: projectsFor(c).filter(o => !o.p._facility).length, all: projectsFor(c).length })).filter(x => x.all).sort((a, b) => b.all - a.all).slice(0, 6);
      return R(P('Counties with the most projects (including commercial facilities):') + UL(rows.map(x => '**' + x.c + ' County:** ' + x.all + ' (' + x.n + ' not commercial facilities)')), ['Tell me about ' + rows[0].c + ' County']);
    }
    if (kind === 'size') {
      const rows = projects.map((p, i) => ({ p, i, m: mw(p) })).filter(o => o.m != null).sort((a, b) => b.m - a.m).slice(0, 6);
      return R(P('Largest projects by stated size (taken from each project’s size text; projects with no MW or GW figure are left out):') + UL(rows.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + '): ' + fmtMW(o.m))) + '<div class="ask-actions">' + mapBtn(rows.map(o => projItem(o.i)), 'Largest projects') + '</div>', ['Projects over 1000 MW']);
    }
    if (kind === 'moratorium') {
      const rows = regulations.filter(r => norm(r.type) === 'moratorium').map((r, i) => ({ r, i: regulations.indexOf(r), d: daysUntilExpiry(r) }));
      const open = rows.filter(o => o.d === null), dated = rows.filter(o => o.d !== null).sort((a, b) => b.d - a.d);
      return R(P('Longest moratoria with an end date:') + UL(dated.slice(0, 4).map(o => '**' + (o.r.city && !isCountyLevel(o.r) ? o.r.city + ', ' : '') + o.r.county + ' County:** ends ' + o.r.expiration + ' (' + plural(o.d, 'day') + ' left)')) + (open.length ? P('No end date on file: ' + open.map(o => o.r.county).join(', ') + '. These run until the local government acts.') : ''), ['Which moratoria end soon?']);
    }
    return null;
  }
  function answerTotals() {
    const sc = stageCounts(projects);
    const byStage = ['Rumored', 'Proposed', 'Operating'].map(s => { const l = projects.filter(p => p.stage === s && !p._facility); const m = mwSum(l); return '**' + s + ':** ' + plural(l.length, 'project') + (m.counted ? ', about ' + fmtMW(m.total) + ' across the ' + m.counted + ' with a stated size' : ', no sizes stated'); });
    return R(P('Capacity by stage, counting only what each entry’s size field states (commercial facilities excluded):') + UL(byStage) + P('Treat these as rough. Sizes are reported, not confirmed, and some projects are phases of one site.'), ['What’s the biggest project?']);
  }
  function answerConnections() {
    const K = kb(); const lines = [];
    devRanking().filter(d => d.n >= 2 && d.counties >= 2).slice(0, 4).forEach(d => lines.push('**' + d.label + '** is behind ' + d.n + ' projects in ' + d.counties + ' counties.'));
    UTILS.forEach(u => { const n = (K.util[u.key] || []).length; if (n >= 3) lines.push('**' + u.label + '** is mentioned for ' + n + ' projects.'); });
    COMPANIES.forEach(c => { const n = (K.tenant[c] || []).length; if (n >= 2) lines.push('**' + cap(c) + '** is named in ' + n + ' projects (some only as reported interest).'); });
    const c = conflicts(); if (c.length) lines.push(plural(c.length, 'proposed project') + ' sit in places with a moratorium.');
    const g = gapCounties(); if (g.length) lines.push(plural(g.length, 'county', 'counties') + ' with a proposed project have no rule on file.');
    return R(P('Patterns I can see in the data:') + UL(lines), ['Which proposed projects are in counties with a moratorium?', 'Who are the biggest developers?', 'Which counties have no regulation but a proposed project?']);
  }

  // ----------------------------------------------------- generic retrieval
  function searchRecords(qn) {
    const terms = qTokens(qn).filter(t => !STOP.has(t) && t.length > 2);
    if (!terms.length) return [];
    const res = [];
    projects.forEach((p, i) => {
      const blob = p._blob || norm([p.name, p.county, p.city, p.developer, p.tenant, p.notes, p.pz, p.utility, p.tariff, p.size].join(' '));
      const hits = terms.filter(t => fuzzyIncludes(blob, t));
      if (hits.length) res.push({ kind: 'proj', i, score: hits.length / terms.length + (hits.some(t => norm(p.name).includes(t)) ? 0.5 : 0), hits });
    });
    regulations.forEach((r, i) => {
      const blob = r._blob || norm([r.county, r.city, r.type, r.notes, r.period].join(' '));
      const hits = terms.filter(t => fuzzyIncludes(blob, t));
      if (hits.length) res.push({ kind: 'reg', i, score: hits.length / terms.length, hits });
    });
    const best = res.length ? Math.max(...res.map(x => x.score)) : 0;
    return res.filter(x => x.score >= Math.max(0.6, best - 0.01)).sort((a, b) => b.score - a.score).slice(0, 6);
  }
  function answerSearch(qn) {
    const hits = searchRecords(qn);
    if (!hits.length) return null;
    const items = hits.map(h => h.kind === 'proj' ? projItem(h.i) : regItem(h.i));
    const rows = hits.map(h => h.kind === 'proj' ? '**' + projects[h.i].name + '** (' + projects[h.i].county + ' Co., ' + projects[h.i].stage + '): matches on ' + h.hits.join(', ') : '**' + describeReg(regulations[h.i]) + '**');
    return R(P('Here is what on the map matches “' + hits[0].hits.join(' ') + '”:') + UL(rows) + '<div class="ask-actions">' + mapBtn(items, 'Search matches') + '</div>', hits[0].kind === 'proj' ? ['Tell me about ' + projects[hits[0].i].name] : []);
  }


  // ------------------------------------------------- broader reasoning handlers
  const REGIONS = [
    { key: 'eastern', label: 'Eastern Kentucky', f: lng => lng > -84.3 },
    { key: 'central', label: 'Central Kentucky', f: lng => lng <= -84.3 && lng > -86.2 },
    { key: 'western', label: 'Western Kentucky', f: lng => lng <= -86.2 }
  ];
  const regionOf = lng => (REGIONS.find(r => r.f(lng)) || REGIONS[1]);
  function parseMDY(s) {
    const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null;
    let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[1] - 1, +m[2]);
  }
  function regionStats() {
    return REGIONS.map(R0 => {
      const pr = projects.map((p, i) => ({ p, i })).filter(o => isFinite(o.p.lng) && regionOf(o.p.lng) === R0);
      const rg = regulations.map((r, i) => ({ r, i })).filter(o => isFinite(o.r.lng) && regionOf(o.r.lng) === R0);
      const np = pr.filter(o => o.p.stage !== 'Operating' && !o.p._facility);
      return { R: R0, pr, rg, np, mor: rg.filter(o => norm(o.r.type) === 'moratorium'), ms: mwSum(np.map(o => o.p)) };
    });
  }
  function answerRegions(only) {
    const st = regionStats().filter(x => !only || x.R.key === only);
    const lines = st.map(x => '**' + x.R.label + ':** ' + plural(x.np.length, 'proposed or rumored project') + (x.ms.counted ? ' (about ' + fmtMW(x.ms.total) + ' where sizes are given)' : '') + ', ' + plural(x.pr.length - x.np.length, 'operating site') + ', ' + plural(x.mor.length, 'active moratorium', 'active moratoria') + ' and ' + plural(x.rg.length - x.mor.length, 'other rule') + '.');
    const busiest = st.slice().sort((a, b) => b.np.length - a.np.length)[0];
    const items = [].concat(...st.map(x => x.np.map(o => projItem(o.i))));
    return R(P(only ? 'Here is ' + st[0].R.label + ' on the map:' : 'Regions are rough bands by longitude (east of about Lexington, central, and west of about Elizabethtown). Here is how they compare:') + UL(lines) + (only ? '' : P('Most proposed activity is in ' + busiest.R.label + ' (' + busiest.np.length + ' projects).')) + '<div class="ask-actions">' + mapBtn(items, only ? st[0].R.label + ' projects' : 'Proposed and rumored projects') + '</div>', ['Which proposed projects are in counties with a moratorium?', 'What’s the big picture?']);
  }
  function answerRestrictive() {
    const rows = allCounties.map(c => {
      const regs = regsFor(c).map(o => o.r); if (!regs.length) return null;
      const county = regs.filter(isCountyLevel);
      let score = 0, why = [];
      county.forEach(r => { score += 3; if (norm(r.type) === 'ordinance') { score += 2; why.push('permanent ordinance'); } else if (daysUntilExpiry(r) === null) { score += 2; why.push('no end date'); } else if (daysUntilExpiry(r) > 180) { score += 1; why.push('ends ' + r.expiration); } else why.push('ends ' + r.expiration); });
      regs.filter(r => !isCountyLevel(r)).forEach(r => { score += 1; why.push('city rule in ' + r.city); });
      return { c, score, why };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 6);
    return R(P('"Restrictive" is not something the map scores, so this is my reading of the data: a county-wide rule counts most, a permanent ordinance or a moratorium with no end date counts more, and a city-only rule counts least. Strongest first:') + UL(rows.map(o => '**' + o.c + ' County:** ' + o.why.join(', '))) + P('This ranks the rules on file, not how strictly each is enforced. Read the source for each before relying on it.') + '<div class="ask-actions">' + mapBtn([].concat(...rows.map(o => regsFor(o.c).map(x => regItem(x.i)))), 'Strongest local rules') + '</div>', ['Which moratoria end soon?', 'Which counties have no regulation but a proposed project?']);
  }
  function answerLandscape(qn) {
    const regsM = regulations.filter(r => norm(r.type) === 'moratorium');
    const dated = regsM.map(r => ({ r, d: parseMDY(r.startDate) })).filter(o => o.d);
    const now = new Date(); const ago = n => new Date(now.getFullYear(), now.getMonth() - n, now.getDate());
    const last6 = dated.filter(o => o.d >= ago(6)).length, last3 = dated.filter(o => o.d >= ago(3)).length;
    const np = projects.filter(p => p.stage !== 'Operating' && !p._facility), mm = mwSum(np);
    const prot = new Set(regulations.map(r => norm(r.county)));
    const withProjNoRule = gapCounties().length, withProjAll = new Set(np.map(p => norm(p.county))).size;
    const lines = [
      '**Local pushback is real and growing:** ' + regsM.length + ' active moratoria' + (dated.length ? ', ' + last6 + ' started in the last 6 months' + (last3 ? ' (' + last3 + ' in the last 3)' : '') : '') + '. The map holds ' + prot.size + ' counties with some rule.',
      '**Development interest is large:** ' + plural(np.length, 'proposed or rumored project') + ' in ' + plural(withProjAll, 'county', 'counties') + (mm.counted ? ', about ' + fmtMW(mm.total) + ' where sizes are given' : '') + '.',
      '**The two overlap:** ' + plural(conflicts().length, 'project') + ' sit in places with a moratorium, and ' + plural(withProjNoRule, 'county', 'counties') + ' with a proposed project have no rule on file.',
      '**Most moratoria are temporary:** ' + plural(regulations.filter(isExpiringSoon).length, 'moratorium', 'moratoria') + ' end within 60 days, so many places will soon have to extend or replace them with permanent rules.'
    ];
    const q = /\b(good|bad|friendly|welcome|welcoming|worth|safe|attractive|competitive|pro|anti)\b/.test(qn);
    return R((q ? P('The map cannot say whether Kentucky is a good or bad place for data centers. That depends on who is asking. It can show what is happening:') : P('Here is where Kentucky stands, from the data on the map:')) + UL(lines) + P('This is a snapshot of tracked public information, not a complete count. Dates and sizes come from news and filings, so check the sources.') + linkBlock([resById('epic'), resById('tracker')], 'For the wider policy picture'), ['Which proposed projects are in counties with a moratorium?', 'Which regions are most active?', 'Which moratoria end soon?']);
  }
  function answerRecent() {
    const regs = regulations.map((r, i) => ({ r, i, d: parseMDY(r.startDate) })).filter(o => o.d).sort((a, b) => b.d - a.d).slice(0, 5);
    if (!regs.length) return null;
    return R(P('Projects on the map have no date for when they were added, so I can only sort the rules by start date. Most recent first:') + UL(regs.map(o => '**' + describeReg(o.r).split(',')[0] + '** started ' + o.r.startDate)) + P('The footer shows when the whole map was last updated.') + '<div class="ask-actions">' + mapBtn(regs.map(o => regItem(o.i)), 'Newest rules') + '</div>' + linkBlock(linksFor('latest news'), 'For the latest news'), ['Which moratoria end soon?']);
  }
  function answerRisks() {
    const g = gapCounties(), c = conflicts(), soon = regulations.filter(isExpiringSoon);
    const lines = [];
    if (c.length) lines.push(plural(c.length, 'proposed project') + ' sit in places with a moratorium, so each may face a legal or timing question.');
    if (g.length) lines.push(plural(g.length, 'county', 'counties') + ' have a proposed project and no rule on file, so a project could move before the county writes rules.');
    if (soon.length) lines.push(plural(soon.length, 'moratorium', 'moratoria') + ' end within 60 days (' + soon.slice(0, 3).map(r => r.county).join(', ') + '), which opens a window before permanent rules.');
    const big = projects.filter(p => p.stage !== 'Operating' && mw(p) >= 1000).length; if (big) lines.push(plural(big, 'project') + ' state 1 GW or more, a size that tends to need new power supply and major grid work.');
    return R(P('The map holds facts, not forecasts or advice, so I can only point to what in the data deserves attention:') + UL(lines) + P('For costs to ratepayers, water, noise and incentives, the map has no data. These sources cover them:') + linkBlock([resById('epic'), resById('mta'), resById('eec'), resById('psc')], 'Outside sources'), ['Which proposed projects are in counties with a moratorium?', 'Which counties have no regulation but a proposed project?']);
  }
  function answerAdvice() {
    return R(P('I can’t tell a county what to decide, but the map shows what others have done and where the gaps are.') + UL(['Ask which places already have rules: **Which counties have a moratorium?**', 'See what nearby counties did: ask **Is there a moratorium in [county]?**', 'Check whether projects are already planned where there is no rule: **Which counties have no regulation but a proposed project?**']) + P('Mountain Association’s resource page and the Kentucky League of Cities cover how local governments have responded, and you can email the Energy Team directly.') + linkBlock([resById('mta'), resById('klc'), resById('epic'), resById('contact')], 'Where to start'), ['Which counties have a moratorium?', 'Which counties have no regulation but a proposed project?']);
  }
  function answerConfidence(qn) {
    const nolink = projects.map((p, i) => ({ p, i })).filter(o => !(o.p.links || []).filter(safeUrl).length);
    const unver = projects.map((p, i) => ({ p, i })).filter(o => o.p._facility && o.p.verification === 'unverified');
    const noreg = regulations.map((r, i) => ({ r, i })).filter(o => !(o.r.links || []).filter(safeUrl).length);
    const nodev = projects.filter(p => p.stage !== 'Operating' && unknownVal(p.developer)).length, notenant = projects.filter(p => p.stage !== 'Operating' && unknownVal(p.tenant)).length;
    const lines = [plural(nolink.length, 'project') + ' and ' + plural(noreg.length, 'rule') + ' have no working source link on the map.', unver.length ? plural(unver.length, 'commercial facility', 'commercial facilities') + ' are unverified (only listed on datacentermap.com).' : null, nodev + ' proposed or rumored projects have no named developer, and ' + notenant + ' have no named tenant.'].filter(Boolean);
    return R(P('How solid the data is:') + UL(lines) + P('Staff review every entry, and the Report a problem form feeds corrections back in.') + '<div class="ask-actions">' + (nolink.length ? mapBtn(nolink.map(o => projItem(o.i)), 'Projects with no source link') : '') + '</div>', ['How many unverified facilities are there?', 'How do I report a problem?']);
  }
  function answerStatusWords(qn) {
    const rx = /approv|rejected|denied|withdrawn|tabled|postponed|passed|rezon/;
    const hits = projects.map((p, i) => ({ p, i })).filter(o => rx.test(String(o.p.pz).toLowerCase()) && !unknownVal(o.p.pz));
    const want = /\b(approved|approval)\b/.test(qn) ? /approv|passed|rezon\w+ (approved|passed)/ : /\b(rejected|denied|withdrawn|turned down|voted down)\b/.test(qn) ? /reject|denied|withdrawn|voted down|tabled/ : rx;
    const sel = hits.filter(o => want.test(String(o.p.pz).toLowerCase()));
    if (!sel.length) return R(P('No project on the map has a planning and zoning note that matches that.'), ['What’s the big picture?']);
    return R(P('Planning and zoning notes on the map that match:') + UL(sel.slice(0, 8).map(o => '**' + o.p.name + '** (' + o.p.county + ' Co.): ' + clip(o.p.pz, 150))) + P('These are summaries from the Sheet. Check the sources for the exact vote.') + '<div class="ask-actions">' + mapBtn(sel.map(o => projItem(o.i)), 'Matching projects') + '</div>', []);
  }
  function answerCountsAbout(qn) {
    const withRule = new Set(regulations.map(r => norm(r.county))).size, n = allCounties.length;
    const mors = new Set(regulations.filter(r => norm(r.type) === 'moratorium').map(r => norm(r.county))).size;
    const cityRegs = regulations.filter(r => !isCountyLevel(r));
    const cm = /\bcit(y|ies)\b/.test(qn);
    if (cm) return R(P(plural(cityRegs.length, 'city-level rule') + ' on the map:') + UL(cityRegs.map(r => describeReg(r))) + '<div class="ask-actions">' + mapBtn(cityRegs.map(r => regItem(regulations.indexOf(r))), 'City-level rules') + '</div>', ['Which counties have a moratorium?']);
    const list = regulations.filter(r => norm(r.type) === 'moratorium' && isCountyLevel(r));
    return R(P(withRule + ' of ' + n + ' counties (' + Math.round(withRule / n * 100) + '%) have some local rule on file, and ' + mors + ' have a moratorium (county or city). The other ' + (n - withRule) + ' show nothing tracked, which is not proof that nothing exists.') + UL(list.map(r => '**' + r.county + ' County:** ' + (r.expiration ? 'ends ' + r.expiration : 'no end date'))) + '<div class="ask-actions">' + mapBtn(regulations.filter(r => norm(r.type) === 'moratorium').map(r => regItem(regulations.indexOf(r))), 'All moratoria') + '</div>', ['Which moratoria end soon?', 'Which cities have a moratorium?']);
  }
  function answerNearMe() {
    return R(P('I do not use your location, and nothing leaves your device. Tell me your county or city, for example **Is there a moratorium in Madison County?** or **projects near Louisville**, and I will show what is there.'), ['Is there a moratorium in Madison County?', 'Proposed projects near Louisville']);
  }
  function answerArea(label, test, lead) {
    const pr = projects.map((p, i) => ({ p, i })).filter(o => isFinite(o.p.lat) && test(o.p.lat, o.p.lng));
    const rg = regulations.map((r, i) => ({ r, i })).filter(o => isFinite(o.r.lat) && test(o.r.lat, o.r.lng));
    const np = pr.filter(o => o.p.stage !== 'Operating' && !o.p._facility), ms = mwSum(np.map(o => o.p));
    if (!pr.length && !rg.length) return R(P('Nothing on the map falls in ' + label + '.'), ['What\u2019s the big picture?']);
    return R(P((lead || 'On the map, ' + label + ' has') + ' ' + plural(np.length, 'proposed or rumored project') + (ms.counted ? ' (about ' + fmtMW(ms.total) + ' where sizes are given)' : '') + ', ' + plural(pr.length - np.length, 'operating site') + ' and ' + plural(rg.length, 'local rule') + '.') + (pr.length ? UL(pr.slice(0, 8).map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + ')')) : '') + (rg.length ? P('Rules: ' + rg.slice(0, 6).map(o => describeReg(o.r)).join('; ') + '.') : '') + '<div class="ask-actions">' + mapBtn(pr.map(o => projItem(o.i)).concat(rg.map(o => regItem(o.i))), label) + '</div>', ['What\u2019s the big picture?', 'Which regions are most active?']);
  }
  function answerNearPlace(name, label, nearest) {
    const pt = placePoint(name); if (!pt) return null;
    const rows = projects.map((p, i) => ({ p, i, d: milesBetween(pt.lat, pt.lng, p.lat, p.lng) })).filter(o => isFinite(o.d)).sort((a, b) => a.d - b.d).slice(0, nearest ? 5 : 8);
    return R(P((nearest ? 'Closest to ' : 'Nearest to ') + label + ':') + UL(rows.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + '), about ' + Math.round(o.d) + ' mi' + (o.p.countyWide ? ' (county center, exact site unknown)' : ''))) + '<div class="ask-actions">' + mapBtn(rows.map(o => projItem(o.i)), 'Nearest to ' + label) + '</div>', ['Is there a moratorium in ' + (rows[0] ? rows[0].p.county : 'Fayette') + ' County?']);
  }
  function answerLikely() {
    const rx = /approv|rezon|passed|final|permit|break|construction|under way|underway/;
    const adv = projects.map((p, i) => ({ p, i })).filter(o => o.p.stage !== 'Operating' && !o.p._facility && (rx.test(String(o.p.pz).toLowerCase()) || (!unknownVal(o.p.tariff) && /esa|signed|approved|contract/i.test(o.p.tariff)) || (!unknownVal(o.p.tenant) && !/confidential|undisclosed|not named|unknown/i.test(o.p.tenant)))).slice(0, 8);
    return R(P('The map cannot predict what will get built. These proposed projects show signs of being further along (a zoning or planning step passed, a utility agreement, or a named tenant):') + UL(adv.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co.): ' + clip(o.p.pz && !unknownVal(o.p.pz) ? o.p.pz : (o.p.tenant || o.p.tariff), 130))) + P('Read each source. A zoning approval is not a guarantee, and a moratorium can still apply.') + '<div class="ask-actions">' + mapBtn(adv.map(o => projItem(o.i)), 'Projects furthest along') + '</div>', ['Which proposed projects are in counties with a moratorium?']);
  }
  function answerEndDate(place, ents) {
    const regs = regsFor(place.county).map(o => o.r).filter(r => norm(r.type) === 'moratorium' && (!place.city || isCountyLevel(r) || norm(r.city) === norm(place.city)));
    if (!regs.length) return null;
    const lines = regs.map(r => { const d = daysUntilExpiry(r); return '**' + describeReg(r).split(',')[0] + ':** ' + (r.expiration ? 'ends ' + r.expiration + (d != null && d >= 0 ? ' (' + plural(d, 'day') + ' left)' : '') : 'no end date on file, it runs until the local government acts') + (r.period ? '. Length on file: ' + r.period : ''); });
    return R(UL(lines) + P('Moratoria are sometimes extended or replaced by permanent rules. The map updates when staff learn of a change, and expired ones are removed.') + '<div class="ask-actions">' + countyBtn(place.county) + '</div>', ['What happens when a moratorium expires?', 'Which moratoria end soon?']);
  }
  function answerResources() {
    return R(P('The map is a starting point. These are the best places to go deeper:') + linkBlock([resById('mta'), resById('epic'), resById('tracker'), resById('pause'), resById('klc'), resById('psc'), resById('contact')], 'Recommended reading and sources'), ['What\u2019s the big picture?', 'What is a moratorium?']);
  }
  const FIELDS = [
    { re: /\b(developers?|builders?)\b/, label: 'a named developer', has: p => !unknownVal(p.developer) },
    { re: /\b(tenants?|customers?|end users?)\b/, label: 'a named tenant', has: p => !unknownVal(p.tenant) && !/confidential|undisclosed|not (named|disclosed)/i.test(p.tenant) },
    { re: /\b(size|capacity|mw|megawatts?|gw|gigawatts?)\b/, label: 'a stated size in MW or GW', has: p => mw(p) != null },
    { re: /\b(tariffs?|rate schedules?)\b/, label: 'a tariff', has: p => !unknownVal(p.tariff) },
    { re: /\b(utilit(y|ies)|power suppl\w+|electric (provider|supplier|company))\b/, label: 'a named utility', has: p => !unknownVal(p.utility) },
    { re: /\b(completion|opening|online|timeline|dates?)\b/, label: 'a completion date', has: p => !unknownVal(p.completionDate) },
    { re: /\b(sources?|links?|citations?)\b/, label: 'a source link', has: p => (p.links || []).filter(safeUrl).length > 0 },
    { re: /\b(zoning|planning|pz)\b/, label: 'a planning and zoning note', has: p => !unknownVal(p.pz) }
  ];
  function answerMissingField(qn) {
    const f = FIELDS.find(x => x.re.test(qn)); if (!f) return null;
    const neg = /\b(no|without|lack|lacks|lacking|missing|don'?t have|doesn'?t have|not (named|listed|given|stated)|undisclosed|unknown)\b/.test(qn);
    const base = projects.map((p, i) => ({ p, i })).filter(o => !o.p._facility);
    const sel = base.filter(o => neg ? !f.has(o.p) : f.has(o.p));
    return R(P(plural(sel.length, 'project') + (neg ? ' have no ' + f.label.replace(/^an? /, '') : ' have ' + f.label) + ' on the map (commercial facilities left out):') + UL(sel.slice(0, 10).map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + ')')) + (sel.length > 10 ? P('And ' + (sel.length - 10) + ' more.') : '') + '<div class="ask-actions">' + (sel.length ? mapBtn(sel.map(o => projItem(o.i)), 'Projects ' + (neg ? 'missing ' : 'with ') + f.label) : '') + '</div>', ['How solid is this data?']);
  }

  // ---- How the map and its data work behind the scenes (process questions)
  const FORMS = () => '<p><a href="' + esc(ADD_FORM_URL) + '" target="_blank" rel="noopener">Add new information</a> · <a href="' + esc(REPORT_FORM_URL) + '" target="_blank" rel="noopener">Report a problem</a></p>';
  const PROC = [
    { id: 'official', re: /\b(is (this|the map|it) (an )?(official|government|state|governmental|legit|legitimate)|official (map|site|source|data)|government (map|site|data))\b/, a: () => P('This is not a government site. It is maintained by the Mountain Association Energy Team, a Kentucky nonprofit, from public sources, and every entry links to its source so you can check it. For official records, go to the county or city, the Public Service Commission, or the state.') + linkBlock([resById('psc'), resById('mta')], 'Official and primary sources'), chips: ['How is the data verified?'] },
    { id: 'cite', re: /\b(cite|citing|citation|reference this|credit this|attribution|attribute|use (this|the) (map|data) (in|for)|can i use (this|the) (map|data)|reuse|republish|license|licence|copyright|terms of use|permission to use)\b/, a: () => P('The map does not state a license, so for publishing or reuse, ask the Energy Team first at energy@mtassociation.org. If you reference it, a suggested citation is: Mountain Association Energy Team, Kentucky Data Centers: Projects & Local Regulations map, with the page address and the date you viewed it. Because entries change, cite the original sources linked on each entry for anything important.'), chips: ['Who do I contact?'] },
    { id: 'origin', re: /\b(where (does|do|did|is) (the |this |all )?(data|information|info|numbers|projects|rules)\b.*\b(come|from|originate|sourced|stored|live|kept)|what (is|are) (the |your )?(data )?sources?\b|where (is|are) (the )?(data|information) (stored|kept|from))\b/, a: () => P('The data is kept in a Google Sheet maintained by Mountain Association staff. Entries come from local news, meeting minutes, county and city notices, utility and state filings, and datacentermap.com (for existing commercial facilities). The Kentucky Lantern’s reporting is a common source for proposals.') + P('The transmission lines layer is government data (HIFLD, about 2025) and the gas pipeline layer is a January 2020 snapshot. Each entry on the map links to its own sources.'), chips: ['How does data get added to the map?'] },
    { id: 'added', re: /\b(how (does|do|is|are|did|can)|where (does|do|did)|who)\b.*\b(data|information|info|projects?|moratori\w+|rules?|regulations?|entries|entry|content|numbers)\b.*\b(add(ed|s)?|get(s)? (added|on|onto|put|into)|put|enter(ed)?|collect(ed)?|come|comes|gather(ed)?|find|found|chosen|decided|gets? (here|on the map)|end up)\b/, a: () => P('Mountain Association staff add entries to a Google Sheet that feeds the map. They find them in public sources: local news, meeting minutes, county and city notices, utility and state filings, and datacentermap.com for existing commercial facilities.') + P('Anyone can suggest an addition or a correction with the Add new information form. A suggestion does not go live by itself. It lands in the Sheet marked for review, staff check it against a source, and only then publish it.') + P('The map reads the Sheet when the page loads, so a published entry shows up without anyone editing the map. The footer shows when the data was last updated.') + FORMS(), chips: ['What happens after I submit something?', 'What happens to an expired moratorium?'] },
    { id: 'submit', re: /\b(after (i|you|someone|somebody|a person) (submit|send|report|add|fill)|what happens (when|after|if) (i|someone|you) (submit|send|report|add|fill)|submit\w* (a |the )?(form|suggestion|tip|correction|report)|how long (does|will|until|before)\b.*\b(show(s|ed)?|appear(s|ed)?|take(s)?|review(ed)?|live|published|go(es)? live|get(s)? (added|published|approved))\b|will (it|my \w+) (show|appear)|who reviews|who (checks|approves|verifies)|is (it|my \w+) reviewed|review process|(approved|published) (before|by))\b/, a: () => P('When you submit the form, your entry goes into the Google Sheet marked **Pending Review**, and the Energy Team gets an email. It does not appear on the map yet.') + P('Staff check it against a public source, such as a news story, meeting minutes or a county notice. If it holds up, they change its status to Published and it shows on the map the next time someone loads the page. If they cannot confirm it, they reject it or follow up with you.') + P('A Report a problem submission does not change the entry by itself. It is a proposed fix that staff review, and then they edit the entry.') + P('Include a source link when you can, since that makes review much faster. There is no set time limit for review.') + FORMS(), chips: ['How does data get added to the map?'] },
    { id: 'updated', re: /\b(how (often|fast|quickly|soon)|when) (is|does|do|are|will|did)\b.*\b(map|data|information|page|sheet|it)\b.*\b(updat\w+|refresh\w*|chang\w+|current|live|new)\b|\bhow (up to date|current|fresh)\b|\bis (the map|this|it|the data) (live|real ?time|current|up to date)\b|\b(live|real ?time) data\b|\bdoes the map update (itself|automatically)\b/, a: () => P('The map reads the Google Sheet live each time the page loads, so a change staff make in the Sheet shows up without anyone editing the map. The footer shows the date of the last update.') + P('The data is only as current as the Sheet. Staff update it when they learn of a change or a new filing, and it is not a news feed. For something that happened in the last few days, check the sources linked on each entry.') + P('The transmission and gas pipeline layers are separate government datasets from about 2025 and January 2020.'), chips: ['Where does the data come from?'] },
    { id: 'removed', re: /\b(how|why|when|what)\b.*\b(moratori\w+|rules?|entries|entry|projects?|counties|county)\b.*\b(removed|taken off|taken down|dropped|disappear\w*|deleted|hidden|vanish\w*|go away|gone)\b|\b(removed|taken off|dropped|disappear\w*|vanish\w*|gone)\b.*\b(from the map|moratori\w+)\b/, a: () => P('A moratorium is taken off the map automatically on its end date, and it stays in the tracking sheet. Staff can also remove or correct an entry if a source shows it was wrong or repealed.') + P('If something you expected is missing, it may have expired, or it may never have been added. Use the Report a problem form and include a link.') + FORMS(), chips: ['What happens to an expired moratorium?'] },
    { id: 'whoedits', re: /\b(who (can|is able to|has access to) (edit|change|update|add|write)|can (i|anyone|users?|people|the public|visitors) (edit|change|update|add to|fix|write)|edit the map|change the map|(is|are) (this|the data|the map) (editable|public)|crowdsourc\w+|wiki)\b/, a: () => P('Only Mountain Association staff can change what is on the map. Visitors cannot edit it directly. You can suggest an addition or fix with the forms, and staff review it first.') + FORMS(), chips: ['What happens after I submit something?'] },
    { id: 'verify', re: /\b(how (do|did|does|are|is)|where (do|did|does))\b.*\b(you|they|staff|we|team)\b.*\b(verify|verified|check|checked|confirm|confirmed|know|sure|validate\w*)\b|\bhow (accurate|reliable|trustworthy|do you know)\b|\bhow (is|are) (the )?(data|information|entries|facts) (verified|checked|confirmed|reviewed)\b/, a: () => P('Every entry links to a public source, such as a news story, meeting minutes or a government notice, so you can check it yourself. Staff review new submissions before publishing them.') + P('Commercial facilities from datacentermap.com are labeled **confirmed**, **likely** or **unverified** depending on how well independent sources back them up. The map shows only what is public, so some projects have unknown developers or sizes, and those fields say so.') + P('Dates and sizes come from reports and can be wrong or change. Treat the map as a starting point and not as legal advice.'), chips: ['How solid is this data?', 'Where does the data come from?'] },
    { id: 'pins', re: /\b(how (do|does|did|are|is)|why)\b.*\b(pins?|locations?|sites?|markers?|dots?|projects?|positions?)\b.*\b(placed|located|put|shown|positioned|decided|know where|placed where|there|at the center|in the middle)\b|\bwhy is (the |a )?pin (in|at|on)\b|\bexact (location|site)\b/, a: () => P('A solid pin is placed at the project’s known site. When only the county is known, the pin sits at the county’s center and is drawn dashed, so the pin does not claim an exact spot. Staff update it when the real site becomes public.') + P('Commercial facilities are placed at their listed address.'), chips: ['What does a dashed pin mean?'] },
    { id: 'stage', re: /\b(how (do|does|did|are|is)|who|what)\b.*\b(stage|stages|rumou?red|proposed|operating|status)\b.*\b(decided|chosen|assigned|set|determined|defined|mean|means|classified|labeled|picked)\b|\bhow (do you|does it|do they) (decide|classify|label|choose)\b/, a: () => P('Staff assign the stage from public reporting:') + UL(['**Rumored:** talked about or reported, little confirmed.', '**Proposed:** a developer, site or filing is public, but it is not built.', '**Operating:** built and running.']) + P('A project moves up a stage when sources show it has. Check the linked sources for the latest.'), chips: ['What is Rumored?'] },
    { id: 'alerts', re: /\b(how (does|do|will|would)|does)\b.*\b(map|staff|you|team|system)\b.*\b(know|notice|tell|alert\w*|notif\w+|warn\w*|email\w*|remind\w*)\b.*\b(expir\w+|end|ends|ending|moratori\w+)\b|\b(expir\w+|expiry) (alerts?|emails?|notifications?|reminders?)\b|\bdo you (email|notify|alert)\b/, a: () => P('Each moratorium row has an end date. The map hides it automatically once that date passes and tags it “Expires in X days” during the last 60 days. Separately, a daily check in the Sheet emails the Energy Team before a moratorium expires (an early warning) and again when it has, so staff can look for an extension or a new rule and update the entry.'), chips: ['What happens to an expired moratorium?'] }
  ];
  function answerProcess(qn) {
    const p = PROC.find(x => x.re.test(qn));
    return p ? R(p.a(), p.chips) : null;
  }

  const EXTRA_PLACES = { 'cincinnati': [39.10, -84.51], 'nashville': [36.16, -86.78], 'indianapolis': [39.77, -86.16], 'evansville': [37.97, -87.57], 'huntington': [38.42, -82.45], 'charleston': [38.35, -81.63], 'knoxville': [35.96, -83.92], 'memphis': [35.15, -90.05], 'st louis': [38.63, -90.20], 'columbus': [39.96, -83.00], 'clarksville': [36.53, -87.36], 'bristol': [36.60, -82.19], 'tri cities': [36.5, -82.5], 'ohio river': [38.3, -85.8] };
  function extraPlace(qn) { const k = Object.keys(EXTRA_PLACES).find(x => new RegExp('\\b' + x + '\\b').test(qn)); return k ? { key: k, pt: { lat: EXTRA_PLACES[k][0], lng: EXTRA_PLACES[k][1] } } : null; }
  function answerNearPoint(label, pt) {
    const rows = projects.map((p, i) => ({ p, i, d: milesBetween(pt.lat, pt.lng, p.lat, p.lng) })).filter(o => isFinite(o.d)).sort((a, b) => a.d - b.d).slice(0, 6);
    return R(P('Closest projects to ' + label + ' (' + (rows[0] && rows[0].d > 150 ? 'none are close, so these are just the nearest' : 'by straight-line distance') + '):') + UL(rows.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + '), about ' + Math.round(o.d) + ' mi')) + P('The map covers Kentucky only.') + '<div class="ask-actions">' + mapBtn(rows.map(o => projItem(o.i)), 'Nearest to ' + label) + '</div>', ['What is the big picture?']);
  }
  function answerColorCounties(qn) {
    const cat = /\b(teal|ordinance)\b/.test(qn) ? 'ordinance' : /\b(blue|moratori\w+)\b/.test(qn) ? 'moratorium' : /\b(red|pending|proposed rules?)\b/.test(qn) ? 'pending' : /\b(amber|orange|yellow|city only|only city|city rules)\b/.test(qn) ? 'amber' : /\b(strip\w+|both)\b/.test(qn) ? 'both' : 'gray';
    const cnt = c => { const regs = regsFor(c).map(o => o.r); return { co: regs.filter(isCountyLevel), ci: regs.filter(r => !isCountyLevel(r)) }; };
    let list = [], label = '';
    if (cat === 'gray') { const have = new Set(regulations.map(r => norm(r.county))); return R(P(allCounties.filter(c => !have.has(norm(c))).length + ' counties are gray (no regulation on file). That means nothing is tracked, not proof that nothing exists.') + P('Gray counties that have a proposed or rumored project:') + UL(gapCounties().map(g => '**' + g.county + ' County:** ' + g.idxs.map(i => projects[i].name).join(', '))), ['Which counties have no regulation but a proposed project?']); }
    allCounties.forEach(c => { const { co, ci } = cnt(c); const has = k => co.some(r => regKind(r) === k || norm(r.type) === k); let hit = false;
      if (cat === 'moratorium') hit = co.some(r => norm(r.type) === 'moratorium'); else if (cat === 'ordinance') hit = co.some(r => norm(r.type) === 'ordinance'); else if (cat === 'pending') hit = co.some(r => regKind(r) === 'pending'); else if (cat === 'amber') hit = !co.length && ci.length > 0; else if (cat === 'both') hit = co.length > 0 && ci.length > 0;
      if (hit) list.push(c); });
    const names = { moratorium: 'blue (moratorium)', ordinance: 'teal (ordinance)', pending: 'red (pending or proposed rule)', amber: 'amber (a city inside has a rule, the county does not)', both: 'striped (both a county-wide rule and a city rule)' };
    return R(list.length ? P((list.length === 1 ? '1 county is ' : list.length + ' counties are ') + names[cat] + ':') + UL(list.map(c => '**' + c + ' County**')) + '<div class="ask-actions">' + mapBtn([].concat(...list.map(c => regsFor(c).map(o => regItem(o.i)))), cat + ' counties') + '</div>' : P('No county is ' + names[cat] + ' right now.'), ['How do I read the colors?', 'Which moratoria end soon?']);
  }
  function answerInvestment() {
    const rows = projects.map((p, i) => { const t = [p.size, p.notes, p.tenant, p.developer].join(' '); const m = t.match(/\$\s?([\d.,]+)\s*(billion|million|b\b|m\b)/i); if (!m) return null; const v = parseFloat(m[1].replace(/,/g, '')) * (/^b/i.test(m[2]) ? 1000 : 1); return isFinite(v) ? { p, i, v, txt: m[0] } : null; }).filter(Boolean).sort((a, b) => b.v - a.v);
    if (!rows.length) return R(P('No project on the map has a stated dollar investment.'), []);
    return R(P('Dollar figures reported for ' + plural(rows.length, 'project') + ' (announced amounts from news or filings, not audited; I do not add them up because some overlap):') + UL(rows.slice(0, 8).map(o => '**' + o.p.name + '** (' + o.p.county + ' Co.): ' + o.txt)) + '<div class="ask-actions">' + mapBtn(rows.map(o => projItem(o.i)), 'Projects with a stated investment') + '</div>', ['What is the biggest project?']);
  }
  function answerTotalsCount(qn) {
    if (/\b(developers?|companies|company|builders?|firms?|who is involved|involved)\b/.test(qn)) { const r = devRanking(); const top = r.filter(d => d.n >= 2); return R(P(r.length + ' developers or companies are named across ' + plural(projects.length, 'project') + '. Repeat names:') + UL(top.slice(0, 8).map(d => '**' + d.label + ':** ' + plural(d.n, 'project') + ' in ' + plural(d.counties, 'county', 'counties'))) + P('Counted as written in the Sheet, so one company listed two ways may count twice.'), ['Who is the biggest developer?']); }
    const sc = stageCounts(projects), fac = projects.filter(p => p._facility).length;
    return R(P(plural(projects.length, 'project') + ' are tracked: ' + sc.Rumored + ' rumored, ' + sc.Proposed + ' proposed and ' + sc.Operating + ' operating' + (fac ? ' (' + fac + ' of the operating ones are commercial hosting facilities)' : '') + '.') + '<div class="ask-actions">' + mapBtn(projects.map((p, i) => projItem(i)), 'All projects') + '</div>', ['How many projects are in each stage?', 'What\u2019s the big picture?']);
  }

  // ---- Conversational and meta questions
  const US_STATES = 'alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada new hampshire new jersey new mexico new york north carolina north dakota ohio oklahoma oregon pennsylvania rhode island south carolina south dakota tennessee texas utah vermont virginia west virginia washington wisconsin wyoming'.split(' ');
  function suggestionsAnswer() {
    const blocks = [
      ['Look things up', ['Tell me about Rubix', 'Is there a moratorium in Madison County?', 'Who is the biggest developer?']],
      ['Rules and timing', ['Which moratoria end soon?', 'What happens to an expired moratorium?', 'Which counties have an ordinance?']],
      ['Connections and gaps', ['Which proposed projects are in counties with a moratorium?', 'Which counties have no regulation but a proposed project?', 'What patterns do you see?']],
      ['How the map works', ['How do I read the colors?', 'How does data get added to the map?', 'What is a TSR?']]
    ];
    return R(P('Here are some things you can ask. Tap one, or type your own:') + blocks.map(b => '<div class="ask-sub"><strong>' + esc(b[0]) + '</strong></div>' + chipRow(b[1])).join('') + P('You can also ask about any county, city, project, developer or term on the map.'), []);
  }
  function metaIntents(qn) {
    if (/^(help|help me|\?|what can i ask|what should i ask|what questions can i ask|suggest (a )?(question|something)s?|example questions?|give me an example|examples?|what next|what else( can i ask)?|anything else|what now|ideas|i dont know what to ask|not sure what to ask)$/.test(qn) || /\b(what (can|should) i ask|what questions|suggest a question|give me (an )?example|sample questions?)\b/.test(qn)) return suggestionsAnswer();
    if (/^(update|updates|whats new|what is new|anything new|any updates?)$/.test(qn)) { const a = answerRecent(); const f0 = PROC.find(x => x.id === 'updated'); return R((a ? a.html : '') + f0.a(), ['How often is the map updated?']); }
    if (/^(more|tell me more|go on|continue|expand|more details?|details|elaborate|and)$/.test(qn)) { const c = state.ctx; if (c && c.type === 'project') return answerProject(c.i, ''); if (c && c.type === 'county') return answerCounty(c.county); if (c && c.type === 'dev') return answerDeveloper(c.key); return suggestionsAnswer(); }
    if (/^(confused|im confused|i dont understand|i do not understand|im lost|i am lost|what|huh|i dont get it|i do not get it|explain that|explain|say that again|simpler|simplify|in plain english)$/.test(qn)) return R(P('Sorry about that. Try asking in a short, simple way, for example **Is there a moratorium in Madison County?** or **How do I read the colors?** I can also explain any term on the map, like moratorium or TSR.'), ['What can I ask?', 'How do I read the colors?', 'What is a moratorium?']);
    if (/\b(this is wrong|you are wrong|youre wrong|that is (wrong|incorrect|not right|not true)|thats (wrong|incorrect|not right|not true)|bad answer|wrong answer|incorrect|not what i asked|that doesnt help|that does not help|useless|not helpful)\b/.test(qn)) return R(P('Sorry about that. If the data on the map is wrong, please tell the team with the Report a problem form and include a source link. If I misunderstood your question, try rewording it more simply, or search the map directly with the box at the top.') + FORMS(), ['What can I ask?', 'How is the data verified?']);
    if (/^(good|great|nice|wow|cool|awesome|amazing|helpful|that helps|thats helpful|that is helpful|perfect|excellent|love it|good answer|great answer|well done)\b/.test(qn) && qn.split(' ').length <= 4) return R(P('Glad that helped. Ask me anything else about the map.'), ['What can I ask?', 'What’s the big picture?']);
    if (/\b(are you|r u|is this) (a |an )?(robot|bot|human|person|real|ai|chatbot|artificial|chat ?gpt|gpt|claude|gemini|llm|language model|machine)\b|\bwhat (model|ai|llm) (are|is)\b|\bwho (built|made|created|programmed|trained|build|designed|developed) (you|this chat|this bot|the chat|the helper)\b|\bare you using ai\b|\bwhat are you powered\b/.test(qn)) return R(P('I’m a built-in helper on this page, not a language model like ChatGPT or Claude. I answer from the map’s own data and a set of written rules, so I’m reliable on what is on the map and limited outside it. I was built for the people who maintain this map, and I do not call any outside AI service.'), ['What can I ask?', 'How is the data verified?']);
    if (/\b(questions?|messages?|chats?|conversations?|history)\b.*\b(saved|stored|kept|recorded|logged|tracked|private|shared|seen|read)\b|\b(do you|does (this|the chat)|are my|is my)\b.*\b(store|save|saved|keep|record|log|track|tracking|private|privacy|collect|share|see|read|remember)\b.*\b(questions?|messages?|chats?|data|me|conversations?|history)\b|\b(privacy|private)\b.*\b(chat|questions?|helper)\b|\bis (this|the chat) (private|safe|secure|anonymous)\b/.test(qn)) return R(P('I do not send or save your questions. Everything I do runs in your browser, and closing or reloading the page clears the conversation. The page itself still loads map tiles and the map data from other services, as any web map does.'), ['How does data get added to the map?']);
    if (/\b(can you|do you|are you able to|will you)\b.*\b(search|browse|look up|google|check)\b.*\b(web|internet|online|google|news)\b/.test(qn)) return R(P('No, I only know what is on this map. For anything newer or outside the map, I can point you to sources.') + linkBlock([resById('tracker'), resById('pause'), resById('mta'), resById('lantern')], 'Good places to look'), ['What can I ask?']);
    const st = US_STATES.find(x => x !== 'kentucky' && new RegExp('\\b' + x + '\\b').test(qn));
    if (st && !/\b(kentucky|ky)\b/.test(qn) && /\b(data cent\w+|projects?|moratori\w+|rules?|what about|how about|compare|rank|in|near)\b/.test(qn) && !findEntities(qn).counties.length && !findEntities(qn).cities.length) return R(P('The map covers Kentucky only, so I have nothing on ' + cap(st) + '.') + linkBlock([resById('dcmap'), resById('epic'), resById('eia')], 'These cover other places and the wider picture'), ['What’s the big picture?']);
    if (/\b(will|going to|gonna|are)\b.*\bdata cent\w+\b.*\b(take over|taking over|run out|last|disappear|grow|growing|boom|bubble|crash|keep|future)\b|\bfuture of data cent\w+\b|\bis there a (bubble|boom)\b/.test(qn)) return R(P('The map cannot forecast. What it shows is where things stand now: ' + plural(projects.filter(p => p.stage !== 'Operating' && !p._facility).length, 'proposed or rumored project') + ' and ' + plural(regulations.filter(r => norm(r.type) === 'moratorium').length, 'active moratorium', 'active moratoria') + '. For analysis of where this is headed, see:') + linkBlock([resById('epic'), resById('tracker'), resById('lantern')], 'Outside analysis'), ['What’s the big picture?', 'Which moratoria end soon?']);
    if (/\b(should i|should we|am i|are we)\b.*\b(worr\w+|concern\w+|afraid|scared|nervous|alarm\w+)\b|\bis it (safe|dangerous|harmful|bad|good)\b|\b(are|is) data cent\w+ (bad|good|safe|dangerous|harmful|worth it)\b|\bshould (we|i|kentucky) (want|welcome|allow|ban|stop|build)\b/.test(qn)) return R(P('That is a judgment the map cannot make, and reasonable people weigh it differently. What the map can show is what is planned, what local governments have done, and where the gaps are. For the costs and benefits, these sources lay out both sides:') + linkBlock([resById('epic'), resById('mta'), resById('klc')], 'Where to read more'), ['What’s the big picture?', 'What are the biggest risks?']);
    if (/\b(where should (a |the |new )?data cent\w+ (go|be built|be placed|locate)|best (place|location|county|spot)s? (for|to build)|where is (the )?best to build|ideal location)\b/.test(qn)) return R(P('The map does not recommend sites. What it can show is where projects are already proposed and where there are no local rules on file.') + '<div class="ask-actions">' + btn('Counties with a project and no rule', () => ask('Which counties have no regulation but a proposed project?')) + '</div>' + linkBlock([resById('ced'), resById('epic')], 'Siting and economic development'), ['Which regions are most active?']);
    if (/\b(grandfather\w*|vested|already approved|existing projects?|projects? already|exempt\w*|apply (to|retroactively)|retroactiv\w+|cover(ed|s)? (cities|city|projects?|existing)|does (a|the) (county )?(moratorium|ordinance|rule) (cover|apply)|do (moratoria|moratoriums|ordinances) apply)\b/.test(qn) && /\b(moratori\w+|ordinances?|rules?|projects?)\b/.test(qn)) return R(P('That depends on the exact wording of each moratorium or ordinance. Some exempt projects that were already approved or filed, and a county moratorium may not reach land inside a city. The map cannot tell you which applies, and this is not legal advice. It can show where a project sits inside a moratorium area so you know where to read the source.') + '<div class="ask-actions">' + btn('Projects in moratorium areas', () => ask('Which proposed projects are in counties with a moratorium?')) + '</div>' + linkBlock([resById('mta'), resById('klc')], 'To read how others handled it'), ['Which proposed projects are in counties with a moratorium?']);
    if (/\b(can|could|may|are allowed to|is a|do)\b.*\b(count(y|ies)|cit(y|ies)|town|local government|fiscal court|council)\b.*\b(ban|banned|ban data|prohibit|stop|block|pause|regulate|restrict|limit)\b|\bwhat (power|authority|rights) (do|does) (count(y|ies)|cit(y|ies)|local)\b/.test(qn)) return R(P('Local governments in Kentucky have used zoning and temporary moratoria to pause or shape data center development, and the map shows who has done so. What a given county or city can legally do depends on state law and its own authority, so check with a local attorney or the sources below. This is not legal advice.') + linkBlock([resById('klc'), resById('kaco') || resById('beshear'), resById('mta')], 'On local authority and what others did'), ['Which counties have a moratorium?']);
    if (/\b(do|does|are|is|how well)\b.*\b(moratori\w+|moratoria)\b.*\b(work|working|effective|useful|enforced|ignored|violated|helpful|succeed|successful)\b/.test(qn)) return R(P('The map does not measure whether moratoria work. It records which counties and cities have one and when each ends. For analysis of how they have played out, see these:') + linkBlock([resById('pause'), resById('mta'), resById('klc')], 'Outside reporting'), ['Which moratoria end soon?']);
    if (/\b(how long|what is the (usual|typical|average|normal|common) (length|duration)|typical)\b.*\b(moratori\w+)\b.*\b(last|lasts|length|usually|typical|long)?\b/.test(qn) && !/\bwhen\b/.test(qn)) { const ds = regulations.filter(r => norm(r.type) === 'moratorium' && r.period).map(r => r.period); return R(P('Moratoria on the map vary. Many run six months to a year or more' + (ds.length ? ' (lengths on file include ' + [...new Set(ds)].slice(0, 5).join(', ') + ')' : '') + ', and some have no end date and last until permanent rules pass. Counties often extend them.'), ['Which moratorium lasts the longest?', 'What happens to an expired moratorium?']); }
    return null;
  }

  function smartIntents(qn, hasNamed) {
    if (/\b(how many|number of|count of|breakdown|break down|split)\b.*\b(each|every|by|per)\b.*\bstages?\b|\bprojects? by stage\b|\bstage breakdown\b/.test(qn)) { const sc = stageCounts(projects), fac = projects.filter(p => p._facility).length; return R(P('Projects by stage:') + UL(['**Rumored:** ' + sc.Rumored, '**Proposed:** ' + sc.Proposed, '**Operating:** ' + sc.Operating + (fac ? ' (' + fac + ' of them are commercial hosting facilities from datacentermap.com)' : '')]) + '<div class="ask-actions">' + mapBtn(projects.map((p, i) => projItem(i)), 'All projects') + '</div>', ['How is the stage decided?', 'What does a dashed pin mean?']); }
    if (!hasNamed) {
      { const ex = extraPlace(qn); if (ex && /\b(near|nearest|closest|around|close to|by|within|from)\b/.test(qn)) return answerNearPoint(cap(ex.key), ex.pt); }
      if (/\b(appalachia\w*|the mountains|mountain (region|counties)|coal ?fields?)\b/.test(qn)) return answerRegions('eastern');
      if (/\b(bluegrass)\b/.test(qn)) return answerArea('the Bluegrass region', (la, ln) => la > 37.6 && la < 38.5 && ln > -85.2 && ln < -83.8, 'In the Bluegrass region (around Lexington) the map has');
      if (/\b(jackson purchase|the purchase|purchase region)\b/.test(qn)) return answerArea('the Jackson Purchase', (la, ln) => ln < -88.0, 'In the Jackson Purchase (far western Kentucky) the map has');
      if (/\b(what|which)\b.*\bcount(y|ies)\b.*\b(are|is)\b.*\b(blue|teal|red|amber|orange|yellow|striped|gray|grey)\b|\b(which|what) counties (have )?(stripes?|both county and city)\b|\bcounties (that are|in) (blue|teal|red|amber|gray|grey)\b|\bwhich counties have (only |just )?city (rules?|level)\b/.test(qn)) return answerColorCounties(qn);
      if (/\b(show|display|map)\b.*\b(me )?(all|every|everything)\b.*\b(projects?|data cent\w+)\b/.test(qn)) return R(P('Showing all ' + projects.length + ' projects on the map.') + '<div class="ask-actions">' + mapBtn(projects.map((p, i) => projItem(i)), 'All projects') + '</div>', ['How many projects are in each stage?']);
      if (/\b(show|display|map|list)\b.*\b(me )?(all|every|everything)\b.*\b(rules?|regulations?|moratori\w+|ordinances?)\b/.test(qn) && !/\bcount(y|ies)\b/.test(qn)) { const ty = /\bmoratori\w+/.test(qn) ? 'moratorium' : /\bordinances?/.test(qn) ? 'ordinance' : null; const sel = regulations.map((r, i) => ({ r, i })).filter(o => !ty || norm(o.r.type) === ty); return R(P('Showing ' + (ty ? (ty === 'moratorium' ? sel.length + (sel.length === 1 ? ' moratorium' : ' moratoria') : plural(sel.length, 'ordinance')) : 'all ' + sel.length + ' rules') + ' on the map.') + UL(sel.slice(0, 10).map(o => describeReg(o.r))) + (sel.length > 10 ? P('And ' + (sel.length - 10) + ' more.') : '') + '<div class="ask-actions">' + mapBtn(sel.map(o => regItem(o.i)), ty ? cap(ty) + 's' : 'All rules') + '</div>', ['Which moratoria end soon?']); }
      if (/\b(number of|total|how many|count of)\b.*\b(projects?|data cent\w+|sites?)\b|\bnumber of projects\b|\btotal projects\b/.test(qn) && !/\b(each|every|by|per|in [a-z]+ county|stage|proposed|operating|rumou?red|near|within)\b/.test(qn)) return answerTotalsCount(qn);
      if (/\b(how many|number of|who (are|is) (the )?(involved|developers?)|what companies|which companies|list (all )?(the )?(developers|companies))\b.*\b(developers?|companies|company|firms?|involved)\b/.test(qn) || /\bwhat companies are involved\b/.test(qn)) return answerTotalsCount(qn);
      if (/\b(investment|invested|investing|spend\w*|dollars?|billions?|cost\w*|price tag|how much money)\b/.test(qn) && /\b(project|data cent|projects|biggest|total|each|being|over|is)\b/.test(qn) && !/\b(ratepayers?|bills?|electric|rates?|tax)\b/.test(qn)) return answerInvestment();
      if (/\b(considering|thinking about|weighing|debating|discussing|drafting|working on|about to pass|looking at)\b.*\b(moratori\w+|rules?|ordinances?|regulations?|ban)\b|\bproposed (rules?|regulations?|ordinances?|moratori\w+)\b|\bwhat is pending\b|\bare any rules pending\b/.test(qn)) { const pend = regulations.map((r, i) => ({ r, i })).filter(o => regKind(o.r) === 'pending'); return R(pend.length ? P(plural(pend.length, 'rule') + ' on the map ' + (pend.length === 1 ? 'is' : 'are') + ' pending or proposed (not yet passed):') + UL(pend.map(o => '**' + describeReg(o.r) + '**' + (o.r.notes ? ': ' + clip(o.r.notes, 140) : ''))) + '<div class="ask-actions">' + mapBtn(pend.map(o => regItem(o.i)), 'Pending rules') + '</div>' : P('No rule on the map is currently marked pending or proposed. The map only tracks rules that staff found in public sources, so a county that is just talking about one may not be listed.') + linkBlock(linksFor('news local'), 'To look for news on proposals'), ['Which moratoria end soon?', 'Which counties have no regulation but a proposed project?']); }
      if (/\b(controvers\w+|opposition|oppose[sd]?|protests?|residents? (against|oppos\w+)|backlash|in the news|newsworthy|making news|headlines?)\b/.test(qn) && /\b(projects?|data cent\w+|which|what|any)\b/.test(qn)) { const rx = /oppos|protest|resident|rejected|denied|lawsuit|sued|petition|backlash|concern|withdrawn|tabled/i; const hits = projects.map((p, i) => ({ p, i })).filter(o => rx.test([o.p.notes, o.p.pz].join(' '))).slice(0, 6); return R((hits.length ? P('The map does not track controversy as such. Projects whose notes mention opposition, a rejection or a legal step:') + UL(hits.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co.): ' + clip(o.p.pz && rx.test(o.p.pz) ? o.p.pz : o.p.notes, 130))) + '<div class="ask-actions">' + mapBtn(hits.map(o => projItem(o.i)), 'Projects with notes on opposition') + '</div>' : P('The map does not track controversy or news coverage.')) + linkBlock(linksFor('latest news'), 'For current news'), ['Are there any approved projects?']); }
      if (/\b(newest|latest|oldest|first|earliest|most recent)\b.*\b(data cent\w+|facility|project|campus)\b/.test(qn) && !/\bmoratori\w+\b/.test(qn)) return R(P('The map does not hold a built or announced date for each project, so I cannot say which is oldest or newest. It does list expected completion dates where public.') + UL(projects.filter(p => !unknownVal(p.completionDate)).slice(0, 6).map(p => '**' + p.name + '** (' + p.county + ' Co.): ' + clip(p.completionDate, 90))) + linkBlock([resById('dcmap'), resById('tracker')], 'For history and listings'), ['Which projects are operating?']);
      if (/\b(what towns?|which towns?|what cit(y|ies)|which cit(y|ies))\b.*\b(affected|covered|included|have|with)\b/.test(qn)) return answerCountsAbout('cities');
      if (/\b(why|what makes)\b.*\b(kentucky|the state)\b.*\b(attractive|appeal\w*|chosen|picked|popular|a target|target|so many|hot)\b|\bwhy (are|do) (data cent\w+|developers|companies) (come|coming|build\w*|want\w*|choos\w*|pick\w*|target\w*)\b/.test(qn)) return R(P('The map holds where projects are, not why companies choose Kentucky. Commonly cited reasons are land, available power and transmission, water, tax incentives and location. These sources go into it:') + linkBlock([resById('epic'), resById('ced'), resById('tracker')], 'Outside sources'), ['What is the big picture?']);
    }
    if (/\b(do|does|how much|how many|is)\b.*\b(electricity|power|energy|megawatts?)\b.*\b(data cent\w+|they|these)\b|\bdata cent\w+\b.*\b(use|uses|consume\w*|need|needs|draw|draws)\b.*\b(electricity|power|energy)\b/.test(qn) && !/\b(bill|bills|rates?|cost|price|pay)\b/.test(qn) && !hasNamed) { const big = projects.map((p, i) => ({ p, i, m: mw(p) })).filter(o => o.m != null).sort((a, b) => b.m - a.m).slice(0, 4); return R(P('Yes, large ones use a lot. A big new data center can draw as much electricity as a small city, which is why utilities and counties pay close attention. The map shows each project\u2019s stated size where it is public:') + UL(big.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co.): ' + fmtMW(o.m))) + linkBlock([resById('epic'), resById('eia'), resById('ekpc')], 'For the grid and energy picture'), ['What does MW mean?', 'What is the biggest project?']); }
    if (!hasNamed && /\bwho\b.*\b(builds?|building|builders?|developing|develops?|developers?|behind|are the companies|is involved)\b.*\b(data cent\w+|projects?|here|in kentucky|these)\b/.test(qn) && !/\b(near|in [a-z]+ county)\b/.test(qn)) return answerRanking('dev', qn);
    if (/\b(learn more|read more|more (info|information|about this)|best (source|place|resource)s?|resources?|where (can|do) i (learn|read|find out)|further reading|recommend\w* (reading|sources?)|good sources?)\b/.test(qn) && !/\b(map|legend|colou?rs?)\b/.test(qn)) return answerResources();
    if (/\b(which|what|list|show|how many)\b.*\bprojects?\b.*\b(have|has|with|without|lack|lacking|missing|no|don'?t|doesn'?t)\b/.test(qn) || /\bprojects? (that |which )?(lack|lacks|without|missing|with no|have no|has no|don'?t have|doesn'?t have)\b/.test(qn) || /\b(are there|do any)\b.*\bprojects?\b.*\b(lack|without|missing|no)\b/.test(qn)) { if (!/\b(moratori\w+|ordinances?|rules?|regulat\w+)\b/.test(qn)) { const a = answerMissingField(qn); if (a) return a; } }
    if (/\b(capacity|power|megawatts?|gigawatts?|mw|gw)\b/.test(qn) && /\b(of all|all (the )?projects|everything|combined|total|overall|altogether)\b/.test(qn)) return answerTotals();
    {
      const e2 = findEntities(qn);
      if (e2.counties.length >= 2 && /\b(more|most|bigger|larger|fewer|less|than|or|versus|vs|compare)\b/.test(qn) && !/\bmoratori\w+ in\b/.test(qn)) return compareEntities({ type: 'county', name: e2.counties[0] }, { type: 'county', name: e2.counties[1] });
    }
    {
      const ee = findEntities(qn);
      const pl = ee.cities[0] || (ee.counties[0] ? { key: ee.counties[0], county: ee.counties[0], isCounty: true } : null);
      if (/\b(will|going to|gonna|likely to|expected to|probably)\b.*\b(moratori\w+)\b.*\b(extend\w*|renew\w*|end|expire|lifted|replaced|continue)\b/.test(qn) || /\bwill (it|the moratorium|they) (be )?(extend\w*|renew\w*|lifted)\b/.test(qn)) return R(P('The map cannot predict that. Local governments often extend a moratorium or replace it with permanent rules, but each decides on its own timeline. Moratoria ending soonest are the ones to watch:') + UL(regulations.filter(isExpiringSoon).sort((a, b) => daysUntilExpiry(a) - daysUntilExpiry(b)).slice(0, 5).map(r => '**' + describeReg(r).split(',')[0] + ':** ends ' + r.expiration + ' (' + plural(daysUntilExpiry(r), 'day') + ' left)')) + linkBlock(linksFor('news local'), 'For news on extensions'), ['Which moratoria end soon?']);
      if (pl && /\b(when|how long|end|ends|ending|expire\w*|last|lasts|until|through|duration|how much longer)\b/.test(qn) && /\b(moratori\w+|ban|pause|rule|it)\b/.test(qn)) { const a = answerEndDate({ county: pl.isCounty ? pl.county : (pl.county.NAME || pl.county), city: pl.isCounty ? null : pl.key }, ee); if (a) return a; }
      if (pl && /\b(nearest|closest|near|nearby|around|close to|within)\b/.test(qn) && /\b(data cent\w+|projects?|facilit\w+|sites?|campus\w*)\b/.test(qn) && !/\b(proposed|rumou?red|operating|over|under|more than|within \d+)\b/.test(qn)) { const a = answerNearPlace(pl.isCounty ? pl.county : pl.key, cap(pl.isCounty ? pl.county + ' County' : pl.key), /\b(nearest|closest)\b/.test(qn)); if (a) return a; }
      if (pl && /\b(who is building|who'?s building|who is planning|what is being built|what'?s being built|what is planned|what'?s planned|what is happening|what'?s happening|any (new )?(data cent\w+|projects?)|are there (any )?(data cent\w+|projects?))\b/.test(qn)) { const a = answerNearPlace(pl.isCounty ? pl.county : pl.key, cap(pl.isCounty ? pl.county + ' County' : pl.key), false); if (a) return a; }
      const proj1 = pl && !(ee.projects.length && ee.projects[0].score >= 100) && /\b(project|data center|campus)\b/.test(qn) && /\b(tell me about|about|what is|whats|status|details|info)\b/.test(qn) ? projects.map((p, i) => ({ p, i })).filter(o => norm(o.p.name).split(' ').includes(pl.isCounty ? norm(pl.county) : pl.key) || norm(o.p.city) === (pl.isCounty ? norm(pl.county) : pl.key)) : [];
      const proj1b = proj1.length > 1 ? proj1.filter(o => !o.p._facility && o.p.stage !== 'Operating') : proj1;
      if (proj1b.length === 1) return answerProject(proj1b[0].i, qn);
      if (proj1b.length > 1) return R(P('There is more than one match:') + UL(proj1b.map(o => '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + ')')) + '<div class="ask-actions">' + mapBtn(proj1b.map(o => projItem(o.i)), 'Matches') + '</div>', proj1b.slice(0, 3).map(o => 'Tell me about ' + o.p.name));
      if (/\b(northern|north)\b.*\b(kentucky|ky)\b|\bnorthern ky\b/.test(qn)) return answerArea('Northern Kentucky', (la, ln) => la > 38.5 && ln > -85.2, 'In Northern Kentucky (the Cincinnati side), the map has');
      if (/\b(southern|south)\b.*\b(kentucky|ky)\b|\bsouthern ky\b/.test(qn)) return answerArea('southern Kentucky', (la) => la < 37.1, 'In southern Kentucky the map has');
      if (/\b(most likely|likely to (be )?built|furthest along|most advanced|closest to (being )?built|will actually (be )?built|likely to happen|real(ly)? happening|serious|moving forward)\b/.test(qn)) return answerLikely();
    }
    if (/\b(near me|my area|my town|my city|my county|close to me|where i live|my location|my community|my neighbou?rhood)\b/.test(qn) && !/\b(?!(?:my|your|our|the|a|this|that|any|every|each) )[a-z]+ county\b/.test(qn)) return answerNearMe();
    if (/\b(how (does|do|is|are) (kentucky|ky|the state) compare|compared to (other states|virginia|ohio|tennessee|indiana|texas)|other states|national(ly)?)\b/.test(qn)) return R(P('The map covers Kentucky only, so I can’t compare it with other states.') + linkBlock([resById('epic'), resById('eia'), resById('dcmap')], 'These cover the wider picture'), ['What’s the big picture?']);
    if (!hasNamed) {
      if (/\b(most restrictive|strictest|toughest|strongest rules?|tightest|most strict|least friendly|hardest)\b/.test(qn)) return answerRestrictive();
      if (/\b(regions?|parts of (the state|kentucky)|areas of (the state|kentucky)|where (is|are) .*(most|busiest|active|concentrated)|most active|hotspots?|concentrat\w+)\b/.test(qn)) return answerRegions();
      const rg = qn.match(/\b(eastern|east|central|western|west)\b(?: kentucky| ky)?\b/); if (rg && /\b(kentucky|ky|region|part|happening|going on|activity)\b/.test(qn) && !/\b(proposed|operating|rumou?red|moratori\w+|ordinances?)\b/.test(qn)) return answerRegions(/^east/.test(rg[1]) ? 'eastern' : /^west/.test(rg[1]) ? 'western' : 'central');
      if (/\b(good|bad|friendly|welcoming|trend|direction|momentum|going well|doing|healthy|growing|slowing|heating up|picture)\b/.test(qn) && /\b(kentucky|ky|state|data cent\w+|moratori\w+|statewide)\b/.test(qn)) return answerLandscape(qn);
      if (/\b(banning|banned|pushback|opposition|resistance|backlash|fighting|against|restrict\w*|cracking down)\b/.test(qn) && /\b(counties|county|cities|local|places|kentucky|data cent\w+)\b/.test(qn)) return answerCountsAbout(qn);
      if (!linksFor(qn, 1).length && /\b(risks?|concerns?|problems?|watch (out|for)|red flags?|worry|worries|issues?)\b/.test(qn) && /\b(biggest|main|top|key|most|any|kentucky|data cent\w+|the map)\b/.test(qn)) return answerRisks();
      if (/\b(should (a |my |the |our )?(county|city|town|community|government|fiscal court|council)|how (do|can) (i|we|a county|a city|my county|my community) (protect|prepare|respond|handle|stop|regulate|get ready)|what (can|should|do) (a |my |our |the )?(county|city|community|local government|local governments|counties|cities)( do)?|what do local governments do|protect my (county|town|community|city))\b/.test(qn)) return answerAdvice();
      if (/\b(newest|latest|recent(ly)?|just (added|passed)|new (moratori\w+|rules?|ordinances?)|this (week|month)|happened lately|what('?s| is) new)\b/.test(qn)) { const a = answerRecent(); if (a) return a; }
      if (/\b(confirmed|sourced|unsourced|no source|without (a )?source|reliable|trust|how (accurate|solid|reliable|complete)|data quality|complete)\b/.test(qn)) return answerConfidence(qn);
      if (/\b(approved|rejected|denied|withdrawn|voted down|tabled|turned down|approval)\b/.test(qn) && /\b(projects?|rezoning|zoning|data cent\w+|any)\b/.test(qn)) return answerStatusWords(qn);
      if (/\b(how many|what percent\w*|what share|number of)\b/.test(qn) && /\b(counties|cities)\b/.test(qn) && /\b(moratori\w+|rules?|regulat\w+|ban\w*|protect\w*|restrict\w*|ordinances?)\b/.test(qn)) return answerCountsAbout(qn);
      if (/\b(which|what|list|show)\b.*\bcit(y|ies)\b.*\b(moratori\w+|rules?|ban|regulat\w+)\b/.test(qn)) return answerCountsAbout('cities');
      if (/\b(which|what|list|show)\b.*\bcount(y|ies)\b.*\b(have|has|with)\b.*\b(moratori\w+)\b/.test(qn) && !/\b(proposed|rumou?red|projects?|developers?)\b/.test(qn)) return answerCountsAbout('counties');
    }
    return null;
  }


  // ------------------------------------------------ full-text index over everything on the map
  const FT = { sig: '', docs: [], df: {}, N: 0, help: [], helpTried: false, vocab: null };
  const stemw = t => (t.length > 4 && /ies$/.test(t)) ? t.slice(0, -3) + 'y' : (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) ? t.slice(0, -1) : t;
  function ftTokens(text) {
    const raw = String(text == null ? '' : text).toLowerCase();
    const out = [];
    (raw.match(/\$?\d[\d,]*(?:\.\d+)?/g) || []).forEach(n => { const c = n.replace(/[$,]/g, ''); if (c) out.push(c); });
    norm(raw.replace(/\d[\d,]*(?:\.\d+)?/g, ' ')).split(' ').forEach(w => { if (w.length >= 2 && !STOP.has(w)) out.push(stemw(w)); });
    return out;
  }
  const FT_W = { Name: 3, County: 2, City: 2, Developer: 2, Tenant: 2, Type: 2, Address: 1.5 };
  function recDocs() {
    const docs = [];
    projects.forEach((p, i) => {
      const f = { Name: p.name, City: p.city, County: p.county + ' County', Address: p.address, Size: p.size, Developer: p.developer, 'Planning and zoning': p.pz, Utility: p.utility, Tariff: p.tariff, 'Expected completion': p.completionDate, Tenant: p.tenant, Notes: p.notes, Stage: p.stage + (p._facility ? ' commercial facility ' + (p.verification || '') : ''), Sources: (p.links || []).join(' ') };
      docs.push({ kind: 'proj', i, title: p.name, sub: p.county + ' Co., ' + p.stage, fields: f });
    });
    regulations.forEach((r, i) => {
      const f = { Type: r.type + ' ' + (r.level || ''), County: r.county + ' County', City: r.city, Notes: r.notes, Period: r.period, 'Start date': r.startDate, Ends: r.expiration, Address: r.address, Sources: (r.links || []).join(' ') };
      docs.push({ kind: 'reg', i, title: describeReg(r).split(',')[0], sub: r.county + ' Co.', fields: f });
    });
    return docs;
  }
  function pageDocs() {
    const out = [];
    try {
      const skip = $('ask-panel');
      const clone = document.body.cloneNode(true);
      ['#ask-panel', '#ask-btn', '#map', 'script', 'style', '#data-check-panel'].forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));
      String(clone.innerText || clone.textContent || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length >= 25).forEach(t => out.push({ kind: 'page', title: 'On the map page', sub: '', fields: { Text: t } }));
    } catch (e) {}
    return out;
  }
  function buildFT() {
    const docs = recDocs().concat(FT.help.map(h => ({ kind: 'help', title: h.title, sub: 'Help page', fields: { Text: h.text } }))).concat(pageDocs());
    const df = {};
    docs.forEach(d => {
      d.tok = {}; d.all = new Set();
      Object.keys(d.fields).forEach(k => { const toks = ftTokens(d.fields[k]); d.tok[k] = new Set(toks); toks.forEach(t => d.all.add(t)); });
      d.all.forEach(t => { df[t] = (df[t] || 0) + 1; });
    });
    FT.docs = docs; FT.df = df; FT.N = docs.length; FT.sig = sig() + '|' + FT.help.length;
  }
  function ft() { if (FT.sig !== sig() + '|' + FT.help.length) buildFT(); return FT; }
  function loadHelp() {
    if (FT.helpTried) return; FT.helpTried = true;
    try {
      fetch('help.html', { credentials: 'omit' }).then(r => r.ok ? r.text() : '').then(t => {
        if (!t) return;
        const doc = new DOMParser().parseFromString(t, 'text/html'); let h2 = 'Help page';
        doc.querySelectorAll('h2, p, li, .swatch-row').forEach(n => {
          if (n.tagName === 'H2') { h2 = n.textContent.trim(); return; }
          const tx = n.textContent.replace(/\s+/g, ' ').trim(); if (tx.length >= 25) FT.help.push({ title: h2, text: tx });
        });
      }).catch(() => {});
    } catch (e) {}
  }
  function ftSearch(tokens, opts) {
    opts = opts || {};
    const F = ft(); const q = [...new Set(tokens)]; if (!q.length) return [];
    const res = [];
    F.docs.forEach(d => {
      let score = 0, hit = 0; const fields = new Set(); const miss = [];
      q.forEach(t => {
        const idf = Math.log(1 + F.N / (F.df[t] || 1));
        let best = 0, bf = null;
        Object.keys(d.tok).forEach(k => { if (d.tok[k].has(t)) { const w = FT_W[k] || 1; if (w > best) { best = w; bf = k; } fields.add(k); } });
        if (!best && t.length >= 6 && !/\d/.test(t)) { for (const dt of d.all) { if (dt.length >= 5 && Math.abs(dt.length - t.length) <= 1 && editDistance(dt, t) <= 1) { best = 0.6; Object.keys(d.tok).forEach(k => { if (d.tok[k].has(dt)) fields.add(k); }); break; } } }
        if (best) { hit++; score += idf * best; } else miss.push(t);
      });
      if (!hit) return;
      const cov = hit / q.length;
      if (opts.must && !opts.must.every(m => d.all.has(m))) return;
      if (cov < (opts.minCov || 0.6)) return;
      res.push({ d, score: score * (0.5 + cov), cov, fields: [...fields] });
    });
    return res.sort((a, b) => b.score - a.score);
  }
  function snippet(d, tokens) {
    for (const k of Object.keys(d.fields)) {
      const text = String(d.fields[k] || ''); if (!text) continue;
      for (const t of tokens) {
        if (!d.tok[k].has(t)) continue;
        const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/y$/, '(?:y|ies)') + '\\w*', 'i');
        const m = rx.exec(text); if (!m) { const rx2 = new RegExp(t.slice(0, Math.max(3, t.length - 1)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); const m2 = rx2.exec(text); if (!m2) continue; return { field: k, text: ctx(text, m2.index, m2[0].length) }; }
        return { field: k, text: ctx(text, m.index, m[0].length) };
      }
    }
    return null;
  }
  function ctx(text, at, len) {
    const a = Math.max(0, at - 70), b = Math.min(text.length, at + len + 90);
    return (a > 0 ? '\u2026' : '') + text.slice(a, at) + '**' + text.slice(at, at + len) + '**' + text.slice(at + len, b) + (b < text.length ? '\u2026' : '');
  }
  function ftAnswer(qn, opts) {
    opts = opts || {};
    const toks = ftTokens(qn); if (!toks.length) return null;
    const hits = ftSearch(toks, opts); if (!hits.length) return null;
    const recs = hits.filter(h => h.d.kind === 'proj' || h.d.kind === 'reg').slice(0, 6);
    const docs = hits.filter(h => h.d.kind === 'help' || h.d.kind === 'page').slice(0, 2);
    if (!recs.length && !docs.length) return null;
    const label = String(qn).replace(/\s+/g, ' ').trim().slice(0, 50);
    let h = P(recs.length ? 'Here is where \u201c' + label + '\u201d shows up on the map:' : 'Here is what the map\u2019s own text says about \u201c' + label + '\u201d:');
    if (recs.length) h += UL(recs.map(x => { const sn = snippet(x.d, toks); return '**' + x.d.title + '** (' + x.d.sub + ')' + (sn ? ' \u2014 ' + sn.field.toLowerCase() + ': ' + sn.text : ''); }).map(x => x.replace(/ \u2014 /, ', ')));
    if (docs.length) h += UL(docs.map(x => { const sn = snippet(x.d, toks); return '**' + x.d.title + ':** ' + (sn ? sn.text : String(x.d.fields.Text).slice(0, 160)); }));
    const items = recs.map(x => x.d.kind === 'proj' ? projItem(x.d.i) : regItem(x.d.i));
    return R(h + '<div class="ask-actions">' + (items.length ? mapBtn(items, 'Matches for ' + label) : '') + (docs.some(x => x.d.kind === 'help') ? '<a class="ask-act" href="' + HELP_PAGE + '" style="text-decoration:none">Open the full guide</a>' : '') + '</div>', recs.length && recs[0].d.kind === 'proj' ? ['Tell me about ' + recs[0].d.title] : []);
  }
  function distinctiveHook(qn, hasNamed) {
    if (hasNamed) return null;
    const F = ft();
    const toks = ftTokens(qn);
    const V = vocab();
    const dist = toks.filter(t => F.df[t] && F.df[t] <= 4 && !V.has(t) && !/^\d{1,2}$/.test(t));
    if (!dist.length) return null;
    const hits = ftSearch(toks, { must: dist.slice(0, 2), minCov: 0.5 });
    if (!hits.length) return null;
    return ftAnswer(qn, { must: dist.slice(0, 2), minCov: 0.5 });
  }
  function vocab() {
    if (FT.vocab) return FT.vocab;
    const v = new Set();
    FAQ.forEach(f => f.kw.split(' ').forEach(w => v.add(stemw(w))));
    GLOSS.forEach(g => g.t.forEach(t => norm(t).split(' ').forEach(w => v.add(stemw(w)))));
    'moratorium ordinance pending proposed rumored operating county city project data center capacity power total number biggest largest smallest oldest newest latest recent expire expiring ending soon source link size developer tenant utility tariff stage status zoning rule regulation restrict ban pause map color legend filter search share zoom update help question answer show list find tell about'.split(' ').forEach(w => v.add(stemw(w)));
    FT.vocab = v; return v;
  }

  // ----------------------------------------------------------- answer router
  function glossaryFor(qn) {
    const pre = /^(what('?s| is| are| does| do)?|define|meaning of|explain|what does .* (mean|stand for)|tell me about|who is|who are)\b/.test(qn) || /\b(mean|means|meaning|stand for|definition|define)\b/.test(qn);
    if (!pre) return null;
    const padded = ' ' + qn + ' ';
    const g = GLOSS.find(g => g.t.some(t => padded.indexOf(' ' + norm(t) + ' ') !== -1));
    return g || null;
  }
  function answerGloss(g) {
    let h = P(g.a);
    if (g.f) h += P(g.f());
    if (g.util && typeof g.util === 'string') { const n = (kb().util[g.util] || []).length; h += P('On the map, ' + plural(n, 'project') + ' mention it.'); }
    return R(h, [g.chip, g.util === 'ekpc' ? 'Which projects use EKPC?' : null]);
  }
  function faqScore(qn) {
    const qt = new Set(qTokens(qn).filter(t => !STOP.has(t)));
    let best = null, bs = 0;
    FAQ.forEach(f => { const kws = f.kw.split(' '); let s = 0; kws.forEach(k => { if (qt.has(k)) s += k.length > 4 ? 2 : 1; }); if (qn.indexOf(f.kw.split(' ').slice(0, 2).join(' ')) !== -1) s += 1; s = s ? s - kws.length * 0.01 : 0; if (s > bs) { bs = s; best = f; } });
    return { f: best, s: bs };
  }

  function routeCore(qRaw) {
    const q = String(qRaw || '').trim(); const qn = norm(q);
    if (!qn) return q ? suggestionsAnswer() : null;
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/.test(qn) && qn.split(' ').length <= 4) return R(P('Hello! Ask me about any project, county, city or rule on the map, or how the map works.'), ['What’s the big picture?', 'Which moratoria end soon?', 'How do I read the colors?']);
    if (/^(thanks|thank you|thx|great|awesome|perfect|nice|cool|ok|okay)\b/.test(qn) && qn.split(' ').length <= 5) return R(P('You’re welcome. Ask me anything else about the map.'), ['What’s the big picture?']);
    if (/^(bye|goodbye|see you)\b/.test(qn)) return R(P('Goodbye!'), []);

    // Verification counts, quick facts
    if (/\b(unverified|verified|confirmed|likely)\b/.test(qn) && /\bfacilit\w+|how many\b/.test(qn) && projects.some(p => p._facility)) {
      const c = { confirmed: 0, likely: 0, unverified: 0 }; projects.forEach(p => { if (p._facility && c[p.verification] != null) c[p.verification]++; });
      const un = projects.map((p, i) => ({ p, i })).filter(o => o.p._facility && o.p.verification === 'unverified');
      return R(P('Of the ' + (c.confirmed + c.likely + c.unverified) + ' commercial facilities, ' + c.confirmed + ' are confirmed, ' + c.likely + ' likely and ' + c.unverified + ' unverified.') + (un.length ? UL(un.map(o => o.p.name + ' (' + o.p.county + ' Co.)')) + '<div class="ask-actions">' + mapBtn(un.map(o => projItem(o.i)), 'Unverified facilities') + '</div>' : ''), ['What does unverified mean?']);
    }

    if (/\b(near me|my area|my town|my city|my county|close to me|where i live|my location|my community|my neighbou?rhood)\b/.test(qn) && /\b(data cent\w+|projects?|moratori\w+|rules?|regulat\w+|ordinances?|any|anything|is there|are there)\b/.test(qn) && !/\b(gray|grey|colou?r|zoom|share|print)\b/.test(qn) && !/\b(?!(?:my|your|our|the|a|this|that|any|every|each) )[a-z]+ county\b/.test(qn)) return answerNearMe();
    if (/\b(who (made|makes|built|builds|build|created|designed|developed|coded|programmed|wrote|runs|maintains|owns|is responsible for|is behind|did this|did the map|created this)|who (is|are) (the )?(creator|author|owner|designer|builder|maker|team|people) (of|behind) (this|the) (map|site|page|tool|website)|what is this (map|site|tool|page|website)|what is this for|about this map|who is behind this)\b/.test(qn) && !findEntities(q).projects.length && !/\byou\b/.test(qn) && !/\b(data cent\w+|projects?|facilit\w+|campus\w*|here|in kentucky)\b/.test(qn)) { const f0 = FAQ.find(x => x.id === 'purpose'); return R(f0.a().join(''), f0.chips); }
    // How-the-map-works questions (checked before data, unless a specific place or project is named)
    const ents = findEntities(q);
    const hasNamed = ents.projects.length || ents.counties.length || ents.cities.length || ents.devs.length;
    { if (qn.split(' ').length <= 4) { const dh = distinctiveHook(qn, hasNamed); if (dh) return dh; } }
    { const mi = metaIntents(qn); if (mi && !(hasNamed && !/^(help|what can i ask)/.test(qn) && !/\b(are you|do you|can you|you are|is this)\b/.test(qn))) return mi; }
    const uiWords = /\b(gray|grey|blank|uncolou?red|add (a )?(new )?(project|rule|moratorium|data center)|submit|legend|colou?rs?|squares?|stripes?|dots?|pins?|dashed|filters?|buttons?|toggle\w*|pills?|zoom\w*|layers?|transmission lines?|gas pipelines?|copy link|share|sharing|search bar|search box|mobile|phone|print|download|export|forms?|report (a )?problem|add (new )?information|help page|data last updated|how often|last updated|where does (the )?data|data source|what does .* (mean|show)|how do i|how can i|how to|check=1|accessib\w+|keyboard)\b/;
    if (/\bdifference between (a )?(moratori\w+) and (an? )?ordinance|moratori\w+ (vs|versus) ordinance|ordinance (vs|versus) moratori\w+/.test(qn)) return R(P('A **moratorium** is a temporary pause, usually for a set time while a local government writes rules. An **ordinance** is a permanent rule, such as zoning standards a data center must meet. Many places pass a moratorium first, then replace it with an ordinance.') + P('On the map, moratoria are blue and ordinances are teal.'), ['Which moratoria end soon?', 'Show me the ordinances']);
    if (!hasNamed) { const pr = answerProcess(qn); if (pr) return pr; }
    if (/\b(moratori\w+|ban|pause)\b/.test(qn) && /\b(expire[sd]?|expiry|expiring|expiration|ends?|ended|ending|over|runs? out|lapse[sd]?|finish\w*|after)\b/.test(qn) && /\b(what happens?|what happened|what do(es)?|what becomes|what about|happens? to|happen when|after|when (a|the|it) )/.test(qn) && !/\b(which|list|how many)\b/.test(qn)) {
      const soon = regulations.filter(isExpiringSoon).sort((a, b) => daysUntilExpiry(a) - daysUntilExpiry(b));
      const gone = (typeof droppedMoratoria !== 'undefined' ? droppedMoratoria : []);
      return R(P('When a moratorium passes its end date, it is taken off the map automatically. It stays in the tracking sheet, so staff keep the record.') + P('The map warns you before that happens: moratoria ending within 60 days get an \u201cExpires in X days\u201d tag in their popup, and the **Expiring soon** button shows them all.') + P('If a county extends the moratorium or replaces it with a permanent rule, staff update the entry and it stays on the map or comes back. A county that lets it lapse simply shows as having no rule.') + (soon.length ? P('Ending soon right now: ' + soon.slice(0, 4).map(r => (r.city && !isCountyLevel(r) ? r.city + ', ' : '') + r.county + ' (' + r.expiration + ')').join('; ') + '.') : '') + (gone.length ? P('Already removed: ' + gone.slice(0, 4).map(r => (r.city && !isCountyLevel(r) ? r.city + ', ' : '') + r.county + ' (ended ' + r.expiration + ')').join('; ') + '. If you know one was extended, use the Report a problem form.') : '') + '<div class="ask-actions">' + (soon.length ? mapBtn(soon.map(r => regItem(regulations.indexOf(r))), 'Moratoria ending soon') : '') + '</div>', ['Which moratoria end soon?', 'How do I report a problem?']);
    }
    const gl = glossaryFor(qn);
    if (gl && !hasNamed && !/\b(concerns?|risks?|problems?|issues?|impacts?|newest|oldest|latest|biggest|largest|smallest|first|most|best|worst|how many|which)\b/.test(qn)) { const ans = answerGloss(gl); return ans; }
    if (/\bexpiring soon\b/.test(qn) && /\b(show|mean|button|filter|what|does)\b/.test(qn)) { const f0 = FAQ.find(x => x.id === 'expiring'); return R(f0.a().join(''), ['Which moratoria end soon?']); }
    const faq = faqScore(qn);
    if ((uiWords.test(qn) && !hasNamed) || (faq.s >= 2.5 && !hasNamed && !/\b(projects?|moratori\w+|ordinances?|developers?|proposed|rumou?red)\b/.test(qn)) || /\b(what can you do|who are you|what are you|what do you know|are you (an )?(ai|bot|human)|help me)\b/.test(qn)) {
      const f = /\b(what can you do|who are you|what are you|what do you know|are you (an )?(ai|bot|human)|help me)\b/.test(qn) ? FAQ.find(x => x.id === 'assistant') : (faq.f || FAQ.find(x => x.id === 'assistant'));
      if (f) return R(f.a().join('') + '<p><a href="' + HELP_PAGE + '">Open the full guide</a></p>', f.chips);
    }

    { const si = smartIntents(qn, hasNamed); if (si) return si; }

    // Insights across the whole data set
    if (/\b(overview|summary|big picture|snapshot|at a glance|surprise me|something interesting|insights?|highlights?|what should i know|key (facts|takeaways)|state of|trends?|what('?s| is) going on)\b/.test(qn) && !hasNamed) return overview();
    if (/\b(where does (kentucky|ky|the state)|(kentucky|ky) (stand|stands|standing|overall|landscape|situation)|stand(s|ing)? (in|on) (kentucky|ky)|statewide|across (the state|kentucky)|how is (kentucky|ky|the state)|how many data cent\w+ (are )?(in|does) (kentucky|ky)|state of data cent\w+)\b/.test(qn) && !ents.counties.length && !ents.cities.length) return overview();
    if (/\b(conflicts?|despite|even though|blocked|overlap\w*|affected by|in (a )?(counties|places|areas) (with|under) (a )?(moratori\w+|ban|pause))\b/.test(qn) || /\b(proposed|rumou?red|planned)\b.*\b(counties|places|areas)\b.*\b(with|under)\b.*\b(moratori\w+|ban|pause)/.test(qn) || /\bprojects?\b.*\b(inside|under|in) (a )?moratori\w+/.test(qn)) return answerConflicts();
    if (/\b(gaps?|unprotected|uncovered|not covered|no (regulation|rules?|moratorium|ordinance)\b.*\b(proposed|rumou?red|project)|\b(proposed|rumou?red|project)\b.*\bno (regulation|rules?|moratorium|ordinance|protection))/.test(qn) || /\bwithout (a |any )?(regulation|rules?|moratorium)/.test(qn)) return answerGaps();
    if (/\b(connect\w*|relationships?|patterns?|links? between|in common|shared|same (developer|utility|tenant)|multiple counties|more than one (county|project))\b/.test(qn) && !hasNamed) return answerConnections();
    if (/\b(compare|versus|vs|difference between|differences between|which is bigger)\b/.test(qn)) {
      const a = []; ents.projects.slice(0, 2).forEach(o => a.push({ type: 'proj', i: o.i })); ents.counties.slice(0, 2).forEach(c => a.push({ type: 'county', name: c }));
      const two = a.filter(x => x.type === 'proj').length >= 2 ? a.filter(x => x.type === 'proj').slice(0, 2) : a.filter(x => x.type === 'county').length >= 2 ? a.filter(x => x.type === 'county').slice(0, 2) : null;
      if (two) return compareEntities(two[0].type === 'proj' ? { type: 'proj', i: two[0].i } : { type: 'county', name: two[0].name }, two[1].type === 'proj' ? { type: 'proj', i: two[1].i } : { type: 'county', name: two[1].name });
    }
    if (/\b(most|top|biggest|largest|leading|ranking|rank|longest)\b/.test(qn) && !/\b(concerns?|risks?|problems?|issues?|worries)\b/.test(qn)) {
      if (/\bdevelopers?\b|\bcompan(y|ies)\b|\bwho (is|are|has|have)\b/.test(qn)) return answerRanking('dev', qn);
      if (/\bcount(y|ies)\b/.test(qn) && !hasNamed) return answerRanking('county', qn);
      if (/\b(moratori\w+)\b/.test(qn) && /\blongest|most\b/.test(qn)) return answerRanking('moratorium', qn);
      if (/\b(projects?|campus\w*|data cent\w+|sites?)\b/.test(qn) || /\bbiggest|largest\b/.test(qn)) return answerRanking('size', qn);
    }
    if (/\b(total|combined|altogether|in all|sum|how much (power|capacity|energy)|gigawatts?|how many (mw|gw|megawatts))\b/.test(qn) && /\b(power|capacity|mw|gw|megawatt\w*|gigawatt\w*|energy|load)\b/.test(qn) && !hasNamed) return answerTotals();

    // Named entities
    const regWords = /\b(moratori\w+|ordinances?|rules?|regulat\w+|bans?|banned|pauses?|paused|halts?|freezes?|allowed|legal|restrictions?|zoning|ban on)\b/.test(qn);
    const projWords = /\b(project|projects|data cent\w+|campus|facility|facilities|proposed|rumou?red|operating)\b/.test(qn);
    const structured = /\b(ending|ends|expir\w*|over|under|more than|less than|above|below|at least|within|near|proposed|rumou?red|operating|this year|next year|how many)\b/.test(qn) || parseTimeWindow(qn);
    const geoOnly = ents.projects.length && ents.projects.every(o => qTokens(norm(projects[o.i].name)).every(t => STOP.has(t) || allCounties.some(c => norm(c).split(' ').includes(t)) || kb().cityNames.has(t)));
    if (geoOnly && regWords && (ents.counties.length || ents.cities.length)) ents.projects = [];
    if (ents.projects.length && !(ents.projects.length > 3)) {
      if (ents.projects.length === 1 || ents.projects[0].score >= 100) return answerProject(ents.projects[0].i, qn);
      const items = ents.projects.slice(0, 4).map(o => projItem(o.i));
      return R(P('That could be a few projects:') + UL(ents.projects.slice(0, 4).map(o => '**' + projects[o.i].name + '** (' + projects[o.i].county + ' Co., ' + projects[o.i].stage + ')')) + '<div class="ask-actions">' + mapBtn(items, 'Possible matches') + '</div>', ents.projects.slice(0, 3).map(o => 'Tell me about ' + projects[o.i].name));
    }
    if (ents.devs.length) return answerDeveloper(ents.devs[0]);
    if (ents.utils.length && !regWords) return answerUtility(ents.utils[0]);
    if (ents.tenants.length) return answerTenant(ents.tenants[0]);
    const place = ents.counties[0] ? { county: ents.counties[0] } : (ents.cities[0] && ents.cities[0].county ? { county: ents.cities[0].county.NAME || ents.cities[0].county, city: ents.cities[0].key } : null);
    if (place && regWords && !/\b(ending|expir\w*|this year|next year|over|under|more than|less than)\b/.test(qn)) return answerRegStatus(place);
    // Structured list questions ("proposed projects near Louisville", "moratoria ending this year")
    let nl = null; try { nl = answerQuestion(q.toLowerCase(), true); } catch (e) { nl = null; }
    if (nl && nl.items.length) {
      const rows = nl.items.slice(0, 8).map(o => o.kind === 'reg' ? '**' + describeReg(o.r) + '**' : '**' + o.p.name + '** (' + o.p.county + ' Co., ' + o.p.stage + (o.mw != null ? ', ' + fmtMW(o.mw) : '') + (o.dist != null ? ', ' + Math.round(o.dist) + ' mi' : '') + ')');
      return R(P(nl.summary.charAt(0).toUpperCase() + nl.summary.slice(1) + (nl.items.length > 8 ? ' (showing 8)' : '') + ':') + UL(rows) + (nl.note ? '<p class="ask-note">' + esc(nl.note) + '</p>' : '') + '<div class="ask-actions">' + mapBtn(nl.items, nl.title) + '</div>', nl.items[0].kind === 'proj' ? ['Tell me about ' + nl.items[0].p.name] : ['Which moratoria end soon?']);
    }
    if (nl && !nl.items.length && structured) return R(P(nl.summary) + (nl.note ? '<p class="ask-note">' + esc(nl.note) + '</p>' : ''), ['What’s the big picture?']);
    if (place && !regWords) { if (ents.cities[0] && !ents.counties[0]) { const a = answerCity(ents.cities[0]); if (a) return a; } return answerCounty(place.county); }
    if (ents.cities.length && ents.cities[0].county) { const a = answerCity(ents.cities[0]); if (a) return a; }
    if (/\b(expir\w*|ending soon|ends soon|about to end|running out|next to (expire|end))\b/.test(qn)) {
      const soon = regulations.map((r, i) => ({ r, i, d: daysUntilExpiry(r) })).filter(o => o.d !== null && o.d >= 0).sort((a, b) => a.d - b.d).slice(0, 5);
      if (soon.length) return R(P('Next moratoria to end:') + UL(soon.map(o => '**' + describeReg(o.r) + '**')) + '<div class="ask-actions">' + mapBtn(soon.map(o => regItem(o.i)), 'Moratoria ending soon') + '</div>', ['What happens when a moratorium expires?', 'Moratoria ending this year']);
    }
    if (/\b(what happens when|after (a )?moratorium|when (a )?moratorium (ends|expires))\b/.test(qn)) return R(P('When a moratorium ends, a county or city usually either lets it lapse, extends it, or replaces it with permanent rules (an ordinance). The map hides expired moratoria automatically but keeps them in the tracking sheet, and staff update the end date if one is extended.') + linkBlock(linksFor('news local'), 'To check for newer action'), ['Which moratoria end soon?']);

    // Follow-ups using the last topic ("who is the developer?", "show it on the map")
    const pron = (qn.split(' ').length <= 6 && /\b(it|its|that|there|this one|that one|they|their|them)\b/.test(qn)) || (qn.split(' ').length <= 4 && /^(when|how big|what size|show|sources?|tenant|developer|size|utility|nearby|more)\b/.test(qn));
    if (pron && state.ctx) {
      const c = state.ctx;
      if (/\b(show|map|where|zoom|locate)\b/.test(qn)) { if (c.type === 'project') { closePanel(true); selectProject(c.i); return R(P('Showing it on the map.'), []); } if (c.type === 'county') { closePanel(true); selectCounty(c.county); return R(P('Showing ' + c.county + ' County on the map.'), []); } }
      if (c.type === 'project') return answerProject(c.i, qn);
      if (c.type === 'county' && regWords) return answerRegStatus({ county: c.county });
      if (c.type === 'county') return answerCounty(c.county);
      if (c.type === 'dev') return answerDeveloper(c.key);
    }
    // Free-text retrieval over every record
    const off = linksFor(qn, 4);
    const s = off.length ? null : (ftAnswer(qn) || answerSearch(qn));
    if (s) return s;
    // Not on the map
    if (off.length) return R(P('That is not something the map tracks. It covers where projects are proposed or operating and which counties and cities have local rules. These sources cover ' + (OFFMAP.find(o => o.re.test(qn)) || { label: 'it' }).label + ':') + linkBlock(off, 'Outside sources'), ['What’s the big picture?', 'How do I read the colors?']);
    const dm = (typeof didYouMean === 'function') ? didYouMean(qn) : null;
    return R(P('I couldn’t find that on the map' + (dm ? '. Did you mean **' + dm.label + '**?' : '.') + ' I can look up a project, county, city, developer or rule, answer questions like “moratoria ending this year”, or explain how the map works.') + linkBlock([resById('mta'), resById('tracker'), resById('contact')], 'For anything beyond the map'), dm ? ['Tell me about ' + dm.label] : ['What’s the big picture?', 'Which moratoria end soon?', 'How do I read the colors?']);
  }

  // --------------------------------------------------------------------- UI
  let panel, btnEl, log, input, lastFocus;
  function css() {
    const s = document.createElement('style');
    s.textContent = `
#ask-btn{position:fixed;right:12px;bottom:3px;z-index:1250;display:flex;align-items:center;gap:7px;padding:6px 13px;border-radius:24px;border:2px solid #161616;background:#D4A017;color:#161616;font:700 14px/1 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.25)}
#ask-btn:hover{background:#e3b22c}#ask-btn:focus-visible,.ask-act:focus-visible,.ask-chip:focus-visible,#ask-close:focus-visible{outline:3px solid #161616;outline-offset:2px}
#ask-btn svg{width:18px;height:18px;flex:none}
#ask-panel{position:fixed;left:8px;right:8px;bottom:46px;z-index:1260;max-height:min(66vh,600px);display:none;flex-direction:column;background:#fff;color:#161616;border:2px solid #161616;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.35);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#ask-panel.open{display:flex}
@media(min-width:600px){#ask-panel{left:auto;right:12px;width:410px}}
@media(min-width:1000px){#ask-panel{right:272px;bottom:46px;max-height:min(66vh,560px)}}
.ask-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px;background:#4a4a4a;color:#fff}
.ask-head strong{font-size:15px}.ask-head span{display:block;font-size:12px;opacity:.9;font-weight:400}
#ask-close{background:none;border:0;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:6px}
#ask-log{position:relative;flex:1;overflow-y:auto;padding:10px 12px;background:#faf8f3}
.ask-msg{margin:0 0 10px;max-width:96%}.ask-msg.user{margin-left:auto;max-width:86%}
.ask-bubble{padding:8px 11px;border-radius:12px;border:1px solid #e2e0db;background:#fff;word-wrap:break-word;overflow-wrap:anywhere}
.ask-msg.user .ask-bubble{background:#f6ecc9;border-color:#e6cf86}
.ask-bubble p{margin:0 0 6px}.ask-bubble p:last-child{margin-bottom:0}.ask-bubble ul{margin:4px 0 6px;padding-left:18px}.ask-bubble li{margin:2px 0}
.ask-bubble a{color:#6b4f00;text-decoration:underline}
.ask-links{margin-top:6px;padding:6px 8px;background:#f4f1e8;border-radius:8px;font-size:13px}.ask-links ul{margin:3px 0 0}
.ask-sub{margin-top:6px}.ask-note{font-size:12px;color:#555}
.ask-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ask-act{background:#D4A017;color:#161616;border:1.5px solid #161616;border-radius:16px;padding:5px 11px;font:600 12.5px system-ui,sans-serif;cursor:pointer}
.ask-act:hover{background:#e3b22c}
.ask-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ask-chip{background:#fff;border:1.5px solid #8a8a8a;border-radius:16px;padding:5px 10px;font:12.5px system-ui,sans-serif;color:#161616;cursor:pointer}
.ask-chip:hover{border-color:#161616;background:#f6ecc9}
.ask-table{border-collapse:collapse;font-size:12.5px;width:100%}.ask-table th,.ask-table td{border:1px solid #e2e0db;padding:4px 6px;text-align:left;vertical-align:top}.ask-table thead th{background:#f4f1e8}
#ask-form{display:flex;gap:6px;padding:8px 10px;border-top:1px solid #e2e0db;background:#fff}
#ask-input{flex:1;min-width:0;padding:8px 10px;border:1.5px solid #8a8a8a;border-radius:18px;font:14px system-ui,sans-serif}
#ask-input:focus{outline:3px solid #D4A017;border-color:#161616}
#ask-send{background:#161616;color:#fff;border:0;border-radius:18px;padding:0 14px;font:600 13px system-ui,sans-serif;cursor:pointer}
.ask-foot{padding:0 12px 8px;font-size:11.5px;color:#555;background:#fff}
.ask-sr{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
@media(prefers-reduced-motion:reduce){#ask-btn{transition:none}}
`;
    document.head.appendChild(s);
  }
  function build() {
    css();
    btnEl = document.createElement('button');
    btnEl.id = 'ask-btn'; btnEl.type = 'button';
    btnEl.setAttribute('aria-haspopup', 'dialog'); btnEl.setAttribute('aria-expanded', 'false'); btnEl.setAttribute('aria-controls', 'ask-panel');
    btnEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h6M9 14h4"/></svg><span>Ask the map</span>';
    panel = document.createElement('div');
    panel.id = 'ask-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Ask the map'); panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = '<div class="ask-head"><div><strong>Ask the map</strong><span>Answers come from the data on this map</span></div><button type="button" id="ask-close" aria-label="Close chat">✕</button></div>' +
      '<div id="ask-log" role="log" aria-live="polite" aria-label="Conversation"></div>' +
      '<form id="ask-form" autocomplete="off"><label class="ask-sr" for="ask-input">Ask a question about the map</label><input id="ask-input" type="text" placeholder="Ask about a project, county, or rule" maxlength="300"><button id="ask-send" type="submit">Send</button></form>' +
      '<div class="ask-foot">Not legal advice. Check the sources on each entry.</div>';
    document.body.appendChild(panel); document.body.appendChild(btnEl);
    log = $('ask-log'); input = $('ask-input');
    btnEl.addEventListener('click', () => state.open ? closePanel() : openPanel());
    $('ask-close').addEventListener('click', () => closePanel());
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(); } });
    $('ask-form').addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
    log.addEventListener('click', e => {
      const a = e.target.closest('.ask-act'); if (a) { const fn = state.acts[parseInt(a.dataset.act, 10)]; if (fn) fn(); return; }
      const c = e.target.closest('.ask-chip'); if (c) ask(c.dataset.q);
    });
    greet();
    loadHelp();
  }
  function msg(kind, html) {
    const d = document.createElement('div'); d.className = 'ask-msg ' + kind;
    d.innerHTML = '<div class="ask-bubble">' + html + '</div>';
    log.appendChild(d);
    return d;
  }
  function greet() {
    const m = msg('bot', P('Hi! I know everything on this map: the projects, the local rules, and how the map works. You can also ask me about any term used on the map, like moratorium, TSR, tariff or hyperscale. Ask me anything, or try one of these.') + chipRow(['What’s the big picture?', 'Which moratoria end soon?', 'What does TSR mean?', 'How do I read the colors?']));
    return m;
  }

  // ------------------------------------------------ suggested follow-up questions
  const TOPIC_FOLLOW = [
    { re: /\b(expired?|expire[sd]?|expiry|expiring|extended|extension)\b/, c: ['Which moratoria end soon?', 'How does the map know when a moratorium expires?', 'How do I report a problem?'] },
    { re: /\b(submit|submission|form|suggest|report a problem|add (a )?(project|rule|information))\b/, c: ['How does data get added to the map?', 'How is the data verified?', 'Who can edit the map?'] },
    { re: /\b(how (does|do|is|are) .*(data|map|information)|where does the data|updated|verified|sources?)\b/, c: ['Where does the data come from?', 'How often is the map updated?', 'How solid is this data?'] },
    { re: /\b(colou?rs?|legend|shading|stripes?|amber|gray|grey|blue|teal|red)\b/, c: ['What does a dashed pin mean?', 'What does a square mean?', 'What does Expiring soon show?'] },
    { re: /\b(pins?|dots?|dashed|squares?|stage|rumou?red|operating)\b/, c: ['How are pins placed?', 'How is the stage decided?', 'How many projects are in each stage?'] },
    { re: /\b(filters?|buttons?|expiring soon|layers?|zoom)\b/, c: ['How do I share this view?', 'What are transmission lines?', 'How do I zoom?'] },
    { re: /\b(share|link|print|download)\b/, c: ['What does Expiring soon show?', 'How do I read the colors?', 'Who do I contact?'] },
    { re: /\b(tsr|transmission service|esa|electric service)\b/, c: ['What is a tariff?', 'What is EKPC?', 'Which projects use EKPC?'] },
    { re: /\b(tariff|ehlf|large.?load|ratepayers?|electric rates?)\b/, c: ['What is a TSR?', 'Which projects have a tariff?', 'What are the biggest concerns for ratepayers?'] },
    { re: /\b(ekpc|lg ?e|ku|kentucky power|big rivers|utility|utilities)\b/, c: ['Which projects have a tariff?', 'What is a TSR?', 'Which projects have no utility named?'] },
    { re: /\b(hyperscal\w*|mw|gw|megawatts?|gigawatts?|capacity|biggest|largest)\b/, c: ['Projects over 500 MW', 'What is the total capacity?', 'Which projects are the most likely to be built?'] },
    { re: /\b(moratori\w+|ordinances?|pending|ban|pause)\b/, c: ['What is the difference between a moratorium and an ordinance?', 'What happens to an expired moratorium?', 'Which counties have no regulation but a proposed project?'] },
    { re: /\b(developers?|terawulf|poe|powerhouse|riot|bluegrassnet|lumen)\b/, c: ['Who is the biggest developer?', 'What patterns do you see?', 'Which projects have no developer?'] },
    { re: /\b(tenants?|anthropic|meta|amazon|google|microsoft)\b/, c: ['Which projects have no tenant?', 'Who is the biggest developer?', 'What patterns do you see?'] },
    { re: /\b(region|eastern|western|central|northern|southern|east|west|north|south)\b/, c: ['Which regions are most active?', 'Which county is the most restrictive?', 'What is the big picture?'] },
    { re: /\b(risks?|concerns?|restrictive|gaps?|conflicts?|watch)\b/, c: ['Which proposed projects are in counties with a moratorium?', 'Which counties have no regulation but a proposed project?', 'Which moratoria end soon?'] }
  ];
  const BASE_FOLLOW = ['What’s the big picture?', 'Which moratoria end soon?', 'How do I read the colors?', 'How does data get added to the map?'];
  function followUps(q, r) {
    const qn = norm(q), out = [];
    const add = c => { if (c && !state.asked.has(norm(c)) && norm(c) !== qn && !out.includes(c)) out.push(c); };
    (r.chips || []).forEach(add);
    const c = r.ctx;
    if (c) {
      if (c.type === 'project' && projects[c.i]) {
        const p = projects[c.i];
        add('Who is the tenant of ' + p.name + '?'); add('What other projects are near ' + p.name + '?'); add('Is there a moratorium in ' + p.county + ' County?');
        if (p._k && p._k.devs[0]) add('What else does ' + kb().devLabel[p._k.devs[0]] + ' have?');
      } else if (c.type === 'county') {
        add('Which moratoria end soon?'); add('Compare ' + c.county + ' and ' + (c.county === 'Fayette' ? 'Jefferson' : 'Fayette')); add('Which counties have no regulation but a proposed project?');
      } else if (c.type === 'dev') {
        add('Which proposed projects are in counties with a moratorium?'); add('Who is the biggest developer?');
      } else if (c.type === 'util') {
        add('What is a tariff?'); add('Which projects have a tariff?');
      }
    }
    for (const t of TOPIC_FOLLOW) { if (t.re.test(qn)) t.c.forEach(add); if (out.length >= 5) break; }
    BASE_FOLLOW.forEach(add);
    return out.slice(0, 3);
  }


  // ------------------------------------------------ typo tolerance
  const BASE_WORDS = ('a about above across add added adding after again all also am an and any anyone anything are area aren around as ask asked at available back be because been before being below best between big biggest both build built but buy by call called can cannot capacity change changed check city close closest color colors colour colours come comes compare concern concerns confirmed contact could count counties county create created current currently data date dates day days decide did different do does doing done down download during each early east eastern edit either else email end ended ending ends enough even ever every everything example expire expired expires expiring explain fact far few file filter find first for form found from full get give given go going gone good got great had has have having help her here hers high him his how however if in include into is isn it its just keep kentucky kind know known large largest last late later latest least less let like likely limit list little local located location long look looking lot made make makes many map maps may maybe me mean means meaning might mile miles more most move much must my name named near nearby nearest need needs never new newest next no none not nothing now number of off often old oldest on once one only open or other our out over own page part pending people per permanent place places planned please point power powers project projects proposed propose put question questions quick rather read real really recent recently regarding remove removed report reported right rule rules run same say see seen send share show shown shows since site size small smallest so some someone something soon source sources south state states still stop such sure take tell than that the their them then there these they thing things this those through time to today too top total track tracking true try turn two under until up update updated updates upon us use used user using usual very via want wants was way we web well went were west what when where whether which while who whom whose why will with within without would year years yes yet you your moratorium moratoria ordinance ordinances operating rumored proposed pending developer developers tenant tenants utility utilities tariff tariffs hyperscale hyperscaler megawatt megawatts gigawatt gigawatts transmission substation pipeline pipelines zoning planning commission council fiscal court magistrate ratepayer ratepayers electricity water cooling noise tax taxes incentive incentives jobs investment billion million acres facility facilities campus verified unverified legend marker markers pin pins square squares stripe stripes dashed gray grey blue teal orange red green yellow purple layer layers toggle button buttons search zoom pan mobile phone print link links copy expiring soon restrict restricted restriction ban banned pause paused approve approved approval denied withdrawn extended extend extension lapse lapsed status stage stages timeline notes address completion expected capacity megawatts mw gw kv').split(/\s+/);
  const TYPO = { sig: '', words: new Map() };
  function typoVocab() {
    const sg = sig(); if (TYPO.sig === sg) return TYPO.words;
    const w = new Map(); const add = (t, n) => { t = String(t || '').toLowerCase(); if (t.length < 3) return; w.set(t, (w.get(t) || 0) + (n || 1)); };
    BASE_WORDS.forEach(t => add(t, 2));
    const feedText = txt => norm(String(txt == null ? '' : txt)).split(' ').forEach(t => { if (/^[a-z]+$/.test(t)) add(t, 1); });
    projects.forEach(p => ['name', 'city', 'county', 'address', 'developer', 'utility', 'tenant', 'tariff', 'pz', 'stage', 'notes'].forEach(k => feedText(p[k])));
    regulations.forEach(r => ['county', 'city', 'level', 'type', 'notes'].forEach(k => feedText(r[k])));
    (allCounties || []).forEach(feedText);
    try { Object.keys(cityToCounty || {}).forEach(feedText); } catch (e) {}
    FAQ.forEach(f => feedText(f.kw)); GLOSS.forEach(g => g.t.forEach(feedText));
    TYPO.words = w; TYPO.sig = sg; return w;
  }
  // Damerau-Levenshtein (counts a swap of two neighbouring letters as one edit), with early exit.
  function dlDist(a, b, max) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > max) return max + 1;
    let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= n; j++) {
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[n];
  }
  function bestWord(t, V) {
    const max = t.length >= 6 ? 2 : 1;
    let best = null, bd = 99, bn = -1;
    for (const [w, n] of V) {
      if (Math.abs(w.length - t.length) > max) continue;
      if (t.length <= 4 && w[0] !== t[0]) continue;
      const d = dlDist(t, w, max);
      if (d > max) continue;
      if (d < bd || (d === bd && n > bn)) { best = w; bd = d; bn = n; }
    }
    return best;
  }
  function correctTypos(qRaw) {
    const V = typoVocab();
    let text = String(qRaw || '').toLowerCase()
      .replace(/\bdata\s?cent(?:re|er)s?\b/g, m => /s$/.test(m) ? 'data centers' : 'data center')
      .replace(/\bdatacent\w*\b/g, 'data center');
    const toks = norm(text).split(' ').filter(Boolean);
    const out = []; let changed = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.length < 4 || /\d/.test(t) || V.has(t) || V.has(stemw(t)) || STOP.has(t)) { out.push(t); continue; }
      // two pieces run together or split apart
      const nx = toks[i + 1];
      if (nx && !V.has(nx) && V.has(t + nx)) { out.push(t + nx); i++; changed = true; continue; }
      const fx = bestWord(t, V);
      if (fx) { out.push(fx); changed = true; } else out.push(t);
    }
    return changed ? out.join(' ') : null;
  }
  const NOT_FOUND = /couldn.t find that on the map|not something the map tracks/i;
  function route(qRaw) {
    if (/^\s*(in )?(kentucky|ky)\s*(data cent\w+|projects?|moratori\w+|rules?)?\s*$/i.test(String(qRaw || ''))) return routeCore('what is the big picture');
    let fixed = null;
    try { fixed = correctTypos(qRaw); } catch (e) { fixed = null; }
    if (fixed && norm(fixed) !== norm(qRaw)) {
      const r = routeCore(fixed);
      if (r && !NOT_FOUND.test(r.html)) { r.html = '<p class="ask-note"><em>Showing results for “' + esc(fixed) + '”.</em></p>' + r.html; return r; }
    }
    if (fixed) { const g = glossaryFor(norm(fixed)); if (g) { const r = answerGloss(g); r.html = '<p class="ask-note"><em>Showing results for \u201c' + esc(fixed) + '\u201d.</em></p>' + r.html; return r; } }
    return routeCore(qRaw);
  }

  function ask(q) {
    openPanel();
    msg('user', esc(q));
    let r;
    try { r = route(q); } catch (e) { console.warn('Ask the map error', e); r = R(P('Sorry, something went wrong with that question. Try rephrasing it, or search the map directly.'), ['What’s the big picture?']); }
    if (!r) return;
    state.ctx = r.ctx || state.ctx;
    state.asked.add(norm(q));
    let fu = []; try { fu = followUps(q, r); } catch (e) { fu = r.chips || []; }
    const m = msg('bot', r.html + chipRow(fu));
    log.scrollTop = Math.max(0, m.offsetTop - 8);
  }
  function openPanel() { if (state.open) { input.focus(); return; } state.open = true; lastFocus = document.activeElement; panel.classList.add('open'); btnEl.setAttribute('aria-expanded', 'true'); setTimeout(() => input.focus(), 0); }
  function closePanel(keepFocus) { if (!state.open) return; state.open = false; panel.classList.remove('open'); btnEl.setAttribute('aria-expanded', 'false'); if (!keepFocus) btnEl.focus(); }

  window.askTheMap = { ask, route, correctTypos, findEntities, kb, open: openPanel, close: closePanel };
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  } catch (e) { console.warn('Ask the map could not start', e); }
})();
