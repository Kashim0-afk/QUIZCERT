export const QUESTION_TYPES = ['single', 'multi', 'truefalse'];

export function validateQuestion(q) {
  const e = [];
  if (!q || typeof q !== 'object') return ['not-object'];
  if (typeof q.id !== 'string' || !q.id) e.push('id');
  if (!Array.isArray(q.cert) || q.cert.length === 0) e.push('cert');
  if (!Array.isArray(q.topics)) e.push('topics');
  if (!QUESTION_TYPES.includes(q.type)) e.push('type');
  const optsLen = Array.isArray(q.options) ? q.options.length : 0;
  if (optsLen < 2) e.push('options');
  if (!Array.isArray(q.correct) || q.correct.length === 0) e.push('correct');
  else if (q.correct.some(i => !Number.isInteger(i) || i < 0 || i >= optsLen)) e.push('correct-range');
  if (q.type === 'single' && Array.isArray(q.correct) && q.correct.length !== 1) e.push('single-one');
  if (q.type === 'truefalse' && (optsLen !== 2 || (Array.isArray(q.correct) && q.correct.length !== 1))) e.push('truefalse-shape');
  if (typeof q.explanation !== 'string') e.push('explanation');
  return e;
}
