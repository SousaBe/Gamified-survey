/* ==========================================================================
   0) TOAST (leve, sem
   ========================================================================== */
(function(){
  function ensureContainer(){
    let c = document.getElementById('toastContainer');
    if (!c){
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      c.setAttribute('role','status');
      c.setAttribute('aria-live','polite');
      document.body.appendChild(c);
    }
    return c;
  }

  window.toast = function(msg, opts={}){
    const { type='info', duration=4000, dismissible=true } = opts;
    const container = ensureContainer();

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <div class="toast__msg">${msg}</div>
      ${dismissible ? '<button class="toast__close" aria-label="Close">&times;</button>' : ''}
      <div class="toast__progress" style="color:inherit; --dur:${duration}ms"></div>
    `;
    container.appendChild(el);

    const remove = () => {
      if (!el.parentNode) return;
      el.classList.add('toast--hide');
      setTimeout(() => {
        el.remove();
        if (!container.childElementCount) container.remove();
      }, 220);
    };

    let timer = setTimeout(remove, duration);
    if (dismissible) el.querySelector('.toast__close').addEventListener('click', remove);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(remove, 1000); });

    return el;
  };
})();

/* ==========================================================================
   1) STATE & HELPERS
   ========================================================================== */
let currentStep = 1;
const totalDemographicSteps = 6;

const $id = (id) => document.getElementById(id);
function show(el){ el?.classList.remove('hidden'); }
function hide(el){ el?.classList.add('hidden'); }

function showOnly(id) {
  const targets = [
    'informConsent','startScreen','demographicContainer',
    'intro2050','narrativeIntro','createyourself',
    'yourself2050','avatarReveal','readytobeginscreen','gameMap',
    'area-climate','area-nutrition','area-culture', "area-maize"
  ];
  targets.forEach(s => $id(s)?.classList.add('hidden'));
  $id(id)?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function ensureEnterBtn() {
  let b = document.getElementById('enterAreaBtn');
  if (!b) {
    b = document.createElement('button');
    b.id = 'enterAreaBtn';
    b.type = 'button';
    b.className = 'enter-btn hidden'; // base + começa escondido
    document.body.appendChild(b);     // <-- no <body>, fora do mapa
  }
  return b;
}

function labelForInput(input){
  const lbl = input.closest('label');
  if (lbl){
    const clone = lbl.cloneNode(true);
    clone.querySelectorAll('input,textarea,select,button').forEach(n=>n.remove());
    const t = clone.textContent.replace(/\s+/g,' ').trim();
    if (t) return t;
  }
  const card = input.closest('.option-card, .night-card, .identity-card, .heat-card, .sort-card, .card');
  if (card){
    const cand = card.querySelector('.label, .title, span, p, h3');
    const t = (cand?.textContent || card.textContent || '').replace(/\s+/g,' ').trim();
    if (t) return t;
  }
  return input.value || null;
}



/* ==========================================================================
   2) SCREEN FLOW
   ========================================================================== */
function informConsent() {
  hide($id('informConsent'));
  show($id('startScreen'));
}

function startSurvey() {
  hide($id('startScreen'));
  show($id('demographicContainer'));
  currentStep = 1;
  showStep(currentStep);
}

function showReady(){
  hide($id('avatarReveal'));
  show($id('readytobeginscreen'));
}

function goToGame() {
  hide($id('intro2050'));
  show($id('narrativeIntro'));
}

function createyourself2050() {
  hide($id('narrativeIntro'));
  show($id('createyourself'));
}

function yourself2050() {
  hide($id('createyourself'));
  show($id('yourself2050'));
}

/* ==========================================================================
   3) DEMOGRAPHIC STEPS
   ========================================================================== */
function showStep(stepNum) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const step = $id(`step${stepNum}`);
  step?.classList.add('active');
}

let isAdvancing = false;

function nextStep() {
  if (isAdvancing) return;
  isAdvancing = true;

  const btn = document.querySelector('#demographicContainer .button-container button');
  if (btn) btn.disabled = true;

  try {
    const stepEl = $id(`step${currentStep}`);
    if (!stepEl) { showIntro2050(); return; }

    if (!validateStep(stepEl)) {
      toast('Please answer all required fields.', { type:'warning' });
      return;
    }

    stepEl.classList.remove('active');

    if (currentStep < totalDemographicSteps) {
      currentStep++;
      showStep(currentStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    hide($id('demographicContainer'));
    showIntro2050();
  } finally {
    if (btn) btn.disabled = false;
    isAdvancing = false;
  }
}

function showIntro2050() {
  const introEl = $id('intro2050');
  if (!introEl) return;
  introEl.classList.remove('hidden');
  introEl.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function validateStep(stepEl) {
  const radios = stepEl.querySelectorAll('input[type="radio"]');
  const checkboxes = stepEl.querySelectorAll('input[type="checkbox"]');

  // Radios (e "Other" com texto)
  if (radios.length > 0) {
    const groupNames = [...new Set([...radios].map(r => r.name))];
    for (const name of groupNames) {
      const selected = stepEl.querySelector(`input[name="${name}"]:checked`);
      if (!selected) return false;
      if (selected.value.toLowerCase() === 'other') {
        const label = selected.closest('label');
        const txt = label?.querySelector('input[type="text"]');
        if (txt && txt.value.trim() === '') return false;
      }
    }
  }

  // Checkboxes (mantém a tua lógica)
  if (checkboxes.length > 0) {
    const anyChecked = [...checkboxes].some(c => c.checked);
    if (!anyChecked) return false;
    const other = [...checkboxes].find(c => c.checked && c.value.toLowerCase() === 'other');
    if (other) {
      const label = other.closest('label');
      const txt = label?.querySelector('input[type="text"]');
      if (txt && txt.value.trim() === '') return false;
    }
  }

  // 🔒 NOVO: inputs/selects/textarea com required
  const requiredFields = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
  for (const field of requiredFields) {
    // radios/checkboxes já validados acima
    if (field.type === 'radio' || field.type === 'checkbox') continue;
    if (!field.value || !field.value.trim()) return false;
  }

  // Textareas com data-required-text (mantém a tua lógica)
  const requiredTexts = stepEl.querySelectorAll('textarea[required], [data-required-text]');
  for (const ta of requiredTexts) {
    if (!ta.value.trim()) return false;
  }

  return true;
}

/* ==========================================================================
   4) AVATAR FLOW & MAP
   ========================================================================== */
const AREA_LABEL = {
  climate: 'Climate & Environment',
  nutrition: 'Nutritional Health',
  culture: 'Food Culture'
};

function hideEnterButton(){
  const b = document.getElementById('enterAreaBtn');
  if (b){
    b.classList.add('hidden');
    b.classList.remove('enter-btn-pop'); // limpa a classe de animação
  }
}

function showEnterButtonForCurrentArea(){
  const key = AREA_ORDER[currentAreaIndex];
  const b = document.getElementById('enterAreaBtn');
  if (!b) return;

  b.textContent = 'Click to enter this area!';
  b.setAttribute('aria-label', `Enter ${AREA_LABEL[key] || key} area`);
  b.onclick = () => window.startArea(key);

  // mostrar centrado + animação
  b.classList.remove('hidden', 'btn-pop-center');
  void b.offsetWidth;              // força reflow para reiniciar animação
  b.classList.add('btn-pop-center');
  b.focus?.();
}


function readytobegin(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const selected = document.querySelector('input[name="perfil"]:checked');
  if (!selected) return;

  const perfil = selected.value;

  document.querySelectorAll('.avatar').forEach(img => {
    img.classList.add('hidden');
    img.classList.remove('reveal');
  });

  const avatarEl = document.getElementById(`avatar-${perfil}`);
  if (avatarEl) {
    avatarEl.classList.remove('hidden');
    void avatarEl.offsetWidth;
    avatarEl.classList.add('reveal');
  }

  hide($id('yourself2050'));
  show($id('avatarReveal'));

  window.selectedPerfil2050 = perfil;
  const shown = document.getElementById(`avatar-${perfil}`);
  window.selectedAvatarSrc = shown ? shown.src : null;
}

function startAdventure(){
  hide($id('readytobeginscreen'));
  hide($id('avatarReveal'));
  show($id('gameMap'));
  showMap(window.selectedPerfil2050 || 'rooted', window.selectedAvatarSrc || null);
}

window.showMap = function(perfilChosen, srcOverride){
  if (typeof showOnly === 'function') showOnly('gameMap');
  else document.querySelectorAll('section,div').forEach(e => {
    if (e.id === 'gameMap') e.classList.remove('hidden');
  });

  const avatar = document.getElementById('mapAvatar');
  avatar.src = srcOverride || AVATAR_SRC_BY_PERFIL[perfilChosen] || AVATAR_SRC_BY_PERFIL.rooted;

  currentAreaIndex = 0;
  hideEnterButton();

  avatar.style.top = TOPS.start + '%';
  avatar.style.transitionProperty = 'top';
  avatar.style.transitionDuration = '1.2s';
  void avatar.offsetWidth;

  const onEnd = () => {
    avatar.removeEventListener('transitionend', onEnd);
    unlockCurrentArea(); // mostra o botão
  };
  avatar.addEventListener('transitionend', onEnd, { once:true });

  avatar.style.top = TOPS.climate + '%';
};

const AREA_ORDER = ['climate', 'nutrition', 'culture'];
let currentAreaIndex = 0;

const TOPS = {
  start:     95,
  climate:   85,
  nutrition: 62,
  culture:   40,
  flag:      30
};

const AVATAR_SRC_BY_PERFIL = {
  rooted:   'Imagens questonário/rooted.png',
  future:   'Imagens questonário/futurethinker.png',
  practical:'Imagens questonário/praticalplanner.png',
  conscious:'Imagens questonário/consciouscitizen.png',
  wellness: 'Imagens questonário/wellnessseeker.png',
  explorer: 'Imagens questonário/explorer.png',
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

window.selectedPerfil2050 = window.selectedPerfil2050 || 'rooted';

window.startMap = function() {
  const avatar = $('#mapAvatar');
  avatar.src = AVATAR_SRC_BY_PERFIL[window.selectedPerfil2050] || AVATAR_SRC_BY_PERFIL.rooted;

  currentAreaIndex = 0;
  hideEnterButton();

  show($('#gameMap'));
  avatar.style.top = TOPS.start + '%';

  const onEnd = () => {
    avatar.removeEventListener('transitionend', onEnd);
    unlockCurrentArea(); // mostra o botão
  };
  avatar.addEventListener('transitionend', onEnd, { once:true });
  requestAnimationFrame(() => { avatar.style.top = TOPS.climate + '%'; });
};

function unlockCurrentArea(){
  // Com o mapa estático, basta mostrar o CTA global
  showEnterButtonForCurrentArea();
}

window.startArea = function(key) {
  hide($('#gameMap'));
  show($(`#area-${key}`));
};

window.completeArea = function(key){
  hide($(`#area-${key}`));
  show($('#gameMap'));

  const idx = AREA_ORDER.indexOf(key);
  const nextKey = AREA_ORDER[idx + 1];
  const avatar = $('#mapAvatar');

  hideEnterButton(); // esconder enquanto anima

  const goNext = () => {
    avatar.removeEventListener('transitionend', goNext);
    if (nextKey) {
      currentAreaIndex = idx + 1;
      unlockCurrentArea();      // volta a mostrar o CTA
    } else {
      const btn = document.getElementById('finalContinueBtn');
      show(btn);
      btn.focus();
    }
  };

  const targetTop = nextKey ? TOPS[nextKey] : TOPS.flag;
  avatar.addEventListener('transitionend', goNext, { once:true });
  requestAnimationFrame(() => { avatar.style.top = targetTop + '%'; });
};

window.goToMaizeSection = function(){
  hide(document.getElementById('gameMap'));
  hide(document.getElementById('finalContinueBtn'));
  show(document.getElementById('area-maize'));
};



/* ==========================================================================
   5) AREA QUIZ — FLUXO + (Climate Q1 click-only)
   ========================================================================== */
const AREA_STEP_INDEX = { climate: 1, nutrition: 1, culture: 1, maize: 1 };

function showAreaQuiz(area){
  const areaRoot = document.getElementById(`area-${area}`);
  if (!areaRoot) return;

  areaRoot.querySelector('.areaIntroduction')?.classList.add('hidden');
  const quiz = document.getElementById(`${area}Quiz`);
  if (!quiz) return;
  quiz.classList.remove('hidden');

  quiz.style.position = 'relative';
  quiz.style.zIndex = '2';
  areaRoot.querySelector('.world-gif')?.style && (
    (areaRoot.querySelector('.world-gif').style.pointerEvents = 'none'),
    (areaRoot.querySelector('.world-gif').style.zIndex = '0')
  );

  // 👇 robusto: se alguma init rebentar, ainda mostramos o step1
  try {
    if (area === 'nutrition') initNutritionArea();
    if (area === 'culture')   initCultureArea();
    if (area === 'maize')     initMaizeArea();
  } catch (e) {
    console.warn('[init error]', area, e);
  }

  AREA_STEP_INDEX[area] = 1;
  setAreaStepActive(area, 1);

  initClickSelectForArea(area); // faz nada se não for climate
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setAreaStepActive(area, idx){
  const quiz = document.getElementById(`${area}Quiz`);
  if (!quiz) { console.warn('Quiz not found:', `${area}Quiz`); return; }

  // remove active de todos os passos *dentro do quiz* e força display none
  quiz.querySelectorAll('.area-step').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  // ativa o passo pretendido *dentro do quiz*
  const step = quiz.querySelector(`#${area}-step${idx}`);
  if (!step) { console.warn('Step not found:', `${area}-step${idx}`); return; }

  step.classList.add('active');
  if (step.id === `${area}-step3`) initSwipeIfNeeded(area);
  if (step.id === `${area}-step4`) initHeatPickIfNeeded(area);
  if (step.id === `${area}-step5`) initSwapMenuIfNeeded(area);
  if (step.id === `${area}-step6`) initClimateFeedbackIfNeeded();
  step.style.display = 'block';      // <- garante que aparece mesmo que outra regra esconda
  step.querySelector('textarea')?.focus();
  const areaRoot = document.getElementById(`area-${area}`);
  // Esconde o GIF apenas no feedback do clima
  if (areaRoot && area === 'climate') {
    if (step.id === 'climate-step6') {
      areaRoot.classList.add('no-gif');
    } else {
      areaRoot.classList.remove('no-gif');
    }
  }
  if (area === 'climate' && idx === 6) {
    const img = step.querySelector('#climateFeedbackAvatar');
    if (img) {
      // 1) primeiro tenta o src guardado do avatar mostrado ao utilizador
      // 2) se não existir, usa o mapa pelo perfil escolhido
      const fallback =
        (window.AVATAR_SRC_BY_PERFIL &&
         window.selectedPerfil2050 &&
         window.AVATAR_SRC_BY_PERFIL[window.selectedPerfil2050]) ||
        (window.AVATAR_SRC_BY_PERFIL && window.AVATAR_SRC_BY_PERFIL.rooted) ||
        '';

      img.src = window.selectedAvatarSrc || fallback;
      img.alt = `Avatar (${window.selectedPerfil2050 || 'rooted'})`;
    }
  }
  if (area === 'nutrition') {
    const areaRoot = document.getElementById('area-nutrition');

    if (step.id === 'nutrition-step7') {
      // 1) esconder a imagem da área (foodcircle)
      areaRoot?.querySelector('.food-circle')?.classList.add('hidden');

      // 2) preencher o avatar escolhido previamente
      const img = step.querySelector('#nutritionFeedbackAvatar');
      if (img) {
        const fallback =
          (window.AVATAR_SRC_BY_PERFIL &&
           window.selectedPerfil2050 &&
           window.AVATAR_SRC_BY_PERFIL[window.selectedPerfil2050]) ||
          (window.AVATAR_SRC_BY_PERFIL && window.AVATAR_SRC_BY_PERFIL.rooted) ||
          '';

        img.src = window.selectedAvatarSrc || fallback;
        img.alt = `Avatar (${window.selectedPerfil2050 || 'rooted'})`;

      }

      initNutritionFeedbackIfNeeded();

    } else {
      // noutros passos da nutrição, mantém o foodcircle visível
      areaRoot?.querySelector('.food-circle')?.classList.remove('hidden');
    }
  }
  if (area === 'culture'){
    if (step.id === 'culture-step6') document.getElementById('area-culture')?.classList.add('no-gif');
    else                              document.getElementById('area-culture')?.classList.remove('no-gif');

    if (idx === 6){
      initCultureFeedbackIfNeeded(); // sincroniza “Other” + hidden
      const img = step.querySelector('#cultureFeedbackAvatar');
      if (img){
        const fallback = (window.AVATAR_SRC_BY_PERFIL && window.selectedPerfil2050 && window.AVATAR_SRC_BY_PERFIL[window.selectedPerfil2050]) || (window.AVATAR_SRC_BY_PERFIL && window.AVATAR_SRC_BY_PERFIL.rooted) || '';
        img.src = window.selectedAvatarSrc || fallback;
        img.alt = `Avatar (${window.selectedPerfil2050 || 'rooted'})`;
      }
    }
  }
  if (area === 'maize') {
    const step = document.getElementById(`maize-step${idx}`);
    const areaRoot = document.getElementById('area-maize');
    const maizeVisual = areaRoot?.querySelector('#maizeVisual');
    const qwrap = areaRoot?.querySelector('.question-wrapper');

    if (maizeVisual) maizeVisual.classList.toggle('hidden', step?.id === 'maize-step4');

    // Avatar final (já existente no teu código)
    if (step?.id === 'maize-step4') {
      const img = step.querySelector('#maizeFinalAvatar');
      if (img) {
        const fallback =
          (window.AVATAR_SRC_BY_PERFIL &&
            window.selectedPerfil2050 &&
            window.AVATAR_SRC_BY_PERFIL[window.selectedPerfil2050]) ||
          (window.AVATAR_SRC_BY_PERFIL && window.AVATAR_SRC_BY_PERFIL.rooted) || '';
        img.src = window.selectedAvatarSrc || fallback;
        img.alt = `Avatar (${window.selectedPerfil2050 || 'rooted'})`;
      }
      // ✅ aplicar tema final só nesta página
      qwrap?.classList.add('final-theme');
    } else {
      qwrap?.classList.remove('final-theme');
    }
  }
}



function toggleAreaVisualsForStep(area, stepEl){
  const areaRoot = document.getElementById(`area-${area}`);
  if (!areaRoot || !stepEl) return;

  // esconder se o step pedir (data-hide-visuals="true")
  const hide = stepEl.dataset.hideVisuals === 'true';

  // imagens “visuais” típicas das áreas
  const visuals = areaRoot.querySelectorAll(
    '.world-gif, .food-circle, .area-visual, #nutritionVisual'
  );
  visuals.forEach(el => el.classList.toggle('hidden', hide));

  // avatares mostrados no feedback (se existirem)
  const avatars = areaRoot.querySelectorAll(
    '.feedback-avatar, #climateFeedbackAvatar, #nutritionFeedbackAvatar'
  );
  avatars.forEach(el => el.classList.toggle('hidden', hide));
}

function currentAreaStepEl(area){
  const i = AREA_STEP_INDEX[area] || 1;
  return document.querySelector(`#${area}Quiz #${area}-step${i}`);
}

function validateAreaStep(stepEl){
  if (!stepEl) return false;

  if (stepEl.dataset.requireDrop === 'true'){
    const min = Number(stepEl.dataset.minDrops || '1');
    const basket = stepEl.parentElement.querySelector('.basket');
    const count = basket ? basket.querySelectorAll('.food-item').length : 0;
    return count >= min;
  }

  const radios = stepEl.querySelectorAll('input[type="radio"]');
  const checks = stepEl.querySelectorAll('input[type="checkbox"]');

  if (radios.length){
    const names = [...new Set([...radios].map(r => r.name))];
    for (const n of names){
      const selected = stepEl.querySelector(`input[type="radio"][name="${n}"]:checked`);
      if (!selected) return false;

      // se a opção escolhida for "other", obriga a ter texto no input do mesmo label
      if (selected.value.toLowerCase() === 'other'){
        const label = selected.closest('label');
        const txt = label?.querySelector('input[type="text"]');
        if (!txt || !txt.value.trim()) return false;
      }
    }
  }

  if (checks.length){
    const any = [...checks].some(c => c.checked);
    if (!any) return false;
    const other = [...checks].find(c => c.checked && c.value.toLowerCase() === 'other');
    if (other){
      const txt = other.closest('label')?.querySelector('input[type="text"]');
      if (txt && txt.value.trim() === '') return false;
    }
  }

  const requiredTexts = stepEl.querySelectorAll('textarea[required], [data-required-text]');
  for (const ta of requiredTexts){
    if (!ta.value.trim()) return false;
  }

  return true;
}

function nextAreaStep(area){
  const stepEl = currentAreaStepEl(area);
  console.log('[nextAreaStep] from', AREA_STEP_INDEX[area], 'current=', stepEl?.id);

  // Regras específicas do climate-step1 (cesto)
  if (area === 'climate' && stepEl && stepEl.id === 'climate-step1'){
    const err = checkBasketConstraints(area);
    if (err){
      if (typeof shakeBasket === 'function') shakeBasket(area);
      toast(err, { type:'error' });
      return;
    }
  }

  if (area === 'nutrition'){
    const stepEl = currentAreaStepEl(area);
    // guardar ordem do ranking sempre que saíres do step1
    if (stepEl?.id === 'nutrition-step1') saveNutritionRankOrder();

    // guardar texto do "why swap" ao sair do step4
    if (stepEl?.id === 'nutrition-step4'){
      const ta = document.getElementById('nutritionWhySwap');
      const hidden = document.getElementById('nutritionWhySwapValue');
      if (ta && hidden) hidden.value = ta.value.trim();
    }
  }

  if (stepEl.dataset.selectExact || stepEl.dataset.selectMin || stepEl.dataset.selectMax){
    const err = checkSelectConstraints(stepEl);
    if (err){ toast(err, { type:'warning' }); return; }
  }

  if (area === 'culture'){
    if (stepEl?.id === 'culture-step1'){
      // Se o novo step usa cards (tem data-select-exact), delega para a validação genérica
      if (!stepEl.dataset.selectExact){
        // (modo antigo com DnD ainda ativo noutros projetos)
        if (!validateCultureQ1AllPlaced()) return;
      }
    }
    if (stepEl?.id === 'culture-step2'){
      const pool = document.getElementById('cultureStatusPool');
      if (pool && pool.querySelectorAll('.sort-card').length > 0){
        toast('Please classify all foods into one of the two categories.', { type:'warning' });
        return;
      }
    }
  }

  // MAIZE – ao sair do step3, guarda o texto aberto
  if (area === 'maize') {
    const stepEl = currentAreaStepEl(area);
    if (stepEl?.id === 'maize-step3') {
      const ta = document.getElementById('maizeReflectionOpen');
      const hidden = document.getElementById('maizeReflectionOpenValue');
      if (ta && hidden) hidden.value = ta.value.trim();
    }
  }
    
  // Validação genérica do passo
  if (!validateAreaStep(stepEl)){
    toast('Please answer before continuing.', { type:'warning' });
    return;
  }

  // Avança o índice e ativa o passo seguinte
  AREA_STEP_INDEX[area] = (AREA_STEP_INDEX[area] || 1) + 1;
  console.log('[nextAreaStep] -> to', AREA_STEP_INDEX[area]);
  setAreaStepActive(area, AREA_STEP_INDEX[area]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function finishAreaQuiz(area){
  const stepEl = currentAreaStepEl(area);
  const feedbackSteps = {
    climate:   { id: 'climate-step6',   group: 'climate_reflection',   otherSel: '#climateReflectionOther' },
    nutrition: { id: 'nutrition-step7', group: 'nutrition_reflection', otherSel: '#nutritionReflectionOther' },
    culture:   { id: 'culture-step6',   group: 'culture_reflection',   otherSel: '#cultureReflectionOther' },
  };

  const cfg = feedbackSteps[area];
  if (cfg && stepEl && stepEl.id === cfg.id) {
    const sel = stepEl.querySelector(`input[name="${cfg.group}"]:checked`);
    if (!sel) {
      toast('Please select one option before continuing.', { type: 'warning' });
      return; // impede avançar
    }
    if (sel.value === 'other') {
      const otherInput = stepEl.querySelector(cfg.otherSel);
      if (!otherInput || !otherInput.value.trim()) {
        toast('Please type your answer for "Other".', { type: 'warning' });
        return; // impede avançar
      }
    }
  }
  if (!validateAreaStep(stepEl)){
    toast('Please answer before continuing.', { type:'warning' });
    return;
  }

  // 1) Se houver textarea (ex.: step 2), guarda no hidden padrão
  const ta = stepEl.querySelector('textarea');
  const hiddenTxt = document.getElementById(`${area}ReasonValue`) || document.getElementById('climateReasonValue');
  if (ta && hiddenTxt) hiddenTxt.value = ta.value.trim();

  // 2) Se for o step 5 (keep/swap), garante que o JSON está atualizado
  if (stepEl.id === `${area}-step5` && typeof collectSwapMenuValue === 'function'){
    collectSwapMenuValue(area);
  }

  // 3) Se for o step 6, já temos o hidden a ser atualizado no change; nada extra

  // 4) Termina a área e volta ao mapa
  completeArea(area);
}

function initClimateFeedbackIfNeeded(){
  const step = document.getElementById('climate-step6');
  if (!step || step.dataset._init) return;
  step.dataset._init = '1';

  const otherInput = step.querySelector('#climateReflectionOther');
  // enable/disable da caixa "Other"
  step.addEventListener('change', (e)=>{
    if (e.target && e.target.name === 'climate_reflection'){
      const isOther = e.target.value === 'other';
      if (otherInput){
        otherInput.disabled = !isOther;
        if (isOther) otherInput.focus(); else otherInput.value = '';
      }
    }
  });

  // escreve JSON no hidden
  wireReflectionGroupToHidden('climate_reflection', '#climateReflectionOther', 'climateReflectionValue', step);

  // estado inicial do enable/disable
  const sel = step.querySelector('input[name="climate_reflection"]:checked');
  otherInput && (otherInput.disabled = !(sel && sel.value === 'other'));
}

/* ==========================================================================
   6) Basket (click-only) + restrições da área Climate
   ========================================================================== */
const LIMITS = {
  climate: {
    maxTotal: 5,
    maxPerCategory: { meat: 1, dairy: 1 }
  }
};

function getBasketState(area){
  const basket = document.getElementById(`${area}Basket`);
  const items = [...(basket?.querySelectorAll('.food-item') || [])];
  const counts = items.reduce((acc, el) => {
    const cat = (el.dataset.category || 'other').toLowerCase();
    acc.total++;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, { total: 0 });
  return { basket, items, counts };
}

function canAddToBasket(area, itemEl){
  if (!itemEl) return { ok:false, reason:'Invalid item.' };
  if (area !== 'climate') return { ok:true };

  const { counts } = getBasketState(area);
  const cat = (itemEl.dataset.category || 'other').toLowerCase();

  if (counts.total >= LIMITS.climate.maxTotal)
    return { ok:false, reason:'You can only carry 5 items.' };

  if (cat === 'meat'  && (counts.meat  || 0) >= LIMITS.climate.maxPerCategory.meat)
    return { ok:false, reason:'You can choose only 1 from “Meat and plant-based alternatives”.' };

  if (cat === 'dairy' && (counts.dairy || 0) >= LIMITS.climate.maxPerCategory.dairy)
    return { ok:false, reason:'You can choose only 1 from “Drinks and dairy”.' };

  return { ok:true };
}

function tryAddToBasket(area, itemEl){
  const { ok, reason } = canAddToBasket(area, itemEl);
  if (!ok){ shakeBasket(area); toast(reason, { type:'error' }); return false; }
  const { basket } = getBasketState(area);
  basket.appendChild(itemEl);
  updateBasketSelection(area);
  return true;
}

function returnToHome(area, itemEl){
  const shelf = document.getElementById(`${area}Shelf`);
  if (!shelf || !itemEl) return;
  const home = document.getElementById(itemEl.dataset.home);
  if (home){
    const idx = parseInt(itemEl.dataset.idx, 10);
    const children = [...home.children].filter(n=> n.classList?.contains('food-item'));
    const beforeNode = Number.isInteger(idx) && idx < children.length ? children[idx] : null;
    home.insertBefore(itemEl, beforeNode);
  } else {
    shelf.appendChild(itemEl);
  }
  updateBasketSelection(area);
}

function shakeBasket(area){
  const basket = document.getElementById(`${area}Basket`);
  if (!basket) return;
  basket.classList.remove('shake');
  void basket.offsetWidth;
  basket.classList.add('shake');
}

function checkBasketConstraints(area){
  const step = document.getElementById(`${area}-step1`);
  const exact = Number(step?.dataset.exactDrops || '5');

  const { counts } = getBasketState(area);

  if (counts.total !== exact) {
    return `Please select exactly ${exact} items to continue.`;
  }
  if ((counts.meat || 0) > 1)  return 'You can choose only 1 from “meat & alternatives”.';
  if ((counts.dairy || 0) > 1) return 'You can choose only 1 from “dairy & alternatives”.';

  return null;
}

function initClickSelectForArea(area){
  if (initClickSelectForArea._inited?.[area]) return;
  (initClickSelectForArea._inited ||= {})[area] = true;

  const shelf  = document.getElementById(`${area}Shelf`);
  const basket = document.getElementById(`${area}Basket`);
  if (!shelf || !basket) { console.warn('Missing shelf/basket for', area); return; }

  const grids = [...shelf.querySelectorAll('.category-grid')];
  grids.forEach(grid=>{
    if (!grid.id) grid.id = `${area}Cat-${grid.dataset.category || Math.random().toString(36).slice(2)}`;
    [...grid.querySelectorAll('.food-item')].forEach((it,i)=>{
      if (!it.dataset.home)     it.dataset.home = grid.id;
      if (!it.dataset.idx)      it.dataset.idx  = String(i);
      if (!it.dataset.category) it.dataset.category = grid.dataset.category || 'other';
      if (!it.id) it.id = `${grid.id}-item-${i}`;
    });
  });

  shelf.addEventListener('click', e=>{
    const item = e.target.closest('.food-item');
    if (!item) return;
    if (item.parentElement === basket) return;
    tryAddToBasket(area, item);
  });

  basket.addEventListener('click', e=>{
    const item = e.target.closest('.food-item');
    if (!item) return;
    returnToHome(area, item);
  });

  updateBasketSelection(area);
}

function updateBasketSelection(area){
  const basket = document.getElementById(`${area}Basket`);
  const hidden = document.getElementById(`${area}DragSelection`);
  const countEl = document.getElementById(`${area}Count`);
  if (!basket || !hidden) return;

  const items = [...basket.querySelectorAll('.food-item')].map(el=>({
    id: el.id,
    label: el.querySelector('span')?.textContent?.trim() || '',
    maize: el.dataset.maize || 'no',
    novel: el.dataset.novel || 'no',
    category: el.dataset.category || 'other'
  }));

  hidden.value = JSON.stringify(items);
  if (countEl) countEl.textContent = items.length;

  const hint = basket.querySelector('.basket-hint');
  if (hint) hint.style.display = items.length ? 'none' : '';
}

window.resetBasket = function(area){
  const shelf  = document.getElementById(`${area}Shelf`);
  const basket = document.getElementById(`${area}Basket`);
  if (!shelf || !basket) return;

  [...basket.querySelectorAll('.food-item')].forEach(el=>{
    const home = document.getElementById(el.dataset.home);
    if (home){
      const idx = parseInt(el.dataset.idx, 10);
      const children = [...home.children].filter(n=> n.classList?.contains('food-item'));
      const beforeNode = Number.isInteger(idx) && idx < children.length ? children[idx] : null;
      home.insertBefore(el, beforeNode);
    } else {
      shelf.appendChild(el);
      console.warn('Home grid not found for', el.id, '→ appended to shelf');
    }
  });

  updateBasketSelection(area);
};

// ===== Swipe Q3 =====
const SWIPE_STATE = {}; // por área

function initSwipeIfNeeded(area){
  if (SWIPE_STATE[area]?.inited) return;
  SWIPE_STATE[area] = { inited:true, choices: [] };
  setupSwipeDeck(area);
}

function setupSwipeDeck(area){
  const deck   = document.getElementById(`${area}SwipeDeck`);
  const done   = document.getElementById(`${area}SwipeDone`);
  const hidden = document.getElementById(`${area}SwipeChoices`);
  if (!deck) return;

  // evita inicializações duplicadas
  if (deck.dataset._swipeInit === '1') return;
  deck.dataset._swipeInit = '1';

  // reset estado
  SWIPE_STATE[area] = { inited:true, choices: [] };
  if (hidden) hidden.value = '[]';

  // ids já registados nesta sessão do deck
  const seen = new Set();

  // ————— helper para extrair texto visível do cartão
  function extractLabelFromCard(el){
    return (
      el?.getAttribute('data-label') ||
      el?.querySelector('[data-label]')?.getAttribute('data-label') ||
      el?.querySelector('.label, .title, .card-title, span, p, h3, h4')?.textContent ||
      el?.textContent ||
      ''
    ).replace(/\s+/g,' ').trim();
  }

  // empilha (o último filho é o topo) e garante ids/labels
  styleStack();
  attachTop();

  function styleStack(){
    const cards = [...deck.querySelectorAll('.card')];
    cards.forEach((c, i) => {
      // 👉 garante um id e um label estável em data-*
      if (!c.dataset.id)     c.dataset.id     = c.getAttribute('id') || `card-${i}`;
      if (!c.dataset.label)  c.dataset.label  = extractLabelFromCard(c);

      const z = i + 1;
      const off = (cards.length - 1 - i) * 8;   // leve offset
      const sc  = 1 - (cards.length - 1 - i) * 0.03;
      c.style.zIndex = z;
      c.style.transform = `translateY(${off}px) scale(${sc})`;
      c.style.opacity = '1';
    });
  }

  function attachTop(){
    const top = deck.querySelector('.card:last-child');
    if (!top){
      if (done) done.classList.remove('hidden'); // acabou o baralho
      return;
    }
    enableDrag(top);
  }

  function enableDrag(card){
    let sx=0, sy=0, dx=0, dy=0, dragging=false;

    const onStart = (ev) => {
      dragging = true;
      const p = getPoint(ev);
      sx = p.x; sy = p.y;
      card.style.transition = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, {passive:false});
      window.addEventListener('mouseup', onEnd, {once:true});
      window.addEventListener('touchend', onEnd, {once:true});
    };

    const onMove = (ev) => {
      if (!dragging) return;
      if (ev.cancelable) ev.preventDefault();
      const p = getPoint(ev);
      dx = p.x - sx; dy = p.y - sy;
      const rot = dx * 0.06;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      card.style.opacity = String(Math.max(0.6, 1 - Math.abs(dx)/800));
    };

    const onEnd = () => {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);

      const TH = 90; // limiar horizontal
      if (Math.abs(dx) > TH){
        const dir = dx > 0 ? 'right' : 'left';
        fling(card, dir);
      } else {
        card.style.transition = 'transform .2s ease';
        styleStack();
      }
    };

    card.addEventListener('mousedown', onStart);
    card.addEventListener('touchstart', onStart, {passive:true});
  }

  function fling(card, dir){
    // já foi processado? evita duplos (touch+mouse)
    if (card.dataset._swiped === '1') return;
    card.dataset._swiped = '1';

    // anima para fora
    card.style.transition = 'transform .28s ease, opacity .28s ease';
    const toX = dir === 'right' ? window.innerWidth * 0.9 : -window.innerWidth * 0.9;
    const rot = dir === 'right' ? 25 : -25;
    card.style.transform = `translate(${toX}px, 0) rotate(${rot}deg)`;
    card.style.opacity = '0';

    // ⚠️ lê já do próprio card antes de remover
    const id    = card.dataset.id    || 'unknown';
    const label = card.dataset.label || extractLabelFromCard(card);
    const choice = dir === 'right' ? 'buy' : 'skip';
    registerChoice(id, label, choice);

    setTimeout(() => {
      card.remove();
      styleStack();
      attachTop();
    }, 280);
  }

  function registerChoice(id, label, choice){
    // não voltar a registar o mesmo id
    if (seen.has(id)) return;
    seen.add(id);

    const st = SWIPE_STATE[area];
    const entry = { id, label, choice };

    // dedup por segurança
    const idx = st.choices.findIndex(x => x.id === id);
    if (idx >= 0) st.choices[idx] = entry;
    else          st.choices.push(entry);

    if (hidden) hidden.value = JSON.stringify(st.choices);
  }

  function getPoint(ev){
    if (ev.touches && ev.touches[0]) return { x:ev.touches[0].clientX, y:ev.touches[0].clientY };
    return { x:ev.clientX, y:ev.clientY };
  }

  // Controlo por botões (se existirem)
  window.swipeLeft  = (a) => { if (a!==area) return; const top = deck.querySelector('.card:last-child'); if (top) fling(top,'left'); };
  window.swipeRight = (a) => { if (a!==area) return; const top = deck.querySelector('.card:last-child'); if (top) fling(top,'right'); };
}


// ===== Q4 (hot day) — escolher exatamente 2 =====
function initHeatPickIfNeeded(area){
  const step = document.getElementById(`${area}-step4`);
  if (!step || step.dataset._heatInit) return;
  step.dataset._heatInit = '1';

  // garante o hidden
  let hidden = document.getElementById(`${area}HeatChoices`);
  if (!hidden){
    hidden = document.createElement('input');
    hidden.type  = 'hidden';
    hidden.id    = `${area}HeatChoices`;
    hidden.name  = `${area}HeatChoices`;
    hidden.value = '[]';
    step.appendChild(hidden);
  }

  // recolhe os cartões válidos
  const cards = [...step.querySelectorAll('.heat-card[data-selectable]')];
  if (!cards.length) {
    console.warn(`[heat] Nenhum .heat-card[data-selectable] encontrado em ${area}-step4`);
  }

  // helper para extrair label visível/estável
  function labelOf(card){
    return (
      card.dataset.label ||
      card.querySelector('.label, .title, .card-title, span, p, h3, h4')?.textContent ||
      card.textContent ||
      ''
    ).replace(/\s+/g,' ').trim();
  }

  function updateHiddenAndLocks(){
    const selected = cards
      .filter(c => c.classList.contains('selected'))
      .map(c => ({
        id: c.dataset.id || '',
        label: labelOf(c),
        maize: c.dataset.maize || 'no'
      }));

    hidden.value = JSON.stringify(selected);

    const max = Number(step.dataset.selectMax || step.dataset.selectExact || 2);
    if (selected.length >= max){
      cards.forEach(c => {
        if (!c.classList.contains('selected')) c.classList.add('disabled');
      });
    } else {
      cards.forEach(c => c.classList.remove('disabled'));
    }
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const max = Number(step.dataset.selectMax || step.dataset.selectExact || 2);
      const selNow = step.querySelectorAll('.heat-card.selected').length;

      if (card.classList.contains('selected')){
        card.classList.remove('selected');
      } else {
        if (selNow >= max){
          toast(`You can select up to ${max} items.`, { type:'warning' });
          return;
        }
        card.classList.add('selected');
      }
      updateHiddenAndLocks();
    });
  });

  // inicializa hidden e locks
  updateHiddenAndLocks();
}


function checkSelectConstraints(stepEl){
  // genérico: olha para [data-selectable].selected dentro do passo
  const count = stepEl.querySelectorAll('[data-selectable].selected').length;
  const exact = stepEl.dataset.selectExact;
  const min   = stepEl.dataset.selectMin;
  const max   = stepEl.dataset.selectMax;

  if (exact){
    const n = Number(exact);
    if (count !== n) return `Please select exactly ${n} items.`;
  } else {
    if (min && count < Number(min)) return `Please select at least ${min} items.`;
    if (max && count > Number(max))   return `Please select at most ${max} items.`;
  }
  return null;
}

// ===== Q5 (swap/keep) =====
function initSwapMenuIfNeeded(area){
  const step = document.getElementById(`${area}-step5`);
  if (!step || step.dataset._swapInit) return;
  step.dataset._swapInit = '1';

  // Atualiza JSON sempre que o utilizador escolhe algo
  step.addEventListener('change', (e)=>{
    const t = e.target;
    if (t && t.name && t.type === 'radio'){
      collectSwapMenuValue(area);
    }
  });

  // Inicializa o hidden
  collectSwapMenuValue(area);
}

function collectSwapMenuValue(area){
  const step = document.getElementById(`${area}-step5`);
  if (!step) return;
  const hidden = document.getElementById(`${area}SwapChoices`);
  if (!hidden) return;

   const get = (name) => {
     const el = step.querySelector(`input[type="radio"][name="${name}"]:checked`);
     if (!el) return null;
     return { value: el.value, label: labelForInput(el) };
   };

  const payload = {
    rice:   { choice: get('swap_rice'),   swap_to: ['maize-based cereals','potatoes','millet'] },
    milk:   { choice: get('swap_milk'),   swap_to: ['corn milk'] },
    meat:   { choice: get('swap_meat'),   swap_to: ['legume & maize bowls'] },
    snacks: { choice: get('swap_snacks'), swap_to: ['corn-based snacks'] },
  };

  hidden.value = JSON.stringify(payload);
}

/* ==========================================================================
   7) INIT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Garantir o stacking correto desde o início
  const areaRoot = document.getElementById('area-climate');
  const gif = areaRoot?.querySelector('.world-gif');
  const quiz = document.getElementById('climateQuiz');
   if (quiz){ quiz.style.position='relative'; quiz.style.zIndex='2'; }

  // Preparar o click-only do climate
  if (document.getElementById('climateShelf')) {
    initClickSelectForArea('climate');
  }

   const agree = document.getElementById('consentAgree');
  const startBtn = document.getElementById('consentStartBtn');
     if (agree && startBtn) {
       const sync = () => { startBtn.disabled = !agree.checked; };
       sync();
       agree.addEventListener('change', sync);
     }
});

/* ==========================================================================
   8) EXPORT GLOBALS (usados no HTML)
   ========================================================================== */
window.informConsent      = informConsent;
window.startSurvey        = startSurvey;
window.showReady          = showReady;
window.goToGame           = goToGame;
window.createyourself2050 = createyourself2050;
window.yourself2050       = yourself2050;
window.readytobegin       = readytobegin;
window.startAdventure     = startAdventure;
window.showAreaQuiz       = showAreaQuiz;
window.nextAreaStep = nextAreaStep;
window.finishAreaQuiz = finishAreaQuiz;

/* =========================
   NUTRITION – INIT HELPERS
   ========================= */

// 1) Ranking (step1)

function initNutritionArea(){
  // Evita re-inicializar várias vezes
  if (initNutritionArea._inited) return;
  initNutritionArea._inited = true;

  // Ranking da Q1 (desktop + mobile fallback)
  initRankSort_Nutrition();

  // Se tiveres outras inits (Q2, Q4.1, reflection-other), chamamos só se existirem
  if (typeof initNutritionQ2 === 'function') initNutritionQ2();
  if (typeof initNutritionQ41 === 'function') initNutritionQ41();
  if (typeof initNutritionReflectionOther === 'function') initNutritionReflectionOther();
}

function initRankSort_Nutrition(){
  const list = document.getElementById('nutritionPriorityList');
  if (!list) { console.warn('[nutrition] #nutritionPriorityList não encontrado'); return; }
  if (initRankSort_Nutrition._done) return;
  initRankSort_Nutrition._done = true;

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch){
    enableNutritionRankFallback(list);
    saveNutritionRankOrder();
    return;
  }

  [...list.querySelectorAll('.rank-item')].forEach(li => li.draggable = true);

  // ---- Drag & Drop (desktop) ----
  let dragEl = null;

  list.addEventListener('dragstart', e=>{
    const li = e.target.closest('.rank-item');
    if (!li) return;
    dragEl = li;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'rank'); // necessário em alguns browsers
    setTimeout(()=> dragEl.classList.add('dragging'), 0);
  });

  list.addEventListener('dragend', ()=>{
    dragEl?.classList.remove('dragging');
    dragEl = null;
    saveNutritionRankOrder();
  });

  ['dragover','dragenter'].forEach(ev=>{
    list.addEventListener(ev, e=> e.preventDefault());
  });

  list.addEventListener('dragover', e=>{
    e.preventDefault();
    const after = getDragAfterElement(list, e.clientY);
    const cur = list.querySelector('.rank-item.dragging');
    if (!cur) return;
    if (!after) list.appendChild(cur);
    else list.insertBefore(cur, after);
  });

  function getDragAfterElement(container, y){
    const els = [...container.querySelectorAll('.rank-item:not(.dragging)')];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    for (const child of els){
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height/2;
      if (offset < 0 && offset > closest.offset){
        closest = { offset, element: child };
      }
    }
    return closest.element;
  }

  // guarda ordem inicial
  saveNutritionRankOrder();
}

function enableNutritionRankFallback(list){
  [...list.querySelectorAll('.rank-item')].forEach(li=>{
    li.draggable = false;
    if (li.querySelector('.moves')) return;

    const moves = document.createElement('span');
    moves.className = 'moves'; // sem estilos inline

    const up = document.createElement('button');
    up.type = 'button'; up.className = 'move'; up.textContent = '↑';

    const down = document.createElement('button');
    down.type = 'button'; down.className = 'move'; down.textContent = '↓';

    up.addEventListener('click', ()=>{
      const prev = li.previousElementSibling;
      if (prev) list.insertBefore(li, prev);
      saveNutritionRankOrder();
    });
    down.addEventListener('click', ()=>{
      const next = li.nextElementSibling;
      if (next) list.insertBefore(next, li);
      saveNutritionRankOrder();
    });

    moves.append(up, down);
    li.appendChild(moves);
    li.style.cursor = 'default';
  });
}

function saveNutritionRankOrder(){
  const list = document.getElementById('nutritionPriorityList');
  const hidden = document.getElementById('nutritionPriorityOrder');
  if (!list || !hidden) return;
  const order = [...list.querySelectorAll('.rank-item')].map(li => li.dataset.key);
  hidden.value = JSON.stringify(order);
  // console.log('[rank order]', hidden.value);
}

// 3) Q5 (4.1) – toggle textarea quando “Yes”
function initNutritionQ41(){
  if (initNutritionQ41._done) return; initNutritionQ41._done = true;
  const radios = document.querySelectorAll('input[name="nutrition_breakfast_healthier"]');
  const wrap = document.getElementById('nutritionHealthierExplainWrap');
  const ta   = document.getElementById('nutritionHealthierExplain');
  if (!radios.length || !wrap || !ta) return;

  function sync(){
    const yes = document.querySelector('input[name="nutrition_breakfast_healthier"][value="yes"]').checked;
    wrap.classList.toggle('hidden', !yes);
    if (yes) ta.setAttribute('data-required-text','true');
    else     ta.removeAttribute('data-required-text');
  }
  radios.forEach(r=> r.addEventListener('change', sync));
  sync();
}

function initNutritionQ2(){
  const step = document.getElementById('nutrition-step2');
  if (!step || step.dataset._q2init) return;
  step.dataset._q2init = '1';

  const cards  = [...step.querySelectorAll('.option-card[data-selectable]')];
  const noneCard = step.querySelector('.option-card[data-none="true"]');
  const hidden = document.getElementById('nutritionQ2Choices');

  const max = Number(step.dataset.selectMax || 3);
  const min = Number(step.dataset.selectMin || 1);

  function selectedCards(){
    return cards.filter(c => c.classList.contains('selected'));
  }

   function save(){
     const sel = selectedCards();
     const arr = sel.map(c => ({
       id: c.dataset.id,
       label: (c.querySelector('.label, .title, span, p, h3')?.textContent || c.textContent || '')
                .replace(/\s+/g,' ').trim()
     }));
     hidden.value = JSON.stringify(arr);
   }

  function refreshLocks(){
    const sel = selectedCards();
    const hasNone = noneCard && noneCard.classList.contains('selected');

    if (hasNone){
      // se “none” estiver selecionado, bloqueia todos os outros
      cards.forEach(c => {
        if (c !== noneCard) c.classList.add('disabled');
        else c.classList.remove('disabled');
      });
      return;
    }

    // normal: se já chegámos ao máximo, bloqueia os restantes não selecionados
    if (sel.length >= max){
      cards.forEach(c => { if (!c.classList.contains('selected')) c.classList.add('disabled'); });
    } else {
      cards.forEach(c => c.classList.remove('disabled'));
    }
  }

  function toggleCard(card){
    // clique no “none”
    if (card === noneCard){
      const willSelect = !card.classList.contains('selected');
      // ao selecionar “none”, limpa os outros
      cards.forEach(c => { if (c !== noneCard) c.classList.remove('selected'); });
      if (willSelect) noneCard.classList.add('selected'); else noneCard.classList.remove('selected');
      refreshLocks(); save(); return;
    }

    // se “none” estiver ativo, desativa-o
    if (noneCard && noneCard.classList.contains('selected')){
      noneCard.classList.remove('selected');
    }

    // se estiver disabled, não faz nada
    if (card.classList.contains('disabled')) return;

    // toggle normal respeitando o máximo
    if (card.classList.contains('selected')){
      card.classList.remove('selected');
    } else {
      const count = selectedCards().length;
      if (count >= max){
        toast(`You can select up to ${max} options.`, { type:'warning' });
        return;
      }
      card.classList.add('selected');
    }

    refreshLocks(); save();
  }

  cards.forEach(c => c.addEventListener('click', () => toggleCard(c)));

  // inicializa
  refreshLocks(); save();
}

// 4) Feedback “Other” – enable/disable
function initNutritionReflectionOther(){
  if (initNutritionReflectionOther._done) return; initNutritionReflectionOther._done = true;
  const otherInput = document.getElementById('nutritionReflectionOther');
  const radios = document.querySelectorAll('input[name="nutrition_reflection"]');
  if (!otherInput || !radios.length) return;

  function sync(){
    const isOther = document.querySelector('input[name="nutrition_reflection"][value="other"]')?.checked;
    otherInput.disabled = !isOther;
    otherInput.placeholder = isOther ? 'Type your answer...' : '';
  }
  radios.forEach(r=> r.addEventListener('change', sync));
  sync();
}

function initNutritionFeedbackIfNeeded(){
  const step = document.getElementById('nutrition-step7');
  if (!step || step.dataset._initRef) return;
  step.dataset._initRef = '1';

  const otherInput = step.querySelector('#nutritionReflectionOther');

  step.addEventListener('change', (e)=>{
    if (e.target && e.target.name === 'nutrition_reflection'){
      const isOther = e.target.value === 'other';
      if (otherInput){
        otherInput.disabled = !isOther;
        if (isOther) otherInput.focus(); else otherInput.value = '';
      }
    }
  });

  wireReflectionGroupToHidden('nutrition_reflection', '#nutritionReflectionOther', 'nutritionReflectionValue', step);

  const sel = step.querySelector('input[name="nutrition_reflection"]:checked');
  otherInput && (otherInput.disabled = !(sel && sel.value === 'other'));
}

/* =========================
   CULTURE – INIT & HELPERS
   ========================= */

function initCultureArea(){
  if (initCultureArea._inited) return;
  initCultureArea._inited = true;

  // Step1 dnd (1 afirmação para 1 de 3 colunas)
  initCultureQ1Cards();

  // Step2 dnd (classificar todos)
  initCultureQ2();

  // Step3 “Other” enable/disable + hidden
  initCultureQ3();

  // Step4 – guardar escolha no hidden
  initCultureQ4();

  // Step5 – sincronizar múltiplas razões
  initCultureQ5();
}

/* ---- Step 1 ---- */
/* ---- Food Culture — Step 1 (cards, single-select) ---- */
function initCultureQ1Cards(){
  const step = document.getElementById('culture-step1');
  if (!step || step.dataset._q1cards) return;
  step.dataset._q1cards = '1';

  const cards  = [...step.querySelectorAll('.identity-card[data-selectable]')];
  const hidden = document.getElementById('cultureIdentityChoice');

  // Pode nem existir "Other" neste step — deixamos defensivo
  const otherCard = step.querySelector('.identity-card[data-id="other"]') || null;
  const otherWrap = otherCard ? otherCard.querySelector('.other-input-wrap') : null;
  const otherInp  = otherCard ? otherCard.querySelector('input,textarea') : null;

  function selectCard(card){
    // unselect all
    cards.forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-selected','false'); });

    // select clicked
    card.classList.add('selected');
    card.setAttribute('aria-selected','true');

    const isOther = (card === otherCard);
    const labelFromCard = (card.querySelector('.label, .title, span, p, h3')?.textContent || card.textContent || '')
                            .replace(/\s+/g,' ').trim();

    if (isOther && otherWrap){
      // mostrar input “Other”
      otherWrap.classList.remove('hidden');
      if (otherInp){
        otherInp.disabled = false;
        otherInp.setAttribute('data-required-text','true');
        otherInp.focus();
      }
      hidden.value = JSON.stringify({
        value: 'other',
        text: (otherInp?.value || '').trim(),
        label: 'Other'
      });
    } else {
      // esconder/limpar “Other”
      if (otherWrap) otherWrap.classList.add('hidden');
      if (otherInp){
        otherInp.disabled = true;
        otherInp.removeAttribute('data-required-text');
        otherInp.value = '';
      }
      // guardar value + label do cartão escolhido
      hidden.value = JSON.stringify({ value: (card.dataset.id || ''), label: labelFromCard });
    }

    if (otherCard) otherCard.setAttribute('aria-expanded', String(isOther));
  }

  if (otherInp){
    otherInp.addEventListener('input', () => {
      if (otherCard?.classList.contains('selected')) {
        hidden.value = JSON.stringify({
          value:'other',
          text: otherInp.value.trim(),
          label: 'Other'
        });
      }
    });
  }

  cards.forEach(c => c.addEventListener('click', () => selectCard(c)));

  // estado inicial
  hidden.value = '';
}


function initCultureQ1(){
  const pool = document.getElementById('cultureIdentityPool');
  const zones = [
    document.getElementById('cultureColHeritage'),
    document.getElementById('cultureColFusion'),
    document.getElementById('cultureColFuturistic')
  ].filter(Boolean);
  if (!pool || !zones.length) return;

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch){
    enableCultureQ1TouchFallback(pool, zones);
  } else {
    enableSimpleDND([pool, ...zones]);
  }

  
  function syncHidden(){
    const placed = getCultureQ1Placements();
    const hidden = document.getElementById('cultureIdentityChoice');
    if (hidden) hidden.value = placed.length ? JSON.stringify(placed) : '';
  }

  [pool, ...zones].forEach(c => {
    c.addEventListener('drop', syncHidden);
    c.addEventListener('dragend', syncHidden);
    c.addEventListener('click', syncHidden);
  });

  // estado inicial
  const hidden = document.getElementById('cultureIdentityChoice');
  if (hidden) hidden.value = '';
}

function getCultureQ1Placements(){
  const zones = [
    ['cultureColHeritage',  'heritage'],
    ['cultureColFusion',    'fusion'],
    ['cultureColFuturistic','lifestyle']
  ];
  const res = [];
  zones.forEach(([id, bucket]) => {
    const z = document.getElementById(id);
    if (!z) return;
    z.querySelectorAll('.identity-item').forEach(item => {
      res.push({
        id: item.dataset.id || item.id || '',
        bucket,
        label: (item.querySelector('.label')?.textContent || item.textContent || '').trim()
      });
    });
  });
  return res;
}

function validateCultureQ1AllPlaced(){
  const pool = document.getElementById('cultureIdentityPool');
  const remaining = pool ? pool.querySelectorAll('.identity-item').length : 0;

  if (remaining > 0){
    toast('Please drag all statements into one of the three columns (none can be left outside).', { type:'warning' });
    // opcional: pequeno “abanão” visual
    pool.classList.add('shake');
    setTimeout(() => pool.classList.remove('shake'), 280);
    return false;
  }

  // guarda no hidden (útil para análise posterior)
  const hidden = document.getElementById('cultureIdentityChoice');
  if (hidden) hidden.value = JSON.stringify(getCultureQ1Placements());
  return true;
}

function enableCultureQ1TouchFallback(pool, zones){
  const [heritage, fusion, futuristic] = zones;

  function addButtons(item){
    if (item.querySelector('.q1-moves')) return;
    const wrap = document.createElement('div');
    wrap.className = 'q1-moves';

    const mk = (label, zone) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.textContent = label;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        zone.appendChild(item);
      });
      return b;
    };

    wrap.append(
      mk('Heritage', heritage),
      mk('Fusion', fusion),
      mk('Lifestyle', futuristic)
    );
    item.appendChild(wrap);
  }

  // botões nos itens do pool
  pool.querySelectorAll('.identity-item').forEach(addButtons);

  // tocar num item já colocado manda-o de volta ao pool
  zones.forEach(z => {
    z.addEventListener('click', (e) => {
      const item = e.target.closest('.identity-item');
      if (item && item.parentElement !== pool) {
        pool.appendChild(item);
      }
    });
  });
}

/* ---- Step 2 ---- */
function initCultureQ2(){
  const pool        = document.getElementById('cultureStatusPool');
  const prestigious = document.getElementById('culturePrestigious');
  const everyday    = document.getElementById('cultureEveryday');
  if (!pool || !prestigious || !everyday) return;

  // Atualiza o hidden com a classificação atual
  function sync(){
    const toArr = (container, bucket) =>
      [...container.querySelectorAll('.sort-card')]
        .map(el => ({ id: el.dataset.id, bucket }));
    const payload = [
      ...toArr(prestigious, 'prestigious'),
      ...toArr(everyday,    'everyday')
    ];
    const hidden = document.getElementById('cultureStatusSort');
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch){
    // Fallback estilo Step 1 (botões em cada cartão)
    enableCultureQ2TouchFallback(pool, prestigious, everyday, sync);
  } else {
    // Desktop: drag & drop normal
    enableSimpleDND([pool, prestigious, everyday]);
    [pool, prestigious, everyday].forEach(c => {
      c.addEventListener('drop',    sync);
      c.addEventListener('dragend', sync);
    });
  }

  // Também sincroniza em cliques (útil no fallback e para segurança)
  [pool, prestigious, everyday].forEach(c => c.addEventListener('click', sync));

  // Estado inicial
  sync();
}

function enableCultureQ2TouchFallback(pool, prestigious, everyday, sync){
  // cria botões "Prestigious" e "Everyday" nos cartões do pool
  function addButtons(card){
    if (!card || card.querySelector('.q2-moves')) return;
    const wrap = document.createElement('div');
    wrap.className = 'q2-moves';

    const mk = (label, zone) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.textContent = label;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        zone.appendChild(card);
        sync();
      });
      return b;
    };

    wrap.append(
      mk('Prestigious', prestigious),
      mk('Everyday',    everyday)
    );
    card.appendChild(wrap);
  }

  // Botões nos cartões que já estão no pool
  pool.querySelectorAll('.sort-card').forEach(addButtons);

  // Tocar num cartão dentro de uma categoria devolve-o ao pool
  function onZoneClick(e){
    const card = e.target.closest('.sort-card');
    if (card && card.parentElement !== pool){
      pool.appendChild(card);
      addButtons(card);   // reexibe os botões quando volta ao pool
      sync();
    }
  }
  prestigious.addEventListener('click', onZoneClick);
  everyday.addEventListener('click', onZoneClick);

  // Sempre que um cartão entrar no pool (por ex. vindo da categoria), volta a ganhar botões
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      [...m.addedNodes].forEach(n => {
        if (n.nodeType === 1 && n.classList.contains('sort-card')) addButtons(n);
      });
    });
  });
  obs.observe(pool, { childList: true });
}

/* ---- Step 3 ---- */
function initCultureQ3(){
  const step = document.getElementById('culture-step3');
  if (!step || step.dataset._q3init) return;
  step.dataset._q3init = '1';

  const cards     = [...step.querySelectorAll('.ingredient-card[data-selectable]')];
  const otherCard = step.querySelector('.ingredient-card[data-id="other"]');
  const otherWrap = otherCard?.querySelector('.other-input-wrap');
  const otherInp  = step.querySelector('#cultureRootOther');
  const hidden    = document.getElementById('cultureRootChoice');

  function selectCard(card){
    // unselect all
    cards.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-selected', 'false');
    });

    // select clicked
    card.classList.add('selected');
    card.setAttribute('aria-selected', 'true');

    // handle OTHER
    const isOther = (card === otherCard);
    if (otherWrap){
      otherWrap.classList.toggle('hidden', !isOther);
      if (otherInp){
        otherInp.disabled = !isOther;
        if (isOther){
          otherInp.setAttribute('data-required-text','true'); // validação já existente aproveitada
          otherInp.focus();
          hidden.value = (otherInp.value || '').trim();
        } else {
          otherInp.removeAttribute('data-required-text');
          otherInp.value = '';
          hidden.value = card.dataset.id || '';
        }
      }
    } else {
      // normal cards
      hidden.value = card.dataset.id || '';
    }

    // ajuda para leitores de ecrã em “Other”
    if (otherCard) otherCard.setAttribute('aria-expanded', String(isOther));
  }

  // eventos
  cards.forEach(c => c.addEventListener('click', () => selectCard(c)));
  otherInp?.addEventListener('input', () => {
    if (otherCard?.classList.contains('selected')) {
      hidden.value = otherInp.value.trim();
    }
  });

  // estado inicial
  hidden.value = '';
}

/* ---- Step 4 ---- */
function initCultureQ4(){
  const cards = document.querySelectorAll('#culture-step4 .night-card input[type="radio"]');
  const hidden = document.getElementById('cultureNightChoice');
  if (!cards.length || !hidden) return;
  function sync(){
     const sel = document.querySelector('#culture-step4 .night-card input[type="radio"]:checked');
     if (!sel){ hidden.value = ''; return; }
   
     // apanha o texto visível do cartão
     const card = sel.closest('.night-card');
     const label = (card?.querySelector('.label, .title, span, p, h3')?.textContent || card?.textContent || sel.value)
                    .replace(/\s+/g,' ').trim();
   
     hidden.value = JSON.stringify({ value: sel.value, label, maize: sel.dataset.maize || 'no' });
   }
  cards.forEach(r => r.addEventListener('change', sync));
  sync();
}

/* ---- Step 5 ---- */
function initCultureQ5(){
  const checks = document.querySelectorAll('input[name="culture_night_why"]');
  const hidden = document.getElementById('cultureNightWhy');
  if (!checks.length || !hidden) return;

  function sync(){
    const vals = [...checks]
      .filter(c => c.checked)
      .map(c => ({ value: c.value, label: labelForInput(c) }));
    hidden.value = JSON.stringify(vals);
  }

  checks.forEach(c => c.addEventListener('change', sync));
  sync();
}

/* ---- Feedback (Step 6) “Other” ---- */
function initCultureFeedbackIfNeeded(){
  const step = document.getElementById('culture-step6');
  if (!step || step.dataset._init) return;
  step.dataset._init = '1';

  const otherInput = step.querySelector('#cultureReflectionOther');
  step.addEventListener('change', (e)=>{
    if (e.target && e.target.name === 'culture_reflection'){
      const isOther = e.target.value === 'other';
      if (otherInput){
        otherInput.disabled = !isOther;
        if (isOther) otherInput.focus(); else otherInput.value = '';
      }
    }
  });

  wireReflectionGroupToHidden('culture_reflection', '#cultureReflectionOther', 'cultureReflectionValue', step);

  const sel = step.querySelector('input[name="culture_reflection"]:checked');
  otherInput && (otherInput.disabled = !(sel && sel.value === 'other'));
}

/* ---- Utilitário DnD simples para containers ---- */
function enableSimpleDND(containers){
  containers.forEach(container => {
    container.addEventListener('dragover', (e)=>{
      e.preventDefault();
      container.classList.add('drag-over');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    container.addEventListener('dragleave', ()=> container.classList.remove('drag-over'));
    container.addEventListener('drop', (e)=>{
      e.preventDefault();
      container.classList.remove('drag-over');
      const dragging = document.querySelector('._dragging');
      if (dragging) container.appendChild(dragging);
    });
  });

  const makeDraggable = (el) => {
    if (!el || el.dataset._dnd) return;
    el.dataset._dnd = '1';
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e)=>{
      el.classList.add('_dragging');
      if (e.dataTransfer){
        try { e.dataTransfer.setData('text/plain', el.dataset.id || 'item'); } catch {}
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    el.addEventListener('dragend', ()=> el.classList.remove('_dragging'));
  };

  containers.forEach(c => [...c.children].forEach(makeDraggable));

  const obs = new MutationObserver(muts => muts.forEach(m =>
    [...m.addedNodes].forEach(n => { if (n.nodeType === 1) makeDraggable(n); })
  ));
  containers.forEach(c => obs.observe(c, { childList:true }));
}

window.initCultureArea = initCultureArea;

function initMaizeArea(){
  if (initMaizeArea._inited) return;
  initMaizeArea._inited = true;

  // Nada especial a inicializar por agora;
  // radios e textarea já são validados pelo validateAreaStep().
}

// === Helpers para ler valores ===
function getRadioVal(name, root=document){
  const r = root.querySelector(`input[type="radio"][name="${name}"]:checked`);
  if (!r) return null;
  if (r.value.toLowerCase?.() === 'other') {
    const txt = r.closest('label')?.querySelector('input[type="text"]')?.value?.trim() || '';
    return { value: 'other', text: txt, label: 'Other' };
  }
  return { value: r.value, label: labelForInput(r) };
}


function getCheckVals(name, root=document){
  const selected = [...root.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`)];
  const out = [];
  for (const c of selected) {
    const v = (c.value || '').trim();
    if (v.toLowerCase() === 'other') {
      const txt = c.closest('label')?.querySelector('input[type="text"]')?.value?.trim() || '';
      out.push({ value: 'other', text: txt, label: 'Other' });
    } else {
      out.push({ value: v, label: labelForInput(c) });
    }
  }
  return out;
}

function getHiddenAuto(id){
  const el = document.getElementById(id);
  if (!el) return null;
  const v = (el.value || '').trim();
  if (!v) return null;
  try { return JSON.parse(v); } catch { return v; }
}

/**
 * Mantém o hidden `hiddenId` sempre sincronizado com:
 *  - { value: "other", text: "..." } quando o radio "other" é escolhido
 *  - { value: "<opção>" } para as restantes
 */
function wireReflectionGroupToHidden(groupName, otherInputSelector, hiddenId, root=document){
  const hidden   = document.getElementById(hiddenId);
  const otherInp = root.querySelector(otherInputSelector);
  const radios   = root.querySelectorAll(`input[name="${groupName}"]`);
  if (!hidden || !radios.length) return;

  function sync(){
    const sel = root.querySelector(`input[name="${groupName}"]:checked`);
    if (!sel) { hidden.value = ''; return; }

    const isOther = (sel.value || '').toLowerCase() === 'other';
    const lbl = labelForInput(sel); // ← usa o helper para apanhar o texto visível

    hidden.value = JSON.stringify(
      isOther
        ? { value: 'other', text: (otherInp?.value || '').trim(), label: 'Other' }
        : { value: sel.value, label: lbl }
    );
  }

  radios.forEach(r => r.addEventListener('change', sync));
  otherInp?.addEventListener('input', sync);
  sync();
}


function getText(selector){ return (document.querySelector(selector)?.value || '').trim(); }
function getJSONHidden(id){ try { return JSON.parse(document.getElementById(id)?.value || 'null'); } catch { return null; } }

// === Construir payload único com tudo ===
function buildSurveyPayload(){
  const ua = navigator.userAgent;
  const when = new Date().toISOString();
  const perfil = window.selectedPerfil2050 || null;

  // Demográfico
  const demoRoot = document.getElementById('demographicContainer') || document;
  const demographics = {
    demo_age:     getRadioVal('age', demoRoot),
    demo_gender:  getRadioVal('gender', demoRoot),
    demo_diet:    getRadioVal('diet', demoRoot),
    demo_allergies: getCheckVals('allergic', demoRoot),
    demo_nationality: getRadioVal('nationality', demoRoot),
    demo_city:    getText('input[name="city"]'),
    // ratings dos produtos
    demo_maizefood_ratings: {
      cornflakes: getRadioVal('cornflakes', demoRoot),
      cornbread:  getRadioVal('cornbread',  demoRoot),
      polenta:    getRadioVal('polenta',    demoRoot),
      sweetcorn:  getRadioVal('sweetcorn',  demoRoot),
      tortillas:  getRadioVal('tortillas',  demoRoot),
      nachos:     getRadioVal('nachos',     demoRoot),
      popcorn:    getRadioVal('popcorn',    demoRoot),
      corncake:    getRadioVal('corncake',    demoRoot),
    },
  };

  // CLIMATE
  const climate = {
    clim_Q1_basket:         getJSONHidden('climateDragSelection'),
    clim_Q2_why:    getText('#climateReason') || getText('#climateReasonValue'),
    clim_Q3_swipe_cards:  getJSONHidden('climateSwipeChoices'),
    clim_Q4_heat_choices:   getJSONHidden('climateHeatChoices'),
    clim_Q5_swap_choices:   getJSONHidden('climateSwapChoices'),
    clim_Q6_reflection:     getHiddenAuto('climateReflectionValue'),
  };

  // NUTRITION
  const nutrition = {
    nutri_Q1_priority_order:    getJSONHidden('nutritionPriorityOrder'),
    nutri_Q2_choices:        getJSONHidden('nutritionQ2Choices'),
    nutri_Q3_swap_choice:       getRadioVal('nutrition_swap_choice'),
    nutri_Q4_why_swap:     getText('#nutritionWhySwap') || getText('#nutritionWhySwapValue'),
    nutri_Q5_breakfast:         getRadioVal('nutrition_breakfast'),
    nutri_Q6_breakfast_healthier: {
      choice:          getRadioVal('nutrition_breakfast_healthier'),
      explain:         getText('#nutritionHealthierExplain')
    },
    nutri_Q7_reflection:        getHiddenAuto('nutritionReflectionValue'),
  };

  // CULTURE
  const culture = {
    cult_Q1_identity_choice: getJSONHidden('cultureIdentityChoice') || getRadioVal('culture_identity_single'), // compat anterior/novo
    cult_Q2_status_sort:     getJSONHidden('cultureStatusSort'),
    cult_Q3_root_choice:     getHiddenAuto('cultureRootChoice'),
    cult_Q4_night_choice:    getJSONHidden('cultureNightChoice'),
    cult_Q5_night_why:       getJSONHidden('cultureNightWhy'),
    cult_Q6_reflection:      getHiddenAuto('cultureReflectionValue'),
  };

  // MAIZE
  const maize = {
    maiz_Q1_reflect1:       getRadioVal('maize_reflect1'),
    maiz_Q2_future_role:    getRadioVal('maize_future_role'),
    maiz_Q3_reflection_open:getText('#maizeReflectionOpen') || getText('#maizeReflectionOpenValue'),
  };

  // id anónimo p/ correlacionar respostas
  const rid = (crypto?.randomUUID && crypto.randomUUID()) ||
              ('xxxxxx'.replace(/x/g, ()=>Math.floor(Math.random()*16).toString(16)) + Date.now());

  return {
    response_id: rid,
    submitted_at: when,
    user_agent: ua,
    perfil_2050: perfil,
    data: { demographics, climate, nutrition, culture, maize }
  };
}

// === Enviar para backend; fallback: download .json ===
// === Backend base/endpoint ===
// === Backend base/endpoint (fonte única de verdade) ===
const API_BASE = 'https://survey-backend-vpdf.onrender.com';
const ENDPOINT = `${API_BASE}/submit`;

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_BASE}/health`, { mode: 'cors', cache: 'no-store' }).catch(()=>{});
});

/* ========= NÃO FAZ DOWNLOAD. Tenta enviar e devolve ok/erro ========= */
async function sendPayload(payload){
  // timeout defensivo (15s)
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);

  try{
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      keepalive: true,
      credentials: 'omit',
      signal: ctrl.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let extra = '';
      try { extra = (await res.text()).slice(0,160); } catch {}
      throw new Error(`HTTP ${res.status} ${res.statusText}${extra ? ' – ' + extra : ''}`);
    }
    return { ok: true };
  } catch (err){
    clearTimeout(timeout);
    return { ok: false, error: err?.message || String(err) };
  }
}


function showInlineSubmitError(msg){
  const step = document.getElementById('maize-step4');
  if (!step) return;

  let box = step.querySelector('#submitErrorMsg');
  if (!box){
    box = document.createElement('div');
    box.id = 'submitErrorMsg';
    box.setAttribute('role', 'alert');
    box.style.marginTop = '14px';
    box.style.padding = '12px 14px';
    box.style.background = '#ffe8e8';
    box.style.color = '#7e1c1c';
    box.style.border = '1px solid #f3bcbc';
    box.style.borderRadius = '10px';
    box.style.boxShadow = '0 2px 6px rgba(0,0,0,.08)';
    // tenta colocar junto ao botão final
    const cta = step.querySelector('.final-cta');
    (cta || step).appendChild(box);
  }
  box.textContent = msg;
}

// === Submissão final (substitui a tua função atual) ===
window.submitAllAndFinish = async function(){
  const btn = document.getElementById('finishSubmitBtn');
  document.getElementById('submitErrorMsg')?.remove();
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  const payload = buildSurveyPayload();
  const { ok, data, error } = await sendPayload(payload);

  if (ok) {
    // mostra um toast e loga o id na consola p/ confirmares no Supabase
    console.log('Saved OK:', data);
    toast('Answers submitted successfully. Thank you! 🎉', { type: 'info' });
    if (btn) { btn.textContent = 'Submitted'; }
  } else {
    console.error('Submit error:', error);
    showInlineSubmitError('We could not submit your answers right now. Please try again later.');
    if (btn) { btn.disabled = false; btn.textContent = 'Finish and submit answers!'; }
  }

};















