/* =================================================================
   CONFIG — the scaling seam.
   Each service is one entry: id, card copy, icon, and its own scope
   question. Adding a future service (e.g. "vastu consultation",
   "site supervision") = append an entry here; the journey, the
   Formspree payload and the tracking all pick it up automatically.
   ================================================================= */
var ENDPOINT = "https://formspree.io/f/mzebbbej";

/* The enquiry itself, into the platform. Formspree stays an INBOX; this is the
   pipeline -- one LeadQuery row, which is what puts the enquiry in the admin
   Business Enquiries queue where it gets scored, qualified and matched to a
   verified business. Formspree alone reached none of that.

   The SHARED public enquiry door, not a funnel-only one: every form on the site
   posts here, and a second endpoint would be a second set of rules to keep in
   step with the first.

   PROD IS THE ONE THAT COUNTS -- it is the queue somebody actually works.
   LEAD_API_TEST is a copy of the same submission to dev so the flow stays
   observable there while this is being worked on; nothing is read back off it
   and its failure is invisible. Same arrangement the premium funnel runs.
   NOTE that this doubles every real enquiry into the dev database: dev's
   Business Enquiries queue will carry a copy of every live lead, so it is no
   longer a clean environment to demo from. Drop LEAD_API_TEST from TARGETS
   when the mirror has served its purpose. */
var LEAD_API       = "https://prod.interiorbazzar.com/api/v1/query/create/";
var LEAD_API_TEST  = "https://dev.interiorbazzar.com/api/v1/query/create/";
var LEAD_API_LOCAL = "http://127.0.0.1:8000/api/v1/query/create/";

/* Served from a laptop, or from the internet. Decided from the HOST rather than
   by editing a URL and remembering to change it back -- a localhost URL that
   reached Netlify would drop every real enquiry on the floor, silently, because
   these POSTs are fire-and-forget and nothing would report the failure.
   Empty hostname is a file:// open, which is a local checkout too. */
function isLocal(){
  var h = location.hostname;
  return !h || h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/* A local checkout talks ONLY to the local backend -- it must never reach prod,
   and mirroring a developer's test typing into dev is the same noise this
   mirror exists to avoid. */
function leadTargets(){
  return isLocal() ? [LEAD_API_LOCAL] : [LEAD_API, LEAD_API_TEST];
}

var ICONS = {
  home:   '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  office: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/></svg>',
  reno:   '<svg viewBox="0 0 24 24"><path d="M14.5 4.5a4.6 4.6 0 00-6.4 5.7L3 15.3V21h5.7l5.1-5.1a4.6 4.6 0 005.7-6.4l-3.2 3.2-3-3 3.2-3.2z"/></svg>',
  pro:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>'
};

var SERVICES = [
  { id:"home_interior", label:"Home interior", small:"New home, full or partial",
    icon:"home",
    scopeQ:"What kind of home is it?",
    scopeHint:"Helps us match a business that handles your size of project.",
    scopes:["1 BHK","2 BHK","3 BHK","4+ BHK / Villa / Duplex"] },
  { id:"commercial_space", label:"Commercial space", small:"Office, retail, café & more",
    icon:"office",
    scopeQ:"What kind of space?",
    scopeHint:"Commercial projects are matched to businesses with fit-out experience.",
    scopes:["Office","Retail / Showroom","Restaurant / Café","Clinic / Hospitality","Other commercial"] },
  { id:"renovation", label:"Renovation", small:"Upgrade an existing space",
    icon:"reno",
    scopeQ:"What are you renovating?",
    scopeHint:"Pick the closest — you can explain details to the business later.",
    scopes:["Full home","Kitchen","Bathroom","Office / Shop","Other renovation"] },
  { id:"business_designer", label:"Designer for my business", small:"I run an interior business",
    icon:"pro",
    scopeQ:"What do you need the designer for?",
    scopeHint:"We connect interior businesses with professionals from our network.",
    scopes:["Full-time designer","Project-based designer","3D / drawing support","Not sure yet"] }
];

var TIMELINES = ["Ready to start now","Within 1 month","In 1–3 months","Just exploring"];

/* Our wording -> the four bands LeadQuery.timeline stores. LOAD-BEARING: the
   backend takes a key from this list and nothing else, and the band it lands in
   is the urgency signal the enquiry is scored on. Rename an option above and
   this map has to follow it. */
var TIMELINE_KEY = {
  "Ready to start now": "30d",
  "Within 1 month":     "30d",
  "In 1–3 months":      "90d",
  "Just exploring":     "browsing"
};
var BUDGETS   = ["Under ₹1 lakh","₹1–3 lakh","₹3–10 lakh","₹10 lakh+","Not decided yet"];

/* =================================================================
   Analytics — everything lands in dataLayer (GTM listens) and
   mirrors to gtag/fbq when present. Safe no-op without IDs.
   ================================================================= */
window.dataLayer = window.dataLayer || [];
function track(name, params){
  try{ window.dataLayer.push(Object.assign({event:name}, params||{})); }catch(e){}
  try{ if(typeof window.gtag==="function") window.gtag("event", name, params||{}); }catch(e){}
}

/* UTM capture — attributed lead > anonymous lead */
var UTM = {};
try{
  var sp = new URLSearchParams(location.search);
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(function(k){
    if(sp.get(k)) UTM[k] = sp.get(k);
  });
}catch(e){}

/* =================================================================
   Step engine — full-screen app flow: header back button, dynamic
   subtitle, option grid in the body, sticky Continue in the footer
   that stays disabled until the step is answered.
   ================================================================= */
var state = { service:null, scope:null, city:"", pincode:"", timeline:null, budget:null,
              name:"", phone:"", consent:false };
var stepIdx = 0;
var TOTAL_STEPS = 5;
var submitting = false;
var doneShown = false;
/* The enquiry is created ONCE per visitor, not once per attempt. A failed
   Formspree POST puts the visitor back on the form with a retry button, and
   the enquiry is already in the pipeline by then -- without this, every
   retry files another copy of the same person against the same number. */
var leadSent = false;
var body = document.getElementById("fcbody");
var prog = document.getElementById("prog");
var maxStepSeen = -1;

function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

function svc(){ return SERVICES.filter(function(s){return s.id===state.service;})[0] || null; }

function stepQuestion(){
  switch(stepIdx){
    case 0: return "What do you need?";
    case 1: return svc() ? svc().scopeQ : "";
    case 2: return "Where is the project?";
    case 3: return "When do you want to start?";
    case 4: return "Where should the business reach you?";
  }
  return "";
}

var privacyNote = '<p class="fc-note"><svg viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"/></svg>' +
  '<span>Your details are shared only with Interior bazzar and the one matched business — never broadcast or resold.</span></p>';

/* one compact option card; icon is optional */
function opt(attr, val, label, sel, iconHtml){
  return '<button type="button" class="opt'+(sel?" sel":"")+'" data-'+attr+'="'+esc(val)+'">' +
    (iconHtml||'') + '<span class="olb">'+esc(label)+'</span></button>';
}

function render(){
  prog.style.width = Math.round(((stepIdx+1)/TOTAL_STEPS)*100) + "%";
  if(stepIdx > maxStepSeen){ maxStepSeen = stepIdx; track("lead_step_view", {step: stepIdx+1, service: state.service||""}); }
  switch(stepIdx){

    case 0: /* service — renders from config */
      body.innerHTML =
        '<p class="fc-q">What do you need?</p>' +
        '<p class="fc-hint">Pick the closest — details come next.</p>' +
        '<div class="optgrid">' + SERVICES.map(function(s){
          return opt("service", s.id, s.label, state.service===s.id, '<span class="oic">'+ICONS[s.icon]+'</span>');
        }).join("") + '</div>' + privacyNote;
      break;

    case 1: /* scope — question comes from the chosen service's config */
      var s = svc();
      body.innerHTML =
        '<p class="fc-q">'+esc(s.scopeQ)+'</p>' +
        '<p class="fc-hint">'+esc(s.scopeHint)+'</p>' +
        '<div class="optgrid">' + s.scopes.map(function(sc){
          return opt("scope", sc, sc, state.scope===sc);
        }).join("") + '</div>';
      break;

    case 2: /* location */
      body.innerHTML =
        '<p class="fc-q">Where is the project?</p>' +
        '<p class="fc-hint">We match you with a business that serves your area.</p>' +
        '<div class="field"><label for="f-city">City</label>' +
          '<input id="f-city" type="text" autocomplete="address-level2" placeholder="e.g. Indore" value="'+esc(state.city)+'" />' +
          '<p class="ferr" id="e-city">Please enter a real city name.</p></div>' +
        '<div class="field"><label for="f-pin">Pincode <span class="optional">(optional, sharpens the match)</span></label>' +
          '<input id="f-pin" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="6" placeholder="6-digit pincode" value="'+esc(state.pincode)+'" />' +
          '<p class="ferr" id="e-pin">Enter a real 6-digit pincode.</p></div>';
      break;

    case 3: /* timeline + budget */
      body.innerHTML =
        '<p class="fc-q">When do you want to start?</p>' +
        '<p class="fc-hint">"Just exploring" is a perfectly good answer.</p>' +
        '<div class="optgrid">' + TIMELINES.map(function(t){
          return opt("timeline", t, t, state.timeline===t);
        }).join("") + '</div>' +
        '<p class="fc-q" style="margin-top:20px;font-size:16px">Rough budget <span style="font-weight:400;color:var(--muted);font-size:13px">(optional)</span></p>' +
        '<div class="optgrid">' + BUDGETS.map(function(b){
          return opt("budget", b, b, state.budget===b);
        }).join("") + '</div>';
      break;

    case 4: /* contact + consent */
      body.innerHTML =
        '<p class="fc-q">Where should the business reach you?</p>' +
        '<p class="fc-hint">One matched business — call or WhatsApp.</p>' +
        '<div class="field"><label for="f-name">Your name</label>' +
          '<input id="f-name" type="text" autocomplete="name" placeholder="Full name" value="'+esc(state.name)+'" />' +
          '<p class="ferr" id="e-name">Please enter your full name.</p></div>' +
        '<div class="field"><label for="f-phone">Mobile number</label>' +
          '<div class="phonewrap"><span class="cc">+91</span>' +
          '<input id="f-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="10-digit mobile" value="'+esc(state.phone)+'" /></div>' +
          '<p class="ferr" id="e-phone">Enter a valid 10-digit Indian mobile number.</p></div>' +
        /* honeypot — hidden from humans, bots fill it */
        '<input type="text" name="_gotcha" id="f-gotcha" style="display:none" tabindex="-1" autocomplete="off" />' +
        '<label class="consent" id="consentrow"><input type="checkbox" id="f-consent"'+(state.consent?" checked":"")+' />' +
          '<span>I agree to be contacted by Interior bazzar and one matched interior business about this enquiry, via call/WhatsApp, and to the <a href="https://interiorbazzar.com/privacy-policy" target="_blank" rel="noopener">privacy policy</a>.</span></label>' +
        '<p class="ferr" id="e-consent">Please tick the box so the business is allowed to contact you.</p>' + privacyNote;
      break;
  }
  var sub = document.getElementById("fssub");
  if(sub) sub.textContent = stepQuestion();
  var foot = document.querySelector(".fs-foot");
  if(foot) foot.style.display = "";
  wire();
  updateFoot();
  var mc = document.querySelector(".fc-body");
  if(mc) mc.scrollTop = 0;
}

/* footer Continue: disabled until the step is answered */
function updateFoot(){
  var f = document.getElementById("fsnext");
  if(!f) return;
  var ok = true, label = "Continue";
  if(stepIdx===0) ok = !!state.service;
  if(stepIdx===1) ok = !!state.scope;
  if(stepIdx===3) ok = !!state.timeline;
  if(stepIdx===4) label = "Get my match";
  f.disabled = !ok || submitting;
  f.innerHTML = submitting ? "Sending…" :
    esc(label)+' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
}

/* -------- input sanity --------
   Stops junk reaching sales: keyboard mash in the text fields, and numbers
   that pass a digit count but were never real. A filter, not a proof --
   someone determined still types "abcd" and gets through. */
function allSame(w){
  for(var i=1;i<w.length;i++) if(w[i]!==w[0]) return false;
  return true;
}
function tripled(w){
  for(var i=2;i<w.length;i++) if(w[i]===w[i-1] && w[i]===w[i-2]) return true;
  return false;
}
/* doubled ladders so wrap-arounds like 6789012345 count as runs too */
var ASC="01234567890123456789", DESC="98765432109876543210";
function runOrRepeat(d){
  return allSame(d) || ASC.indexOf(d)>-1 || DESC.indexOf(d)>-1;
}
/* Real words written in Latin script carry a vowel, never run a letter three
   times, and are not a slice of one keyboard row. Catches asdf / qwerty /
   sdfgh / aaaa without shipping a dictionary. */
var ROWS=["qwertyuiop","asdfghjkl","zxcvbnm"];
function mash(v){
  var w=String(v).toLowerCase().replace(/[^a-z]/g,"");
  if(w.length<2) return true;
  if(!/[aeiou]/.test(w)) return true;
  if(tripled(w)) return true;
  return ROWS.some(function(r){ return r.indexOf(w)>-1; });
}
/* People's names: letters plus the joiners real names use -- no digits, no
   symbols, so "Name 123" and "..." are not names. */
function nameOk(v){
  v=String(v||"").trim();
  return v.length>=2 && v.length<=40 &&
    /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ .'-]*$/.test(v) && !mash(v);
}
/* No whitelist -- the market is tier-2 towns we have never heard of. */
function cityOk(v){
  v=String(v||"").trim();
  return v.length>=3 && v.length<=30 &&
    /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ -]*$/.test(v) && !mash(v);
}
/* Indian PINs are 6 digits and never start 0. 111111 and 123456 are not PINs. */
function pinOk(v){
  v=String(v||"").trim();
  return /^[1-9]\d{5}$/.test(v) && !runOrRepeat(v);
}
/* People paste +91, 0091 and leading zeros -- strip those rather than
   rejecting a number that is perfectly valid underneath. */
function mobile10(v){
  var d=String(v||"").replace(/\D/g,"").replace(/^0+/,"");
  if(d.length>10 && d.indexOf("91")===0) d=d.slice(2);
  return d;
}
function phoneOk(v){
  var d=mobile10(v);
  return /^[6-9]\d{9}$/.test(d) && !runOrRepeat(d);
}

/* -------- validation + transitions -------- */
function err(id, on){
  var e = document.getElementById("e-"+id), f = document.getElementById("f-"+id);
  if(e) e.classList.toggle("show", !!on);
  if(f) f.classList.toggle("bad", !!on);
}

function next(){
  if(stepIdx===0 && !state.service) return;
  if(stepIdx===1 && !state.scope) return;
  if(stepIdx===2){
    state.city = (document.getElementById("f-city").value||"").trim();
    state.pincode = (document.getElementById("f-pin").value||"").trim();
    var cityBad = !cityOk(state.city);
    var pinBad = state.pincode !== "" && !pinOk(state.pincode);
    err("city", cityBad); err("pin", pinBad);
    if(cityBad || pinBad) return;
  }
  if(stepIdx===3 && !state.timeline) return;
  if(stepIdx===4){ submit(); return; }
  stepIdx++; render();
}

function wire(){
  body.querySelectorAll("[data-service]").forEach(function(b){
    b.addEventListener("click", function(){
      var prev = state.service;
      state.service = b.getAttribute("data-service");
      if(prev !== state.service) state.scope = null; /* stale scope from another service */
      body.querySelectorAll("[data-service]").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
      track("lead_service_pick", {service: state.service});
      updateFoot();
    });
  });
  body.querySelectorAll("[data-scope]").forEach(function(b){
    b.addEventListener("click", function(){
      state.scope = b.getAttribute("data-scope");
      body.querySelectorAll("[data-scope]").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
      updateFoot();
    });
  });
  body.querySelectorAll("[data-timeline]").forEach(function(b){
    b.addEventListener("click", function(){
      state.timeline = b.getAttribute("data-timeline");
      body.querySelectorAll("[data-timeline]").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
      updateFoot();
    });
  });
  body.querySelectorAll("[data-budget]").forEach(function(b){
    b.addEventListener("click", function(){
      var v = b.getAttribute("data-budget");
      state.budget = (state.budget === v) ? null : v; /* tap again to unselect — it's optional */
      body.querySelectorAll("[data-budget]").forEach(function(x){x.classList.remove("sel");});
      if(state.budget) b.classList.add("sel");
    });
  });
  /* Enter advances text steps */
  body.querySelectorAll("input[type=text],input[type=tel]").forEach(function(i){
    i.addEventListener("keydown", function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); next(); } });
  });
}

/* Create the enquiry in the platform. FIRE-AND-FORGET on purpose: nothing here
   comes back that the visitor needs, and the success screen must not wait on --
   or be broken by -- an API that is slow or down. Formspree stays the call that
   decides what the visitor sees, exactly as before.

   ONLY the answers with somewhere real to live are sent. Consent, the page URL,
   the subject line and the UTMs have no column and stay in the Formspree
   payload, which keeps carrying all of it. */
function createLead(gotcha){
  var s = svc() || {};
  var lead = {
    name:  state.name,
    /* BARE 10 DIGITS. Formspree gets "+91..." below; this endpoint refuses a
       non-digit outright, and anything that is not exactly ten digits is
       quarantined as a fake number. */
    phone: state.phone,
    city:  state.city,
    category:    s.label || "",
    projectType: state.scope || "",
    /* What the seller sees once the enquiry is matched out to them. Either half
       alone reads wrong there -- "2 BHK" names no service, "Home interior" no
       size. */
    interested:  (s.label || "") + (state.scope ? " · " + state.scope : ""),
    pincode:     pinOk(state.pincode) ? state.pincode : "",
    timeline:    TIMELINE_KEY[state.timeline] || "",
    /* Budget is a real answer with no column of its own, so it goes in the
       enquiry text -- the field the panel's requirement block renders, and one
       of the inputs the enquiry is scored on. */
    query:       state.budget ? "Budget: " + state.budget : "",
    /* Which page it came from. The panel derives the rest of the provenance
       from this and shows "Funnel page · business-enquries". */
    sourceChannel: "business-enquries",
    _gotcha: gotcha
  };
  /* Every target gets the SAME body, each in its own try/catch so one dead host
     cannot stop the next -- and none of them awaited, because nothing here comes
     back that the visitor needs. keepalive so the POST survives the page moving
     on to the success screen. */
  var body = JSON.stringify(lead);
  leadTargets().forEach(function(url){
    try{
      fetch(url, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Accept":"application/json" },
        body: body,
        keepalive: true
      }).catch(function(){});
    }catch(e){}
  });
}

/* -------- submit -------- */
function submit(){
  if(submitting) return;
  state.name = (document.getElementById("f-name").value||"").trim();
  state.phone = mobile10(document.getElementById("f-phone").value);
  state.consent = document.getElementById("f-consent").checked;
  var nameBad = !nameOk(state.name);
  var phoneBad = !phoneOk(state.phone);
  err("name", nameBad); err("phone", phoneBad); err("consent", !state.consent);
  document.getElementById("consentrow").classList.toggle("bad", !state.consent);
  if(nameBad || phoneBad || !state.consent) return;

  var gotcha = (document.getElementById("f-gotcha")||{}).value || "";

  var payload = {
    service: state.service,
    scope: state.scope,
    city: state.city,
    pincode: state.pincode || "(not given)",
    timeline: state.timeline,
    budget: state.budget || "(not given)",
    name: state.name,
    phone: "+91" + state.phone,
    consent: "yes",
    page: location.href.split("?")[0],
    _gotcha: gotcha,
    _subject: "New enquiry: " + state.service + " · " + state.city
  };
  Object.keys(UTM).forEach(function(k){ payload[k] = UTM[k]; });

  submitting = true;
  updateFoot();

  if(!leadSent){ leadSent = true; createLead(gotcha); }

  /* Formspree is a real, shared inbox -- a local checkout filling this form ten
     times while somebody works on it would put ten fake enquiries in front of
     whoever reads it. So on localhost the POST is skipped and RESOLVED, which
     still runs the success screen and the conversion events below. Said out loud
     in the console rather than skipped quietly, so nobody debugs a missing
     Formspree entry that was never sent. */
  var sent;
  if(isLocal()){
    console.log("[local] Formspree POST skipped; payload:", payload);
    sent = Promise.resolve({ ok: true });
  } else {
    sent = fetch(ENDPOINT, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(payload)
    });
  }

  /* fetch() only rejects on network failure — a 4xx/5xx from Formspree resolves,
     so check res.ok explicitly. */
  sent.then(function(res){
    if(!res.ok) throw new Error("formspree "+res.status);
    onSuccess();
  }).catch(function(){
    submitting = false;
    updateFoot();
    var e = document.getElementById("e-phone");
    if(e){ e.textContent = "Couldn't send just now — please check your connection and try again."; e.classList.add("show"); }
  });
}

function onSuccess(){
  track("generate_lead", {service: state.service, city: state.city, timeline: state.timeline});
  try{ if(window.fbq) fbq("track","Lead",{content_category: state.service, content_name: "consumer_enquiry"}); }catch(e){}
  doneShown = true;
  submitting = false;
  prog.style.width = "100%";
  var sub = document.getElementById("fssub");
  if(sub) sub.textContent = "Enquiry received";
  var foot = document.querySelector(".fs-foot");
  if(foot) foot.style.display = "none";
  body.innerHTML =
    '<div class="fc-done">' +
      '<span class="big"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span>' +
      '<h3>Enquiry received, '+esc(state.name.split(" ")[0])+'</h3>' +
      '<p>We\'re matching your '+esc((svc()||{}).label||"project").toLowerCase()+' enquiry in '+esc(state.city)+' with a verified business.</p>' +
      '<div class="next-steps">' +
        '<div><span class="n">1</span><span>Our team reviews and qualifies your enquiry.</span></div>' +
        '<div><span class="n">2</span><span>We match it to a verified business serving '+esc(state.city)+'.</span></div>' +
        '<div><span class="n">3</span><span>The business contacts you on <b>+91 '+esc(state.phone)+'</b> — typically within 1–2 working days.</span></div>' +
      '</div>' + privacyNote +
    '</div>';
  var mc = document.querySelector(".fc-body");
  if(mc) mc.scrollTop = 0;
}

document.getElementById("yr").textContent = new Date().getFullYear();
render();

/* =================================================================
   Enquiry modal — full-screen app flow; every CTA opens it
   ================================================================= */
var modal = document.getElementById("modal");
function openModal(source){
  if(!doneShown) render(); /* refresh so prefills (city, service) show */
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  track("form_open", {source: source||"cta", step: stepIdx+1});
}
function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}
document.querySelectorAll("[data-open-form]").forEach(function(b){
  b.addEventListener("click", function(){ openModal("cta"); });
});
document.querySelectorAll("[data-close-form]").forEach(function(b){
  b.addEventListener("click", closeModal);
});
document.addEventListener("keydown", function(e){
  if(e.key==="Escape" && modal.classList.contains("open")) closeModal();
});

/* header back: previous step, or close from the first step / done screen */
document.getElementById("fsback").addEventListener("click", function(){
  if(doneShown || stepIdx===0){ closeModal(); return; }
  stepIdx--; render();
});
document.getElementById("fsnext").addEventListener("click", next);

/* hero find-now: stash location, open the form */
(function(){
  var fr = document.getElementById("findrow");
  if(!fr) return;
  fr.addEventListener("submit", function(e){
    e.preventDefault();
    var v = (document.getElementById("hero-city").value||"").trim();
    if(pinOk(v)) state.pincode = v; else if(v) state.city = v;
    track("hero_find", {q: v});
    openModal("hero_find");
  });
})();

/* space cards: preselect the service, open the form at step 2 */
document.querySelectorAll(".space[data-svc]").forEach(function(card){
  card.addEventListener("click", function(){
    var id = card.getAttribute("data-svc");
    if(state.service !== id){ state.service = id; state.scope = null; }
    if(!doneShown) stepIdx = 1;
    track("lead_service_pick", {service: id, source: "spaces"});
    openModal("spaces");
  });
});
