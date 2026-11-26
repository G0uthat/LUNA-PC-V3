const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const WORKSPACE_FILE = () => path.join(app.getPath('userData'), 'luma-workspace-v1.json');
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'luma-window-bounds.json');

let mainWindow = null;

function loadWindowBounds() {
  try {
    const raw = fs.readFileSync(BOUNDS_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return parsed;
    }
  } catch {
    // Use intelligent default based on primary display resolution
  }
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = Math.min(1440, Math.max(960, Math.round(workAreaSize.width * 0.86)));
  const height = Math.min(920, Math.max(660, Math.round(workAreaSize.height * 0.88)));
  return { width, height, maximized: false };
}

function saveWindowBounds(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const isMax = win.isMaximized();
    const bounds = win.getNormalBounds();
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(
      BOUNDS_FILE(),
      JSON.stringify({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: isMax,
      }),
      'utf8'
    );
  } catch {
    // Ignore persistence failure on shutdown
  }
}

function createWindow() {
  const saved = loadWindowBounds();

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 520,
    minHeight: 540,
    title: 'Luma',
    backgroundColor: '#FBF6EC',
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (saved.maximized) {
    mainWindow.maximize();
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('luma:window-state', { maximized: true });
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('luma:window-state', { maximized: false });
  });
  mainWindow.on('close', () => saveWindowBounds(mainWindow));

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window chrome IPC
ipcMain.handle('luma:window-minimize', () => {
  mainWindow?.minimize();
});
ipcMain.handle('luma:window-toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});
ipcMain.handle('luma:window-close', () => {
  mainWindow?.close();
});
ipcMain.handle('luma:window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
ipcMain.handle('luma:get-platform', () => process.platform);

// Local workspace persistence
ipcMain.handle('luma:load-workspace', () => {
  try {
    const file = WORKSPACE_FILE();
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('luma:save-workspace', (_event, jsonString) => {
  if (typeof jsonString !== 'string') return false;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(WORKSPACE_FILE(), jsonString, 'utf8');
    return true;
  } catch {
    return false;
  }
});

// Native file import dialog (EPUB, PDF, DOCX, PPTX, TXT, FB2, MD, Images)
ipcMain.handle('luma:pick-files', async (_event, mode) => {
  if (!mainWindow) return [];
  const filters =
    mode === 'image'
      ? [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      : [
          {
            name: 'Documentos Luma',
            extensions: ['epub', 'pdf', 'docx', 'pptx', 'txt', 'md', 'fb2'],
          },
          { name: 'Todos los archivos', extensions: ['*'] },
        ];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: mode === 'image' ? 'Insertar imagen en Luma' : 'Importar documentos a Luma',
    properties: ['openFile', 'multiSelections'],
    filters,
  });

  if (result.canceled || !result.filePaths.length) return [];

  return result.filePaths.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: buffer.length,
      base64: buffer.toString('base64'),
    };
  });
});

// Native file export dialog (PNG / HTML / JSON)
ipcMain.handle('luma:save-export', async (_event, payload) => {
  if (!mainWindow || !payload || typeof payload.defaultName !== 'string') {
    return { saved: false };
  }
  const ext = path.extname(payload.defaultName).replace('.', '') || 'png';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar desde Luma',
    defaultPath: payload.defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });

  if (result.canceled || !result.filePath) return { saved: false };

  if (payload.encoding === 'base64') {
    const cleanBase64 = String(payload.data).replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(cleanBase64, 'base64'));
  } else {
    fs.writeFileSync(result.filePath, String(payload.data), 'utf8');
  }
  return { saved: true, filePath: result.filePath };
});

// Safe external lookup (Wikipedia / RAE / WordReference)
ipcMain.handle('luma:open-external', async (_event, url) => {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      await shell.openExternal(parsed.toString());
      return true;
    }
  } catch {
    return false;
  }
  return false;
});
