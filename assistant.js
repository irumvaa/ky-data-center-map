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
    { re: /\b(power plants?|generation|grid|pjm|capacity market|natural gas|solar|nuclear|wind)\b/, ids: ['eia', 'epic', 'ekpc'], label: 'the power grid and energy supply' },
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
  function sig() { return projects.length + '|' + regulations.length + '|' + ((document.getElementById('data-status') || {}).textContent || ''); }
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
      let score = 0;
      if (nn.length >= 4 && new RegExp('\\b' + nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(qn)) score = 100 + nn.length;
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
    { id: 'purpose', kw: 'what is this map purpose about who made built maintained mountain association energy team', a: () => [P('This map tracks data center projects and local data center rules (moratoria, ordinances and pending proposals) across Kentucky. The Mountain Association Energy Team maintains it using public filings, local news and the Kentucky Lantern.'), P('Everything on the map comes from a tracking spreadsheet that staff review before anything is published. Nothing here is legal advice, so check the source links on each entry.')], chips: ['How do I read the colors?', 'What’s the big picture?'] },
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
    { t: ['karst'], a: 'Karst is landscape with limestone caves and sinkholes. It is a concern for large construction, for example near Mammoth Cave in the Cave City area.' }
  ];

  // --------------------------------------------------------------- UI plumbing
  const state = { ctx: null, acts: [], open: false };
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
    if (m(/\b(who|developer|developing|developed|building|behind|owner|owns|company|builder)\b/) && !m(/\b(tenant|customer)\b/)) want.push('dev');
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
    return R(h, [g.chip, g.util === 'ekpc' ? 'Which projects use EKPC?' : null, 'How do I read the colors?']);
  }
  function faqScore(qn) {
    const qt = new Set(qTokens(qn).filter(t => !STOP.has(t) || t.length > 3));
    let best = null, bs = 0;
    FAQ.forEach(f => { const kws = f.kw.split(' '); let s = 0; kws.forEach(k => { if (qt.has(k)) s += k.length > 4 ? 2 : 1; }); if (qn.indexOf(f.kw.split(' ').slice(0, 2).join(' ')) !== -1) s += 1; if (s > bs) { bs = s; best = f; } });
    return { f: best, s: bs };
  }

  function route(qRaw) {
    const q = String(qRaw || '').trim(); const qn = norm(q);
    if (!qn) return null;
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/.test(qn) && qn.split(' ').length <= 4) return R(P('Hello! Ask me about any project, county, city or rule on the map, or how the map works.'), ['What’s the big picture?', 'Which moratoria end soon?', 'How do I read the colors?']);
    if (/^(thanks|thank you|thx|great|awesome|perfect|nice|cool|ok|okay)\b/.test(qn) && qn.split(' ').length <= 5) return R(P('You’re welcome. Ask me anything else about the map.'), ['What’s the big picture?']);
    if (/^(bye|goodbye|see you)\b/.test(qn)) return R(P('Goodbye!'), []);

    // Verification counts, quick facts
    if (/\b(unverified|verified|confirmed|likely)\b/.test(qn) && /\bfacilit\w+|how many\b/.test(qn) && projects.some(p => p._facility)) {
      const c = { confirmed: 0, likely: 0, unverified: 0 }; projects.forEach(p => { if (p._facility && c[p.verification] != null) c[p.verification]++; });
      const un = projects.map((p, i) => ({ p, i })).filter(o => o.p._facility && o.p.verification === 'unverified');
      return R(P('Of the ' + (c.confirmed + c.likely + c.unverified) + ' commercial facilities, ' + c.confirmed + ' are confirmed, ' + c.likely + ' likely and ' + c.unverified + ' unverified.') + (un.length ? UL(un.map(o => o.p.name + ' (' + o.p.county + ' Co.)')) + '<div class="ask-actions">' + mapBtn(un.map(o => projItem(o.i)), 'Unverified facilities') + '</div>' : ''), ['What does unverified mean?']);
    }

    // How-the-map-works questions (checked before data, unless a specific place or project is named)
    const ents = findEntities(q);
    const hasNamed = ents.projects.length || ents.counties.length || ents.cities.length || ents.devs.length;
    const uiWords = /\b(legend|colou?rs?|squares?|stripes?|dots?|pins?|dashed|filters?|buttons?|toggle\w*|pills?|zoom\w*|layers?|transmission lines?|gas pipelines?|copy link|share|sharing|search bar|search box|mobile|phone|print|download|export|forms?|report (a )?problem|add (new )?information|help page|data last updated|how often|last updated|where does (the )?data|data source|what does .* (mean|show)|how do i|how can i|how to|check=1|accessib\w+|keyboard)\b/;
    const gl = glossaryFor(qn);
    if (gl && !(ents.projects.length && !gl.t.includes('proposed'))) { const ans = answerGloss(gl); return ans; }
    const faq = faqScore(qn);
    if ((uiWords.test(qn) && !hasNamed) || (faq.s >= 4 && !hasNamed) || /\b(what can you do|who are you|what are you|what do you know|are you (an )?(ai|bot|human)|help me)\b/.test(qn)) {
      const f = /\b(what can you do|who are you|what are you|what do you know|are you (an )?(ai|bot|human)|help me)\b/.test(qn) ? FAQ.find(x => x.id === 'assistant') : (faq.f || FAQ.find(x => x.id === 'assistant'));
      if (f) return R(f.a().join('') + '<p><a href="' + HELP_PAGE + '">Open the full guide</a></p>', f.chips);
    }

    // Insights across the whole data set
    if (/\b(overview|summary|big picture|snapshot|at a glance|surprise me|something interesting|insights?|highlights?|what should i know|key (facts|takeaways)|state of|trends?|what('?s| is) going on)\b/.test(qn) && !hasNamed) return overview();
    if (/\b(conflicts?|despite|even though|blocked|overlap\w*|affected by|in (a )?(counties|places|areas) (with|under) (a )?(moratori\w+|ban|pause))\b/.test(qn) || /\b(proposed|rumou?red|planned)\b.*\b(counties|places|areas)\b.*\b(with|under)\b.*\b(moratori\w+|ban|pause)/.test(qn) || /\bprojects?\b.*\b(inside|under|in) (a )?moratori\w+/.test(qn)) return answerConflicts();
    if (/\b(gaps?|unprotected|uncovered|not covered|no (regulation|rules?|moratorium|ordinance)\b.*\b(proposed|rumou?red|project)|\b(proposed|rumou?red|project)\b.*\bno (regulation|rules?|moratorium|ordinance|protection))/.test(qn) || /\bwithout (a |any )?(regulation|rules?|moratorium)/.test(qn)) return answerGaps();
    if (/\b(connect\w*|relationships?|patterns?|links? between|in common|shared|same (developer|utility|tenant)|multiple counties|more than one (county|project))\b/.test(qn) && !hasNamed) return answerConnections();
    if (/\b(compare|versus|vs|difference between|differences between|which is bigger)\b/.test(qn)) {
      const a = []; ents.projects.slice(0, 2).forEach(o => a.push({ type: 'proj', i: o.i })); ents.counties.slice(0, 2).forEach(c => a.push({ type: 'county', name: c }));
      const two = a.filter(x => x.type === 'proj').length >= 2 ? a.filter(x => x.type === 'proj').slice(0, 2) : a.filter(x => x.type === 'county').length >= 2 ? a.filter(x => x.type === 'county').slice(0, 2) : null;
      if (two) return compareEntities(two[0].type === 'proj' ? { type: 'proj', i: two[0].i } : { type: 'county', name: two[0].name }, two[1].type === 'proj' ? { type: 'proj', i: two[1].i } : { type: 'county', name: two[1].name });
    }
    if (/\b(most|top|biggest|largest|leading|ranking|rank|longest)\b/.test(qn)) {
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
    const pron = /\b(it|its|that|there|this one|that one|they|their|them|here)\b/.test(qn) || /^(who|when|how big|what size|where|show|sources?|tenant|developer|size|utility|nearby|more)\b/.test(qn);
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
    const s = off.length ? null : answerSearch(qn);
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
#ask-btn{position:fixed;left:12px;bottom:48px;z-index:1250;display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:24px;border:2px solid #161616;background:#D4A017;color:#161616;font:700 14px/1 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.25)}
#ask-btn:hover{background:#e3b22c}#ask-btn:focus-visible,.ask-act:focus-visible,.ask-chip:focus-visible,#ask-close:focus-visible{outline:3px solid #161616;outline-offset:2px}
#ask-btn svg{width:18px;height:18px;flex:none}
@media(min-width:1000px){#ask-btn{left:304px}}
#ask-panel{position:fixed;left:8px;right:8px;bottom:96px;z-index:1260;max-height:min(66vh,600px);display:none;flex-direction:column;background:#fff;color:#161616;border:2px solid #161616;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.35);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#ask-panel.open{display:flex}
@media(min-width:600px){#ask-panel{right:auto;width:410px}}
@media(min-width:1000px){#ask-panel{left:304px;bottom:96px;max-height:min(62vh,560px)}}
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
  }
  function msg(kind, html) {
    const d = document.createElement('div'); d.className = 'ask-msg ' + kind;
    d.innerHTML = '<div class="ask-bubble">' + html + '</div>';
    log.appendChild(d);
    return d;
  }
  function greet() {
    const m = msg('bot', P('Hi! I know everything on this map: the projects, the local rules, and how the map works. Ask me anything, or try one of these.') + chipRow(['What’s the big picture?', 'Which moratoria end soon?', 'Which proposed projects are in counties with a moratorium?', 'How do I read the colors?']));
    return m;
  }
  function ask(q) {
    openPanel();
    msg('user', esc(q));
    let r;
    try { r = route(q); } catch (e) { console.warn('Ask the map error', e); r = R(P('Sorry, something went wrong with that question. Try rephrasing it, or search the map directly.'), ['What’s the big picture?']); }
    if (!r) return;
    state.ctx = r.ctx || state.ctx;
    const m = msg('bot', r.html + chipRow(r.chips));
    log.scrollTop = Math.max(0, m.offsetTop - 8);
  }
  function openPanel() { if (state.open) { input.focus(); return; } state.open = true; lastFocus = document.activeElement; panel.classList.add('open'); btnEl.setAttribute('aria-expanded', 'true'); setTimeout(() => input.focus(), 0); }
  function closePanel(keepFocus) { if (!state.open) return; state.open = false; panel.classList.remove('open'); btnEl.setAttribute('aria-expanded', 'false'); if (!keepFocus) btnEl.focus(); }

  window.askTheMap = { ask, route, findEntities, kb, open: openPanel, close: closePanel };
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  } catch (e) { console.warn('Ask the map could not start', e); }
})();
