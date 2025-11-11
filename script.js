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
  initImageLinks();

  document.querySelectorAll(".image-wrapper").forEach(w => w.classList.add("ready"));
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

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", () => {
  if (!hasSeenIntro) {
    runTopbarAnimation(() => {
      if (document.body.classList.contains("info-page")) startInfoAnimations();
      else startIndexAnimations();
    });
  } else {
    showTopbarInstantly();
    if (document.body.classList.contains("info-page")) startInfoAnimations();
    else startIndexAnimations();
  }

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
