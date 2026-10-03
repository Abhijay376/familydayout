/* Family Day Out planner. Rough, common-sense rules (owner decision 2 Oct 2026): age fit and weather come from the type
   of place, real facts (prices, hours, dogs, toilets, transport) are used where we have them. Data: plan/data/<suburb>.json
   rows = [id, name, category, km, mins, url, lat, lng, facts{}] (facts: free, dogs, fenced, toilet, pt, water, price, hours) */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const G = ["1-5", "5-10", "10-13", "13+"], GL = {"1-5": "1–5", "5-10": "5–10", "10-13": "10–13", "13+": "Teen"};
  const grp = a => a < 5 ? "1-5" : a < 10 ? "5-10" : a < 13 ? "10-13" : "13+";
  // [1-5, 5-10, 10-13, 13+] as g(reat) o(k) n(ot), with the reason a parent would give
  const FIT = {
    playground: ["ggon", "Made for little kids", "Great for climbing and swings", "Fine for a while, a bit young", "Play equipment is for younger kids"],
    park: ["oooo", "Room to run around", "Room to run and play", "Bring a ball or bikes", "Good for a kick of the footy"],
    skate_bmx_pump: ["nogg", "Too fast and busy for little ones", "OK on a scooter at quiet times", "Ramps and rails to learn on", "Bowls, ramps and rails"],
    pool_water_play: ["gggo", "Splash and shallow water", "Pools and slides", "Slides and swimming", "Fun for an hour or two"],
    beach: ["gggg", "Sand and shallow water", "Swimming and sandcastles", "Swimming and exploring", "Swim and hang out"],
    climbing: ["nogg", "Usually 5+ only", "Kids' walls, check the age limit", "Climbing and bouldering", "Bouldering and ropes"],
    cinema: ["oggg", "Short kids' films only", "Kids' films", "Family films", "New releases"],
    library: ["ggoo", "Books, rhyme time, story time", "Books and kids' area", "Books, games, quiet space", "Quiet study and books"],
    museum_gallery: ["oggo", "Short visit with little ones", "Hands-on things to see", "Plenty to see", "Good if they're interested"],
    zoo_farm_wildlife: ["gggo", "Animals and petting", "Animals and keeper talks", "Animals and walks", "Good if they like animals"],
    shopping_centre: ["oooo", "Food court and play area", "Food and shops", "Shops and food", "Shops, food, often a cinema"],
    trail_walk: ["oggo", "Short flat parts in a pram", "A walk with things to spot", "A proper walk", "A longer walk or run"],
    trail_bike: ["oggo", "Balance bike or child seat", "Off-road riding", "Longer rides", "Longer rides"]
  };
  function indoorFit(name) {
    const n = name.toLowerCase();
    if (/trampoline|bounce|jump|ninja/.test(n)) return ["oggg", "Toddler sessions only", "Trampolines and ninja course", "Trampolines and dodgeball", "Dodgeball and tricks"];
    if (/bowl|arcade|escape|laser|zone|games|timezone|holey/.test(n)) return ["nogg", "Too loud for little ones", "Bumper lanes and games", "Bowling, arcade, laser tag", "Bowling, laser tag, arcade"];
    return ["ggon", "Toddler zone and soft play", "Play frames and slides", "Often has a height limit", "Made for younger kids"];
  }
  const INDOOR = new Set(["indoor_play", "cinema", "library", "museum_gallery", "climbing", "shopping_centre"]);
  const FREE = new Set(["playground", "park", "beach", "library", "skate_bmx_pump", "trail_walk", "trail_bike"]);
  const LABEL = {playground: "Playground", park: "Park", skate_bmx_pump: "Skate park", pool_water_play: "Pool or water play", beach: "Beach",
    climbing: "Climbing", cinema: "Cinema", library: "Library", museum_gallery: "Museum or gallery", zoo_farm_wildlife: "Animals",
    shopping_centre: "Shopping centre", indoor_play: "Indoor play", trail_walk: "Walk", trail_bike: "Bike trail"};
  const TYPES = {all: "Anything", playground: "Playgrounds", park: "Parks", water: "Water", indoor: "Indoor", animals: "Animals",
    active: "Skate and climbing", trails: "Walks and bikes"};
  const inType = (c, t) => t === "all" || (t === "water" && (c === "pool_water_play" || c === "beach")) || (t === "indoor" && INDOOR.has(c) || t === "indoor" && c === "indoor_play")
    || (t === "animals" && c === "zoo_farm_wildlife") || (t === "active" && (c === "skate_bmx_pump" || c === "climbing")) || (t === "trails" && c.startsWith("trail")) || t === c;
  let kids = [{age: 3, like: "either"}, {age: 8, like: "outdoor"}, {age: 14, like: "indoor"}], rows = [], food = [], stretch = 0;

  const fitOf = p => p[2] === "indoor_play" ? indoorFit(p[1]) : (FIT[p[2]] || ["oooo", "", "", "", ""]);
  const isIndoor = p => INDOOR.has(p[2]) || p[2] === "indoor_play" || (p[2] === "pool_water_play" && /aquatic|leisure|centre|aqua/i.test(p[1]));
  function weather(p, wx) {
    const ind = isIndoor(p), water = p[2] === "pool_water_play" || p[2] === "beach";
    if (wx === "rain") return ind ? [true] : [false, "outdoors"];
    if (wx === "cold") return (p[2] === "beach" || (water && !ind)) ? [false, "cold for swimming"] : [true];
    if (wx === "hot") return (!ind && !water && p[2] !== "library") ? [true, "Hot day: go early, little shade likely, bring water"] : [true];
    return [true];
  }
  const cost = p => { const f = p[8] || {}; if (f.price != null) return f.price === "free" ? 0 : null; return (FREE.has(p[2]) || f.free || (p[2] === "pool_water_play" && /splash|water play/i.test(p[1]))) ? 0 : null; };

  function assess(p, list) {
    const f = fitOf(p), out = list.map(k => {
      const g = grp(k.age), i = G.indexOf(g); let v = {g: "great", o: "ok", n: "not"}[f[0][i]], why = f[i + 1];
      const miss = (k.like === "indoor" && !isIndoor(p)) || (k.like === "outdoor" && isIndoor(p));
      if (miss && v === "great") { v = "ok"; why += ` (likes ${k.like})`; }
      return {k, v, why, raw: f[0][i] === "g" ? 2 : f[0][i] === "o" ? 1 : 0};
    });
    const not = out.filter(x => x.v === "not").length, great = out.filter(x => x.v === "great").length;
    const tier = not === 0 && great >= list.length / 2 ? "top" : not < list.length / 2 ? "most" : null;
    return {p, out, tier, great, raw: out.reduce((s, x) => s + x.raw, 0), pts: out.reduce((s, x) => s + (x.v === "great" ? 2 : x.v === "ok" ? 1 : 0), 0)};
  }
  function q() {
    const v = n => ($(`input[name=${n}]:checked`) || {}).value;
    return {drive: +v("drive"), wx: v("wx"), type: v("type"), dog: $("#dog").checked, free: $("#free").checked, fenced: $("#fenced").checked,
      teen: v("mode") === "teen", pt: $("#travel").value === "pt", adults: +$("#adults").value, lunch: $("#lunch").value};
  }
  function search(Q, extra = 0) {
    let hidden = 0; const res = [];
    for (const p of rows) {
      if (p[4] > Q.drive + extra || !inType(p[2], Q.type)) continue;
      const f = p[8] || {}, [ok, note] = weather(p, Q.wx);
      if (p[2] === "park" && Q.type === "all" && !f.big) continue;   // small local reserves only show under Parks
      if (!ok) { hidden++; continue; }
      if (Q.dog && !(f.dogs === "allowed" || f.dogs === "on lead")) continue;
      if (Q.fenced && f.fenced !== "yes") continue;
      if (Q.free && cost(p) !== 0) continue;
      if (Q.teen && Q.pt && !(f.pt && f.pt[2] <= 15)) continue;
      const a = assess(p, Q.teen ? [{age: +$("#band").value, like: "either"}] : kids);
      if (!a.tier) continue;
      a.note = note; res.push(a);
    }
    return {all: res, top: res.filter(a => a.tier === "top"), most: res.filter(a => a.tier === "most"), hidden};
  }
  // Mix the list (owner, 2 Oct 2026): nearest first, but one of each kind of place per round, so a beach is followed by the
  // next closest playground, pool or park, not by every other beach. Same-kind places within 1.5 km of one already shown wait.
  function mix(list) {
    const by = {};
    list.sort((x, y) => (x.tier === "top" ? 0 : 1) - (y.tier === "top" ? 0 : 1) || y.pts - x.pts || x.p[4] - y.p[4]).forEach(a => (by[a.p[2]] = by[a.p[2]] || []).push(a));
    const out = [], used = [];
    while (Object.values(by).some(l => l.length)) {
      const round = [];
      for (const k in by) {
        const l = by[k]; if (!l.length) continue;
        let i = l.findIndex(a => !used.some(u => u.p[2] === a.p[2] && dist(u.p, a.p) < 1.5));
        if (i < 0) i = 0;
        round.push(l.splice(i, 1)[0]);
      }
      round.sort((x, y) => (x.tier === "top" ? 0 : 1) - (y.tier === "top" ? 0 : 1) || y.pts - x.pts || x.p[4] - y.p[4]).forEach(a => { out.push(a); used.push(a); });
    }
    return out;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const money = c => c === 0 ? "Free" : c == null ? "Check price" : "$" + c;
  function badges(p) {
    const f = p[8] || {}, b = [`<span>${LABEL[p[2]] || ""}</span>`, isIndoor(p) ? '<span class="rain">Fine in rain</span>' : '<span class="bad">Outdoors</span>'];
    if (f.fenced === "yes") b.push('<span class="ok">Fenced</span>');
    if (f.toilet != null && f.toilet <= 300) b.push('<span class="ok">Toilet nearby</span>');
    if (f.dogs === "allowed" || f.dogs === "on lead") b.push(`<span class="ok">Dogs ${f.dogs}</span>`);
    if (f.dogs === "not allowed") b.push('<span class="bad">No dogs</span>');
    if (f.pt) b.push(`<span class="rain">${esc(f.pt[1])} ${f.pt[2]} min walk</span>`);
    if (f.hours) b.push(`<span>Hours: ${esc(f.hours)}</span>`);
    return b.join("");
  }
  function card(a, Q) {
    const p = a.p, fits = a.out.map((x, i) => `<div class="fit"><b>${Q.teen ? "Your crew" : "Kid " + (kids.indexOf(x.k) + 1) + " (" + x.k.age + ")"}</b>
      <span class="v-${x.v}">${x.v === "not" ? "Not suitable" : x.v === "great" ? "Great" : "OK"}</span><span class="meta">${esc(x.why)}</span></div>`).join("");
    return `<article class="pcard ${a.tier}"><div class="phead"><div><h3><a href="${KDO.root}vic/${p[5]}/index.html">${esc(p[1])}</a></h3>
      <div class="meta">${p[3]} km · about ${p[4]} min drive${p[4] > Q.drive ? ' · <span class="further">A bit further</span>' : ""}</div></div>
      <div class="cost">${money(cost(p))}</div></div><div class="fitall ${a.tier}">${a.tier === "top" ? "Great for everyone" : "Works for most of the crew"}</div>${a.note ? `<div class="warnline">${esc(a.note)}</div>` : ""}
      <div class="icons">${badges(p)}</div><div class="fits">${fits}</div>${revLine(p)}<div class="btns"><button class="plan-btn" data-id="${p[0]}">Plan my day here</button><button class="ghost" type="button" data-rev="${p[0]}">Write a review</button></div></article>`;
  }
  function dist(a, b) { const r = Math.PI / 180, x = (b[7] - a[7]) * Math.cos((a[6] + b[6]) / 2 * r), y = b[6] - a[6]; return Math.round(Math.sqrt(x * x + y * y) * 111 * 10) / 10; }
  function render() {
    const Q = q(); document.body.dataset.mode = Q.teen ? "teen" : "family";
    if (!rows.length) { $("#results").innerHTML = '<div class="empty">Pick your suburb to see places.</div>'; return; }
    const r = search(Q, stretch), plans = dayPlans(Q);
    const who = Q.teen ? `${$("#friends").value} teens aged ${$("#band").selectedOptions[0].text}` : `kids aged ${kids.map(k => k.age).join(", ")}`;
    let h = `<p class="summary">${r.top.length + r.most.length} places for ${who}</p><p class="meta">Within ${Q.drive + stretch} min of ${esc($("#from").value)} on a ${{sunny: "sunny", hot: "hot", rain: "rainy", cold: "cold"}[Q.wx]} day. Ages and weather are a rough guide from the type of place.</p>`;
    const more = search(Q, stretch + 10), extra = more.top.length + more.most.length - r.top.length - r.most.length;
    if (extra > 0) h += `<div class="stretch">Drive 10 more minutes and you get ${extra} more place${extra > 1 ? "s" : ""}. <button type="button" class="ghost" id="more">Show them</button></div>`;
    if (r.hidden) h += `<p class="meta">${r.hidden} outdoor place${r.hidden > 1 ? "s" : ""} hidden because of the forecast.</p>`;
    // one clearly labelled paid spot above the free results, like a search results page (none booked = advertise slot)
    const ad = (window.KDO.spots || [])[0];
    h += `<article class="pcard adcard"><span class="adtag">Sponsored</span> ${ad ? `<a href="${esc(ad.url)}" rel="sponsored"><b>${esc(ad.name)}</b></a> <span class="meta">${esc(ad.text)}</span>`
      : `<a href="${KDO.root}list-your-venue/index.html"><b>Your family business here</b></a> <span class="meta">Show your venue to parents planning a day out.</span>`}</article>`;
    if (plans.length) h += `<h2 class="tierh">Day plans for your family</h2><div class="plans">${plans.map((pl, i) => planCard(pl, i, Q)).join("")}</div><h2 class="tierh">Or pick a place yourself</h2>`;
    // CLAUDE.md radius rule: km sections, nearest first; inside each, best fit first and a mix of kinds
    let shown = 0;
    for (const [lo, hi, lab] of [[0, 5, "Within 5 km"], [5, 10, "5–10 km"], [10, 20, "10–20 km"], [20, 999, "20 km and more"]]) {
      const band = mix(r.all.filter(a => a.p[3] >= lo && a.p[3] < hi)).slice(0, 12);
      if (!band.length) continue;
      h += `<h2 class="tierh">${lab}</h2>${band.map(a => card(a, Q)).join("")}`; shown += band.length;
    }
    if (!shown) h += '<div class="empty">Nothing matches yet. Try a longer drive, another type of outing, or untick dog, fenced or free.</div>';
    $("#results").innerHTML = h;
    $$(".plan-btn[data-id]").forEach(b => b.onclick = () => plan(rows.find(p => p[0] == b.dataset.id)));
    $$("[data-rev]").forEach(b => b.onclick = () => review(rows.find(p => p[0] == b.dataset.rev)));
    const m = $("#more"); if (m) m.onclick = () => { stretch += 10; render(); };
    $$("[data-plan]").forEach(b => b.onclick = () => { const pl = plans[+b.dataset.plan]; pl.type === "split" ? planSplit(pl) : plan(pl.a.p); });
  }
  const t = m => { const h = Math.floor(m / 60), mm = m % 60; return `${(h + 11) % 12 + 1}:${String(mm).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`; };
  const r5 = m => Math.round(m / 5) * 5;
  // ---- lunch: what the parent wants, and what suits the youngest kid (pizza or Asian is fine for a teen, less so for a 2-year-old)
  const CUI = {cafe: /cafe|coffee|bakery|breakfast/, pizza: /pizza|italian/, fish: /fish|seafood/, burger: /burger|chicken/,
    asian: /chinese|japanese|thai|vietnamese|sushi|asian|korean|malaysian|indian|noodle|dumpling/};
  const TODDLER_OK = /cafe|coffee|bakery|breakfast|fish|burger|chicken|sandwich|family/;
  const cuiName = c => !c ? "Café or restaurant" : /coffee|cafe/.test(c) ? "Café" : c.split(";")[0].replace(/_/g, " ").replace(/^./, x => x.toUpperCase());
  function lunchAt(points, Q) {
    if (Q.lunch === "picnic") return null;
    const youngest = Q.teen ? 15 : Math.min(...kids.map(k => k.age));
    const mid = [0, 0, 0, 0, 0, 0, points.reduce((a, p) => a + p[6], 0) / points.length, points.reduce((a, p) => a + p[7], 0) / points.length];
    const want = f => Q.lunch === "any" || (CUI[Q.lunch] && CUI[Q.lunch].test(f[4] || ""));
    const near = food.filter(want).map(f => ({f, d: dist(mid, [0, 0, 0, 0, 0, 0, f[2], f[3]]), ok: youngest >= 5 || TODDLER_OK.test(f[4] || "")}))
      .filter(x => x.d <= 4).sort((a, b) => (b.ok - a.ok) || a.d - b.d);
    const pick = near[0];
    if (!pick) return {none: true};
    pick.why = pick.ok ? (youngest < 5 ? "easy with little ones" : "suits the whole family")
      : `fine for the older kids; with a ${youngest}-year-old a café or fish and chips may be easier`;
    return pick;
  }
  const lunchLine = l => !l ? "Pack a picnic and eat at the park." : l.none ? "Nothing of that kind close by in our data, so pack a picnic."
    : `<a href="${KDO.root}vic/${l.f[5]}/index.html">${esc(l.f[1])}</a> (${esc(cuiName(l.f[4]))}), ${l.why}.`;
  // ---- day plans (owner, 2 Oct 2026): one place for everyone, or split up (little ones to a park, the teen to a skate park) and meet for lunch
  function groups(Q) {
    if (Q.teen || Q.adults < 2 || kids.length < 2) return null;
    const older = kids.filter(k => k.age >= 10), younger = kids.filter(k => k.age < 10);
    return older.length && younger.length ? {older, younger} : null;
  }
  function dayPlans(Q) {
    const ok = p => p[4] <= Q.drive + stretch && weather(p, Q.wx)[0] && (p[2] !== "park" || (p[8] || {}).big) && inType(p[2], Q.type);
    const pool = rows.filter(ok), plans = [], kinds = new Set();
    pool.map(p => assess(p, kids)).filter(a => a.great === kids.length || (a.tier === "top" && a.out.every(x => x.v !== "not")))
      .sort((x, y) => y.pts - x.pts || x.p[4] - y.p[4]).forEach(a => { if (plans.length < 2 && !kinds.has(a.p[2])) { kinds.add(a.p[2]); plans.push({type: "together", a, lunch: lunchAt([a.p], Q)}); } });
    const g = groups(Q);
    if (g) {
      // good for every kid in the group (no "not suitable"), best fit first, then nearest
      const best = list => pool.map(p => assess(p, list)).filter(a => a.out.every(x => x.v !== "not"))
        .sort((x, y) => y.pts - x.pts || y.raw - x.raw || x.p[4] - y.p[4]).slice(0, 25);
      const A = best(g.older), B = best(g.younger), pairs = [];
      for (const a of A) for (const b of B) {
        if (a.p[0] === b.p[0]) continue;
        const apart = dist(a.p, b.p); if (apart > 6) continue;
        pairs.push({a, b, apart, s: apart * 2 + (a.p[4] + b.p[4]) / 2});
      }
      pairs.sort((x, y) => x.s - y.s);
      const seen = new Set();
      for (const pr of pairs) {
        const key = pr.a.p[2] + "|" + pr.b.p[2]; if (seen.has(key)) continue;
        seen.add(key); plans.push({type: "split", ...pr, g, lunch: lunchAt([pr.a.p, pr.b.p], Q)});
        if (plans.filter(x => x.type === "split").length >= 2) break;
      }
    }
    return plans.slice(0, 4);
  }
  const names = l => l.map(k => `${k.age}-year-old`).join(" and ");
  function planCard(pl, i, Q) {
    if (pl.type === "together") {
      const p = pl.a.p;
      return `<article class="pcard dayplan top"><div class="who">Everyone together</div><h3><a href="${KDO.root}vic/${p[5]}/index.html">${esc(p[1])}</a></h3><p class="meta">${LABEL[p[2]]} · ${p[3]} km · about ${p[4]} min drive · ${money(cost(p))}</p>
        <ul class="tl"><li><b>Morning</b> ${esc(p[1])}: ${esc(pl.a.out.map(x => x.why).filter((v, j, a) => a.indexOf(v) === j).join("; "))}.</li>
        <li><b>Lunch</b> ${lunchLine(pl.lunch)}</li></ul><button class="plan-btn" type="button" data-plan="${i}">See the full day</button></article>`;
    }
    const ad = Q.adults - 1;
    return `<article class="pcard dayplan splitcard"><div class="who">Split up, then meet for lunch</div>
      <div class="two"><div class="half"><b>1 adult + the ${names(pl.g.older)}</b><h3><a href="${KDO.root}vic/${pl.a.p[5]}/index.html">${esc(pl.a.p[1])}</a></h3><p class="meta">${LABEL[pl.a.p[2]]} · ${pl.a.p[4]} min drive · ${money(cost(pl.a.p))}</p></div>
      <div class="half"><b>${ad} adult${ad > 1 ? "s" : ""} + the ${names(pl.g.younger)}</b><h3><a href="${KDO.root}vic/${pl.b.p[5]}/index.html">${esc(pl.b.p[1])}</a></h3><p class="meta">${LABEL[pl.b.p[2]]} · ${pl.b.p[4]} min drive · ${money(cost(pl.b.p))}</p></div></div>
      <p class="meta">The two places are about ${pl.apart} km apart.</p><ul class="tl"><li><b>Lunch together</b> ${lunchLine(pl.lunch)}</li></ul>
      <button class="plan-btn" type="button" data-plan="${i}">See the full day</button></article>`;
  }
  function bring(ps, Q) {
    const c = new Set(["Water bottles", "Snacks", "Wipes"]);
    if (kids.some(k => k.age < 4) && !Q.teen) c.add("Nappies and spare clothes");
    if (Q.wx === "rain") c.add("Raincoats"); if (Q.wx === "cold") c.add("Warm layers and beanies");
    if (Q.wx === "sunny" || Q.wx === "hot") { c.add("Sunscreen"); c.add("Hats"); }
    if (Q.dog) { c.add("Dog lead"); c.add("Poo bags"); }
    for (const p of ps) {
      if (p[2] === "pool_water_play" || p[2] === "beach") { c.add("Swimmers and towels"); c.add("Coins for lockers"); }
      if (p[2] === "skate_bmx_pump") c.add("Helmets and scooters or boards");
      if (p[2] === "trail_bike") c.add("Bikes and helmets");
      if (p[2] === "indoor_play") c.add("Socks for everyone");
      if (p[2] === "climbing") c.add("Comfy clothes");
    }
    if (kids.some(k => k.age >= 13) || Q.teen) c.add("Phone charger");
    return [...c];
  }
  function plan(p) {
    const Q = q(), leave = 570, arrive = r5(leave + p[4]), end = r5(arrive + (p[2] === "playground" ? 90 : 120)), l = lunchAt([p], Q);
    const back = !isIndoor(p) ? rows.filter(x => isIndoor(x) && x[0] !== p[0] && dist(p, x) <= 10).map(x => assess(x, kids)).filter(a => a.tier).sort((a, b) => b.pts - a.pts)[0] : null;
    const f = p[8] || {};
    dlg(`<h2>Your day at ${esc(p[1])}</h2><p class="meta">For ${Q.teen ? "your crew" : "kids aged " + kids.map(k => k.age).join(", ")}</p><h3>The plan</h3><ul class="tl">
      <li><b>${t(leave)}</b> Leave ${esc($("#from").value)}, about ${p[4]} min in the car${Q.teen && f.pt ? ` (or ${esc(f.pt[1])} to ${esc(f.pt[0])}, then a ${f.pt[2]} min walk)` : ""}.</li>
      <li><b>${t(arrive)}</b> Arrive at ${esc(p[1])}.</li>
      <li><b>${t(Math.max(end, 720))}</b> Lunch: ${lunchLine(l)}</li>
      <li><b>${t(Math.max(end, 720) + 60)}</b> ${kids.some(k => k.age < 3) && !Q.teen ? "Head home for the little one's nap." : "Head home, or add a park stop on the way."}</li></ul>
      ${back ? `<h3>If it rains</h3><p>Switch to <a href="${KDO.root}vic/${back.p[5]}/index.html">${esc(back.p[1])}</a>, about ${dist(p, back.p)} km away.</p>` : ""}
      <h3>What it costs</h3><p>${money(cost(p))}${cost(p) == null ? ": check the venue's website before you go." : ""}</p>
      <h3>What to bring</h3><ul class="carry">${bring([p], Q).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h3>Good to know</h3><p>${f.toilet != null ? `Nearest toilet about ${f.toilet} m away. ` : "No public toilet in our data nearby. "}${Q.teen ? "Check the venue's age rules for teens without an adult." : ""}</p>`);
  }
  function planSplit(pl) {
    const Q = q(), mk = (a, who) => `<div class="half"><b>${who}</b><ul class="tl"><li><b>${t(570)}</b> Leave ${esc($("#from").value)}, about ${a.p[4]} min drive.</li>
      <li><b>${t(r5(570 + a.p[4]))}</b> ${esc(a.p[1])}.</li><li><b>${t(745)}</b> Head to lunch.</li></ul></div>`;
    dlg(`<h2>Your split day</h2><p class="meta">Two cars, two outings, one lunch together.</p><div class="two">${mk(pl.a, "The " + names(pl.g.older))}${mk(pl.b, "The " + names(pl.g.younger))}</div>
      <h3>${t(765)} Lunch together</h3><p>${lunchLine(pl.lunch)}</p><h3>${t(855)} Afternoon</h3><p>${kids.some(k => k.age < 3) ? "Home for the little one's nap." : "Swap places, or head home."}</p>
      <h3>What it costs</h3><p>${esc(pl.a.p[1])}: ${money(cost(pl.a.p))}. ${esc(pl.b.p[1])}: ${money(cost(pl.b.p))}.</p>
      <h3>What to bring</h3><ul class="carry">${bring([pl.a.p, pl.b.p], Q).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`);
  }
  // ---- parents' reviews and ideas. Demo: kept in this browser only until the site has hosting (CLAUDE.md parked item).
  const store = {get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
                 set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }};
  function revLine(p) {
    const r = store.get("kdo-rev-" + p[0], []); if (!r.length) return "";
    const avg = (r.reduce((a, x) => a + x.stars, 0) / r.length).toFixed(1);
    return `<p class="meta">Parents' reviews: ${"★".repeat(Math.round(avg))} ${avg} from ${r.length}. Latest: "${esc(r[r.length - 1].text || "No comment")}"</p>`;
  }
  function review(p) {
    dlg(`<h2>Review ${esc(p[1])}</h2><p class="meta">Help other parents. Demo: saved in this browser only until the site goes live.</p>
      <form id="rf"><fieldset><legend>How was it?</legend><div class="seg">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" value="${n}" ${n === 4 ? "checked" : ""}><span>${"★".repeat(n)}</span></label>`).join("")}</div></fieldset>
      <fieldset><legend>Who loved it?</legend><div class="checks">${G.map(g => `<label><input type="checkbox" value="${g}"> ${GL[g]}</label>`).join("")}</div></fieldset>
      <label class="stack"><span class="meta">Tip for other parents</span><textarea id="rt" rows="3" maxlength="300"></textarea></label><button class="plan-btn">Save review</button></form>`);
    $("#rf").onsubmit = e => { e.preventDefault(); const r = store.get("kdo-rev-" + p[0], []);
      r.push({stars: +$("input[name=stars]:checked").value, ages: $$("#rf .checks input:checked").map(x => x.value), text: $("#rt").value.trim(), date: new Date().toISOString().slice(0, 10)});
      store.set("kdo-rev-" + p[0], r); $("#dlg").close(); render(); };
  }
  function renderIdeas() {
    const ideas = store.get("kdo-ideas", []).sort((a, b) => b.votes - a.votes);
    $("#ideas").innerHTML = ideas.length ? ideas.map((x, i) => `<article class="pcard"><div class="phead"><div><h3>${esc(x.title)}</h3><div class="meta">${esc(x.sub)}${x.ages ? " · ages " + esc(x.ages) : ""} · ${x.date}</div></div>
      <button class="ghost" type="button" data-vote="${x.id}">▲ ${x.votes}</button></div>${x.tip ? `<p>${esc(x.tip)}</p>` : ""}</article>`).join("")
      : '<div class="empty">No ideas yet. Share the day out that worked for your family, and other parents can vote for it.<br><span class="meta">Demo: ideas are saved in this browser only until the site goes live.</span></div>';
    $$("[data-vote]").forEach(b => b.onclick = () => { const all = store.get("kdo-ideas", []), it = all.find(x => x.id == b.dataset.vote); if (it) { it.votes++; store.set("kdo-ideas", all); renderIdeas(); } });
  }
  function dlg(html) { $("#dlgBody").innerHTML = '<button class="ghost close" id="x" type="button">Close</button>' + html; $("#dlg").showModal(); $("#x").onclick = () => $("#dlg").close(); }
  function renderKids() {
    $("#kids").innerHTML = kids.map((k, i) => `<div class="kid"><span class="tag">Kid ${i + 1}</span>
      <select data-i="${i}" data-f="age" aria-label="Kid ${i + 1} age">${Array.from({length: 17}, (_, a) => `<option value="${a + 1}" ${a + 1 === k.age ? "selected" : ""}>${a + 1} yr${a ? "s" : ""}</option>`).join("")}</select>
      <select data-i="${i}" data-f="like" aria-label="Kid ${i + 1} likes">${["either", "indoor", "outdoor"].map(o => `<option value="${o}" ${o === k.like ? "selected" : ""}>${o[0].toUpperCase() + o.slice(1)}</option>`).join("")}</select>
      <button type="button" class="ghost" data-rm="${i}" aria-label="Remove kid ${i + 1}" ${kids.length < 2 ? "disabled" : ""}>✕</button></div>`).join("");
  }
  async function load(slug) {
    try { const r = await fetch(`${KDO.data}${slug}.json`); const d = await r.json(); rows = d.p; food = d.f; } catch (e) { rows = []; food = []; }
    stretch = 0; render();
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("#type").innerHTML = Object.entries(TYPES).map(([v, l], i) => `<label><input type="radio" name="type" value="${v}" ${i ? "" : "checked"}><span>${l}</span></label>`).join("");
    renderKids();
    $("#kids").addEventListener("change", e => { const s = e.target; kids[+s.dataset.i][s.dataset.f] = s.dataset.f === "age" ? +s.value : s.value; renderKids(); render(); });
    $("#kids").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { kids.splice(+b.dataset.rm, 1); renderKids(); render(); } });
    $("#addKid").onclick = () => { if (kids.length < 6) { kids.push({age: 6, like: "either"}); renderKids(); render(); } };
    $("#f").addEventListener("change", e => { if (e.target.id === "from") load(e.target.selectedOptions[0].dataset.slug); else { stretch = 0; render(); } });
    load($("#from").selectedOptions[0].dataset.slug);
    $$(".apptabs [data-tab]").forEach(b => b.onclick = () => { const t = b.dataset.tab;
      $$(".apptabs [data-tab]").forEach(x => x.setAttribute("aria-selected", x === b)); $("#tab-plan").hidden = t !== "plan"; $("#tab-ideas").hidden = t !== "ideas"; if (t === "ideas") renderIdeas(); });
    $("#ideaForm").onsubmit = e => { e.preventDefault(); const all = store.get("kdo-ideas", []);
      all.push({id: Date.now(), title: $("#i-title").value.trim(), sub: $("#i-sub").value.trim(), ages: $("#i-ages").value.trim(), tip: $("#i-tip").value.trim(), votes: 0, date: new Date().toISOString().slice(0, 10)});
      store.set("kdo-ideas", all); e.target.reset(); renderIdeas(); };
  });
})();
