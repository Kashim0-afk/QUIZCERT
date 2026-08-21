export function grade(question, selected) {
  const correct = [...question.correct].sort((a, b) => a - b);
  const chosen = [...new Set(selected)].sort((a, b) => a - b);
  const isCorrect =
    correct.length === chosen.length && correct.every((v, i) => v === chosen[i]);
  const wrongReasons = chosen
    .filter(i => !correct.includes(i))
    .map(i => ({ index: i, reason: question.why_wrong?.[String(i)] ?? null }));
  return { isCorrect, correct, chosen, explanation: question.explanation ?? '', wrongReasons };
}
