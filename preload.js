const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 타이머 제어
  startTimer: (minutes) => ipcRenderer.send('start-timer', minutes),
  stopTimer: () => ipcRenderer.send('stop-timer'),
  addTime: (minutes) => ipcRenderer.send('add-time', minutes),
  
  // 이적시장 알림
  sendTransferAlert: (data) => ipcRenderer.send('transfer-alert', data),
  
  // 타이머 업데이트 받기
  onTimerUpdate: (callback) => {
    ipcRenderer.on('timer-update', (event, timeLeft) => callback(timeLeft));
  },
  
  // 파일 시스템 (CSV 처리용)
  readFile: (path) => {
    return new Promise((resolve, reject) => {
      ipcRenderer.invoke('read-file', path).then(resolve).catch(reject);
    });
  },
  
  writeFile: (path, content) => {
    return new Promise((resolve, reject) => {
      ipcRenderer.invoke('write-file', path, content).then(resolve).catch(reject);
    });
  }
});