// Arquivo: src/utils/stateHelpers.js - VERSÃO ATUALIZADA

// Função para criar um novo advogado
export const createAdvogadoObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    oab: ''
});

// Função para criar um novo herdeiro (usada recursivamente)
export const createHeirObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    parentesco: '',
    documentos: '',
    estado: 'Capaz',
    estadoCivil: 'Solteiro(a)',
    regimeCasamento: 'Não se aplica',
    idCertidaoCasamento: '',
    isMeeiro: false,
    idProcuracao: '',
    advogadoId: '', 
    curador: { 
        nome: '', 
        idTermo: '',
        idProcuracao: '',
        advogadoId: ''
    },
    idCertidaoObito: '',
    itcdStatus: 'Não Declarado', // ADICIONADO
    idItcd: '',                  // ADICIONADO
    conjuge: {
        nome: '',
        documentos: '',
        idProcuracao: '',
        advogadoId: ''
    },
    representantes: []
});

export const createCessionarioObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    documentos: '',
    idProcuracao: '',
    advogadoId: ''
});

// Função para criar um estado inicial limpo
export const createInitialState = () => ({
    processo: {
        numero: '',
        cumulativo: false,
        responsavel: { nome: '', cargo: '' },
        advogados: [] 
    },
    falecidos: [],
    inventariante: {
        nome: '',
        parentesco: '',
        documentos: '',
        idProcuracao: '',
        idTermoCompromisso: '',
        advogadoId: '' 
    },
    herdeiros: [],
    renuncia: {
        houveRenuncia: false,
        renunciantes: []
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
        houvePedidoAlvara: false,
        alvaras: []
    },
    documentosProcessuais: {
        primeirasDeclaracoes: { status: 'Não Apresentada', id: '' },
        edital: { determinado: 'Não', status: 'Não Expedido', id: '', prazoDecorrido: 'Não', idDecursoPrazo: '' },
        ultimasDeclaracoes: { status: 'Não Apresentada', id: '' },
        testamentosCensec: [],
        sentenca: { status: 'Não Proferida', id: '' },
        transito: { status: 'Não Ocorrido', id: '' },
        manifestacaoMP: { necessaria: false, status: 'Não Manifestado', id: '' }
    },
    custas: {
        situacao: 'Ao final',
        calculada: 'Não',
        idCalculo: '',
        paga: 'Não',
        idPagamento: ''
    },
    documentacaoTributaria: [],
    observacoes: []
});

// Função para criar um novo falecido
export const createFalecido = () => ({
    id: crypto.randomUUID(),
    nome: '',
    dataFalecimento: '',
    documentos: '',
    idCertidaoObito: '',
    regimeCasamento: 'Não se aplica',
    deixouTestamento: false
});

// Função para criar uma nova observação
export const createObservacao = () => ({
    id: crypto.randomUUID(),
    titulo: '',
    conteudo: '',
    relevancia: 'Média'
});

// --- FUNÇÕES DE CRIAÇÃO DE BENS ---
export const createImovel = () => ({ id: crypto.randomUUID(), descricao: '', matricula: '', tipo: 'Urbano', avaliado: false, idAvaliacao: '', idMatricula: '', iptu: { determinado: false, id: '' }, itr: { determinado: false, id: '' }, ccir: { determinado: false, id: '' }, car: { determinado: false, id: '' } });
export const createVeiculo = () => ({ id: crypto.randomUUID(), descricao: '', placa: '', renavam: '', avaliado: false, idAvaliacao: '', idCRLV: '' });
export const createSemovente = () => ({ id: crypto.randomUUID(), descricao: '', quantidade: '', valor: '', avaliado: false, idAvaliacao: '', idDocumento: '' });
export const createOutroBem = () => ({ id: crypto.randomUUID(), descricao: '', quantidade: '', valor: '', avaliado: false, idAvaliacao: '', idDocumento: '' });
export const createValorResidual = () => ({ id: crypto.randomUUID(), tipo: 'Conta Bancária', instituicao: '', valor: '', idDocumento: '' });
export const createDivida = () => ({ id: crypto.randomUUID(), credor: '', tipo: 'Tributária', valor: '', idDocumento: '' });
export const createAlvara = () => ({ id: crypto.randomUUID(), finalidade: '', idRequerimento: '', statusDeferimento: 'Pendente', idExpedicao: '', prestouContas: 'Não aplicável' });