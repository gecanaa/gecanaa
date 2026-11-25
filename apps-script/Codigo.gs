/**
 * SGE Canaã 52 — API do sistema (Google Apps Script)
 * A planilha continua sendo o banco de dados. Este script é publicado como
 * Web App e responde JSON para o site hospedado no GitHub Pages.
 *
 * Propriedades de script obrigatórias (Projeto > Configurações > Propriedades):
 *   SHEET_ID          id da planilha (o trecho entre /d/ e /edit na URL)
 *   GOOGLE_CLIENT_ID  id do cliente OAuth usado no login do site
 *   ADMIN_BOOTSTRAP   e-mail que entra como admin enquanto a coluna EMAIL
 *                     da aba Usuarios ainda não estiver preenchida
 */

const ABAS = {
  usuarios: 'Usuarios',
  financeiro: 'Financeiro',
  integrantes: 'Integrantes',
  presencas: 'Presencas',
  logs: 'Logs',
};

const COL_ID_INTEGRANTE = 'ID Integrante';

/**
 * Rode uma vez pelo editor (Executar) depois de colar este código: o Google
 * pede a autorização das permissões novas, inclusive a do Drive usada para
 * guardar as fotos. Sem isso, o envio de foto falha na primeira tentativa.
 */
function autorizar() {
  const planilha = planilha_();
  const pasta = pastaDeFotos_();
  Logger.log('Planilha: ' + planilha.getName());
  Logger.log('Pasta das fotos: ' + pasta.getName());
  Logger.log('Tudo autorizado.');
}

// ---------------------------------------------------------------- entrada HTTP

function doGet(e) {
  return responder_(function () {
    return despachar_(e.parameter.action, e.parameter, e.parameter.token);
  });
}

function doPost(e) {
  return responder_(function () {
    const corpo = JSON.parse(e.postData.contents || '{}');
    return despachar_(corpo.action, corpo.payload || {}, corpo.token);
  });
}

function responder_(fn) {
  let saida;
  try {
    saida = { ok: true, data: fn() };
  } catch (erro) {
    saida = { ok: false, erro: String(erro && erro.message || erro) };
  }
  return ContentService.createTextOutput(JSON.stringify(saida))
    .setMimeType(ContentService.MimeType.JSON);
}

function despachar_(action, payload, token) {
  if (action === 'ping') return { versao: '1.0.0', hora: new Date().toISOString() };

  const usuario = autenticar_(token);

  switch (action) {
    case 'me':                     return usuario;
    case 'inicio':                 return { usuario: usuario, integrantes: listarIntegrantes_(), config: lerConfig_() };
    case 'sessao.criar':           return criarSessao_(usuario);
    case 'config.ler':             return lerConfig_();
    case 'config.salvar':          return salvarConfig_(usuario, payload);
    case 'integrantes.listar':     return listarIntegrantes_();
    case 'integrantes.salvar':     return salvarIntegrante_(usuario, payload);
    case 'foto.enviar':            return enviarFoto_(usuario, payload);
    case 'presencas.chamada':      return lerChamada_(payload);
    case 'presencas.salvar':       return salvarChamada_(usuario, payload);
    case 'presencas.resumo':       return resumoPresencas_(payload);
    case 'financeiro.listar':      return listarFinanceiro_(usuario, payload);
    case 'financeiro.salvar':      return salvarLancamento_(usuario, payload);
    case 'financeiro.excluir':     return excluirLancamento_(usuario, payload);
    case 'mensalidades.mes':       return mensalidadesDoMes_(usuario, payload);
    case 'diagnostico':            return diagnostico_(usuario);
    default: throw new Error('Ação desconhecida: ' + action);
  }
}

// ---------------------------------------------------------------------- acesso

/**
 * Aceita dois tipos de credencial: o token de login do Google (válido por
 * uma hora) e a sessão emitida por este script (válida por 30 dias, para o
 * chefe não precisar entrar de novo a cada vez que abre o app).
 */
function autenticar_(token) {
  if (!token) throw new Error('SEM_LOGIN');

  if (String(token).indexOf('s1.') === 0) {
    const email = conferirSessao_(token);
    const chefe = acharUsuario_(email);
    if (!chefe) throw new Error('NAO_AUTORIZADO');
    return Object.assign({}, chefe, { emailGoogle: email });
  }

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID não configurado no script.');

  const cache = CacheService.getScriptCache();
  const chave = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  let conta = cache.get(chave);

  if (conta) {
    conta = JSON.parse(conta);
  } else {
    const resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('LOGIN_INVALIDO');
    const info = JSON.parse(resp.getContentText());
    if (info.aud !== clientId) throw new Error('LOGIN_INVALIDO');
    if (String(info.email_verified) !== 'true') throw new Error('LOGIN_INVALIDO');
    if (Number(info.exp) * 1000 < Date.now()) throw new Error('LOGIN_EXPIRADO');
    conta = { email: String(info.email).toLowerCase(), nome: info.name || '', foto: info.picture || '' };
    cache.put(chave, JSON.stringify(conta), 1800);
  }

  const chefe = acharUsuario_(conta.email);
  if (!chefe) throw new Error('NAO_AUTORIZADO');
  return Object.assign({}, chefe, { foto: conta.foto, emailGoogle: conta.email });
}

const DIAS_DE_SESSAO = 30;

function segredoDaSessao_() {
  const props = PropertiesService.getScriptProperties();
  let segredo = props.getProperty('SESSAO_SEGREDO');
  if (!segredo) {
    segredo = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSAO_SEGREDO', segredo);
  }
  return segredo;
}

function assinar_(texto) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(texto, segredoDaSessao_()));
}

/** Troca um login do Google por uma sessão longa deste sistema. */
function criarSessao_(usuario) {
  const corpo = Utilities.base64EncodeWebSafe(JSON.stringify({
    email: usuario.emailGoogle || usuario.email,
    exp: Date.now() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000,
  }));
  return { token: 's1.' + corpo + '.' + assinar_(corpo), dias: DIAS_DE_SESSAO };
}

function conferirSessao_(token) {
  const partes = String(token).split('.');
  if (partes.length !== 3) throw new Error('LOGIN_INVALIDO');
  if (assinar_(partes[1]) !== partes[2]) throw new Error('LOGIN_INVALIDO');
  let dados;
  try {
    dados = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[1])).getDataAsString());
  } catch (e) {
    throw new Error('LOGIN_INVALIDO');
  }
  if (!dados.exp || dados.exp < Date.now()) throw new Error('LOGIN_EXPIRADO');
  return String(dados.email).toLowerCase();
}

// -------------------------------------------------------------- configuracoes

/** Preferências do grupo, valendo para todos os chefes. */
function lerConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    justificativaAtiva: props.getProperty('JUSTIFICATIVA_ATIVA') === 'sim',
    // Período que vale para a premiação de assiduidade.
    rankingDe: props.getProperty('RANKING_DE') || '',
    rankingAte: props.getProperty('RANKING_ATE') || '',
    // Valor cheio da mensalidade; o plano de cada ficha ajusta daí.
    mensalidadeValor: Number(props.getProperty('MENSALIDADE_VALOR') || 0),
  };
}

function salvarConfig_(usuario, payload) {
  if (usuario.nivel !== 'admin') throw new Error('Só administradores mudam as configurações.');
  const props = PropertiesService.getScriptProperties();
  const mudancas = [];

  if (Object.prototype.hasOwnProperty.call(payload, 'justificativaAtiva')) {
    props.setProperty('JUSTIFICATIVA_ATIVA', payload.justificativaAtiva ? 'sim' : 'nao');
    mudancas.push('justificativa de falta ' + (payload.justificativaAtiva ? 'ativada' : 'desativada'));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'rankingDe')) {
    props.setProperty('RANKING_DE', String(payload.rankingDe || ''));
    mudancas.push('início do ranking em ' + (payload.rankingDe || 'sem data'));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'rankingAte')) {
    props.setProperty('RANKING_ATE', String(payload.rankingAte || ''));
    mudancas.push('fim do ranking em ' + (payload.rankingAte || 'sem data'));
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'mensalidadeValor')) {
    props.setProperty('MENSALIDADE_VALOR', String(Number(payload.mensalidadeValor) || 0));
    mudancas.push('mensalidade cheia em R$ ' + (Number(payload.mensalidadeValor) || 0));
  }

  if (mudancas.length) registrarLog_(usuario, 'Configuração', 'Edição', mudancas.join('; ') + '.');
  return lerConfig_();
}

function acharUsuario_(email) {
  const tab = tabela_(ABAS.usuarios);
  const achado = tab.linhas.filter(function (l) {
    return String(l['EMAIL'] || '').trim().toLowerCase() === email;
  })[0];

  if (achado) {
    return {
      id: String(achado['ID'] || ''),
      nome: String(achado['NOME'] || '').trim(),
      email: email,
      nivel: String(achado['NIVEL DE ACESSO'] || 'geral').trim().toLowerCase(),
    };
  }

  // Enquanto nenhum e-mail estiver preenchido na planilha, o e-mail de
  // bootstrap entra como admin para poder cadastrar os demais chefes.
  const temAlgumEmail = tab.linhas.some(function (l) { return String(l['EMAIL'] || '').trim(); });
  const bootstrap = String(
    PropertiesService.getScriptProperties().getProperty('ADMIN_BOOTSTRAP') || '')
    .trim().toLowerCase();
  if (!temAlgumEmail && bootstrap && bootstrap === email) {
    return { id: '', nome: 'Administrador', email: email, nivel: 'admin' };
  }
  return null;
}

/** Quem mexe no caixa: administradores e quem tem o nível financeiro. */
function exigirFinanceiro_(usuario) {
  const nivel = String(usuario.nivel || '').trim().toLowerCase();
  if (nivel !== 'admin' && nivel !== 'financeiro') {
    throw new Error('SEM_PERMISSAO_FINANCEIRO');
  }
}

// -------------------------------------------------------------- acesso à planilha

function planilha_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID não configurado no script.');
  return SpreadsheetApp.openById(id);
}

/** Lê uma aba inteira como lista de objetos, usando a primeira linha como cabeçalho. */
function tabela_(nome) {
  const aba = planilha_().getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: ' + nome);
  const valores = aba.getDataRange().getDisplayValues();
  const cabecalho = (valores.shift() || []).map(function (c) { return String(c).trim(); });
  const linhas = valores.map(function (linha, i) {
    const obj = { _linha: i + 2 };
    cabecalho.forEach(function (col, j) { if (col) obj[col] = linha[j]; });
    return obj;
  }).filter(function (obj) {
    return Object.keys(obj).some(function (k) { return k !== '_linha' && String(obj[k]).trim(); });
  });
  return { aba: aba, cabecalho: cabecalho, linhas: linhas };
}

/** Garante que a coluna exista, criando-a ao final da aba se preciso. */
function garantirColuna_(aba, nome) {
  const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0]
    .map(function (c) { return String(c).trim(); });
  let idx = cabecalho.indexOf(nome);
  if (idx === -1) {
    idx = cabecalho.length;
    aba.getRange(1, idx + 1).setValue(nome);
  }
  return idx + 1;
}

function escreverLinha_(aba, cabecalho, objeto, numeroLinha) {
  const valores = cabecalho.map(function (col) {
    return Object.prototype.hasOwnProperty.call(objeto, col) ? objeto[col] : '';
  });
  if (numeroLinha) {
    aba.getRange(numeroLinha, 1, 1, valores.length).setValues([valores]);
    return numeroLinha;
  }
  aba.appendRow(valores);
  return aba.getLastRow();
}

function registrarLog_(usuario, modulo, acao, detalhes) {
  try {
    const aba = planilha_().getSheetByName(ABAS.logs);
    if (!aba) return;
    aba.appendRow([
      Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'),
      usuario.nome || usuario.email, modulo, acao, detalhes,
    ]);
  } catch (e) { /* log nunca derruba a operação */ }
}

function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try { return fn(); } finally { trava.releaseLock(); }
}

// ------------------------------------------------------------------ integrantes

function listarIntegrantes_() {
  return tabela_(ABAS.integrantes).linhas.map(function (l) {
    return {
      id: String(l['ID'] || ''),
      nome: String(l['NOME'] || '').trim(),
      registroUeb: l['REGISTRO UEB'] || '',
      validadeUeb: l['VALIDADE UEB'] || '',
      ramo: String(l['RAMO'] || '').trim(),
      nascimento: l['NASC'] || '',
      sexo: l['Sexo'] || '',
      telefone: l['Telefone Pessoal'] || '',
      email: l['E-mail'] || '',
      endereco: l['Endereço'] || '',
      bairro: l['Bairro'] || '',
      cidade: l['Cidade'] || '',
      contatoEmergencia: l['Nome Contato Emergência'] || '',
      telefoneEmergencia: l['Telefone Emergência'] || '',
      alergia: l['Alergia'] || '',
      tipoSanguineo: l['Tipo Sanguíneo'] || '',
      restricoesAlimentares: l['Restrições Alimentares'] || '',
      status: String(l['Status'] || '').trim(),
      planoFinanceiro: l['Plano Financeiro'] || '',
      dataInicio: l['Data início'] || '',
      autorizacaoMedica: l['Autorização médica'] || '',
      neurodivergencia: l['Neurodivergencia'] || '',
      sabeNadar: l['Sabe nadar?'] || '',
      foto: l['Foto'] || '',
      _linha: l._linha,
    };
  });
}

const CAMPO_PARA_COLUNA = {
  nome: 'NOME', registroUeb: 'REGISTRO UEB', validadeUeb: 'VALIDADE UEB', ramo: 'RAMO',
  nascimento: 'NASC', sexo: 'Sexo', telefone: 'Telefone Pessoal', email: 'E-mail',
  endereco: 'Endereço', bairro: 'Bairro', cidade: 'Cidade',
  contatoEmergencia: 'Nome Contato Emergência', telefoneEmergencia: 'Telefone Emergência',
  alergia: 'Alergia', tipoSanguineo: 'Tipo Sanguíneo',
  restricoesAlimentares: 'Restrições Alimentares', status: 'Status',
  planoFinanceiro: 'Plano Financeiro', dataInicio: 'Data início',
  autorizacaoMedica: 'Autorização médica', neurodivergencia: 'Neurodivergencia',
  sabeNadar: 'Sabe nadar?', foto: 'Foto',
};

function salvarIntegrante_(usuario, payload) {
  if (!String(payload.nome || '').trim()) throw new Error('O nome é obrigatório.');

  return comTrava_(function () {
    const tab = tabela_(ABAS.integrantes);
    const existente = payload.id
      ? tab.linhas.filter(function (l) { return String(l['ID']) === String(payload.id); })[0]
      : null;

    const linha = {};
    tab.cabecalho.forEach(function (col) {
      if (existente && Object.prototype.hasOwnProperty.call(existente, col)) linha[col] = existente[col];
    });
    Object.keys(CAMPO_PARA_COLUNA).forEach(function (campo) {
      if (Object.prototype.hasOwnProperty.call(payload, campo)) {
        linha[CAMPO_PARA_COLUNA[campo]] = payload[campo];
      }
    });
    // Um ID vindo do app permite reenviar a mesma gravação sem duplicar.
    linha['ID'] = existente ? existente['ID'] : String(payload.id || Date.now());

    const numeroLinha = escreverLinha_(tab.aba, tab.cabecalho, linha, existente ? existente._linha : null);
    registrarLog_(usuario, 'Cadastro', existente ? 'Edição' : 'Inclusão',
      (existente ? 'Atualizou a ficha de: ' : 'Cadastrou: ') + linha['NOME']);
    return { id: linha['ID'], linha: numeroLinha };
  });
}

/**
 * Recebe a foto tirada no celular (já reduzida pelo app) e guarda no Drive,
 * numa pasta do próprio grupo, devolvendo o link no mesmo formato que a
 * planilha sempre usou.
 */
function enviarFoto_(usuario, payload) {
  const dados = String(payload.imagem || '');
  const nome = String(payload.nome || 'integrante').trim() || 'integrante';
  if (dados.indexOf('data:image/') !== 0) throw new Error('Formato de imagem não reconhecido.');

  const tipo = dados.substring(5, dados.indexOf(';'));
  const bytes = Utilities.base64Decode(dados.substring(dados.indexOf(',') + 1));
  const blob = Utilities.newBlob(bytes, tipo,
    nome.replace(/[^\p{L}\p{N} ]/gu, '').substring(0, 60) + ' - ' +
    Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss') + '.jpg');

  const recibo = String(payload.tipo || '') === 'recibo';
  const arquivo = (recibo ? pastaDeRecibos_() : pastaDeFotos_()).createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  registrarLog_(usuario, recibo ? 'Financeiro' : 'Cadastro', 'Foto',
    (recibo ? 'Anexou o comprovante: ' : 'Enviou a foto de: ') + nome);
  return { url: 'https://drive.google.com/thumbnail?id=' + arquivo.getId() + '&sz=w500' };
}

function pastaDeRecibos_() {
  return pastaGuardada_('RECIBOS_PASTA_ID', 'Comprovantes SGE Canaã 52');
}

function pastaGuardada_(propriedade, nome) {
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty(propriedade);
  if (guardada) {
    try {
      return DriveApp.getFolderById(guardada);
    } catch (e) {
      /* pasta apagada: cria outra abaixo */
    }
  }
  const pasta = DriveApp.createFolder(nome);
  props.setProperty(propriedade, pasta.getId());
  return pasta;
}

function pastaDeFotos_() {
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty('FOTOS_PASTA_ID');
  if (guardada) {
    try {
      return DriveApp.getFolderById(guardada);
    } catch (e) {
      /* pasta apagada: cria outra abaixo */
    }
  }
  const pasta = DriveApp.createFolder('Fotos SGE Canaã 52');
  props.setProperty('FOTOS_PASTA_ID', pasta.getId());
  return pasta;
}

// --------------------------------------------------------------------- presença

/** Chamada de um dia/ramo: o que já foi registrado, por integrante. */
function lerChamada_(payload) {
  const data = String(payload.data || '').trim();
  const ramo = String(payload.ramo || '').trim();
  if (!data || !ramo) throw new Error('Informe data e ramo.');

  const tab = tabela_(ABAS.presencas);
  const doDia = tab.linhas.filter(function (l) {
    return normalizarData_(l['DATA']) === data && String(l['Ramo']).trim() === ramo;
  });

  const porIntegrante = {};
  doDia.forEach(function (l) {
    const chave = String(l[COL_ID_INTEGRANTE] || '').trim() || 'nome:' + normalizarNome_(l['Nome do Integrante']);
    porIntegrante[chave] = {
      idChamada: String(l['ID da Chamada'] || ''),
      idIntegrante: String(l[COL_ID_INTEGRANTE] || ''),
      nome: l['Nome do Integrante'],
      status: l['Status'],
      registradoPor: l['Registrado por'],
      justificativa: l['Justificativa'] || '',
    };
  });

  return { data: data, ramo: ramo, registros: porIntegrante, total: doDia.length };
}

/**
 * Grava a chamada do dia. Substitui o que já existia para a mesma data e ramo,
 * então salvar duas vezes não gera linha duplicada.
 */
function salvarChamada_(usuario, payload) {
  const data = String(payload.data || '').trim();
  const ramo = String(payload.ramo || '').trim();
  const itens = payload.itens || [];
  if (!data || !ramo) throw new Error('Informe data e ramo.');
  if (!itens.length) throw new Error('Nenhum integrante na chamada.');

  return comTrava_(function () {
    const tab = tabela_(ABAS.presencas);
    garantirColuna_(tab.aba, COL_ID_INTEGRANTE);
    const cabecalho = tab.cabecalho.indexOf(COL_ID_INTEGRANTE) === -1
      ? tab.cabecalho.concat([COL_ID_INTEGRANTE]) : tab.cabecalho;

    // apaga de baixo para cima as linhas daquele dia/ramo
    tab.linhas
      .filter(function (l) {
        return normalizarData_(l['DATA']) === data && String(l['Ramo']).trim() === ramo;
      })
      .map(function (l) { return l._linha; })
      .sort(function (a, b) { return b - a; })
      .forEach(function (n) { tab.aba.deleteRow(n); });

    const idChamada = String(Date.now());
    const novas = itens.map(function (item) {
      return cabecalho.map(function (col) {
        switch (col) {
          case 'ID da Chamada': return idChamada;
          case 'DATA': return data;
          case 'Ramo': return ramo;
          case 'Nome do Integrante': return item.nome;
          case 'Status': return item.status;
          case 'Registrado por': return usuario.nome || usuario.email;
          case 'Justificativa': return item.justificativa || '';
          case COL_ID_INTEGRANTE: return item.idIntegrante || '';
          default: return '';
        }
      });
    });

    tab.aba.getRange(tab.aba.getLastRow() + 1, 1, novas.length, cabecalho.length).setValues(novas);

    const presentes = itens.filter(function (i) { return i.status === 'Presente'; }).length;
    registrarLog_(usuario, 'Presença', 'Chamada',
      'Chamada ' + ramo + ' em ' + data + ': ' + presentes + ' presentes de ' + itens.length + '.');
    return { idChamada: idChamada, gravados: itens.length, presentes: presentes };
  });
}

/** Percentual de presença por integrante dentro de um intervalo de datas. */
function resumoPresencas_(payload) {
  const de = String(payload.de || '0000-00-00');
  const ate = String(payload.ate || '9999-99-99');
  const ramo = String(payload.ramo || '').trim();

  const linhas = tabela_(ABAS.presencas).linhas.filter(function (l) {
    const d = normalizarData_(l['DATA']);
    return d >= de && d <= ate && (!ramo || String(l['Ramo']).trim() === ramo);
  });

  const chamadas = {};
  const porPessoa = {};
  const historico = {};
  linhas.forEach(function (l) {
    const d = normalizarData_(l['DATA']);
    chamadas[d + '|' + l['Ramo']] = true;
    const nome = String(l['Nome do Integrante'] || '').trim();
    const chave = String(l[COL_ID_INTEGRANTE] || '').trim() || 'nome:' + normalizarNome_(nome);
    const p = porPessoa[chave] || (porPessoa[chave] = {
      idIntegrante: String(l[COL_ID_INTEGRANTE] || ''), nome: nome, ramo: String(l['Ramo'] || '').trim(),
      presente: 0, falta: 0, justificada: 0, total: 0,
    });
    p.total++;
    const st = String(l['Status'] || '').toLowerCase();
    if (st.indexOf('presen') === 0) p.presente++;
    else if (st.indexOf('justific') >= 0) p.justificada++;
    else p.falta++;

    (historico[chave] || (historico[chave] = [])).push({ data: d, presente: st.indexOf('presen') === 0 });
  });

  return {
    chamadas: Object.keys(chamadas).length,
    pessoas: Object.keys(porPessoa).map(function (k) {
      const p = porPessoa[k];
      p.percentual = p.total ? Math.round((p.presente / p.total) * 100) : 0;

      // Quantas chamadas seguidas a pessoa não aparece, contando da última
      // para trás: é o sinal de quem está se afastando.
      const dias = (historico[k] || []).sort(function (a, b) { return a.data < b.data ? 1 : -1; });
      let seguidas = 0;
      for (let i = 0; i < dias.length; i++) {
        if (dias[i].presente) break;
        seguidas++;
      }
      p.faltasSeguidas = seguidas;
      p.ultimaPresenca = (dias.filter(function (d) { return d.presente; })[0] || {}).data || '';
      return p;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
  };
}

// ------------------------------------------------------------------- financeiro

const COL_ID_INTEGRANTE_FIN = 'ID Integrante';
const COL_COMPROVANTE = 'Comprovante';

function lerLancamentos_() {
  return tabela_(ABAS.financeiro).linhas.map(function (l) {
    return {
      id: String(l['ID'] || ''),
      data: normalizarData_(l['DATA']),
      nome: String(l['NOME'] || '').trim(),
      tipo: String(l['TIPO'] || '').trim(),
      categoria: String(l['CATEGORIA'] || '').trim(),
      mes: String(l['MES'] || '').trim(),
      valor: paraNumero_(l['VALOR']),
      metodo: String(l['METODO'] || '').trim(),
      registrado: String(l['REGISTRADO'] || '').trim(),
      observacao: String(l['Observação'] || '').trim(),
      idIntegrante: String(l[COL_ID_INTEGRANTE_FIN] || '').trim(),
      comprovante: String(l[COL_COMPROVANTE] || '').trim(),
      _linha: l._linha,
    };
  });
}

/** Lançamentos do período, do mais novo para o mais antigo, com o resumo do caixa. */
function listarFinanceiro_(usuario, payload) {
  exigirFinanceiro_(usuario);
  const de = String(payload.de || '0000-00-00');
  const ate = String(payload.ate || '9999-99-99');

  const todos = lerLancamentos_();
  const periodo = todos.filter(function (l) { return l.data >= de && l.data <= ate; });

  let entradas = 0;
  let saidas = 0;
  const categorias = {};
  periodo.forEach(function (l) {
    const saida = l.tipo.toLowerCase().indexOf('sa') === 0;
    if (saida) saidas += l.valor; else entradas += l.valor;
    const chave = (saida ? 'Saída' : 'Entrada') + '|' + (l.categoria || 'Sem categoria');
    categorias[chave] = (categorias[chave] || 0) + l.valor;
  });

  // O saldo do caixa é histórico, não só do período escolhido.
  let saldoTotal = 0;
  todos.forEach(function (l) {
    saldoTotal += l.tipo.toLowerCase().indexOf('sa') === 0 ? -l.valor : l.valor;
  });

  periodo.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });

  return {
    lancamentos: periodo,
    entradas: entradas,
    saidas: saidas,
    saldoPeriodo: entradas - saidas,
    saldoTotal: saldoTotal,
    categorias: Object.keys(categorias).map(function (k) {
      const partes = k.split('|');
      return { tipo: partes[0], categoria: partes[1], total: categorias[k] };
    }).sort(function (a, b) { return b.total - a.total; }),
  };
}

function salvarLancamento_(usuario, payload) {
  exigirFinanceiro_(usuario);
  const valor = paraNumero_(payload.valor);
  if (!valor) throw new Error('Informe um valor maior que zero.');
  if (!payload.data) throw new Error('Informe a data.');
  if (!payload.tipo) throw new Error('Diga se é entrada ou saída.');

  return comTrava_(function () {
    const tab = tabela_(ABAS.financeiro);
    garantirColuna_(tab.aba, COL_ID_INTEGRANTE_FIN);
    garantirColuna_(tab.aba, COL_COMPROVANTE);
    let cabecalho = tab.cabecalho.slice();
    [COL_ID_INTEGRANTE_FIN, COL_COMPROVANTE].forEach(function (col) {
      if (cabecalho.indexOf(col) === -1) cabecalho = cabecalho.concat([col]);
    });

    const existente = payload.id
      ? tab.linhas.filter(function (l) { return String(l['ID']) === String(payload.id); })[0]
      : null;

    const linha = {};
    linha['ID'] = existente ? existente['ID'] : String(payload.id || Date.now());
    linha['DATA'] = String(payload.data);
    linha['NOME'] = String(payload.nome || '').trim();
    linha['TIPO'] = String(payload.tipo);
    linha['CATEGORIA'] = String(payload.categoria || '').trim();
    linha['MES'] = String(payload.mes || 'Não se aplica');
    linha['VALOR'] = valor;
    linha['METODO'] = String(payload.metodo || '').trim();
    linha['REGISTRADO'] = existente ? existente['REGISTRADO'] : (usuario.nome || usuario.email);
    linha['Observação'] = String(payload.observacao || '').trim();
    linha[COL_ID_INTEGRANTE_FIN] = String(payload.idIntegrante || '');
    linha[COL_COMPROVANTE] = String(payload.comprovante || (existente ? existente[COL_COMPROVANTE] : '') || '');

    escreverLinha_(tab.aba, cabecalho, linha, existente ? existente._linha : null);
    registrarLog_(usuario, 'Financeiro', existente ? 'Edição' : 'Inclusão',
      linha['TIPO'] + ' de R$ ' + valor + ' em ' + linha['CATEGORIA'] +
      (linha['NOME'] ? ' (' + linha['NOME'] + ')' : '') + '.');
    return { id: linha['ID'] };
  });
}

function excluirLancamento_(usuario, payload) {
  exigirFinanceiro_(usuario);
  const id = String(payload.id || '');
  if (!id) throw new Error('Informe qual lançamento excluir.');

  return comTrava_(function () {
    const tab = tabela_(ABAS.financeiro);
    const alvo = tab.linhas.filter(function (l) { return String(l['ID']) === id; })[0];
    if (!alvo) throw new Error('Lançamento não encontrado.');
    tab.aba.deleteRow(alvo._linha);
    registrarLog_(usuario, 'Financeiro', 'Exclusão',
      'Excluiu ' + alvo['TIPO'] + ' de R$ ' + alvo['VALOR'] + ' de ' + (alvo['NOME'] || 'sem nome') + '.');
    return { excluido: id };
  });
}

/** Quem pagou e quem deve a mensalidade de um mês (formato aaaa-mm). */
function mensalidadesDoMes_(usuario, payload) {
  exigirFinanceiro_(usuario);
  const mes = String(payload.mes || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Informe o mês no formato aaaa-mm.');

  const cheia = Number(PropertiesService.getScriptProperties().getProperty('MENSALIDADE_VALOR') || 0);
  const pagamentos = lerLancamentos_().filter(function (l) {
    return l.mes === mes && l.categoria.toLowerCase().indexOf('mensalidade') === 0;
  });

  const pessoas = listarIntegrantes_()
    .filter(function (i) { return i.status === 'Ativo'; })
    .map(function (i) {
      const esperado = valorDoPlano_(i.planoFinanceiro, cheia);
      const pagos = pagamentos.filter(function (l) {
        return (l.idIntegrante && l.idIntegrante === i.id) ||
          (!l.idIntegrante && normalizarNome_(l.nome) === normalizarNome_(i.nome));
      });
      const pago = pagos.reduce(function (t, l) { return t + l.valor; }, 0);
      const detalhes = pagos.map(function (l) {
        return {
          id: l.id, data: l.data, valor: l.valor, metodo: l.metodo,
          comprovante: l.comprovante, observacao: l.observacao, registrado: l.registrado,
        };
      });
      const isento = String(i.planoFinanceiro || '').toLowerCase().indexOf('isent') >= 0;
      return {
        id: i.id, nome: i.nome, ramo: i.ramo, plano: i.planoFinanceiro || 'Integral',
        esperado: esperado, pago: pago, pagamentos: detalhes,
        // Sem o valor cheio configurado, ninguém é isento: o sistema é que
        // ainda não sabe quanto cobrar.
        situacao: isento ? 'Isento'
          : cheia === 0 ? 'Sem valor'
          : pago >= esperado ? 'Pago'
          : pago > 0 ? 'Parcial'
          : 'Em aberto',
      };
    });

  return {
    mes: mes,
    mensalidadeCheia: cheia,
    recebido: pagamentos.reduce(function (t, l) { return t + l.valor; }, 0),
    esperado: pessoas.reduce(function (t, p) { return t + p.esperado; }, 0),
    pessoas: pessoas.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
  };
}

function valorDoPlano_(plano, cheia) {
  const p = String(plano || '').toLowerCase();
  if (p.indexOf('isent') >= 0) return 0;
  if (p.indexOf('50') >= 0) return Math.round(cheia * 50) / 100;
  return cheia;
}

/** Aceita 35, "35", "R$ 35,00" e "1.234,56". */
function paraNumero_(valor) {
  if (typeof valor === 'number') return valor;
  const limpo = String(valor || '').replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

// ------------------------------------------------------------------ diagnóstico

/** Aponta problemas de dados herdados da planilha, sem alterar nada. */
function diagnostico_(usuario) {
  if (usuario.nivel !== 'admin') throw new Error('Só administradores podem rodar o diagnóstico.');

  const integrantes = listarIntegrantes_();
  const presencas = tabela_(ABAS.presencas).linhas;

  const porNome = {};
  integrantes.forEach(function (i) {
    const k = normalizarNome_(i.nome);
    (porNome[k] || (porNome[k] = [])).push(i);
  });

  const nomesDuplicados = Object.keys(porNome)
    .filter(function (k) { return porNome[k].length > 1; })
    .map(function (k) { return porNome[k].map(function (i) { return i.nome + ' (ID ' + i.id + ')'; }); });

  const semVinculo = {};
  presencas.forEach(function (l) {
    if (String(l[COL_ID_INTEGRANTE] || '').trim()) return;
    const nome = String(l['Nome do Integrante'] || '').trim();
    if (!nome) return;
    if (!porNome[normalizarNome_(nome)]) semVinculo[nome] = (semVinculo[nome] || 0) + 1;
  });

  const chamadasRepetidas = {};
  const vistos = {};
  presencas.forEach(function (l) {
    const k = normalizarData_(l['DATA']) + '|' + String(l['Ramo']).trim() + '|' +
      normalizarNome_(l['Nome do Integrante']);
    if (vistos[k]) chamadasRepetidas[k] = (chamadasRepetidas[k] || 1) + 1;
    vistos[k] = true;
  });

  const uebVencida = integrantes.filter(function (i) {
    const v = normalizarData_(i.validadeUeb);
    return i.status === 'Ativo' && v && v < hojeISO_();
  }).map(function (i) { return i.nome + ' — venceu em ' + i.validadeUeb; });

  const semRamo = integrantes.filter(function (i) { return !i.ramo; })
    .map(function (i) { return i.nome; });

  return {
    integrantes: integrantes.length,
    linhasPresenca: presencas.length,
    nomesDuplicados: nomesDuplicados,
    presencasSemIntegrante: semVinculo,
    presencasRepetidas: Object.keys(chamadasRepetidas),
    uebVencida: uebVencida,
    semRamo: semRamo,
  };
}

// ----------------------------------------------------------------------- backup

const BACKUPS_GUARDADOS = 8;

/**
 * Rode `instalarBackupSemanal` UMA vez pelo editor. A partir daí, toda
 * segunda-feira de madrugada o sistema guarda uma cópia da planilha numa
 * pasta do Drive e mantém as oito mais recentes.
 */
function instalarBackupSemanal() {
  ScriptApp.getProjectTriggers()
    .filter(function (g) { return g.getHandlerFunction() === 'backupSemanal'; })
    .forEach(function (g) { ScriptApp.deleteTrigger(g); });

  ScriptApp.newTrigger('backupSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(3)
    .create();

  backupSemanal();
  Logger.log('Backup semanal instalado e primeira cópia criada.');
}

function backupSemanal() {
  const pasta = pastaDeBackups_();
  const arquivo = DriveApp.getFileById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const copia = arquivo.makeCopy(
    'Backup ' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd') +
    ' - ' + arquivo.getName(), pasta);

  // Mantém só as cópias mais recentes, para a pasta não crescer sem fim.
  const antigos = [];
  const lista = pasta.getFiles();
  while (lista.hasNext()) {
    const f = lista.next();
    antigos.push({ arquivo: f, quando: f.getDateCreated().getTime() });
  }
  antigos.sort(function (a, b) { return b.quando - a.quando; })
    .slice(BACKUPS_GUARDADOS)
    .forEach(function (item) { item.arquivo.setTrashed(true); });

  Logger.log('Cópia criada: ' + copia.getName());
  return copia.getId();
}

function pastaDeBackups_() {
  const props = PropertiesService.getScriptProperties();
  const guardada = props.getProperty('BACKUPS_PASTA_ID');
  if (guardada) {
    try {
      return DriveApp.getFolderById(guardada);
    } catch (e) {
      /* pasta apagada: cria outra abaixo */
    }
  }
  const pasta = DriveApp.createFolder('Backups SGE Canaã 52');
  props.setProperty('BACKUPS_PASTA_ID', pasta.getId());
  return pasta;
}

// ------------------------------------------------------------------- utilidades

/** Aceita 2026-02-28, 28/02/2026 e 28/02/2026 21:01:59; devolve sempre aaaa-mm-dd. */
function normalizarData_(valor) {
  const s = String(valor || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}

function normalizarNome_(valor) {
  return String(valor || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function hojeISO_() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
}
