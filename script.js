tailwind.config={theme:{extend:{colors:{vera:'#7C3AED','vera-dark':'#5B21B6',navy:'#0F172A','navy-light':'#1E293B'}}}}

var veraOpen=false;
function veraToggle(){veraOpen=!veraOpen;document.getElementById('vera-fab').classList.toggle('open',veraOpen);document.getElementById('vera-panel').classList.toggle('open',veraOpen);}
function triggerVeraVoice(){if(!veraOpen)veraToggle();}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&veraOpen)veraToggle();});

(function() {
  'use strict';

  /* Map user questions → site sections */
  var userRules = [
    /* Pricing intent */
    { re: /pric|cost|how much|expensive|afford|money|budget|dollar|monthly|per month|pay|fee/i, target: 'pricing' },
    /* Signup intent */
    { re: /sign.?up|get start|ready|let.?s do|set.?up|onboard|go ahead|i.?m in|begin|join/i, action: 'open-trial' },
    /* Demo intent */
    { re: /demo|hear|try it|call me|listen|test|sample|show me|sound like|real call/i, action: 'open-demo' },
    /* How it works */
    { re: /how.*(work|does|it)|what.*(do|happen)|explain|tell me more|walk me through|step/i, target: 'what-we-install' },
    /* Results / proof */
    { re: /proof|result|case.?study|revenue|roi|payback|evidence|number|stat/i, target: 'what-we-install' },
    /* Testimonials */
    { re: /review|testimon|customer|who.*(use|using)|other.*(business|compan)|stories/i, target: 'results' },
    /* Problem / missed calls */
    { re: /miss.*(call|lead)|after.?hour|voicemail|lost|losing|competitor|problem|busy/i, target: 'why-calldirector' },
    /* Voice quality */
    { re: /sound|real|human|robot|natural|voice|quality|believ|ai|artificial/i, target: 'results' },
    /* Industries */
    { re: /industry|type.*business|work for|hvac|plumb|roof|salon|dental|electric|pest/i, target: 'results' },
    /* Setup */
    { re: /setup|install|how long|time|quick|fast|phone.?number|change.?number|keep.?number/i, target: 'what-we-install' },
    /* About Vera */
    { re: /what.*vera|who.*vera|what.*you|who.*you|about you|your.?name|capabilities/i, target: 'hero' },
    /* FAQ */
    { re: /faq|question|ask|wonder|curious/i, target: 'faq' },
    /* Contact */
    { re: /contact|email|phone|reach|call you|talk.*human|support|speak.*person/i, target: 'final-cta' },
    /* Guarantee */
    { re: /cancel|refund|guarantee|risk|commitment|contract|trial/i, target: 'pricing' },
    /* Booking capabilities */
    { re: /appointment|book|calendar|schedul|integrat|google|outlook|jobber|servicetitan/i, target: 'what-we-install' },
    /* Greeting → hero */
    { re: /^(hi|hello|hey|good\s)/i, target: 'hero' }
  ];

  var lastSync = 0;

  function syncFromUserInput(text) {
    if (!text || text.length < 2) return;
    var now = Date.now();
    if (now - lastSync < 2500) return;

    for (var i = 0; i < userRules.length; i++) {
      if (userRules[i].re.test(text)) {
        lastSync = now;

        if (userRules[i].action) {
          var act = userRules[i].action;
          setTimeout(function() {
            if (act === 'open-demo') openDemoModal();
            else if (act === 'open-trial') openTrialModal();
          }, 1200);
        } else {
          var id = userRules[i].target;
          var el = document.getElementById(id);
          if (el) {
            setTimeout(function() {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('vera-highlight');
              setTimeout(function() { el.classList.remove('vera-highlight'); }, 2000);
            }, 600);
          }
        }
        return;
      }
    }
  }

  /*
   * Speech Recognition — listens to what the USER says.
   * Since PMG also uses the mic, we start ours AFTER PMG's stops.
   * We observe mic button clicks to know when the user is talking.
   */

  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  var listening = false;
  var recog = null;
  var accumulatedText = '';

  function startListening() {
    if (listening) return;
    listening = true;

    recog = new SpeechRec();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.continuous = true;
    recog.maxAlternatives = 1;

    recog.onresult = function(event) {
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          var text = event.results[i][0].transcript.trim();
          if (text.length > 1) {
            accumulatedText = text;
            syncFromUserInput(text);
          }
        }
      }
    };

    recog.onerror = function(e) {
      listening = false;
      if (e.error !== 'aborted' && e.error !== 'not-allowed') {
        setTimeout(startListening, 2000);
      }
    };

    recog.onend = function() {
      listening = false;
      /* Restart after a pause */
      setTimeout(startListening, 1500);
    };

    try { recog.start(); } catch(e) { listening = false; }
  }

  /* Watch for PMG button clicks to know when conversation is active */
  var pmgActive = false;

  function watchForPMG() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      var text = (target.textContent || '').trim().toLowerCase();
      var parent = target.parentElement;
      var parentText = parent ? (parent.textContent || '').trim().toLowerCase() : '';

      /* Detect clicks on PMG's Talk/Stop buttons */
      if (text.indexOf('talk') !== -1 || text.indexOf('stop') !== -1 ||
          parentText.indexOf('talk to vera') !== -1 ||
          target.closest('[class*="paymegpt"]') ||
          target.closest('[id*="paymegpt"]')) {

        if (!pmgActive) {
          pmgActive = true;
          /* Start our listener alongside PMG */
          setTimeout(startListening, 500);
        }
      }
    }, true);
  }

  /* Also intercept WebSocket for any text responses */
  var OrigWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    ws.addEventListener('message', function(event) {
      try {
        var d = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (d) {
          var t = d.text || d.message || d.content || d.transcript || d.reply || '';
          if (!t && d.delta) t = d.delta.text || d.delta.content || '';
          if (!t && d.choices && d.choices[0]) {
            var c = d.choices[0];
            t = (c.delta && c.delta.content) || (c.message && c.message.content) || '';
          }
          if (typeof t === 'string' && t.length > 15) syncFromUserInput(t);
        }
      } catch(e) {}
    });
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;

  /* Init */
  watchForPMG();

})();

/* ---- Demo Modal (Hear Vera Live) ---- */
function openDemoModal() {
  var modal = document.getElementById('demoModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Lazy-load iframe on first open
  var frame = document.getElementById('demoFrame');
  if (!frame.src || frame.src === 'about:blank' || frame.src.indexOf('paymegpt') === -1) {
    document.getElementById('demoLoading').style.display = 'flex';
    frame.src = frame.getAttribute('data-src');
  }
}
function closeDemoModal() {
  document.getElementById('demoModal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---- Trial Modal ---- */
function openTrialModal() {
  document.getElementById('trialModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeTrialModal() {
  document.getElementById('trialModal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---- Trigger PMG Voice Launcher from inline button ---- */
function triggerVeraVoice() {
  /* Find PMG's button by searching all buttons/elements for voice-related text or attributes */
  var found = false;
  
  /* Method 1: Find by text content */
  var allButtons = document.querySelectorAll('button, [role="button"], [onclick]');
  for (var i = 0; i < allButtons.length; i++) {
    var btn = allButtons[i];
    var txt = (btn.textContent || '').trim().toLowerCase();
    if ((txt.indexOf('talk') !== -1 || txt.indexOf('ask vera') !== -1) && btn.id !== 'vera-inline-mic') {
      btn.click();
      found = true;
      break;
    }
  }
  
  /* Method 2: Find by PMG-specific attributes or classes */
  if (!found) {
    var pmgSelectors = [
      '[data-paymegpt-voice-launcher] button',
      '.paymegpt-voice-launcher button',
      '[class*="paymegpt"] button',
      '[id*="paymegpt"] button',
      '[data-widget="25603715"] button'
    ];
    for (var j = 0; j < pmgSelectors.length; j++) {
      var el = document.querySelector(pmgSelectors[j]);
      if (el) { el.click(); found = true; break; }
    }
  }
  
  /* Method 3: Find any mic/audio button near bottom-right of page */
  if (!found) {
    var btns = document.querySelectorAll('button');
    for (var k = 0; k < btns.length; k++) {
      var rect = btns[k].getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 150 && rect.right > window.innerWidth - 200 && btns[k].id !== 'vera-inline-mic') {
        btns[k].click();
        found = true;
        break;
      }
    }
  }
  
  /* Scroll to bottom-right widget area if nothing clicked */
  if (!found) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
}

/* ---- FAQ Toggle ---- */
function toggleFaq(btn) {
  var item = btn.closest('.faq-item');
  var content = item.querySelector('.faq-content');
  var icon = item.querySelector('.faq-icon');
  var isOpen = !content.classList.contains('hidden');
  document.querySelectorAll('.faq-item').forEach(function(i) {
    if (i !== item) {
      i.querySelector('.faq-content').classList.add('hidden');
      i.querySelector('.faq-icon').style.transform = 'rotate(0)';
    }
  });
  content.classList.toggle('hidden', isOpen);
  icon.style.transform = isOpen ? 'rotate(0)' : 'rotate(180deg)';
}

/* ---- Escape key closes modals ---- */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeDemoModal();
    closeTrialModal();
  }
});

/* ---- Smooth scroll for anchor links ---- */
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var h = a.getAttribute('href');
    if (h !== '#') {
      e.preventDefault();
      var el = document.querySelector(h);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ---- Scroll reveal animation ---- */
(function() {
  var els = document.querySelectorAll('.reveal, .comp-vera');
  if (!('IntersectionObserver' in window)) { els.forEach(function(e){ e.classList.add('visible'); }); return; }
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry)
{
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function(e){ obs.observe(e); });
})();