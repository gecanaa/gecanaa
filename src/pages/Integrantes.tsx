import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { semAcento, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { Avatar, Carregando, Erro, Vazio } from '../components/Estados';
import { BarraRamosFixa } from '../components/BarraRamos';
import { ModalIntegrante } from '../components/ModalIntegrante';
import type { Integrante } from '../lib/tipos';
import { Icone } from '../components/Icone';

export function Integrantes() {
  const { integrantes, carregando, erro } = useDados();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [verInativos, setVerInativos] = useState(false);
  const [vendo, setVendo] = useState<Integrante | null>(null);

  const ramos = useMemo(() => ordenarRamos(integrantes.map((i) => i.ramo)), [integrantes]);

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return integrantes.filter((i) => {
      if (!verInativos && i.status && i.status !== 'Ativo') return false;
      if (filtro && i.ramo !== filtro) return false;
      if (termo && !semAcento(i.nome).includes(termo)) return false;
      return true;
    });
  }, [integrantes, busca, filtro, verInativos]);

  if (carregando) return <Carregando texto="Carregando integrantes" />;
  if (erro) return <Erro mensagem={erro} />;

  return (
    <main className="pb-24">
      <div className="sticky top-[var(--topo,52px)] z-10 border-b border-line bg-card px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-xl font-[600] tracking-tight">Integrantes</h1>
          <Link to="/integrantes/novo" className="rounded-full bg-ouro px-4 py-2 text-[14px] font-semibold text-preto">
            Cadastrar
          </Link>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-paper px-3">
          <Icone nome="busca" className="h-4.5 w-4.5 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className="w-full bg-transparent py-2.5 text-[15px] outline-none"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} className="h-4 w-4" />
          Mostrar inativos
        </label>
      </div>

      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1">
        <p className="text-[13px] text-muted">
          {lista.length} {lista.length === 1 ? 'integrante' : 'integrantes'}
        </p>
        {lista.length ? (
          <Link to={`/imprimir${filtro ? `?ramo=${encodeURIComponent(filtro)}` : ''}`} className="shrink-0 text-[13px] font-semibold text-ouro underline">
            Fichas em PDF
          </Link>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <Vazio titulo="Nada encontrado" convite="Mude a busca ou o ramo, ou cadastre um novo integrante." />
      ) : (
        <ul>
          {lista.map((i) => {
            const r = corDoRamo(i.ramo);
            const vencida = i.validadeUeb && normalizar(i.validadeUeb) < new Date().toISOString().slice(0, 10);
            return (
              <li key={i.id} className="flex items-center gap-3 border-b border-line bg-card px-4 py-3" style={{ borderLeft: `4px solid ${r.cor}` }}>
                <button type="button" onClick={() => setVendo(i)} aria-label={`Ver dados de ${i.nome.trim()}`} className="shrink-0 rounded-full">
                  <Avatar foto={i.foto} nome={i.nome} cor={r.cor} />
                </button>
                <Link to={`/integrantes/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{i.nome.trim()}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {i.ramo || 'Sem ramo'}
                      {i.status && i.status !== 'Ativo' ? ` · ${i.status}` : ''}
                    </span>
                  </span>
                  {vencida ? (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--color-falta)_22%,var(--color-card))] px-2.5 py-1 text-[11px] font-semibold text-falta">
                      UEB vencido
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <BarraRamosFixa ramos={ramos} ativo={filtro} aoEscolher={setFiltro} todos="Todos" />

      {vendo ? <ModalIntegrante integrante={vendo} aoFechar={() => setVendo(null)} /> : null}
    </main>
  );
}

function normalizar(valor: string): string {
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return valor.slice(0, 10);
}
