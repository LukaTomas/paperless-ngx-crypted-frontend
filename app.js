const { app, BrowserWindow, session, ipcMain} = require('electron');

let mainWindow;
let loginWindow;
let hasLoggedIn = false; // Prevent multiple main window creations

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // Keep secure
            contextIsolation: true,
            session: session.defaultSession, // Share cookies
        },
    });

    loginWindow.loadURL('http://131.159.252.18:8000/login/'); // Load login page

    loginWindow.webContents.openDevTools();

    // Detect login success by monitoring cookies
    session.defaultSession.cookies.on('changed', (event, cookie, cause) => {
        if (!hasLoggedIn) {
            hasLoggedIn = true; // Ensure this runs only once
            console.log('Login successful, cookie set:', cookie);

            // loginWindow.close(); // Close login window
            // createMainWindow(); // Proceed to main app
        }
    });

    loginWindow.on('closed', () => {
        loginWindow = null;
        // for debug purposes
        createMainWindow();
    });
}

function createMainWindow() {
    if (mainWindow) return; // Prevent duplicate windows

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.defaultSession,
        },
    });

    // Listen for when angular need the cookies
    ipcMain.handle('getCookies', async () => {
        const cookies = await session.defaultSession.cookies.get({ url: 'http://131.159.252.18' });
        return cookies;
    });

    mainWindow.webContents.session.cookies.get({ url: 'http://131.159.252.18' }).then((cookies) => console.log(cookies))

    mainWindow.loadURL("http://localhost:8080/index.html");

    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createLoginWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
});

