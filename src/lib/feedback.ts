/**
 * Resposta tátil e sonora ao marcar presença — a chamada costuma ser feita
 * sem olhar a tela o tempo todo, então o toque precisa confirmar sozinho.
 */
const CHAVE = 'sge:feedback';

export type Feedback = { vibrar: boolean; som: boolean };

export function lerFeedback(): Feedback {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { vibrar: true, som: true };
    const f = JSON.parse(bruto) as Partial<Feedback>;
    return { vibrar: f.vibrar !== false, som: f.som !== false };
  } catch {
    return { vibrar: true, som: true };
  }
}

export function gravarFeedback(f: Feedback): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(f));
  } catch {
    /* sem espaço: segue sem guardar a preferência */
  }
}

let audio: AudioContext | null = null;

function contexto(): AudioContext | null {
  try {
    const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return null;
    audio = audio ?? new Classe();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function nota(hz: number, duracao: number): void {
  const ctx = contexto();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const volume = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;
  // sobe e desce rápido: clique curto, sem estalo
  volume.gain.setValueAtTime(0.0001, ctx.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracao);
  osc.connect(volume).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duracao + 0.02);
}

function vibra(padrao: number | number[]): void {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* aparelho sem motor de vibração */
  }
}

export function avisarMarcou(f: Feedback): void {
  if (f.vibrar) vibra(18);
  if (f.som) nota(920, 0.07);
}

export function avisarDesmarcou(f: Feedback): void {
  if (f.vibrar) vibra(12);
  if (f.som) nota(480, 0.06);
}

export function avisarSalvou(f: Feedback): void {
  if (f.vibrar) vibra([14, 60, 14]);
  if (f.som) {
    nota(760, 0.07);
    window.setTimeout(() => nota(1040, 0.1), 90);
  }
}
