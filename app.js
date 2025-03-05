const { app, BrowserWindow, session, ipcMain } = require('electron');
const { spawn, exec, execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require("crypto");

let mainWindow;
let loginWindow;
let hasLoggedIn = false;
let pythonServerProcess;

const execPromise = promisify(exec);
const python = '/usr/bin/python3.12'

function startPythonServer() {
    console.log("Starting Python HTTP server...");
    pythonServerProcess = spawn(python, ['-m', 'http.server', '8080'], {
        cwd: './dist/paperless-ui',
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
            nodeIntegration: false,
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
            preload: path.join(__dirname, "preload.js")
        },
    });

    ipcMain.handle('parse-document', async (_event, fileBuffer) => {
        const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.pdf`);
        try {
            fs.writeFileSync(tempFilePath, Buffer.from(fileBuffer));

            const { stdout } = await execPromise(`pdftotext "${tempFilePath}" -`);
            fs.unlinkSync(tempFilePath);

            return stdout;
        } catch (error) {
            fs.unlinkSync(tempFilePath);
            throw new Error(`pdftotext failed: ${error.message}`);
        }
    });

    ipcMain.handle('get-file-info', async (_event, fileBuffer) => {
        const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}.pdf`);
        try {
            fs.writeFileSync(tempFilePath, Buffer.from(fileBuffer));
            const { stdout } = await execPromise(`exiftool ${tempFilePath} -d %Y-%m-%dT%H:%M:%S%z`);
            console.log(stdout)
            fs.unlinkSync(tempFilePath);
            return stdout;
        } catch (error) {
            fs.unlinkSync(tempFilePath);
            throw new Error(`exiftool failed: ${error.message}`);
        }
    });

    function getKeyFilePath() {
        const appDataDir = path.join(app.getPath("userData"));
        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
        }
        return path.join(appDataDir, "encryption.key");
    }

    function setFilePermissions(filePath) {
        try {
            if (process.platform !== "win32") {
                fs.chmodSync(filePath, 0o600);
            }
        } catch (err) {
            console.warn("Failed to set file permissions:", err);
        }
    }

    function ensureKeyFile() {
        const keyFilePath = getKeyFilePath();
        if (!fs.existsSync(keyFilePath)) {
            const newKey = crypto.randomBytes(32);
            fs.writeFileSync(keyFilePath, newKey);
            setFilePermissions(keyFilePath);
        }
        return keyFilePath;
    }

    function getPythonScriptPath() {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'assets', 'miniwhoosh', 'ske.py');
        } else {
            return path.join(__dirname, 'src', 'assets', 'miniwhoosh', 'ske.py');
        }
    }    

    function runPythonEncryptor(action, data) {
        return new Promise((resolve, reject) => {
            const keyFilePath = ensureKeyFile();

            const pythonScriptPath = getPythonScriptPath();

            execFile(python, [pythonScriptPath, action, keyFilePath, data], (error, stdout, stderr) => {
                if (error) {
                    console.error("Python process error:", error, stderr);
                    return reject(error);
                }

                try {
                    const parsed = JSON.parse(stdout.trim());
                    resolve(parsed.result);
                } catch (parseErr) {
                    console.error("Failed to parse Python output:", stdout, stderr);
                    reject(parseErr);
                }
            });
        });
    }

    function runPythonEncryptorSync(data) {
        const { execFileSync } = require('child_process');
        const keyFilePath = getKeyFilePath();

        const pythonScriptPath = getPythonScriptPath();

        try {
            const result = execFileSync(python, [
                pythonScriptPath,
                'encrypt',
                keyFilePath,
                data
            ]);

            const parsedResult = JSON.parse(result.toString());
            return parsedResult.result;
        } catch (error) {
            console.error("Encryption failed:", error);
            return null;
        }
    }

    ipcMain.handle('encrypt', async (_event, data) => {
        try {
            return await runPythonEncryptor('encrypt', data);
        } catch (err) {
            console.error("Encryption failed:", err);
            throw err;
        }
    });

    ipcMain.on('encrypt-sync', (event, data) => {
        const result = runPythonEncryptorSync(data);
        event.returnValue = result;
    });

    ipcMain.handle('batch-encrypt', async (_event, keywords) => {
        try {
            res = await runPythonEncryptor('batch_encrypt', JSON.stringify({ keywords }));
            console.log(res["grubbs"])
            return res;
        } catch (err) {
            console.error("Encryption failed:", err);
            throw err;
        }
    });

    ipcMain.handle('decrypt', async (_event, data) => {
        try {
            return await runPythonEncryptor('decrypt', data);
        } catch (err) {
            console.error("Decryption failed:", err);
            throw err;
        }
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
