# CertidãoPRO — Sistema de Emissão de Certidão de Regularidade de Inventário

O **CertidãoPRO** é uma ferramenta voltada à rotina de secretarias judiciais para conferência estruturada de processos de **Inventário e Partilha** e emissão padronizada de **Certidões de Regularidade**.

O sistema combina um formulário guiado em etapas com um **painel de visualização em tempo real** e um **motor automático de verificação de pendências** processuais, documentais e tributárias, garantindo agilidade, padronização e redução de retrabalho na análise dos autos.

---

## Formas de Acesso e Utilização

O **CertidãoPRO** pode ser utilizado de duas maneiras, mantendo **exatamente as mesmas funcionalidades** em ambas:

### 1. Versão Web (GitHub Pages — Sem Instalação)
Ideal para acesso imediato diretamente pelo navegador (Google Chrome, Microsoft Edge, etc.), de qualquer computador com acesso à web:

- **Acesse aqui:** [**https://paulofreire777.github.io/CertidaoPRO/**](https://paulofreire777.github.io/CertidaoPRO/)
- **Como funciona:** Roda 100% no navegador do usuário (*client-side*). Conta com salvamento automático local, importação/exportação de arquivos `.json`, cópia rápida de pendências para o PJe/eproc e geração do PDF final em formato A4.

### 2. Versão Desktop Portable (`.exe` para Windows — 100% Offline)
Ideal para ambientes corporativos ou computadores de Fórum/Tribunal com restrições de rede, proxy ou onde o usuário não possui permissão de Administrador para instalar softwares:

- **Download do Executável Portátil:** Disponível na aba [**Releases**](https://github.com/PauloFreire777/CertidaoPRO/releases) deste repositório (`CertidaoPRO-Portable-0.1.0.exe`).
- **Como funciona:** Basta baixar e executar o arquivo `.exe` (em qualquer pasta ou pendrive). Não requer instalação nem conexão com a internet, pois já traz seu motor de renderização e geração de PDF integrado.

---

## Privacidade e Segurança Institucional

O **CertidãoPRO** foi projetado seguindo o princípio de **Privacidade desde a Concepção (*Privacy by Design*)**:

- **Processamento 100% Local (*Zero-Backend*):** Nenhuma informação digitada (números de processos, nomes de partes, documentos ou valores) é transmitida para servidores externos ou bancos de dados na nuvem.
- **Armazenamento sob Controle do Usuário:** O rascunho em andamento fica salvo exclusivamente na memória local do próprio navegador/aplicativo (`localStorage`) da máquina do usuário e pode ser exportado/importado manualmente em arquivos `.json` locais.
- **Código Limpo e Auditável:** O repositório contém apenas o código-fonte da aplicação e um arquivo fictício de demonstração (`Certidao_Teste_Completa.json`), sem qualquer dado real ou credencial institucional.

---

## Principais Funcionalidades

- **Análise Guiada em 8 Abas:**
  1. **Dados do Processo:** Número dos autos, inventário cumulativo, advogados cadastrados e identificação do servidor responsável.
  2. **De Cujus (Falecidos):** Suporte a inventários simples ou cumulativos, regime de casamento e existência de testamento.
  3. **Inventariante:** Controle de documentos pessoais, procuração, termo de compromisso e representação.
  4. **Herdeiros e Sucessores (Árvore Recursiva):**
     - Classificação entre herdeiros **Capazes**, **Incapazes** (com dados de Curatela) e **Falecidos / Pré-mortos** (com abertura recursiva de representantes/netos e controle de ITCD próprio).
     - Controle de meação, estado civil, regime de bens e documentação do cônjuge/companheiro(a).
     - Seções específicas para **Renúncia de Direitos** (Abdicativa/Translativa) e **Cessão de Direitos Hereditários**.
  5. **Bens, Valores e Dívidas:**
     - **Bens Imóveis** (Urbanos com controle de IPTU e Rurais com ITR, CCIR e CAR).
     - **Veículos**, **Semoventes**, **Outros Bens e Direitos** (quotas societárias, maquinário, etc.), **Valores Residuais**, **Dívidas do Espólio** e **Alvarás** (com controle de expedição e prestação de contas).
  6. **Documentos Processuais:** Primeiras e últimas declarações, edital (expedição e decurso de prazo), certidões CENSEC/testamentos, sentença e trânsito em julgado.
  7. **Documentação Tributária e Custas:** Controle individualizado por falecido de ITCD e Certidões Negativas de Débito (Municipal, Estadual e Federal), além da situação das custas processuais.
  8. **Observações Adicionais:** Notas classificadas por nível de relevância (*Baixa*, *Média* e *Alta*) com destaque visual na certidão.
- **Regras Condicionais Automáticas:**
  - Ao identificar qualquer herdeiro ou representante **Incapaz**, o sistema passa automaticamente a exigir e monitorar a **Manifestação do Ministério Público** e a **Avaliação Judicial** dos bens.
- **Cálculo Automático e Cópia de Pendências (1 Clique):**
  - Lista todas as pendências em tempo real no topo da certidão e oferece o botão **"Copiar Pendências"**, formatando a lista numerada pronta para colagem em despachos, atos ordinatórios ou certidões no PJe/eproc.
- **Atalhos Rápidos de Teclado:**
  - `Ctrl + S`: Exportar/salvar a certidão atual em arquivo `.json`.
  - `Ctrl + P`: Gerar o documento final em PDF (formato A4 com controle inteligente de quebras de página).

---

## Como Executar e Compilar Localmente (Desenvolvedores)

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18 ou superior)

### Instalação das dependências
```bash
npm install
```

### Rodar em modo de desenvolvimento (Web)
```bash
npm run serve
```

### Compilar a versão Web (GitHub Pages)
```bash
npm run build
```
Os arquivos estáticos otimizados serão gerados na pasta `dist/`.

### Compilar a versão Desktop Portable (`.exe` para Windows)
```bash
npm run build:portable
```
O executável portátil autocontido será gerado em `dist-electron/CertidaoPRO-Portable-0.1.0.exe`.

---

## Estrutura do Projeto

```text
├── .github/workflows/       # Automação de deploy para o GitHub Pages
├── public/                  # Template HTML base e ícone da aplicação
├── src/
│   ├── components/          # Componentes Vue (Formulário recursivo, Preview e Ícones SVG)
│   ├── utils/               # Estado inicial (stateHelpers.js) e motor de PDF (pdfGenerator.js)
│   ├── App.vue              # Interface principal, cálculo de pendências e gerenciamento de estado
│   ├── main.css             # Estilização da interface e regras de paginação A4 (@media print)
│   └── main.js              # Ponto de entrada da aplicação Vue 3
├── electron.js              # Processo principal do Electron para a versão Desktop Portable
├── preload.js               # Ponte segura (ContextBridge) entre a interface Vue e o Electron
├── copy-chromium.js         # Script auxiliar de preparação do motor Chromium para o build portable
├── Certidao_Teste_Completa.json # Arquivo fictício de exemplo para testes de todas as funções
└── package.json             # Configurações de scripts, dependências e electron-builder
```
