// src/utils/pdfGenerator.js
// Gerador unificado e seguro (HTML-escaped) do documento de Certidão para PDF (100% Offline)

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDatePtBr(d) {
  if (!d) return 'Não informado';
  try {
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return escapeHtml(d);
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

export function formatEditalStatus(edital) {
  if (!edital || edital.determinado === 'Não') return 'Não determinada a expedição.';
  if (edital.status === 'Não Expedido') return 'Expedição pendente.';
  if (edital.prazoDecorrido === 'Não') {
    return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`;
  }
  return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`;
}

export function formatCustasStatus(custas) {
  if (!custas) return 'Situação não informada.';
  if (custas.situacao === 'Isenção') return 'Isento de custas.';
  if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.';
  if (custas.situacao === 'Devidas') {
    const c = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente';
    const p = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente';
    return `${c}, ${p}.`;
  }
  return 'Situação não informada.';
}

function generateHeirsHtml(heirs, allAdvogados, level = 0) {
  if (!heirs || heirs.length === 0) return '';
  return heirs.map(function (h) {
    const advogado = getAdvogadoById(h.advogadoId, allAdvogados);
    const curadorAdvogado = h.curador ? getAdvogadoById(h.curador.advogadoId, allAdvogados) : null;

    const procuracaoHtml = h.idProcuracao
      ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong> <span>${escapeHtml(h.idProcuracao)}</span></p></div>`
      : '';
    const advogadoHtml = advogado
      ? `<div class="info-advogado"><p><strong>Advogado(a):</strong> <span>${escapeHtml(advogado.nome)} (OAB: ${escapeHtml(advogado.oab)})</span></p></div>`
      : '';

    let incapazHtml = '';
    if (h.estado === 'Incapaz' && h.curador) {
      incapazHtml =
        `<div class="preview-sub-card warning">` +
        `<p><strong>Curador(a):</strong> <span>${escapeHtml(h.curador.nome || 'Não informado')}</span></p>` +
        `<p><strong>Termo de Curador (ID):</strong> <span>${escapeHtml(h.curador.idTermo || 'Não informado')}</span></p>` +
        (h.curador.idProcuracao
          ? `<div class="info-procuracao" style="margin-top: 8px;"><p><strong>Procuração Curador (ID):</strong> <span>${escapeHtml(h.curador.idProcuracao)}</span></p></div>`
          : '') +
        (curadorAdvogado
          ? `<div class="info-advogado" style="margin-top: 8px;"><p><strong>Advogado(a) do Curatelado:</strong> <span>${escapeHtml(curadorAdvogado.nome)} (OAB: ${escapeHtml(curadorAdvogado.oab)})</span></p></div>`
          : '') +
        `</div>`;
    }

    let conjugeHtml = '';
    if ((h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável') && h.conjuge) {
      const conjugeAdvogado = getAdvogadoById(h.conjuge.advogadoId, allAdvogados);
      conjugeHtml =
        `<div class="preview-sub-card spouse">` +
        `<p><strong>Regime de Casamento:</strong> <span>${escapeHtml(h.regimeCasamento || 'Não informado')}</span></p>` +
        `<p><strong>Certidão de Casamento (ID):</strong> <span>${escapeHtml(h.idCertidaoCasamento || 'Não informado')}</span></p>` +
        `<hr style="border: 0; border-top: 1px dashed #e0e0e0; margin: 8px 0;">` +
        `<p><strong>Cônjuge/Comp.:</strong> <span>${escapeHtml(h.conjuge.nome || 'Não informado')}</span></p>` +
        `<p><strong>Documentos Pessoais (Cônjuge):</strong> <span>${escapeHtml(h.conjuge.documentos || 'Não informado')}</span></p>` +
        (h.conjuge.idProcuracao
          ? `<div class="info-procuracao" style="margin-left: 1rem;"><p><strong>Procuração Cônjuge (ID):</strong> <span>${escapeHtml(h.conjuge.idProcuracao)}</span></p></div>`
          : '') +
        (conjugeAdvogado
          ? `<div class="info-advogado" style="margin-left: 1rem;"><p><strong>Advogado(a) do Cônjuge:</strong> <span>${escapeHtml(conjugeAdvogado.nome)} (OAB: ${escapeHtml(conjugeAdvogado.oab)})</span></p></div>`
          : '') +
        `</div>`;
    }

    let falecidoHtml = '';
    if (h.estado === 'Falecido') {
      const showItcdId =
        h.idItcd ||
        h.itcdStatus === 'Declarado e Pago' ||
        h.itcdStatus === 'Declarado e Parcelado' ||
        h.itcdStatus === 'Declarado e Pendente de Pagamento';

      const taxHtml = h.itcdStatus
        ? `<div class="tax-info">` +
          `<p><strong>Status do ITCD:</strong> <span>${escapeHtml(h.itcdStatus)}</span></p>` +
          (showItcdId ? `<p><strong>ID do ITCD:</strong> <span>${escapeHtml(h.idItcd || 'Não informado')}</span></p>` : '') +
          `</div>`
        : '';

      const repHtml =
        h.representantes && h.representantes.length > 0
          ? `<p style="margin-top: 0.75rem;"><strong>Sucessão de Herdeiro Falecido:</strong></p>` +
            generateHeirsHtml(h.representantes, allAdvogados, level + 1)
          : '';

      falecidoHtml =
        `<div class="preview-sub-card danger">` +
        `<p><strong>Certidão de Óbito (ID):</strong> <span>${escapeHtml(h.idCertidaoObito || 'Não informado')}</span></p>` +
        taxHtml +
        repHtml +
        `</div>`;
    }

    const roleLabel = h.isMeeiro ? 'Meeiro(a):' : level > 0 ? 'Representante:' : 'Herdeiro(a):';
    const parentescoText = h.parentesco ? ` (${escapeHtml(h.parentesco)})` : '';

    return (
      `<div class="preview-card" style="margin-left: ${level * 20}px;">` +
      `<p><strong>${roleLabel}</strong><span>${escapeHtml(h.nome || 'Não informado')}${parentescoText}</span></p>` +
      `<p><strong>Condição:</strong> <span>${escapeHtml(h.estado)}</span></p>` +
      `<p><strong>Docs. Pessoais (ID):</strong> <span>${escapeHtml(h.documentos || 'Não informado')}</span></p>` +
      procuracaoHtml +
      advogadoHtml +
      incapazHtml +
      conjugeHtml +
      falecidoHtml +
      `</div>`
    );
  }).join('');
}

export function buildPdfDocument(state, pendencies = [], options = {}) {
  const { includeInlineFooterMeta = false } = options;
  const css = `
    :root {
      --primary-color: #2c3e50;
      --accent-color: #3498db;
      --success-color: #27ae60;
      --danger-color: #c0392b;
      --warning-color: #f39c12;
      --font-sans: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      --font-serif: 'Lora', 'Georgia', 'Cambria', 'Times New Roman', serif;
      --border-radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page {
      size: A4;
      margin: 2cm 1.5cm;
    }
    body {
      font-family: var(--font-serif);
      color: #1a1a1a;
      line-height: 1.5;
      font-size: 10pt;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      orphans: 3;
      widows: 3;
      background-color: #ffffff;
    }

    /* Controle de quebras de página */
    .preview-section h3, .preview-section h4 { break-after: avoid; }
    .preview-card, .preview-card-small, .preview-sub-card, .pendencies-list li { break-inside: avoid; }
    .preview-footer, .main-footer { break-before: avoid; }

    /* Estilos visuais */
    .preview-header { text-align: center; background-color: #2c3e50; color: white; padding: 1.5rem; border-radius: 6px 6px 0 0; }
    .header-text p { font-family: var(--font-sans); font-weight: 500; margin: 0; line-height: 1.3; font-size: 10pt; }
    .header-text .comarca { font-size: 12pt; font-weight: 700; margin-top: 2px; }
    .preview-header h1 { font-family: var(--font-sans); font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid rgba(255,255,255,0.25); }
    .preview-header h2.subtitle { font-family: var(--font-sans); font-size: 1.05rem; opacity: 0.85; font-weight: 400; margin-top: 0.2rem; }

    .preview-section { padding: 0.85rem 1.25rem 0.25rem 1.25rem; }
    .preview-section h3 { font-family: var(--font-sans); font-size: 1.15rem; font-weight: 600; color: var(--primary-color); padding-bottom: 0.4rem; margin: 1.25rem 0 0.85rem 0; border-bottom: 2px solid var(--primary-color); }
    .preview-section h4 { font-family: var(--font-sans); font-size: 1rem; font-weight: 600; color: #444; margin-top: 1rem; margin-bottom: 0.6rem; padding-bottom: 0.2rem; border-bottom: 1px solid #eee; }

    .pendencies-section { border: 1px solid var(--danger-color); background-color: rgba(192, 57, 43, 0.05); padding: 1.25rem; margin: 1rem 1.25rem; border-radius: 6px; }
    .pendencies-section h3 { color: var(--danger-color); border-bottom-color: var(--danger-color); margin: 0 0 0.75rem 0; }
    .pendencies-list { list-style-type: none; padding-left: 0; margin: 0; }
    .pendencies-list li { padding: 0.35rem 0.6rem; margin-bottom: 0.35rem; font-family: var(--font-sans); font-size: 9.5pt; border-left: 3px solid var(--danger-color); background: rgba(192, 57, 43, 0.04); border-radius: 3px; }

    .preview-card, .preview-card-small { border: 1px solid #dcdcdc; padding: 0.9rem 1rem; margin-bottom: 0.85rem; border-radius: var(--border-radius); background: #fff; }
    .preview-card p, .preview-card-small p { margin-bottom: 0.45rem; display: flex; align-items: flex-start; }
    .preview-card p:last-child, .preview-card-small p:last-child { margin-bottom: 0; }
    .preview-card strong, .preview-card-small strong { font-weight: 600; font-family: var(--font-sans); color: #555; margin-right: 8px; min-width: 185px; flex-shrink: 0; }
    .preview-card p span, .preview-card-small p span { flex: 1; color: #222; word-break: break-word; }

    .info-procuracao, .info-advogado, .tax-info { font-size: 9pt !important; padding: 0.65rem 0.75rem; border-radius: 4px; margin-top: 0.45rem; border-left-width: 3px; border-left-style: solid; }
    .info-procuracao { color: var(--success-color); background-color: rgba(39, 174, 96, 0.07); border-left-color: var(--success-color); }
    .info-advogado { color: #2980b9; background-color: rgba(52, 152, 219, 0.07); border-left-color: #3498db; }
    .tax-info { background-color: #f9ebea; border-left-color: #e74c3c; color: #333; }
    .info-procuracao p, .info-advogado p, .tax-info p { margin: 0 0 0.25rem 0; }
    .info-procuracao p:last-child, .info-advogado p:last-child, .tax-info p:last-child { margin: 0; }

    .preview-sub-card { margin-top: 0.65rem; padding: 0.7rem; border-radius: 4px; border-left: 3px solid #ccc; background-color: #fafafa; }
    .preview-sub-card.warning { border-left-color: var(--warning-color); background-color: rgba(241, 196, 15, 0.05); }
    .preview-sub-card.danger { border-left-color: var(--danger-color); background-color: rgba(231, 76, 60, 0.05); }
    .preview-sub-card.spouse { border-left-color: #e91e63; background-color: rgba(233, 30, 99, 0.04); }

    .warning-text span, .warning-text { color: #d35400; font-weight: 600; }
    .success-text span { color: var(--success-color); font-weight: 600; }

    .preview-card.obs-baixa { border-left: 4px solid #f39c12; }
    .preview-card.obs-media { border-left: 4px solid #e67e22; }
    .preview-card.obs-alta { border-left: 4px solid var(--danger-color); }
    .obs-content span { white-space: pre-wrap; }

    .main-footer { padding: 2rem 1.5rem 0 1.5rem; border-top: 1px solid #ccc; margin-top: 2rem; text-align: center; }
    .signature-line { border-top: 1px solid #000; width: 350px; padding-top: 0.5rem; display: inline-block; }
    .signature-name { font-weight: 600; font-size: 11pt; overflow-wrap: break-word; font-family: var(--font-sans); }
    .signature-title { font-size: 10pt; color: #555; font-family: var(--font-sans); }
    .web-print-meta { margin-top: 1.25rem; font-family: var(--font-sans); font-size: 8pt; color: #777; display: flex; justify-content: space-between; }
  `;

  const herdeirosValidos = (state.herdeiros || []).filter(h => h.nome && h.nome.trim() !== '');
  const hasBens = Object.values(state.bens || {}).some(arr => Array.isArray(arr) && arr.length > 0);
  const checkIncapaz = (heirs) => {
    if (!heirs) return false;
    return heirs.some(h => h.estado === 'Incapaz' || checkIncapaz(h.representantes));
  };
  const hasIncapaz = checkIncapaz(herdeirosValidos);

  let sectionCounter = 0;
  let htmlSections = '';

  // 1. Dados do Processo
  if (state.processo && state.processo.numero) {
    sectionCounter++;
    const advsHtml =
      state.processo.advogados && state.processo.advogados.length > 0
        ? `<div class="info-advogado" style="margin-top: 0.75rem;"><p style="margin:0;"><strong>Advogados no Processo:</strong></p><ul style="list-style: none; padding-left: 10px; margin-top: 5px;">` +
          state.processo.advogados.map(adv => `<li>- ${escapeHtml(adv.nome)} (OAB: ${escapeHtml(adv.oab)})</li>`).join('') +
          `</ul></div>`
        : '';

    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Dados do Processo</h3><div class="preview-card">` +
      `<p><strong>Número do Processo:</strong><span>${escapeHtml(state.processo.numero)}</span></p>` +
      (state.processo.cumulativo ? `<p><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>` : '') +
      advsHtml +
      `</div></div>`;
  }

  // 2. De Cujus
  if (state.falecidos && state.falecidos.length > 0) {
    sectionCounter++;
    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. De Cujus</h3>` +
      state.falecidos
        .map(f => {
          const regimeHtml =
            f.regimeCasamento && f.regimeCasamento !== 'Não se aplica'
              ? `<p><strong>Regime de Casamento:</strong><span>${escapeHtml(f.regimeCasamento)}</span></p>`
              : '';
          return (
            `<div class="preview-card">` +
            `<p><strong>Nome:</strong><span>${escapeHtml(f.nome || 'Não informado')}</span></p>` +
            `<p><strong>Data do Óbito:</strong><span>${formatDatePtBr(f.dataFalecimento)}</span></p>` +
            `<p><strong>Docs. Pessoais (ID):</strong><span>${escapeHtml(f.documentos || 'Não informado')}</span></p>` +
            `<p><strong>Cert. Óbito (ID):</strong><span>${escapeHtml(f.idCertidaoObito || 'Não informado')}</span></p>` +
            regimeHtml +
            `</div>`
          );
        })
        .join('') +
      `</div>`;
  }

  // 3. Inventariante, Herdeiros e Sucessores
  if ((state.inventariante && state.inventariante.nome) || herdeirosValidos.length > 0) {
    sectionCounter++;
    const inv = state.inventariante || {};
    const inventarianteAdvogado = getAdvogadoById(inv.advogadoId, state.processo?.advogados);
    const invHtml = inv.nome
      ? `<div class="preview-card"><h4>Inventariante</h4>` +
        `<p><strong>Nome:</strong><span>${escapeHtml(inv.nome)}</span></p>` +
        `<p><strong>Parentesco:</strong><span>${escapeHtml(inv.parentesco || 'Não informado')}</span></p>` +
        `<p><strong>Docs. Pessoais (ID):</strong><span>${escapeHtml(inv.documentos || 'Não informado')}</span></p>` +
        `<p><strong>Termo de Comp. (ID):</strong><span>${escapeHtml(inv.idTermoCompromisso || 'Não informado')}</span></p>` +
        (inv.idProcuracao
          ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${escapeHtml(inv.idProcuracao)}</span></p></div>`
          : '') +
        (inventarianteAdvogado
          ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${escapeHtml(inventarianteAdvogado.nome)} (OAB: ${escapeHtml(inventarianteAdvogado.oab)})</span></p></div>`
          : '') +
        `</div>`
      : '';

    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Inventariante, Herdeiros e Sucessores</h3>` +
      invHtml +
      generateHeirsHtml(herdeirosValidos, state.processo?.advogados) +
      `</div>`;
  }

  // 4. Renúncia de Direitos
  if (state.renuncia && state.renuncia.houveRenuncia && state.renuncia.renunciantes.length > 0) {
    sectionCounter++;
    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Renúncia de Direitos</h3>` +
      state.renuncia.renunciantes
        .map(r => {
          return (
            `<div class="preview-card">` +
            `<p><strong>Renunciante:</strong><span>${escapeHtml(getHeirNameById(r.herdeiroId, herdeirosValidos))}</span></p>` +
            `<p><strong>Tipo:</strong><span>${escapeHtml(r.tipo)}</span></p>` +
            `<p><strong>Escritura/Termo (ID):</strong><span>${escapeHtml(r.idEscritura || 'Não informado')}</span></p>` +
            `</div>`
          );
        })
        .join('') +
      `</div>`;
  }

  // 5. Cessão de Direitos
  if (state.cessao && state.cessao.houveCessao && state.cessao.cessionarios.length > 0) {
    sectionCounter++;
    const cessionariosHtml = state.cessao.cessionarios
      .map(c => {
        const advogado = getAdvogadoById(c.advogadoId, state.processo?.advogados);
        return (
          `<div class="preview-sub-card">` +
          `<p><strong>Cessionário:</strong><span>${escapeHtml(c.nome || 'Não informado')}</span></p>` +
          `<p><strong>Docs. Pessoais (ID):</strong><span>${escapeHtml(c.documentos || 'Não informado')}</span></p>` +
          (c.idProcuracao
            ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${escapeHtml(c.idProcuracao)}</span></p></div>`
            : '') +
          (advogado
            ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${escapeHtml(advogado.nome)} (OAB: ${escapeHtml(advogado.oab)})</span></p></div>`
            : '') +
          `</div>`
        );
      })
      .join('');

    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Cessão de Direitos</h3>` +
      `<div class="preview-card"><p><strong>Escritura de Cessão (ID):</strong><span>${escapeHtml(state.cessao.idEscritura || 'Não informado')}</span></p>` +
      cessionariosHtml +
      `</div></div>`;
  }

  // 6. Relação de Bens, Direitos e Dívidas
  if (hasBens) {
    sectionCounter++;
    let bensHtml = `<div class="preview-section"><h3>${sectionCounter}. Relação de Bens, Direitos e Dívidas</h3>`;

    const renderAvaliacao = (item) => {
      if (!hasIncapaz) return '';
      if (!item.avaliado) return `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>`;
      return `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${escapeHtml(item.idAvaliacao || 'Pendente')})</span></p>`;
    };

    // Imóveis
    if (state.bens.imoveis && state.bens.imoveis.length > 0) {
      bensHtml +=
        `<h4>Bens Imóveis</h4>` +
        state.bens.imoveis
          .map(item => {
            const urbanoHtml =
              item.tipo === 'Urbano' && item.iptu?.determinado
                ? `<p><strong>IPTU:</strong> <span>${item.iptu.id ? 'Juntado (ID: ' + escapeHtml(item.iptu.id) + ')' : 'Pendente'}</span></p>`
                : '';
            const ruralHtml =
              item.tipo === 'Rural'
                ? (item.itr?.determinado ? `<p><strong>ITR:</strong> <span>${item.itr.id ? 'Juntado (ID: ' + escapeHtml(item.itr.id) + ')' : 'Pendente'}</span></p>` : '') +
                  (item.ccir?.determinado ? `<p><strong>CCIR:</strong> <span>${item.ccir.id ? 'Juntado (ID: ' + escapeHtml(item.ccir.id) + ')' : 'Pendente'}</span></p>` : '') +
                  (item.car?.determinado ? `<p><strong>CAR:</strong> <span>${item.car.id ? 'Juntado (ID: ' + escapeHtml(item.car.id) + ')' : 'Pendente'}</span></p>` : '')
                : '';

            return (
              `<div class="preview-card-small">` +
              `<p><strong>Descrição:</strong> <span>${escapeHtml(item.descricao || 'N/A')} (Matrícula: ${escapeHtml(item.matricula || 'N/A')})</span></p>` +
              `<p><strong>ID da Matrícula:</strong> <span>${escapeHtml(item.idMatricula || 'Pendente')}</span></p>` +
              urbanoHtml +
              ruralHtml +
              renderAvaliacao(item) +
              `</div>`
            );
          })
          .join('');
    }

    // Veículos
    if (state.bens.veiculos && state.bens.veiculos.length > 0) {
      bensHtml +=
        `<h4>Veículos</h4>` +
        state.bens.veiculos
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Descrição:</strong> <span>${escapeHtml(item.descricao || 'N/A')}</span></p>` +
              `<p><strong>Placa:</strong> <span>${escapeHtml(item.placa || 'N/A')}</span></p>` +
              `<p><strong>Renavam:</strong> <span>${escapeHtml(item.renavam || 'N/A')}</span></p>` +
              `<p><strong>ID do CRLV:</strong> <span>${escapeHtml(item.idCRLV || 'Pendente')}</span></p>` +
              renderAvaliacao(item) +
              `</div>`
            );
          })
          .join('');
    }

    // Semoventes
    if (state.bens.semoventes && state.bens.semoventes.length > 0) {
      bensHtml +=
        `<h4>Semoventes</h4>` +
        state.bens.semoventes
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Descrição:</strong><span>${escapeHtml(item.descricao || 'N/A')}</span></p>` +
              (item.quantidade ? `<p><strong>Quantidade:</strong><span>${escapeHtml(item.quantidade)}</span></p>` : '') +
              (item.valor ? `<p><strong>Valor (R$):</strong><span>${escapeHtml(item.valor)}</span></p>` : '') +
              `<p><strong>Doc. (ID):</strong><span>${escapeHtml(item.idDocumento || 'Pendente')}</span></p>` +
              renderAvaliacao(item) +
              `</div>`
            );
          })
          .join('');
    }

    // Outros Bens
    if (state.bens.outrosBens && state.bens.outrosBens.length > 0) {
      bensHtml +=
        `<h4>Outros Bens e Direitos</h4>` +
        state.bens.outrosBens
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Descrição:</strong><span>${escapeHtml(item.descricao || 'N/A')}</span></p>` +
              (item.quantidade ? `<p><strong>Quantidade / Quota:</strong><span>${escapeHtml(item.quantidade)}</span></p>` : '') +
              (item.valor ? `<p><strong>Valor (R$):</strong><span>${escapeHtml(item.valor)}</span></p>` : '') +
              `<p><strong>Doc. (ID):</strong><span>${escapeHtml(item.idDocumento || 'Pendente')}</span></p>` +
              renderAvaliacao(item) +
              `</div>`
            );
          })
          .join('');
    }

    // Valores Residuais
    if (state.bens.valoresResiduais && state.bens.valoresResiduais.length > 0) {
      bensHtml +=
        `<h4>Valores Residuais</h4>` +
        state.bens.valoresResiduais
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Tipo:</strong><span>${escapeHtml(item.tipo || 'N/A')}</span></p>` +
              `<p><strong>Instituição:</strong><span>${escapeHtml(item.instituicao || 'N/A')}</span></p>` +
              `<p><strong>Valor (R$):</strong><span>${escapeHtml(item.valor || 'N/A')}</span></p>` +
              `<p><strong>Doc. (ID):</strong><span>${escapeHtml(item.idDocumento || 'Pendente')}</span></p>` +
              `</div>`
            );
          })
          .join('');
    }

    // Dívidas
    if (state.bens.dividas && state.bens.dividas.length > 0) {
      bensHtml +=
        `<h4>Dívidas do Espólio</h4>` +
        state.bens.dividas
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Credor:</strong><span>${escapeHtml(item.credor || 'N/A')}</span></p>` +
              `<p><strong>Tipo:</strong><span>${escapeHtml(item.tipo || 'N/A')}</span></p>` +
              `<p><strong>Valor (R$):</strong><span>${escapeHtml(item.valor || 'N/A')}</span></p>` +
              `<p><strong>Doc. (ID):</strong><span>${escapeHtml(item.idDocumento || 'Pendente')}</span></p>` +
              `</div>`
            );
          })
          .join('');
    }

    // Alvarás
    if (state.bens.houvePedidoAlvara && state.bens.alvaras && state.bens.alvaras.length > 0) {
      bensHtml +=
        `<h4>Alvarás</h4>` +
        state.bens.alvaras
          .map(item => {
            return (
              `<div class="preview-card-small">` +
              `<p><strong>Finalidade:</strong><span>${escapeHtml(item.finalidade || 'N/A')}</span></p>` +
              `<p><strong>Requerimento:</strong><span>${item.idRequerimento ? 'ID: ' + escapeHtml(item.idRequerimento) : 'Não requerido'}</span></p>` +
              (item.idRequerimento ? `<p><strong>Status:</strong><span>${escapeHtml(item.statusDeferimento)}</span></p>` : '') +
              (item.statusDeferimento === 'Deferido' ? `<p><strong>Expedição:</strong><span>${escapeHtml(item.idExpedicao || 'Pendente')}</span></p>` : '') +
              (item.idExpedicao ? `<p><strong>Prestou Contas:</strong><span>${escapeHtml(item.prestouContas)}</span></p>` : '') +
              `</div>`
            );
          })
          .join('');
    }

    bensHtml += `</div>`;
    htmlSections += bensHtml;
  }

  // 7. Documentos Processuais
  sectionCounter++;
  const dp = state.documentosProcessuais || {};
  htmlSections +=
    `<div class="preview-section"><h3>${sectionCounter}. Documentos Processuais</h3><div class="preview-card">` +
    `<p><strong>Primeiras Declarações:</strong> <span>${dp.primeirasDeclaracoes?.status === 'Apresentada' ? 'Apresentada (ID: ' + escapeHtml(dp.primeirasDeclaracoes.id || 'N/A') + ')' : 'Não Apresentada'}</span></p>` +
    (dp.testamentosCensec || [])
      .map(item => {
        const label = item.deixouTestamento ? `Testamento (${escapeHtml(item.nomeFalecido)})` : `Certidão CENSEC (${escapeHtml(item.nomeFalecido)})`;
        return `<p><strong>${label}:</strong><span>${item.id ? 'Apresentado (ID: ' + escapeHtml(item.id) + ')' : 'Pendente'}</span></p>`;
      })
      .join('') +
    `<p><strong>Edital:</strong> <span>${escapeHtml(formatEditalStatus(dp.edital))}</span></p>` +
    `<p><strong>Últimas Declarações:</strong> <span>${dp.ultimasDeclaracoes?.status === 'Apresentada' ? 'Apresentada (ID: ' + escapeHtml(dp.ultimasDeclaracoes.id || 'N/A') + ')' : 'Não Apresentada'}</span></p>` +
    (hasIncapaz
      ? `<p><strong>Manifestação do MP:</strong> <span>${dp.manifestacaoMP?.status === 'Manifestado' ? 'Manifestado (ID: ' + escapeHtml(dp.manifestacaoMP.id || 'N/A') + ')' : 'Pendente'}</span></p>`
      : '') +
    `<p><strong>Sentença:</strong> <span>${dp.sentenca?.status === 'Proferida' ? 'Proferida (ID: ' + escapeHtml(dp.sentenca.id || 'N/A') + ')' : 'Não Proferida'}</span></p>` +
    `<p><strong>Trânsito em Julgado:</strong> <span>${dp.transito?.status === 'Ocorrido' ? 'Ocorrido (ID: ' + escapeHtml(dp.transito.id || 'N/A') + ')' : 'Não Ocorrido'}</span></p>` +
    `</div></div>`;

  // 8. Regularidade Tributária e Custas
  if ((state.documentacaoTributaria && state.documentacaoTributaria.length > 0) || (state.custas && state.custas.situacao)) {
    sectionCounter++;
    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Regularidade Tributária e Custas</h3>` +
      (state.documentacaoTributaria || [])
        .map(trib => {
          let cardHtml = `<div class="preview-card"><h4>Tributos de: <strong>${escapeHtml(trib.nomeFalecido)}</strong></h4>`;
          cardHtml += `<p><strong>Status ITCD:</strong><span>${escapeHtml(trib.statusItcd)}</span></p>`;

          if (
            trib.idItcd ||
            trib.statusItcd === 'Declarado e Pago' ||
            trib.statusItcd === 'Declarado e Parcelado' ||
            trib.statusItcd === 'Declarado e Pendente de Pagamento'
          ) {
            cardHtml += `<p><strong>ID do ITCD:</strong><span>${escapeHtml(trib.idItcd || 'Não informado')}</span></p>`;
          }

          cardHtml += `<p><strong>CND Municipal:</strong><span>${trib.cndMunicipal?.status === 'Juntada' ? 'Juntada (ID: ' + escapeHtml(trib.cndMunicipal.id || 'N/A') + ')' : 'Não Juntada'}</span></p>`;
          cardHtml += `<p><strong>CND Estadual:</strong><span>${trib.cndEstadual?.status === 'Juntada' ? 'Juntada (ID: ' + escapeHtml(trib.cndEstadual.id || 'N/A') + ')' : 'Não Juntada'}</span></p>`;
          cardHtml += `<p><strong>CND Federal:</strong><span>${trib.cndFederal?.status === 'Juntada' ? 'Juntada (ID: ' + escapeHtml(trib.cndFederal.id || 'N/A') + ')' : 'Não Juntada'}</span></p>`;
          cardHtml += `</div>`;
          return cardHtml;
        })
        .join('') +
      (state.custas
        ? `<div class="preview-card"><h4>Custas Processuais</h4><p><strong>Situação:</strong><span>${escapeHtml(formatCustasStatus(state.custas))}</span></p></div>`
        : '') +
      `</div>`;
  }

  // 9. Observações Adicionais
  if (state.observacoes && state.observacoes.length > 0) {
    sectionCounter++;
    htmlSections +=
      `<div class="preview-section"><h3>${sectionCounter}. Observações Adicionais</h3>` +
      state.observacoes
        .map(obs => {
          const relClass = (obs.relevancia || 'media')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return (
            `<div class="preview-card obs-${relClass}">` +
            `<p><strong>${escapeHtml(obs.titulo || 'Observação')}</strong></p>` +
            `<p class="obs-content"><span>${escapeHtml(obs.conteudo)}</span></p>` +
            `</div>`
          );
        })
        .join('') +
      `</div>`;
  }

  const footerTemplate =
    `<div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #777; width: 100%; display: flex; justify-content: space-between; padding: 0 1.5cm; box-sizing: border-box;">` +
    `<span>Este documento foi gerado eletronicamente pelo Sistema CertidãoPRO</span>` +
    `<span>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} - Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>` +
    `</div>`;

  const pendenciesHtml =
    pendencies && pendencies.length > 0
      ? `<div class="preview-section pendencies-section"><h3>PENDÊNCIAS (${pendencies.length})</h3><ul class="pendencies-list">` +
        pendencies.map(p => `<li>${escapeHtml(p)}</li>`).join('') +
        `</ul></div>`
      : '';

  const responsavelNome = state.processo?.responsavel?.nome || '________________________________';
  const responsavelCargo = state.processo?.responsavel?.cargo || 'Cargo do Responsável';
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const numeroProcTitle = (state.processo?.numero || 'NOVO').replace(/[\\/:*?"<>|]/g, '-');

  const inlineFooterMetaHtml = includeInlineFooterMeta
    ? `<div class="web-print-meta"><span>Este documento foi gerado eletronicamente pelo Sistema CertidãoPRO</span><span>Data de Emissão: ${dataEmissao}</span></div>`
    : '';

  const finalHtml =
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Certidao-${escapeHtml(numeroProcTitle)}</title><style>${css}</style></head><body>` +
    `<div id="pdf-container">` +
    `<div class="preview-header">` +
    `<div class="header-text">` +
    `<p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p>` +
    `<p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>` +
    `</div>` +
    `<h1>CERTIDÃO DE REGULARIDADE</h1>` +
    `<h2 class="subtitle">INVENTÁRIO</h2>` +
    `</div>` +
    `<div class="preview-content">` +
    pendenciesHtml +
    htmlSections +
    `</div>` +
    `<div class="main-footer">` +
    `<div class="signature-line">` +
    `<p class="signature-name">${escapeHtml(responsavelNome)}</p>` +
    `<p class="signature-title">${escapeHtml(responsavelCargo)}</p>` +
    `</div>` +
    inlineFooterMetaHtml +
    `</div>` +
    `</div>` +
    `</body></html>`;

  return { finalHtml, footerTemplate };
}
