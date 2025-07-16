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
    idProcuracao: '',
    curador: { nome: '', idTermo: '' },
    idCertidaoObito: '',
    conjuge: { nome: '', idProcuracao: '' },
    representantes: []
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
    bens: {
        imoveis: [],
        veiculos: [],
        outrosBens: [],
        valoresResiduais: [],
        dividas: [],
        alvaras: [],
        idLaudoAvaliacaoIncapaz: ''
    },
    documentosProcessuais: {
        primeirasDeclaracoes: { presente: false, id: '' },
        edital: { presente: false, id: '' },
        citacoes: { presente: false, id: '' },
        ultimasDeclaracoes: { presente: false, id: '' },
        idSentenca: '',
        idTransitoJulgado: ''
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
    regimeCasamento: 'Não se aplica'
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
            <strong>{{ level > 0 ? 'Representante:' : 'Herdeiro(a):' }}</strong> 
            <span>{{ h.nome || 'Não informado' }} <span v-if="h.parentesco">({{ h.parentesco }})</span></span>
        </p>
        <p><strong>Condição:</strong> <span>{{ h.estado }}</span></p>
        
        <div v-if="h.idProcuracao" class="info-procuracao">
            <p><strong>Procuração (ID):</strong> <span>{{ h.idProcuracao }}</span></p>
        </div>
        
        <div v-if="h.estado === 'Incapaz'" class="preview-sub-card warning">
            <p><strong>Curador(a):</strong> <span>{{ h.curador.nome || 'Não informado' }}</span></p>
        </div>

        <div v-if="h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável'" class="preview-sub-card spouse">
            <p><strong>Cônjuge/Comp.:</strong> <span>{{ h.conjuge.nome || 'Não informado' }}</span></p>
            <div v-if="h.conjuge.idProcuracao" class="info-procuracao" style="margin-left: 1rem;">
                <p><strong>Procuração Cônjuge (ID):</strong> <span>{{ h.conjuge.idProcuracao }}</span></p>
            </div>
        </div>

        <div v-if="h.estado === 'Falecido'" class="preview-sub-card danger">
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
            bensSections: [
                { key: 'imoveis', title: 'Bens Imóveis', singular: 'Imóvel', fields: [
                    { label: 'Descrição', model: 'descricao' }, { label: 'Matrícula', model: 'matricula' },
                    { label: 'Tipo', model: 'tipo', options: ['Rural', 'Urbano'] }, { label: 'Documentos (IPTU, ITR, etc.)', model: 'docs' }
                ]},
                { key: 'veiculos', title: 'Veículos', singular: 'Veículo', fields: [
                    { label: 'Descrição (Marca/Modelo)', model: 'descricao' }, { label: 'Placa', model: 'placa' }, { label: 'Renavam', model: 'renavam' }
                ]},
                { key: 'outrosBens', title: 'Outros Bens Móveis', singular: 'Bem', fields: [
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
            ],
            documentosProcessuais: [
                { label: 'Primeiras Declarações', model: 'primeirasDeclaracoes' }, { label: 'Edital de Convocação', model: 'edital' },
                { label: 'Citações e Intimações', model: 'citacoes' }, { label: 'Últimas Declarações', model: 'ultimasDeclaracoes' },
            ]
        };
    },

    components: {
        'heir-form-group': HeirFormComponent,
        'heir-preview-group': HeirPreviewComponent
    },

    computed: {
        hasIncapaz() {
            const checkIncapaz = (heirs) => {
                return heirs.some(h => h.estado === 'Incapaz' || (h.representantes && checkIncapaz(h.representantes)));
            };
            return checkIncapaz(this.state.herdeiros);
        },
        hasBens() {
            return Object.values(this.state.bens).some(arr => Array.isArray(arr) ? arr.length > 0 : false);
        },
        checkedProcessualDocs() {
            return this.documentosProcessuais
                .filter(doc => this.state.documentosProcessuais[doc.model].presente)
                .map(doc => ({
                    label: doc.label,
                    id: this.state.documentosProcessuais[doc.model].id || 'Não informado'
                }));
        },
        emissionDate() {
            return new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
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
                        idCndMunicipal: '', idCndEstadual: '', idCndFederal: ''
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

        addBem(sectionKey) {
            const newBem = {};
            const section = this.bensSections.find(s => s.key === sectionKey);
            if (section) {
                section.fields.forEach(field => { newBem[field.model] = ''; });
                this.state.bens[sectionKey].push(newBem);
            }
        },
        removeBem(sectionKey, index) { this.state.bens[sectionKey].splice(index, 1); },

        addObservacao() { this.state.observacoes.push(createObservacao()); },
        removeObservacao(index) { this.state.observacoes.splice(index, 1); },

        saveStateToLocalStorage(state) {
            try { localStorage.setItem('certidaoInventarioState', JSON.stringify(state)); } 
            catch (e) { console.error("Erro ao salvar no localStorage:", e); }
        },
        
        loadStateFromLocalStorage() {
            const savedState = localStorage.getItem('certidaoInventarioState');
            if (savedState) {
                try {
                    const parsedState = JSON.parse(savedState);
                    this.state = Object.assign(createInitialState(), parsedState);
                    console.log("Estado carregado do localStorage.");
                } catch (e) {
                    console.error("Erro ao carregar estado do localStorage:", e);
                    this.state = createInitialState();
                }
            }
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
                        this.state = Object.assign(createInitialState(), importedState);
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
                const sections = document.querySelectorAll('#preview-panel .preview-section');
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
            if (tributo.idCndMunicipal) cnds.push('Municipal');
            if (tributo.idCndEstadual) cnds.push('Estadual');
            if (tributo.idCndFederal) cnds.push('Federal');
            return cnds.length > 0 ? cnds.join(', ') : 'Nenhuma CND informada';
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
