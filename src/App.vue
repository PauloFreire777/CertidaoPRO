<script>
import AppIcon from './components/AppIcon.vue';
import HeirFormComponent from './components/HeirFormComponent.vue';
import HeirPreviewComponent from './components/HeirPreviewComponent.vue';
import {
  createInitialState,
  createHeirObject,
  createCessionarioObject,
  createFalecido,
  createObservacao,
  createAdvogadoObject,
  createImovel,
  createVeiculo,
  createSemovente,
  createOutroBem,
  createValorResidual,
  createDivida,
  createAlvara
} from './utils/stateHelpers.js';
import {
  buildPdfDocument,
  formatDatePtBr,
  formatEditalStatus,
  formatCustasStatus
} from './utils/pdfGenerator.js';

export default {
  name: 'App',
  components: {
    AppIcon,
    'heir-form-group': HeirFormComponent,
    'heir-preview-group': HeirPreviewComponent
  },

  data() {
    return {
      state: createInitialState(),
      activeTab: 0,
      tabs: [
        'Processo',
        'Falecidos',
        'Inventariante',
        'Herdeiros',
        'Bens',
        'Docs Processuais',
        'Docs Tributários',
        'Observações'
      ],
      isLoading: false,
      showAutosaveIndicator: false,
      autosaveTimer: null,
      autosaveHideTimer: null,
      toast: {
        visible: false,
        message: '',
        type: 'success',
        timer: null
      },
      confirmDialog: {
        visible: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        onConfirm: null
      },
      bensSections: [
        { key: 'imoveis', title: 'Bens Imóveis', singular: 'Imóvel', createFunction: createImovel },
        { key: 'veiculos', title: 'Veículos', singular: 'Veículo', createFunction: createVeiculo },
        { key: 'semoventes', title: 'Semoventes', singular: 'Semovente', createFunction: createSemovente },
        { key: 'outrosBens', title: 'Outros Bens', singular: 'Bem', createFunction: createOutroBem },
        { key: 'valoresResiduais', title: 'Valores Residuais', singular: 'Valor', createFunction: createValorResidual },
        { key: 'dividas', title: 'Dívidas do Espólio', singular: 'Dívida', createFunction: createDivida },
        { key: 'alvaras', title: 'Alvarás', singular: 'Alvará', createFunction: createAlvara }
      ]
    };
  },

  computed: {
    herdeirosValidos() {
      return (this.state.herdeiros || []).filter(h => h.nome && h.nome.trim() !== '');
    },
    hasIncapaz() {
      const checkIncapaz = (heirs) => {
        if (!heirs) return false;
        return heirs.some(h => h.estado === 'Incapaz' || checkIncapaz(h.representantes));
      };
      return checkIncapaz(this.state.herdeiros);
    },
    hasBens() {
      return Object.values(this.state.bens).some(arr => (Array.isArray(arr) ? arr.length > 0 : false));
    },
    pendencies() {
      return this.calculatePendencies();
    },
    sectionNumbers() {
      let counter = 0;
      const nums = {};
      if (this.state.processo.numero) nums.processo = ++counter;
      if (this.state.falecidos.length > 0) nums.falecidos = ++counter;
      if (this.state.inventariante.nome || this.herdeirosValidos.length > 0) nums.herdeiros = ++counter;
      if (this.state.renuncia.houveRenuncia && this.state.renuncia.renunciantes.length > 0) nums.renuncia = ++counter;
      if (this.state.cessao.houveCessao && this.state.cessao.cessionarios.length > 0) nums.cessao = ++counter;
      if (this.hasBens) nums.bens = ++counter;
      nums.docsProcessuais = ++counter;
      if (this.state.documentacaoTributaria.length > 0 || (this.state.custas && this.state.custas.situacao)) {
        nums.tributaria = ++counter;
      }
      if (this.state.observacoes.length > 0) nums.observacoes = ++counter;
      return nums;
    }
  },

  watch: {
    state: {
      handler(newState) {
        this.scheduleAutosave(newState);
      },
      deep: true
    },
    'state.falecidos': {
      handler(newFalecidos) {
        const newTributos = newFalecidos.map(f => {
          const existing = this.state.documentacaoTributaria.find(t => t.falecidoId === f.id);
          if (existing) {
            existing.nomeFalecido = f.nome;
            return existing;
          }
          return {
            falecidoId: f.id,
            nomeFalecido: f.nome,
            statusItcd: 'Não Declarado',
            idItcd: '',
            cndMunicipal: { status: 'Não Juntada', id: '' },
            cndEstadual: { status: 'Não Juntada', id: '' },
            cndFederal: { status: 'Não Juntada', id: '' }
          };
        });
        this.state.documentacaoTributaria = newTributos.filter(t => newFalecidos.some(f => f.id === t.falecidoId));

        const newTestamentos = newFalecidos.map(f => {
          const existing = this.state.documentosProcessuais.testamentosCensec.find(t => t.falecidoId === f.id);
          if (existing) {
            existing.nomeFalecido = f.nome;
            existing.deixouTestamento = f.deixouTestamento;
            return existing;
          }
          return {
            falecidoId: f.id,
            nomeFalecido: f.nome,
            deixouTestamento: f.deixouTestamento,
            id: ''
          };
        });
        this.state.documentosProcessuais.testamentosCensec = newTestamentos.filter(t =>
          newFalecidos.some(f => f.id === t.falecidoId)
        );
      },
      deep: true,
      immediate: true
    },
    hasIncapaz(newVal) {
      if (this.state.documentosProcessuais && this.state.documentosProcessuais.manifestacaoMP) {
        this.state.documentosProcessuais.manifestacaoMP.necessaria = newVal;
      }
    }
  },

  methods: {
    showToast(message, type = 'success', duration = 4000) {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast.message = message;
      this.toast.type = type;
      this.toast.visible = true;
      this.toast.timer = setTimeout(() => {
        this.toast.visible = false;
      }, duration);
    },

    closeToast() {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast.visible = false;
    },

    openConfirmDialog({ title, message, confirmText = 'Confirmar', onConfirm }) {
      this.confirmDialog = {
        visible: true,
        title,
        message,
        confirmText,
        onConfirm
      };
    },

    handleConfirmDialogYes() {
      const callback = this.confirmDialog.onConfirm;
      this.confirmDialog.visible = false;
      if (typeof callback === 'function') {
        callback();
      }
    },

    handleConfirmDialogCancel() {
      this.confirmDialog.visible = false;
    },

    scheduleAutosave(stateToSave) {
      if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => {
        this.saveStateToLocalStorage(stateToSave || this.state);
        this.showAutosaveIndicator = true;
        if (this.autosaveHideTimer) clearTimeout(this.autosaveHideTimer);
        this.autosaveHideTimer = setTimeout(() => {
          this.showAutosaveIndicator = false;
        }, 1800);
      }, 350);
    },

    calculatePendencies() {
      const items = [];
      const {
        falecidos,
        inventariante,
        herdeiros,
        documentacaoTributaria,
        bens,
        documentosProcessuais,
        cessao,
        renuncia,
        custas
      } = this.state;

      falecidos.forEach(f => {
        if (f.nome && !f.documentos) items.push(`Documentos pessoais de ${f.nome} não juntados.`);
        if (f.nome && !f.idCertidaoObito) items.push(`Certidão de óbito de ${f.nome} não juntada.`);
      });

      if (inventariante.nome) {
        if (!inventariante.documentos) items.push('Documentos pessoais do Inventariante não juntados.');
        if (!inventariante.idProcuracao) items.push('Procuração do Inventariante não juntada.');
        if (!inventariante.idTermoCompromisso) items.push('Termo de Compromisso do Inventariante não juntado.');
      }

      const checkHerdeiro = (heir, path) => {
        if (!heir.nome || heir.nome.trim() === '') return;
        if (!heir.documentos) items.push(`Documentos pessoais de ${path} não juntados.`);
        if (heir.estado === 'Capaz' && !heir.idProcuracao) items.push(`Procuração de ${path} não juntada.`);
        if (heir.estado === 'Incapaz') {
          if (!heir.curador.idTermo) items.push(`Termo de Compromisso do Curador de ${path} não juntado.`);
          if (!heir.curador.idProcuracao) items.push(`Procuração do Curador de ${path} não juntada.`);
        }
        if (heir.estado === 'Falecido') {
          if (!heir.idCertidaoObito) items.push(`Certidão de Óbito de ${path} não juntada.`);
          if (
            (heir.itcdStatus === 'Declarado e Pago' ||
              heir.itcdStatus === 'Declarado e Parcelado' ||
              heir.itcdStatus === 'Declarado e Pendente de Pagamento') &&
            (!heir.idItcd || heir.idItcd.trim() === '')
          ) {
            items.push(`ID do ITCD para ${path} não informado (Status: ${heir.itcdStatus}).`);
          }
        }

        if (heir.estadoCivil === 'Casado(a)' || heir.estadoCivil === 'União Estável') {
          if (!heir.idCertidaoCasamento) items.push(`Certidão de Casamento de ${path} não juntada.`);
          if (heir.conjuge && !heir.conjuge.documentos) {
            items.push(`Documentos pessoais do cônjuge de ${path} não juntados.`);
          }
          if (heir.conjuge && !heir.conjuge.idProcuracao) {
            items.push(`Procuração do cônjuge de ${path} não juntada.`);
          }
        }

        if (heir.representantes && heir.representantes.length > 0) {
          heir.representantes.forEach((rep, i) =>
            checkHerdeiro(rep, `${path} -> Representante ${i + 1} (${rep.nome || 'sem nome'})`)
          );
        }
      };

      herdeiros.forEach((h, i) => checkHerdeiro(h, `Herdeiro ${i + 1} (${h.nome || 'sem nome'})`));

      if (cessao.houveCessao) {
        if (!cessao.idEscritura) items.push('Escritura de Cessão de Direitos não juntada.');
        cessionarios: cessao.cessionarios.forEach((c, i) => {
          if (!c.documentos) items.push(`Documentos pessoais do Cessionário ${c.nome || i + 1} não juntados.`);
          if (!c.idProcuracao) items.push(`Procuração do Cessionário ${c.nome || i + 1} não juntada.`);
        });
      }

      if (renuncia.houveRenuncia) {
        if (renuncia.renunciantes.length === 0) {
          items.push('Houve renúncia marcada, mas nenhum herdeiro renunciante foi selecionado.');
        } else if (renuncia.renunciantes.some(r => !r.idEscritura)) {
          items.push('Escritura/Termo de Renúncia não juntado para um ou mais renunciantes.');
        }
      }

      const tiposAvaliaveis = [
        { key: 'imoveis', label: 'Imóvel' },
        { key: 'veiculos', label: 'Veículo' },
        { key: 'semoventes', label: 'Semovente' },
        { key: 'outrosBens', label: 'Outro Bem' }
      ];

      tiposAvaliaveis.forEach(({ key, label }) => {
        (bens[key] || []).forEach((bem, i) => {
          const nome = bem.descricao || `${label} ${i + 1}`;
          if (this.hasIncapaz && !bem.avaliado) {
            items.push(`Avaliação judicial de "${nome}" pendente.`);
          }
          if (this.hasIncapaz && bem.avaliado && !bem.idAvaliacao) {
            items.push(`ID da Avaliação Judicial de "${nome}" pendente (marcado como avaliado).`);
          }
        });
      });

      bens.imoveis.forEach((bem, i) => {
        const nome = bem.descricao || `Imóvel ${i + 1}`;
        if (!bem.idMatricula) items.push(`Matrícula de "${nome}" não juntada.`);
        if (bem.tipo === 'Urbano' && bem.iptu.determinado && !bem.iptu.id) {
          items.push(`IPTU de "${nome}" não juntado.`);
        }
        if (bem.tipo === 'Rural') {
          if (bem.itr.determinado && !bem.itr.id) items.push(`ITR de "${nome}" não juntado.`);
          if (bem.ccir.determinado && !bem.ccir.id) items.push(`CCIR de "${nome}" não juntado.`);
          if (bem.car.determinado && !bem.car.id) items.push(`CAR de "${nome}" não juntado.`);
        }
      });

      bens.veiculos.forEach((bem, i) => {
        const nome = bem.descricao || `Veículo ${i + 1}`;
        if (!bem.idCRLV) items.push(`CRLV de "${nome}" não juntado.`);
      });

      bens.semoventes.forEach((bem, i) => {
        const nome = bem.descricao || `Semovente ${i + 1}`;
        if (!bem.idDocumento) items.push(`Documento de "${nome}" não juntado.`);
      });

      (bens.outrosBens || []).forEach((bem, i) => {
        const nome = bem.descricao || `Outro Bem ${i + 1}`;
        if (!bem.idDocumento) items.push(`Documento comprobatório de "${nome}" não juntado.`);
      });

      bens.valoresResiduais.forEach((bem, i) => {
        const nome = bem.tipo || `Valor Residual ${i + 1}`;
        if (!bem.idDocumento) items.push(`Documento comprobatório de ${nome} não juntado.`);
      });

      bens.dividas.forEach((bem, i) => {
        const nome = bem.credor || `Dívida ${i + 1}`;
        if (!bem.idDocumento) items.push(`Documento comprobatório da dívida com ${nome} não juntado.`);
      });

      if (bens.houvePedidoAlvara) {
        if (bens.alvaras.length === 0) {
          items.push('Nenhum detalhe de alvará foi adicionado, embora o pedido tenha sido marcado.');
        }
        bens.alvaras.forEach((alvara, i) => {
          const nome = alvara.finalidade || `Alvará ${i + 1}`;
          if (alvara.statusDeferimento === 'Pendente') items.push(`Análise do pedido de alvará para "${nome}" pendente.`);
          if (alvara.statusDeferimento === 'Deferido' && !alvara.idExpedicao) {
            items.push(`Alvará para "${nome}" deferido, mas expedição pendente.`);
          }
          if (alvara.idExpedicao && alvara.prestouContas === 'Pendente') {
            items.push(`Prestação de contas do alvará para "${nome}" pendente.`);
          }
        });
      }

      if (documentosProcessuais.primeirasDeclaracoes.status === 'Não Apresentada') {
        items.push('Primeiras Declarações não apresentadas.');
      }
      if (documentosProcessuais.ultimasDeclaracoes.status === 'Não Apresentada') {
        items.push('Últimas Declarações não apresentadas.');
      }
      if (documentosProcessuais.edital.determinado === 'Sim' && documentosProcessuais.edital.status === 'Não Expedido') {
        items.push('Expedição do Edital determinada, mas pendente.');
      }
      if (documentosProcessuais.edital.status === 'Expedido' && documentosProcessuais.edital.prazoDecorrido === 'Não') {
        items.push('Decurso de prazo do Edital pendente de certificação.');
      }
      if (this.hasIncapaz && documentosProcessuais.manifestacaoMP.status === 'Não Manifestado') {
        items.push('Manifestação do Ministério Público pendente.');
      }
      documentosProcessuais.testamentosCensec.forEach(item => {
        if (!item.id) {
          const docType = item.deixouTestamento ? 'Testamento' : 'Certidão CENSEC';
          items.push(`${docType} de ${item.nomeFalecido || 'falecido sem nome'} não juntada.`);
        }
      });
      if (documentosProcessuais.sentenca.status === 'Não Proferida') {
        items.push('Sentença homologatória pendente de ser proferida.');
      }
      if (documentosProcessuais.sentenca.status === 'Proferida' && documentosProcessuais.transito.status === 'Não Ocorrido') {
        items.push('Trânsito em julgado da sentença pendente de certificação.');
      }

      documentacaoTributaria.forEach(trib => {
        if (trib.statusItcd === 'Não Declarado') {
          items.push(`ITCD referente a ${trib.nomeFalecido} não declarado.`);
        } else if (
          (trib.statusItcd === 'Declarado e Pago' ||
            trib.statusItcd === 'Declarado e Parcelado' ||
            trib.statusItcd === 'Declarado e Pendente de Pagamento') &&
          (!trib.idItcd || trib.idItcd.trim() === '')
        ) {
          items.push(`ID do ITCD de ${trib.nomeFalecido} não informado (Status: ${trib.statusItcd}).`);
        }

        if (trib.cndMunicipal.status === 'Não Juntada') items.push(`CND Municipal de ${trib.nomeFalecido} não juntada.`);
        if (trib.cndEstadual.status === 'Não Juntada') items.push(`CND Estadual de ${trib.nomeFalecido} não juntada.`);
        if (trib.cndFederal.status === 'Não Juntada') items.push(`CND Federal de ${trib.nomeFalecido} não juntada.`);
      });

      if (custas.situacao === 'Devidas') {
        if (custas.calculada === 'Não') items.push('Cálculo das custas processuais pendente.');
        if (custas.paga === 'Não') items.push('Pagamento das custas processuais pendente.');
      }

      return [...new Set(items)];
    },

    async copyPendenciesToClipboard() {
      if (this.pendencies.length === 0) return;
      const numProc = this.state.processo.numero ? ` (Processo nº ${this.state.processo.numero})` : '';
      const text =
        `PENDÊNCIAS DO INVENTÁRIO${numProc}:\n` +
        this.pendencies.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        this.showToast('Lista de pendências copiada para a área de transferência!', 'success');
      } catch (e) {
        this.showToast('Não foi possível copiar automaticamente.', 'error');
      }
    },

    nextTab() {
      if (this.activeTab < this.tabs.length - 1) this.activeTab++;
    },
    prevTab() {
      if (this.activeTab > 0) this.activeTab--;
    },
    addFalecido() {
      this.state.falecidos.push(createFalecido());
    },
    removeFalecido(index) {
      this.state.falecidos.splice(index, 1);
    },
    addAdvogado() {
      this.state.processo.advogados.push(createAdvogadoObject());
    },
    removeAdvogado(index) {
      this.state.processo.advogados.splice(index, 1);
    },
    getAdvogadoNome(advogadoId) {
      if (!advogadoId) return 'Não selecionado';
      const advogado = this.state.processo.advogados.find(a => a.id === advogadoId);
      return advogado ? `${advogado.nome} (OAB: ${advogado.oab})` : 'Advogado não encontrado';
    },
    addHerdeiro() {
      this.state.herdeiros.push(createHeirObject());
    },
    removeHerdeiro(index) {
      this.state.herdeiros.splice(index, 1);
    },
    addCessionario() {
      this.state.cessao.cessionarios.push(createCessionarioObject());
    },
    removeCessionario(index) {
      this.state.cessao.cessionarios.splice(index, 1);
    },
    addBem(sectionKey) {
      const section = this.bensSections.find(s => s.key === sectionKey);
      if (section && section.createFunction) {
        if (!Array.isArray(this.state.bens[sectionKey])) {
          this.state.bens[sectionKey] = [];
        }
        this.state.bens[sectionKey].push(section.createFunction());
      }
    },
    removeBem(sectionKey, index) {
      this.state.bens[sectionKey].splice(index, 1);
    },
    addObservacao() {
      this.state.observacoes.push(createObservacao());
    },
    removeObservacao(index) {
      this.state.observacoes.splice(index, 1);
    },
    isRenunciante(heirId) {
      return this.state.renuncia.renunciantes.some(r => r.herdeiroId === heirId);
    },
    getRenuncia(heirId) {
      return this.state.renuncia.renunciantes.find(r => r.herdeiroId === heirId);
    },
    toggleRenunciante(heirId) {
      const index = this.state.renuncia.renunciantes.findIndex(r => r.herdeiroId === heirId);
      if (index > -1) {
        this.state.renuncia.renunciantes.splice(index, 1);
      } else {
        this.state.renuncia.renunciantes.push({ herdeiroId: heirId, tipo: 'Abdicativa', idEscritura: '' });
      }
    },
    getHeirNameById(id) {
      const findHeir = (heirs) => {
        for (const heir of heirs) {
          if (heir.id === id) return heir.nome;
          if (heir.representantes) {
            const found = findHeir(heir.representantes);
            if (found) return found;
          }
        }
        return null;
      };
      return findHeir(this.state.herdeiros) || 'Herdeiro não encontrado';
    },
    saveStateToLocalStorage(state) {
      try {
        localStorage.setItem('certidaoInventarioState', JSON.stringify(state));
      } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
      }
    },
    loadStateFromLocalStorage() {
      const savedState = localStorage.getItem('certidaoInventarioState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          this.state = this.hydrateState(parsedState);
        } catch (e) {
          console.error('Erro ao carregar estado do localStorage:', e);
          this.state = createInitialState();
        }
      } else {
        this.state = createInitialState();
      }
    },
    hydrateState(loadedState) {
      const freshState = createInitialState();
      if (!freshState.processo.advogados) {
        freshState.processo.advogados = [];
      }
      const merge = (target, source) => {
        for (const key in target) {
          if (source && typeof source[key] !== 'undefined') {
            if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
              target[key] = merge(target[key], source[key]);
            } else {
              target[key] = source[key];
            }
          }
        }
        for (const key in source) {
          if (typeof target[key] === 'undefined') {
            target[key] = source[key];
          }
        }
        return target;
      };
      return merge(freshState, loadedState);
    },
    resetForm() {
      this.openConfirmDialog({
        title: 'Nova Certidão',
        message: 'Tem certeza que deseja limpar todos os campos e iniciar uma nova certidão?',
        confirmText: 'Sim, limpar tudo',
        onConfirm: () => {
          localStorage.removeItem('certidaoInventarioState');
          this.state = createInitialState();
          this.activeTab = 0;
          this.showToast('Campos limpos. Nova certidão iniciada.', 'info');
        }
      });
    },
    exportState() {
      const stateJson = JSON.stringify(this.state, null, 2);
      const blob = new Blob([stateJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNum = (this.state.processo.numero || 'NOVO').replace(/[\\/:*?"<>|]/g, '-');
      a.download = `Certidao_Regularidade-${safeNum}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Arquivo JSON exportado com sucesso!', 'success');
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    importState(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedState = JSON.parse(e.target.result);
          if (importedState.processo && importedState.herdeiros) {
            this.state = this.hydrateState(importedState);
            this.activeTab = 0;
            this.showToast('Certidão carregada com sucesso!', 'success');
          } else {
            throw new Error('Arquivo JSON inválido ou não corresponde à estrutura esperada.');
          }
        } catch (error) {
          console.error('Erro ao importar arquivo:', error);
          this.showToast(`Erro ao carregar o arquivo: ${error.message}`, 'error', 6000);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    formatDate(d) {
      return formatDatePtBr(d);
    },
    getEditalStatus() {
      return formatEditalStatus(this.state.documentosProcessuais.edital);
    },
    getCustasStatus() {
      return formatCustasStatus(this.state.custas);
    },
    normalizeObsClass(relevancia) {
      return (relevancia || 'media')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    },
    async generatePdf() {
      if (this.isLoading) return;
      this.isLoading = true;
      const pendencies = this.pendencies;

      if (window.electronAPI) {
        try {
          const plainState = JSON.parse(JSON.stringify(this.state));
          const { finalHtml, footerTemplate } = buildPdfDocument(plainState, pendencies);

          const result = await window.electronAPI.generatePdf({
            state: plainState,
            pendencies: pendencies,
            html: finalHtml,
            footerTemplate: footerTemplate
          });
          if (result.success) {
            this.showToast(`PDF salvo com sucesso em: ${result.filePath}`, 'success', 5000);
          } else if (result.message !== 'Operação cancelada pelo usuário.') {
            this.showToast(`Não foi possível gerar o PDF: ${result.message}`, 'error', 6000);
          }
        } catch (error) {
          console.error('Erro ao comunicar com o processo Electron:', error);
          this.showToast(`Ocorreu um erro inesperado: ${error.message}`, 'error', 6000);
        } finally {
          this.isLoading = false;
        }
      } else {
        // Modo Web / GitHub Pages (100% Client-Side, sem enviar dados a servidores externos)
        try {
          const plainState = JSON.parse(JSON.stringify(this.state));
          const { finalHtml } = buildPdfDocument(plainState, pendencies, { includeInlineFooterMeta: true });
          const safeNum = (this.state.processo.numero || 'NOVO').replace(/[\\/:*?"<>|]/g, '-');
          const previousTitle = document.title;
          document.title = `Certidao-${safeNum}`;

          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);

          const iframeDoc = iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(finalHtml);
          iframeDoc.close();

          await new Promise(resolve => setTimeout(resolve, 150));
          this.isLoading = false;

          iframe.contentWindow.focus();
          iframe.contentWindow.print();

          setTimeout(() => {
            document.title = previousTitle;
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 2000);
        } catch (error) {
          console.error('Erro ao preparar impressão/PDF no navegador:', error);
          this.showToast(`Não foi possível gerar o PDF: ${error.message}`, 'error', 6000);
          this.isLoading = false;
        }
      }
    },
    handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.exportState();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.generatePdf();
      }
    }
  },

  mounted() {
    this.loadStateFromLocalStorage();
    window.addEventListener('keydown', this.handleKeydown);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown);
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    if (this.autosaveHideTimer) clearTimeout(this.autosaveHideTimer);
    if (this.toast.timer) clearTimeout(this.toast.timer);
  }
};
</script>

<template>
  <div class="app-container" :class="{ loading: isLoading }">
    <!-- Notificação Toast (Não bloqueia foco do teclado no Electron) -->
    <transition name="toast-fade">
      <div v-if="toast.visible" class="toast-notification" :class="`toast-${toast.type}`" @click="closeToast">
        <AppIcon
          :name="toast.type === 'error' ? 'alert-triangle' : toast.type === 'info' ? 'info' : 'check-circle'"
          :size="18"
        />
        <span>{{ toast.message }}</span>
        <button type="button" class="toast-close" title="Fechar">×</button>
      </div>
    </transition>

    <!-- Modal de Confirmação Customizado (Substitui window.confirm nativo que trava o Electron) -->
    <div v-if="confirmDialog.visible" class="modal-backdrop" @click.self="handleConfirmDialogCancel">
      <div class="modal-dialog" role="dialog" aria-modal="true">
        <div class="modal-header">
          <AppIcon name="alert-triangle" :size="22" class="modal-warning-icon" />
          <h3>{{ confirmDialog.title }}</h3>
        </div>
        <p class="modal-body">{{ confirmDialog.message }}</p>
        <div class="modal-actions">
          <button type="button" @click="handleConfirmDialogCancel" class="btn-secondary">Cancelar</button>
          <button type="button" @click="handleConfirmDialogYes" class="btn-danger">
            {{ confirmDialog.confirmText }}
          </button>
        </div>
      </div>
    </div>

    <header class="main-header">
      <div class="logo">
        <div class="logo-graphic">
          <span class="logo-text-main">Certidão</span><span class="logo-text-pro">PRO</span>
        </div>
        <p class="comarca-text">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
      </div>
      <div class="toolbar">
        <span class="autosave-indicator" :class="{ visible: showAutosaveIndicator }">
          <AppIcon name="check" :size="14" /> Salvo
        </span>
        <button type="button" @click="resetForm" class="btn-tertiary" title="Nova Certidão">
          <AppIcon name="file-plus-2" /> Nova
        </button>
        <button type="button" @click="exportState" class="btn-secondary" title="Salvar Certidão como JSON (Ctrl+S)">
          <AppIcon name="save" /> Salvar
        </button>
        <button
          type="button"
          @click="triggerFileInput"
          class="btn-secondary"
          title="Carregar Certidão de um arquivo JSON"
        >
          <AppIcon name="folder-open" /> Carregar
        </button>
        <input type="file" ref="fileInput" @change="importState" accept=".json" style="display: none" />
        <button type="button" @click="generatePdf" class="btn-primary" title="Gerar PDF Final (Ctrl+P)">
          <AppIcon name="printer" /> Gerar PDF
        </button>
      </div>
    </header>

    <main class="main-content">
      <div class="form-panel">
        <div class="tabs-container">
          <div class="tabs-nav">
            <button
              type="button"
              v-for="(tab, index) in tabs"
              :key="index"
              @click="activeTab = index"
              :class="{ active: activeTab === index }"
            >
              <span class="tab-number">{{ index + 1 }}</span> {{ tab }}
            </button>
          </div>

          <div class="tabs-content">
            <!-- ABA 1: DADOS DO PROCESSO -->
            <div v-show="activeTab === 0" class="tab-pane">
              <h2>1. Dados do Processo</h2>
              <div class="form-group">
                <label>Número do Processo <span class="required">*</span></label>
                <input type="text" v-model="state.processo.numero" placeholder="xxxxxxx-xx.xxxx.x.xx.xxxx" />
              </div>
              <div class="form-group checkbox-group">
                <input type="checkbox" id="cumulativo" v-model="state.processo.cumulativo" />
                <label for="cumulativo">Inventário Cumulativo</label>
              </div>

              <fieldset>
                <legend>Advogados do Processo</legend>
                <div v-for="(advogado, index) in state.processo.advogados" :key="advogado.id" class="dynamic-card">
                  <button
                    type="button"
                    @click="removeAdvogado(index)"
                    class="btn-remove"
                    title="Remover Advogado"
                  >
                    ×
                  </button>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Nome do Advogado <span class="required">*</span></label>
                      <input type="text" v-model="advogado.nome" placeholder="Nome completo" />
                    </div>
                    <div class="form-group">
                      <label>Número da OAB <span class="required">*</span></label>
                      <input type="text" v-model="advogado.oab" placeholder="Ex: MG 123.456" />
                    </div>
                  </div>
                </div>
                <button type="button" @click="addAdvogado" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Advogado
                </button>
              </fieldset>

              <fieldset>
                <legend>Responsável pela Certidão</legend>
                <div class="form-group">
                  <label>Nome Completo <span class="required">*</span></label>
                  <input type="text" v-model="state.processo.responsavel.nome" placeholder="Nome de quem emite" />
                </div>
                <div class="form-group">
                  <label>Cargo <span class="required">*</span></label>
                  <select v-model="state.processo.responsavel.cargo">
                    <option disabled value="">Selecione o cargo</option>
                    <option>Oficial(a) Judiciário(a)</option>
                    <option>Estagiário(a)</option>
                    <option>Assistente Administrativo(a)</option>
                  </select>
                </div>
              </fieldset>
            </div>

            <!-- ABA 2: FALECIDOS -->
            <div v-show="activeTab === 1" class="tab-pane">
              <h2>2. Dados dos Falecidos</h2>
              <div v-for="(falecido, index) in state.falecidos" :key="falecido.id" class="dynamic-card">
                <h4 class="card-title">Falecido(a) {{ index + 1 }}</h4>
                <button type="button" @click="removeFalecido(index)" class="btn-remove" title="Remover Falecido">
                  ×
                </button>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Nome Completo <span class="required">*</span></label>
                    <input type="text" v-model="falecido.nome" placeholder="Nome do de cujus" />
                  </div>
                  <div class="form-group">
                    <label>Data do Falecimento <span class="required">*</span></label>
                    <input type="date" v-model="falecido.dataFalecimento" />
                  </div>
                </div>
                <div class="form-group">
                  <label>ID dos Documentos Pessoais</label>
                  <input type="text" v-model="falecido.documentos" placeholder="ID do documento (CPF/RG)" />
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>ID da Certidão de Óbito <span class="required">*</span></label>
                    <input type="text" v-model="falecido.idCertidaoObito" placeholder="ID do documento no sistema" />
                  </div>
                  <div class="form-group">
                    <label>Regime de Casamento</label>
                    <select v-model="falecido.regimeCasamento">
                      <option>Não se aplica</option>
                      <option>Comunhão Parcial de Bens</option>
                      <option>Comunhão Universal de Bens</option>
                      <option>Separação Total de Bens</option>
                      <option>Participação Final nos Aquestos</option>
                    </select>
                  </div>
                </div>
                <div class="form-group checkbox-group">
                  <input type="checkbox" :id="'testamento_' + falecido.id" v-model="falecido.deixouTestamento" />
                  <label :for="'testamento_' + falecido.id">Deixou testamento?</label>
                </div>
              </div>
              <button type="button" @click="addFalecido" class="btn-add">
                <AppIcon name="plus" :size="18" /> Adicionar Falecido
              </button>
            </div>

            <!-- ABA 3: INVENTARIANTE -->
            <div v-show="activeTab === 2" class="tab-pane">
              <h2>3. Inventariante</h2>
              <div class="dynamic-card">
                <div class="form-group">
                  <label>Nome Completo <span class="required">*</span></label>
                  <input type="text" v-model="state.inventariante.nome" />
                </div>
                <div class="form-group">
                  <label>Parentesco <span class="required">*</span></label>
                  <input type="text" v-model="state.inventariante.parentesco" placeholder="Ex: Cônjuge, Filho(a)" />
                </div>
                <div class="form-group">
                  <label>ID dos Documentos Pessoais <span class="required">*</span></label>
                  <input type="text" v-model="state.inventariante.documentos" placeholder="ID do documento (CPF/RG)" />
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>ID da Procuração</label>
                    <input type="text" v-model="state.inventariante.idProcuracao" placeholder="ID do documento" />
                  </div>
                  <div class="form-group">
                    <label>ID do Termo de Compromisso <span class="required">*</span></label>
                    <input type="text" v-model="state.inventariante.idTermoCompromisso" placeholder="ID do documento" />
                  </div>
                </div>
                <div class="form-group" v-if="state.processo.advogados.length > 0">
                  <label>Advogado Representante</label>
                  <select v-model="state.inventariante.advogadoId">
                    <option value="">Selecione um advogado</option>
                    <option v-for="adv in state.processo.advogados" :key="adv.id" :value="adv.id">
                      {{ adv.nome }} - OAB: {{ adv.oab }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- ABA 4: HERDEIROS E SUCESSORES -->
            <div v-show="activeTab === 3" class="tab-pane">
              <h2>4. Herdeiros e Sucessores</h2>
              <heir-form-group
                v-for="(herdeiro, hIndex) in state.herdeiros"
                :key="herdeiro.id"
                :heir="herdeiro"
                :index="hIndex"
                :is-representative="false"
                :advogados="state.processo.advogados"
                @remove="removeHerdeiro(hIndex)"
              />
              <button type="button" @click="addHerdeiro" class="btn-add">
                <AppIcon name="plus" :size="18" /> Adicionar Herdeiro
              </button>
              <hr />
              <fieldset>
                <legend>Renúncia de Direitos Hereditários</legend>
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="houveRenuncia" v-model="state.renuncia.houveRenuncia" />
                  <label for="houveRenuncia">Houve Renúncia de Direitos?</label>
                </div>
                <div v-if="state.renuncia.houveRenuncia" class="conditional-section">
                  <h4>Herdeiros Renunciantes</h4>
                  <div v-if="!herdeirosValidos.length" class="no-items-message">
                    Cadastre pelo menos um herdeiro com nome acima para selecioná-lo como renunciante.
                  </div>
                  <div v-for="heir in herdeirosValidos" :key="heir.id" class="checkbox-group-vertical">
                    <div class="checkbox-line">
                      <input
                        type="checkbox"
                        :id="'renuncia_' + heir.id"
                        :checked="isRenunciante(heir.id)"
                        @change="toggleRenunciante(heir.id)"
                      />
                      <label :for="'renuncia_' + heir.id">{{ heir.nome }}</label>
                    </div>
                    <div v-if="isRenunciante(heir.id)" class="conditional-input">
                      <div class="form-group">
                        <label>Tipo de Renúncia</label>
                        <select v-model="getRenuncia(heir.id).tipo">
                          <option>Abdicativa</option>
                          <option>Translativa</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label>ID da Escritura/Termo de Renúncia</label>
                        <input
                          type="text"
                          v-model="getRenuncia(heir.id).idEscritura"
                          placeholder="ID do documento"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend>Cessão de Direitos Hereditários</legend>
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="houveCessao" v-model="state.cessao.houveCessao" />
                  <label for="houveCessao">Houve Cessão de Direitos?</label>
                </div>
                <div v-if="state.cessao.houveCessao" class="conditional-section">
                  <div class="form-group">
                    <label>ID da Escritura de Cessão</label>
                    <input type="text" v-model="state.cessao.idEscritura" placeholder="ID do documento" />
                  </div>
                  <h4>Cessionários</h4>
                  <div
                    v-for="(cessionario, cIndex) in state.cessao.cessionarios"
                    :key="cessionario.id"
                    class="dynamic-card sub-card"
                  >
                    <button
                      type="button"
                      @click="removeCessionario(cIndex)"
                      class="btn-remove"
                      title="Remover Cessionário"
                    >
                      ×
                    </button>
                    <div class="form-group">
                      <label>Nome do Cessionário</label>
                      <input type="text" v-model="cessionario.nome" />
                    </div>
                    <div class="form-group">
                      <label>ID dos Documentos do Cessionário</label>
                      <input type="text" v-model="cessionario.documentos" />
                    </div>
                    <div class="form-group">
                      <label>ID da Procuração do Cessionário</label>
                      <input type="text" v-model="cessionario.idProcuracao" />
                    </div>
                    <div class="form-group" v-if="state.processo.advogados.length > 0">
                      <label>Advogado do Cessionário</label>
                      <select v-model="cessionario.advogadoId">
                        <option value="">Selecione um advogado</option>
                        <option v-for="adv in state.processo.advogados" :key="adv.id" :value="adv.id">
                          {{ adv.nome }} - OAB: {{ adv.oab }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <button type="button" @click="addCessionario" class="btn-add-small">
                    <AppIcon name="plus" /> Adicionar Cessionário
                  </button>
                </div>
              </fieldset>
            </div>

            <!-- ABA 5: BENS, VALORES E DÍVIDAS -->
            <div v-show="activeTab === 4" class="tab-pane">
              <h2>5. Bens, Valores e Dívidas</h2>

              <!-- BENS IMÓVEIS -->
              <fieldset>
                <legend>Bens Imóveis</legend>
                <div v-if="!state.bens.imoveis.length" class="no-items-message">Nenhum bem imóvel adicionado.</div>
                <div v-for="(item, index) in state.bens.imoveis" :key="item.id" class="dynamic-card">
                  <button type="button" @click="removeBem('imoveis', index)" class="btn-remove" title="Remover Imóvel">
                    ×
                  </button>
                  <div class="form-group">
                    <label>Descrição</label>
                    <input type="text" v-model="item.descricao" placeholder="Ex: Lote 1, Quadra 2..." />
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Matrícula nº</label>
                      <input type="text" v-model="item.matricula" />
                    </div>
                    <div class="form-group">
                      <label>ID da Matrícula <span class="required">*</span></label>
                      <input type="text" v-model="item.idMatricula" placeholder="ID do documento" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Tipo</label>
                    <select v-model="item.tipo">
                      <option>Urbano</option>
                      <option>Rural</option>
                    </select>
                  </div>
                  <div v-if="item.tipo === 'Urbano'" class="conditional-section">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`iptu_determinado_${index}`" v-model="item.iptu.determinado" />
                      <label :for="`iptu_determinado_${index}`">Foi determinada a juntada de IPTU?</label>
                    </div>
                    <div v-if="item.iptu.determinado" class="form-group">
                      <label>ID do IPTU</label>
                      <input type="text" v-model="item.iptu.id" placeholder="ID do documento" />
                    </div>
                  </div>
                  <div v-if="item.tipo === 'Rural'" class="conditional-section">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`itr_determinado_${index}`" v-model="item.itr.determinado" />
                      <label :for="`itr_determinado_${index}`">Foi determinada a juntada de ITR?</label>
                    </div>
                    <div v-if="item.itr.determinado" class="form-group">
                      <label>ID do ITR</label>
                      <input type="text" v-model="item.itr.id" placeholder="ID do documento" />
                    </div>
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`ccir_determinado_${index}`" v-model="item.ccir.determinado" />
                      <label :for="`ccir_determinado_${index}`">Foi determinada a juntada de CCIR?</label>
                    </div>
                    <div v-if="item.ccir.determinado" class="form-group">
                      <label>ID do CCIR</label>
                      <input type="text" v-model="item.ccir.id" placeholder="ID do documento" />
                    </div>
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`car_determinado_${index}`" v-model="item.car.determinado" />
                      <label :for="`car_determinado_${index}`">Foi determinada a juntada de CAR?</label>
                    </div>
                    <div v-if="item.car.determinado" class="form-group">
                      <label>ID do CAR</label>
                      <input type="text" v-model="item.car.id" placeholder="ID do documento" />
                    </div>
                  </div>
                  <div v-if="hasIncapaz" class="conditional-section warning">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`avaliado_imoveis_${index}`" v-model="item.avaliado" />
                      <label :for="`avaliado_imoveis_${index}`">Foi avaliado judicialmente?</label>
                    </div>
                    <div v-if="item.avaliado" class="form-group">
                      <label>ID da Avaliação Judicial <span class="required">*</span></label>
                      <input type="text" v-model="item.idAvaliacao" placeholder="ID do laudo" />
                    </div>
                  </div>
                </div>
                <button type="button" @click="addBem('imoveis')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Imóvel
                </button>
              </fieldset>

              <!-- VEÍCULOS -->
              <fieldset>
                <legend>Veículos</legend>
                <div v-if="!state.bens.veiculos.length" class="no-items-message">Nenhum veículo adicionado.</div>
                <div v-for="(item, index) in state.bens.veiculos" :key="item.id" class="dynamic-card">
                  <button
                    type="button"
                    @click="removeBem('veiculos', index)"
                    class="btn-remove"
                    title="Remover Veículo"
                  >
                    ×
                  </button>
                  <div class="form-group">
                    <label>Descrição</label>
                    <input type="text" v-model="item.descricao" placeholder="Marca, modelo, ano..." />
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Placa</label>
                      <input type="text" v-model="item.placa" />
                    </div>
                    <div class="form-group">
                      <label>Renavam</label>
                      <input type="text" v-model="item.renavam" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>ID do CRLV <span class="required">*</span></label>
                    <input type="text" v-model="item.idCRLV" placeholder="ID do documento" />
                  </div>
                  <div v-if="hasIncapaz" class="conditional-section warning">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`avaliado_veiculos_${index}`" v-model="item.avaliado" />
                      <label :for="`avaliado_veiculos_${index}`">Foi avaliado judicialmente?</label>
                    </div>
                    <div v-if="item.avaliado" class="form-group">
                      <label>ID da Avaliação Judicial <span class="required">*</span></label>
                      <input type="text" v-model="item.idAvaliacao" placeholder="ID do laudo" />
                    </div>
                  </div>
                </div>
                <button type="button" @click="addBem('veiculos')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Veículo
                </button>
              </fieldset>

              <!-- SEMOVENTES -->
              <fieldset>
                <legend>Semoventes</legend>
                <div v-if="!state.bens.semoventes.length" class="no-items-message">Nenhum semovente adicionado.</div>
                <div v-for="(item, index) in state.bens.semoventes" :key="item.id" class="dynamic-card">
                  <button
                    type="button"
                    @click="removeBem('semoventes', index)"
                    class="btn-remove"
                    title="Remover Semovente"
                  >
                    ×
                  </button>
                  <div class="form-group">
                    <label>Descrição</label>
                    <input type="text" v-model="item.descricao" placeholder="Ex: Gado bovino, equinos..." />
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Quantidade</label>
                      <input type="text" v-model="item.quantidade" placeholder="Ex: 15 cabeças" />
                    </div>
                    <div class="form-group">
                      <label>Valor Estimado (R$)</label>
                      <input type="text" v-model="item.valor" placeholder="Ex: 45.000,00" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>ID do Documento Comprobatório <span class="required">*</span></label>
                    <input type="text" v-model="item.idDocumento" placeholder="ID da ficha sanitária, nota, etc." />
                  </div>
                  <div v-if="hasIncapaz" class="conditional-section warning">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`avaliado_semoventes_${index}`" v-model="item.avaliado" />
                      <label :for="`avaliado_semoventes_${index}`">Foi avaliado judicialmente?</label>
                    </div>
                    <div v-if="item.avaliado" class="form-group">
                      <label>ID da Avaliação Judicial <span class="required">*</span></label>
                      <input type="text" v-model="item.idAvaliacao" placeholder="ID do laudo" />
                    </div>
                  </div>
                </div>
                <button type="button" @click="addBem('semoventes')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Semovente
                </button>
              </fieldset>

              <!-- OUTROS BENS E DIREITOS (ABA 5) -->
              <fieldset>
                <legend>Outros Bens e Direitos</legend>
                <div v-if="!state.bens.outrosBens || !state.bens.outrosBens.length" class="no-items-message">
                  Nenhum outro bem adicionado.
                </div>
                <div v-for="(item, index) in state.bens.outrosBens" :key="item.id" class="dynamic-card">
                  <button
                    type="button"
                    @click="removeBem('outrosBens', index)"
                    class="btn-remove"
                    title="Remover Bem"
                  >
                    ×
                  </button>
                  <div class="form-group">
                    <label>Descrição do Bem ou Direito</label>
                    <input
                      type="text"
                      v-model="item.descricao"
                      placeholder="Ex: Quotas societárias, máquinas agrícolas, joias..."
                    />
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Quantidade / Participação</label>
                      <input type="text" v-model="item.quantidade" placeholder="Ex: 50% das quotas, 1 unidade..." />
                    </div>
                    <div class="form-group">
                      <label>Valor Estimado (R$)</label>
                      <input type="text" v-model="item.valor" placeholder="Ex: 20.000,00" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>ID do Documento Comprobatório <span class="required">*</span></label>
                    <input
                      type="text"
                      v-model="item.idDocumento"
                      placeholder="ID do contrato social, nota fiscal, registro, etc."
                    />
                  </div>
                  <div v-if="hasIncapaz" class="conditional-section warning">
                    <div class="form-group checkbox-group">
                      <input type="checkbox" :id="`avaliado_outros_${index}`" v-model="item.avaliado" />
                      <label :for="`avaliado_outros_${index}`">Foi avaliado judicialmente?</label>
                    </div>
                    <div v-if="item.avaliado" class="form-group">
                      <label>ID da Avaliação Judicial <span class="required">*</span></label>
                      <input type="text" v-model="item.idAvaliacao" placeholder="ID do laudo" />
                    </div>
                  </div>
                </div>
                <button type="button" @click="addBem('outrosBens')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Outro Bem
                </button>
              </fieldset>

              <!-- VALORES RESIDUAIS -->
              <fieldset>
                <legend>Valores Residuais</legend>
                <div v-if="!state.bens.valoresResiduais.length" class="no-items-message">
                  Nenhum valor residual adicionado.
                </div>
                <div v-for="(item, index) in state.bens.valoresResiduais" :key="item.id" class="dynamic-card">
                  <button
                    type="button"
                    @click="removeBem('valoresResiduais', index)"
                    class="btn-remove"
                    title="Remover Valor"
                  >
                    ×
                  </button>
                  <div class="form-group">
                    <label>Tipo</label>
                    <select v-model="item.tipo">
                      <option>Conta Bancária</option>
                      <option>FGTS</option>
                      <option>PIS/PASEP</option>
                      <option>Ações</option>
                      <option>Benefício Previdenciário / INSS</option>
                    </select>
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Instituição</label>
                      <input type="text" v-model="item.instituicao" />
                    </div>
                    <div class="form-group">
                      <label>Valor (R$)</label>
                      <input type="text" v-model="item.valor" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>ID do Documento Comprobatório <span class="required">*</span></label>
                    <input type="text" v-model="item.idDocumento" placeholder="ID do extrato, ofício, etc." />
                  </div>
                </div>
                <button type="button" @click="addBem('valoresResiduais')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Valor
                </button>
              </fieldset>

              <!-- DÍVIDAS DO ESPÓLIO -->
              <fieldset>
                <legend>Dívidas do Espólio</legend>
                <div v-if="!state.bens.dividas.length" class="no-items-message">Nenhuma dívida adicionada.</div>
                <div v-for="(item, index) in state.bens.dividas" :key="item.id" class="dynamic-card">
                  <button type="button" @click="removeBem('dividas', index)" class="btn-remove" title="Remover Dívida">
                    ×
                  </button>
                  <div class="form-group">
                    <label>Credor</label>
                    <input type="text" v-model="item.credor" />
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Tipo</label>
                      <select v-model="item.tipo">
                        <option>Tributária</option>
                        <option>Contratual</option>
                        <option>Alimentar</option>
                        <option>Funerária / Hospitalar</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Valor (R$)</label>
                      <input type="text" v-model="item.valor" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>ID do Documento Comprobatório <span class="required">*</span></label>
                    <input type="text" v-model="item.idDocumento" placeholder="ID do contrato, notificação, etc." />
                  </div>
                </div>
                <button type="button" @click="addBem('dividas')" class="btn-add-small">
                  <AppIcon name="plus" /> Adicionar Dívida
                </button>
              </fieldset>

              <!-- ALVARÁS -->
              <fieldset>
                <legend>Alvarás</legend>
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="houvePedidoAlvara" v-model="state.bens.houvePedidoAlvara" />
                  <label for="houvePedidoAlvara">Houve pedido de alvará no processo?</label>
                </div>
                <div v-if="state.bens.houvePedidoAlvara" class="conditional-section">
                  <div v-if="!state.bens.alvaras.length" class="no-items-message">
                    Nenhum detalhe de alvará adicionado.
                  </div>
                  <div v-for="(item, index) in state.bens.alvaras" :key="item.id" class="dynamic-card">
                    <button
                      type="button"
                      @click="removeBem('alvaras', index)"
                      class="btn-remove"
                      title="Remover Alvará"
                    >
                      ×
                    </button>
                    <div class="form-group">
                      <label>Finalidade do Alvará</label>
                      <input
                        type="text"
                        v-model="item.finalidade"
                        placeholder="Ex: Venda de veículo, levantamento de valores"
                      />
                    </div>
                    <div class="form-group">
                      <label>ID do Requerimento</label>
                      <input type="text" v-model="item.idRequerimento" placeholder="ID do pedido de alvará" />
                    </div>
                    <div v-if="item.idRequerimento" class="conditional-section">
                      <div class="form-group">
                        <label>Status do Deferimento</label>
                        <select v-model="item.statusDeferimento">
                          <option>Pendente</option>
                          <option>Deferido</option>
                          <option>Indeferido</option>
                        </select>
                      </div>
                      <div v-if="item.statusDeferimento === 'Deferido'" class="form-group">
                        <label>ID da Expedição do Alvará</label>
                        <input type="text" v-model="item.idExpedicao" placeholder="ID do alvará expedido" />
                      </div>
                      <div v-if="item.idExpedicao" class="form-group">
                        <label>Prestação de Contas</label>
                        <select v-model="item.prestouContas">
                          <option>Não aplicável</option>
                          <option>Pendente</option>
                          <option>Sim</option>
                          <option>Não</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button type="button" @click="addBem('alvaras')" class="btn-add-small">
                    <AppIcon name="plus" /> Adicionar Alvará
                  </button>
                </div>
              </fieldset>
            </div>

            <!-- ABA 6: DOCUMENTOS PROCESSUAIS -->
            <div v-show="activeTab === 5" class="tab-pane">
              <h2>6. Documentos Processuais</h2>
              <div class="docs-process-container">
                <div class="doc-card">
                  <h4><AppIcon name="file-text" /> Primeiras Declarações</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Status</label>
                      <select v-model="state.documentosProcessuais.primeirasDeclaracoes.status">
                        <option>Apresentada</option>
                        <option>Não Apresentada</option>
                      </select>
                    </div>
                    <div
                      v-if="state.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada'"
                      class="form-group"
                    >
                      <label>ID do Documento</label>
                      <input
                        type="text"
                        v-model="state.documentosProcessuais.primeirasDeclaracoes.id"
                        placeholder="ID do documento"
                      />
                    </div>
                  </div>
                </div>

                <div class="doc-card">
                  <h4><AppIcon name="megaphone" /> Edital</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Determinação</label>
                      <select v-model="state.documentosProcessuais.edital.determinado">
                        <option value="Sim">Determinado</option>
                        <option value="Não">Não Determinado</option>
                      </select>
                    </div>
                    <div v-if="state.documentosProcessuais.edital.determinado === 'Sim'">
                      <div class="form-group">
                        <label>Status do Edital</label>
                        <select v-model="state.documentosProcessuais.edital.status">
                          <option>Expedido</option>
                          <option>Não Expedido</option>
                        </select>
                      </div>
                      <div v-if="state.documentosProcessuais.edital.status === 'Expedido'" class="form-group">
                        <label>ID do Edital</label>
                        <input
                          type="text"
                          v-model="state.documentosProcessuais.edital.id"
                          placeholder="ID do Edital"
                        />
                      </div>
                      <div v-if="state.documentosProcessuais.edital.status === 'Expedido'" class="form-group">
                        <label>Decurso de Prazo</label>
                        <select v-model="state.documentosProcessuais.edital.prazoDecorrido">
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                      <div v-if="state.documentosProcessuais.edital.prazoDecorrido === 'Sim'" class="form-group">
                        <label>ID da Certidão de Decurso</label>
                        <input
                          type="text"
                          v-model="state.documentosProcessuais.edital.idDecursoPrazo"
                          placeholder="ID da Certidão"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="doc-card">
                  <h4><AppIcon name="file-check" /> Últimas Declarações</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Status</label>
                      <select v-model="state.documentosProcessuais.ultimasDeclaracoes.status">
                        <option>Apresentada</option>
                        <option>Não Apresentada</option>
                      </select>
                    </div>
                    <div
                      v-if="state.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada'"
                      class="form-group"
                    >
                      <label>ID do Documento</label>
                      <input
                        type="text"
                        v-model="state.documentosProcessuais.ultimasDeclaracoes.id"
                        placeholder="ID do documento"
                      />
                    </div>
                  </div>
                </div>

                <div class="doc-card">
                  <h4><AppIcon name="scroll" /> Testamentos e Certidões CENSEC</h4>
                  <div class="doc-content">
                    <div v-if="!state.falecidos.length" class="placeholder-text">
                      Adicione um falecido na Aba 2 para ver as opções.
                    </div>
                    <div
                      v-for="(item, index) in state.documentosProcessuais.testamentosCensec"
                      :key="item.falecidoId"
                      class="form-group"
                    >
                      <label>
                        <strong>{{ item.nomeFalecido || `Falecido ${index + 1}` }}</strong> -
                        {{ item.deixouTestamento ? 'Testamento' : 'Certidão CENSEC' }}
                      </label>
                      <input
                        type="text"
                        v-model="item.id"
                        :placeholder="item.deixouTestamento ? 'ID do Testamento' : 'ID da Certidão CENSEC'"
                      />
                    </div>
                  </div>
                </div>

                <div v-if="hasIncapaz" class="doc-card">
                  <h4><AppIcon name="scale" /> Manifestação do Ministério Público</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Status <span class="required">*</span></label>
                      <select v-model="state.documentosProcessuais.manifestacaoMP.status">
                        <option>Manifestado</option>
                        <option>Não Manifestado</option>
                      </select>
                    </div>
                    <div
                      v-if="state.documentosProcessuais.manifestacaoMP.status === 'Manifestado'"
                      class="form-group"
                    >
                      <label>ID da Manifestação</label>
                      <input
                        type="text"
                        v-model="state.documentosProcessuais.manifestacaoMP.id"
                        placeholder="ID do documento"
                      />
                    </div>
                  </div>
                </div>

                <div class="doc-card">
                  <h4><AppIcon name="gavel" /> Sentença Homologatória</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Status</label>
                      <select v-model="state.documentosProcessuais.sentenca.status">
                        <option>Proferida</option>
                        <option>Não Proferida</option>
                      </select>
                    </div>
                    <div v-if="state.documentosProcessuais.sentenca.status === 'Proferida'" class="form-group">
                      <label>ID da Sentença</label>
                      <input
                        type="text"
                        v-model="state.documentosProcessuais.sentenca.id"
                        placeholder="ID da Sentença"
                      />
                    </div>
                  </div>
                </div>

                <div class="doc-card">
                  <h4><AppIcon name="check-circle" /> Trânsito em Julgado</h4>
                  <div class="doc-content">
                    <div class="form-group">
                      <label>Status</label>
                      <select v-model="state.documentosProcessuais.transito.status">
                        <option>Ocorrido</option>
                        <option>Não Ocorrido</option>
                      </select>
                    </div>
                    <div v-if="state.documentosProcessuais.transito.status === 'Ocorrido'" class="form-group">
                      <label>ID da Certidão</label>
                      <input
                        type="text"
                        v-model="state.documentosProcessuais.transito.id"
                        placeholder="ID da Certidão"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ABA 7: DOCUMENTAÇÃO TRIBUTÁRIA -->
            <div v-show="activeTab === 6" class="tab-pane">
              <h2>7. Documentação Tributária</h2>
              <div v-if="!state.falecidos.length" class="placeholder-text">
                Adicione um falecido na Aba 2 para ver as opções.
              </div>
              <div v-for="(falecido, index) in state.documentacaoTributaria" :key="index" class="dynamic-card">
                <h4>
                  Tributos de: <strong>{{ falecido.nomeFalecido || `Falecido ${index + 1}` }}</strong>
                </h4>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Status do ITCD <span class="required">*</span></label>
                    <select v-model="falecido.statusItcd">
                      <option>Declarado e Pago</option>
                      <option>Declarado e Parcelado</option>
                      <option>Declarado e Pendente de Pagamento</option>
                      <option>Isento</option>
                      <option>Não Declarado</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>ID do ITCD</label>
                    <input type="text" v-model="falecido.idItcd" placeholder="Nº da declaração ou documento" />
                  </div>
                </div>
                <fieldset>
                  <legend>Certidões Negativas de Débito (CND)</legend>
                  <div class="grid-3">
                    <div class="form-group">
                      <label>CND Municipal</label>
                      <select v-model="falecido.cndMunicipal.status">
                        <option>Juntada</option>
                        <option>Não Juntada</option>
                      </select>
                      <input
                        v-if="falecido.cndMunicipal.status === 'Juntada'"
                        type="text"
                        v-model="falecido.cndMunicipal.id"
                        placeholder="ID/Link"
                        class="conditional-input"
                      />
                    </div>
                    <div class="form-group">
                      <label>CND Estadual</label>
                      <select v-model="falecido.cndEstadual.status">
                        <option>Juntada</option>
                        <option>Não Juntada</option>
                      </select>
                      <input
                        v-if="falecido.cndEstadual.status === 'Juntada'"
                        type="text"
                        v-model="falecido.cndEstadual.id"
                        placeholder="ID/Link"
                        class="conditional-input"
                      />
                    </div>
                    <div class="form-group">
                      <label>CND Federal</label>
                      <select v-model="falecido.cndFederal.status">
                        <option>Juntada</option>
                        <option>Não Juntada</option>
                      </select>
                      <input
                        v-if="falecido.cndFederal.status === 'Juntada'"
                        type="text"
                        v-model="falecido.cndFederal.id"
                        placeholder="ID/Link"
                        class="conditional-input"
                      />
                    </div>
                  </div>
                </fieldset>
              </div>
              <fieldset>
                <legend>Custas Processuais</legend>
                <div class="form-group">
                  <label>Situação das Custas</label>
                  <select v-model="state.custas.situacao">
                    <option>Ao final</option>
                    <option>Isenção</option>
                    <option>Devidas</option>
                  </select>
                </div>
                <div v-if="state.custas.situacao === 'Devidas'" class="conditional-section">
                  <div class="form-group">
                    <label>Cálculo</label>
                    <select v-model="state.custas.calculada">
                      <option value="Sim">Calculada</option>
                      <option value="Não">Não Calculada</option>
                    </select>
                    <input
                      v-if="state.custas.calculada === 'Sim'"
                      type="text"
                      v-model="state.custas.idCalculo"
                      placeholder="ID do Cálculo"
                      class="conditional-input"
                    />
                  </div>
                  <div class="form-group">
                    <label>Pagamento</label>
                    <select v-model="state.custas.paga">
                      <option value="Sim">Pago</option>
                      <option value="Não">Não Pago</option>
                    </select>
                    <input
                      v-if="state.custas.paga === 'Sim'"
                      type="text"
                      v-model="state.custas.idPagamento"
                      placeholder="ID do Comprovante"
                      class="conditional-input"
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            <!-- ABA 8: OBSERVAÇÕES ADICIONAIS -->
            <div v-show="activeTab === 7" class="tab-pane">
              <h2>8. Observações Adicionais</h2>
              <div v-for="(obs, index) in state.observacoes" :key="obs.id" class="dynamic-card">
                <button
                  type="button"
                  @click="removeObservacao(index)"
                  class="btn-remove"
                  title="Remover Observação"
                >
                  ×
                </button>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Título/Assunto</label>
                    <input type="text" v-model="obs.titulo" />
                  </div>
                  <div class="form-group">
                    <label>Relevância</label>
                    <select v-model="obs.relevancia">
                      <option>Baixa</option>
                      <option>Média</option>
                      <option>Alta</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label>Conteúdo <span class="required">*</span></label>
                  <textarea v-model="obs.conteudo" rows="3"></textarea>
                </div>
              </div>
              <button type="button" @click="addObservacao" class="btn-add">
                <AppIcon name="plus" :size="18" /> Adicionar Observação
              </button>
            </div>
          </div>
        </div>

        <div class="tab-navigation">
          <button type="button" v-show="activeTab > 0" @click="prevTab" class="btn-nav">
            <AppIcon name="arrow-left" /> Anterior
          </button>
          <div class="spacer"></div>
          <button type="button" v-show="activeTab < tabs.length - 1" @click="nextTab" class="btn-nav-primary">
            Próximo <AppIcon name="arrow-right" />
          </button>
        </div>
      </div>

      <!-- PAINEL DE PREVIEW EM TEMPO REAL -->
      <div class="preview-panel-container">
        <div class="preview-status-bar">
          <div class="status-badge" :class="pendencies.length === 0 ? 'status-regular' : 'status-pending'">
            <AppIcon :name="pendencies.length === 0 ? 'check-circle' : 'alert-triangle'" :size="16" />
            <span v-if="pendencies.length === 0">Processo Regular — Nenhuma pendência</span>
            <span v-else>{{ pendencies.length }} {{ pendencies.length === 1 ? 'pendência identificada' : 'pendências identificadas' }}</span>
          </div>
          <button
            v-if="pendencies.length > 0"
            type="button"
            @click="copyPendenciesToClipboard"
            class="btn-copy-pendencies"
            title="Copiar lista de pendências para colar no PJe/eproc"
          >
            <AppIcon name="copy" :size="14" /> Copiar Pendências
          </button>
        </div>

        <div id="preview-panel" class="preview-panel">
          <div class="preview-header">
            <div class="header-text">
              <p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p>
              <p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
            </div>
            <h1>CERTIDÃO DE REGULARIDADE</h1>
            <h2 class="subtitle">INVENTÁRIO</h2>
          </div>

          <div class="preview-content" id="preview-content">
            <div class="preview-section pendencies-section" v-if="pendencies.length > 0">
              <h3><AppIcon name="alert-triangle" :size="20" /> PENDÊNCIAS ({{ pendencies.length }})</h3>
              <ul class="pendencies-list">
                <li v-for="(pendency, index) in pendencies" :key="index">{{ pendency }}</li>
              </ul>
            </div>

            <div class="preview-section" v-if="state.processo.numero">
              <h3>{{ sectionNumbers.processo }}. Dados do Processo</h3>
              <div class="preview-card">
                <p><strong>Número do Processo:</strong><span>{{ state.processo.numero }}</span></p>
                <p v-if="state.processo.cumulativo"><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>
                <div v-if="state.processo.advogados.length" class="info-advogado" style="margin-top: 1rem">
                  <p style="margin: 0"><strong>Advogados no Processo:</strong></p>
                  <ul style="list-style: none; padding-left: 10px; margin-top: 5px">
                    <li v-for="adv in state.processo.advogados" :key="adv.id">
                      <span>- {{ adv.nome }} (OAB: {{ adv.oab }})</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="preview-section" v-if="state.falecidos.length">
              <h3>{{ sectionNumbers.falecidos }}. De Cujus</h3>
              <div v-for="f in state.falecidos" :key="f.id" class="preview-card">
                <p><strong>Nome:</strong><span>{{ f.nome || 'Não informado' }}</span></p>
                <p><strong>Data do Falecimento:</strong><span>{{ formatDate(f.dataFalecimento) }}</span></p>
                <p><strong>Docs. Pessoais (ID):</strong><span>{{ f.documentos || 'Não informado' }}</span></p>
                <p><strong>Cert. Óbito (ID):</strong><span>{{ f.idCertidaoObito || 'Não informado' }}</span></p>
                <p v-if="f.regimeCasamento && f.regimeCasamento !== 'Não se aplica'">
                  <strong>Regime de Casamento:</strong><span>{{ f.regimeCasamento }}</span>
                </p>
              </div>
            </div>

            <div class="preview-section" v-if="state.inventariante.nome || herdeirosValidos.length">
              <h3>{{ sectionNumbers.herdeiros }}. Inventariante, Herdeiros e Sucessores</h3>
              <div v-if="state.inventariante.nome" class="preview-card">
                <h4>Inventariante</h4>
                <p><strong>Nome:</strong><span>{{ state.inventariante.nome }}</span></p>
                <p><strong>Parentesco:</strong><span>{{ state.inventariante.parentesco || 'Não informado' }}</span></p>
                <p><strong>Docs. Pessoais (ID):</strong><span>{{ state.inventariante.documentos || 'Não informado' }}</span></p>
                <p><strong>Termo de Comp. (ID):</strong><span>{{ state.inventariante.idTermoCompromisso || 'Não informado' }}</span></p>
                <div v-if="state.inventariante.idProcuracao" class="info-procuracao">
                  <p><strong>Procuração (ID):</strong><span>{{ state.inventariante.idProcuracao }}</span></p>
                </div>
                <div v-if="state.inventariante.advogadoId" class="info-advogado">
                  <p><strong>Advogado(a):</strong><span>{{ getAdvogadoNome(state.inventariante.advogadoId) }}</span></p>
                </div>
              </div>
              <heir-preview-group
                v-if="herdeirosValidos.length"
                :heirs="herdeirosValidos"
                :level="0"
                :advogados="state.processo.advogados"
              />
            </div>

            <div class="preview-section" v-if="state.renuncia.houveRenuncia && state.renuncia.renunciantes.length > 0">
              <h3>{{ sectionNumbers.renuncia }}. Renúncia de Direitos</h3>
              <div v-for="r in state.renuncia.renunciantes" :key="r.herdeiroId" class="preview-card">
                <p><strong>Renunciante:</strong><span>{{ getHeirNameById(r.herdeiroId) }}</span></p>
                <p><strong>Tipo:</strong><span>{{ r.tipo }}</span></p>
                <p><strong>Escritura/Termo (ID):</strong><span>{{ r.idEscritura || 'Não informado' }}</span></p>
              </div>
            </div>

            <div class="preview-section" v-if="state.cessao.houveCessao && state.cessao.cessionarios.length > 0">
              <h3>{{ sectionNumbers.cessao }}. Cessão de Direitos</h3>
              <div class="preview-card">
                <p><strong>Escritura de Cessão (ID):</strong><span>{{ state.cessao.idEscritura || 'Não informado' }}</span></p>
                <div v-for="c in state.cessao.cessionarios" :key="c.id" class="preview-sub-card">
                  <p><strong>Cessionário:</strong><span>{{ c.nome }}</span></p>
                  <p><strong>Docs. Pessoais (ID):</strong><span>{{ c.documentos || 'Não informado' }}</span></p>
                  <div v-if="c.idProcuracao" class="info-procuracao">
                    <p><strong>Procuração (ID):</strong><span>{{ c.idProcuracao }}</span></p>
                  </div>
                  <div v-if="c.advogadoId" class="info-advogado">
                    <p><strong>Advogado(a):</strong><span>{{ getAdvogadoNome(c.advogadoId) }}</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div class="preview-section" v-if="hasBens">
              <h3>{{ sectionNumbers.bens }}. Relação de Bens, Direitos e Dívidas</h3>

              <div v-if="state.bens.imoveis.length">
                <h4>Bens Imóveis</h4>
                <div v-for="item in state.bens.imoveis" :key="item.id" class="preview-card-small">
                  <p>
                    <strong>Descrição:</strong>
                    <span>{{ item.descricao || 'N/A' }} (Matrícula: {{ item.matricula || 'N/A' }})</span>
                  </p>
                  <p><strong>ID da Matrícula:</strong> <span>{{ item.idMatricula || 'Pendente' }}</span></p>
                  <p v-if="item.tipo === 'Urbano' && item.iptu.determinado">
                    <strong>IPTU:</strong>
                    <span>{{ item.iptu.id ? `Juntado (ID: ${item.iptu.id})` : 'Pendente' }}</span>
                  </p>
                  <div v-if="item.tipo === 'Rural'">
                    <p v-if="item.itr.determinado">
                      <strong>ITR:</strong>
                      <span>{{ item.itr.id ? `Juntado (ID: ${item.itr.id})` : 'Pendente' }}</span>
                    </p>
                    <p v-if="item.ccir.determinado">
                      <strong>CCIR:</strong>
                      <span>{{ item.ccir.id ? `Juntado (ID: ${item.ccir.id})` : 'Pendente' }}</span>
                    </p>
                    <p v-if="item.car.determinado">
                      <strong>CAR:</strong>
                      <span>{{ item.car.id ? `Juntado (ID: ${item.car.id})` : 'Pendente' }}</span>
                    </p>
                  </div>
                  <p v-if="hasIncapaz && !item.avaliado" class="warning-text">
                    <strong>Avaliação Judicial:</strong> <span>Pendente</span>
                  </p>
                  <p v-if="hasIncapaz && item.avaliado" class="success-text">
                    <strong>Avaliação Judicial:</strong> <span>Realizada (ID: {{ item.idAvaliacao || 'Pendente' }})</span>
                  </p>
                </div>
              </div>

              <div v-if="state.bens.veiculos.length">
                <h4>Veículos</h4>
                <div v-for="item in state.bens.veiculos" :key="item.id" class="preview-card-small">
                  <p><strong>Descrição:</strong> <span>{{ item.descricao || 'N/A' }}</span></p>
                  <p><strong>Placa:</strong> <span>{{ item.placa || 'N/A' }}</span></p>
                  <p><strong>Renavam:</strong> <span>{{ item.renavam || 'N/A' }}</span></p>
                  <p><strong>ID do CRLV:</strong> <span>{{ item.idCRLV || 'Pendente' }}</span></p>
                  <p v-if="hasIncapaz && !item.avaliado" class="warning-text">
                    <strong>Avaliação Judicial:</strong> <span>Pendente</span>
                  </p>
                  <p v-if="hasIncapaz && item.avaliado" class="success-text">
                    <strong>Avaliação Judicial:</strong> <span>Realizada (ID: {{ item.idAvaliacao || 'Pendente' }})</span>
                  </p>
                </div>
              </div>

              <div v-if="state.bens.semoventes.length">
                <h4>Semoventes</h4>
                <div v-for="item in state.bens.semoventes" :key="item.id" class="preview-card-small">
                  <p><strong>Descrição:</strong> <span>{{ item.descricao || 'N/A' }}</span></p>
                  <p v-if="item.quantidade"><strong>Quantidade:</strong> <span>{{ item.quantidade }}</span></p>
                  <p v-if="item.valor"><strong>Valor (R$):</strong> <span>{{ item.valor }}</span></p>
                  <p><strong>Doc. (ID):</strong> <span>{{ item.idDocumento || 'Pendente' }}</span></p>
                  <p v-if="hasIncapaz && !item.avaliado" class="warning-text">
                    <strong>Avaliação Judicial:</strong> <span>Pendente</span>
                  </p>
                  <p v-if="hasIncapaz && item.avaliado" class="success-text">
                    <strong>Avaliação Judicial:</strong> <span>Realizada (ID: {{ item.idAvaliacao || 'Pendente' }})</span>
                  </p>
                </div>
              </div>

              <div v-if="state.bens.outrosBens && state.bens.outrosBens.length">
                <h4>Outros Bens e Direitos</h4>
                <div v-for="item in state.bens.outrosBens" :key="item.id" class="preview-card-small">
                  <p><strong>Descrição:</strong> <span>{{ item.descricao || 'N/A' }}</span></p>
                  <p v-if="item.quantidade"><strong>Quantidade / Quota:</strong> <span>{{ item.quantidade }}</span></p>
                  <p v-if="item.valor"><strong>Valor (R$):</strong> <span>{{ item.valor }}</span></p>
                  <p><strong>Doc. (ID):</strong> <span>{{ item.idDocumento || 'Pendente' }}</span></p>
                  <p v-if="hasIncapaz && !item.avaliado" class="warning-text">
                    <strong>Avaliação Judicial:</strong> <span>Pendente</span>
                  </p>
                  <p v-if="hasIncapaz && item.avaliado" class="success-text">
                    <strong>Avaliação Judicial:</strong> <span>Realizada (ID: {{ item.idAvaliacao || 'Pendente' }})</span>
                  </p>
                </div>
              </div>

              <div v-if="state.bens.valoresResiduais.length">
                <h4>Valores Residuais</h4>
                <div v-for="item in state.bens.valoresResiduais" :key="item.id" class="preview-card-small">
                  <p><strong>Tipo:</strong> <span>{{ item.tipo }}</span></p>
                  <p><strong>Instituição:</strong> <span>{{ item.instituicao || 'N/A' }}</span></p>
                  <p><strong>Valor (R$):</strong> <span>{{ item.valor || 'N/A' }}</span></p>
                  <p><strong>Doc. (ID):</strong> <span>{{ item.idDocumento || 'Pendente' }}</span></p>
                </div>
              </div>

              <div v-if="state.bens.dividas.length">
                <h4>Dívidas do Espólio</h4>
                <div v-for="item in state.bens.dividas" :key="item.id" class="preview-card-small">
                  <p><strong>Credor:</strong> <span>{{ item.credor || 'N/A' }}</span></p>
                  <p><strong>Tipo:</strong> <span>{{ item.tipo }}</span></p>
                  <p><strong>Valor (R$):</strong> <span>{{ item.valor || 'N/A' }}</span></p>
                  <p><strong>Doc. (ID):</strong> <span>{{ item.idDocumento || 'Pendente' }}</span></p>
                </div>
              </div>

              <div v-if="state.bens.houvePedidoAlvara && state.bens.alvaras.length">
                <h4>Alvarás</h4>
                <div v-for="item in state.bens.alvaras" :key="item.id" class="preview-card-small">
                  <p><strong>Finalidade:</strong> <span>{{ item.finalidade }}</span></p>
                  <p>
                    <strong>Requerimento:</strong>
                    <span>{{ item.idRequerimento ? `ID: ${item.idRequerimento}` : 'Não requerido' }}</span>
                  </p>
                  <p v-if="item.idRequerimento"><strong>Status:</strong> <span>{{ item.statusDeferimento }}</span></p>
                  <p v-if="item.statusDeferimento === 'Deferido'">
                    <strong>Expedição:</strong> <span>{{ item.idExpedicao || 'Pendente' }}</span>
                  </p>
                  <p v-if="item.idExpedicao">
                    <strong>Prestou Contas:</strong> <span>{{ item.prestouContas }}</span>
                  </p>
                </div>
              </div>
            </div>

            <div class="preview-section">
              <h3>{{ sectionNumbers.docsProcessuais }}. Documentos Processuais</h3>
              <div class="preview-card">
                <p>
                  <strong>Primeiras Declarações:</strong>
                  <span>
                    {{
                      state.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada'
                        ? `Apresentada (ID: ${state.documentosProcessuais.primeirasDeclaracoes.id || 'N/A'})`
                        : 'Não Apresentada'
                    }}
                  </span>
                </p>
                <div v-for="item in state.documentosProcessuais.testamentosCensec" :key="item.falecidoId">
                  <p>
                    <strong>
                      {{
                        item.deixouTestamento
                          ? `Testamento (${item.nomeFalecido})`
                          : `Certidão CENSEC (${item.nomeFalecido})`
                      }}:
                    </strong>
                    <span>{{ item.id ? `Apresentado (ID: ${item.id})` : 'Pendente' }}</span>
                  </p>
                </div>
                <p><strong>Edital:</strong> <span>{{ getEditalStatus() }}</span></p>
                <p>
                  <strong>Últimas Declarações:</strong>
                  <span>
                    {{
                      state.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada'
                        ? `Apresentada (ID: ${state.documentosProcessuais.ultimasDeclaracoes.id || 'N/A'})`
                        : 'Não Apresentada'
                    }}
                  </span>
                </p>
                <p v-if="hasIncapaz">
                  <strong>Manifestação do MP:</strong>
                  <span
                    :class="{
                      'warning-text': state.documentosProcessuais.manifestacaoMP.status !== 'Manifestado'
                    }"
                  >
                    {{
                      state.documentosProcessuais.manifestacaoMP.status === 'Manifestado'
                        ? `Manifestado (ID: ${state.documentosProcessuais.manifestacaoMP.id || 'N/A'})`
                        : 'Pendente'
                    }}
                  </span>
                </p>
                <p>
                  <strong>Sentença:</strong>
                  <span>
                    {{
                      state.documentosProcessuais.sentenca.status === 'Proferida'
                        ? `Proferida (ID: ${state.documentosProcessuais.sentenca.id || 'N/A'})`
                        : 'Não Proferida'
                    }}
                  </span>
                </p>
                <p>
                  <strong>Trânsito em Julgado:</strong>
                  <span>
                    {{
                      state.documentosProcessuais.transito.status === 'Ocorrido'
                        ? `Ocorrido (ID: ${state.documentosProcessuais.transito.id || 'N/A'})`
                        : 'Não Ocorrido'
                    }}
                  </span>
                </p>
              </div>
            </div>

            <div class="preview-section" v-if="state.documentacaoTributaria.length || state.custas.situacao">
              <h3>{{ sectionNumbers.tributaria }}. Regularidade Tributária e Custas</h3>
              <div v-for="trib in state.documentacaoTributaria" :key="trib.falecidoId" class="preview-card">
                <h4>
                  Tributos de: <strong>{{ trib.nomeFalecido }}</strong>
                </h4>
                <p><strong>Status ITCD:</strong><span>{{ trib.statusItcd }}</span></p>
                <p
                  v-if="
                    trib.idItcd ||
                    trib.statusItcd === 'Declarado e Pago' ||
                    trib.statusItcd === 'Declarado e Parcelado' ||
                    trib.statusItcd === 'Declarado e Pendente de Pagamento'
                  "
                >
                  <strong>ID do ITCD:</strong><span>{{ trib.idItcd || 'Não informado' }}</span>
                </p>
                <p>
                  <strong>CND Municipal:</strong>
                  <span>
                    {{
                      trib.cndMunicipal.status === 'Juntada'
                        ? `Juntada (ID: ${trib.cndMunicipal.id || 'N/A'})`
                        : 'Não Juntada'
                    }}
                  </span>
                </p>
                <p>
                  <strong>CND Estadual:</strong>
                  <span>
                    {{
                      trib.cndEstadual.status === 'Juntada'
                        ? `Juntada (ID: ${trib.cndEstadual.id || 'N/A'})`
                        : 'Não Juntada'
                    }}
                  </span>
                </p>
                <p>
                  <strong>CND Federal:</strong>
                  <span>
                    {{
                      trib.cndFederal.status === 'Juntada'
                        ? `Juntada (ID: ${trib.cndFederal.id || 'N/A'})`
                        : 'Não Juntada'
                    }}
                  </span>
                </p>
              </div>
              <div class="preview-card">
                <h4>Custas Processuais</h4>
                <p><strong>Situação:</strong><span>{{ getCustasStatus() }}</span></p>
              </div>
            </div>

            <div class="preview-section" v-if="state.observacoes.length">
              <h3>{{ sectionNumbers.observacoes }}. Observações Adicionais</h3>
              <div
                v-for="obs in state.observacoes"
                :key="obs.id"
                :class="['preview-card', `obs-${normalizeObsClass(obs.relevancia)}`]"
              >
                <p><strong>{{ obs.titulo || 'Observação' }}</strong></p>
                <p class="obs-content"><span>{{ obs.conteudo }}</span></p>
              </div>
            </div>
          </div>

          <div class="preview-footer">
            <div class="signature-area">
              <div class="signature-line">
                <p class="signature-name">
                  {{ state.processo.responsavel.nome || '_________________________________________' }}
                </p>
                <p class="signature-title">{{ state.processo.responsavel.cargo || 'Cargo do Responsável' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Gerando PDF, por favor aguarde...</p>
    </div>
  </div>
</template>

<style>
/* Estilos globais em main.css */
</style>
