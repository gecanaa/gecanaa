import { useEffect, useRef } from 'react';
import { nomeBonito } from '../lib/texto';
import { Link } from 'react-router-dom';
import { ramo as corDoRamo } from '../lib/ramos';
import { Avatar } from './Estados';
import type { Integrante } from '../lib/tipos';

/** O essencial de um integrante, a um toque da foto, sem sair da chamada. */
export function ModalIntegrante({ integrante, aoFechar }: { integrante: Integrante; aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const r = corDoRamo(integrante.ramo);
  const alergia = integrante.alergia?.trim();
  const temAlergia = !!alergia && alergia.toLowerCase() !== 'nenhuma';

  useEffect(() => {
    caixa.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aoFechar]);

  const telefones = [
    { rotulo: integrante.contatoEmergencia || 'Responsável', numero: integrante.telefoneEmergencia },
    { rotulo: 'Telefone pessoal', numero: integrante.telefone },
  ].filter((t) => t.numero?.trim());

  return (
    <div
      className="nao-imprime fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={aoFechar}
      role="presentation"
    >
      <div
        ref={caixa}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Resumo de ${nomeBonito(integrante.nome)}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t-2 bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:border-t-0"
        style={{ borderTopColor: r.cor }}
      >
        <div className="flex items-center gap-3.5">
          <Avatar foto={integrante.foto} nome={integrante.nome} cor={r.cor} tamanho={72} />
          <div className="min-w-0">
            <h2 className="font-display text-[1.25rem] leading-tight font-[700]">{nomeBonito(integrante.nome)}</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {integrante.ramo || 'Sem ramo'}
              {integrante.status && integrante.status !== 'Ativo' ? ` · ${integrante.status}` : ''}
            </p>
          </div>
        </div>

        {temAlergia ? (
          <p className="mt-4 rounded-lg border-l-4 border-falta bg-[color-mix(in_srgb,var(--color-falta)_18%,var(--color-card))] px-3 py-2.5 text-[14px]">
            <span className="font-semibold">Alergia:</span> {alergia}
          </p>
        ) : null}

        {telefones.length ? (
          <div className="mt-4 grid gap-2">
            {telefones.map((t) => (
              <a
                key={t.numero}
                href={`tel:${t.numero.replace(/\D/g, '')}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-card-alto px-3.5 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-muted">{t.rotulo}</span>
                  <span className="block text-[15px] font-medium">{t.numero}</span>
                </span>
                <span className="shrink-0 rounded-full bg-ouro px-3.5 py-1.5 text-[13px] font-semibold text-preto">Ligar</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-muted">Nenhum telefone cadastrado nesta ficha.</p>
        )}

        <dl className="mt-4 space-y-2 text-[14px]">
          <Linha rotulo="Tipo sanguíneo" valor={integrante.tipoSanguineo} />
          <Linha rotulo="Restrições alimentares" valor={integrante.restricoesAlimentares} />
          <Linha rotulo="Autorização médica" valor={integrante.autorizacaoMedica} />
          <Linha rotulo="Sabe nadar" valor={integrante.sabeNadar} />
          <Linha rotulo="Neurodivergência" valor={integrante.neurodivergencia} />
          {!temAlergia ? <Linha rotulo="Alergia" valor={alergia} /> : null}
        </dl>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={aoFechar} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-semibold">
            Fechar
          </button>
          <Link
            to={`/integrantes/${integrante.id}`}
            onClick={aoFechar}
            className="flex-1 rounded-full bg-ouro py-2.5 text-center text-[15px] font-semibold text-preto"
          >
            Ver ficha
          </Link>
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  const vazio = !valor?.trim();
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[46%] shrink-0 text-[12.5px] text-muted">{rotulo}</dt>
      <dd className={vazio ? 'text-muted' : ''}>{vazio ? 'Não informado' : valor}</dd>
    </div>
  );
}
