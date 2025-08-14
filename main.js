const { app, BrowserWindow, Tray, Menu, nativeImage, shell, Notification, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isQuitting = false;

// 타이머 상태 저장
let supervisorTimer = null;
let supervisorTimeLeft = 600;
let isTimerRunning = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico'),
    title: 'FC온라인 타이머'
  });

  mainWindow.loadFile('index.html');

  // 창 닫기 시 트레이로 최소화
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // 트레이로 최소화 알림
      if (tray) {
        tray.displayBalloon({
          title: 'FC온라인 타이머',
          content: '프로그램이 트레이에서 계속 실행됩니다.',
          icon: path.join(__dirname, 'icon.ico')
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // 트레이 아이콘 생성
  const iconPath = path.join(__dirname, 'icon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '감독모드 타이머',
      submenu: [
        {
          label: '10분 시작',
          click: () => {
            startSupervisorTimer(10);
          }
        },
        {
          label: '+5분 (연장전)',
          click: () => {
            if (isTimerRunning) {
              supervisorTimeLeft += 300;
            } else {
              startSupervisorTimer(5);
            }
          }
        },
        {
          label: '+1분',
          click: () => {
            if (isTimerRunning) {
              supervisorTimeLeft += 60;
            } else {
              startSupervisorTimer(1);
            }
          }
        },
        {
          label: '정지',
          click: () => {
            stopSupervisorTimer();
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '시작시 자동 실행',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          openAsHidden: true
        });
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('FC온라인 타이머');
  tray.setContextMenu(contextMenu);

  // 트레이 더블클릭 시 창 열기
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 감독모드 타이머 함수들
function startSupervisorTimer(minutes) {
  if (minutes) {
    supervisorTimeLeft = minutes * 60;
  }
  
  if (supervisorTimeLeft <= 0) {
    supervisorTimeLeft = 600;
  }
  
  isTimerRunning = true;
  
  // 기존 타이머 정리
  if (supervisorTimer) {
    clearInterval(supervisorTimer);
  }
  
  // 타이머 시작
  supervisorTimer = setInterval(() => {
    supervisorTimeLeft--;
    
    // 메인 윈도우에 시간 업데이트 전송
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-update', supervisorTimeLeft);
    }
    
    // 트레이 툴팁 업데이트
    const minutes = Math.floor(supervisorTimeLeft / 60);
    const seconds = supervisorTimeLeft % 60;
    tray.setToolTip(`FC온라인 타이머 - ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    if (supervisorTimeLeft <= 0) {
      // 알림 표시
      const notification = new Notification({
        title: '🚨 감독모드 실행 시간!',
        body: 'FC온라인에서 감독모드를 실행하세요',
        icon: path.join(__dirname, 'icon.ico'),
        urgency: 'critical',
        timeoutType: 'never'
      });
      
      notification.show();
      
      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      
      stopSupervisorTimer();
    }
  }, 1000);
}

function stopSupervisorTimer() {
  isTimerRunning = false;
  if (supervisorTimer) {
    clearInterval(supervisorTimer);
    supervisorTimer = null;
  }
  tray.setToolTip('FC온라인 타이머');
}

// IPC 통신 핸들러
ipcMain.on('start-timer', (event, minutes) => {
  startSupervisorTimer(minutes);
});

ipcMain.on('stop-timer', () => {
  stopSupervisorTimer();
});

ipcMain.on('add-time', (event, minutes) => {
  if (isTimerRunning) {
    supervisorTimeLeft += minutes * 60;
  } else {
    startSupervisorTimer(minutes);
  }
});

ipcMain.on('transfer-alert', (event, data) => {
  const notification = new Notification({
    title: '📈 이적시장 갱신!',
    body: `${data.season} ${data.name}의 이적료가 갱신되었습니다!`,
    icon: path.join(__dirname, 'icon.ico')
  });
  
  notification.show();
});

// 앱 준비 완료
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 창이 닫혔을 때
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 트레이가 있으면 앱을 종료하지 않음
    if (!tray) {
      app.quit();
    }
  }
});

// 앱 종료 전
app.on('before-quit', () => {
  isQuitting = true;
});