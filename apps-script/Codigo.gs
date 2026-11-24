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
  integrantes: 'Integrantes',
  presencas: 'Presencas',
  logs: 'Logs',
};

const COL_ID_INTEGRANTE = 'ID Integrante';

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
    case 'integrantes.listar':     return listarIntegrantes_();
    case 'integrantes.salvar':     return salvarIntegrante_(usuario, payload);
    case 'presencas.chamada':      return lerChamada_(payload);
    case 'presencas.salvar':       return salvarChamada_(usuario, payload);
    case 'presencas.resumo':       return resumoPresencas_(payload);
    case 'diagnostico':            return diagnostico_(usuario);
    default: throw new Error('Ação desconhecida: ' + action);
  }
}

// ---------------------------------------------------------------------- acesso

/** Confere o token do Google e devolve o chefe correspondente na aba Usuarios. */
function autenticar_(token) {
  if (!token) throw new Error('SEM_LOGIN');

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
    linha['ID'] = existente ? existente['ID'] : String(Date.now());

    const numeroLinha = escreverLinha_(tab.aba, tab.cabecalho, linha, existente ? existente._linha : null);
    registrarLog_(usuario, 'Cadastro', existente ? 'Edição' : 'Inclusão',
      (existente ? 'Atualizou a ficha de: ' : 'Cadastrou: ') + linha['NOME']);
    return { id: linha['ID'], linha: numeroLinha };
  });
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
  });

  return {
    chamadas: Object.keys(chamadas).length,
    pessoas: Object.keys(porPessoa).map(function (k) {
      const p = porPessoa[k];
      p.percentual = p.total ? Math.round((p.presente / p.total) * 100) : 0;
      return p;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
  };
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
