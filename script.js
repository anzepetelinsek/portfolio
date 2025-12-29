/* ========= Session-aware topbar intro ========= */
const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");

/* ========= Route micro-pause (match index “prelude” feel) ========= */
const INFO_PRELUDE_DELAY = 180; // ms pause before info reveals begin (from index -> info)

/* ========= Loading cursor state (native OS cursor via CSS) ========= */
const loadingReasons = new Set();
function setLoading(reason, on) {
  if (on) loadingReasons.add(reason);
  else loadingReasons.delete(reason);
  document.body.classList.toggle("is-loading", loadingReasons.size > 0);
}

/* ========= Hovered pixel-canvas loading (ONLY on hovered pixelated wrapper) ========= */
let hoveredWrapperForLoading = null;

function updateHoverPixelLoading() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    setLoading("hoverPixels", false);
    hoveredWrapperForLoading = null;
    return;
  }
  if (!hoveredWrapperForLoading || !document.body.contains(hoveredWrapperForLoading)) {
    setLoading("hoverPixels", false);
    hoveredWrapperForLoading = null;
    return;
  }
  const hasCanvas = !!hoveredWrapperForLoading.querySelector(".pixel-canvas");
  setLoading("hoverPixels", hasCanvas);
}

function setHoveredWrapperForLoading(wrapperOrNull) {
  hoveredWrapperForLoading = wrapperOrNull;
  updateHoverPixelLoading();
}
window.addEventListener("resize", updateHoverPixelLoading);

/* ========= Topbar animation ========= */
function runTopbarAnimation(callback) {
  const nameEl = document.querySelector(".name");
  const ellipsis = document.querySelector(".ellipsis");
  if (!nameEl || !ellipsis) {
    callback?.();
    return;
  }

  setLoading("intro", true);

  const states = ["", ".", "..", "..."];
  let index = 0,
    loops = 0;

  nameEl.style.opacity = "1";
  ellipsis.style.opacity = "1";

  const interval = setInterval(() => {
    ellipsis.textContent = states[index];
    index = (index + 1) % states.length;
    if (index === 0) loops++;

    if (loops >= 2) {
      clearInterval(interval);
      ellipsis.textContent = "...";

      setTimeout(() => {
        ellipsis.style.display = "none";

        const topbarEls = [
          ".role",
          ".currently",
          ".positions",
          ".info",
          ".contact-label",
          ".contact-links",
        ];

        topbarEls.forEach((sel, i) => {
          setTimeout(() => {
            const el = document.querySelector(sel);
            if (el) el.style.opacity = "1";
          }, i * 100);
        });

        const afterMs = topbarEls.length * 100 + 250;

        setTimeout(() => {
          sessionStorage.setItem("hasSeenIntro", "true");
          setLoading("intro", false);
          callback?.();
        }, afterMs);
      }, 150);
    }
  }, 250);
}

function showTopbarInstantly() {
  document.body.classList.add("instant-topbar");
  document.querySelectorAll(".topbar .col").forEach((el) => (el.style.opacity = "1"));
}

/* ========= Pixelated reveal (two-phase: PREPARE -> REVEAL) ========= */
let preloadIO = null;
let revealIO = null;

// Observer tweakables
const PRELOAD_ROOT_MARGIN = "1000px";
const REVEAL_ROOT_MARGIN = "0px";
const REVEAL_THRESHOLD = 0.02;

// Pixel timing (FASTER DEFAULTS)
const PIXEL_STEPS = [88, 44, 1];
const PIXEL_HOLD_MS = 80; // was 220
const PIXEL_DURATION = 450; // was 1100

// Per-target overlay store
const overlayStore = new WeakMap();

/* ---------- Utilities ---------- */

function ensureImgSrc(img) {
  if (img?.dataset?.src && (!img.getAttribute("src") || img.getAttribute("src") === "")) {
    img.setAttribute("src", img.dataset.src);
  }
  try {
    img.loading = "lazy";
    img.decoding = "async";
  } catch {}
}

function applyCanvasInlineStyles(canvas) {
  canvas.style.position = "absolute";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2";
  canvas.style.imageRendering = "pixelated";
  // NOTE: we do NOT set inset/width/height here anymore (we compute exact rect below)
}

/*
  Snap fix:
  Layout the canvas to match the *media element* rect (img/video) within the wrapper.
  This makes the pixel overlay occupy the identical box as the eventual sharp media,
  eliminating the 1px “snap” when the canvas is removed.
*/
function layoutCanvasToMediaRect(wrapper, overlay) {
  const { canvas, sourceEl } = overlay;
  const wr = wrapper.getBoundingClientRect();
  const mr = sourceEl ? sourceEl.getBoundingClientRect() : wr;

  // Prefer media rect if it's non-zero; otherwise fall back to wrapper rect
  const useMedia = mr.width > 0.5 && mr.height > 0.5;
  const r = useMedia ? mr : wr;

  // Position canvas within wrapper
  const top = r.top - wr.top;
  const left = r.left - wr.left;

  // Lock CSS size to the exact fractional px size (Fix 2 + better anchor)
  canvas.style.top = `${top}px`;
  canvas.style.left = `${left}px`;
  canvas.style.width = `${r.width}px`;
  canvas.style.height = `${r.height}px`;

  // Internal backing store uses DPR
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  canvas.width = w;
  canvas.height = h;

  return r.width > 0.5 && r.height > 0.5;
}

function insertPixelCanvas(wrapper, sourceEl) {
  const canvas = document.createElement("canvas");
  canvas.className = "pixel-canvas";
  applyCanvasInlineStyles(canvas);

  const caption = wrapper.querySelector(".caption");
  if (caption) wrapper.insertBefore(canvas, caption);
  else wrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d", { alpha: true });

  ctx.imageSmoothingEnabled = false;
  offCtx.imageSmoothingEnabled = false;

  updateHoverPixelLoading();

  return { canvas, ctx, off, offCtx, ro: null, sourceEl };
}

async function sizeCanvasNonZero(wrapper, overlay, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const ok = layoutCanvasToMediaRect(wrapper, overlay);
    if (ok) return true;
    await new Promise((res) => requestAnimationFrame(res));
  }
  return false;
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawRoughPlaceholder(overlay, seedStr) {
  const { canvas, ctx, off, offCtx } = overlay;
  const W = canvas.width,
    H = canvas.height;
  if (W <= 0 || H <= 0) return;

  const px = PIXEL_STEPS[0] || 64;
  const wSmall = Math.max(1, Math.round(W / px));
  const hSmall = Math.max(1, Math.round(H / px));

  off.width = wSmall;
  off.height = hSmall;

  let s = hash32(seedStr || "seed");
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

  offCtx.clearRect(0, 0, wSmall, hSmall);
  for (let y = 0; y < hSmall; y++) {
    for (let x = 0; x < wSmall; x++) {
      const r = rand();
      const v = Math.floor(245 - r * 45);
      offCtx.fillStyle = `rgb(${v},${v},${v})`;
      offCtx.fillRect(x, y, 1, 1);
    }
  }

  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, wSmall, hSmall, 0, 0, W, H);
}

function drawPixelatedFromSource(overlay, sourceEl, pixelSize) {
  const { canvas, ctx, off, offCtx } = overlay;
  const W = canvas.width,
    H = canvas.height;
  if (W <= 0 || H <= 0) return;

  const px = Number.isFinite(pixelSize) && pixelSize >= 1 ? pixelSize : 1;
  const wSmall = Math.max(1, Math.round(W / px));
  const hSmall = Math.max(1, Math.round(H / px));

  off.width = wSmall;
  off.height = hSmall;

  offCtx.clearRect(0, 0, wSmall, hSmall);
  offCtx.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;

  offCtx.drawImage(sourceEl, 0, 0, wSmall, hSmall);

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(off, 0, 0, wSmall, hSmall, 0, 0, W, H);
}

function ensureImageReady(img, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!img) return resolve({ ok: false, reason: "no-img" });

    if (img.complete && img.naturalWidth > 0) {
      return resolve({ ok: true, reason: "complete" });
    }

    let settled = false;
    const done = (ok, reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok, reason });
    };

    const onLoad = () => done(img.naturalWidth > 0, "load");
    const onError = () => done(false, "error");

    const cleanup = () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    img.addEventListener("load", onLoad, { once: true });
    img.addEventListener("error", onError, { once: true });

    if (img.decode) {
      img
        .decode()
        .then(() => {
          if (img.complete && img.naturalWidth > 0) done(true, "decode");
        })
        .catch(() => {});
    }

    const timer = setTimeout(() => {
      done(img.complete && img.naturalWidth > 0, "timeout");
    }, timeoutMs);
  });
}

function ensureVideoDrawable(video, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!video) return resolve({ ok: false, reason: "no-video" });
    if (video.readyState >= 2) return resolve({ ok: true, reason: "readyState" });

    let settled = false;
    const done = (ok, reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok, reason });
    };

    const onLoaded = () => done(true, "loadeddata");
    const onError = () => done(false, "error");

    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("canplay", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });

    const timer = setTimeout(() => {
      done(video.readyState >= 2, "timeout");
    }, timeoutMs);
  });
}

/* ---------- Animation ---------- */

function animateUnpixel({
  wrapper,
  overlay,
  sourceEl,
  steps = PIXEL_STEPS,
  holdMs = PIXEL_HOLD_MS,
  duration = PIXEL_DURATION,
  onDone,
}) {
  const { canvas } = overlay;

  let raf = 0;
  let lastIdx = 0;

  const resize = () => {
    // Keep canvas locked to exact media rect and redraw current stage
    layoutCanvasToMediaRect(wrapper, overlay);
    drawPixelatedFromSource(overlay, sourceEl, steps[Math.min(lastIdx, steps.length - 1)]);
  };

  overlay.ro?.disconnect?.();
  if (window.ResizeObserver) {
    overlay.ro = new ResizeObserver(resize);
    overlay.ro.observe(wrapper);
  }

  drawPixelatedFromSource(overlay, sourceEl, steps[0]);
  lastIdx = 0;

  const startAt = performance.now() + holdMs;

  const frame = (now) => {
    if (!document.body.contains(wrapper) || !document.body.contains(canvas)) {
      finish();
      return;
    }

    const t = Math.min(1, Math.max(0, (now - startAt) / duration));
    const idx = Math.min(steps.length - 1, Math.floor(t * steps.length));

    if (idx !== lastIdx) {
      // Ensure layout is still correct before drawing the next stage
      layoutCanvasToMediaRect(wrapper, overlay);
      drawPixelatedFromSource(overlay, sourceEl, steps[idx]);
      lastIdx = idx;
    }

    if (t < 1) raf = requestAnimationFrame(frame);
    else finish();
  };

  const finish = () => {
    cancelAnimationFrame(raf);
    overlay.ro?.disconnect?.();
    onDone?.();
  };

  raf = requestAnimationFrame(frame);
}

/* ---------- Two-phase pipeline ---------- */

async function prepareImg(img) {
  const wrapper = img?.closest?.(".image-wrapper");
  if (!wrapper || !img || img.tagName !== "IMG") return;

  if (img.dataset.pxPrepared === "1" || img.dataset.pxPrepared === "running") return;
  img.dataset.pxPrepared = "running";

  ensureImgSrc(img);

  let overlay = overlayStore.get(img);
  if (!overlay) {
    overlay = insertPixelCanvas(wrapper, img);
    overlayStore.set(img, overlay);
  } else {
    overlay.sourceEl = img;
  }

  const sized = await sizeCanvasNonZero(wrapper, overlay);
  if (sized) drawRoughPlaceholder(overlay, img.currentSrc || img.src || "img");

  img.classList.add("visible");
  updateHoverPixelLoading();

  const ready = await ensureImageReady(img);
  if (ready.ok && document.body.contains(overlay.canvas)) {
    try {
      layoutCanvasToMediaRect(wrapper, overlay);
      drawPixelatedFromSource(overlay, img, PIXEL_STEPS[0]);
      updateHoverPixelLoading();
    } catch {}
  }

  img.dataset.pxPrepared = "1";
}

async function revealImg(img, doneCb) {
  const wrapper = img?.closest?.(".image-wrapper");
  if (!wrapper || !img || img.tagName !== "IMG") {
    doneCb?.();
    return;
  }

  if (img.dataset.pxDone === "1") {
    doneCb?.();
    return;
  }
  if (img.dataset.pxDone === "running") return;

  img.dataset.pxDone = "running";

  await prepareImg(img);

  const overlay = overlayStore.get(img);
  if (!overlay || !document.body.contains(overlay.canvas)) {
    img.dataset.pxDone = "1";
    updateHoverPixelLoading();
    doneCb?.();
    return;
  }

  const ready = await ensureImageReady(img);
  if (!ready.ok) {
    img.classList.add("visible");
    overlay.canvas.remove();
    img.dataset.pxDone = "1";
    updateHoverPixelLoading();
    doneCb?.();
    return;
  }

  animateUnpixel({
    wrapper,
    overlay,
    sourceEl: img,
    onDone: () => {
      overlay.canvas.remove();
      img.dataset.pxDone = "1";
      updateHoverPixelLoading();
      doneCb?.();
    },
  });
}

async function prepareVideo(video) {
  const wrapper = video?.closest?.(".image-wrapper");
  if (!wrapper || !video || video.tagName !== "VIDEO") return;

  if (video.dataset.pxPrepared === "1" || video.dataset.pxPrepared === "running") return;
  video.dataset.pxPrepared = "running";

  let overlay = overlayStore.get(video);
  if (!overlay) {
    overlay = insertPixelCanvas(wrapper, video);
    overlayStore.set(video, overlay);
  } else {
    overlay.sourceEl = video;
  }

  const sized = await sizeCanvasNonZero(wrapper, overlay);
  if (sized) {
    drawRoughPlaceholder(overlay, video.currentSrc || video.src || video.getAttribute("poster") || "video");
  }

  updateHoverPixelLoading();

  const vReady = await ensureVideoDrawable(video);
  if (vReady.ok && document.body.contains(overlay.canvas)) {
    try {
      layoutCanvasToMediaRect(wrapper, overlay);
      drawPixelatedFromSource(overlay, video, PIXEL_STEPS[0]);
      updateHoverPixelLoading();
    } catch {}
  }

  video.dataset.pxPrepared = "1";
}

async function revealVideo(video) {
  const wrapper = video?.closest?.(".image-wrapper");
  if (!wrapper || !video || video.tagName !== "VIDEO") return;

  if (video.dataset.pxDone === "1" || video.dataset.pxDone === "running") return;
  video.dataset.pxDone = "running";

  await prepareVideo(video);

  const overlay = overlayStore.get(video);
  if (!overlay || !document.body.contains(overlay.canvas)) {
    video.dataset.pxDone = "1";
    updateHoverPixelLoading();
    return;
  }

  const vReady = await ensureVideoDrawable(video);
  if (!vReady.ok) {
    overlay.canvas.remove();
    video.dataset.pxDone = "1";
    updateHoverPixelLoading();
    return;
  }

  animateUnpixel({
    wrapper,
    overlay,
    sourceEl: video,
    onDone: () => {
      overlay.canvas.remove();
      video.dataset.pxDone = "1";
      updateHoverPixelLoading();
    },
  });
}

/* ---------- Observers ---------- */

function initPixelObservers({ excludeImgs = new Set() } = {}) {
  if (preloadIO) preloadIO.disconnect();
  if (revealIO) revealIO.disconnect();

  const imgTargets = Array.from(document.querySelectorAll("main .image-wrapper img.image")).filter(
    (img) => !excludeImgs.has(img)
  );

  const videoTargets = Array.from(document.querySelectorAll("main .image-wrapper video.image"));

  if (!imgTargets.length && !videoTargets.length) return;

  if (!("IntersectionObserver" in window)) {
    imgTargets.forEach((img) => prepareImg(img).then(() => revealImg(img)));
    videoTargets.forEach((v) => prepareVideo(v).then(() => revealVideo(v)));
    return;
  }

  preloadIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        preloadIO.unobserve(el);

        if (el.tagName === "IMG") prepareImg(el);
        else if (el.tagName === "VIDEO") prepareVideo(el);
      });
    },
    { rootMargin: PRELOAD_ROOT_MARGIN, threshold: 0.01 }
  );

  revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        revealIO.unobserve(el);

        if (el.tagName === "IMG") revealImg(el);
        else if (el.tagName === "VIDEO") revealVideo(el);
      });
    },
    { rootMargin: REVEAL_ROOT_MARGIN, threshold: REVEAL_THRESHOLD }
  );

  imgTargets.forEach((img) => {
    preloadIO.observe(img);
    revealIO.observe(img);
  });

  videoTargets.forEach((v) => {
    preloadIO.observe(v);
    revealIO.observe(v);
  });
}

/* ========= Clickable Images/Videos ========= */
function initImageLinks() {
  document.querySelectorAll(".image").forEach((el) => {
    if (el.dataset && el.dataset.link && el.dataset.linkBound !== "1") {
      el.dataset.linkBound = "1";
      el.style.cursor = "alias";
      el.addEventListener("click", () => window.open(el.dataset.link, "_blank"));
    }
  });
}

/* ========= Single-caption hover sticky system ========= */
let hoverStickyCaptionsCleanup = null;

function initHoverStickyCaptions() {
  if (window.matchMedia("(max-width: 900px)").matches) return;
  if (document.body.classList.contains("index-prelude")) return;

  if (hoverStickyCaptionsCleanup) hoverStickyCaptionsCleanup();

  const wrappers = Array.from(document.querySelectorAll("main .image-wrapper"));
  if (!wrappers.length) return;

  const OFFSET_BOTTOM = 5;

  // Clamp knobs (match your CSS `.caption { bottom: 2px; }`)
  const WRAPPER_BOTTOM_PAD = 2;
  const WRAPPER_TOP_PAD = 0;

  let active = null;
  let ticking = false;

  const clearCaptionState = (caption) => {
    caption.classList.remove("is-fixed", "is-active");
    caption.style.removeProperty("--cap-left");
    caption.style.removeProperty("--cap-bottom"); // NEW: used for top/bottom clamping while fixed
  };

  const deactivate = () => {
    if (!active) return;
    clearCaptionState(active.caption);
    active = null;
  };

  const setActive = (wrapper) => {
    const caption = wrapper.querySelector(".caption");
    if (!caption) return;

    if (active && active.wrapper === wrapper) return;
    if (active) clearCaptionState(active.caption);

    active = { wrapper, caption };
    caption.classList.add("is-active");
    requestUpdate();
  };

  const update = () => {
    ticking = false;
    if (!active) return;

    const { wrapper, caption } = active;

    if (!document.body.contains(wrapper)) {
      deactivate();
      return;
    }

    const r = wrapper.getBoundingClientRect();
    const inView = r.bottom > 0 && r.top < window.innerHeight;

    if (!inView) {
      caption.classList.remove("is-fixed");
      caption.style.removeProperty("--cap-bottom");
      return;
    }

    caption.style.setProperty("--cap-left", `${r.left}px`);

    const baselineY = window.innerHeight - OFFSET_BOTTOM;
    const shouldFix = r.bottom > baselineY;

    if (!shouldFix) {
      caption.classList.remove("is-fixed");
      caption.style.removeProperty("--cap-bottom");
      return;
    }

    // Fixed mode with CLAMP:
    // - prefer sticking to viewport bottom baseline
    // - but never let caption run ABOVE wrapper top
    // - and never let caption go BELOW wrapper bottom (to match “bottom-aligned until unstick”)
    const capH = caption.getBoundingClientRect().height || 0;

    // Desired bottom edge in viewport Y-space
    let bottomY = Math.min(baselineY, r.bottom - WRAPPER_BOTTOM_PAD);

    // Clamp bottomY so caption’s TOP never rises above wrapper top
    const minBottomY = r.top + WRAPPER_TOP_PAD + capH;
    const maxBottomY = r.bottom - WRAPPER_BOTTOM_PAD;

    bottomY = Math.max(bottomY, minBottomY);
    bottomY = Math.min(bottomY, maxBottomY);

    // Convert viewport Y -> CSS bottom (distance from viewport bottom)
    const bottomPx = window.innerHeight - bottomY;

    caption.style.setProperty("--cap-bottom", `${bottomPx}px`);
    caption.classList.add("is-fixed");
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  const onScroll = () => requestUpdate();
  const onResize = () => requestUpdate();
  const onKeyDown = (e) => {
    if (e.key === "Escape") deactivate();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);

  const perWrapperHandlers = [];

  wrappers.forEach((w) => {
    const onEnter = () => {
      setHoveredWrapperForLoading(w);
      setActive(w);
    };
    const onLeave = () => {
      if (active && active.wrapper === w) deactivate();
      setHoveredWrapperForLoading(null);
    };

    w.addEventListener("mouseenter", onEnter);
    w.addEventListener("mouseleave", onLeave);

    perWrapperHandlers.push({ w, onEnter, onLeave });
  });

  hoverStickyCaptionsCleanup = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);

    perWrapperHandlers.forEach(({ w, onEnter, onLeave }) => {
      w.removeEventListener("mouseenter", onEnter);
      w.removeEventListener("mouseleave", onLeave);
    });

    deactivate();
    setHoveredWrapperForLoading(null);
    hoverStickyCaptionsCleanup = null;
  };
}

/* ========= Grid overlay toggle ========= */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "g") document.body.classList.toggle("show-grid");
});

/* ========= Bind internal navigation ========= */
function bindInternalLinks(scope = document) {
  scope.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#") || link.target === "_blank")
      return;

    if (link.dataset.navBound === "1") return;
    link.dataset.navBound = "1";

    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(href);
    });
  });
}

/* ========= Soft navigation ========= */
function navigateTo(href, { replace = false } = {}) {
  const absolute = new URL(href, window.location.href).href;

  setLoading("nav", true);

  fetch(absolute, { credentials: "same-origin" })
    .then((res) => res.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const newMain = doc.querySelector("main");
      const newFooter = doc.querySelector("footer");
      const newTitle = doc.querySelector("title")?.textContent || document.title;
      const newBodyClass = doc.body.className;

      if (newMain && newFooter) {
        document.querySelector("main").replaceWith(newMain);
        document.querySelector("footer").replaceWith(newFooter);

        const insertedMain = document.querySelector("main");
        const insertedFooter = document.querySelector("footer");

        insertedMain.style.opacity = "0";
        insertedMain.classList.add("content-loading");
        insertedFooter.style.opacity = "0";

        document.body.className = newBodyClass;
        document.title = newTitle;

        if (replace) history.replaceState({}, "", absolute);
        else history.pushState({}, "", absolute);

        window.scrollTo(0, 0);

        bindInternalLinks(document);
        initPageContent();

        setTimeout(() => {
          insertedMain.style.opacity = "1";
          insertedMain.classList.remove("content-loading");
          insertedFooter.style.opacity = "1";
          setLoading("nav", false);
        }, 45);
      } else {
        setLoading("nav", false);
        window.location.href = absolute;
      }
    })
    .catch(() => {
      setLoading("nav", false);
      window.location.href = absolute;
    });
}

/* ========= Page-specific animations ========= */
function startIndexAnimations() {
  if (window.matchMedia("(max-width: 900px)").matches) return;

  document.body.classList.add("index-prelude");
  setLoading("indexPrelude", true);

  const firstImgs = Array.from(
    document.querySelectorAll(".image-wrapper.jaka1 img.image, .image-wrapper.jaka2 img.image, .image-wrapper.jaka3 img.image")
  );
  const excludeImgs = new Set(firstImgs);

  // Index timing knobs
  const FIRST_IMAGE_DELAY = 180;
  const STAGGER = 112;

  initImageLinks();

  const promises = firstImgs.map(
    (img, i) =>
      new Promise((resolve) => {
        setTimeout(() => revealImg(img, resolve), FIRST_IMAGE_DELAY + i * STAGGER);
      })
  );

  Promise.all(promises).then(() => {
    document.body.classList.remove("index-prelude");
    setLoading("indexPrelude", false);

    initPixelObservers({ excludeImgs });
    initHoverStickyCaptions();
    updateHoverPixelLoading();
  });

  document.querySelectorAll(".image-wrapper").forEach((w) => w.classList.add("ready"));
  document.querySelector("main")?.style && (document.querySelector("main").style.opacity = "1");
}

let infoRevealTimer = null;
let infoPreludeTimer = null; // NEW: for the pause before reveals

function startInfoAnimations() {
  setLoading("infoReveal", true);

  if (infoRevealTimer) clearTimeout(infoRevealTimer);
  if (infoPreludeTimer) clearTimeout(infoPreludeTimer);

  const reveals = document.querySelectorAll(".reveal");
  const INFO_STAGGER = 112;

  // Attach hover listeners immediately (no visual impact; just readiness)
  const setSideHover = (side) => {
    const b = document.body;
    if (side === "left") {
      b.classList.add("focus-left");
      b.classList.remove("focus-right");
    } else if (side === "right") {
      b.classList.add("focus-right");
      b.classList.remove("focus-left");
    }
  };
  const clearSideHover = () => document.body.classList.remove("focus-left", "focus-right");

  document.querySelectorAll('[data-side="left"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("left"));
    el.addEventListener("mouseleave", clearSideHover);
  });
  document.querySelectorAll('[data-side="right"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("right"));
    el.addEventListener("mouseleave", clearSideHover);
  });

  // Ensure main is present (opacity is handled by navigateTo too)
  document.querySelector("main")?.style && (document.querySelector("main").style.opacity = "1");

  // NEW: micro pause before any reveal begins (matches index’s “prelude” feel)
  infoPreludeTimer = setTimeout(() => {
    reveals.forEach((el, i) => {
      setTimeout(() => el.classList.add("visible"), i * INFO_STAGGER);
    });

    const totalMs = INFO_PRELUDE_DELAY + Math.max(0, reveals.length - 1) * INFO_STAGGER + 200;
    infoRevealTimer = setTimeout(() => {
      setLoading("infoReveal", false);
      infoRevealTimer = null;
    }, Math.max(0, totalMs - INFO_PRELUDE_DELAY));

    infoPreludeTimer = null;
  }, INFO_PRELUDE_DELAY);
}

/* ========= Init per page ========= */
function initPageContent() {
  if (preloadIO) {
    preloadIO.disconnect();
    preloadIO = null;
  }
  if (revealIO) {
    revealIO.disconnect();
    revealIO = null;
  }

  if (hoverStickyCaptionsCleanup) hoverStickyCaptionsCleanup();

  document.body.classList.remove("index-prelude");
  setLoading("indexPrelude", false);

  setHoveredWrapperForLoading(null);
  setLoading("infoReveal", false);

  if (infoRevealTimer) {
    clearTimeout(infoRevealTimer);
    infoRevealTimer = null;
  }
  if (infoPreludeTimer) {
    clearTimeout(infoPreludeTimer);
    infoPreludeTimer = null;
  }

  const isInfo = document.body.classList.contains("info-page");
  if (isInfo) startInfoAnimations();
  else startIndexAnimations();
}

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", () => {
  if (!hasSeenIntro) {
    runTopbarAnimation(() => {
      initPageContent();
      bindInternalLinks(document);
    });
  } else {
    showTopbarInstantly();
    initPageContent();
    bindInternalLinks(document);
  }

  window.addEventListener("popstate", () => {
    navigateTo(window.location.pathname + window.location.search, { replace: true });
  });
});

/* ========= Blinking red favicon ========= */
(function () {
  const SIZE = 32;
  const BLINK_INTERVAL = 600;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  let visible = true;

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  function drawDot(show) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (show) {
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 6, 0, Math.PI * 2);
      ctx.fill();
    }
    link.href = canvas.toDataURL("image/png");
  }

  drawDot(true);

  setInterval(() => {
    visible = !visible;
    drawDot(visible);
  }, BLINK_INTERVAL);
})();
