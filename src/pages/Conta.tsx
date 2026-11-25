import { useState } from 'react';
import { useApi, useAuth } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { useDados } from '../lib/dados';
import { Erro } from '../components/Estados';
import { avisarMarcou, gravarFeedback, lerFeedback, VOLUMES, type Feedback } from '../lib/feedback';

type Diagnostico = {
  integrantes: number;
  linhasPresenca: number;
  nomesDuplicados: string[][];
  presencasSemIntegrante: Record<string, number>;
  presencasRepetidas: string[];
  uebVencida: string[];
  semRamo: string[];
};

export function Conta() {
  const { usuario, sair } = useAuth();
  const { integrantes, config, salvarConfig, recarregar } = useDados();
  const api = useApi();
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  const rodar = async () => {
    setRodando(true);
    setErro(null);
    try {
      setDiag(await api<Diagnostico>('diagnostico'));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível rodar o diagnóstico.');
    } finally {
      setRodando(false);
    }
  };

  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [sentido, setSentido] = useState<Feedback>(lerFeedback);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const ativos = integrantes.filter((i) => i.status === 'Ativo').length;

  const salvarPeriodo = async (mudanca: { rankingDe?: string; rankingAte?: string }) => {
    setErro(null);
    try {
      await salvarConfig(mudanca);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar o período.');
    }
  };

  const alternarJustificativa = async (ligada: boolean) => {
    setSalvandoConfig(true);
    setErro(null);
    try {
      await salvarConfig({ justificativaAtiva: ligada });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a configuração.');
    } finally {
      setSalvandoConfig(false);
    }
  };

  return (
    <main className="px-4 pb-24 pt-5">
      <h1 className="font-display text-xl font-[600] tracking-tight">Conta</h1>

      <section className="mt-4 rounded-xl bg-card px-4 py-4">
        <p className="text-[15px] font-medium">{usuario?.nome}</p>
        <p className="text-[13px] text-muted">{usuario?.email}</p>
        <p className="mt-1 text-[13px] text-muted">
          Acesso: {usuario?.nivel === 'admin' ? 'administrador' : 'geral'}
        </p>
      </section>

      <section className="mt-4 rounded-xl bg-card px-4 py-4">
        <p className="font-display text-[15px] font-[700]">Resposta ao marcar presença</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Vale só neste aparelho.</p>
        {([
          ['vibrar', 'Vibrar'],
          ['som', 'Apitar'],
        ] as const).map(([campo, rotulo]) => (
          <label key={campo} className="mt-2.5 flex items-center gap-3">
            <input
              type="checkbox"
              checked={sentido[campo]}
              onChange={(e) => {
                const nova = { ...sentido, [campo]: e.target.checked };
                setSentido(nova);
                gravarFeedback(nova);
                if (e.target.checked) avisarMarcou(nova);
              }}
              className="h-5 w-5 shrink-0 accent-[var(--color-ouro)]"
            />
            <span className="text-[14px]">{rotulo}</span>
          </label>
        ))}

        {sentido.som ? (
          <div className="mt-3">
            <p className="text-[12.5px] text-muted">Volume do apito</p>
            <div className="mt-1.5 flex gap-2">
              {VOLUMES.map((v) => {
                const ativo = Math.abs(sentido.volume - v.valor) < 0.01;
                return (
                  <button
                    key={v.rotulo}
                    type="button"
                    onClick={() => {
                      const nova = { ...sentido, volume: v.valor };
                      setSentido(nova);
                      gravarFeedback(nova);
                      avisarMarcou(nova);
                    }}
                    aria-pressed={ativo}
                    className="flex-1 rounded-full py-2 text-[14px] font-semibold"
                    style={
                      ativo
                        ? { background: 'var(--color-ouro)', color: 'var(--color-preto)' }
                        : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }
                    }
                  >
                    {v.rotulo}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">Tocar em um volume já toca o apito para você ouvir.</p>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl bg-card px-4 py-4">
        <p className="font-display text-[15px] font-[700]">Quadro do grupo</p>
        <p className="mt-1.5 text-[14px] text-muted">
          {ativos} integrantes ativos de {integrantes.length} fichas.
        </p>
        <button type="button" onClick={() => void recarregar()} className="mt-3 text-[14px] font-semibold text-ouro underline">
          Recarregar da planilha
        </button>
      </section>

      {usuario?.nivel === 'admin' ? (
        <section className="mt-4 rounded-xl bg-card px-4 py-4">
          <p className="font-display text-[15px] font-[700]">Chamada</p>
          <label className="mt-2.5 flex items-start gap-3">
            <input
              type="checkbox"
              checked={config.justificativaAtiva}
              disabled={salvandoConfig}
              onChange={(e) => void alternarJustificativa(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ouro)]"
            />
            <span className="text-[14px] leading-relaxed">
              Permitir justificar falta
              <span className="block text-[13px] text-muted">
                Com isso ligado, tocar duas vezes na linha marca falta justificada e abre o campo do motivo.
                Desligado, a chamada é só presença: quem fica em branco conta como falta.
              </span>
            </span>
          </label>

          <div className="mt-4 border-t border-line pt-3.5">
            <p className="text-[14px] font-medium">Período da premiação</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              É o intervalo que o ranking de assiduidade mostra para todos os chefes.
            </p>
            <div className="mt-2.5 flex gap-3">
              <label className="flex-1">
                <span className="text-[12.5px] text-muted">De</span>
                <input
                  type="date"
                  value={config.rankingDe ?? ''}
                  onChange={(e) => void salvarPeriodo({ rankingDe: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px]"
                />
              </label>
              <label className="flex-1">
                <span className="text-[12.5px] text-muted">Até</span>
                <input
                  type="date"
                  value={config.rankingAte ?? ''}
                  onChange={(e) => void salvarPeriodo({ rankingAte: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px]"
                />
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {usuario?.nivel === 'admin' ? (
        <section className="mt-4 rounded-xl bg-card px-4 py-4">
          <p className="font-display text-[15px] font-[700]">Conferência dos dados</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Aponta nomes repetidos, chamadas duplicadas, registro UEB vencido e fichas sem ramo. Só lê a planilha,
            não altera nada.
          </p>
          <button
            type="button"
            onClick={() => void rodar()}
            disabled={rodando}
            className="mt-3 rounded-full bg-ouro px-5 py-2.5 text-[14px] font-semibold text-preto disabled:opacity-60"
          >
            {rodando ? 'Conferindo' : 'Conferir agora'}
          </button>

          {diag ? (
            <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed">
              <Bloco titulo="Registro UEB vencido" itens={diag.uebVencida} />
              <Bloco titulo="Fichas sem ramo" itens={diag.semRamo} />
              <Bloco titulo="Nomes repetidos entre fichas" itens={diag.nomesDuplicados.map((g) => g.join(' / '))} />
              <Bloco
                titulo="Presenças sem ficha correspondente"
                itens={Object.entries(diag.presencasSemIntegrante).map(([nome, n]) => `${nome} (${n}x)`)}
              />
              <Bloco titulo="Chamadas duplicadas (dia · ramo · pessoa)" itens={diag.presencasRepetidas.map((k) => k.replace(/\|/g, ' · '))} />
            </div>
          ) : null}
        </section>
      ) : null}

      {erro ? <Erro mensagem={erro} /> : null}

      {confirmandoSaida ? (
        <div className="mt-6 rounded-xl border border-line px-4 py-4">
          <p className="text-[14px] leading-relaxed">
            Sair da sua conta neste aparelho? Para voltar, você vai precisar entrar de novo com o Google.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmandoSaida(false)}
              className="flex-1 rounded-full border border-line py-2.5 text-[15px] font-semibold"
            >
              Continuar no app
            </button>
            <button
              type="button"
              onClick={sair}
              className="flex-1 rounded-full bg-falta py-2.5 text-[15px] font-semibold text-texto"
            >
              Sair da conta
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmandoSaida(true)}
          className="mt-6 w-full rounded-full border border-line py-2.5 text-[15px] font-semibold"
        >
          Sair da conta
        </button>
      )}
    </main>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="font-medium">
        {titulo} <span className="text-muted">({itens.length})</span>
      </p>
      {itens.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
          {itens.slice(0, 40).map((i) => (
            <li key={i}>{i}</li>
          ))}
          {itens.length > 40 ? <li>e mais {itens.length - 40}…</li> : null}
        </ul>
      ) : (
        <p className="mt-0.5 text-muted">Nada a corrigir.</p>
      )}
    </div>
  );
}
