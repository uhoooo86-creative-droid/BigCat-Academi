(function () {
  "use strict";
  var STORE_KEY = "bigcat-seminar-data-v1";
  var ORIGINAL = JSON.parse(JSON.stringify(window.SEMINAR || { floors: [], items: [] }));
  var data = load() || clone(ORIGINAL);
  var state = { floor: "all", q: "", edit: false };
  var blobs = {};   // 새로 선택한 파일: 경로 -> { url, file }
  var lb = { list: [], i: 0 };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // data.js가 새로 배포되면(원본이 바뀌면) 예전 임시 저장본은 무시
  function sig(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ":" + h; }
  var BASE = sig(JSON.stringify(ORIGINAL));
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return s && s.base === BASE ? s.data : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ base: BASE, data: data })); } catch (e) {} updateEditState(); }
  function floorOf(id) { return data.floors.filter(function (f) { return f.id === id; })[0] || { label: "?", name: "", id: id }; }
  function colorOf(id) { return "var(--" + id + ", #888)"; }
  function enc(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function src(path) { return blobs[path] ? blobs[path].url : enc(path); }
  // 미리보기는 web_thumbs/원래경로.jpg (없으면 원본으로 자동 대체)
  function thumb(path) { return blobs[path] ? blobs[path].url : enc("web_thumbs/" + path + ".jpg"); }
  function fname(p) { return p.split("/").pop(); }

  /* ---------- 링크 처리 ---------- */
  function linkLabel(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, "");
      if (/youtu\.?be/.test(h)) return "▶ YouTube";
      if (/drive\.google|docs\.google/.test(h)) return "📁 Google Drive";
      if (/canva/.test(h)) return "🎨 Canva";
      if (/instagram/.test(h)) return "📷 Instagram";
      if (/blog\.naver/.test(h)) return "📝 블로그";
      if (/padlet/.test(h)) return "📌 Padlet";
      return "🔗 " + h;
    } catch (e) { return "🔗 링크"; }
  }
  function linkBtn(label, url) {
    var yt = /youtu\.?be/.test(url) ? " yt" : "";
    return '<a class="btn link' + yt + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || linkLabel(url)) + "</a>";
  }
  // 비고: [이름](주소) 와 맨 주소를 버튼으로 바꾸고, 나머지 글은 그대로
  function renderNote(note) {
    var btns = [];
    var text = String(note || "").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, l, u) { btns.push(linkBtn(l, u)); return ""; });
    text = text.replace(/https?:\/\/[^\s<>"')]+/g, function (u) { btns.push(linkBtn(null, u)); return ""; });
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (!text && !btns.length) return "";
    return '<div class="note"><p class="block-label">비고</p>' + (text ? "<p>" + esc(text) + "</p>" : "") +
      (btns.length ? '<div class="btn-row">' + btns.join("") + "</div>" : "") + "</div>";
  }

  /* ---------- 렌더링 ---------- */
  function renderTabs() {
    var tabs = [{ id: "all", label: "전체" }].concat(data.floors.map(function (f) { return { id: f.id, label: f.emoji + " " + f.label }; }));
    $("#tabs").innerHTML = tabs.map(function (t) {
      return '<button class="tab" type="button" data-floor="' + t.id + '" aria-pressed="' + (state.floor === t.id) + '">' + esc(t.label) + "</button>";
    }).join("");
  }

  function match(it) {
    if (!state.q) return true;
    var hay = [it.title, it.desc, it.note].join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
  }

  function cardHTML(it, n) {
    var h = '<article class="card" style="--c:' + colorOf(it.floor) + '" data-id="' + esc(it.id) + '"><div class="card-body">';
    h += '<div class="card-title"><span class="num">' + n + "</span><h3>" + esc(it.title) + (it.tag ? ' <span class="tag">' + esc(it.tag) + "</span>" : "") + "</h3>" +
      (state.edit ? '<button class="btn small edit-btn" type="button" data-edit="' + esc(it.id) + '">수정</button>' : "") + "</div>";
    if (it.desc) h += '<p class="desc">' + esc(it.desc) + "</p>";

    var imgs = it.images || [];
    if (imgs.length) {
      h += '<div class="gallery' + (imgs.length === 1 ? " single" : "") + '">' + imgs.map(function (p, i) {
        return '<button type="button" data-lb="' + esc(it.id) + '" data-i="' + i + '" aria-label="' + esc(fname(p)) + ' 크게 보기">' +
          '<img loading="lazy" src="' + thumb(p) + '" data-full="' + src(p) + '" onerror="if(this.src!==this.dataset.full)this.src=this.dataset.full" alt=""></button>';
      }).join("") + "</div>";
      h += '<div class="btn-row"><button class="btn small dl" type="button" data-dlall="' + esc(it.id) + '">⬇ 이미지 ' + imgs.length + "장 모두 받기</button></div>";
    }

    (it.audio || []).forEach(function (p) {
      h += '<div class="audio-row"><span class="name">🎵 ' + esc(fname(p)) + '</span><div class="ctrl">' +
        '<audio controls preload="none" src="' + src(p) + '"></audio>' +
        '<a class="btn small dl" href="' + src(p) + '" download="' + esc(fname(p)) + '">⬇</a></div></div>';
    });

    var files = it.files || [];
    if (files.length) {
      h += '<div class="btn-row">' + files.map(function (p) {
        return '<a class="btn dl" href="' + src(p) + '" download="' + esc(fname(p)) + '">📄 ' + esc(fname(p)) + "</a>";
      }).join("") + "</div>";
    }

    var links = (it.links || []).filter(function (l) { return l && l.url; });
    var pending = (it.links || []).filter(function (l) { return l && !l.url && l.label; });
    if (links.length) h += '<div class="btn-row">' + links.map(function (l) { return linkBtn(l.label, l.url); }).join("") + "</div>";
    if (state.edit && pending.length) h += '<div class="btn-row">' + pending.map(function (l) { return '<span class="btn small pending">🔗 링크 필요 · ' + esc(l.label) + "</span>"; }).join("") + "</div>";

    h += renderNote(it.note);
    if (state.edit && !imgs.length && !(it.audio || []).length && !files.length && !links.length && !it.note)
      h += '<div class="empty">아직 자료가 없어요 · ‘수정’에서 추가</div>';
    return h + "</div></article>";
  }

  function render() {
    var floors = state.floor === "all" ? data.floors : data.floors.filter(function (f) { return f.id === state.floor; });
    var out = "", total = 0;
    floors.forEach(function (f) {
      var all = data.items.filter(function (it) { return it.floor === f.id; });
      var shown = all.filter(match);
      if (!shown.length && !state.edit) return;
      total += shown.length;
      out += '<section class="floor"><div class="floor-head"><span class="floor-badge" style="background:' + colorOf(f.id) + '">' + esc(f.label) + "</span>" +
        "<h2>" + esc(f.emoji + " " + f.name) + '</h2><span class="count">' + shown.length + "개</span>" +
        (state.edit ? '<button class="btn small add" type="button" data-add="' + f.id + '">＋ 항목 추가</button>' : "") + "</div>" +
        '<div class="grid">' + shown.map(function (it) { return cardHTML(it, it.no != null ? String(it.no).padStart(2, "0") : all.indexOf(it) + 1); }).join("") + "</div></section>";
    });
    if (!total && !state.edit) out = '<p class="no-result">검색 결과가 없어요.</p>';
    $("#main").innerHTML = out;
  }

  /* ---------- 라이트박스 ---------- */
  function openLB(id, i) {
    var it = data.items.filter(function (x) { return x.id === id; })[0];
    lb.list = it.images; lb.i = i; showLB();
    $("#lightbox").hidden = false; document.body.style.overflow = "hidden";
  }
  function showLB() {
    var p = lb.list[lb.i];
    $("#lbImg").src = src(p);
    $("#lbDown").href = src(p); $("#lbDown").setAttribute("download", fname(p));
    $("#lbCount").textContent = (lb.i + 1) + " / " + lb.list.length;
    var multi = lb.list.length > 1;
    $(".lb-prev").hidden = !multi; $(".lb-next").hidden = !multi;
  }
  function closeLB() { $("#lightbox").hidden = true; document.body.style.overflow = ""; }
  function stepLB(d) { lb.i = (lb.i + d + lb.list.length) % lb.list.length; showLB(); }

  function downloadAll(id) {
    var it = data.items.filter(function (x) { return x.id === id; })[0];
    it.images.forEach(function (p, k) {
      setTimeout(function () { var a = document.createElement("a"); a.href = src(p); a.download = fname(p); document.body.appendChild(a); a.click(); a.remove(); }, k * 350);
    });
  }

  /* ---------- 편집 ---------- */
  var editing = null;
  function lines(v) { return String(v || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean); }
  function linkRow(l) {
    var d = document.createElement("div"); d.className = "link-row";
    d.innerHTML = '<input placeholder="버튼 이름" value="' + esc(l.label || "") + '"><input placeholder="https://..." value="' + esc(l.url || "") + '"><button type="button" class="btn small danger">✕</button>';
    d.querySelector("button").onclick = function () { d.remove(); };
    $("#edLinks").appendChild(d);
  }
  function openEditor(it, isNew) {
    editing = { it: it, isNew: isNew };
    var f = $("#editForm");
    $("#edTitle").textContent = isNew ? "새 항목 추가" : "항목 수정";
    $("#edFloor").innerHTML = data.floors.map(function (x) { return '<option value="' + x.id + '">' + esc(x.label + " · " + x.name) + "</option>"; }).join("");
    f.floor.value = it.floor; f.title.value = it.title || ""; f.desc.value = it.desc || "";
    f.images.value = (it.images || []).join("\n"); f.audio.value = (it.audio || []).join("\n");
    f.files.value = (it.files || []).join("\n"); f.note.value = it.note || "";
    $("#edLinks").innerHTML = ""; (it.links || []).forEach(linkRow);
    $("#edDelete").hidden = isNew;
    $("#editor").showModal();
  }
  function commitEditor() {
    var f = $("#editForm"), it = editing.it;
    it.floor = f.floor.value; it.title = f.title.value.trim(); it.desc = f.desc.value.trim();
    it.images = lines(f.images.value); it.audio = lines(f.audio.value); it.files = lines(f.files.value);
    it.note = f.note.value.trim();
    it.links = Array.prototype.map.call($("#edLinks").children, function (r) {
      var i = r.querySelectorAll("input"); var url = i[1].value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
      return { label: i[0].value.trim(), url: url };
    }).filter(function (l) { return l.url || l.label; });
    if (editing.isNew) data.items.push(it);
    save(); render();
  }
  function pickFiles(input) {
    var kind = input.dataset.kind, ta = $("#editForm")[kind];
    var add = Array.prototype.map.call(input.files, function (file) {
      var name = file.name.replace(/\s+/g, "_");
      var path = "assets/" + kind + "/" + name;
      blobs[path] = { url: URL.createObjectURL(file), file: file };
      return path;
    });
    ta.value = lines(ta.value).concat(add).join("\n");
    input.value = "";
    updateEditState();
  }
  function updateEditState() {
    var n = Object.keys(blobs).length;
    var changed = JSON.stringify(data) !== JSON.stringify(ORIGINAL);
    $("#editState").textContent = "편집 모드 · " + (changed || n ? "변경사항 있음" + (n ? " (새 파일 " + n + "개)" : "") + " — zip을 받아 폴더에 덮어쓰면 배포 준비 끝" : "변경사항 없음");
  }

  function dataJS() {
    return "/* 빅캣아카데미 세미나 데이터 · 편집 모드에서 내보냄 " + new Date().toLocaleString("ko-KR") + " */\nwindow.SEMINAR = " + JSON.stringify(data, null, 2) + ";\n";
  }
  function saveBlob(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function exportZip() {
    if (!window.JSZip) { saveBlob(new Blob([dataJS()], { type: "text/javascript" }), "data.js"); return; }
    var zip = new JSZip();
    zip.file("data.js", dataJS());
    var used = JSON.stringify(data);
    Object.keys(blobs).forEach(function (p) { if (used.indexOf(JSON.stringify(p).slice(1, -1)) > -1) zip.file(p, blobs[p].file); });
    zip.generateAsync({ type: "blob" }).then(function (b) { saveBlob(b, "bigcat-update.zip"); });
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.floor) { state.floor = t.dataset.floor; renderTabs(); render(); window.scrollTo({ top: 0 }); }
    else if (t.dataset.lb) openLB(t.dataset.lb, +t.dataset.i);
    else if (t.dataset.dlall) downloadAll(t.dataset.dlall);
    else if (t.dataset.edit) openEditor(data.items.filter(function (x) { return x.id === t.dataset.edit; })[0], false);
    else if (t.dataset.add) openEditor({ id: "n-" + Date.now().toString(36), floor: t.dataset.add, title: "", desc: "", images: [], audio: [], files: [], links: [], note: "" }, true);
  });
  $("#search").addEventListener("input", function (e) { state.q = e.target.value.trim(); render(); });
  $("#editToggle").addEventListener("click", function () {
    state.edit = !state.edit;
    this.classList.toggle("on", state.edit);
    $("#editBar").hidden = !state.edit; updateEditState(); render();
  });
  $(".lb-close").onclick = closeLB;
  $(".lb-prev").onclick = function () { stepLB(-1); };
  $(".lb-next").onclick = function () { stepLB(1); };
  $("#lightbox").addEventListener("click", function (e) { if (e.target === this) closeLB(); });
  document.addEventListener("keydown", function (e) {
    if ($("#lightbox").hidden) return;
    if (e.key === "Escape") closeLB(); if (e.key === "ArrowLeft") stepLB(-1); if (e.key === "ArrowRight") stepLB(1);
  });
  var sx = null;
  $("#lightbox").addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  $("#lightbox").addEventListener("touchend", function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) stepLB(dx < 0 ? 1 : -1); sx = null; });

  $("#addLink").onclick = function () { linkRow({}); };
  document.querySelectorAll('#editForm input[type=file]').forEach(function (i) { i.addEventListener("change", function () { pickFiles(i); }); });
  $("#editForm").addEventListener("submit", function () { commitEditor(); });
  $("#edCancel").onclick = function () { $("#editor").close(); };
  $("#edDelete").onclick = function () {
    if (!confirm("이 항목을 삭제할까요?")) return;
    data.items = data.items.filter(function (x) { return x !== editing.it; });
    $("#editor").close(); save(); render();
  };
  $("#exportZip").onclick = exportZip;
  $("#exportData").onclick = function () { saveBlob(new Blob([dataJS()], { type: "text/javascript" }), "data.js"); };
  $("#resetData").onclick = function () {
    if (!confirm("이 브라우저에 저장된 변경사항을 지우고 원래 data.js 내용으로 되돌릴까요?")) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    data = clone(ORIGINAL); blobs = {}; updateEditState(); render();
  };

  /* ---------- 시작 ---------- */
  $("#appTitle").textContent = data.title || ORIGINAL.title;
  $("#appSub").textContent = data.subtitle || ORIGINAL.subtitle || "";
  document.title = data.title || document.title;
  // 편집 버튼은 주소 끝에 ?edit 를 붙였을 때만 보여요 (참가자 화면에는 숨김)
  if (!/[?&#]edit/.test(location.search + location.hash)) $("#editToggle").hidden = true;
  renderTabs(); render();
})();
