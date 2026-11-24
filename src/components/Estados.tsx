import { useState } from 'react';
import type { ReactNode } from 'react';
import { frase } from '../lib/frases';

const LOGO = `${import.meta.env.BASE_URL}logo.png`;

export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  const [dito] = useState(frase);
  return (
    <div className="px-8 py-12 text-center" role="status">
      <p className="font-display text-[15px] leading-snug text-ouro">{dito}</p>
      <p className="mt-2 text-[13px] text-muted">{texto}…</p>
    </div>
  );
}

/** Erros dizem o que aconteceu e o que fazer, sem pedir desculpa. */
export function Erro({ mensagem, acao }: { mensagem: string; acao?: ReactNode }) {
  return (
    <div className="mx-4 my-6 rounded-xl border-l-4 border-falta bg-card px-4 py-3.5" role="alert">
      <p className="text-sm leading-relaxed text-texto">{mensagem}</p>
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}

export function Vazio({ titulo, convite }: { titulo: string; convite: string }) {
  return (
    <div className="px-8 py-14 text-center">
      <img src={LOGO} alt="" aria-hidden="true" className="mx-auto mb-5 h-28 w-28 opacity-[0.14]" />
      <p className="font-display text-lg font-[600]">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-[32ch] text-sm leading-relaxed text-muted">{convite}</p>
    </div>
  );
}

export function Avatar({ foto, nome, cor, tamanho = 44 }: { foto?: string; nome: string; cor: string; tamanho?: number }) {
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  return foto ? (
    <img
      src={foto}
      alt=""
      loading="lazy"
      width={tamanho}
      height={tamanho}
      className="shrink-0 rounded-full object-cover"
      style={{ width: tamanho, height: tamanho, boxShadow: `0 0 0 2px ${cor}` }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-display text-[13px] font-[600] text-preto"
      style={{ width: tamanho, height: tamanho, background: cor }}
    >
      {iniciais}
    </span>
  );
}
