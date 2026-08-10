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
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Ireland",
  "Germany", "France", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Sweden", "Norway", "Denmark", "Finland", "Italy", "Spain", "Portugal",
  "Greece", "Poland", "Romania", "New Zealand", "United Arab Emirates",
  "Saudi Arabia", "Qatar", "Kuwait", "Mexico", "Brazil", "South Africa",
  "Japan", "Other",
];

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

/* USA first, per the brief */
const PHONE_CODES = [
  ["+1", "🇺🇸 USA"], ["+1", "🇨🇦 Canada"], ["+44", "🇬🇧 UK"],
  ["+61", "🇦🇺 Australia"], ["+353", "🇮🇪 Ireland"], ["+49", "🇩🇪 Germany"],
  ["+33", "🇫🇷 France"], ["+31", "🇳🇱 Netherlands"], ["+32", "🇧🇪 Belgium"],
  ["+41", "🇨🇭 Switzerland"], ["+43", "🇦🇹 Austria"], ["+46", "🇸🇪 Sweden"],
  ["+47", "🇳🇴 Norway"], ["+45", "🇩🇰 Denmark"], ["+358", "🇫🇮 Finland"],
  ["+39", "🇮🇹 Italy"], ["+34", "🇪🇸 Spain"], ["+351", "🇵🇹 Portugal"],
  ["+30", "🇬🇷 Greece"], ["+48", "🇵🇱 Poland"], ["+40", "🇷🇴 Romania"],
  ["+64", "🇳🇿 New Zealand"], ["+971", "🇦🇪 UAE"], ["+966", "🇸🇦 Saudi Arabia"],
  ["+974", "🇶🇦 Qatar"], ["+965", "🇰🇼 Kuwait"], ["+52", "🇲🇽 Mexico"],
  ["+55", "🇧🇷 Brazil"], ["+27", "🇿🇦 South Africa"], ["+81", "🇯🇵 Japan"],
];

const REFERENCES = [
  "Google search", "Facebook / Instagram", "YouTube", "TikTok",
  "Friend or family", "Other",
];

/* How many digits a national number has, per dialling code. Enough to reject a
   number that is too short or too long before it ever reaches the sales team,
   without pulling in a full phone-metadata library. */
const PHONE_LENGTHS = {
  "+1": [10], "+44": [9, 10], "+61": [9], "+353": [7, 8, 9], "+49": [6, 7, 8, 9, 10, 11],
  "+33": [9], "+31": [9], "+32": [8, 9], "+41": [9], "+43": [7, 8, 9, 10, 11, 12, 13],
  "+46": [7, 8, 9], "+47": [8], "+45": [8], "+358": [6, 7, 8, 9, 10, 11, 12],
  "+39": [6, 7, 8, 9, 10, 11], "+34": [9], "+351": [9], "+30": [10], "+48": [9],
  "+40": [9], "+64": [8, 9, 10], "+971": [9], "+966": [9], "+974": [8], "+965": [8],
  "+52": [10], "+55": [10, 11], "+27": [9], "+81": [10],
};

/* Reads "+1 🇺🇸 USA" back to "+1" */
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

  COUNTRIES.forEach((c) => country.add(new Option(c, c)));
  US_STATES.forEach((s) => state.add(new Option(s, s)));
  PHONE_CODES.forEach(([c, label]) => code.add(new Option(`${label} ${c}`, `${c} ${label}`)));
  /* The short hero form omits Reference; the full form below has it */
  if (ref) REFERENCES.forEach((r) => ref.add(new Option(r, r)));

  /* The state dropdown only applies to US residents */
  country.addEventListener("change", () => {
    const isUS = country.value === "United States";
    stateField.classList.toggle("hidden", !isUS);
    state.required = isUS;
    if (!isUS) state.value = "";
  });

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
