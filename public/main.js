const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];

const setText = (id, val) => { const el = qs(id); if (el) el.textContent = val || ''; };
const safeHref = (href) => (href && href.trim() ? href : '#');
const sessionId = localStorage.getItem('chatSessionId') || `chat_${Math.random().toString(36).slice(2)}`;
localStorage.setItem('chatSessionId', sessionId);

const appendChatMessage = (text, who = 'bot') => {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${who}`;
  msg.textContent = text;
  qs('#chatBody').appendChild(msg);
  qs('#chatBody').scrollTop = qs('#chatBody').scrollHeight;
};

const setupChat = (chat) => {
  setText('#chatTitle', chat.title);
  qs('#chatInput').placeholder = chat.placeholder || 'Type your message...';
  appendChatMessage(chat.welcomeMessage || 'Welcome! How can we help?', 'bot');

  qs('#chatQuick').innerHTML = (chat.quickReplies || []).map((q) => `<button type="button" class="quick-btn">${q}</button>`).join('');
  qsa('.quick-btn').forEach((btn) => {
    btn.onclick = async () => {
      qs('#chatInput').value = btn.textContent;
      qs('#chatForm').requestSubmit();
    };
  });

  qs('#chatToggle').onclick = () => qs('#chatPanel').classList.toggle('hidden');

  qs('#chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = qs('#chatInput');
    const message = input.value.trim();
    if (!message) return;
    appendChatMessage(message, 'user');
    input.value = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId })
      });
      const data = await res.json();
      appendChatMessage(data.reply || `A coordinator will follow up at ${chat.offlineEmail}.`, 'bot');
    } catch {
      appendChatMessage(`We're temporarily offline. Please contact ${chat.offlineEmail}.`, 'bot');
    }
  };
};

const renderLeadership = (leaders = []) => {
  const wrap = qs('#leadersTimeline');
  wrap.innerHTML = leaders.map((leader, idx) => {
    const side = idx === 0 ? 'photo-right' : idx % 2 === 0 ? 'photo-right' : 'photo-left';
    return `
      <a class="leader-row ${side} fade-up" href="${safeHref(leader.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="${leader.name} LinkedIn profile">
        <div class="leader-content">
          <p class="leader-role">${leader.title || ''}</p>
          <h3 class="leader-name script">${leader.name || ''}</h3>
          <p class="leader-bio">${leader.bio || ''}</p>
        </div>
        <div class="leader-photo-wrap">
          <span class="shape circle"></span>
          <span class="shape semicircle"></span>
          <img src="${leader.photo || ''}" alt="${leader.name || 'Leader'}" class="leader-photo" />
        </div>
      </a>
    `;
  }).join('');
};

const renderStats = (stats = []) => {
  const wrap = qs('#statsGrid');
  wrap.innerHTML = stats.map((s) => `<article class="stat-card fade-up"><h3>${s.value || ''}</h3><p>${s.label || ''}</p></article>`).join('');
};

const renderTrustMarquee = (items = []) => {
  const marquee = qs('#trustMarquee');
  const row = [...items, ...items].map((x) => `<span>${x}</span>`).join('');
  marquee.innerHTML = `<div class="marquee-track">${row}</div>`;
};

const setupTestimonials = (items = []) => {
  if (!items.length) return;
  let idx = 0;
  const paint = () => {
    const item = items[idx % items.length];
    setText('#testimonialQuote', `“${item.quote || ''}”`);
    setText('#testimonialName', item.name || 'Client');
    setText('#testimonialRole', item.role || 'Healthcare Partner');
    idx += 1;
  };
  paint();
  setInterval(paint, 5200);
};

const setupJobsBoard = (board = {}) => {
  setText('#jobsBoardTitle', board.title);
  setText('#jobsBoardDescription', board.description);

  const specialtySel = qs('#filterSpecialty');
  const locationSel = qs('#filterLocation');
  const typeSel = qs('#filterType');

  const specialties = [...new Set((board.jobs || []).map((j) => j.specialty))];
  specialtySel.innerHTML = `<option value="">All specialties</option>${specialties.map((s) => `<option>${s}</option>`).join('')}`;
  locationSel.innerHTML = `<option value="">All locations</option>${(board.locations || []).map((s) => `<option>${s}</option>`).join('')}`;
  typeSel.innerHTML = `<option value="">All types</option>${(board.types || []).map((s) => `<option>${s}</option>`).join('')}`;

  const draw = () => {
    const specialty = specialtySel.value;
    const location = locationSel.value;
    const type = typeSel.value;
    const list = (board.jobs || []).filter((j) => (!specialty || j.specialty === specialty) && (!location || j.location === location) && (!type || j.type === type));

    qs('#jobBoardList').innerHTML = list.map((job) => `
      <article class="job-row fade-up">
        <div>
          <h4>${job.title}</h4>
          <p>${job.specialty} • ${job.location} • ${job.type}</p>
          <small>${job.id}</small>
        </div>
        <div class="job-right">
          <strong>${job.pay}</strong>
          <button class="btn primary apply-btn" data-job="${job.id}">Apply</button>
        </div>
      </article>
    `).join('') || '<p class="muted">No jobs matched your filters.</p>';

    qsa('.apply-btn').forEach((btn) => {
      btn.onclick = () => {
        qs('#applyJobId').value = btn.dataset.job;
        qs('#applyModal').classList.remove('hidden');
      };
    });
  };

  specialtySel.onchange = draw;
  locationSel.onchange = draw;
  typeSel.onchange = draw;
  draw();

  qs('#closeApply').onclick = () => qs('#applyModal').classList.add('hidden');
  qs('#applyForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    qs('#applyMsg').textContent = data.message || 'Submitted';
    if (res.ok) e.target.reset();
  };
};

const setupEmployerForm = (content) => {
  setText('#employerTitle', content.title);
  setText('#employerDescription', content.description);

  qs('#employerForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/request-talent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    qs('#employerMsg').textContent = data.message || content.successMessage;
    if (res.ok) e.target.reset();
  };
};

const renderFaq = (faq = {}) => {
  setText('#faqTitle', faq.title);
  qs('#faqList').innerHTML = (faq.items || []).map((item, i) => `
    <details class="faq-item" ${i === 0 ? 'open' : ''}>
      <summary>${item.q}</summary>
      <p>${item.a}</p>
    </details>
  `).join('');
};

const animateOnScroll = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('in-view'); });
  }, { threshold: 0.12 });
  qsa('.fade-up').forEach((el) => observer.observe(el));
};

const render = (data) => {
  setText('#companyName', data.settings.companyName);
  setText('#tagline', data.settings.tagline);

  qs('#nav').innerHTML = data.navigation.map((n) => `<a href="${n.href}">${n.label}</a>`).join('') + (data.settings.showAdminLink ? '<a href="/admin">Admin</a>' : '');
  qs('#applyBtn').textContent = data.settings.applyButtonText;

  setText('#heroEyebrow', data.hero.eyebrow);
  setText('#heroTitle', data.hero.title);
  setText('#heroDescription', data.hero.description);
  qs('#heroPrimary').textContent = data.hero.primaryCtaLabel;
  qs('#heroPrimary').href = data.hero.primaryCtaHref;
  qs('#heroSecondary').textContent = data.hero.secondaryCtaLabel;
  qs('#heroSecondary').href = data.hero.secondaryCtaHref;

  qs('#heroSlides').innerHTML = data.hero.slides.map((s, i) => `<div class="slide ${i === 0 ? 'active' : ''}" style="background-image:url('${s.image}')"><div class="slide-caption"><h3>${s.title}</h3><p>${s.subtitle}</p></div></div>`).join('');

  let current = 0;
  const slides = qsa('.slide');
  const go = (next) => slides.forEach((el, i) => el.classList.toggle('active', i === next));
  const step = (dir) => { current = (current + dir + slides.length) % slides.length; go(current); };
  qs('#prevSlide').onclick = () => step(-1);
  qs('#nextSlide').onclick = () => step(1);
  setInterval(() => step(1), 5000);

  renderTrustMarquee(data.trustLogos || []);
  renderStats(data.stats || []);
  qs('#servicesGrid').innerHTML = data.services.map((s) => `<article class="card fade-up"><h3>${s.title}</h3><p>${s.description}</p></article>`).join('');

  setText('#aboutEyebrow', data.about.eyebrow);
  setText('#aboutTitle', data.about.title);
  setText('#aboutDescription', data.about.description);
  qs('#aboutImage').src = data.about.image;

  setText('#leadEyebrow', data.leadership.eyebrow);
  setText('#leadTitle', data.leadership.title);
  setText('#leadSubtitle', data.leadership.subtitle);
  renderLeadership(data.leadership.leaders);

  setupTestimonials(data.testimonials || []);

  setText('#jobsEyebrow', data.jobs.eyebrow);
  setText('#jobsTitle', data.jobs.title);
  setText('#jobsDescription', data.jobs.description);
  qs('#jobTags').innerHTML = data.jobs.tags.map((t) => `<span>${t}</span>`).join('');
  qs('#jobsCta').textContent = data.jobs.ctaLabel;
  qs('#jobsCta').href = data.jobs.ctaHref;
  qs('#jobsImage').src = data.jobs.image;

  setupJobsBoard(data.jobsBoard || {});
  setupEmployerForm(data.employerForm || {});
  renderFaq(data.faq || {});

  setText('#ctaTitle', data.cta.title);
  setText('#ctaDescription', data.cta.description);
  qs('#ctaButton').textContent = data.cta.buttonLabel;
  qs('#ctaButton').href = data.cta.buttonHref;

  setText('#contactPhone', `Phone: ${data.contact.phone}`);
  setText('#contactEmail', `Email: ${data.contact.email}`);
  setText('#contactOffice1', data.contact.officeLine1);
  setText('#contactOffice2', data.contact.officeLine2);

  setText('#lottieCaption', data.lottie.caption);
  lottie.loadAnimation({ container: qs('#lottie'), renderer: 'svg', loop: true, autoplay: true, path: data.lottie.url });

  setupChat(data.chat || {});
  animateOnScroll();
};

fetch('/api/content').then((r) => r.json()).then(render);
