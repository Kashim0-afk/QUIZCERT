import { validateQuestion } from './schema.js';

function resolveRelative(baseUrl, file) {
  const idx = baseUrl.lastIndexOf('/');
  const base = idx >= 0 ? baseUrl.slice(0, idx + 1) : '';
  return base + file;
}

export async function loadQuestions(manifestUrl, fetchFn = fetch) {
  const manifest = await (await fetchFn(manifestUrl)).json();
  const questions = [];
  let skipped = 0;
  for (const file of manifest.files ?? []) {
    const url = resolveRelative(manifestUrl, file);
    const list = await (await fetchFn(url)).json();
    for (const q of list) {
      if (validateQuestion(q).length === 0) questions.push(q);
      else skipped++;
    }
  }
  return { questions, skipped };
}
