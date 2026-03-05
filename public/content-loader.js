(async () => {
  try {
    await import(chrome.runtime.getURL('content-main.js'));
  } catch (error) {
    console.error('[llmtr] content module load failed', error);
  }
})();
