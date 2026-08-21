export function emptyStats() {
  return { history: {}, days: {}, version: 1 };
}

export function recordAttempt(stats, { id, isCorrect, date }) {
  const h = (stats.history[id] ??= { seen: 0, correct: 0, wrong: 0, correctStreak: 0, lastSeen: null });
  h.seen++;
  h.lastSeen = date;
  if (isCorrect) { h.correct++; h.correctStreak++; } else { h.wrong++; h.correctStreak = 0; }
  const d = (stats.days[date] ??= { answered: 0, correct: 0, wrong: 0 });
  d.answered++;
  if (isCorrect) d.correct++; else d.wrong++;
  return stats;
}

function prevDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function streak(days, today) {
  let count = 0;
  let cur = today;
  while (days[cur] && (days[cur].answered ?? 0) > 0) {
    count++;
    cur = prevDay(cur);
  }
  return count;
}

const pct = (correct, answered) => (answered ? Math.round((correct / answered) * 100) : 0);

export function globalAccuracy(stats) {
  let correct = 0, wrong = 0;
  for (const h of Object.values(stats.history)) { correct += h.correct; wrong += h.wrong; }
  const answered = correct + wrong;
  return { answered, correct, wrong, pct: pct(correct, answered) };
}

export function byField(questions, history, field) {
  const out = {};
  for (const q of questions) {
    const h = history[q.id];
    if (!h) continue;
    const values = field === 'cert' ? q.cert : q.topics;
    for (const v of values) {
      const acc = (out[v] ??= { answered: 0, correct: 0, pct: 0 });
      acc.answered += h.correct + h.wrong;
      acc.correct += h.correct;
    }
  }
  for (const acc of Object.values(out)) acc.pct = pct(acc.correct, acc.answered);
  return out;
}
