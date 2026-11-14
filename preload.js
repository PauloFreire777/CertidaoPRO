// preload.js - A ponte segura entre a interface (Vue) e o backend (Electron)

const { contextBridge, ipcRenderer } = require('electron');

// Expomos um objeto global chamado 'electronAPI' para a nossa aplicação Vue.
// Este objeto conterá as funções que a interface pode chamar.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Envia os dados da certidão para o processo principal do Electron
   * para que ele gere o arquivo PDF.
   * @param {object} data - O objeto contendo o 'state' e as 'pendencies'.
   * @returns {Promise<object>} Uma promessa que resolve com o resultado da operação.
   */
  generatePdf: (data) => ipcRenderer.invoke('generate-pdf', data),

  // <<< INÍCIO DA MODIFICAÇÃO >>>
  /**
   * Envia um sinal para o processo principal para forçar uma re-renderização
   * da janela, corrigindo problemas de congelamento da UI.
   */
  forceReRender: () => ipcRenderer.invoke('force-re-render')
  // <<< FIM DA MODIFICAÇÃO >>>
});