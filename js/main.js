/* ════════════════════════════════════════════════════════════
   Velaxa Clinic — v2
   ════════════════════════════════════════════════════════════ */

/* ── CONFIG — the only values you need to change ───────────────
   WHATSAPP_NUMBER: international format, digits only (no +, no spaces)
   SHEET_ENDPOINT:  Google Apps Script Web App URL. While it is empty the
                    form validates and confirms without sending anywhere.
─────────────────────────────────────────────────────────────── */
const WHATSAPP_NUMBER = "905000000000";
const WHATSAPP_MESSAGE = "Hi Velaxa! I'd like a free consultation for dental implants.";
const SHEET_ENDPOINT = "";

/* ── Data ─────────────────────────────────────────────────── */
/* One row per country: the residence dropdown, the dialling-code dropdown and
   the number-length check all read from here, so adding a country is a
   one-line change and the three can never drift apart.
   `len` is how many digits a national number has (trunk zero excluded). */
const COUNTRIES = [
  { name: "United States",        flag: "\u{1F1FA}\u{1F1F8}", dial: "+1",   len: [10] },
  { name: "Canada",               flag: "\u{1F1E8}\u{1F1E6}", dial: "+1",   len: [10] },
  { name: "United Kingdom",       flag: "\u{1F1EC}\u{1F1E7}", dial: "+44",  len: [9, 10] },
  { name: "Australia",            flag: "\u{1F1E6}\u{1F1FA}", dial: "+61",  len: [9] },
  { name: "Ireland",              flag: "\u{1F1EE}\u{1F1EA}", dial: "+353", len: [7, 8, 9] },
  { name: "Germany",              flag: "\u{1F1E9}\u{1F1EA}", dial: "+49",  len: [6, 7, 8, 9, 10, 11] },
  { name: "France",               flag: "\u{1F1EB}\u{1F1F7}", dial: "+33",  len: [9] },
  { name: "Netherlands",          flag: "\u{1F1F3}\u{1F1F1}", dial: "+31",  len: [9] },
  { name: "Belgium",              flag: "\u{1F1E7}\u{1F1EA}", dial: "+32",  len: [8, 9] },
  { name: "Switzerland",          flag: "\u{1F1E8}\u{1F1ED}", dial: "+41",  len: [9] },
  { name: "Austria",              flag: "\u{1F1E6}\u{1F1F9}", dial: "+43",  len: [7, 8, 9, 10, 11, 12, 13] },
  { name: "Sweden",               flag: "\u{1F1F8}\u{1F1EA}", dial: "+46",  len: [7, 8, 9] },
  { name: "Norway",               flag: "\u{1F1F3}\u{1F1F4}", dial: "+47",  len: [8] },
  { name: "Denmark",              flag: "\u{1F1E9}\u{1F1F0}", dial: "+45",  len: [8] },
  { name: "Finland",              flag: "\u{1F1EB}\u{1F1EE}", dial: "+358", len: [6, 7, 8, 9, 10, 11, 12] },
  { name: "Italy",                flag: "\u{1F1EE}\u{1F1F9}", dial: "+39",  len: [6, 7, 8, 9, 10, 11] },
  { name: "Spain",                flag: "\u{1F1EA}\u{1F1F8}", dial: "+34",  len: [9] },
  { name: "Portugal",             flag: "\u{1F1F5}\u{1F1F9}", dial: "+351", len: [9] },
  { name: "Greece",               flag: "\u{1F1EC}\u{1F1F7}", dial: "+30",  len: [10] },
  { name: "Poland",               flag: "\u{1F1F5}\u{1F1F1}", dial: "+48",  len: [9] },
  { name: "Romania",              flag: "\u{1F1F7}\u{1F1F4}", dial: "+40",  len: [9] },
  { name: "T\u00FCrkiye",          flag: "\u{1F1F9}\u{1F1F7}", dial: "+90",  len: [10] },
  { name: "New Zealand",          flag: "\u{1F1F3}\u{1F1FF}", dial: "+64",  len: [8, 9, 10] },
  { name: "United Arab Emirates", flag: "\u{1F1E6}\u{1F1EA}", dial: "+971", len: [9] },
  { name: "Saudi Arabia",         flag: "\u{1F1F8}\u{1F1E6}", dial: "+966", len: [9] },
  { name: "Qatar",                flag: "\u{1F1F6}\u{1F1E6}", dial: "+974", len: [8] },
  { name: "Kuwait",               flag: "\u{1F1F0}\u{1F1FC}", dial: "+965", len: [8] },
  { name: "Mexico",               flag: "\u{1F1F2}\u{1F1FD}", dial: "+52",  len: [10] },
  { name: "Brazil",               flag: "\u{1F1E7}\u{1F1F7}", dial: "+55",  len: [10, 11] },
  { name: "South Africa",         flag: "\u{1F1FF}\u{1F1E6}", dial: "+27",  len: [9] },
  { name: "Japan",                flag: "\u{1F1EF}\u{1F1F5}", dial: "+81",  len: [10] },
  { name: "Other",                flag: "",                 dial: "",     len: null },
];

/* Lengths keyed by dialling code, derived so the two can never disagree */
const PHONE_LENGTHS = Object.fromEntries(
  COUNTRIES.filter((c) => c.dial).map((c) => [c.dial, c.len])
);

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "Washington D.C.", "West Virginia", "Wisconsin", "Wyoming",
];

const REFERENCES = [
  "Google search", "Facebook / Instagram", "YouTube", "TikTok",
  "Friend or family", "Other",
];


/* Reads "+1 United States" back to "+1" */
const dialOf = (value) => (value || "").split(" ")[0];

/**
 * Returns an error message for a phone number, or "" when it looks valid.
 * Only checks structure — it cannot know whether the line actually exists.
 */
function phoneError(dial, raw) {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "Please enter your WhatsApp number.";

  /* People often paste the country code into the field as well */
  const dialDigits = dial.replace("+", "");
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    const rest = digits.slice(dialDigits.length);
    if ((PHONE_LENGTHS[dial] || []).includes(rest.replace(/^0/, "").length)) digits = rest;
  }
  /* ...and the national trunk zero, e.g. UK 07700 or German 0151 */
  digits = digits.replace(/^0/, "");

  const allowed = PHONE_LENGTHS[dial];
  if (!allowed) return digits.length < 6 ? "This number looks too short." : "";

  if (!allowed.includes(digits.length)) {
    const want = allowed.length === 1
      ? `${allowed[0]} digits`
      : `${allowed[0]}–${allowed[allowed.length - 1]} digits`;
    const off = digits.length < allowed[0] ? "too short" : "too long";
    return `That number is ${off}. A ${dial} number needs ${want} — you entered ${digits.length}.`;
  }

  /* North America: area code and exchange code cannot begin with 0 or 1 */
  if (dial === "+1" && !/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return "That is not a valid US or Canadian number — check the area code.";
  }
  return "";
}

/* ── WhatsApp links ───────────────────────────────────────── */
document.querySelectorAll("[data-whatsapp]").forEach((el) => {
  el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  el.target = "_blank";
  el.rel = "noopener";
});

/* ── Mobile menu ──────────────────────────────────────────── */
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");

navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") closeNav();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNav();
});

function closeNav() {
  navLinks.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open menu");
}

/* ── Hero chip parallax ───────────────────────────────────
   The two floating cards drift a few pixels toward the cursor, each by a
   different amount so they read as sitting at different depths. The easing
   lives in CSS, so this only has to publish two custom properties.
─────────────────────────────────────────────────────────── */
const heroPanel = document.querySelector(".panel");
const heroChips = Array.from(document.querySelectorAll(".chip-card"));
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (heroPanel && heroChips.length && finePointer && !reducedMotion) {
  const TRAVEL = [14, 22]; // px of full-width travel; the far chip moves more
  let box = null; // cached: reading it per event forces a layout on every move
  let queued = false;
  let pending = { x: 0, y: 0 };

  const setDrift = (x, y) =>
    heroChips.forEach((chip, i) => {
      const d = TRAVEL[i] ?? 16;
      chip.style.setProperty("--px", `${(x * d).toFixed(2)}px`);
      chip.style.setProperty("--py", `${(y * d).toFixed(2)}px`);
    });

  /* Coalesce moves into one write per frame */
  const flush = () => {
    queued = false;
    setDrift(pending.x, pending.y);
  };

  heroPanel.addEventListener("pointerenter", () => { box = heroPanel.getBoundingClientRect(); });

  heroPanel.addEventListener("pointermove", (e) => {
    if (!box) box = heroPanel.getBoundingClientRect();
    pending = {
      x: (e.clientX - box.left) / box.width - 0.5,
      y: (e.clientY - box.top) / box.height - 0.5,
    };
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  }, { passive: true });

  heroPanel.addEventListener("pointerleave", () => { box = null; setDrift(0, 0); });
  addEventListener("resize", () => { box = null; }, { passive: true });
}

/* ── Certification marquee ────────────────────────────────
   Clones the logo list until the track is at least twice the visible width,
   then mirrors the whole thing once more so translateX(-50%) loops with no
   visible seam. Add a logo in the HTML and this rebalances on its own.
─────────────────────────────────────────────────────────── */
document.querySelectorAll(".marquee-track").forEach((track) => {
  const base = Array.from(track.children);
  const viewport = track.parentElement;
  if (!base.length) return;

  const clone = (node) => {
    const copy = node.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    /* clones must not stay hidden waiting for a scroll reveal that never fires */
    copy.classList.remove("rv");
    track.appendChild(copy);
  };

  /* Fill the visible width first (guarded so a zero-width track can't spin) */
  for (let i = 0; i < 20 && track.scrollWidth < viewport.offsetWidth; i++) {
    base.forEach(clone);
  }
  /* Then duplicate everything exactly once for the seamless wrap */
  Array.from(track.children).forEach(clone);
});

/* ── Package illustration galleries ───────────────────────
   Arrows, dots, keyboard and swipe over a flex track. Works for any number of
   slides, so a third illustration is just another <img> in the markup.
─────────────────────────────────────────────────────────── */
document.querySelectorAll("[data-gallery]").forEach((gallery) => {
  const track = gallery.querySelector("[data-track]");
  const dots = gallery.querySelector("[data-dots]");
  const slides = Array.from(track.children);
  if (slides.length < 2) {
    gallery.querySelectorAll("button").forEach((b) => b.remove());
    return;
  }

  let index = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Illustration ${i + 1} of ${slides.length}`);
    dot.addEventListener("click", () => go(i));
    dots.appendChild(dot);
  });

  function go(next) {
    index = (next + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    Array.from(dots.children).forEach((d, i) =>
      d.setAttribute("aria-current", String(i === index))
    );
    /* keep off-screen slides out of the tab order and the a11y tree */
    slides.forEach((s, i) => (i === index ? s.removeAttribute("aria-hidden")
                                          : s.setAttribute("aria-hidden", "true")));
  }

  gallery.querySelector("[data-prev]").addEventListener("click", () => go(index - 1));
  gallery.querySelector("[data-next]").addEventListener("click", () => go(index + 1));

  gallery.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
  });

  /* ── Drag / swipe ──
     The track follows the pointer live, then snaps on release. Pointer capture
     is what makes it reliable: without it the browser hands the gesture to its
     own image-drag or scroll handling and we never see the pointerup. */
  let startX = 0, startY = 0, dragging = false;

  const setOffset = (px) => {
    track.style.transform = `translateX(calc(${-index * 100}% + ${px}px))`;
  };

  gallery.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    track.style.transition = "none";
    gallery.setPointerCapture(e.pointerId);
  });

  gallery.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    /* a clearly vertical gesture is a page scroll, not a swipe — let it go */
    if (Math.abs(e.clientY - startY) > Math.abs(dx) + 10) {
      dragging = false;
      track.style.transition = "";
      go(index);
      return;
    }
    setOffset(dx);
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    track.style.transition = "";
    const dx = e.clientX - startX;
    /* a tenth of the card, or 40px, whichever is smaller */
    const threshold = Math.min(40, gallery.offsetWidth * 0.1);
    if (Math.abs(dx) > threshold) go(index + (dx < 0 ? 1 : -1));
    else go(index);
  };

  gallery.addEventListener("pointerup", endDrag);
  gallery.addEventListener("pointercancel", () => {
    if (!dragging) return;
    dragging = false;
    track.style.transition = "";
    go(index);
  });

  go(0);
});

/* ── Before / after sliders ───────────────────────────────── */
document.querySelectorAll("[data-ba]").forEach((box) => {
  const range = box.querySelector("input[type=range]");
  range.addEventListener("input", () => {
    box.style.setProperty("--pos", `${range.value}%`);
  });
});

/* ── Lead forms ───────────────────────────────────────────── */
document.querySelectorAll("form.lead-form").forEach(initLeadForm);

function initLeadForm(form) {
  const country = form.querySelector("[data-country]");
  const state = form.querySelector("[data-state]");
  const code = form.querySelector("[data-code]");
  const ref = form.querySelector("[data-ref]");
  const stateField = form.querySelector(".state-f");
  const status = form.querySelector(".f-status");
  const submit = form.querySelector("button[type=submit]");
  const submitLabel = submit.textContent;

  COUNTRIES.forEach((c) => country.add(new Option(c.name, c.name)));
  US_STATES.forEach((s) => state.add(new Option(s, s)));
  COUNTRIES.filter((c) => c.dial).forEach((c) =>
    code.add(new Option(`${c.flag} ${c.dial}`, `${c.dial} ${c.name}`))
  );
  /* The short hero form omits Reference; the full form below has it */
  if (ref) REFERENCES.forEach((r) => ref.add(new Option(r, r)));

  /* ── WhatsApp number: reject a wrong digit count before it is submitted ── */
  const phone = form.querySelector('input[type="tel"]');
  const phoneNote = document.createElement("p");
  phoneNote.className = "f-error";
  phoneNote.hidden = true;
  phone.closest(".f").appendChild(phoneNote);

  const showPhoneError = (msg) => {
    phoneNote.textContent = msg;
    phoneNote.hidden = !msg;
    phone.classList.toggle("bad", Boolean(msg));
    phone.setAttribute("aria-invalid", msg ? "true" : "false");
  };

  const checkPhone = () => {
    const msg = phone.value.trim() ? phoneError(dialOf(code.value), phone.value) : "";
    showPhoneError(msg);
    return !msg;
  };

  phone.addEventListener("blur", checkPhone);
  /* Re-check on code change, but only once they've typed something */
  code.addEventListener("change", () => { if (phone.value.trim()) checkPhone(); });
  /* Clear the complaint while they are fixing it, don't nag mid-typing */
  phone.addEventListener("input", () => showPhoneError(""));

  country.addEventListener("change", () => {
    /* The state dropdown only applies to US residents */
    const isUS = country.value === "United States";
    stateField.classList.toggle("hidden", !isUS);
    state.required = isUS;
    if (!isUS) state.value = "";

    /* Follow the country they just picked with the matching dialling code, so
       the number check applies the rules for where they actually live. They can
       still override it afterwards if their number is from somewhere else. */
    const picked = COUNTRIES.find((c) => c.name === country.value);
    if (picked && picked.dial) {
      code.value = `${picked.dial} ${picked.name}`;
      if (phone.value.trim()) checkPhone();
    }
  });


  form.addEventListener("input", (e) => e.target.classList.remove("bad"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let valid = true;
    form.querySelectorAll("[required]").forEach((field) => {
      const empty = !field.value.trim();
      field.classList.toggle("bad", empty);
      if (empty) valid = false;
    });
    if (!valid) return setStatus("Please fill in the highlighted fields.", "err");

    if (!checkPhone()) {
      phone.focus();
      return setStatus("Please check your WhatsApp number.", "err");
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.submittedAt = new Date().toISOString();
    data.page = location.href;

    submit.disabled = true;
    submit.textContent = "Sending…";

    try {
      if (SHEET_ENDPOINT) {
        /* Apps Script needs text/plain to avoid a CORS preflight */
        await fetch(SHEET_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        });
      } else {
        console.info("SHEET_ENDPOINT not set — lead not sent:", data);
      }
      form.reset();
      country.dispatchEvent(new Event("change"));
      setStatus("Thank you! Our team will reach you on WhatsApp within an hour.", "ok");
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong — please try again or message us on WhatsApp.", "err");
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = `f-status ${kind}`;
  }
}

/* ── Reveal on scroll ─────────────────────────────────────── */
/* .chip-card is deliberately absent: it owns its transform for the pointer
   parallax below, and the reveal animation would fight it for the property. */
const revealTargets = document.querySelectorAll(
  ".section-head, .tile, .ba-card, .score, .plan, .book-panel, .hero-card"
);
revealTargets.forEach((el) => el.classList.add("rv"));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      io.unobserve(entry.target);
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

/* ── Footer year ──────────────────────────────────────────── */
document.getElementById("year").textContent = new Date().getFullYear();
