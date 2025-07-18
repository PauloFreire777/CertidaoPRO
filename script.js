// Garante que o objeto jsPDF está disponível globalmente
const { jsPDF } = window.jspdf;

// --- Estruturas de Dados Iniciais --- //

// Função para criar um novo herdeiro (usada recursivamente)
const createHeirObject = () => ({
    id: crypto.randomUUID(), // ID único para reatividade
    nome: '',
    parentesco: '',
    documentos: '',
    estado: 'Capaz',
    estadoCivil: 'Solteiro(a)',
    isMeeiro: false,
    idProcuracao: '',
    curador: { nome: '', idTermo: '' },
    idCertidaoObito: '',
    conjuge: { nome: '', idProcuracao: '', regimeDeBens: 'Comunhão Parcial de Bens' },
    representantes: []
});

const createCessionarioObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    documentos: '',
    idProcuracao: ''
});

// Função para criar um estado inicial limpo
const createInitialState = () => ({
    processo: {
        numero: '',
        cumulativo: false,
        responsavel: { nome: '', cargo: '' }
    },
    falecidos: [],
    inventariante: {
        nome: '',
        parentesco: '',
        documentos: '',
        idProcuracao: '',
        idTermoCompromisso: ''
    },
    herdeiros: [],
    renuncia: {
        houveRenuncia: false,
        renunciantes: [] // Array of { herdeiroId: '...', tipo: 'Abdicativa', idEscritura: '' }
    },
    cessao: {
        houveCessao: false,
        idEscritura: '',
        cessionarios: []
    },
    bens: {
        imoveis: [],
        veiculos: [],
        semoventes: [],
        outrosBens: [],
        valoresResiduais: [],
        dividas: [],
        alvaras: [],
        idLaudoAvaliacaoIncapaz: ''
    },
    documentosProcessuais: {
        primeirasDeclaracoes: { status: 'Não Apresentada', id: '' },
        edital: { determinado: 'Não', status: 'Não Expedido', id: '', prazoDecorrido: 'Não', idDecursoPrazo: '' },
        ultimasDeclaracoes: { status: 'Não Apresentada', id: '' },
        testamento: { id: '' },
        censec: { id: '' },
        sentenca: { status: 'Não Proferida', id: '' },
        transito: { status: 'Não Ocorrido', id: '' }
    },
    custas: {
        situacao: 'Ao final', // 'Ao final', 'Isenção', 'Devidas'
        calculada: 'Não', // 'Sim', 'Não'
        idCalculo: '',
        paga: 'Não', // 'Sim', 'Não'
        idPagamento: ''
    },
    documentacaoTributaria: [],
    observacoes: []
});

// Função para criar um novo falecido
const createFalecido = () => ({
    id: crypto.randomUUID(),
    nome: '',
    dataFalecimento: '',
    documentos: '',
    idCertidaoObito: '',
    regimeCasamento: 'Não se aplica',
    deixouTestamento: false
});

// Função para criar uma nova observação
const createObservacao = () => ({
    id: crypto.randomUUID(),
    titulo: '',
    conteudo: '',
    relevancia: 'Média'
});


// --- Componentes Vue (para recursividade) --- //

// Componente para o formulário de um herdeiro/representante
const HeirFormComponent = {
    name: 'HeirFormGroup',
    props: {
        heir: Object,
        index: Number,
        isRepresentative: Boolean,
        level: {
            type: Number,
            default: 0
        }
    },
    emits: ['remove'],
    methods: {
        addRepresentante() {
            this.heir.representantes.push(createHeirObject());
        },
        removeThis() {
            this.$emit('remove', this.index);
        },
        removeRepresentante(repIndex) {
            this.heir.representantes.splice(repIndex, 1);
        }
    },
    template: `
      <div class="dynamic-card" :class="{ 'sub-card': isRepresentative }">
        <h4 class="card-title">{{ isRepresentative ? 'Representante' : 'Herdeiro(a)' }} {{ index + 1 }}</h4>
        <button @click="removeThis" class="btn-remove" :title="isRepresentative ? 'Remover Representante' : 'Remover Herdeiro'">×</button>
        
        <div class="form-group checkbox-group" v-if="!isRepresentative">
            <input type="checkbox" :id="'meeiro_' + heir.id" v-model="heir.isMeeiro">
            <label :for="'meeiro_' + heir.id">Este herdeiro é Meeiro(a)</label>
        </div>

        <div class="form-group">
            <label>Nome Completo <span class="required">*</span></label>
            <input type="text" v-model="heir.nome">
        </div>
        <div class="grid-3">
            <div class="form-group">
                <label>Parentesco <span class="required">*</span></label>
                <input type="text" v-model="heir.parentesco">
            </div>
            <div class="form-group">
                <label>Estado <span class="required">*</span></label>
                <select v-model="heir.estado">
                    <option>Capaz</option>
                    <option>Incapaz</option>
                    <option>Falecido</option>
                </select>
            </div>
            <div class="form-group">
                <label>Estado Civil <span class="required">*</span></label>
                <select v-model="heir.estadoCivil">
                    <option>Solteiro(a)</option>
                    <option>Casado(a)</option>
                    <option>União Estável</option>
                    <option>Divorciado(a)</option>
                    <option>Viúvo(a)</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Documentos Pessoais (CPF/RG) <span class="required">*</span></label>
            <input type="text" v-model="heir.documentos">
        </div>

        <!-- Lógica Condicional -->
        <div v-if="heir.estado === 'Capaz'" class="conditional-section">
            <div class="form-group">
                <label>ID da Procuração</label>
                <input type="text" v-model="heir.idProcuracao">
            </div>
        </div>
        <div v-if="heir.estado === 'Incapaz'" class="conditional-section warning">
            <label class="bold">Dados da Curatela</label>
            <div class="grid-2">
                <div class="form-group">
                    <label>Nome do Curador <span class="required">*</span></label>
                    <input type="text" v-model="heir.curador.nome">
                </div>
                <div class="form-group">
                    <label>ID Termo de Compromisso <span class="required">*</span></label>
                    <input type="text" v-model="heir.curador.idTermo">
                </div>
            </div>
        </div>
        <div v-if="heir.estado === 'Falecido'" class="conditional-section danger">
            <div class="form-group">
                <label>ID da Certidão de Óbito <span class="required">*</span></label>
                <input type="text" v-model="heir.idCertidaoObito">
            </div>
            <fieldset>
                <legend>Representantes de {{ heir.nome || 'Herdeiro Falecido' }}</legend>
                <heir-form-group
                    v-for="(rep, rIndex) in heir.representantes"
                    :key="rep.id"
                    :heir="rep"
                    :index="rIndex"
                    :is-representative="true"
                    :level="level + 1"
                    @remove="removeRepresentante(rIndex)">
                </heir-form-group>
                <button @click="addRepresentante" class="btn-add-small"><i data-lucide="plus"></i> Adicionar Representante</button>
            </fieldset>
        </div>
        <div v-if="heir.estadoCivil === 'Casado(a)' || heir.estadoCivil === 'União Estável'" class="conditional-section">
            <label class="bold">Dados do Cônjuge/Companheiro(a)</label>
            <div class="grid-2">
                <div class="form-group">
                    <label>Nome do Cônjuge <span class="required">*</span></label>
                    <input type="text" v-model="heir.conjuge.nome">
                </div>
                <div class="form-group">
                    <label>ID da Procuração do Cônjuge</label>
                    <input type="text" v-model="heir.conjuge.idProcuracao">
                </div>
            </div>
            <div class="form-group">
                <label>Regime de Bens</label>
                <select v-model="heir.conjuge.regimeDeBens">
                    <option>Comunhão Parcial de Bens</option>
                    <option>Comunhão Universal de Bens</option>
                    <option>Separação Total de Bens</option>
                    <option>Participação Final nos Aquestos</option>
                </select>
            </div>
        </div>
      </div>
    `
};

// Componente para a pré-visualização de um herdeiro/representante
const HeirPreviewComponent = {
    name: 'HeirPreviewGroup',
    props: {
        heirs: Array,
        level: Number
    },
    methods: {
        formatDate(dateString) {
            if (!dateString) return 'Não informado';
            try {
                const date = new Date(dateString + 'T00:00:00');
                if (isNaN(date.getTime())) return dateString;
                return date.toLocaleDateString('pt-BR');
            } catch (e) {
                return dateString;
            }
        },
    },
    template: `
      <div v-for="(h, i) in heirs" :key="h.id" class="preview-card" :style="{ marginLeft: level * 20 + 'px' }">
        <p>
            <strong>{{ h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):') }}</strong> 
            <span>{{ h.nome || 'Não informado' }} <span v-if="h.parentesco">({{ h.parentesco }})</span></span>
        </p>
        <p><strong>Condição:</strong> <span>{{ h.estado }}</span></p>
        <p><strong>Documentos Pessoais:</strong> <span>{{ h.documentos || 'Não informado' }}</span></p>
        
        <div v-if="h.idProcuracao" class="info-procuracao">
            <p><strong>Procuração (ID):</strong> <span>{{ h.idProcuracao }}</span></p>
        </div>
        
        <div v-if="h.estado === 'Incapaz'" class="preview-sub-card warning">
            <p><strong>Curador(a):</strong> <span>{{ h.curador.nome || 'Não informado' }}</span></p>
            <p><strong>Termo de Curador (ID):</strong> <span>{{ h.curador.idTermo || 'Não informado' }}</span></p>
        </div>

        <div v-if="h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável'" class="preview-sub-card spouse">
            <p><strong>Cônjuge/Comp.:</strong> <span>{{ h.conjuge.nome || 'Não informado' }}</span></p>
            <p><strong>Regime de Bens:</strong> <span>{{ h.conjuge.regimeDeBens }}</span></p>
            <div v-if="h.conjuge.idProcuracao" class="info-procuracao" style="margin-left: 1rem;">
                <p><strong>Procuração Cônjuge (ID):</strong> <span>{{ h.conjuge.idProcuracao }}</span></p>
            </div>
        </div>

        <div v-if="h.estado === 'Falecido'" class="preview-sub-card danger">
            <p><strong>Certidão de Óbito (ID):</strong> <span>{{ h.idCertidaoObito || 'Não informado' }}</span></p>
            <p><strong>Sucessão de Herdeiro Falecido:</strong></p>
            <heir-preview-group :heirs="h.representantes" :level="level + 1"></heir-preview-group>
        </div>
      </div>
    `
};


// --- Aplicação Vue.js Principal --- //

const app = Vue.createApp({
    data() {
        return {
            state: createInitialState(),
            activeTab: 0,
            tabs: [
                'Processo', 'Falecidos', 'Inventariante', 'Herdeiros',
                'Bens', 'Docs Processuais', 'Docs Tributários', 'Observações'
            ],
            isLoading: false,
            showAutosaveIndicator: false,
            theme: 'light',
            bensSections: [
                { key: 'imoveis', title: 'Bens Imóveis', singular: 'Imóvel', fields: [
                    { label: 'Descrição', model: 'descricao' }, { label: 'Matrícula', model: 'matricula' },
                    { label: 'Tipo', model: 'tipo', options: ['Rural', 'Urbano'] }, { label: 'Documentos (IPTU, ITR, etc.)', model: 'docs' }
                ]},
                { key: 'veiculos', title: 'Veículos', singular: 'Veículo', fields: [
                    { label: 'Descrição (Marca/Modelo)', model: 'descricao' }, { label: 'Placa', model: 'placa' }, { label: 'Renavam', model: 'renavam' }
                ]},
                { key: 'semoventes', title: 'Semoventes', singular: 'Semovente', fields: [
                    { label: 'Descrição', model: 'descricao' }, { label: 'Quantidade', model: 'quantidade' }, { label: 'Valor Estimado (R$)', model: 'valor' }
                ]},
                { key: 'outrosBens', title: 'Outros Bens', singular: 'Bem', fields: [
                    { label: 'Descrição', model: 'descricao' }, { label: 'Quantidade', model: 'quantidade' }, { label: 'Valor Estimado (R$)', model: 'valor' }
                ]},
                { key: 'valoresResiduais', title: 'Valores Residuais', singular: 'Valor', fields: [
                    { label: 'Tipo', model: 'tipo', options: ['Conta Bancária', 'FGTS', 'PIS/PASEP', 'Ações'] },
                    { label: 'Instituição', model: 'instituicao' }, { label: 'Valor (R$)', model: 'valor' }
                ]},
                { key: 'dividas', title: 'Dívidas do Espólio', singular: 'Dívida', fields: [
                    { label: 'Credor', model: 'credor' }, { label: 'Tipo', model: 'tipo', options: ['Tributária', 'Contratual', 'Alimentar'] }, { label: 'Valor (R$)', model: 'valor' }
                ]},
                { key: 'alvaras', title: 'Alvarás Expedidos', singular: 'Alvará', fields: [
                    { label: 'Finalidade', model: 'finalidade' }, { label: 'Status', model: 'status', options: ['Requerido', 'Deferido', 'Cumprido'] }
                ]}
            ]
        };
    },

    components: {
        'heir-form-group': HeirFormComponent,
        'heir-preview-group': HeirPreviewComponent
    },

    computed: {
        houveTestamento() {
            return this.state.falecidos.some(f => f.deixouTestamento);
        },
        hasIncapaz() {
            const checkIncapaz = (heirs) => {
                if (!heirs) return false;
                return heirs.some(h => h.estado === 'Incapaz' || checkIncapaz(h.representantes));
            };
            return checkIncapaz(this.state.herdeiros);
        },
        hasBens() {
            return Object.values(this.state.bens).some(arr => Array.isArray(arr) ? arr.length > 0 : false);
        },
        emissionDate() {
            return new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        },
        pendencies() {
            const items = [];
            const { inventariante, herdeiros, documentacaoTributaria, bens, documentosProcessuais, cessao, renuncia, custas } = this.state;

            // Inventariante
            if (!inventariante.documentos) items.push('Documentos pessoais do Inventariante pendentes.');
            if (!inventariante.idProcuracao) items.push('Procuração do Inventariante pendente.');

            // Herdeiros (recursivo)
            const checkHerdeiro = (heir, path) => {
                if (!heir.documentos) items.push(`Documentos pessoais de ${path} pendentes.`);
                
                if (heir.estado === 'Capaz' && !heir.idProcuracao) {
                    items.push(`Procuração de ${path} pendente.`);
                }
                if (heir.estado === 'Incapaz' && !heir.curador.idTermo) {
                    items.push(`Termo de Compromisso do Curador de ${path} pendente.`);
                }
                if (heir.estado === 'Falecido' && !heir.idCertidaoObito) {
                    items.push(`Certidão de Óbito de ${path} pendente.`);
                }
                if ((heir.estadoCivil === 'Casado(a)' || heir.estadoCivil === 'União Estável') && !heir.conjuge.idProcuracao) {
                    items.push(`Procuração do cônjuge de ${path} pendente.`);
                }

                if (heir.representantes && heir.representantes.length > 0) {
                    heir.representantes.forEach((rep, i) => checkHerdeiro(rep, `${path} -> Representante ${i+1} (${rep.nome || 'sem nome'})`));
                }
            };
            herdeiros.forEach((h, i) => checkHerdeiro(h, `Herdeiro ${i+1} (${h.nome || 'sem nome'})`));
            
            // Cessão de Direitos
            if (cessao.houveCessao) {
                if (!cessao.idEscritura) items.push('ID da Escritura de Cessão de Direitos pendente.');
                cessao.cessionarios.forEach((c, i) => {
                    if (!c.nome) items.push(`Nome do Cessionário ${i+1} pendente.`);
                    if (!c.documentos) items.push(`Documentos do Cessionário ${c.nome || i+1} pendentes.`);
                    if (!c.idProcuracao) items.push(`Procuração do Cessionário ${c.nome || i+1} pendente.`);
                });
            }

            // Renúncia de Direitos
            if (renuncia.houveRenuncia) {
                if (renuncia.renunciantes.length === 0) {
                    items.push('Nenhum herdeiro selecionado como renunciante.');
                } else {
                    renuncia.renunciantes.forEach(r => {
                        const heirName = this.getHeirNameById(r.herdeiroId);
                        if (!r.idEscritura) {
                            items.push(`ID da Escritura/Termo de Renúncia para ${heirName} pendente.`);
                        }
                    });
                }
            }

            // Documentação Tributária
            documentacaoTributaria.forEach(trib => {
                if (trib.cndMunicipal.status === 'Não Juntada') items.push(`CND Municipal de ${trib.nomeFalecido} não juntada.`);
                if (trib.cndEstadual.status === 'Não Juntada') items.push(`CND Estadual de ${trib.nomeFalecido} não juntada.`);
                if (trib.cndFederal.status === 'Não Juntada') items.push(`CND Federal de ${trib.nomeFalecido} não juntada.`);
            });
            
            // Custas Processuais
            if (custas.situacao === 'Devidas') {
                if (custas.calculada === 'Não Calculada') items.push('Cálculo das custas processuais pendente.');
                if (custas.paga === 'Não Pago') items.push('Pagamento das custas processuais pendente.');
            }

            // Avaliação de Bens para Incapazes
            if (this.hasIncapaz) {
                ['imoveis', 'veiculos', 'semoventes', 'outrosBens'].forEach(key => {
                    bens[key].forEach((bem, i) => {
                        if (!bem.avaliado) {
                            items.push(`Avaliação judicial pendente para o item: ${bem.descricao || `${key.slice(0, -1)} ${i+1}`}.`);
                        }
                    });
                });
            }

            // Documentos Processuais
            if (documentosProcessuais.edital.determinado === 'Determinado' && documentosProcessuais.edital.status === 'Não Expedido') {
                items.push('Expedição do Edital pendente.');
            }
            if (this.houveTestamento && !documentosProcessuais.testamento.id) {
                items.push('ID do Testamento pendente.');
            }
            if (!this.houveTestamento && !documentosProcessuais.censec.id) {
                items.push('ID da Certidão CENSEC pendente.');
            }


            return items;
        }
    },

    watch: {
        state: {
            handler(newState) { this.saveStateToLocalStorage(newState); },
            deep: true
        },
        'state.falecidos': {
            handler(newFalecidos) {
                const newTributos = newFalecidos.map(f => {
                    const existing = this.state.documentacaoTributaria.find(t => t.falecidoId === f.id);
                    return existing || {
                        falecidoId: f.id,
                        nomeFalecido: f.nome,
                        statusItcd: 'Não Declarado',
                        cndMunicipal: { status: 'Não Juntada', id: '' },
                        cndEstadual: { status: 'Não Juntada', id: '' },
                        cndFederal: { status: 'Não Juntada', id: '' }
                    };
                });
                this.state.documentacaoTributaria = newTributos;
            },
            deep: true,
            immediate: true
        }
    },
    
    methods: {
        nextTab() { if (this.activeTab < this.tabs.length - 1) this.activeTab++; },
        prevTab() { if (this.activeTab > 0) this.activeTab--; },

        addFalecido() { this.state.falecidos.push(createFalecido()); },
        removeFalecido(index) { this.state.falecidos.splice(index, 1); },
        
        addHerdeiro() { this.state.herdeiros.push(createHeirObject()); },
        removeHerdeiro(index) { this.state.herdeiros.splice(index, 1); },

        addCessionario() { this.state.cessao.cessionarios.push(createCessionarioObject()); },
        removeCessionario(index) { this.state.cessao.cessionarios.splice(index, 1); },

        addBem(sectionKey) {
            const newBem = { avaliado: false }; // Inicia como não avaliado por padrão
            const section = this.bensSections.find(s => s.key === sectionKey);
            if (section) {
                section.fields.forEach(field => { newBem[field.model] = ''; });
                this.state.bens[sectionKey].push(newBem);
            }
        },
        removeBem(sectionKey, index) { this.state.bens[sectionKey].splice(index, 1); },

        addObservacao() { this.state.observacoes.push(createObservacao()); },
        removeObservacao(index) { this.state.observacoes.splice(index, 1); },

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
            const heir = this.state.herdeiros.find(h => h.id === id);
            return heir ? heir.nome : 'Herdeiro não encontrado';
        },

        saveStateToLocalStorage(state) {
            try { localStorage.setItem('certidaoInventarioState', JSON.stringify(state)); } 
            catch (e) { console.error("Erro ao salvar no localStorage:", e); }
        },
        
        loadStateFromLocalStorage() {
            const savedState = localStorage.getItem('certidaoInventarioState');
            if (savedState) {
                try {
                    const parsedState = JSON.parse(savedState);
                    this.state = this.hydrateState(parsedState);
                    console.log("Estado carregado do localStorage.");
                } catch (e) {
                    console.error("Erro ao carregar estado do localStorage:", e);
                    this.state = createInitialState();
                }
            }
        },

        hydrateState(loadedState) {
            const freshState = createInitialState();
            // Use a simple deep merge that prefers the structure of freshState
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
                return target;
            };
            return merge(freshState, loadedState);
        },

        resetForm() {
            if (confirm('Tem certeza que deseja limpar todos os campos e começar uma nova certidão?')) {
                this.state = createInitialState();
                this.activeTab = 0;
            }
        },

        exportState() {
            const stateJson = JSON.stringify(this.state, null, 2);
            const blob = new Blob([stateJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certidao_Regularidade-${this.state.processo.numero || 'NOVO'}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },

        triggerFileInput() { this.$refs.fileInput.click(); },

        importState(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedState = JSON.parse(e.target.result);
                    if (importedState.processo && importedState.herdeiros) {
                        this.state = this.hydrateState(importedState);
                        alert('Certidão carregada com sucesso!');
                        this.activeTab = 0;
                    } else {
                        throw new Error('Arquivo JSON inválido ou não corresponde à estrutura esperada.');
                    }
                } catch (error) {
                    console.error("Erro ao importar arquivo:", error);
                    alert(`Erro ao carregar o arquivo: ${error.message}`);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        },

        async generatePdf() {
            this.isLoading = true;
            await this.$nextTick(); 

            try {
                const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 40;
                let cursorY = 0; // Start at 0, add margin inside addElement

                // Helper to add an element as a canvas image to the PDF
                const addElement = async (element) => {
                    if (!element) return;

                    const canvas = await html2canvas(element, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        width: element.offsetWidth,
                        height: element.offsetHeight,
                        backgroundColor: '#ffffff' // Ensure background is not transparent
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const contentWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
                    const imgHeight = (canvas.height * contentWidth) / canvas.width;

                    // Check for page break BEFORE adding the element
                    if (cursorY > margin && (cursorY + imgHeight > pageHeight - margin)) {
                        pdf.addPage();
                        cursorY = margin;
                    }
                    
                    // If it's the first element on the page, add top margin
                    if (cursorY === 0) {
                        cursorY = margin;
                    }

                    pdf.addImage(imgData, 'PNG', margin, cursorY, contentWidth, imgHeight);
                    cursorY += imgHeight + 5; // Add a small gap after the element
                };

                // Select all top-level blocks to be rendered
                const header = document.querySelector('#preview-panel .preview-header');
                const sections = document.querySelectorAll('#preview-panel .preview-content > .preview-section');
                const footer = document.querySelector('#preview-panel .preview-footer');

                // Render header
                await addElement(header);

                // Render each section
                for (const section of sections) {
                    // Hide empty sections before rendering
                    const hasVisibleContent = Array.from(section.querySelectorAll('*')).some(
                        el => el.offsetParent !== null && (el.innerText.trim() !== '' || ['IMG', 'SVG'].includes(el.tagName))
                    );

                    if (section.offsetHeight > 1 && hasVisibleContent) {
                         await addElement(section);
                    }
                }

                // Render footer
                await addElement(footer);

                const numeroProcesso = this.state.processo.numero || 'CERTIDAO';
                pdf.save(`Certidao-${numeroProcesso}.pdf`);

            } catch (error) {
                console.error("Erro ao gerar PDF:", error);
                alert("Ocorreu um erro inesperado ao gerar o PDF.");
            } finally {
                this.isLoading = false;
            }
        },

        formatDate(dateString) {
            if (!dateString) return 'Não informado';
            try {
                const date = new Date(dateString + 'T00:00:00');
                if (isNaN(date.getTime())) return dateString;
                return date.toLocaleDateString('pt-BR');
            } catch (e) {
                return dateString;
            }
        },

        getCndsStatus(tributo) {
            const cnds = [];
            if (tributo.cndMunicipal.status === 'Juntada') cnds.push('Municipal');
            if (tributo.cndEstadual.status === 'Juntada') cnds.push('Estadual');
            if (tributo.cndFederal.status === 'Juntada') cnds.push('Federal');
            return cnds.length > 0 ? cnds.join(', ') : 'Nenhuma CND informada';
        },
        
        getEditalStatus() {
            const edital = this.state.documentosProcessuais.edital;
            if (edital.determinado === 'Não Determinado') {
                return 'Não determinada a expedição.';
            }
            if (edital.status === 'Não Expedido') {
                return 'Expedição pendente.';
            }
            if (edital.prazoDecorrido === 'Não') {
                return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`;
            }
            return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`;
        },
        getCustasStatus() {
            const custas = this.state.custas;
            if (custas.situacao === 'Isenção') return 'Isento de custas.';
            if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.';
            if (custas.situacao === 'Devidas') {
                const calculo = custas.calculada === 'Calculada' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente';
                const pagamento = custas.paga === 'Pago' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente';
                return `${calculo}, ${pagamento}.`;
            }
            return 'Situação não informada.';
        },
        toggleTheme() {
            this.theme = this.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', this.theme);
            localStorage.setItem('certidaoTheme', this.theme);
        }
    },

    mounted() {
        this.loadStateFromLocalStorage();
        // Renderiza os ícones do Lucide na montagem inicial
        this.$nextTick(() => {
            lucide.createIcons();
        });
        setInterval(() => {
            this.saveStateToLocalStorage(this.state);
            this.showAutosaveIndicator = true;
            setTimeout(() => { this.showAutosaveIndicator = false; }, 2000);
        }, 30000);
    },
    updated() {
        // Garante que os ícones sejam renderizados novamente após qualquer atualização do DOM
        this.$nextTick(() => {
            lucide.createIcons();
        });
    }
});

app.mount('#app');
