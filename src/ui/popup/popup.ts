async function getActiveTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (tabId == null) {
    throw new Error('활성 탭을 찾을 수 없습니다.');
  }
  return tabId;
}

function setStatus(text: string, isError = false): void {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = text;
  status.style.color = isError ? '#cf222e' : '#57606a';
}

async function sendTabMessage(type: 'START_TRANSLATION' | 'STOP_TRANSLATION'): Promise<void> {
  const tabId = await getActiveTabId();
  const response = await chrome.tabs.sendMessage(tabId, { type });
  if (!response?.ok) {
    throw new Error(response?.error ?? '요청 실패');
  }
}

document.getElementById('start')?.addEventListener('click', async () => {
  setStatus('요청 중...');
  try {
    await sendTabMessage('START_TRANSLATION');
    setStatus('번역을 시작했습니다.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '실패', true);
  }
});

document.getElementById('stop')?.addEventListener('click', async () => {
  setStatus('중지 중...');
  try {
    await sendTabMessage('STOP_TRANSLATION');
    setStatus('번역을 중지했습니다.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '실패', true);
  }
});

document.getElementById('openOptions')?.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});
