/* ========= Session-aware topbar intro ========= */
const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");

/* ========= CODED favicon blink (original-style) ========= */
function startFaviconBlink() {
  const favicon = document.querySelector("link[rel='icon']");
  if (!favicon) return;

  const frames = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
       <rect width="64" height="64" fill="white"/>
     </svg>`,

    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
       <rect width="64" height="64" fill="white"/>
       <text x="32" y="42" font-size="32" text-anchor="middle" fill="black">.</text>
     </svg>`
  ];

  let i = 0;
  setInterval(() => {
    favicon.href =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(frames[i % frames.length]);
    i++;
  }, 250);
}

/* ========= Topbar animation ========= */
function runTopbarAnimation(callback) {
  const nameEl = document.querySelector(".name");
  const ellipsis = document.querySelector(".ellipsis");
  if (!nameEl || !ellipsis) {
    callback && callback();
    return;
  }

  const states = ["", ".", "..", "..."];
  let index = 0;
  let loops = 0;

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
          }, i * 100); // 25% faster
        });

        const afterMs = topbarEls.length * 100 + 250;

        setTimeout(() => {
          sessionStorage.setItem("hasSeenIntro", "true");
          callback && callback();
        }, afterMs);
      }, 150);
    }
  }, 250);
}

function showTopbarInstantly() {
  document.body.classList.add("instant-topbar");
  document.querySelectorAll(".topbar .col").forEach((el) => {
    el.style.opacity = "1";
  });
}

/* ========= Index page animations ========= */
function startIndexAnimations() {
  const media = document.querySelectorAll(".image");

  /* 1) hide everything */
  media.forEach((el) => el.classList.remove("visible"));

  /* 2) stagger first three */
  const firstMedia = document.querySelectorAll(
    ".image-wrapper.jaka1 .image, .image-wrapper.jaka2 .image, .image-wrapper.jaka3 .image"
  );

  const stagger = 112;
  const total = firstMedia.length * stagger;

  firstMedia.forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), i * stagger);
  });

  /* 3) reveal rest AFTER stagger */
  setTimeout(() => {
    media.forEach((el) => el.classList.add("visible"));
  }, total + 20);

  initLazyLoad();
  initImageLinks();

  document.querySelectorAll(".image-wrapper").forEach((w) =>
    w.classList.add("ready")
  );

  document.querySelector("main").style.opacity = "1";
}

/* ========= Info page animations ========= */
function startInfoAnimations() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), i * 112);
  });

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

  const clearSideHover = () =>
    document.body.classList.remove("focus-left", "focus-right");

  document.querySelectorAll('[data-side="left"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("left"));
    el.addEventListener("mouseleave", clearSideHover);
  });
  document.querySelectorAll('[data-side="right"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("right"));
    el.addEventListener("mouseleave", clearSideHover);
  });

  document.querySelector("main").style.opacity = "1";
}

/* ========= Lazy loading ========= */
function initLazyLoad() {
  const lazyImgs = document.querySelectorAll(".image.lazy");
  if (!lazyImgs.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.classList.add("inview");

        const hi = new Image();
        hi.src = img.dataset.src || img.src;
        hi.onload = () => {
          img.src = hi.src;
          img.classList.add("loaded");
        };

        io.unobserve(img);
      });
    },
    { threshold: 0.12 }
  );

  lazyImgs.forEach((img) => io.observe(img));
}

/* ========= Clickable images ========= */
function initImageLinks() {
  document.querySelectorAll(".image").forEach((img) => {
    if (img.dataset?.link) {
      img.style.cursor = "alias";
      img.onclick = () => window.open(img.dataset.link, "_blank");
    }
  });
}

/* ========= Grid overlay toggle ========= */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "g") {
    document.body.classList.toggle("show-grid");
  }
});

/* ========= Internal navigation ========= */
function bindInternalLinks(scope = document) {
  scope.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (
      !href ||
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      link.target === "_blank"
    )
      return;

    link.onclick = (e) => {
      e.preventDefault();
      navigateTo(href);
    };
  });
}

/* ========= Soft navigation ========= */
function navigateTo(href, { replace = false } = {}) {
  const absolute = new URL(href, window.location.href).href;

  fetch(absolute, { credentials: "same-origin" })
    .then((res) => res.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newMain = doc.querySelector("main");
      const newFooter = doc.querySelector("footer");

      if (!newMain || !newFooter) {
        window.location.href = absolute;
        return;
      }

      document.querySelector("main").replaceWith(newMain);
      document.querySelector("footer").replaceWith(newFooter);

      document.body.className = doc.body.className;
      document.title = doc.title;

      replace
        ? history.replaceState({}, "", absolute)
        : history.pushState({}, "", absolute);

      bindInternalLinks(document);
      initPageContent();

      setTimeout(() => {
        document.querySelector("main").style.opacity = "1";
        document.querySelector("footer").style.opacity = "1";
      }, 45);

      window.scrollTo(0, 0);
    })
    .catch(() => (window.location.href = absolute));
}

/* ========= Init ========= */
function initPageContent() {
  document.body.classList.contains("info-page")
    ? startInfoAnimations()
    : startIndexAnimations();
}

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", () => {
  startFaviconBlink();

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
    navigateTo(location.pathname + location.search, { replace: true });
  });
});
