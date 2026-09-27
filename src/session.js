// Pure session logic used by the UI (no DOM access, unit-tested in test/session.test.js).

// Display order of a question's options, as a list of ORIGINAL option indices.
// Options are shuffled on every presentation so the position of the right answer
// carries no information. True/false keeps the natural "Vero / Falso" order.
export function optionOrder(q, rng = Math.random) {
  const n = Array.isArray(q.options) ? q.options.length : 0;
  const order = Array.from({ length: n }, (_, i) => i);
  if (q.type === 'truefalse') return order;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Map indices of the options as DISPLAYED back to the original indices used by
// `q.correct` / `q.why_wrong` (grading always works on original indices).
export function toOriginal(order, displayed) {
  return displayed.map((d) => {
    if (!Number.isInteger(d) || d < 0 || d >= order.length) throw new RangeError('display index out of range: ' + d);
    return order[d];
  });
}

// Display positions of the correct answers (useful to highlight them).
export function correctDisplayPositions(order, correct) {
  return order.map((orig, pos) => (correct.includes(orig) ? pos : -1)).filter((p) => p >= 0);
}
