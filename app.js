(() => {
  'use strict';
  const STORAGE_KEY = 'medora.bp-notes.prototype.v1';
  const $ = (id) => document.getElementById(id);
  const form = $('reading-form');
  const summaryEditor = $('summary-text');
  let records = readRecords();
  let toastTimer;

  function readRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
    } catch { return []; }
  }
  function isValidRecord(row) {
    return row && typeof row.id === 'string' && Number.isFinite(Number(row.systolic)) && Number.isFinite(Number(row.diastolic)) && Number.isFinite(Date.parse(row.takenAt));
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return true; }
    catch { showToast('Could not save in this browser. Check available storage.'); return false; }
  }
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset); d.setHours(0, 0, 0, 0); return d;
  }
  function weekEnd(start) { const d = new Date(start); d.setDate(d.getDate() + 6); d.setHours(23,59,59,999); return d; }
  function currentWeekRecords() {
    const start = mondayOf(new Date()); const end = weekEnd(start);
    return records.filter(r => { const d = new Date(r.takenAt); return d >= start && d <= end; }).sort((a,b) => Date.parse(b.takenAt)-Date.parse(a.takenAt));
  }
  function formatDate(date, options = {weekday:'short',month:'short',day:'numeric'}) {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function medicationStatusLabel(value) {
    return ({'as-prescribed':'Taken as prescribed','missed-dose':'A dose was missed','changed-with-clinician':'Changed with my clinician','prefer-not':'Prefer not to record'})[value] || '';
  }
  function renderWeek() {
    const start = mondayOf(new Date()); const end = weekEnd(start); const entries = currentWeekRecords();
    $('week-range').textContent = `${formatDate(start)} – ${formatDate(end,{month:'short',day:'numeric',year:'numeric'})}`;
    $('week-count').textContent = entries.length;
    $('week-status').textContent = entries.length ? 'Your notes are ready whenever you want to review.' : 'Start with a reading whenever you’re ready.';
    $('summary-meta-text').textContent = entries.length ? `Draft includes ${entries.length} ${entries.length===1?'reading':'readings'} from this week` : 'A draft built only from your saved entries';
  }
  function renderRecords() {
    const list = $('reading-list'); const empty = $('empty-state'); const sorted = [...records].sort((a,b)=>Date.parse(b.takenAt)-Date.parse(a.takenAt));
    $('total-count').textContent = `${sorted.length} ${sorted.length===1?'entry':'entries'}`;
    empty.hidden = sorted.length > 0;
    list.innerHTML = sorted.map(row => {
      const notes = [
        row.feelingTags?.length && `Feeling: ${row.feelingTags.join(', ')}`,
        row.feelingNote && `Note: ${row.feelingNote}`,
        row.medicationName && `Medicine: ${row.medicationName}`,
        medicationStatusLabel(row.medicationStatus),
        row.medicationNote && `Medication note: ${row.medicationNote}`,
        row.contextNote && `Day context: ${row.contextNote}`,
        row.visitNote && `For my visit: ${row.visitNote}`
      ].filter(Boolean).join(' · ');
      return `<article class="reading-row"><span class="reading-date">${escapeHtml(formatDate(new Date(row.takenAt),{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</span><span class="reading-value">${escapeHtml(row.systolic)} / ${escapeHtml(row.diastolic)} <small>mmHg</small></span><button class="delete-button" type="button" data-delete="${escapeHtml(row.id)}" aria-label="Delete reading from ${escapeHtml(formatDate(new Date(row.takenAt)))}">Delete</button>${notes?`<span class="reading-notes">${escapeHtml(notes)}</span>`:''}</article>`;
    }).join('');
  }
  function buildDraft(entries = currentWeekRecords()) {
    if (!entries.length) return '';
    const sorted = [...entries].sort((a,b)=>Date.parse(a.takenAt)-Date.parse(b.takenAt));
    const start = mondayOf(new Date()); const end = weekEnd(start);
    const lines = [`MEDORA BP NOTES — WEEK OF ${formatDate(start,{month:'long',day:'numeric'})}–${formatDate(end,{month:'long',day:'numeric',year:'numeric'})}`, `${sorted.length} ${sorted.length===1?'reading':'readings'} recorded by the patient.`, '', 'READINGS'];
    sorted.forEach(row => {
      const time = formatDate(new Date(row.takenAt),{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      lines.push(`• ${time}: ${row.systolic}/${row.diastolic} mmHg`);
      if (row.feelingTags?.length) lines.push(`  Feeling: ${row.feelingTags.join(', ')}`);
      if (row.feelingNote) lines.push(`  Feeling note: ${row.feelingNote}`);
      if (row.medicationName) lines.push(`  Medicine(s): ${row.medicationName}`);
      if (row.medicationStatus) lines.push(`  Medication check-in: ${medicationStatusLabel(row.medicationStatus)}`);
      if (row.medicationNote) lines.push(`  Medication note: ${row.medicationNote}`);
      if (row.contextNote) lines.push(`  Day context: ${row.contextNote}`);
      if (row.visitNote) lines.push(`  Question for visit: ${row.visitNote}`);
    });
    lines.push('', 'Please review these entries and correct anything that is inaccurate before sharing.');
    return lines.join('\n');
  }
  function refreshDraft() {
    summaryEditor.value = buildDraft();
    $('summary-meta-text').textContent = currentWeekRecords().length ? 'Draft refreshed from this week’s saved entries' : 'No readings recorded for this week yet';
  }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    window.clearTimeout(toastTimer); toastTimer = window.setTimeout(()=>toast.classList.remove('show'),2600);
  }
  function setDefaultDateTime() {
    const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset()*60000);
    $('reading-time').value = local.toISOString().slice(0,16);
  }
  const CLINICIAN_PHONE_KEY = 'medora.bp-notes.clinician-phone.v1';
  function cleanPhone(value) { return value.replace(/[^+\d]/g, '').replace(/(?!^)\+/g, ''); }
  function updateClinicianCallLink() {
    const phone = cleanPhone($('clinician-phone').value);
    const link = $('call-clinician');
    $('clinician-phone').value = phone;
    link.hidden = !/^\+?\d{7,15}$/.test(phone);
    link.href = link.hidden ? '' : `tel:${phone}`;
  }
  function showHighBpAlert(systolic, diastolic) {
    $('high-bp-alert-copy').textContent = `You entered ${systolic}/${diastolic} mmHg, above 180 systolic and/or 120 diastolic. Sit quietly and take another reading after at least one minute. A single reading does not diagnose a condition.`;
    $('high-bp-alert').hidden = false;
    updateClinicianCallLink();
    $('high-bp-alert').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  try { $('clinician-phone').value = localStorage.getItem(CLINICIAN_PHONE_KEY) || ''; } catch {}
  $('save-clinician-phone').addEventListener('click', () => {
    updateClinicianCallLink();
    const phone = $('clinician-phone').value;
    if (!/^\+?\d{7,15}$/.test(phone)) { showToast('Enter a valid clinician phone number (7–15 digits).'); return; }
    try { localStorage.setItem(CLINICIAN_PHONE_KEY, phone); showToast('Clinician number saved on this device.'); }
    catch { showToast('Could not save the number in this browser.'); }
  });
  $('clinician-phone').addEventListener('input', updateClinicianCallLink);
  $('dismiss-bp-alert').addEventListener('click', () => { $('high-bp-alert').hidden = true; });
  $('speak-bp-alert').addEventListener('click', () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { showToast('Voice playback is not available in this browser.'); return; }
    window.speechSynthesis.cancel();
    const message = `${$('high-bp-alert-copy').textContent} ${$('high-bp-alert').querySelector('.bp-alert-urgent').textContent} If the repeat reading remains this high without those symptoms, contact a healthcare professional as soon as possible. In India, tap Call Emergency Services 112 to open your phone app. You must confirm the call.`;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = navigator.language || 'en-IN';
    utterance.onstart = () => { $('stop-bp-alert-voice').hidden = false; };
    utterance.onend = utterance.onerror = () => { $('stop-bp-alert-voice').hidden = true; };
    window.speechSynthesis.speak(utterance);
  });
  $('stop-bp-alert-voice').addEventListener('click', () => { window.speechSynthesis.cancel(); $('stop-bp-alert-voice').hidden = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const systolic = Number($('systolic').value); const diastolic = Number($('diastolic').value);
    if (!Number.isInteger(systolic) || !Number.isInteger(diastolic) || systolic < 1 || systolic > 300 || diastolic < 1 || diastolic > 200) {
      $('form-message').textContent = 'Enter the numbers shown on your monitor.'; return;
    }
    const entry = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      takenAt: new Date($('reading-time').value).toISOString(), systolic, diastolic,
      feelingTags: [...document.querySelectorAll('[data-feeling][aria-pressed="true"]')].map(button => button.dataset.feeling),
      feelingNote: $('feeling-note').value.trim(),
      medicationName: $('medication-name').value.trim(),
      medicationStatus: $('medication-status').value,
      contextNote: $('context-note').value.trim(),
      visitNote: $('visit-note').value.trim()
    };
    records.push(entry);
    if (!persist()) { records.pop(); return; }
    if (systolic > 180 || diastolic > 120) showHighBpAlert(systolic, diastolic);
    form.reset(); document.querySelectorAll('[data-feeling]').forEach(button => button.setAttribute('aria-pressed','false')); setDefaultDateTime(); $('form-message').textContent = 'Saved on this device.';
  
  renderWeek(); renderRecords(); refreshDraft(); showToast('Reading saved to your journal.');
  });
  $('reading-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete]'); if (!button) return;
    const row = records.find(r=>r.id===button.dataset.delete); if (!row) return;
    if (!window.confirm('Delete this reading from your journal?')) return;
    records = records.filter(r=>r.id!==button.dataset.delete); persist(); renderWeek(); renderRecords(); refreshDraft(); showToast('Reading deleted.');
  });
  document.querySelectorAll('[data-feeling]').forEach(button => {
    button.addEventListener('click', () => button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') !== 'true' ? 'true' : 'false'));
  });
  $('voice-button').addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { showToast('Voice input is not available here. You can type your note instead.'); return; }
    const button = $('voice-button'); const recognition = new Recognition(); recognition.lang = navigator.language || 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    button.disabled = true; button.textContent = 'Listening… tap browser prompt';
    recognition.onresult = (event) => { const phrase = event.results?.[0]?.[0]?.transcript || ''; if (phrase) { const field = $('feeling-note'); field.value = `${field.value}${field.value?' ':''}${phrase}`; field.focus(); } };
    recognition.onerror = () => showToast('Voice note was not captured. You can type it instead.');
    recognition.onend = () => { button.disabled = false; button.innerHTML = '<span aria-hidden="true">◉</span> Add by voice'; };
    try { recognition.start(); } catch { button.disabled = false; button.innerHTML = '<span aria-hidden="true">◉</span> Add by voice'; showToast('Could not start voice input. You can type instead.'); }
  });
  $('copy-button').addEventListener('click', async () => {
    const text = summaryEditor.value.trim(); if (!text) { showToast('Add a reading before creating a summary.'); return; }
    try { await navigator.clipboard.writeText(text); showToast('Reviewed summary copied.'); }
    catch { summaryEditor.focus(); summaryEditor.select(); showToast('Select and copy the summary from the text box.'); }
  });
  $('share-button').addEventListener('click', async () => {
    const text = summaryEditor.value.trim(); if (!text) { showToast('Add a reading before creating a summary.'); return; }
    if (navigator.share) {
      try { await navigator.share({title:'My Medora BP Notes summary',text}); } catch (error) { if (error.name!=='AbortError') window.print(); }
    } else { window.print(); }
  });

  const chatPanel = $('bp-chat-panel');
  const chatLauncher = $('bp-chat-launcher');
  const chatForm = $('bp-chat-form');
  const chatInput = $('bp-chat-input');
  const chatMessages = $('bp-chat-messages');
  const chatStatus = $('bp-chat-status');
  const chatTurns = [];
  let aiConnected = false;
  function setChatStatus(text) { if (chatStatus) chatStatus.textContent = text; }
  function addChatMessage(text, sender) {
    const bubble = document.createElement('p');
    bubble.className = `bp-chat-bubble ${sender}`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function getBpReply(question) {
    const q = question.toLowerCase();
    if (/\b(180|120|emergency|chest pain|shortness of breath|can't breathe|weakness|numbness|vision|speak|stroke)\b/.test(q)) {
      return 'If a reading is over 180 systolic and/or 120 diastolic, wait at least 1 minute and repeat it. If it stays that high and you have chest pain, shortness of breath, weakness, numbness, vision changes, difficulty speaking, or another severe new symptom, call your local emergency number now. If it stays very high without symptoms, contact a healthcare professional immediately. Do not wait for this chat.';
    }
    if (/miss(ed|ing).{0,20}(dose|medicine|medication)|forgot.{0,20}(pill|tablet|medicine|dose)|double dose/.test(q)) return 'Missed-dose instructions depend on the exact medicine. Check the patient leaflet or contact your pharmacist/clinician for advice. Do not double a dose or stop/change your BP medicine based on this chat.';
    if (/medicine|medication|pill|tablet|prescription|side effect/.test(q)) return 'Keep taking your BP medicine as prescribed unless your clinician tells you otherwise. If you have side effects or concerns, write down the medicine name, dose, and what you noticed, then contact your clinician or pharmacist. I can’t recommend a dose change.';
    if (/how.*(take|measure|check)|reading correctly|measure.*pressure/.test(q)) return 'For a more reliable home reading: sit quietly for 5 minutes with your back supported, feet flat, and arm supported at heart level; put the cuff on bare skin and avoid talking. Take two readings 1 minute apart and record both. Follow your clinician’s instructions for timing.';
    if (/my reading|my bp|my blood pressure|journal|record|summary/.test(q)) {
      const recent = [...records].sort((a,b)=>Date.parse(b.takenAt)-Date.parse(a.takenAt)).slice(0,5);
      if (!recent.length) return 'There are no readings saved in this browser yet. Add the numbers shown on your home monitor to your journal; I can then help you find the latest entries to discuss with your clinician.';
      return 'Your latest saved entries (for your review, not a diagnosis): ' + recent.map(r=>`${r.systolic}/${r.diastolic} mmHg`).join('; ') + '. A clinician should interpret them with your health history and measurement instructions.';
    }
    if (/doctor|clinician|appointment|visit|ask/.test(q)) return 'For your visit, consider bringing your BP log, the times you measured, your medicine names and any missed doses, symptoms or side effects, and questions about your personal BP goal and how often to measure. You can create and review the weekly summary on this page.';
    if (/high|low|normal|number|meaning|stage/.test(q)) return 'One number alone cannot diagnose or explain your blood pressure. Readings can vary, so record them as your clinician directed and discuss repeated readings outside your personal target. If you share a number, I can help you record it, but a clinician must interpret it for you.';
    if (/stress|sleep|salt|food|exercise|lifestyle|diet/.test(q)) return 'Daily habits can support BP care, but personal needs differ. Ask your clinician about a safe activity plan and food choices for you. Keep tracking readings and prescribed medicines; don’t use lifestyle changes as a reason to stop treatment.';
    if (/hello|hi\b|hey\b/.test(q)) return 'Hello! You can ask me about taking a reading, medicines, your saved entries, or preparing for a clinician visit.';
    return 'I can help with taking home readings, medication questions, saved entries, and preparing for a clinician visit. For symptoms, urgent concerns, or personal treatment decisions, please contact a healthcare professional.';
  }
  function isUrgentQuestion(text) {
    return /\b(180\s*(?:\/|over|and\s*\/\s*or)?\s*120|emergency|chest pain|shortness of breath|can't breathe|weakness|numbness|vision changes?|difficulty speaking|stroke)\b/i.test(text);
  }
  async function checkAiStatus() {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      aiConnected = Boolean(status.connected);
      setChatStatus(aiConnected ? `AI connected · ${status.provider}` : 'Built-in BP guide · AI not connected');
    } catch {
      aiConnected = false;
      setChatStatus('Built-in BP guide · AI not connected');
    }
  }
  async function submitChatQuestion(question) {
    const text = question.trim(); if (!text) return;
    addChatMessage(text, 'user'); chatInput.value = '';
    if (isUrgentQuestion(text)) {
      const reply = getBpReply(text);
      addChatMessage(reply, 'bot');
      chatTurns.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
      return;
    }
    if (!aiConnected) {
      const reply = getBpReply(text);
      addChatMessage(reply, 'bot');
      chatTurns.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
      return;
    }
    const typing = document.createElement('p');
    typing.className = 'bp-chat-bubble bot';
    typing.textContent = 'Thinking…';
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    try {
      const messages = [...chatTurns, { role: 'user', content: text }].slice(-10);
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      const result = await response.json();
      if (!response.ok || !result.reply) throw new Error('AI response unavailable');
      typing.textContent = result.reply;
      chatTurns.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
      if (chatTurns.length > 12) chatTurns.splice(0, chatTurns.length - 12);
    } catch {
      typing.textContent = `${getBpReply(text)} (The AI service could not be reached, so this is the built-in guide.)`;
      setChatStatus('AI unavailable · using built-in guide');
      aiConnected = false;
    }
  }
  chatLauncher.addEventListener('click', () => { const opening = chatPanel.hidden; chatPanel.hidden = !opening; chatLauncher.setAttribute('aria-expanded', String(opening)); if (opening) chatInput.focus(); });
  $('bp-chat-close').addEventListener('click', () => { chatPanel.hidden = true; chatLauncher.setAttribute('aria-expanded','false'); chatLauncher.focus(); });
  chatForm.addEventListener('submit', event => { event.preventDefault(); submitChatQuestion(chatInput.value); });
  document.querySelectorAll('[data-chat-prompt]').forEach(button => button.addEventListener('click', () => submitChatQuestion(button.dataset.chatPrompt)));
  checkAiStatus();
  const emergencyPanel = $('voice-emergency-panel');
  let emergencyRecognition = null;
  function stopEmergencyListening() {
    if (emergencyRecognition) { try { emergencyRecognition.stop(); } catch {} emergencyRecognition = null; }
    $('voice-emergency-stop').hidden = true;
    $('voice-emergency-listen').hidden = false;
  }
  function startEmergencyListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { $('voice-emergency-status').textContent = 'Voice recognition is unavailable in this browser. Use the red Call Emergency Services button if you need urgent help.'; return; }
    stopEmergencyListening();
    const recognition = new Recognition(); emergencyRecognition = recognition;
    recognition.lang = navigator.language || 'en-IN'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    $('voice-emergency-status').textContent = 'Listening once. Say: “Call emergency services.”';
    $('voice-emergency-listen').hidden = true; $('voice-emergency-stop').hidden = false;
    recognition.onresult = event => {
      const phrase = event.results?.[0]?.[0]?.transcript?.trim() || '';
      const callIntent = /call.*(emergency|112|ambulance)|emergency services|need emergency help/i.test(phrase);
      const response = callIntent
        ? `I heard ${phrase}. If this is an emergency, tap the red button now to call 112.`
        : `I heard ${phrase || 'no speech'}. Say call emergency services, or tap the red 112 button.`;
      $('voice-emergency-status').textContent = response;
      if (callIntent && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); const spoken = new SpeechSynthesisUtterance(response); spoken.lang = navigator.language || 'en-IN'; window.speechSynthesis.speak(spoken); }
    };
    recognition.onerror = event => { $('voice-emergency-status').textContent = event.error === 'not-allowed' ? 'Microphone access was blocked. Use the red Call Emergency Services button if needed.' : 'I could not hear that. Try again or use the red 112 button.'; };
    recognition.onend = () => { if (emergencyRecognition === recognition) emergencyRecognition = null; $('voice-emergency-stop').hidden = true; $('voice-emergency-listen').hidden = false; };
    try { recognition.start(); } catch { emergencyRecognition = null; $('voice-emergency-status').textContent = 'Could not start voice listening. Use the red 112 button if needed.'; $('voice-emergency-stop').hidden = true; $('voice-emergency-listen').hidden = false; }
  }
  $('voice-emergency-open').addEventListener('click', () => {
    const opening = emergencyPanel.hidden; emergencyPanel.hidden = !opening;
    $('voice-emergency-open').setAttribute('aria-expanded', String(opening));
    if (opening) startEmergencyListening(); else stopEmergencyListening();
  });
  $('voice-emergency-listen').addEventListener('click', startEmergencyListening);
  $('voice-emergency-stop').addEventListener('click', stopEmergencyListening);
  $('voice-emergency-close').addEventListener('click', () => {
    emergencyPanel.hidden = true; $('voice-emergency-open').setAttribute('aria-expanded', 'false'); stopEmergencyListening(); $('voice-emergency-open').focus();
  });
  renderWeek(); renderRecords();
  summaryEditor.value = buildDraft();
  setDefaultDateTime();
})();


