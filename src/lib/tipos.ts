export type Usuario = {
  id: string;
  nome: string;
  email: string;
  nivel: 'admin' | 'geral' | string;
  foto?: string;
};

export type Integrante = {
  id: string;
  nome: string;
  registroUeb: string;
  validadeUeb: string;
  ramo: string;
  nascimento: string;
  sexo: string;
  telefone: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  contatoEmergencia: string;
  telefoneEmergencia: string;
  alergia: string;
  tipoSanguineo: string;
  restricoesAlimentares: string;
  status: string;
  planoFinanceiro: string;
  dataInicio: string;
  autorizacaoMedica: string;
  neurodivergencia: string;
  sabeNadar: string;
  foto: string;
};

export type StatusPresenca = 'Presente' | 'Falta' | 'Falta justificada';

export type RegistroChamada = {
  idChamada: string;
  idIntegrante: string;
  nome: string;
  status: StatusPresenca;
  registradoPor: string;
  justificativa: string;
};

export type Chamada = {
  data: string;
  ramo: string;
  registros: Record<string, RegistroChamada>;
  total: number;
};
