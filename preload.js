const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    parseDocument: (fileBuffer) => ipcRenderer.invoke('parse-document', fileBuffer),
    getFileInfo: (fileBuffer) => ipcRenderer.invoke('get-file-info', fileBuffer),
    encrypt: (data) => ipcRenderer.invoke("encrypt", data),
    encryptSync: (data) => ipcRenderer.sendSync("encrypt-sync", data),
    batchEncrypt: (keywords) => ipcRenderer.invoke("batch-encrypt", keywords),
    decrypt: (data) => ipcRenderer.invoke("decrypt", data)
});
