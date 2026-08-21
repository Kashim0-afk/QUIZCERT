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
  const failedFiles = [];
  for (const file of manifest.files ?? []) {
    const url = resolveRelative(manifestUrl, file);
    let list;
    try {
      list = await (await fetchFn(url)).json();
    } catch {
      // A single missing/malformed question file must not break the whole app:
      // skip it and keep loading the rest.
      failedFiles.push(file);
      continue;
    }
    if (!Array.isArray(list)) { failedFiles.push(file); continue; }
    for (const q of list) {
      if (validateQuestion(q).length === 0) questions.push(q);
      else skipped++;
    }
  }
  return { questions, skipped, failedFiles };
}
