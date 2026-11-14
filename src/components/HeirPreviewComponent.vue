<template>
  <div v-for="h in heirs" :key="h.id" class="preview-card" :style="{ marginLeft: level * 20 + 'px' }">
    <p>
        <strong>{{ h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):') }}</strong> 
        <span>{{ h.nome || 'Não informado' }} <span v-if="h.parentesco">({{ h.parentesco }})</span></span>
    </p>
    <p><strong>Condição:</strong> <span>{{ h.estado }}</span></p>
    <p><strong>Documentos Pessoais:</strong> <span>{{ h.documentos || 'Não informado' }}</span></p>
    
    <div v-if="h.idProcuracao" class="info-procuracao">
        <p><strong>Procuração (ID):</strong> <span>{{ h.idProcuracao }}</span></p>
    </div>
    
    <div v-if="h.advogadoId" class="info-advogado">
      <p><strong>Advogado(a):</strong> <span>{{ getAdvogadoNomeById(h.advogadoId) }}</span></p>
    </div>

    <div v-if="h.estado === 'Incapaz'" class="preview-sub-card warning">
        <p><strong>Curador(a):</strong> <span>{{ h.curador.nome || 'Não informado' }}</span></p>
        <p><strong>Termo de Curador (ID):</strong> <span>{{ h.curador.idTermo || 'Não informado' }}</span></p>
        <div v-if="h.curador.idProcuracao" class="info-procuracao" style="margin-top: 8px;">
          <p><strong>Procuração Curador (ID):</strong> <span>{{ h.curador.idProcuracao }}</span></p>
        </div>
        <div v-if="h.curador.advogadoId" class="info-advogado" style="margin-top: 8px;">
          <p><strong>Advogado(a) do Curatelado:</strong> <span>{{ getAdvogadoNomeById(h.curador.advogadoId) }}</span></p>
        </div>
    </div>

    <div v-if="h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável'" class="preview-sub-card spouse">
        <p><strong>Regime de Casamento:</strong> <span>{{ h.regimeCasamento || 'Não informado' }}</span></p>
        <p><strong>Certidão de Casamento (ID):</strong> <span>{{ h.idCertidaoCasamento || 'Não informado' }}</span></p>
        
        <hr style="border: 0; border-top: 1px dashed #e0e0e0; margin: 8px 0;">

        <p><strong>Cônjuge/Comp.:</strong> <span>{{ h.conjuge.nome || 'Não informado' }}</span></p>
        <p><strong>Documentos Pessoais (Cônjuge):</strong> <span>{{ h.conjuge.documentos || 'Não informado' }}</span></p>
        
        <div v-if="h.conjuge.idProcuracao" class="info-procuracao" style="margin-left: 1rem;">
            <p><strong>Procuração Cônjuge (ID):</strong> <span>{{ h.conjuge.idProcuracao }}</span></p>
        </div>
        <div v-if="h.conjuge.advogadoId" class="info-advogado" style="margin-left: 1rem;">
          <p><strong>Advogado(a) do Cônjuge:</strong> <span>{{ getAdvogadoNomeById(h.conjuge.advogadoId) }}</span></p>
        </div>
    </div>

    <div v-if="h.estado === 'Falecido'" class="preview-sub-card danger">
        <p><strong>Certidão de Óbito (ID):</strong> <span>{{ h.idCertidaoObito || 'Não informado' }}</span></p>
        
        <div class="tax-info" v-if="h.itcdStatus">
          <p><strong>Status do ITCD:</strong> <span>{{ h.itcdStatus }}</span></p>
          <p v-if="h.idItcd || h.itcdStatus === 'Declarado e Pago' || h.itcdStatus === 'Declarado e Parcelado' || h.itcdStatus === 'Declarado e Pendente de Pagamento'">
            <strong>ID do ITCD:</strong> <span>{{ h.idItcd || 'Não informado' }}</span>
          </p>
        </div>

        <template v-if="h.representantes && h.representantes.length > 0">
          <p style="margin-top: 1rem;"><strong>Sucessão de Herdeiro Falecido:</strong></p>
          <HeirPreviewComponent :heirs="h.representantes" :level="level + 1" :advogados="advogados"></HeirPreviewComponent>
        </template>
    </div>
  </div>
</template>

<script>
export default {
    name: 'HeirPreviewComponent',
    props: {
        heirs: Array,
        level: {
            type: Number,
            default: 0
        },
        advogados: {
            type: Array,
            default: () => []
        }
    },
    methods: {
        getAdvogadoNomeById(advogadoId) {
            if (!advogadoId || !this.advogados) return 'Não informado';
            const advogado = this.advogados.find(a => a.id === advogadoId);
            return advogado ? `${advogado.nome} (OAB: ${advogado.oab})` : 'Advogado não encontrado';
        }
    }
}
</script>

<style scoped>
.info-advogado {
  font-size: 10pt !important;
  color: #2980b9;
  background-color: rgba(52, 152, 219, 0.07);
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  border-left: 3px solid #3498db;
}
.info-advogado p {
  font-size: 10pt !important;
  margin: 0;
}
.info-advogado strong {
  color: #2980b9;
}

.tax-info {
  background-color: #f9ebea;
  border-left: 3px solid #e74c3c;
  padding: 0.75rem;
  margin-top: 0.5rem;
  border-radius: 4px;
  font-size: 10pt;
}

.tax-info p {
  margin: 0;
  font-size: 10pt !important;
}
</style>