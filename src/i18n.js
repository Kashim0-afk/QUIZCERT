// Bilingual support: UI dictionary + per-question field localization (IT default, EN if present).

let lang = 'it';
try {
  const saved = (typeof localStorage !== 'undefined') && localStorage.getItem('quizcert-lang');
  if (saved === 'it' || saved === 'en') lang = saved;
} catch { /* localStorage unavailable */ }

export function getLang() { return lang; }
export function setLang(l) {
  lang = (l === 'en') ? 'en' : 'it';
  try { localStorage.setItem('quizcert-lang', lang); } catch { /* ignore */ }
}
export function toggleLang() { setLang(lang === 'it' ? 'en' : 'it'); return lang; }

const DICT = {
  it: {
    subtitle: (n, s) => n + ' domande disponibili · streak ' + s + ' giorni',
    studyScope: 'Ambito di studio',
    certLabel: 'Certificazione', allCerts: 'Tutte le certificazioni',
    topicLabel: 'Argomento', allTopics: 'Tutti gli argomenti',
    mixHint: 'Lascia su "Tutte / Tutti" per la modalità MIX (tutto insieme).',
    mTraining: 'Allenamento', mTrainingD: 'Domande in fila, feedback immediato',
    mExam: 'Simulazione esame', mExamD: 'A tempo, punteggio finale',
    mReview: 'Ripasso errori', mReviewD: 'Solo le domande sbagliate',
    mDaily: 'Sfida giornaliera', mDailyDone: 'Sfida giornaliera ✓', mDailyD: 'Set del giorno', mDailyDoneD: 'Completata oggi · ripeti senza conteggio',
    mDailyReplay: 'Sfida giornaliera (ripetizione, non conteggiata)',
    mStudy: 'Studio', mStudyD: 'Leggi domande e risposte',
    statistics: 'Statistiche', home: '← Home', backHome: 'Torna alla home',
    confirm: 'Conferma', confirmMulti: 'Conferma (scegli tutte le giuste)',
    selectAnswer: 'Seleziona una risposta.',
    multiHint: 'Risposta multipla: seleziona tutte le opzioni corrette.',
    multiHintShort: 'Risposta multipla.',
    correct: '✓ Corretta', wrong: '✗ Sbagliata',
    whyWrong: (opt, r) => 'Perché "' + opt + '" è sbagliata: ' + r,
    next: 'Prossima →', quizDone: (label, c, t, p) => label + ' completato: ' + c + '/' + t + ' corrette (' + p + '%).',
    streakSuffix: (s) => ' Streak: ' + s + ' giorni.',
    examConfigTitle: 'Configura la simulazione',
    numQuestions: 'Numero domande', nQuestions: (n) => n + ' domande',
    time: 'Tempo', nMinutes: (n) => n + ' minuti',
    startExam: 'Inizia simulazione',
    examScopeHint: (cert, topic, thr) => 'Ambito: ' + cert + ' · ' + topic + '. Soglia superamento ' + thr + '%.',
    allCertsShort: 'tutte le cert', allTopicsShort: 'tutti gli argomenti',
    noQuestions: 'Nessuna domanda per questo ambito.',
    forward: 'Avanti →', finish: 'Termina',
    result: 'Risultato', passed: 'SUPERATO', notPassed: 'NON superato',
    threshold: (t) => 'Soglia: ' + t + '%', review: 'Revisione',
    yourAns: (a) => '✗ Sbagliata — la tua: ' + a, none: '(nessuna)',
    correctAns: (a, e) => 'Giusta: ' + a + '. ' + e,
    studyMaterial: 'Materiale di studio',
    studyScopeHint: (a) => 'Ambito: ' + a + '. Cambia certificazione o argomento dalla home per filtrare.',
    nQuestionsShort: (n) => n + ' domande',
    byCert: 'Per certificazione', byTopic: 'Per argomento (punti deboli in alto)',
    noData: 'Ancora nessun dato.',
    streakTitle: (s) => 'Streak: ' + s + ' giorni',
    last30: 'Ultimi 30 giorni (colore = quante risposte).',
    overall: 'Globale', overallLine: (c, w, p) => c + ' giuste · ' + w + ' sbagliate · ' + p + '% accuratezza',
    exportStats: 'Esporta statistiche', importStats: 'Importa statistiche', backup: 'Backup',
    reviewWeak: 'Ripassa i punti deboli',
    confirmOverwrite: 'Sovrascrivere le statistiche attuali con quelle importate?',
    importFailed: (m) => 'Import fallito: ' + m,
    noReview: 'Nessun errore da ripassare — ottimo!',
    loadMore: (n, rest) => 'Carica altre ' + n + ' (' + rest + ' rimanenti)',
    loadError: (m) => 'Errore nel caricamento delle domande: ' + m,
    updateAvailable: 'Nuova versione disponibile', updateNow: 'Aggiorna',
  },
  en: {
    subtitle: (n, s) => n + ' questions available · ' + s + '-day streak',
    studyScope: 'Study scope',
    certLabel: 'Certification', allCerts: 'All certifications',
    topicLabel: 'Topic', allTopics: 'All topics',
    mixHint: 'Leave on "All / All" for MIX mode (everything together).',
    mTraining: 'Training', mTrainingD: 'Questions in a row, instant feedback',
    mExam: 'Exam simulation', mExamD: 'Timed, final score',
    mReview: 'Mistake review', mReviewD: 'Only the questions you got wrong',
    mDaily: 'Daily challenge', mDailyDone: 'Daily challenge ✓', mDailyD: "Today's set", mDailyDoneD: 'Completed today · replay without counting',
    mDailyReplay: 'Daily challenge (replay, not counted)',
    mStudy: 'Study', mStudyD: 'Read questions and answers',
    statistics: 'Statistics', home: '← Home', backHome: 'Back to home',
    confirm: 'Confirm', confirmMulti: 'Confirm (select all correct)',
    selectAnswer: 'Select an answer.',
    multiHint: 'Multiple answer: select all correct options.',
    multiHintShort: 'Multiple answer.',
    correct: '✓ Correct', wrong: '✗ Wrong',
    whyWrong: (opt, r) => 'Why "' + opt + '" is wrong: ' + r,
    next: 'Next →', quizDone: (label, c, t, p) => label + ' completed: ' + c + '/' + t + ' correct (' + p + '%).',
    streakSuffix: (s) => ' Streak: ' + s + ' days.',
    examConfigTitle: 'Configure the simulation',
    numQuestions: 'Number of questions', nQuestions: (n) => n + ' questions',
    time: 'Time', nMinutes: (n) => n + ' minutes',
    startExam: 'Start simulation',
    examScopeHint: (cert, topic, thr) => 'Scope: ' + cert + ' · ' + topic + '. Pass threshold ' + thr + '%.',
    allCertsShort: 'all certs', allTopicsShort: 'all topics',
    noQuestions: 'No questions for this scope.',
    forward: 'Next →', finish: 'Finish',
    result: 'Result', passed: 'PASSED', notPassed: 'NOT passed',
    threshold: (t) => 'Threshold: ' + t + '%', review: 'Review',
    yourAns: (a) => '✗ Wrong — yours: ' + a, none: '(none)',
    correctAns: (a, e) => 'Correct: ' + a + '. ' + e,
    studyMaterial: 'Study material',
    studyScopeHint: (a) => 'Scope: ' + a + '. Change certification or topic from the home to filter.',
    nQuestionsShort: (n) => n + ' questions',
    byCert: 'By certification', byTopic: 'By topic (weak spots first)',
    noData: 'No data yet.',
    streakTitle: (s) => 'Streak: ' + s + ' days',
    last30: 'Last 30 days (color = how many answers).',
    overall: 'Overall', overallLine: (c, w, p) => c + ' correct · ' + w + ' wrong · ' + p + '% accuracy',
    exportStats: 'Export statistics', importStats: 'Import statistics', backup: 'Backup',
    reviewWeak: 'Review weak spots',
    confirmOverwrite: 'Overwrite current statistics with the imported ones?',
    importFailed: (m) => 'Import failed: ' + m,
    noReview: 'No mistakes to review — great!',
    loadMore: (n, rest) => 'Load ' + n + ' more (' + rest + ' remaining)',
    loadError: (m) => 'Error loading questions: ' + m,
    updateAvailable: 'New version available', updateNow: 'Update',
  },
};

export function t(key, ...args) {
  const v = DICT[lang][key] ?? DICT.it[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

// Localize a question field: use the _en variant when in English and available, else Italian.
export function qText(q) { return (lang === 'en' && q.question_en) ? q.question_en : q.question; }
export function qOptions(q) {
  return (lang === 'en' && Array.isArray(q.options_en) && q.options_en.length === q.options.length)
    ? q.options_en : q.options;
}
export function qExplanation(q) { return (lang === 'en' && q.explanation_en) ? q.explanation_en : q.explanation; }
export function qWhyWrong(q) { return (lang === 'en' && q.why_wrong_en) ? q.why_wrong_en : q.why_wrong; }
