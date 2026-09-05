export interface SimulationInput {
  valorInicial: number;
  aporteMensal: number;
  /** number of months */
  prazoMeses: number;
  /** monthly interest rate as decimal (e.g. 0.01 = 1% a.m.) */
  taxaMensal: number;
}

export interface PeriodRow {
  /** 1-based period index (month) */
  periodo: number;
  aporte: number;
  jurosPeriodo: number;
  jurosAcumulados: number;
  totalInvestido: number;
  montante: number;
}

export interface SimulationResult {
  rows: PeriodRow[];
  /** yearly aggregate rows */
  anos: PeriodRow[];
  valorTotal: number;
  totalInvestido: number;
  totalJuros: number;
  percentualJuros: number;
}

/** Convert an annual rate (decimal) to the equivalent monthly rate via compounding. */
export function anualParaMensal(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/** Convert a monthly rate (decimal) to the equivalent annual rate via compounding. */
export function mensalParaAnual(taxaMensal: number): number {
  return Math.pow(1 + taxaMensal, 12) - 1;
}

export function simular({
  valorInicial,
  aporteMensal,
  prazoMeses,
  taxaMensal,
}: SimulationInput): SimulationResult {
  const rows: PeriodRow[] = [];
  let montante = valorInicial;
  let totalInvestido = valorInicial;
  let jurosAcumulados = 0;

  for (let m = 1; m <= prazoMeses; m++) {
    const jurosPeriodo = montante * taxaMensal;
    montante += jurosPeriodo + aporteMensal;
    totalInvestido += aporteMensal;
    jurosAcumulados += jurosPeriodo;
    rows.push({
      periodo: m,
      aporte: aporteMensal,
      jurosPeriodo,
      jurosAcumulados,
      totalInvestido,
      montante,
    });
  }

  // Aggregate by year (12-month blocks)
  const anos: PeriodRow[] = [];
  for (let start = 0; start < rows.length; start += 12) {
    const slice = rows.slice(start, start + 12);
    const last = slice[slice.length - 1];
    const jurosPeriodo = slice.reduce((s, r) => s + r.jurosPeriodo, 0);
    anos.push({
      periodo: anos.length + 1,
      aporte: slice.reduce((s, r) => s + r.aporte, 0),
      jurosPeriodo,
      jurosAcumulados: last.jurosAcumulados,
      totalInvestido: last.totalInvestido,
      montante: last.montante,
    });
  }

  const totalJuros = jurosAcumulados;
  const valorTotal = montante;
  return {
    rows,
    anos,
    valorTotal,
    totalInvestido,
    totalJuros,
    percentualJuros: valorTotal > 0 ? totalJuros / valorTotal : 0,
  };
}

export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Parse a pt-BR formatted numeric string ("1.234,56") into a number. */
export function parseNumeroBR(valor: string): number {
  if (!valor) return 0;
  const limpo = valor.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Build CSV content from simulation rows. */
export function gerarCsv(result: SimulationResult): string {
  const header =
    "Periodo (mes);Aporte (R$);Juros no periodo (R$);Juros acumulados (R$);Total investido (R$);Montante (R$)";
  const linhas = result.rows.map(
    (r) =>
      `${r.periodo};${r.aporte.toFixed(2).replace(".", ",")};${r.jurosPeriodo
        .toFixed(2)
        .replace(".", ",")};${r.jurosAcumulados.toFixed(2).replace(".", ",")};${r.totalInvestido
        .toFixed(2)
        .replace(".", ",")};${r.montante.toFixed(2).replace(".", ",")}`
  );
  return [header, ...linhas].join("\r\n");
}
