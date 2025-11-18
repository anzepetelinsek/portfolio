/* ========= Session-aware topbar intro ========= */
const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");

/* Full topbar animation: name → dots → rest of topbar */
function runTopbarAnimation(callback) {
  const nameEl = document.querySelector(".name");
  const ellipsis = document.querySelector(".ellipsis");
  if (!nameEl || !ellipsis) {
    if (callback) callback();
    return;
  }
  const states = ["", ".", "..", "..."];
  let index = 0, loops = 0;

  // Show name + dots
  nameEl.style.opacity = "1";
  ellipsis.style.opacity = "1";

  // Dot loop twice
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
          }, i * 135);
        });

        const afterMs = topbarEls.length * 135 + 250;
        setTimeout(() => {
          sessionStorage.setItem("hasSeenIntro", "true");
          if (callback) callback();
        }, afterMs);
      }, 150);
    }
  }, 250);
}

function showTopbarInstantly() {
  document.body.classList.add("instant-topbar");
  document.querySelectorAll(".topbar .col").forEach(el => el.style.opacity = "1");
}

/* ========= Page-specific animations ========= */
function startIndexAnimations() {
  // First three images: hard-cut sequence
  const firstImgs = document.querySelectorAll(
    ".image-wrapper.jaka1 .image, .image-wrapper.jaka2 .image, .image-wrapper.jaka3 .image"
  );
  firstImgs.forEach((img, i) => setTimeout(() => img.classList.add("visible"), i * 150));

  // Lazy load
  initLazyLoad();
  // Clickable links on images
  initImageLinks();
  // Enable caption hovers
  document.querySelectorAll(".image-wrapper").forEach(w => w.classList.add("ready"));

  const main = document.querySelector("main");
  if (main) main.classList.remove("content-loading");
}

function startInfoAnimations() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((el, i) => setTimeout(() => el.classList.add("visible"), i * 150));

  const setSideHover = (side) => {
    const b = document.body;
    if (side === "left") { b.classList.add("focus-left"); b.classList.remove("focus-right"); }
    else if (side === "right") { b.classList.add("focus-right"); b.classList.remove("focus-left"); }
  };
  const clearSideHover = () => document.body.classList.remove("focus-left","focus-right");

  document.querySelectorAll('[data-side="left"]').forEach(el=>{
    el.addEventListener('mouseenter',()=>setSideHover('left'));
    el.addEventListener('mouseleave',clearSideHover);
  });
  document.querySelectorAll('[data-side="right"]').forEach(el=>{
    el.addEventListener('mouseenter',()=>setSideHover('right'));
    el.addEventListener('mouseleave',clearSideHover);
  });
}

/* ========= Lazy Loading ========= */
function initLazyLoad(){
  const lazyImgs = document.querySelectorAll('.image.lazy');
  if (!lazyImgs.length) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const img = entry.target;
      img.classList.add('inview');
      const hi = new Image();
      hi.src = img.dataset.src || img.src;
      hi.onload = ()=>{ img.src = hi.src; img.classList.add('loaded'); };
      io.unobserve(img);
    });
  }, { threshold: 0.12 });
  lazyImgs.forEach(i=>io.observe(i));
}

/* ========= Clickable Images ========= */
function initImageLinks(){
  document.querySelectorAll('.image').forEach(img=>{
    if(img.dataset && img.dataset.link){
      img.style.cursor = 'alias';
      img.addEventListener('click',()=>window.open(img.dataset.link,'_blank'));
    }
  });
}

/* ========= Grid overlay toggle ========= */
document.addEventListener('keydown', e=>{
  if(e.key.toLowerCase()==='g') document.body.classList.toggle('show-grid');
});

/* ========= Bind internal navigation (persist header) ========= */
function bindInternalLinks(scope = document) {
  scope.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#') || link.target === '_blank') return;

    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(href);
    });
  });
}

function navigateTo(href, { replace = false } = {}) {
  const absolute = new URL(href, window.location.href).href;

  fetch(absolute, { credentials: 'same-origin' })
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newMain = doc.querySelector('main');
      const newFooter = doc.querySelector('footer');
      const newTitle = doc.querySelector('title')?.textContent || document.title;
      const newBodyClass = doc.body.className;

      if (newMain && newFooter) {
        document.querySelector('main').replaceWith(newMain);
        document.querySelector('footer').replaceWith(newFooter);

        document.body.className = newBodyClass;

        showTopbarInstantly();

        document.title = newTitle;

        if (replace) history.replaceState({}, '', absolute);
        else history.pushState({}, '', absolute);

        bindInternalLinks(document);

        initPageContent();

        /* ✅ ALWAYS RESET SCROLL AFTER SOFT NAVIGATION */
        window.scrollTo(0, 0);

      } else {
        window.location.href = absolute;
      }
    })
    .catch(() => window.location.href = absolute);
}

/* ========= Init per page ========= */
function initPageContent() {
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

  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname + window.location.search, { replace: true });
  });

  /* ========= 🔴 Blinking red dot favicon ========= */
  const favicon = document.querySelector("link[rel='icon']") || document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);

  function makeIcon(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (color) {
      ctx.beginPath();
      ctx.arc(16, 16, 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    return canvas.toDataURL('image/png');
  }

  let on = false;
  setInterval(() => {
    favicon.href = makeIcon(on ? 'red' : '');
    on = !on;
  }, 600);
});

window.addEventListener("pageshow", () => window.scrollTo(0, 0));
