export function isMastered(history, id, streakNeeded = 2) {
  const h = history[id];
  return !!h && (h.correctStreak ?? 0) >= streakNeeded;
}

export function filterQuestions(questions, { cert, topic, mode, history = {} } = {}) {
  let pool = questions;
  if (cert) pool = pool.filter(q => q.cert.includes(cert));
  if (topic) pool = pool.filter(q => q.topics.includes(topic));
  if (mode === 'review') {
    pool = pool.filter(q => {
      const h = history[q.id];
      return h && (h.wrong ?? 0) > 0 && !isMastered(history, q.id);
    });
  }
  return pool;
}

export function pickSet(pool, n, rng = Math.random) {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

export function listCerts(questions) {
  return [...new Set(questions.flatMap(q => q.cert))].sort();
}

export function listTopics(questions) {
  return [...new Set(questions.flatMap(q => q.topics))].sort();
}
