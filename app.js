const { app, BrowserWindow, session, ipcMain } = require('electron');
const { spawn } = require('child_process');

let mainWindow;
let loginWindow;
let hasLoggedIn = false;
let pythonServerProcess; // Store the Python process

// Function to start the Python HTTP server
function startPythonServer() {
    console.log("Starting Python HTTP server...");
    pythonServerProcess = spawn('python', ['-m', 'http.server', '8080'], {
        cwd: './dist/paperless-ui/en-US',
    });

    // Log Python server output
    pythonServerProcess.stdout.on('data', (data) => {
        console.log(`Python Server: ${data}`);
    });

    pythonServerProcess.stderr.on('data', (data) => {
        console.error(`Python Server Error: ${data}`);
    });

    pythonServerProcess.on('close', (code) => {
        console.log(`Python server exited with code ${code}`);
    });
}

// Function to stop the Python server when Electron quits
function stopPythonServer() {
    if (pythonServerProcess) {
        console.log("Stopping Python HTTP server...");
        pythonServerProcess.kill();
    }
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            session: session.defaultSession,
        },
    });

    loginWindow.loadURL('http://localhost:8000/login/');
    loginWindow.webContents.openDevTools();

    session.defaultSession.cookies.on('changed', (event, cookie, cause) => {
        if (!hasLoggedIn) {
            hasLoggedIn = true;
            console.log('Login successful, cookie set:', cookie);
        }
    });

    loginWindow.on('closed', () => {
        loginWindow = null;
        createMainWindow();
    });
}

function createMainWindow() {
    if (mainWindow) return;

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.defaultSession,
        },
    });

    ipcMain.handle('getCookies', async () => {
        const cookies = await session.defaultSession.cookies.get({ url: 'http://localhost' });
        return cookies;
    });

    mainWindow.webContents.session.cookies.get({ url: 'http://localhost' }).then((cookies) => console.log(cookies));

    mainWindow.loadURL("http://localhost:8080/index.html");
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startPythonServer();
    createLoginWindow();
});

app.on('window-all-closed', () => {
    stopPythonServer();
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    stopPythonServer();
});

app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
});
