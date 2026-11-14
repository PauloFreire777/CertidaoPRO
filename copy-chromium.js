// copy-chromium.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);

  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyFolderRecursiveSync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

console.log('Verificando Chromium para o build...');

try {
  const destDir = path.join(__dirname, 'chromium-bin');
  const existingCopiedChrome = path.join(destDir, 'chrome.exe');

  // 1. Se o Chromium já estiver presente em ./chromium-bin/chrome.exe, reutiliza sem apagar!
  if (fs.existsSync(existingCopiedChrome)) {
    console.log('✓ Chromium já está pronto em:', existingCopiedChrome);
    console.log('  Tamanho:', (fs.statSync(existingCopiedChrome).size / 1024 / 1024).toFixed(2), 'MB');
    process.exit(0);
  }

  // 2. Caso não exista em ./chromium-bin, procura no cache do Puppeteer
  const chromiumPath = puppeteer.executablePath();
  console.log('Procurando Chromium no cache do Puppeteer:', chromiumPath);

  if (!fs.existsSync(chromiumPath)) {
    throw new Error(
      `O executável do Chromium não foi encontrado nem em "${existingCopiedChrome}" nem no cache do Puppeteer ("${chromiumPath}").\n` +
      `Execute "npx puppeteer browsers install chrome" para baixá-lo novamente.`
    );
  }

  const chromiumDir = path.dirname(chromiumPath);
  console.log('Copiando Chromium de:', chromiumDir, 'para:', destDir);
  copyFolderRecursiveSync(chromiumDir, destDir);

  if (fs.existsSync(existingCopiedChrome)) {
    console.log('✓ Chromium copiado com sucesso!');
    console.log('  Executável em:', existingCopiedChrome);
    console.log('  Tamanho:', (fs.statSync(existingCopiedChrome).size / 1024 / 1024).toFixed(2), 'MB');
  } else {
    throw new Error('chrome.exe não foi encontrado após a cópia');
  }
} catch (error) {
  console.error('Erro ao preparar Chromium:', error.message);
  process.exit(1);
}
