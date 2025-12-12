/* ========= Session-aware topbar intro ========= */
const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");

/* Full topbar animation: name → dots → rest of topbar */
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
          }, i * 100); // faster cascade
        });

        const afterMs = topbarEls.length * 100 + 250;

        setTimeout(() => {
          sessionStorage.setItem("hasSeenIntro", "true");
          callback && callback();
        }, afterMs);
      }, 150);
    }
  }, 250); // dot speed unchanged
}

function showTopbarInstantly() {
  document.body.classList.add("instant-topbar");
  document
    .querySelectorAll(".topbar .col")
    .forEach((el) => (el.style.opacity = "1"));
}

/* ========= Page-specific animations ========= */
function startIndexAnimations() {
  const images = document.querySelectorAll(".image");
  const wrappers = document.querySelectorAll(".image-wrapper");

  /* reset state safely (classes only) */
  images.forEach((img) => {
    img.classList.remove("visible", "loaded", "inview");
  });

  /* reveal only first three images */
  const firstImgs = document.querySelectorAll(
    ".image-wrapper.jaka1 .image, .image-wrapper.jaka2 .image, .image-wrapper.jaka3 .image"
  );

  firstImgs.forEach((img, i) => {
    setTimeout(() => img.classList.add("visible"), i * 112);
  });

  initLazyLoad();
  initImageLinks();

  wrappers.forEach((w) => w.classList.add("ready"));
}

function startInfoAnimations() {
  const reveals = document.querySelectorAll(".reveal");

  reveals.forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), i * 112);
  });

  const setSideHover = (side) => {
    document.body.classList.toggle("focus-left", side === "left");
    document.body.classList.toggle("focus-right", side === "right");
  };

  const clearSideHover = () => {
    document.body.classList.remove("focus-left", "focus-right");
  };

  document.querySelectorAll('[data-side="left"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("left"));
    el.addEventListener("mouseleave", clearSideHover);
  });

  document.querySelectorAll('[data-side="right"]').forEach((el) => {
    el.addEventListener("mouseenter", () => setSideHover("right"));
    el.addEventListener("mouseleave", clearSideHover);
  });
}

/* ========= Lazy Loading ========= */
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

/* ========= Clickable Images ========= */
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

/* ========= Bind internal navigation ========= */
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
  const absolute = new URL(href, location.href).href;

  fetch(absolute, { credentials: "same-origin" })
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newMain = doc.querySelector("main");
      const newFooter = doc.querySelector("footer");

      if (!newMain || !newFooter) {
        location.href = absolute;
        return;
      }

      document.querySelector("main").replaceWith(newMain);
      document.querySelector("footer").replaceWith(newFooter);

      const insertedMain = document.querySelector("main");
      const insertedFooter = document.querySelector("footer");

      insertedMain.classList.add("content-loading");
      insertedMain.style.opacity = "0";
      insertedFooter.style.opacity = "0";

      document.body.className = doc.body.className;
      document.title = doc.title;

      replace
        ? history.replaceState({}, "", absolute)
        : history.pushState({}, "", absolute);

      bindInternalLinks(document);
      initPageContent();

      /* wait one paint frame before revealing */
      requestAnimationFrame(() => {
        setTimeout(() => {
          insertedMain.style.opacity = "1";
          insertedMain.classList.remove("content-loading");
          insertedFooter.style.opacity = "1";
        }, 45);
      });

      scrollTo(0, 0);
    })
    .catch(() => (location.href = absolute));
}

/* ========= Init per page ========= */
function initPageContent() {
  document.body.classList.contains("info-page")
    ? startInfoAnimations()
    : startIndexAnimations();
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
    navigateTo(location.pathname + location.search, { replace: true });
  });
});
