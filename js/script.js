/* =================================================================
   CONFIG — the scaling seam.
   Each service is one entry: id, card copy, icon, and its own scope
   question. Adding a future service (e.g. "vastu consultation",
   "site supervision") = append an entry here; the journey, the
   Formspree payload and the tracking all pick it up automatically.
   ================================================================= */
var ENDPOINT = "https://formspree.io/f/mzebbbej";

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
   Step engine
   ================================================================= */
var state = { service:null, scope:null, city:"", pincode:"", timeline:null, budget:null,
              name:"", phone:"", consent:false };
var stepIdx = 0;
var TOTAL_STEPS = 5;
var body = document.getElementById("fcbody");
var prog = document.getElementById("prog");
var maxStepSeen = -1;

function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

function svc(){ return SERVICES.filter(function(s){return s.id===state.service;})[0] || null; }

function setProg(){ prog.style.width = Math.round(((stepIdx+1)/TOTAL_STEPS)*100) + "%"; }

function stepLabel(){ return "Step " + (stepIdx+1) + " of " + TOTAL_STEPS; }

function navRow(nextLabel, backable){
  return '<div class="fc-nav">' +
    (backable ? '<button type="button" class="btn btn-back" data-back aria-label="Go back">' +
      '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></button>' : '') +
    '<button type="button" class="btn btn-primary" data-next>' + nextLabel + '</button></div>';
}

var privacyNote = '<p class="fc-note"><svg viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"/></svg>' +
  '<span>Your details are shared only with Interior bazzar and the one matched business — never broadcast or resold.</span></p>';

function render(){
  setProg();
  if(stepIdx > maxStepSeen){ maxStepSeen = stepIdx; track("lead_step_view", {step: stepIdx+1, service: state.service||""}); }
  switch(stepIdx){

    case 0: /* service — the scaling seam renders from config */
      body.innerHTML =
        '<p class="fc-step-label">'+stepLabel()+'</p>' +
        '<p class="fc-q">What do you need?</p>' +
        '<p class="fc-hint">Pick the closest — details come next.</p>' +
        '<div class="optgrid cols1">' + SERVICES.map(function(s){
          return '<button type="button" class="opt'+(state.service===s.id?" sel":"")+'" data-service="'+s.id+'">' +
            '<span class="oic">'+ICONS[s.icon]+'</span>' +
            '<span>'+esc(s.label)+'<small>'+esc(s.small)+'</small></span></button>';
        }).join("") + '</div>' + privacyNote;
      break;

    case 1: /* scope — question comes from the chosen service's config */
      var s = svc();
      body.innerHTML =
        '<p class="fc-step-label">'+stepLabel()+'</p>' +
        '<p class="fc-q">'+esc(s.scopeQ)+'</p>' +
        '<p class="fc-hint">'+esc(s.scopeHint)+'</p>' +
        '<div class="pillwrap">' + s.scopes.map(function(sc){
          return '<button type="button" class="opt-pill'+(state.scope===sc?" sel":"")+'" data-scope="'+esc(sc)+'">'+esc(sc)+'</button>';
        }).join("") + '</div>' + navRow("Continue", true);
      break;

    case 2: /* location */
      body.innerHTML =
        '<p class="fc-step-label">'+stepLabel()+'</p>' +
        '<p class="fc-q">Where is the project?</p>' +
        '<p class="fc-hint">We match you with a business that serves your area.</p>' +
        '<div class="field"><label for="f-city">City</label>' +
          '<input id="f-city" type="text" autocomplete="address-level2" placeholder="e.g. Indore" value="'+esc(state.city)+'" />' +
          '<p class="ferr" id="e-city">Please enter your city.</p></div>' +
        '<div class="field"><label for="f-pin">Pincode <span class="optional">(optional, sharpens the match)</span></label>' +
          '<input id="f-pin" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="6" placeholder="6-digit pincode" value="'+esc(state.pincode)+'" />' +
          '<p class="ferr" id="e-pin">Pincode should be 6 digits.</p></div>' +
        navRow("Continue", true);
      break;

    case 3: /* timeline + budget */
      body.innerHTML =
        '<p class="fc-step-label">'+stepLabel()+'</p>' +
        '<p class="fc-q">When do you want to start?</p>' +
        '<p class="fc-hint">"Just exploring" is a perfectly good answer.</p>' +
        '<div class="pillwrap">' + TIMELINES.map(function(t){
          return '<button type="button" class="opt-pill'+(state.timeline===t?" sel":"")+'" data-timeline="'+esc(t)+'">'+esc(t)+'</button>';
        }).join("") + '</div>' +
        '<p class="fc-q" style="margin-top:18px;font-size:16px">Rough budget <span style="font-weight:400;color:var(--muted);font-size:13px">(optional)</span></p>' +
        '<div class="pillwrap">' + BUDGETS.map(function(b){
          return '<button type="button" class="opt-pill'+(state.budget===b?" sel":"")+'" data-budget="'+esc(b)+'">'+esc(b)+'</button>';
        }).join("") + '</div>' + navRow("Continue", true);
      break;

    case 4: /* contact + consent */
      body.innerHTML =
        '<p class="fc-step-label">'+stepLabel()+'</p>' +
        '<p class="fc-q">Where should the business reach you?</p>' +
        '<p class="fc-hint">One matched business — call or WhatsApp.</p>' +
        '<div class="field"><label for="f-name">Your name</label>' +
          '<input id="f-name" type="text" autocomplete="name" placeholder="Full name" value="'+esc(state.name)+'" />' +
          '<p class="ferr" id="e-name">Please enter your name.</p></div>' +
        '<div class="field"><label for="f-phone">Mobile number</label>' +
          '<div class="phonewrap"><span class="cc">+91</span>' +
          '<input id="f-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="10-digit mobile" value="'+esc(state.phone)+'" /></div>' +
          '<p class="ferr" id="e-phone">Enter a valid 10-digit Indian mobile number.</p></div>' +
        /* honeypot — hidden from humans, bots fill it */
        '<input type="text" name="_gotcha" id="f-gotcha" style="display:none" tabindex="-1" autocomplete="off" />' +
        '<label class="consent" id="consentrow"><input type="checkbox" id="f-consent"'+(state.consent?" checked":"")+' />' +
          '<span>I agree to be contacted by Interior bazzar and one matched interior business about this enquiry, via call/WhatsApp, and to the <a href="https://interiorbazzar.com/privacy-policy" target="_blank" rel="noopener">privacy policy</a>.</span></label>' +
        '<p class="ferr" id="e-consent">Please tick the box so the business is allowed to contact you.</p>' +
        navRow("Get my match", true) + privacyNote;
      break;
  }
  wire();
}

/* -------- validation + transitions -------- */
function err(id, on){
  var e = document.getElementById("e-"+id), f = document.getElementById("f-"+id);
  if(e) e.classList.toggle("show", !!on);
  if(f) f.classList.toggle("bad", !!on);
}

function next(){
  if(stepIdx===2){
    state.city = (document.getElementById("f-city").value||"").trim();
    state.pincode = (document.getElementById("f-pin").value||"").trim();
    var cityBad = state.city.length < 2;
    var pinBad = state.pincode !== "" && !/^\d{6}$/.test(state.pincode);
    err("city", cityBad); err("pin", pinBad);
    if(cityBad || pinBad) return;
  }
  if(stepIdx===1 && !state.scope){ flashPills("scope"); return; }
  if(stepIdx===3 && !state.timeline){ flashPills("timeline"); return; }
  if(stepIdx===4){ submit(); return; }
  stepIdx++; render();
}

function flashPills(kind){
  body.querySelectorAll("[data-"+kind+"]").forEach(function(p){
    p.style.borderColor = "var(--err)";
    setTimeout(function(){ p.style.borderColor = ""; }, 900);
  });
}

function wire(){
  body.querySelectorAll("[data-service]").forEach(function(b){
    b.addEventListener("click", function(){
      var prev = state.service;
      state.service = b.getAttribute("data-service");
      if(prev !== state.service) state.scope = null; /* stale scope from another service */
      track("lead_service_pick", {service: state.service});
      stepIdx = 1; render();
    });
  });
  body.querySelectorAll("[data-scope]").forEach(function(b){
    b.addEventListener("click", function(){
      state.scope = b.getAttribute("data-scope");
      body.querySelectorAll("[data-scope]").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
    });
  });
  body.querySelectorAll("[data-timeline]").forEach(function(b){
    b.addEventListener("click", function(){
      state.timeline = b.getAttribute("data-timeline");
      body.querySelectorAll("[data-timeline]").forEach(function(x){x.classList.remove("sel");});
      b.classList.add("sel");
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
  var nx = body.querySelector("[data-next]");
  if(nx) nx.addEventListener("click", next);
  var bk = body.querySelector("[data-back]");
  if(bk) bk.addEventListener("click", function(){ if(stepIdx>0){ stepIdx--; render(); } });
  /* Enter advances text steps */
  body.querySelectorAll("input[type=text],input[type=tel]").forEach(function(i){
    i.addEventListener("keydown", function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); next(); } });
  });
}

/* -------- submit -------- */
var submitting = false;
function submit(){
  if(submitting) return;
  state.name = (document.getElementById("f-name").value||"").trim();
  state.phone = (document.getElementById("f-phone").value||"").replace(/\D/g,"");
  state.consent = document.getElementById("f-consent").checked;
  var nameBad = state.name.length < 2;
  var phoneBad = !/^[6-9]\d{9}$/.test(state.phone);
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
  var btn = body.querySelector("[data-next]");
  if(btn){ btn.disabled = true; btn.textContent = "Sending…"; }

  /* fetch() only rejects on network failure — a 4xx/5xx from Formspree resolves,
     so check res.ok explicitly. */
  fetch(ENDPOINT, {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify(payload)
  }).then(function(res){
    if(!res.ok) throw new Error("formspree "+res.status);
    onSuccess();
  }).catch(function(){
    submitting = false;
    if(btn){ btn.disabled = false; btn.textContent = "Get my match"; }
    var e = document.getElementById("e-phone");
    if(e){ e.textContent = "Couldn't send just now — please check your connection and try again."; e.classList.add("show"); }
  });
}

function onSuccess(){
  track("generate_lead", {service: state.service, city: state.city, timeline: state.timeline});
  try{ if(window.fbq) fbq("track","Lead",{content_category: state.service, content_name: "consumer_enquiry"}); }catch(e){}
  prog.style.width = "100%";
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
  var mc = document.querySelector(".modal-card");
  if(mc) mc.scrollTop = 0;
}

document.getElementById("yr").textContent = new Date().getFullYear();
render();

/* =================================================================
   Enquiry modal — the form lives in a dialog; every CTA opens it
   ================================================================= */
var modal = document.getElementById("modal");
function openModal(source){
  render(); /* refresh so prefills (city, service) show */
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  var mc = document.querySelector(".modal-card");
  if(mc) mc.scrollTop = 0;
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

/* hero find-now: stash location, open the form */
(function(){
  var fr = document.getElementById("findrow");
  if(!fr) return;
  fr.addEventListener("submit", function(e){
    e.preventDefault();
    var v = (document.getElementById("hero-city").value||"").trim();
    if(/^\d{6}$/.test(v)) state.pincode = v; else if(v) state.city = v;
    track("hero_find", {q: v});
    openModal("hero_find");
  });
})();

/* space cards: preselect the service, open the form at step 2 */
document.querySelectorAll(".space[data-svc]").forEach(function(card){
  card.addEventListener("click", function(){
    var id = card.getAttribute("data-svc");
    if(state.service !== id){ state.service = id; state.scope = null; }
    stepIdx = 1;
    track("lead_service_pick", {service: id, source: "spaces"});
    openModal("spaces");
  });
});
