// ensure-chromium.js
// Este script garante que o Chromium está baixado antes de fazer o build

async function ensureChromium() {
  const puppeteer = require('puppeteer');
  const path = require('path');
  const fs = require('fs');

  console.log('Verificando instalação do Chromium...');

  try {
    const executablePath = puppeteer.executablePath();
    
    console.log('Caminho esperado do Chromium:', executablePath);
    
    if (fs.existsSync(executablePath)) {
      console.log('✓ Chromium já está instalado!');
      console.log('Tamanho do arquivo:', fs.statSync(executablePath).size, 'bytes');
      
      // Mostra a estrutura de pastas para debug
      const puppeteerDir = path.join(__dirname, 'node_modules', 'puppeteer');
      console.log('\nEstrutura da pasta do puppeteer:');
      showDirectoryTree(puppeteerDir, '', 2);
    } else {
      console.log('✗ Chromium não encontrado.');
      console.log('Por favor, certifique-se de que o puppeteer foi instalado corretamente.');
      console.log('Tente executar: npm install puppeteer --save');
    }
    
  } catch (error) {
    console.error('Erro ao verificar Chromium:', error);
    process.exit(1);
  }

  function showDirectoryTree(dir, prefix = '', maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return;
    
    try {
      const files = fs.readdirSync(dir);
      files.forEach((file, index) => {
        const fullPath = path.join(dir, file);
        const isLast = index === files.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        
        console.log(prefix + connector + file);
        
        if (fs.statSync(fullPath).isDirectory() && !file.includes('locales') && !file.includes('node_modules')) {
          const extension = isLast ? '    ' : '│   ';
          showDirectoryTree(fullPath, prefix + extension, maxDepth, currentDepth + 1);
        }
      });
    } catch (e) {
      // Ignora erros de leitura
    }
  }
}

// Executa a função
ensureChromium().catch(console.error);