import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Última linha de defesa: um erro em qualquer tela mostra uma saída, em vez
 * de deixar o chefe diante de uma tela preta no meio da atividade.
 */
export class Cerca extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state: { erro: Error | null } = { erro: null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Falha na tela:', erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
        <div className="max-w-[34ch]">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="mx-auto h-20 w-20 opacity-60" />
          <h1 className="mt-5 font-display text-[1.3rem] font-[700]">Esta tela falhou</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            O resto do sistema continua funcionando, e nada do que você marcou se perdeu. Recarregue para voltar.
          </p>
          <p className="mt-3 rounded-lg bg-card px-3 py-2 text-[12.5px] text-muted">{this.state.erro.message}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-5 w-full rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto"
          >
            Recarregar o app
          </button>
        </div>
      </main>
    );
  }
}
