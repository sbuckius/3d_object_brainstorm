/* global firebase */

// --- 1) Configure your Firebase project ---
const firebaseConfig = {

  apiKey: "AIzaSyBLS8xSFoiCW612AvT9_aByAXYBKL-YOgI",

  authDomain: "objectquestions.firebaseapp.com",

  databaseURL: "https://objectquestions-default-rtdb.firebaseio.com",

  projectId: "objectquestions",

  storageBucket: "objectquestions.firebasestorage.app",

  messagingSenderId: "440303600938",

  appId: "1:440303600938:web:a138d87d1f68739d1f8a53",

  measurementId: "G-7JXXEP4C1C"

};

// Init (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 2) Questions (render ALL at once) ---
const questions = [
  'What is one object from your childhood that holds significance to you?',
  'What is one object in your life that you strongly dislike?',
  'What is one place that is important/poignant/impactful to you? What objects are there?',
  'What is one object in your life that you LOVE?',
  'What is an object in your life with political significance?',
  'What is one object in your life that reveals something about you or your lived experience?',
  'Imagine if you take an artwork from another medium and transform it into 3d. What is the artwork?',
  'Imagine an abstract idea/concept that is interesting to you. Transform it into a 3D object in your mind. What is the idea?',
  'Imagine if you took a piece of writing and transformed it into 3d. What is the piece of writing? ',
  'Imagine a 3D mashup of at least 3 objects. What are they objects?',
  'Imagine a sculpture with both figural and non-figural parts. What is it made of?',
  'What is an object that holds cultural significance in your life?',
  'What is an object that represents you?',
  'Imagine the design of an object for your past. What does it look like?',
  'Imagine the design of an object for your future. What does it look like?',
  'Imagine an object of resistance. What does it look like?',
  'Imagine the design of an object for your present. What does it look like?',
  'Imagine an object that is symbolic in your life. What is it?',
  'Think of three objects that you hate. Mash them up in your mind.',
  'Think of three objects that you love. Mash them up in your mind.'
];

// anonymous local user id
const uid = (() => {
  const key = 'crowd20_uid';
  let v = localStorage.getItem(key);
  if (!v){ v = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem(key, v); }
  return v;
})();

const els = {
  app: document.getElementById('app'),
  saveJsonBtn: document.getElementById('saveJsonBtn'),
  saveCsvBtn: document.getElementById('saveCsvBtn'),
  resetBtn: document.getElementById('resetBtn'),
};

const sections = []; // {feed, textarea, btn, hint, countEl}

function answersRef(i){ return db.ref(`questions/q${i}/answers`); }

// Build UI for all questions
questions.forEach((qText, i) => {
  const card = document.createElement('section');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'q-head';
  head.innerHTML = `<div class="q-index">Question ${i+1} of ${questions.length}</div>
                    <div class="q-text">${qText}</div>`;
  card.appendChild(head);

  const inputBox = document.createElement('div');
  inputBox.className = 'input-box';

  // TEXTAREA to allow multiple answers (one per line)
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type one or more answers. Put each answer on a new line.';
  textarea.rows = 2;

  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = 'Submit';

  inputBox.appendChild(textarea);
  inputBox.appendChild(btn);
  card.appendChild(inputBox);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Tip: Press Cmd/Ctrl+Enter to submit. Use new lines for multiple answers.';
  card.appendChild(hint);

  const feed = document.createElement('div');
  feed.className = 'answers';
  card.appendChild(feed);

  const foot = document.createElement('div');
  foot.className = 'footer';
  const countEl = document.createElement('span');
  countEl.textContent = '0 total';
  foot.appendChild(countEl);
  card.appendChild(foot);

  els.app.appendChild(card);

  sections[i] = { feed, textarea, btn, hint, countEl };

  btn.addEventListener('click', () => submit(i));
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(i);
    }
  });

  attachFeed(i);
});

// --- Live listeners for each question
function attachFeed(i){
  const refAns = answersRef(i);

  // Update total count from number of children
  refAns.on('value', snap => {
    sections[i].countEl.textContent = `${snap.numChildren()} total`;
  });

  // Append answers in chronological order
  refAns.orderByChild('ts').limitToLast(200).on('child_added', snap => {
    const data = snap.val();
    if (!data || !data.text) return;
    addAnswerToList(i, data);
  });
}

function addAnswerToList(i, { text, uid, ts }){
  const feed = sections[i].feed;
  const row = document.createElement('div');
  row.className = 'answer';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = (uid || 'anon').slice(-4);

  const body = document.createElement('div');
  const phrase = document.createElement('div');
  phrase.className = 'phrase';
  phrase.textContent = text;
  const stamp = document.createElement('div');
  stamp.className = 'stamp';
  stamp.textContent = ts ? new Date(ts).toLocaleString() : '…';

  body.appendChild(phrase);
  body.appendChild(stamp);
  row.appendChild(badge);
  row.appendChild(body);
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

// --- Validation
function sanitizePhrase(s){
  let t = (s || '').trim().replace(/\s+/g,' ');
  if (t.length < 2 || t.length > 140) return '';
  // simple bad-word gate (extend as needed)
  const banned = [/\bidiot\b/i, /\bkill\b/i];
  for (const re of banned){ if (re.test(t)) return ''; }
  return t;
}

// --- Submit (supports multiple answers per question)
async function submit(i){
  const { textarea, btn, hint } = sections[i];

  const raw = String(textarea.value || '');
  // split by newline or semicolon for convenience
  const pieces = raw.split(/[\n;]+/).map(s => sanitizePhrase(s)).filter(Boolean);

  if (!pieces.length){
    hint.innerHTML = '<span class="warn">Enter at least one short phrase (2–140 chars each).</span>';
    return;
  }

  // limit batch size to avoid spam / accidental pastes
  const batch = pieces.slice(0, 20);

  btn.disabled = true;
  try{
    const ref = answersRef(i);
    for (const part of batch){
      await ref.push({ text: part, uid, ts: Date.now() });
    }
    textarea.value = '';
    hint.innerHTML = `<span class="ok">Posted ${batch.length} answer${batch.length>1?'s':''}. Thanks!</span>`;
  }catch(err){
    console.error(err);
    hint.innerHTML = '<span class="warn">Error sending. Check your Firebase config & rules.</span>';
  }finally{
    btn.disabled = false;
    textarea.focus();
  }
}

// ---- Save All (JSON / CSV) ----
els.saveJsonBtn.addEventListener('click', exportJSON);
els.saveCsvBtn.addEventListener('click', exportCSV);

function fetchAll(){
  return db.ref('questions').once('value').then(snap => {
    const data = snap.val() || {};
    return questions.map((q, i) => {
      const qkey = `q${i}`;
      const arr = data[qkey]?.answers ? Object.values(data[qkey].answers) : [];
      return { question_index: i, question_text: q, answers: arr };
    });
  });
}

async function exportJSON(){
  const all = await fetchAll();
  const blob = new Blob(
    [JSON.stringify({ exported_at:new Date().toISOString(), questions: all }, null, 2)],
    { type:'application/json' }
  );
  downloadBlob(blob, 'crowd-answers.json');
}

async function exportCSV(){
  const all = await fetchAll();
  const rows = [['question_index','question_text','uid','ts','ts_iso','text']];
  all.forEach(q => {
    q.answers.forEach(a => {
      const ts = a.ts || '';
      const iso = a.ts ? new Date(a.ts).toISOString() : '';
      rows.push([
        q.question_index,
        csvQuote(q.question_text),
        a.uid || '',
        ts,
        iso,
        csvQuote(a.text || '')
      ]);
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  downloadBlob(blob, 'crowd-answers.csv');
}

function csvQuote(s){ return `"${String(s).replace(/"/g,'""')}"`; }
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

// ---- Reset (delete all answers for all questions) ----
els.resetBtn.addEventListener('click', resetAll);

async function resetAll(){
  const sure = confirm('Reset will permanently delete ALL answers for ALL questions.\n\nProceed?');
  if (!sure) return;
  const sure2 = confirm('Are you absolutely sure? This cannot be undone.');
  if (!sure2) return;

  try{
    // Clear answers under q0..q19
    const ops = questions.map((_, i) => answersRef(i).set(null));
    await Promise.all(ops);

    // Clear UI feeds
    sections.forEach(sec => {
      sec.feed.innerHTML = '';
      sec.countEl.textContent = '0 total';
      sec.hint.innerHTML = '<span class="ok">All answers cleared.</span>';
    });
  }catch(err){
    console.error(err);
    alert('Reset failed. Check your Firebase rules/connection and try again.');
  }
}
