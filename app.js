// ================================================================
// ルーター
// URL: index.html          → 一覧ビュー（従来通り）
// URL: index.html?id=xxx   → 曲詳細ビュー
// URL: index.html?id=xxx#call → 曲詳細ビュー、コールにスクロール
// ================================================================

// ----------------------------------------------------------------
// 共通ユーティリティ
// ----------------------------------------------------------------

function normalize(value) {
  return value.toString().toLowerCase().replace(/\s+/g, "");
}

function personUrl(name) {
  if (typeof personLinks !== "undefined" && personLinks[name]) {
    return personLinks[name];
  }
  return "";
}

function creatorId(name) {
  return `creator-${encodeURIComponent(name).replace(/%/g, "").toLowerCase()}`;
}

function songId(title) {
  return `song-${encodeURIComponent(title).replace(/%/g, "").toLowerCase()}`;
}

function songExists(title) {
  return songs.some((song) => song.title === title);
}

function renderSongJump(title, className = "song-jump") {
  const song = songs.find((s) => s.title === title);
  if (!song) return `<span class="${className} plain">${title}</span>`;
  return `<a class="${className}" href="?id=${song.id}" data-song-id="${song.id}">${title}</a>`;
}

function renderInternalCreatorLinks(names) {
  if (!names || !names.length) return "未登録";
  return names
    .map((name) => `<a class="person-link" href="#${creatorId(name)}" data-creator-name="${name}">${name}</a>`)
    .join(" / ");
}

// ----------------------------------------------------------------
// ルーター本体
// ----------------------------------------------------------------

function getRouteId() {
  return new URLSearchParams(location.search).get("id");
}

function getRouteRelease() {
  return new URLSearchParams(location.search).get("release");
}

function getRouteQuery() {
  return new URLSearchParams(location.search).get("q") || "";
}

function getRouteGroup() {
  const group = new URLSearchParams(location.search).get("group") || "all";
  const valid = new Set(["all", "love", "me", "joy", "allgroup"]);
  return valid.has(group) ? group : "all";
}

function getRouteView() {
  const view = new URLSearchParams(location.search).get("view") || "home";
  if (view === "songs") return "releases";
  const validViews = new Set(["home", "releases", "creators", "calls"]);
  return validViews.has(view) ? view : "home";
}

function buildNavState(extra = {}) {
  const params = new URLSearchParams(location.search);
  const currentView = getRouteView();
  return {
    appNav: true,
    fromUrl: `${location.pathname}${location.search}${location.hash || ""}`,
    fromView: params.get("view") || currentView,
    fromRelease: params.get("release") || "",
    ...extra,
  };
}

const INTERNAL_HISTORY_KEY = "ikonoijoy:internalHistoryStack";
const HISTORY_DEBUG = true;
const DEBUG_CALLS = false;
let listMainClickHandler = null;
let releaseDetailMainClickHandler = null;
let detailMainClickHandler = null;

function clearMainClickHandlers() {
  const mainEl = document.querySelector("main");
  if (!mainEl) return;
  if (listMainClickHandler) mainEl.removeEventListener("click", listMainClickHandler);
  if (releaseDetailMainClickHandler) mainEl.removeEventListener("click", releaseDetailMainClickHandler);
  if (detailMainClickHandler) mainEl.removeEventListener("click", detailMainClickHandler);
}

function currentInternalUrl() {
  return `${location.pathname}${location.search}${location.hash || ""}`;
}

function readInternalHistoryStack() {
  try {
    const raw = sessionStorage.getItem(INTERNAL_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInternalHistoryStack(stack) {
  sessionStorage.setItem(INTERNAL_HISTORY_KEY, JSON.stringify(stack.slice(-80)));
}

function recordInternalPreviousUrl(url) {
  if (!url) return;
  const stack = readInternalHistoryStack();
  if (stack[stack.length - 1] !== url) stack.push(url);
  writeInternalHistoryStack(stack);
  if (HISTORY_DEBUG) console.debug("[history record]", { pushed: url, size: stack.length });
}

function popPreviousInternalUrl() {
  const now = currentInternalUrl();
  const stack = readInternalHistoryStack();
  while (stack.length) {
    const candidate = stack.pop();
    if (!candidate || candidate === now) continue;
    writeInternalHistoryStack(stack);
    if (HISTORY_DEBUG) console.debug("[history pop]", { target: candidate, size: stack.length });
    return candidate;
  }
  writeInternalHistoryStack(stack);
  if (HISTORY_DEBUG) console.debug("[history pop]", { target: "", size: stack.length });
  return "";
}

function pushInternalRoute(url, stateExtra = {}, { recordPrevious = true } = {}) {
  const fromUrl = currentInternalUrl();
  if (recordPrevious) recordInternalPreviousUrl(fromUrl);
  if (HISTORY_DEBUG) console.debug("[history push]", { from: fromUrl, to: url, recordPrevious });
  history.pushState(buildNavState(stateExtra), "", url);
  dispatch();
}

function navigate(id) {
  const url = id ? `?id=${id}` : location.pathname;
  pushInternalRoute(url, { id });
}

function navigateView(view) {
  const params = new URLSearchParams();
  params.set("view", view);
  if (state.releaseQuery) params.set("q", state.releaseQuery);
  pushInternalRoute(`?${params.toString()}`, { view });
}

function navigateWithHash(id, hash) {
  const url = id ? `?id=${id}${hash ? "#" + hash : ""}` : location.pathname;
  pushInternalRoute(url, { id, hash });
}

function syncRouteScroll() {
  const id = getRouteId();
  const release = getRouteRelease();
  if (!(id || release)) return;
  if (id && location.hash === "#call") {
    requestAnimationFrame(() => {
      document.querySelector("#call")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function ensureHistoryState() {
  if (history.state) return;
  const params = new URLSearchParams(location.search);
  const initialState = buildNavState({
    id: params.get("id") || "",
    release: params.get("release") || "",
    view: params.get("view") || getRouteView(),
    hash: location.hash || "",
  });
  history.replaceState(initialState, "", `${location.pathname}${location.search}${location.hash || ""}`);
}

function dispatch() {
  const id = getRouteId();
  const release = getRouteRelease();
  if (id) {
    mountDetailView(id);
  } else if (release) {
    mountReleaseDetailView(release);
  } else {
    mountListView(getRouteView());
  }
  syncGlobalNav();
  syncRouteScroll();
}

window.addEventListener("popstate", dispatch);

// ----------------------------------------------------------------
// 一覧ビュー
// ----------------------------------------------------------------

const LIST_HTML = document.querySelector("main").innerHTML;

const state = {
  songQuery: "",
  releaseQuery: "",
  releaseGroupFilter: "all",
  creatorQuery: "",
  creatorRoleFilter: "main",
  creatorLimit: 8,
  callQuery: "",
  callGroupFilter: "all",
  callLevelFilter: "all",
  callBeginnerOnly: false,
  callMixOnly: false,
  page: "home",
};

function mountListView(page) {
  document.querySelector("main").innerHTML = LIST_HTML;
  clearMainClickHandlers();
  state.page = page;
  const q = getRouteQuery();
  const routeGroup = getRouteGroup();
  state.songQuery = q;
  state.releaseQuery = q;
  state.releaseGroupFilter = page === "releases" ? routeGroup : "all";
  state.creatorQuery = page === "creators" ? q : "";
  bindListEvents();
  renderReleases();
  renderCreators();
  renderMixes();
  renderListPage();
}

function songMatches(song) {
  const haystack = normalize(
    [song.title, groupLabels[song.group], ...song.composers, ...song.arrangers, ...(song.mixes || [])].join(" ")
  );
  const queryOk = !state.query || haystack.includes(normalize(state.query));
  const filterOk =
    state.filter === "all" ||
    song.group === state.filter ||
    (state.filter === "mix" && song.hasCall);
  return queryOk && filterOk;
}

function releaseKey(song) {
  if (!song.release?.title) return `${song.releaseGroup || song.group}:__unreleased`;
  return [song.releaseGroup || song.group, normalizeReleaseTitle(song.release.title)].join(":");
}

function releaseTitle(song) {
  return releaseDisplayTitle(song.release?.title || "") || "リリース未登録";
}

function releaseDate(song) {
  return song.release?.date || "";
}

function releaseMeta(song, count) {
  const parts = [];
  if (song.release?.date) parts.push(song.release.date);
  if (!song.release?.title) parts.push(groupLabels[song.releaseGroup || song.group]);
  parts.push(`${count}曲`);
  return parts.join(" / ");
}

function normalizeReleaseTitle(title) {
  if (!title) return "";
  const normalized = title
    .normalize("NFKC")
    .replace(/\s*\(Special Edition\)\s*/gi, "")
    .replace(/\s*<Special Edition>\s*/gi, "")
    .replace(/\s*［Special Edition］\s*/gi, "")
    .replace(/\s*Special Edition\s*/gi, "")
    .replace(/\s*CD\s*Only[^)）\]]*/gi, "")
    .replace(/\s*Type\s*[A-Z0-9\-]+/gi, "")
    .replace(/\s*通常盤/gi, "")
    .replace(/／/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\s*\/\s*/g, "／")
    .replace(/\s+/g, " ")
    .replace(/"サブリミナル"/g, "サブリミナル")
    .replace(/ナツマトぺ/g, "ナツマトペ")
    .trim();

  const releaseTitleAliasMap = {
    "全部、内緒。(Special Edition)": "全部、内緒。",
    "全部、内緒。 (Special Edition)": "全部、内緒。",
    "超特急 ≠ME行き Special Edition": "超特急 ≠ME行き",
    "CAMEO Special Edition": "CAMEO",
    "CAMEO (Special Edition)": "CAMEO",
    "青春\"サブリミナル\"": "青春サブリミナル",
    "青春“サブリミナル”": "青春サブリミナル",
    "ナツマトぺ": "ナツマトペ",
    "とくべチュ、して / 恋人以上、好き未満": "とくべチュ、して ／ 恋人以上、好き未満",
    "とくべチュ、して／恋人以上、好き未満": "とくべチュ、して ／ 恋人以上、好き未満",
  };

  return releaseTitleAliasMap[normalized] || normalized;
}

function releaseDisplayTitle(title) {
  const normalized = normalizeReleaseTitle(title);
  if (!normalized) return "";
  const displayAliasMap = {
    "青春サブリミナル": "青春\"サブリミナル\"",
  };
  return displayAliasMap[normalized] || normalized;
}

function makeSongCard(song) {
  const hasMix = song.hasCall;
  const release = releaseDisplayTitle(song.release?.title || "") || "リリース未登録";
  const releaseSub = song.release ? [song.release.date].filter(Boolean).join(" / ") : "";
  const cardClass = `song-card${hasMix ? " song-card--has-mix" : ""}`;
  const callRow = hasMix
    ? `<div class="song-call-row">
        <span class="call-presence">📣 コールあり (${song.callNotes.length})</span>
        <a class="call-direct-link" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">コールへ移動</a>
      </div>`
    : `<div class="song-call-row"><span class="call-presence call-presence--none">コール未登録</span></div>`;

  return `
    <article class="${cardClass}" id="${songId(song.title)}">
      <div class="song-top">
        <div>
          <a class="song-card-title-link" href="?id=${song.id}" data-song-id="${song.id}">
            <h3>${song.title}</h3>
          </a>
          <p class="song-release-title">${release}</p>
          ${releaseSub ? `<p class="song-release-meta">${releaseSub}</p>` : ""}
        </div>
        <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
      </div>
      ${callRow}
    </article>
  `;
}

function groupSongs(filtered) {
  const grouped = new Map();
  filtered.forEach((song) => {
    const key = state.view === "group" ? song.group : releaseKey(song);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(song);
  });
  const groupRank = { love: 0, me: 1, joy: 2, all: 3 };
  return [...grouped.values()].sort((a, b) => {
    if (state.view === "group") return groupRank[a[0].group] - groupRank[b[0].group];
    const dateA = a[0].release?.date || "0000.00.00";
    const dateB = b[0].release?.date || "0000.00.00";
    const dateSort = dateB.localeCompare(dateA);
    if (dateSort) return dateSort;
    return (groupRank[a[0].releaseGroup || a[0].group] - groupRank[b[0].releaseGroup || b[0].group]) || releaseTitle(a[0]).localeCompare(releaseTitle(b[0]), "ja");
  });
}

function renderSongs() {
  const songGrid = document.querySelector("#songGrid");
  const resultCount = document.querySelector("#resultCount");
  if (!songGrid) return;

  const filtered = songs.filter(songMatches);
  resultCount.textContent = `${filtered.length}件表示中`;

  if (!filtered.length) {
    songGrid.innerHTML = `<p class="empty">該当する楽曲がありません。</p>`;
    return;
  }

  songGrid.innerHTML = groupSongs(filtered)
    .map((group) => {
      const head = group[0];
      const title = state.view === "group" ? groupLabels[head.group] : releaseTitle(head);
      const meta = state.view === "group" ? `${group.length}曲` : releaseMeta(head, group.length);
      return `
        <details class="song-release" open>
          <summary>
            <span class="group-badge ${head.group}">${groupLabels[head.group]}</span>
            <strong>${title}</strong>
            <small>${meta}</small>
          </summary>
          <div class="song-release-grid">
            ${group.map(makeSongCard).join("")}
          </div>
        </details>
      `;
    })
    .join("");
}

function groupedReleases() {
  const releaseMap = new Map();
  const releaseSongIds = new Map();
  const releaseMetaByKey = new Map();

  songs.forEach((song) => {
    const title = song.release?.title || "";
    if (!title) return;
    const key = `${song.releaseGroup || song.group}:${normalizeReleaseTitle(title)}`;
    if (!releaseMetaByKey.has(key)) {
      releaseMetaByKey.set(key, {
        type: String(song.release?.type || "").toUpperCase(),
        date: song.release?.date || song.releaseDate || "",
      });
    }
  });

  const pushReleaseSong = (key, song) => {
    if (!releaseMap.has(key)) {
      releaseMap.set(key, []);
      releaseSongIds.set(key, new Set());
    }
    const ids = releaseSongIds.get(key);
    if (ids.has(song.id)) return;
    ids.add(song.id);
    releaseMap.get(key).push(song);
  };

  songs.forEach((song) => {
    const key = releaseKey(song);
    pushReleaseSong(key, song);

    const albumTitles = Array.isArray(song.albums) ? song.albums : [];
    albumTitles.forEach((albumTitle) => {
      const normalized = normalizeReleaseTitle(albumTitle || "");
      if (!normalized) return;
      const releaseGroup = song.releaseGroup || song.group;
      const albumKey = `${releaseGroup}:${normalized}`;
      if (albumKey === key) return;
      const releaseMeta = releaseMetaByKey.get(albumKey);
      const albumSong = {
        ...song,
        releaseTitle: albumTitle,
        releaseType: "ALBUM",
        release: {
          ...(song.release || {}),
          title: albumTitle,
          type: "ALBUM",
          date: releaseMeta?.date || song.release?.date || song.releaseDate || "",
        },
        releaseGroup,
      };
      pushReleaseSong(albumKey, albumSong);
    });

    const includedInReleases = Array.isArray(song.includedIn) ? song.includedIn : [];
    includedInReleases.forEach((entry) => {
      const includedTitle = typeof entry === "string" ? entry : entry?.title;
      const includedGroup = typeof entry === "string" ? (song.releaseGroup || song.group) : (entry?.group || song.releaseGroup || song.group);
      const normalized = normalizeReleaseTitle(includedTitle || "");
      if (!normalized) return;
      const includedKey = `${includedGroup}:${normalized}`;
      if (includedKey === key) return;
      const releaseMeta = releaseMetaByKey.get(includedKey);
      const includedSong = {
        ...song,
        releaseTitle: includedTitle,
        releaseType: releaseMeta?.type || "SINGLE",
        release: {
          ...(song.release || {}),
          title: includedTitle,
          type: releaseMeta?.type || "SINGLE",
          date: releaseMeta?.date || song.release?.date || song.releaseDate || "",
        },
        releaseGroup: includedGroup,
      };
      pushReleaseSong(includedKey, includedSong);
    });
  });

  const groupRank = { love: 0, me: 1, joy: 2, all: 3 };
  return [...releaseMap.entries()]
    .map(([key, releaseSongs]) => ({ key, songs: releaseSongs }))
    .sort((a, b) => {
      const headA = a.songs[0];
      const headB = b.songs[0];
      const dateSort = releaseDate(headB).localeCompare(releaseDate(headA));
      if (dateSort) return dateSort;
      return (groupRank[headA.releaseGroup || headA.group] - groupRank[headB.releaseGroup || headB.group]) || releaseTitle(headA).localeCompare(releaseTitle(headB), "ja");
    });
}

function songTypeLabel(song) {
  if (song.songType === "solo") return `${song.performer || "ソロ"}ソロ`;
  if (song.songType === "all") return "全体曲";
  if (song.songType === "unit") return "ユニット曲";
  return "グループ曲";
}

function hasCallData(song) {
  const hasNotes = Array.isArray(song.callNotes) && song.callNotes.length > 0;
  const hasMixes = Array.isArray(song.mixes) && song.mixes.length > 0;
  const hasTextField = ["callText", "call", "callBody", "callMemo"]
    .some((key) => typeof song[key] === "string" && song[key].trim().length > 0);
  return song.hasCall === true || hasNotes || hasMixes || hasTextField;
}

const CALL_PATTERN_NORMALIZE_MAP = {
  "王道mix": "王道MIX",
  "王道ミックス": "王道MIX",
  "通常mix": "王道MIX",
  "スタンダードmix": "王道MIX",
  "standardmix": "王道MIX",
  "日本語mix": "日本語MIX",
  "日本語ミックス": "日本語MIX",
  "可変": "可変MIX",
  "可変mix": "可変MIX",
  "可変ミックス": "可変MIX",
  "ガチ恋": "ガチ恋口上",
  "ガチ恋mix": "ガチ恋口上",
  "ガチ恋口上": "ガチ恋口上",
  "クラップ": "クラップ",
  "手拍子": "クラップ",
};

function callPatternKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCallPatternName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = callPatternKey(raw);
  if (CALL_PATTERN_NORMALIZE_MAP[key]) return CALL_PATTERN_NORMALIZE_MAP[key];
  return raw
    .replace(/mix/gi, "MIX")
    .replace(/ミックス/g, "MIX")
    .trim();
}

function collectCallPatternLabels(song, { normalized = false } = {}) {
  const rawLabels = [
    ...(Array.isArray(song.mixes) ? song.mixes : []),
    ...(Array.isArray(song.callNotes) ? song.callNotes.map((note) => note?.name || "") : []),
  ]
    .map((label) => String(label || "").trim())
    .filter(Boolean);
  if (!normalized) return [...new Set(rawLabels)];
  return [...new Set(rawLabels.map((label) => normalizeCallPatternName(label)).filter(Boolean))];
}

function searchSongs(query, groupFilter = "all") {
  const normalized = normalize(query || "");
  const normalizedReleaseQuery = normalize(normalizeReleaseTitle(query || ""));
  return songs.filter((song) => {
    const groupOk = groupFilter === "all" || song.group === groupFilter || (groupFilter === "allgroup" && song.group === "all");
    if (!groupOk) return false;
    if (!normalized) return true;
    const haystack = normalize(
      [
        song.title,
        song.groupName,
        groupLabels[song.group],
        releaseDisplayTitle(song.release?.title || "") || "",
        normalizeReleaseTitle(song.release?.title || ""),
        ...(Array.isArray(song.albums) ? song.albums : []),
        ...(Array.isArray(song.searchAliases) ? song.searchAliases : []),
        song.performer || "",
        song.memberName || "",
        ...song.lyricists,
        ...song.composers,
        ...song.arrangers,
      ].join(" ")
    );
    return haystack.includes(normalized) || (normalizedReleaseQuery && haystack.includes(normalizedReleaseQuery));
  });
}

function renderSongSearchCards(targetId, countId, query, groupFilter = "all") {
  const container = document.querySelector(targetId);
  if (!container) return;
  const results = searchSongs(query, groupFilter);
  const count = document.querySelector(countId);
  if (count) count.textContent = `表示中 ${results.length}曲`;

  if (!results.length) {
    container.innerHTML = `<p class="empty">該当する楽曲がありません。</p>`;
    return;
  }

  container.innerHTML = results
    .sort((a, b) => (b.release?.date || "").localeCompare(a.release?.date || "") || a.title.localeCompare(b.title, "ja"))
    .map((song) => `
      <article class="song-search-card">
        <div class="song-search-top">
          <a class="song-card-title-link" href="?id=${song.id}" data-song-id="${song.id}"><h3>${song.title}</h3></a>
          <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
        </div>
        <p class="song-search-meta">${releaseDisplayTitle(song.release?.title || song.releaseTitle || "") || "作品未登録"} / ${song.release?.date || song.releaseDate || "日付未登録"}</p>
        <div class="song-search-badges">
          <span class="tag">${song.songType === "all" ? "イコノイジョイ" : songTypeLabel(song)}</span>
          ${song.performer && song.songType !== "solo" && song.songType !== "all" ? `<span class="tag">${song.performer}</span>` : ""}
          ${song.hasCall ? `<span class="tag">📣 コールあり</span>` : ""}
          ${song.hasCall ? `<a class="call-direct-link" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">コールへ移動</a>` : ""}
        </div>
      </article>
    `)
    .join("");
}

function searchCreatorCandidates(query, limit = 8) {
  const q = normalize(query || "");
  if (!q) return [];
  const creators = new Map();
  songs.forEach((song) => {
    [...song.lyricists, ...song.composers, ...song.arrangers].forEach((name) => {
      if (!name) return;
      if (!creators.has(name)) creators.set(name, { songs: new Set(), roleCounts: { 作詞: 0, 作曲: 0, 編曲: 0 } });
      const row = creators.get(name);
      row.songs.add(song.id);
      if (song.lyricists.includes(name)) row.roleCounts["作詞"] += 1;
      if (song.composers.includes(name)) row.roleCounts["作曲"] += 1;
      if (song.arrangers.includes(name)) row.roleCounts["編曲"] += 1;
    });
  });
  return [...creators.entries()]
    .map(([name, info]) => ({
      name,
      songCount: info.songs.size,
      mainRoles: Object.entries(info.roleCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([role]) => role),
    }))
    .filter((creator) => normalize(`${creator.name} ${creator.mainRoles.join(" ")}`).includes(q))
    .sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name, "ja"))
    .slice(0, limit);
}

function searchCallCandidates(query, groupFilter = "all", limit = 8) {
  const q = normalize(query || "");
  if (!q) return [];
  return songs
    .filter((song) => song.hasCall)
    .filter((song) => groupFilter === "all" || song.group === groupFilter)
    .filter((song) => {
      const hay = normalize(
        [
          song.title,
          groupLabels[song.group],
          song.performer || "",
          song.release?.title || "",
          ...song.mixes,
          ...song.callNotes.map((note) => note.name || ""),
          ...song.callNotes.map((note) => note.body || ""),
        ].join(" ")
      );
      return hay.includes(q);
    })
    .sort((a, b) => (b.release?.date || "").localeCompare(a.release?.date || "") || a.title.localeCompare(b.title, "ja"))
    .slice(0, limit);
}

function renderReleases() {
  const releaseGrid = document.querySelector("#releaseGrid");
  const releaseCount = document.querySelector("#releaseCount");
  if (!releaseGrid || !releaseCount) return;
  const songHead = document.querySelector("#releaseSongResultHead");
  const songGrid = document.querySelector("#songSearchGrid");
  const songSearchCount = document.querySelector("#songSearchCount");
  const creatorHead = document.querySelector("#releaseCreatorResultHead");
  const creatorGrid = document.querySelector("#releaseCreatorGrid");
  const creatorCount = document.querySelector("#releaseCreatorCount");
  const callHead = document.querySelector("#releaseCallResultHead");
  const callGrid = document.querySelector("#releaseCallGrid");
  const callCount = document.querySelector("#releaseCallCount");
  const releaseGroupState = document.querySelector("#releaseGroupState");
  const releaseGroupStateText = document.querySelector("#releaseGroupStateText");

  const hasSearch = state.releaseQuery.trim().length > 0;
  const query = normalize(state.releaseQuery);
  const normalizedReleaseQuery = normalize(normalizeReleaseTitle(state.releaseQuery));
  const homeSearchCount = document.querySelector("#homeSearchCount");
  if (homeSearchCount) {
    homeSearchCount.textContent = state.songQuery ? `横断検索: ${searchSongs(state.songQuery, "all").length}曲` : "";
  }
  if (hasSearch) {
    renderSongSearchCards("#songSearchGrid", "#songSearchCount", state.releaseQuery, state.releaseGroupFilter);
    const creatorCandidates = searchCreatorCandidates(state.releaseQuery, 8);
    if (creatorCount) creatorCount.textContent = `表示中 ${creatorCandidates.length}人`;
    if (creatorGrid) {
      creatorGrid.innerHTML = creatorCandidates.length
        ? creatorCandidates
            .map(
              (creator) => `
          <article class="creator-card">
            <div class="creator-card-head">
              <strong>${creator.name}</strong>
              <span class="creator-count">${creator.songCount}曲</span>
            </div>
            <p class="creator-role-meta">${creator.mainRoles.slice(0, 3).join(" / ") || "担当情報あり"}</p>
            <a class="creator-open" href="?view=creators&q=${encodeURIComponent(state.releaseQuery)}">クリエイター一覧で見る</a>
          </article>
        `
            )
            .join("")
        : `<p class="empty">該当するクリエイター候補がありません。</p>`;
    }

    const callCandidates = searchCallCandidates(state.releaseQuery, state.releaseGroupFilter, 8);
    if (callCount) callCount.textContent = `表示中 ${callCandidates.length}曲`;
    if (callGrid) {
      callGrid.innerHTML = callCandidates.length
        ? callCandidates
            .map(
              (song) => `
          <article class="call-index-card">
            <div class="call-index-top">
              <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
              <h3>${song.title}</h3>
            </div>
            <p class="call-index-meta">${releaseDisplayTitle(song.release?.title || "") || "作品未登録"}</p>
            <div class="tag-row">${song.callNotes.map((note) => `<span class="tag">${note.name}</span>`).join("")}</div>
            <a class="call-index-link" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">コールを見る</a>
          </article>
        `
            )
            .join("")
        : `<p class="empty">該当するコール候補がありません。</p>`;
    }
  } else {
    if (songGrid) songGrid.innerHTML = "";
    if (songSearchCount) songSearchCount.textContent = "";
    if (creatorGrid) creatorGrid.innerHTML = "";
    if (creatorCount) creatorCount.textContent = "";
    if (callGrid) callGrid.innerHTML = "";
    if (callCount) callCount.textContent = "";
  }
  const releases = groupedReleases().filter(({ songs: releaseSongs }) => {
    const head = releaseSongs[0];
    const groupOk =
      state.releaseGroupFilter === "all" ||
      (head.releaseGroup || head.group) === state.releaseGroupFilter ||
      (state.releaseGroupFilter === "allgroup" && (head.releaseGroup || head.group) === "all");
    if (!groupOk) return false;
    if (!query) return true;
    const haystack = normalize(
      [
        releaseTitle(head),
        head.release?.title || "",
        normalizeReleaseTitle(head.release?.title || ""),
        head.release?.type || "",
        head.release?.date || "",
        ...releaseSongs.map((s) => s.title),
      ].join(" ")
    );
    return haystack.includes(query) || (normalizedReleaseQuery && haystack.includes(normalizedReleaseQuery));
  });

  releaseCount.textContent = `${releases.length}作品`;
  if (releaseGroupState && releaseGroupStateText) {
    const grouped = state.releaseGroupFilter !== "all";
    releaseGroupState.hidden = !grouped;
    releaseGroupStateText.textContent = grouped ? `${groupLabels[state.releaseGroupFilter === "allgroup" ? "all" : state.releaseGroupFilter]}の作品` : "";
  }
  if (!releases.length) {
    releaseGrid.innerHTML = `<p class="empty">該当する作品がありません。</p>`;
  } else {
    const releaseTypeDisplay = (head) => {
      if (head.distribution === "youtube") return { label: "YOUTUBE", className: "youtube" };
      const type = String(head.release?.type || "").toUpperCase();
      if (type === "ALBUM") return { label: "ALBUM", className: "album" };
      return { label: "SINGLE", className: "single" };
    };

    const groupedByArtist = {
      love: releases.filter((r) => (r.songs[0].releaseGroup || r.songs[0].group) === "love"),
      me: releases.filter((r) => (r.songs[0].releaseGroup || r.songs[0].group) === "me"),
      joy: releases.filter((r) => (r.songs[0].releaseGroup || r.songs[0].group) === "joy"),
      all: releases.filter((r) => (r.songs[0].releaseGroup || r.songs[0].group) === "all"),
    };

    releaseGrid.innerHTML = Object.entries(groupedByArtist)
      .filter(([, list]) => list.length)
      .map(([group, list]) => `
        <section class="release-group-block">
          <header class="release-group-head">
            <h3>${groupLabels[group]}</h3>
            <p>${list.length}作品</p>
          </header>
          <div class="release-group-grid">
            ${list
              .map(({ key, songs: releaseSongs }) => {
                const head = releaseSongs[0];
                const releaseTypeMeta = releaseTypeDisplay(head);
                const releaseSongLimit = 5;
                const hasOverflow = releaseSongs.length > releaseSongLimit;
                const visibleSongs = hasOverflow
                  ? releaseSongs.slice(0, Math.max(1, releaseSongLimit - 1))
                  : releaseSongs.slice(0, releaseSongLimit);
                const hiddenCount = Math.max(0, releaseSongs.length - visibleSongs.length);
                return `
                  <article class="release-card release-card--${releaseTypeMeta.className}">
                    <div class="release-card-head">
                      <div>
                        <a class="release-title-link" href="?release=${encodeURIComponent(key)}" data-release-key="${encodeURIComponent(key)}"><h3>${releaseTitle(head)}</h3></a>
                        <p class="release-card-meta">
                          <span class="release-type ${releaseTypeMeta.className}">${releaseTypeMeta.label}</span>
                          <span>${head.release?.date || "日付未登録"}</span>
                        </p>
                      </div>
                      <span class="group-badge ${head.releaseGroup || head.group}">${groupLabels[head.releaseGroup || head.group]}</span>
                    </div>
                    <p class="release-card-count">${releaseSongs.length}曲収録</p>
                    <div class="release-song-list">
                      ${visibleSongs
                        .map((song) => `<a class="release-song-link" href="?id=${song.id}" data-song-id="${song.id}">${song.title}</a>`)
                        .join("")}
                      ${hiddenCount > 0 ? `<span class="release-song-more${releaseTypeMeta.className === "album" ? " album" : ""}">他${hiddenCount}曲</span>` : ""}
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `)
      .join("");
  }

  if (releaseGrid) releaseGrid.hidden = false;
  if (songHead) {
    songHead.hidden = !hasSearch;
    songHead.style.display = hasSearch ? "" : "none";
  }
  if (songGrid) {
    songGrid.hidden = !hasSearch;
    songGrid.style.display = hasSearch ? "" : "none";
  }
  if (creatorHead) {
    creatorHead.hidden = !hasSearch;
    creatorHead.style.display = hasSearch ? "" : "none";
  }
  if (creatorGrid) {
    creatorGrid.hidden = !hasSearch;
    creatorGrid.style.display = hasSearch ? "" : "none";
  }
  if (callHead) {
    callHead.hidden = !hasSearch;
    callHead.style.display = hasSearch ? "" : "none";
  }
  if (callGrid) {
    callGrid.hidden = !hasSearch;
    callGrid.style.display = hasSearch ? "" : "none";
  }
}

function renderCreators() {
  const creatorList = document.querySelector("#creatorList");
  if (!creatorList) return;

  const creators = new Map();
  songs.forEach((song) => {
    [...song.lyricists, ...song.composers, ...song.arrangers].forEach((name) => {
      if (!name) return;
      if (!creators.has(name)) {
        creators.set(name, {
          songs: new Set(),
          roleCounts: { 作詞: 0, 作曲: 0, 編曲: 0 },
          sampleSongs: [],
        });
      }
      const row = creators.get(name);
      row.songs.add(song.id);
      if (song.lyricists.includes(name)) row.roleCounts["作詞"] += 1;
      if (song.composers.includes(name)) row.roleCounts["作曲"] += 1;
      if (song.arrangers.includes(name)) row.roleCounts["編曲"] += 1;
      row.sampleSongs.push(song);
    });
  });

  const sorted = [...creators.entries()]
    .map(([name, info]) => {
      const mainRoles = Object.entries(info.roleCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([role]) => role);
      const representativeSongs = [...info.sampleSongs]
        .sort((a, b) => {
          const releaseTypeWeight = (song) => {
            const t = song.release?.type || "";
            if (t === "SINGLE") return 2;
            if (t === "ALBUM") return 1;
            return 0;
          };
          const typeSort = releaseTypeWeight(b) - releaseTypeWeight(a);
          if (typeSort) return typeSort;
          const dateSort = (b.release?.date || "").localeCompare(a.release?.date || "");
          if (dateSort) return dateSort;
          const callSort = Number(b.hasCall) - Number(a.hasCall);
          if (callSort) return callSort;
          return a.title.localeCompare(b.title, "ja");
        })
        .filter((song, index, arr) => arr.findIndex((s) => s.id === song.id || s.title === song.title) === index)
        .slice(0, 3);
      return { name, songCount: info.songs.size, mainRoles, representativeSongs };
    })
    .sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name, "ja"));

  const creatorCount = document.querySelector("#creatorCount");
  if (creatorCount) creatorCount.textContent = sorted.length;

  const MAIN_PRODUCER_NAME = "指原莉乃";
  const producerCreator = sorted.find((creator) => creator.name === MAIN_PRODUCER_NAME) || null;
  const creatorQuery = normalize(state.creatorQuery);
  let filtered = sorted.filter((creator) => {
    const queryOk =
      !creatorQuery ||
      normalize(`${creator.name} ${creator.mainRoles.join(" ")} ${creator.representativeSongs.map((s) => s.title).join(" ")}`).includes(creatorQuery);
    const roleOk = state.creatorRoleFilter === "main" || creator.mainRoles.includes(state.creatorRoleFilter);
    return queryOk && roleOk;
  });

  if (!filtered.length) {
    creatorList.innerHTML = `<p class="empty">該当するクリエイターが見つかりません。</p>`;
    return;
  }

  const INITIAL_CREATOR_LIMIT = 8;
  const rankingBase = sorted.filter((creator) => creator.name !== MAIN_PRODUCER_NAME);
  const topCountThreshold = rankingBase[Math.min(5, Math.max(rankingBase.length - 1, 0))]?.songCount ?? 0;
  const highlightThreshold = rankingBase[Math.min(11, Math.max(rankingBase.length - 1, 0))]?.songCount ?? 0;

  const renderCreatorCard = (creator, { producer = false } = {}) => {
    const mainRolesText = producer ? "" : creator.mainRoles.slice(0, 3).join(" / ");
    const highlightClass = producer
      ? "creator-card--producer"
      : creator.songCount >= topCountThreshold
      ? "creator-card--major"
      : creator.songCount >= highlightThreshold
      ? "creator-card--active"
      : "";

    return `
    <article class="creator-card ${highlightClass}" id="${creatorId(creator.name)}" data-creator-name="${creator.name}">
      <div class="creator-card-head">
        <strong>${personUrl(creator.name) ? `<a class="creator-link" href="${personUrl(creator.name)}" target="_blank" rel="noreferrer">${creator.name}</a>` : creator.name}</strong>
        <span class="creator-count">${creator.songCount}曲</span>
      </div>
      ${mainRolesText ? `<p class="creator-role-meta">${mainRolesText}</p>` : ""}
      ${
        producer
          ? ""
          : `<div class="creator-representative">
              ${creator.representativeSongs.map((song) => `<a class="creator-song-chip" href="?id=${song.id}" data-song-id="${song.id}">${song.title}</a>`).join("")}
            </div>`
      }
      <button class="creator-open" type="button" data-creator-name="${creator.name}">担当曲を開く</button>
    </article>
  `;
  };

  const producerBlock = producerCreator
    ? `<section class="creator-section creator-section--producer">
        <header class="creator-section-head"><h3>プロデューサー / メイン作詞者</h3></header>
        <div class="creator-grid">${renderCreatorCard(producerCreator, { producer: true })}</div>
      </section>`
    : "";
  const mode = state.creatorRoleFilter;
  const basePool = sorted.filter((creator) => creator.name !== MAIN_PRODUCER_NAME);
  const modePool = mode === "main" ? basePool : basePool.filter((creator) => creator.mainRoles.includes(mode));
  const filteredPool = modePool.filter((creator) => {
    if (!creatorQuery) return true;
    return normalize(`${creator.name} ${creator.mainRoles.join(" ")} ${creator.representativeSongs.map((s) => s.title).join(" ")}`).includes(creatorQuery);
  });
  const visible = filteredPool.slice(0, state.creatorLimit);
  const title = mode === "main" ? "主要クリエイター" : `${mode}`;
  const note =
    mode === "main"
      ? "担当曲数が多い順に表示しています。少ないクリエイターは、さらに表示・全件表示・検索で探せます。"
      : mode === "作詞"
      ? "指原莉乃はプロデューサー / メイン作詞者として上部に表示しています。"
      : "";

  creatorList.innerHTML = `
    ${producerBlock}
    <section class="creator-section">
      <header class="creator-section-head"><h3>${creatorQuery ? `検索結果（${title}）` : title}</h3><p>表示中 ${visible.length} / ${filteredPool.length}人</p></header>
      ${note ? `<p class="creator-note">${note}</p>` : ""}
      <div class="creator-grid">${visible.map((c) => renderCreatorCard(c)).join("")}</div>
    </section>
    ${
      filteredPool.length > visible.length
        ? `<div class="creator-more-row">
            <button class="creator-more" type="button" data-creator-more>さらに表示</button>
            <button class="creator-more" type="button" data-creator-all>全件表示</button>
          </div>`
        : filteredPool.length > INITIAL_CREATOR_LIMIT
        ? `<div class="creator-more-row"><button class="creator-more" type="button" data-creator-reset>表示を減らす</button></div>`
        : ""
    }
  `;
}

function renderMixes() {
  const callPatternList = document.querySelector("#callPatternList");
  const callBeginnerList = document.querySelector("#callBeginnerList");
  if (!callPatternList || !callBeginnerList) return;

  const songsWithCallData = songs.filter((song) => hasCallData(song));

  const callSongs = songsWithCallData
    .filter((song) => {
      const groupOk =
        state.callGroupFilter === "all" ||
        song.group === state.callGroupFilter ||
        (state.callGroupFilter === "allgroup" && song.group === "all");
      if (!groupOk) return false;
      const q = normalize(state.callQuery);
      if (!q) return true;
      const hay = normalize(
        [
          song.title,
          song.release?.title || "",
          groupLabels[song.group],
          song.performer || "",
          ...(Array.isArray(song.mixes) ? song.mixes : []),
          ...(Array.isArray(song.callNotes) ? song.callNotes.map((n) => n.name || "") : []),
          ...(Array.isArray(song.callNotes) ? song.callNotes.map((n) => n.body || "") : []),
          ...collectCallPatternLabels(song, { normalized: true }),
        ].join(" ")
      );
      if (!hay.includes(q)) return false;

      const levels = (Array.isArray(song.callNotes) ? song.callNotes : []).map((n) => n.level).filter(Boolean);
      if (state.callLevelFilter !== "all" && !levels.includes(state.callLevelFilter)) return false;
      if (state.callBeginnerOnly && !(levels.length > 0 && levels.every((lv) => lv !== "上級"))) return false;
      if (state.callMixOnly && !(Array.isArray(song.mixes) && song.mixes.length > 0)) return false;
      return true;
    })
    .sort((a, b) => {
      const groupRank = { love: 0, me: 1, joy: 2, all: 3 };
      return groupRank[a.group] - groupRank[b.group] || a.title.localeCompare(b.title, "ja");
    });

  const patternMap = new Map();
  callSongs.forEach((song) => {
    const labels = new Set(collectCallPatternLabels(song, { normalized: true }));
    if (labels.size === 0) labels.add("コール本文あり");
    labels.forEach((label) => {
      if (!patternMap.has(label)) patternMap.set(label, []);
      patternMap.get(label).push(song);
    });
  });

  const patternEntries = [...patternMap.entries()]
    .map(([label, list]) => ({
      label,
      songs: list.filter((song, idx, arr) => arr.findIndex((s) => s.id === song.id) === idx),
    }))
    .filter((item) => item.songs.length > 0)
    .sort((a, b) => b.songs.length - a.songs.length || a.label.localeCompare(b.label, "ja"));

  callPatternList.innerHTML = patternEntries.length
    ? patternEntries
      .map((item) => `
        <article class="call-pattern-card">
          <div class="call-pattern-head">
            <span class="tag">${item.label}</span>
            <span class="call-pattern-count">${item.songs.length}曲</span>
          </div>
          <div class="call-pattern-songs">
            ${item.songs.slice(0, 8).map((song) => `
              <a class="call-pattern-song" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">
                <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
                <span>${song.title}</span>
              </a>
            `).join("")}
            ${item.songs.length > 8 ? `<span class="call-pattern-more">ほか${item.songs.length - 8}曲</span>` : ""}
          </div>
        </article>
      `)
      .join("")
    : `<p class="empty">現在の条件に合うコール/MIX種別はありません。</p>`;

  const beginnerSongs = callSongs
    .filter((song) => {
      const levels = (Array.isArray(song.callNotes) ? song.callNotes : []).map((n) => n.level).filter(Boolean);
      return levels.length > 0 && levels.every((lv) => lv !== "上級");
    })
    .sort((a, b) => {
      const levelWeight = (song) => {
        const levels = (Array.isArray(song.callNotes) ? song.callNotes : []).map((n) => n.level).filter(Boolean);
        if (levels.includes("公式")) return 0;
        if (levels.includes("中級")) return 1;
        return 2;
      };
      const lw = levelWeight(a) - levelWeight(b);
      if (lw) return lw;
      return (b.release?.date || "").localeCompare(a.release?.date || "") || a.title.localeCompare(b.title, "ja");
    })
    .slice(0, 8);

  callBeginnerList.innerHTML = beginnerSongs.length
    ? beginnerSongs
      .map((song) => `
        <a class="call-beginner-song" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">
          <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
          <span>${song.title}</span>
        </a>
      `)
      .join("")
    : `<p class="empty">初心者向けとして表示できる曲はまだ少ないため、下の種別カードから探してください。</p>`;

  const mixCount = document.querySelector("#mixCount");
  if (mixCount) mixCount.textContent = callSongs.length;
  const callResultCount = document.querySelector("#callResultCount");
  if (callResultCount) callResultCount.textContent = `表示中 ${callSongs.length}曲`;

  const hasCallTrueCount = songs.filter((song) => song.hasCall === true).length;
  const callNotesCount = songs.filter((song) => Array.isArray(song.callNotes) && song.callNotes.length > 0).length;
  const mixesCount = songs.filter((song) => Array.isArray(song.mixes) && song.mixes.length > 0).length;
  const textCallCount = songs.filter((song) => ["callText", "call", "callBody", "callMemo"].some((key) => typeof song[key] === "string" && song[key].trim().length > 0)).length;

  const cardSongIds = new Set(patternEntries.flatMap((entry) => entry.songs.map((song) => song.id)));
  const leakedSongs = callSongs.filter((song) => !cardSongIds.has(song.id));
  if (DEBUG_CALLS) {
    const rawPatternSet = new Set(
      callSongs.flatMap((song) => collectCallPatternLabels(song, { normalized: false }))
    );
    const normalizedPatternSet = new Set(
      callSongs.flatMap((song) => collectCallPatternLabels(song, { normalized: true }))
    );
    const unnormalizedCandidates = [...rawPatternSet].filter(
      (raw) => normalizeCallPatternName(raw) === raw && !CALL_PATTERN_NORMALIZE_MAP[callPatternKey(raw)]
    );

    console.info("[calls coverage]", {
      hasCallTrueCount,
      callNotesCount,
      mixesCount,
      textCallCount,
      callTargetCount: songsWithCallData.length,
      displayedSongCount: callSongs.length,
      patternCount: patternEntries.length,
      leakedSongIds: leakedSongs.map((song) => song.id),
      rawPatternCount: rawPatternSet.size,
      normalizedPatternCount: normalizedPatternSet.size,
      unnormalizedCandidates,
    });
  }
}

function renderStats() {
  const el = document.querySelector("#songCount");
  if (el) el.textContent = songs.length;
}

// ---- ダイアログ ----

// MIXダイアログ廃止済み（曲詳細ページへ移行）

function songsForCreator(name) {
  return songs
    .filter((song) => song.lyricists.includes(name) || song.composers.includes(name) || song.arrangers.includes(name))
    .map((song) => ({
      ...song,
      roles: [
        ...(song.lyricists.includes(name) ? [{ label: "作詞", collaborative: song.lyricists.length > 1 }] : []),
        ...(song.composers.includes(name) ? [{ label: "作曲", collaborative: song.composers.length > 1 }] : []),
        ...(song.arrangers.includes(name) ? [{ label: "編曲", collaborative: song.arrangers.length > 1 }] : []),
      ],
    }));
}

function openCreatorDialog(name) {
  const creatorDialog = document.querySelector("#creatorDialog");
  if (!creatorDialog) return;
  const relatedSongs = songsForCreator(name);
  document.querySelector("#creatorDialogTitle").textContent = name;

  const wiki = personUrl(name);
  const wikiEl = document.querySelector("#creatorDialogWiki");
  if (wiki) {
    wikiEl.href = wiki;
    wikiEl.classList.remove("hidden");
  } else {
    wikiEl.classList.add("hidden");
  }

  document.querySelector("#creatorDialogSongs").innerHTML = relatedSongs
    .map(
      (song) => `
      <article class="creator-song-item">
        <div class="creator-song-title">
          <a class="creator-song-link" href="?id=${song.id}" data-song-id="${song.id}">${song.title}</a>
          <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
        </div>
        <div class="creator-role-row">
          ${song.roles
            .map(
              (role) => `
              <span class="role-pill ${role.collaborative ? "co-role" : ""}">${role.label}${role.collaborative ? "(共作)" : ""}</span>
            `
            )
            .join("")}
          ${song.hasCall ? `<a class="tag mix-tag" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">📣 コールを見る</a>` : ""}
        </div>
      </article>
    `
    )
    .join("");

  creatorDialog.classList.add("open");
  creatorDialog.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeCreatorDialog() {
  const creatorDialog = document.querySelector("#creatorDialog");
  if (!creatorDialog) return;
  creatorDialog.classList.remove("open");
  creatorDialog.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindListEvents() {
  state.creatorLimit = 8;

  const homeSongSearchInput = document.querySelector("#homeSongSearchInput");
  if (homeSongSearchInput) {
    homeSongSearchInput.value = state.songQuery;
    homeSongSearchInput.addEventListener("input", (event) => {
      state.songQuery = event.target.value;
      renderReleases();
    });
    homeSongSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        state.releaseQuery = state.songQuery;
        const q = encodeURIComponent(state.songQuery || "");
        pushInternalRoute(`?view=releases${q ? `&q=${q}` : ""}`, { view: "releases", q: state.songQuery });
      }
    });
  }

  const releaseSearchInput = document.querySelector("#releaseSearchInput");
  if (releaseSearchInput) {
    releaseSearchInput.value = state.releaseQuery || state.songQuery;
    releaseSearchInput.addEventListener("input", (event) => {
      state.releaseQuery = event.target.value;
      state.songQuery = event.target.value;
      const params = new URLSearchParams(location.search);
      params.set("view", "releases");
      if (state.releaseGroupFilter !== "all") params.set("group", state.releaseGroupFilter);
      else params.delete("group");
      if (state.releaseQuery) params.set("q", state.releaseQuery);
      else params.delete("q");
      history.replaceState({ view: "releases", q: state.releaseQuery }, "", `?${params.toString()}`);
      renderReleases();
    });
  }

  document.querySelectorAll("[data-release-group]").forEach((button) => {
    button.classList.toggle("active", button.dataset.releaseGroup === state.releaseGroupFilter);
  });

  document.querySelectorAll("[data-release-group]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-release-group]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.releaseGroupFilter = button.dataset.releaseGroup;
      const params = new URLSearchParams(location.search);
      params.set("view", "releases");
      if (state.releaseGroupFilter !== "all") params.set("group", state.releaseGroupFilter);
      else params.delete("group");
      if (state.releaseQuery) params.set("q", state.releaseQuery);
      else params.delete("q");
      pushInternalRoute(`?${params.toString()}`, { view: "releases", group: state.releaseGroupFilter, q: state.releaseQuery });
    });
  });

  const releaseGroupClear = document.querySelector("#releaseGroupClear");
  if (releaseGroupClear) {
    releaseGroupClear.addEventListener("click", () => {
      state.releaseGroupFilter = "all";
      document.querySelectorAll("[data-release-group]").forEach((item) => {
        item.classList.toggle("active", item.dataset.releaseGroup === "all");
      });
      const params = new URLSearchParams(location.search);
      params.set("view", "releases");
      params.delete("group");
      if (state.releaseQuery) params.set("q", state.releaseQuery);
      else params.delete("q");
      pushInternalRoute(`?${params.toString()}`, { view: "releases", group: "all", q: state.releaseQuery });
    });
  }

  const creatorSearchInput = document.querySelector("#creatorSearchInput");
  if (creatorSearchInput) {
    creatorSearchInput.value = state.creatorQuery;
    creatorSearchInput.addEventListener("input", (event) => {
      state.creatorQuery = event.target.value;
      state.creatorLimit = 8;
      renderCreators();
    });
  }

  document.querySelectorAll("[data-creator-role]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-creator-role]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.creatorRoleFilter = button.dataset.creatorRole;
      state.creatorLimit = 8;
      renderCreators();
    });
  });

  const callSearchInput = document.querySelector("#callSearchInput");
  if (callSearchInput) {
    callSearchInput.value = state.callQuery;
    callSearchInput.addEventListener("input", (event) => {
      state.callQuery = event.target.value;
      renderMixes();
    });
  }

  document.querySelectorAll("[data-call-group]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-call-group]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.callGroupFilter = button.dataset.callGroup;
      renderMixes();
    });
  });

  document.querySelectorAll("[data-call-level]").forEach((button) => {
    button.classList.toggle("active", button.dataset.callLevel === state.callLevelFilter);
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-call-level]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.callLevelFilter = button.dataset.callLevel;
      renderMixes();
    });
  });

  document.querySelectorAll("[data-call-beginner-only]").forEach((button) => {
    button.classList.toggle("active", state.callBeginnerOnly);
    button.addEventListener("click", () => {
      state.callBeginnerOnly = !state.callBeginnerOnly;
      button.classList.toggle("active", state.callBeginnerOnly);
      renderMixes();
    });
  });

  document.querySelectorAll("[data-call-mix-only]").forEach((button) => {
    button.classList.toggle("active", state.callMixOnly);
    button.addEventListener("click", () => {
      state.callMixOnly = !state.callMixOnly;
      button.classList.toggle("active", state.callMixOnly);
      renderMixes();
    });
  });

  const mainEl = document.querySelector("main");
  if (listMainClickHandler) mainEl.removeEventListener("click", listMainClickHandler);
  listMainClickHandler = (event) => {
    const viewLink = event.target.closest("a[data-view-link]");
    if (viewLink) {
      event.preventDefault();
      const targetUrl = new URL(viewLink.getAttribute("href"), location.href);
      const targetParams = targetUrl.searchParams;
      const hasExtraParams =
        targetParams.has("group") ||
        targetParams.has("q") ||
        targetParams.has("release") ||
        targetParams.has("id");
      if (hasExtraParams) {
        pushInternalRoute(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`, {});
      } else {
        navigateView(viewLink.dataset.viewLink);
      }
      return;
    }

    // 曲詳細へのナビゲーション（#call アンカー付きも対応）
    const songLink = event.target.closest("[data-song-id]");
    if (songLink) {
      event.preventDefault();
      closeCreatorDialog();
      const hash = songLink.dataset.hash || "";
      navigateWithHash(songLink.dataset.songId, hash);
      return;
    }

    // クリエイターリンク（外部URL）はそのまま通す
    if (event.target.closest(".creator-link")) return;

    const releaseLink = event.target.closest("[data-release-key]");
    if (releaseLink) {
      event.preventDefault();
      pushInternalRoute(`?release=${releaseLink.dataset.releaseKey}`, { release: releaseLink.dataset.releaseKey });
      return;
    }

    // クリエイターダイアログ
    const creatorButton = event.target.closest("[data-creator-name]");
    if (creatorButton) {
      openCreatorDialog(creatorButton.dataset.creatorName);
      return;
    }

    const moreButton = event.target.closest("[data-creator-more]");
    if (moreButton) {
      state.creatorLimit += 8;
      renderCreators();
      return;
    }

    const allButton = event.target.closest("[data-creator-all]");
    if (allButton) {
      state.creatorLimit = Number.MAX_SAFE_INTEGER;
      renderCreators();
      return;
    }

    const resetButton = event.target.closest("[data-creator-reset]");
    if (resetButton) {
      state.creatorLimit = 8;
      renderCreators();
      return;
    }

  };
  mainEl.addEventListener("click", listMainClickHandler);

  document.querySelectorAll("[data-close-dialog]").forEach((element) => {
    element.addEventListener("click", () => {
      closeCreatorDialog();
    });
  });

  document.addEventListener("keydown", handleKeydown);
}

function renderListPage() {
  const sections = ["home", "releases", "creators", "calls"];

  sections.forEach((id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.hidden = id !== state.page;
  });
  const hero = document.querySelector("#homeHero");
  if (hero) hero.hidden = state.page !== "home";
  const homeSearchCount = document.querySelector("#homeSearchCount");
  if (homeSearchCount && !state.songQuery) homeSearchCount.textContent = "";
}

function syncGlobalNav() {
  const id = getRouteId();
  const release = getRouteRelease();
  const activeView = id ? null : release ? "releases" : getRouteView();
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.classList.toggle("active", !id && link.dataset.viewLink === activeView);
  });
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeCreatorDialog();
  }
}

function mountReleaseDetailView(routeKey) {
  const decodedKey = decodeURIComponent(routeKey);
  let target = groupedReleases().find((item) => item.key === decodedKey);
  if (!target) {
    const legacyParts = decodedKey.split(":");
    if (legacyParts.length >= 2) {
      const legacyGroup = legacyParts[0];
      const legacyTitle = normalizeReleaseTitle(legacyParts[1] || "");
      target = groupedReleases().find((item) => {
        const [g, t] = item.key.split(":");
        return g === legacyGroup && t === legacyTitle;
      });
    } else {
      const legacyTitleOnly = normalizeReleaseTitle(decodedKey || "");
      target = groupedReleases().find((item) => {
        const [, t] = item.key.split(":");
        return t === legacyTitleOnly;
      });
    }
  }
  if (!target) {
    document.querySelector("main").innerHTML = `
      <div class="detail-not-found">
        <p>作品が見つかりませんでした。</p>
        <a href="?view=releases" class="back-link">← 作品一覧に戻る</a>
      </div>
    `;
    return;
  }

  const releaseSongs = [...target.songs].sort((a, b) => {
    const ad = Number.isFinite(a.discNumber) ? a.discNumber : Number.MAX_SAFE_INTEGER;
    const bd = Number.isFinite(b.discNumber) ? b.discNumber : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    const at = Number.isFinite(a.trackNumber) ? a.trackNumber : Number.MAX_SAFE_INTEGER;
    const bt = Number.isFinite(b.trackNumber) ? b.trackNumber : Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.title.localeCompare(b.title, "ja");
  });
  const head = releaseSongs[0];
  document.querySelector("main").innerHTML = `
    <div class="detail-view">
      <nav class="detail-nav">
        <a href="?view=releases" class="back-link" data-back-releases>← 作品一覧に戻る</a>
        <span class="detail-breadcrumb"><span class="group-badge ${head.releaseGroup || head.group}">${groupLabels[head.releaseGroup || head.group]}</span></span>
      </nav>
      <header class="detail-header">
        <div class="detail-release">
          <span class="release-meta">${[head.release?.type, head.release?.date].filter(Boolean).join(" / ") || "未登録"}</span>
        </div>
        <h1 class="detail-title">${releaseTitle(head)}</h1>
      </header>
      <section class="detail-release-songs">
        <h2>収録曲一覧</h2>
        <div class="creator-song-list">
          ${releaseSongs
            .map(
              (song) => `
            <article class="creator-song-item">
              <div class="creator-song-title">
                <a class="creator-song-link" href="?id=${song.id}" data-song-id="${song.id}">${Number.isFinite(song.trackNumber) ? `${song.trackNumber}. ` : ""}${song.title}</a>
                <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
              </div>
              <div class="creator-role-row">
                <span class="role-pill">作詞: ${song.lyricists?.join(" / ") || "未登録"}</span>
                <span class="role-pill">作曲: ${song.composers?.join(" / ") || "未登録"}</span>
                <span class="role-pill">編曲: ${song.arrangers?.join(" / ") || "未登録"}</span>
                ${song.hasCall ? `<a class="tag mix-tag" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">📣 コールあり</a>` : ""}
                <span class="tag">${song.songType === "all" ? "イコノイジョイ" : songTypeLabel(song)}</span>
              </div>
            </article>
          `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;

  clearMainClickHandlers();
  const mainEl = document.querySelector("main");
  if (releaseDetailMainClickHandler) mainEl.removeEventListener("click", releaseDetailMainClickHandler);
  releaseDetailMainClickHandler = (event) => {
    const songLink = event.target.closest("[data-song-id]");
    if (songLink) {
      event.preventDefault();
      const hash = songLink.dataset.hash || "";
      navigateWithHash(songLink.dataset.songId, hash);
      return;
    }
    if (event.target.closest("[data-back-releases]")) {
      event.preventDefault();
      navigateView("releases");
    }
  };
  mainEl.addEventListener("click", releaseDetailMainClickHandler);
}

// ----------------------------------------------------------------
// 曲詳細ビュー
// ----------------------------------------------------------------

function mountDetailView(id) {
  const song = songs.find((s) => s.id === id);
  if (!song) {
    document.querySelector("main").innerHTML = `
      <div class="detail-not-found">
        <p>曲が見つかりませんでした。</p>
        <a href="?" class="back-link">← 一覧に戻る</a>
      </div>
    `;
    return;
  }

  document.removeEventListener("keydown", handleKeydown);
  document.querySelector("main").innerHTML = renderDetailHTML(song);
  clearMainClickHandlers();
  bindDetailEvents(song);
}

function renderCallSection(song) {
  const mixes = song.callNotes
    .map((note) => {
      if (!note) return "";
      return `
        <div class="call-item">
          <div class="call-item-header">
            <h4 class="call-name">${note.name}</h4>
            <span class="call-level level-${note.level}">${note.level}</span>
          </div>
          ${note.body ? `<pre class="call-body">${escapeHtml(note.body)}</pre>` : ""}
          <a class="call-source-link" href="https://note.com/inoji_suki/n/ne8ecd516a2e0" target="_blank" rel="noreferrer">出典で全文を確認する →</a>
        </div>
      `;
    })
    .join("");

  return `
    <section class="call-section" id="call">
      <div class="call-section-header">
        <h2>📣 コール</h2>
        <a class="call-permalink" href="?id=${song.id}#call" title="このコールへの直リンクをコピー">🔗 リンクをコピー</a>
      </div>
      ${mixes}
    </section>
  `;
}

function renderDetailHTML(song) {
  const hasMix = song.hasCall;

  // 同じクリエイターが関わる他の曲（作曲・編曲どちらか）
  const RELATED_CREATOR_EXCLUDES = new Set(["指原莉乃"]);
  const sourceComposers = new Set(song.composers.filter((name) => !RELATED_CREATOR_EXCLUDES.has(name)));
  const sourceArrangers = new Set(song.arrangers.filter((name) => !RELATED_CREATOR_EXCLUDES.has(name)));
  const toEpochDay = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().replace(/\./g, "-");
    const time = Date.parse(normalized);
    if (Number.isNaN(time)) return null;
    return Math.floor(time / 86400000);
  };
  const sourceDay = toEpochDay(song.release?.date);
  const relatedInitialLimit = 8;
  const relatedStep = 6;
  const relatedSongs = songs
    .filter((s) => s.id !== song.id)
    .map((s) => {
      const composerMatchCount = s.composers.filter((name) => sourceComposers.has(name)).length;
      const arrangerMatchCount = s.arrangers.filter((name) => sourceArrangers.has(name)).length;
      if (!composerMatchCount && !arrangerMatchCount) return null;

      const hasBoth = composerMatchCount > 0 && arrangerMatchCount > 0;
      const targetDay = toEpochDay(s.release?.date);
      let nearReleaseScore = 0;
      if (sourceDay !== null && targetDay !== null) {
        const diffDays = Math.abs(sourceDay - targetDay);
        nearReleaseScore = Math.max(0, 80 - Math.floor(diffDays / 120));
      }

      const score = (composerMatchCount * 300)
        + (arrangerMatchCount * 220)
        + (hasBoth ? 180 : 0)
        + nearReleaseScore;

      return { song: s, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateSort = (b.song.release?.date || "").localeCompare(a.song.release?.date || "");
      if (dateSort) return dateSort;
      return a.song.title.localeCompare(b.song.title, "ja");
    })
    .map((item) => item.song);

  // 同リリースの収録曲
  const samRelease = song.release?.title
    ? songs.filter((s) => s.id !== song.id && releaseKey(s) === releaseKey(song))
    : [];
  const isSingleRelease = String(song.release?.type || "").toUpperCase() === "SINGLE";
  const isYoutubeOnly = song.distribution === "youtube";
  const releaseGroupKey = song.releaseGroup || song.group;
  const singleTitles = [
    ...(isSingleRelease && song.release?.title ? [{ title: song.release.title, group: releaseGroupKey }] : []),
    ...(Array.isArray(song.includedSingles) ? song.includedSingles : []),
  ]
    .map((entry) => {
      if (typeof entry === "string") return { title: entry.trim(), group: releaseGroupKey };
      const title = String(entry?.title || "").trim();
      const group = String(entry?.group || releaseGroupKey).trim();
      if (!title) return null;
      return { title, group };
    })
    .filter(Boolean)
    .filter((entry, index, list) => list.findIndex((item) => item.title === entry.title && item.group === entry.group) === index);

  const albumTitles = [
    ...(Array.isArray(song.albums) ? song.albums : []),
    ...(!isSingleRelease && song.release?.title ? [song.release.title] : []),
  ]
    .map((title) => String(title || "").trim())
    .filter(Boolean)
    .filter((title, index, list) => list.indexOf(title) === index);

  const toReleaseLink = (title, group = releaseGroupKey) => {
    const normalizedTitle = normalizeReleaseTitle(title);
    if (!normalizedTitle) return "未登録";
    const key = encodeURIComponent(`${group}:${normalizedTitle}`);
    return `<a class="detail-release-link detail-release-link--${group}" href="?release=${key}" data-release-key="${key}">${releaseDisplayTitle(title) || title}</a>`;
  };

  const singleLinks = singleTitles.length
    ? singleTitles.map((entry) => toReleaseLink(entry.title, entry.group)).join(" ")
    : "未登録";

  const albumLinks = albumTitles.length
    ? albumTitles.map((title) => toReleaseLink(title)).join(" ")
    : "未収録";

  const toReleaseHref = (title, group = releaseGroupKey) => {
    const normalizedTitle = normalizeReleaseTitle(title);
    if (!normalizedTitle) return "";
    return `?release=${encodeURIComponent(`${group}:${normalizedTitle}`)}`;
  };

  const primarySingleEntry = singleTitles[0] || null;
  const primaryAlbumTitle = albumTitles[0] || "";

  const basicInfoTop = [
    { label: "グループ", value: groupLabels[song.group] },
    { label: "曲タイプ", value: songTypeLabel(song) },
    { label: "リリース日", value: song.release?.date || "未登録" },
    { label: "コール", value: hasMix ? `${song.callNotes.length}件` : "未登録" },
  ];

  const basicInfoLinks = [
    ...(isYoutubeOnly
      ? [{
          label: "公開",
          value: song.videoUrl
            ? `<a class="detail-release-link detail-release-link--${releaseGroupKey}" href="${song.videoUrl}" target="_blank" rel="noreferrer">YouTubeで見る</a>`
            : "YouTube公開（URL未登録）",
        }]
      : (singleTitles.length ? [{ label: "シングル / 配信", value: singleLinks }] : [])),
    { label: "収録アルバム", value: albumLinks },
  ];

  return `
    <div class="detail-view">
      <nav class="detail-nav">
        <a href="?view=releases" class="back-link" data-back>← 前のページに戻る</a>
        <span class="detail-breadcrumb">
          <span class="group-badge ${song.group}">${groupLabels[song.group]}</span>
        </span>
      </nav>

      <header class="detail-header">
        <h1 class="detail-title">${song.title}</h1>
        ${hasMix ? `<a class="detail-call-jump" href="?id=${song.id}#call" data-song-id="${song.id}" data-hash="call">📣 コールへジャンプ</a>` : ""}
      </header>

      <section class="detail-basic">
        <h2>基本情報</h2>
        <dl class="detail-basic-grid detail-basic-grid--top">
          ${basicInfoTop.map((item) => `
            <div class="detail-basic-item">
              <dt>${item.label}</dt>
              <dd>${item.value}</dd>
            </div>
          `).join("")}
        </dl>
        <dl class="detail-basic-grid detail-basic-grid--links">
          ${basicInfoLinks.map((item) => `
            <div class="detail-basic-item detail-basic-item--link">
              <dt>${item.label}</dt>
              <dd>${item.value}</dd>
            </div>
          `).join("")}
        </dl>
        <div class="detail-return-links">
          ${primarySingleEntry ? `<a class="back-link back-link--mini" href="${toReleaseHref(primarySingleEntry.title, primarySingleEntry.group)}" data-release-key="${encodeURIComponent(`${primarySingleEntry.group}:${normalizeReleaseTitle(primarySingleEntry.title)}`)}">← シングル / 配信に戻る</a>` : ""}
          ${primaryAlbumTitle ? `<a class="back-link back-link--mini" href="${toReleaseHref(primaryAlbumTitle)}" data-release-key="${encodeURIComponent(`${releaseGroupKey}:${normalizeReleaseTitle(primaryAlbumTitle)}`)}">← 収録アルバムに戻る</a>` : ""}
        </div>
      </section>

      <section class="detail-credits">
        <h2>クレジット</h2>
        <dl class="credits-list">
          <div>
            <dt>作詞</dt>
            <dd>${song.lyricists?.length ? song.lyricists.map((n) => `<a class="person-link detail-person-link" href="#" data-creator-name-detail="${n}">${n}</a>`).join(" / ") : "未登録"}</dd>
          </div>
          <div>
            <dt>作曲</dt>
            <dd>${song.composers?.length ? song.composers.map((n) => `<a class="person-link detail-person-link" href="#" data-creator-name-detail="${n}">${n}</a>`).join(" / ") : "未登録"}</dd>
          </div>
          <div>
            <dt>編曲</dt>
            <dd>${song.arrangers?.length ? song.arrangers.map((n) => `<a class="person-link detail-person-link" href="#" data-creator-name-detail="${n}">${n}</a>`).join(" / ") : "未登録"}</dd>
          </div>
        </dl>
      </section>

      ${hasMix ? renderCallSection(song) : `
        <section class="call-section call-section--empty" id="call">
          <h2>📣 コール</h2>
          <p class="call-empty-note">この曲のコール情報はまだ登録されていません。</p>
        </section>
      `}

      ${relatedSongs.length ? `
        <section class="detail-related">
          <h2>同じクリエイターの曲</h2>
          <div class="related-grid">
            ${relatedSongs.map((s, index) => `
              <a class="related-card" href="?id=${s.id}" data-song-id="${s.id}" ${index >= relatedInitialLimit ? "hidden data-related-extra='1'" : ""}>
                <span class="group-badge ${s.group}">${groupLabels[s.group]}</span>
                <span class="related-title">${s.title}</span>
                ${s.hasCall ? `<span class="related-mix-badge">📣</span>` : ""}
              </a>
            `).join("")}
          </div>
          ${relatedSongs.length > relatedInitialLimit ? `
            <div class="related-controls">
              <button type="button" class="back-link back-link--mini" data-related-more data-related-step="${relatedStep}">さらに表示</button>
              <button type="button" class="back-link back-link--mini" data-related-all>すべて表示</button>
            </div>
          ` : ""}
        </section>
      ` : ""}

      ${samRelease.length ? `
        <section class="detail-release-songs">
          <h2>同じ作品の曲</h2>
          <p class="detail-release-name">${song.release.title}</p>
          <div class="related-grid">
            ${samRelease.map((s) => `
              <a class="related-card" href="?id=${s.id}" data-song-id="${s.id}">
                <span class="group-badge ${s.group}">${groupLabels[s.group]}</span>
                <span class="related-title">${s.title}</span>
                ${s.hasCall ? `<span class="related-mix-badge">📣</span>` : ""}
              </a>
            `).join("")}
          </div>
        </section>
      ` : ""}

      <footer class="detail-footer">
        <p>Unofficial fan database. 情報の正確性・網羅性は保証されません。</p>
        ${song.sources?.credits ? `<a href="${song.sources.credits}" target="_blank" rel="noreferrer">出典: 歌ネット</a>` : ""}
      </footer>
    </div>

    <!-- クリエイターパネル（詳細ビュー用の軽量版） -->
    <div id="creatorPanel" class="creator-panel" aria-hidden="true">
      <div class="creator-panel-backdrop" data-close-creator-panel></div>
      <section class="creator-panel-body">
        <button class="dialog-close" type="button" data-close-creator-panel aria-label="閉じる">×</button>
        <p class="eyebrow">Creator</p>
        <h2 id="creatorPanelTitle"></h2>
        <a id="creatorPanelWiki" class="source-button hidden" href="#" target="_blank" rel="noreferrer">Wikipediaを見る</a>
        <div id="creatorPanelSongs" class="creator-song-list"></div>
      </section>
    </div>
  `;
}

function bindDetailEvents(currentSong) {
  const mainEl = document.querySelector("main");
  if (detailMainClickHandler) mainEl.removeEventListener("click", detailMainClickHandler);
  detailMainClickHandler = (event) => {
    // 曲詳細間ナビゲーション
    const songLink = event.target.closest("[data-song-id]");
    if (songLink) {
      event.preventDefault();
      const hash = songLink.dataset.hash || "";
      if (hash) {
        navigateWithHash(songLink.dataset.songId, hash);
      } else {
        navigate(songLink.dataset.songId);
      }
      return;
    }

    const releaseLink = event.target.closest("[data-release-key]");
    if (releaseLink) {
      event.preventDefault();
      pushInternalRoute(`?release=${releaseLink.dataset.releaseKey}`, { release: releaseLink.dataset.releaseKey });
      return;
    }

    // 一覧に戻る
    if (event.target.closest("[data-back]")) {
      event.preventDefault();
      const previousInternalUrl = popPreviousInternalUrl();
      if (previousInternalUrl) {
        pushInternalRoute(previousInternalUrl, {}, { recordPrevious: false });
      } else if (history.state?.fromRelease) {
        pushInternalRoute(`?release=${history.state.fromRelease}`, { release: history.state.fromRelease }, { recordPrevious: false });
      } else {
        pushInternalRoute("?view=releases", { view: "releases" }, { recordPrevious: false });
      }
      return;
    }

    // パーマリンクコピー
    const permalinkBtn = event.target.closest(".call-permalink");
    if (permalinkBtn) {
      event.preventDefault();
      const url = new URL(permalinkBtn.href);
      navigator.clipboard.writeText(url.href).then(() => {
        permalinkBtn.textContent = "✅ コピーしました";
        setTimeout(() => (permalinkBtn.textContent = "🔗 リンクをコピー"), 2000);
      });
      return;
    }

    // クリエイターパネル（詳細ビュー内）
    const creatorDetailLink = event.target.closest("[data-creator-name-detail]");
    if (creatorDetailLink) {
      event.preventDefault();
      openCreatorPanel(creatorDetailLink.dataset.creatorNameDetail);
      return;
    }

    // クリエイターパネルを閉じる
    if (event.target.closest("[data-close-creator-panel]")) {
      closeCreatorPanel();
      return;
    }

    const relatedMoreBtn = event.target.closest("[data-related-more]");
    if (relatedMoreBtn) {
      event.preventDefault();
      const hiddenCards = [...document.querySelectorAll("[data-related-extra][hidden]")];
      const step = Math.max(1, Number(relatedMoreBtn.dataset.relatedStep || "6"));
      hiddenCards.slice(0, step).forEach((card) => {
        card.hidden = false;
      });
      const remain = hiddenCards.length - Math.min(step, hiddenCards.length);
      if (remain <= 0) {
        relatedMoreBtn.hidden = true;
        const allBtn = document.querySelector("[data-related-all]");
        if (allBtn) allBtn.hidden = true;
      }
      return;
    }

    const relatedAllBtn = event.target.closest("[data-related-all]");
    if (relatedAllBtn) {
      event.preventDefault();
      document.querySelectorAll("[data-related-extra][hidden]").forEach((card) => {
        card.hidden = false;
      });
      relatedAllBtn.hidden = true;
      const moreBtn = document.querySelector("[data-related-more]");
      if (moreBtn) moreBtn.hidden = true;
      return;
    }
  };
  mainEl.addEventListener("click", detailMainClickHandler);
}

function openCreatorPanel(name) {
  const panel = document.querySelector("#creatorPanel");
  if (!panel) return;

  document.querySelector("#creatorPanelTitle").textContent = name;
  const wiki = personUrl(name);
  const wikiEl = document.querySelector("#creatorPanelWiki");
  if (wiki) {
    wikiEl.href = wiki;
    wikiEl.classList.remove("hidden");
  } else {
    wikiEl.classList.add("hidden");
  }

  const related = songsForCreator(name);
  document.querySelector("#creatorPanelSongs").innerHTML = related
    .map(
      (s) => `
      <article class="creator-song-item">
        <div class="creator-song-title">
          <a class="creator-song-link" href="?id=${s.id}" data-song-id="${s.id}">${s.title}</a>
          <span class="group-badge ${s.group}">${groupLabels[s.group]}</span>
        </div>
        <div class="creator-role-row">
          ${s.roles.map((r) => `<span class="role-pill ${r.collaborative ? "co-role" : ""}">${r.label}${r.collaborative ? "(共作)" : ""}</span>`).join("")}
          ${s.hasCall ? s.callNotes.map((note) => `<span class="tag">${note.name}</span>`).join("") : ""}
        </div>
      </article>
    `
    )
    .join("");

  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeCreatorPanel() {
  const panel = document.querySelector("#creatorPanel");
  if (!panel) return;
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateView(link.dataset.viewLink);
    });
  });
}

// ----------------------------------------------------------------
// 起動
// ----------------------------------------------------------------
bindGlobalEvents();
ensureHistoryState();
dispatch();
