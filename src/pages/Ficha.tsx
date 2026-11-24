import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { useDados } from '../lib/dados';
import { ramo as corDoRamo, RAMOS_JOVENS } from '../lib/ramos';
import { Avatar, Carregando, Erro } from '../components/Estados';
import { Icone } from '../components/Icone';
import type { Integrante } from '../lib/tipos';

const VAZIO: Integrante = {
  id: '', nome: '', registroUeb: '', validadeUeb: '', ramo: '', nascimento: '', sexo: '',
  telefone: '', email: '', endereco: '', bairro: '', cidade: '', contatoEmergencia: '',
  telefoneEmergencia: '', alergia: '', tipoSanguineo: '', restricoesAlimentares: '',
  status: 'Ativo', planoFinanceiro: '', dataInicio: '', autorizacaoMedica: '',
  neurodivergencia: '', sabeNadar: '', foto: '',
};

export function Ficha() {
  const { id } = useParams();
  const novo = id === 'novo';
  const navegar = useNavigate();
  const api = useApi();
  const { integrantes, carregando, aplicar } = useDados();

  const original = useMemo(
    () => (novo ? VAZIO : integrantes.find((i) => i.id === id)),
    [novo, id, integrantes],
  );

  const [editando, setEditando] = useState(novo);
  const [rascunho, setRascunho] = useState<Integrante | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (carregando) return <Carregando texto="Carregando ficha" />;
  if (!original) {
    return (
      <main className="px-4 py-8">
        <Erro
          mensagem="Essa ficha não está na lista carregada."
          acao={<Link to="/integrantes" className="text-[14px] font-semibold underline">Voltar para os integrantes</Link>}
        />
      </main>
    );
  }

  const dados = rascunho ?? original;
  const r = corDoRamo(dados.ramo);

  const editar = (campo: keyof Integrante, valor: string) =>
    setRascunho({ ...(rascunho ?? original), [campo]: valor });

  const salvar = async () => {
    if (!dados.nome.trim()) {
      setErro('O nome é obrigatório.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r2 = await api<{ id: string }>('integrantes.salvar', dados);
      const salvo = { ...dados, id: r2.id };
      aplicar(salvo);
      setRascunho(null);
      setEditando(false);
      if (novo) navegar(`/integrantes/${r2.id}`, { replace: true });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a ficha.');
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = () => {
    setRascunho(null);
    setErro(null);
    if (novo) navegar('/integrantes');
    else setEditando(false);
  };

  return (
    <main className="pb-32">
      <div className="px-4 py-3">
        <Link to="/integrantes" className="inline-flex items-center gap-1 text-[14px] font-medium text-muted">
          <Icone nome="voltar" className="h-4 w-4" /> Integrantes
        </Link>
      </div>

      <header className="flex items-center gap-3.5 px-4 pb-5" style={{ borderLeft: `6px solid ${r.cor}` }}>
        <Avatar foto={dados.foto} nome={dados.nome || '?'} cor={r.cor} tamanho={64} />
        <div className="min-w-0">
          <h1 className="font-display text-[1.45rem] leading-tight font-[700] tracking-tight">
            {dados.nome.trim() || 'Nova ficha'}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {dados.ramo || 'Sem ramo'}
            {dados.status ? ` · ${dados.status}` : ''}
          </p>
        </div>
      </header>

      {erro ? <Erro mensagem={erro} /> : null}

      {/* O que se procura com pressa em atividade vem primeiro. */}
      <section className="mx-4 rounded-xl border border-ouro/35 bg-card-alto px-4 py-4">
        <h2 className="font-display text-[15px] font-[700]">Em caso de emergência</h2>
        <dl className="mt-3 space-y-2.5 text-[14px]">
          <Par rotulo="Responsável" valor={dados.contatoEmergencia} escuro />
          <Par
            rotulo="Telefone"
            valor={dados.telefoneEmergencia}
            escuro
            link={dados.telefoneEmergencia ? `tel:${dados.telefoneEmergencia.replace(/\D/g, '')}` : undefined}
          />
          <Par rotulo="Alergia" valor={dados.alergia} escuro destaque={!!dados.alergia && dados.alergia.toLowerCase() !== 'nenhuma'} />
          <Par rotulo="Tipo sanguíneo" valor={dados.tipoSanguineo} escuro />
          <Par rotulo="Restrições alimentares" valor={dados.restricoesAlimentares} escuro />
          <Par rotulo="Autorização médica" valor={dados.autorizacaoMedica} escuro />
          <Par rotulo="Sabe nadar" valor={dados.sabeNadar} escuro />
          <Par rotulo="Neurodivergência" valor={dados.neurodivergencia} escuro />
        </dl>
      </section>

      {editando ? (
        <div className="mt-6 space-y-6 px-4">
          <Grupo titulo="Identificação">
            <Campo rotulo="Nome completo" valor={dados.nome} onChange={(v) => editar('nome', v)} />
            <Selecao rotulo="Ramo" valor={dados.ramo} opcoes={[...RAMOS_JOVENS.map((x) => x.nome), 'Escotista', 'Chefia', 'Diretoria']} onChange={(v) => editar('ramo', v)} />
            <Selecao rotulo="Status" valor={dados.status} opcoes={['Ativo', 'Inativo', 'Desligado']} onChange={(v) => editar('status', v)} />
            <Campo rotulo="Registro UEB" valor={dados.registroUeb} onChange={(v) => editar('registroUeb', v)} />
            <Campo rotulo="Validade do registro UEB" tipo="date" valor={paraData(dados.validadeUeb)} onChange={(v) => editar('validadeUeb', v)} />
            <Campo rotulo="Nascimento" tipo="date" valor={paraData(dados.nascimento)} onChange={(v) => editar('nascimento', v)} />
            <Selecao rotulo="Sexo" valor={dados.sexo} opcoes={['Feminino', 'Masculino']} onChange={(v) => editar('sexo', v)} />
            <Campo rotulo="Entrou no grupo em" tipo="date" valor={paraData(dados.dataInicio)} onChange={(v) => editar('dataInicio', v)} />
            <Selecao rotulo="Plano financeiro" valor={dados.planoFinanceiro} opcoes={['Integral', 'Desconto 50%', 'Isento']} onChange={(v) => editar('planoFinanceiro', v)} />
          </Grupo>

          <Grupo titulo="Contato">
            <Campo rotulo="Telefone pessoal" tipo="tel" valor={dados.telefone} onChange={(v) => editar('telefone', v)} />
            <Campo rotulo="E-mail" tipo="email" valor={dados.email} onChange={(v) => editar('email', v)} />
            <Campo rotulo="Endereço" valor={dados.endereco} onChange={(v) => editar('endereco', v)} />
            <Campo rotulo="Bairro" valor={dados.bairro} onChange={(v) => editar('bairro', v)} />
            <Campo rotulo="Cidade" valor={dados.cidade} onChange={(v) => editar('cidade', v)} />
          </Grupo>

          <Grupo titulo="Saúde e emergência">
            <Campo rotulo="Responsável para emergência" valor={dados.contatoEmergencia} onChange={(v) => editar('contatoEmergencia', v)} />
            <Campo rotulo="Telefone de emergência" tipo="tel" valor={dados.telefoneEmergencia} onChange={(v) => editar('telefoneEmergencia', v)} />
            <Campo rotulo="Alergia" valor={dados.alergia} onChange={(v) => editar('alergia', v)} dica="Escreva Nenhuma quando não houver." />
            <Selecao rotulo="Tipo sanguíneo" valor={dados.tipoSanguineo} opcoes={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} onChange={(v) => editar('tipoSanguineo', v)} />
            <Campo rotulo="Restrições alimentares" valor={dados.restricoesAlimentares} onChange={(v) => editar('restricoesAlimentares', v)} />
            <Selecao rotulo="Autorização médica" valor={dados.autorizacaoMedica} opcoes={['Sim', 'Não']} onChange={(v) => editar('autorizacaoMedica', v)} />
            <Selecao rotulo="Sabe nadar" valor={dados.sabeNadar} opcoes={['Sim', 'Apenas no raso', 'Não', 'Não Informado']} onChange={(v) => editar('sabeNadar', v)} />
            <Campo rotulo="Neurodivergência" valor={dados.neurodivergencia} onChange={(v) => editar('neurodivergencia', v)} />
          </Grupo>

          <Grupo titulo="Foto">
            <Campo rotulo="Endereço da foto" valor={dados.foto} onChange={(v) => editar('foto', v)} dica="Link direto da imagem, como o do Drive já usado na planilha." />
          </Grupo>
        </div>
      ) : (
        <div className="mt-6 space-y-6 px-4">
          <Grupo titulo="Identificação">
            <dl className="space-y-2.5 text-[14px]">
              <Par rotulo="Registro UEB" valor={dados.registroUeb} />
              <Par rotulo="Validade do registro" valor={legivel(dados.validadeUeb)} />
              <Par rotulo="Nascimento" valor={legivel(dados.nascimento)} />
              <Par rotulo="Sexo" valor={dados.sexo} />
              <Par rotulo="Entrou no grupo em" valor={legivel(dados.dataInicio)} />
              <Par rotulo="Plano financeiro" valor={dados.planoFinanceiro} />
            </dl>
          </Grupo>
          <Grupo titulo="Contato">
            <dl className="space-y-2.5 text-[14px]">
              <Par rotulo="Telefone" valor={dados.telefone} link={dados.telefone ? `tel:${dados.telefone.replace(/\D/g, '')}` : undefined} />
              <Par rotulo="E-mail" valor={dados.email} link={dados.email ? `mailto:${dados.email}` : undefined} />
              <Par rotulo="Endereço" valor={[dados.endereco, dados.bairro, dados.cidade].filter(Boolean).join(', ')} />
            </dl>
          </Grupo>
        </div>
      )}

      <div className="nao-imprime sticky bottom-[calc(64px+env(safe-area-inset-bottom))] mt-8 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
        {editando ? (
          <div className="flex gap-3">
            <button type="button" onClick={cancelar} className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="ml-auto rounded-full bg-ouro px-5 py-2.5 text-[15px] font-semibold text-preto disabled:opacity-60"
            >
              {salvando ? 'Salvando' : 'Salvar ficha'}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Link
              to={`/imprimir?id=${dados.id}`}
              className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[14px] font-semibold"
            >
              <Icone nome="imprimir" className="h-4.5 w-4.5" /> PDF
            </Link>
            <button type="button" onClick={() => setEditando(true)} className="flex-1 rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto">
              Editar ficha
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[15px] font-[700]">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Par({ rotulo, valor, escuro, destaque, link }: { rotulo: string; valor?: string; escuro?: boolean; destaque?: boolean; link?: string }) {
  const conteudo = valor?.trim() ? valor : 'Não informado';
  const vazio = !valor?.trim();
  return (
    <div className="flex items-baseline gap-3">
      <dt className={`w-[46%] shrink-0 text-[12.5px] ${escuro ? 'text-texto/55' : 'text-muted'}`}>{rotulo}</dt>
      <dd className={`flex-1 ${vazio ? (escuro ? 'text-texto/40' : 'text-muted') : ''} ${destaque ? 'font-semibold text-ouro' : ''}`}>
        {link && !vazio ? <a href={link} className="underline">{conteudo}</a> : conteudo}
      </dd>
    </div>
  );
}

function Campo({ rotulo, valor, onChange, tipo = 'text', dica }: { rotulo: string; valor: string; onChange: (v: string) => void; tipo?: string; dica?: string }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-muted">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px]"
      />
      {dica ? <span className="mt-1 block text-[12px] text-muted">{dica}</span> : null}
    </label>
  );
}

function Selecao({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-muted">{rotulo}</span>
      <select
        value={opcoes.includes(valor) ? valor : ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px]"
      >
        <option value="">Não informado</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/** A planilha tem datas em dd/mm/aaaa e em aaaa-mm-dd; o campo precisa de ISO. */
function paraData(valor: string): string {
  const m = valor?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return (valor ?? '').slice(0, 10);
}

/** Mostra qualquer data da planilha como dd/mm/aaaa. */
function legivel(valor: string): string {
  const iso = paraData(valor ?? '');
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (valor ?? '');
}
