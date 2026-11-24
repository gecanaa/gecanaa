import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDados } from '../lib/dados';
import { ramo as corDoRamo } from '../lib/ramos';
import { useZoomLiberado } from '../lib/zoom';
import { Carregando } from '../components/Estados';
import type { Integrante } from '../lib/tipos';

const LOGO = `${import.meta.env.BASE_URL}logo.png`;

/**
 * Fichas prontas para imprimir ou salvar em PDF — pensadas para levar na
 * pasta da atividade: o que socorre primeiro vem primeiro.
 */
export function Imprimir() {
  useZoomLiberado();
  const [params] = useSearchParams();
  const { integrantes, carregando } = useDados();
  const id = params.get('id');
  const ramoAlvo = params.get('ramo');

  const lista = useMemo(() => {
    if (id) return integrantes.filter((i) => i.id === id);
    return integrantes.filter((i) => i.status === 'Ativo' && (!ramoAlvo || i.ramo === ramoAlvo));
  }, [integrantes, id, ramoAlvo]);

  useEffect(() => {
    if (!carregando && lista.length) {
      const t = window.setTimeout(() => window.print(), 700);
      return () => window.clearTimeout(t);
    }
  }, [carregando, lista.length]);

  if (carregando) return <Carregando texto="Preparando as fichas" />;

  return (
    <main className="px-4 py-5">
      <div className="nao-imprime mb-5 flex items-center gap-3">
        <Link to="/integrantes" className="text-[14px] font-medium text-muted underline">
          Voltar
        </Link>
        <button type="button" onClick={() => window.print()} className="ml-auto rounded-full bg-ouro px-5 py-2.5 text-[14px] font-semibold text-preto">
          Imprimir ou salvar em PDF
        </button>
      </div>

      <p className="nao-imprime mb-5 text-[13px] leading-relaxed text-muted">
        {lista.length} {lista.length === 1 ? 'ficha' : 'fichas'}
        {ramoAlvo ? ` do ramo ${ramoAlvo}` : ''}. No celular, escolha "Salvar como PDF" no destino da impressão.
      </p>

      {lista.map((i) => (
        <FichaImpressa key={i.id} integrante={i} />
      ))}
    </main>
  );
}

function FichaImpressa({ integrante: i }: { integrante: Integrante }) {
  const r = corDoRamo(i.ramo);
  const alergia = i.alergia?.trim();
  const temAlergia = alergia && alergia.toLowerCase() !== 'nenhuma';

  return (
    <article className="mb-6 break-inside-avoid rounded-xl border border-line p-4" style={{ borderLeft: `5px solid ${r.cor}` }}>
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <img src={LOGO} alt="" className="h-11 w-11 object-contain" />
        <div className="min-w-0">
          <p className="font-display text-[1.1rem] leading-tight font-[700]">{i.nome.trim()}</p>
          <p className="text-[12.5px] text-muted">
            {i.ramo || 'Sem ramo'} · Grupo Escoteiro Canaã 52/DF
          </p>
        </div>
      </header>

      <section className="mt-3">
        <h3 className="font-display text-[13px] font-[700]">Em caso de emergência</h3>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-7 gap-y-1 text-[13px]">
          <Item rotulo="Responsável" valor={i.contatoEmergencia} />
          <Item rotulo="Telefone" valor={i.telefoneEmergencia} />
          <Item rotulo="Alergia" valor={alergia} alerta={!!temAlergia} />
          <Item rotulo="Tipo sanguíneo" valor={i.tipoSanguineo} />
          <Item rotulo="Restrições alimentares" valor={i.restricoesAlimentares} />
          <Item rotulo="Autorização médica" valor={i.autorizacaoMedica} />
          <Item rotulo="Sabe nadar" valor={i.sabeNadar} />
          <Item rotulo="Neurodivergência" valor={i.neurodivergencia} />
        </dl>
      </section>

      <section className="mt-3 border-t border-line pt-3">
        <dl className="grid grid-cols-2 gap-x-7 gap-y-1 text-[13px]">
          <Item rotulo="Nascimento" valor={formatar(i.nascimento)} />
          <Item rotulo="Registro UEB" valor={i.registroUeb} />
          <Item rotulo="Validade UEB" valor={formatar(i.validadeUeb)} />
          <Item rotulo="Telefone pessoal" valor={i.telefone} />
          <Item rotulo="Endereço" valor={[i.endereco, i.bairro, i.cidade].filter(Boolean).join(', ')} />
          <Item rotulo="Plano financeiro" valor={i.planoFinanceiro} />
        </dl>
      </section>
    </article>
  );
}

function Item({ rotulo, valor, alerta }: { rotulo: string; valor?: string; alerta?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="shrink-0 text-muted">{rotulo}:</dt>
      <dd className={alerta ? 'font-semibold' : ''}>{valor?.trim() || '—'}</dd>
    </div>
  );
}

function formatar(valor: string): string {
  const m = (valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return valor ?? '';
}
