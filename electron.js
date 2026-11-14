// electron.js - Versão Otimizada (Alta Performance, 100% Offline, Chromium Portable)

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

let mainWindow;
let sharedBrowser = null;
let browserLaunchPromise = null;

// --- FUNÇÃO ROBUSTA PARA ENCONTRAR O EXECUTÁVEL DO CHROMIUM ---
let cachedChromiumPath = null;

function getChromiumPath() {
  if (cachedChromiumPath && fs.existsSync(cachedChromiumPath)) {
    return cachedChromiumPath;
  }

  console.log('[Chromium] Iniciando busca do executável...');
  console.log('[Chromium] app.isPackaged:', app.isPackaged);

  if (app.isPackaged) {
    const possiblePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'chromium-bin', 'chrome.exe'),
      path.join(process.resourcesPath, 'chromium-bin', 'chrome.exe'),
      path.join(path.dirname(process.execPath), 'chromium-bin', 'chrome.exe'),
      path.join(path.dirname(process.execPath), 'resources', 'chromium-bin', 'chrome.exe'),
      path.join(__dirname, 'chromium-bin', 'chrome.exe'),
      path.join(__dirname, '..', 'chromium-bin', 'chrome.exe'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'puppeteer', 'chrome', 'win64-*', 'chrome-win', 'chrome.exe'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'puppeteer', '.local-chromium', 'win64-*', 'chrome-win', 'chrome-exe'),
    ];

    for (let chromePath of possiblePaths) {
      if (chromePath.includes('*')) {
        const parts = chromePath.split(path.sep);
        let expandedPath = '';

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.includes('*')) {
            const basePath = parts.slice(0, i).join(path.sep);
            if (fs.existsSync(basePath)) {
              const dirs = fs.readdirSync(basePath);
              const pattern = part.replace('*', '.*');
              const regex = new RegExp(pattern);
              for (const dir of dirs) {
                if (regex.test(dir)) {
                  expandedPath = path.join(basePath, dir, ...parts.slice(i + 1));
                  break;
                }
              }
            }
            break;
          } else {
            expandedPath = path.join(expandedPath, part);
          }
        }
        if (expandedPath) {
          chromePath = expandedPath;
        }
      }

      if (fs.existsSync(chromePath)) {
        console.log('[Chromium] ✓ ENCONTRADO em:', chromePath);
        cachedChromiumPath = chromePath;
        return chromePath;
      }
    }

    function findChromeRecursive(dir, maxDepth = 3, currentDepth = 0) {
      if (currentDepth >= maxDepth || !fs.existsSync(dir)) return null;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (file.toLowerCase() === 'chrome.exe') {
            return fullPath;
          }
          if (
            fs.statSync(fullPath).isDirectory() &&
            !file.includes('node_modules') &&
            !file.includes('locales') &&
            !file.includes('$PLUGINSDIR')
          ) {
            const found = findChromeRecursive(fullPath, maxDepth, currentDepth + 1);
            if (found) return found;
          }
        }
      } catch (e) {
        // Ignora erros de permissão/leitura
      }
      return null;
    }

    const exeDir = path.dirname(process.execPath);
    const foundChrome = findChromeRecursive(exeDir);
    if (foundChrome) {
      console.log('[Chromium] ✓ Encontrado via busca recursiva:', foundChrome);
      cachedChromiumPath = foundChrome;
      return foundChrome;
    }

    throw new Error('Não foi possível encontrar o chrome.exe. Verifique se o Chromium foi incluído no build.');
  }

  const localBinChrome = path.join(__dirname, 'chromium-bin', 'chrome.exe');
  if (fs.existsSync(localBinChrome)) {
    console.log('[Chromium] ✓ Encontrado em chromium-bin local:', localBinChrome);
    cachedChromiumPath = localBinChrome;
    return localBinChrome;
  }

  const chromePath = puppeteer.executablePath();
  cachedChromiumPath = chromePath;
  return chromePath;
}

// --- GERENCIADOR DE INSTÂNCIA AQUECIDA DO CHROMIUM (GERAÇÃO INSTANTÂNEA DE PDF) ---
async function getOrLaunchBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    try {
      const chromiumPath = getChromiumPath();
      const browser = await puppeteer.launch({
        executablePath: chromiumPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--no-first-run'
        ]
      });

      browser.on('disconnected', () => {
        sharedBrowser = null;
      });

      sharedBrowser = browser;
      return browser;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

async function closeSharedBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch (e) {
      // Ignora erro ao fechar
    }
    sharedBrowser = null;
  }
}

// --- FUNÇÕES AUXILIARES DE FALLBACK PARA GERAÇÃO DE HTML ---
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d) {
  if (!d) return 'Não informado';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('pt-BR');
  } catch (e) {
    return escapeHtml(d);
  }
}

function getAdvogadoById(id, advogados) {
  if (!id || !advogados) return null;
  return advogados.find(a => a.id === id);
}

function getHeirNameById(id, allHeirs) {
  const find = (heirs) => {
    if (!heirs) return null;
    for (const h of heirs) {
      if (h.id === id) return h.nome;
      if (h.representantes) {
        const found = find(h.representantes);
        if (found) return found;
      }
    }
    return null;
  };
  return find(allHeirs) || 'Não encontrado';
}

function getEditalStatus(edital) {
  if (!edital || edital.determinado === 'Não') return 'Não determinada a expedição.';
  if (edital.status === 'Não Expedido') return 'Expedição pendente.';
  if (edital.prazoDecorrido === 'Não') return 'Expedido (ID: ' + (edital.id || 'N/A') + '), aguardando decurso de prazo.';
  return 'Expedido (ID: ' + (edital.id || 'N/A') + '), prazo decorrido (ID: ' + (edital.idDecursoPrazo || 'N/A') + ').';
}

function getCustasStatus(custas) {
  if (!custas) return 'Situação não informada.';
  if (custas.situacao === 'Isenção') return 'Isento de custas.';
  if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.';
  if (custas.situacao === 'Devidas') {
    const c = custas.calculada === 'Sim' ? 'Calculada (ID: ' + (custas.idCalculo || 'N/A') + ')' : 'Cálculo pendente';
    const p = custas.paga === 'Sim' ? 'Pagas (ID: ' + (custas.idPagamento || 'N/A') + ')' : 'Pagamento pendente';
    return c + ', ' + p + '.';
  }
  return 'Situação não informada.';
}

function generateHeirsHtml(heirs, allAdvogados, level = 0) {
  if (!heirs || heirs.length === 0) return '';
  return heirs.map(function (h) {
    const advogado = getAdvogadoById(h.advogadoId, allAdvogados);
    const curadorAdvogado = h.curador ? getAdvogadoById(h.curador.advogadoId, allAdvogados) : null;

    const procuracaoHtml = h.idProcuracao
      ? '<div class="info-procuracao"><p><strong>Procuração (ID):</strong> <span>' + escapeHtml(h.idProcuracao) + '</span></p></div>'
      : '';
    const advogadoHtml = advogado
      ? '<div class="info-advogado"><p><strong>Advogado(a):</strong> <span>' + escapeHtml(advogado.nome) + ' (OAB: ' + escapeHtml(advogado.oab) + ')</span></p></div>'
      : '';

    const incapazHtml = h.estado === 'Incapaz' && h.curador
      ? '<div class="preview-sub-card warning"><p><strong>Curador(a):</strong> <span>' + escapeHtml(h.curador.nome || 'Não informado') + '</span></p><p><strong>Termo de Curador (ID):</strong> <span>' + escapeHtml(h.curador.idTermo || 'Não informado') + '</span></p>' +
        (h.curador.idProcuracao ? '<div class="info-procuracao" style="margin-top: 8px;"><p><strong>Procuração Curador (ID):</strong> <span>' + escapeHtml(h.curador.idProcuracao) + '</span></p></div>' : '') +
        (curadorAdvogado ? '<div class="info-advogado" style="margin-top: 8px;"><p><strong>Advogado(a) do Curatelado:</strong> <span>' + escapeHtml(curadorAdvogado.nome) + ' (OAB: ' + escapeHtml(curadorAdvogado.oab) + ')</span></p></div>' : '') +
        '</div>'
      : '';

    let conjugeHtml = '';
    if ((h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável') && h.conjuge) {
      const conjugeAdvogado = getAdvogadoById(h.conjuge.advogadoId, allAdvogados);
      conjugeHtml =
        '<div class="preview-sub-card spouse">' +
        '<p><strong>Regime de Casamento:</strong> <span>' + escapeHtml(h.regimeCasamento || 'Não informado') + '</span></p>' +
        '<p><strong>Certidão de Casamento (ID):</strong> <span>' + escapeHtml(h.idCertidaoCasamento || 'Não informado') + '</span></p>' +
        '<hr style="border: 0; border-top: 1px dashed #e0e0e0; margin: 8px 0;">' +
        '<p><strong>Cônjuge/Comp.:</strong> <span>' + escapeHtml(h.conjuge.nome || 'Não informado') + '</span></p>' +
        '<p><strong>Documentos Pessoais (Cônjuge):</strong> <span>' + escapeHtml(h.conjuge.documentos || 'Não informado') + '</span></p>' +
        (h.conjuge.idProcuracao ? '<div class="info-procuracao" style="margin-left: 1rem;"><p><strong>Procuração Cônjuge (ID):</strong> <span>' + escapeHtml(h.conjuge.idProcuracao) + '</span></p></div>' : '') +
        (conjugeAdvogado ? '<div class="info-advogado" style="margin-left: 1rem;"><p><strong>Advogado(a) do Cônjuge:</strong> <span>' + escapeHtml(conjugeAdvogado.nome) + ' (OAB: ' + escapeHtml(conjugeAdvogado.oab) + ')</span></p></div>' : '') +
        '</div>';
    }

    let falecidoHtml = '';
    if (h.estado === 'Falecido') {
      const showItcdId =
        h.idItcd ||
        h.itcdStatus === 'Declarado e Pago' ||
        h.itcdStatus === 'Declarado e Parcelado' ||
        h.itcdStatus === 'Declarado e Pendente de Pagamento';
      const taxHtml = h.itcdStatus
        ? '<div class="tax-info"><p><strong>Status do ITCD:</strong> <span>' + escapeHtml(h.itcdStatus) + '</span></p>' +
          (showItcdId ? '<p><strong>ID do ITCD:</strong> <span>' + escapeHtml(h.idItcd || 'Não informado') + '</span></p>' : '') +
          '</div>'
        : '';
      falecidoHtml =
        '<div class="preview-sub-card danger"><p><strong>Certidão de Óbito (ID):</strong> <span>' + escapeHtml(h.idCertidaoObito || 'Não informado') + '</span></p>' +
        taxHtml +
        ((h.representantes && h.representantes.length > 0) ? '<p style="margin-top: 0.75rem;"><strong>Sucessão de Herdeiro Falecido:</strong></p>' + generateHeirsHtml(h.representantes, allAdvogados, level + 1) : '') +
        '</div>';
    }

    return (
      '<div class="preview-card" style="margin-left: ' + (level * 20) + 'px;">' +
      '<p><strong>' + (h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):')) + '</strong><span>' + escapeHtml(h.nome || 'Não informado') + ' ' + (h.parentesco ? '(' + escapeHtml(h.parentesco) + ')' : '') + '</span></p>' +
      '<p><strong>Condição:</strong> <span>' + escapeHtml(h.estado) + '</span></p>' +
      '<p><strong>Docs. Pessoais (ID):</strong> <span>' + escapeHtml(h.documentos || 'Não informado') + '</span></p>' +
      procuracaoHtml +
      advogadoHtml +
      incapazHtml +
      conjugeHtml +
      falecidoHtml +
      '</div>'
    );
  }).join('');
}

// --- LÓGICA PRINCIPAL DO ELECTRON ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  // Pré-aquece o Chromium em segundo plano após carregar a janela principal,
  // garantindo que o primeiro PDF seja gerado instantaneamente.
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      getOrLaunchBrowser().catch(err => {
        console.warn('[Chromium] Pré-aquecimento adiado:', err.message);
      });
    }, 1500);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async function () {
  await closeSharedBrowser();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async function () {
  await closeSharedBrowser();
});

// Mantido apenas por retrocompatibilidade com chamadas antigas, sem piscar a janela
ipcMain.handle('force-re-render', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.focus();
  }
  return Promise.resolve(true);
});

// --- FUNÇÃO DE GERAR PDF ---
ipcMain.handle('generate-pdf', async (event, payload) => {
  const { state, pendencies, html: prebuiltHtml, footerTemplate: prebuiltFooter } = payload || {};
  const numeroProcesso = (state && state.processo && state.processo.numero) ? state.processo.numero.replace(/[\\/:*?"<>|]/g, '-') : 'NOVO';

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Certidão em PDF',
    defaultPath: `Certidao-${numeroProcesso}.pdf`,
    filters: [{ name: 'Arquivos PDF', extensions: ['pdf'] }]
  });

  if (!filePath) {
    return { success: false, message: 'Operação cancelada pelo usuário.' };
  }

  try {
    let finalHtml = prebuiltHtml;
    let footerTemplate = prebuiltFooter;

    if (!finalHtml) {
      // Fallback caso o HTML não tenha vindo pré-montado do renderer
      footerTemplate =
        '<div style="font-family: \'Segoe UI\', Arial, sans-serif; font-size: 8pt; color: #777; width: 100%; display: flex; justify-content: space-between; padding: 0 1.5cm; box-sizing: border-box;">' +
        '<span>Este documento foi gerado eletronicamente pelo Sistema CertidãoPRO</span>' +
        '<span>Data de Emissão: ' + new Date().toLocaleDateString('pt-BR') + ' - Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>' +
        '</div>';
      finalHtml = '<html><body><p>Documento vazio</p></body></html>';
    }

    let browser;
    try {
      browser = await getOrLaunchBrowser();
    } catch (error) {
      console.error('[PDF] ERRO ao obter navegador Chromium:', error);
      const debugInfo = `Erro ao localizar ou iniciar o Chromium:\n${error.message}\n\nVerifique se a pasta chromium-bin está presente junto ao aplicativo.`;
      dialog.showErrorBox('Erro ao Localizar Chromium', debugInfo);
      return { success: false, message: error.message };
    }

    const page = await browser.newPage();
    try {
      // Como o HTML agora é 100% offline (sem fontes externas da internet),
      // 'domcontentloaded' é instantâneo e imune a bloqueios de rede/proxy do Fórum.
      await page.setContent(finalHtml, { waitUntil: 'domcontentloaded' });
      await page.emulateMediaType('print');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '2cm',
          right: '1.5cm',
          bottom: '2cm',
          left: '1.5cm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate
      });

      fs.writeFileSync(filePath, pdfBuffer);
    } finally {
      await page.close().catch(() => {});
    }

    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    dialog.showErrorBox('Erro ao Gerar PDF', error.message);
    return { success: false, message: error.message };
  }
});
