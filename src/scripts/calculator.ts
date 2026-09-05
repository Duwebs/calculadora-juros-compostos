import {
  simular,
  anualParaMensal,
  mensalParaAnual,
  parseNumeroBR,
  gerarCsv,
  brl,
  type SimulationResult,
  type PeriodRow,
} from "../lib/finance";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const valorInicialEl = $<HTMLInputElement>("valor-inicial");
const aporteMensalEl = $<HTMLInputElement>("aporte-mensal");
const prazoEl = $<HTMLInputElement>("prazo");
const taxaEl = $<HTMLInputElement>("taxa");
const prazoAnosBtn = $<HTMLButtonElement>("prazo-anos");
const prazoMesesBtn = $<HTMLButtonElement>("prazo-meses");
const taxaAnualBtn = $<HTMLButtonElement>("taxa-anual");
const taxaMensalBtn = $<HTMLButtonElement>("taxa-mensal");
const taxaEquivEl = $("taxa-equiv");
const rValorTotal = $("r-valor-total");
const rTotalInvestido = $("r-total-investido");
const rTotalJuros = $("r-total-juros");
const rPercentual = $("r-percentual");
const chartEl = $<SVGSVGElement>("chart");
const chartEmpty = $("chart-empty");
const tableBody = $("table-body");
const btnGroup = $<HTMLButtonElement>("btn-group");
const btnCsv = $<HTMLButtonElement>("btn-csv");
const btnPdf = $<HTMLButtonElement>("btn-pdf");
const calcForm = $<HTMLFormElement>("calc-form");

let lastResult: SimulationResult | null = null;
let agruparAno = true;

/** Two-button segmented toggle. Returns getter/setter; changes trigger update(). */
function makeSeg(
  on: HTMLButtonElement,
  off: HTMLButtonElement
): { get: () => boolean; set: (v: boolean) => void } {
  const paint = () => {
    [on, off].forEach((el) => {
      const active = el.getAttribute("aria-pressed") === "true";
      el.classList.toggle("bg-hairline-soft", active);
      el.classList.toggle("text-ink", active);
      el.classList.toggle("text-mute", !active);
    });
  };
  [on, off].forEach((el) =>
    el.addEventListener("click", () => {
      if (el.getAttribute("aria-pressed") === "true") return;
      on.setAttribute("aria-pressed", String(el === on));
      off.setAttribute("aria-pressed", String(el === off));
      paint();
      update();
    })
  );
  return {
    get: () => on.getAttribute("aria-pressed") === "true",
    set: (v: boolean) => {
      on.setAttribute("aria-pressed", String(v));
      off.setAttribute("aria-pressed", String(!v));
      paint();
    },
  };
}

const prazoSeg = makeSeg(prazoAnosBtn, prazoMesesBtn); // true = anos
const taxaSeg = makeSeg(taxaAnualBtn, taxaMensalBtn); // true = anual

// Shareable URL state
const params = new URLSearchParams(location.search);
if (params.get("vi")) valorInicialEl.value = params.get("vi")!;
if (params.get("am")) aporteMensalEl.value = params.get("am")!;
if (params.get("p")) {
  const p = params.get("p")!;
  prazoSeg.set(!p.endsWith("m"));
  prazoEl.value = p.replace(/[am]$/, "");
}
if (params.get("t")) {
  const tv = params.get("t")!;
  taxaSeg.set(!tv.endsWith("m"));
  taxaEl.value = tv.replace(/[am]$/, "");
}

function persistState() {
  const p = new URLSearchParams();
  if (valorInicialEl.value) p.set("vi", valorInicialEl.value);
  if (aporteMensalEl.value) p.set("am", aporteMensalEl.value);
  if (prazoEl.value) p.set("p", `${prazoEl.value}${prazoSeg.get() ? "a" : "m"}`);
  if (taxaEl.value) p.set("t", `${taxaEl.value}${taxaSeg.get() ? "a" : "m"}`);
  history.replaceState(null, "", p.size ? `?${p}` : location.pathname);
}

function update() {
  const valorInicial = parseNumeroBR(valorInicialEl.value);
  const aporteMensal = parseNumeroBR(aporteMensalEl.value);
  const prazoNum = parseNumeroBR(prazoEl.value);
  const taxaNum = parseNumeroBR(taxaEl.value);
  const prazoMeses = Math.min(
    Math.max(Math.round(prazoSeg.get() ? prazoNum * 12 : prazoNum), 0),
    600
  );
  const taxaMensal = taxaSeg.get() ? anualParaMensal(taxaNum / 100) : taxaNum / 100;

  persistState();

  const valido = prazoMeses > 0 && taxaMensal > 0;
  chartEl.classList.toggle("hidden", !valido);
  chartEmpty.classList.toggle("hidden", valido);
  taxaEquivEl.textContent = "";
  if (!valido) {
    rValorTotal.textContent = rTotalInvestido.textContent =
      rTotalJuros.textContent = brl.format(0);
    rPercentual.textContent = "";
    tableBody.innerHTML = "";
    lastResult = null;
    return;
  }

  const anualEquiv = mensalParaAnual(taxaMensal);
  const pct = taxaSeg.get()
    ? (taxaMensal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })
    : (anualEquiv * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  taxaEquivEl.textContent = taxaSeg.get()
    ? `Equivale a ${pct}% ao mês`
    : `Equivale a ${pct}% ao ano`;

  lastResult = simular({ valorInicial, aporteMensal, prazoMeses, taxaMensal });

  rValorTotal.textContent = brl.format(lastResult.valorTotal);
  rTotalInvestido.textContent = brl.format(lastResult.totalInvestido);
  rTotalJuros.textContent = brl.format(lastResult.totalJuros);
  rPercentual.textContent = `${(lastResult.percentualJuros * 100).toLocaleString(
    "pt-BR",
    { maximumFractionDigits: 1 }
  )}% do montante vieram de juros`;

  renderChart(lastResult);
  renderTable(lastResult);
}

function renderChart(res: SimulationResult) {
  const W = 600;
  const H = 220;
  const n = res.rows.length;
  const maxV = res.valorTotal * 1.05 || 1;
  const x = (i: number) => (i / Math.max(n - 1, 1)) * W;
  const y = (v: number) => H - (v / maxV) * H;

  const line = (get: (r: PeriodRow) => number) =>
    res.rows
      .map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(r)).toFixed(1)}`)
      .join(" ");

  const areaInvestido = `M0,${H} ${res.rows
    .map((r, i) => `L${x(i).toFixed(1)},${y(r.totalInvestido).toFixed(1)}`)
    .join(" ")} L${W},${H} Z`;
  const areaTotal = `M0,${H} ${res.rows
    .map((r, i) => `L${x(i).toFixed(1)},${y(r.montante).toFixed(1)}`)
    .join(" ")} L${W},${H} Z`;

  chartEl.innerHTML = `
    <path d="${areaTotal}" fill="rgba(255,0,128,0.10)"></path>
    <path d="${areaInvestido}" fill="rgba(0,124,240,0.14)"></path>
    <path d="${line((r) => r.montante)}" fill="none" stroke="rgba(255,0,128,0.7)" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>
    <path d="${line((r) => r.totalInvestido)}" fill="none" stroke="rgba(0,124,240,0.85)" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>
  `;
}

function renderTable(res: SimulationResult) {
  const rows = agruparAno ? res.anos : res.rows;
  const MAX = 120;
  const html = rows
    .slice(0, MAX)
    .map(
      (r) => `
      <tr>
        <td class="px-4 py-2 text-left text-body">${
          agruparAno ? `Ano ${r.periodo}` : `Mês ${r.periodo}`
        }</td>
        <td class="px-4 py-2 text-body">${brl.format(r.aporte)}</td>
        <td class="px-4 py-2 text-body">${brl.format(r.jurosPeriodo)}</td>
        <td class="px-4 py-2 text-body">${brl.format(r.jurosAcumulados)}</td>
        <td class="px-4 py-2 text-body">${brl.format(r.totalInvestido)}</td>
        <td class="px-4 py-2 font-medium text-ink">${brl.format(r.montante)}</td>
      </tr>`
    )
    .join("");
  const extra =
    rows.length > MAX
      ? `<tr><td colspan="6" class="px-4 py-2 text-center text-mute">… e ${
          rows.length - MAX
        } períodos restantes (exporte em CSV para ver todos)</td></tr>`
      : "";
  tableBody.innerHTML = html + extra;
}

[valorInicialEl, aporteMensalEl, prazoEl, taxaEl].forEach((el) =>
  el.addEventListener("input", () => update())
);

calcForm.addEventListener("reset", () => {
  setTimeout(() => {
    history.replaceState(null, "", location.pathname);
    update();
  });
});

btnGroup.addEventListener("click", () => {
  agruparAno = !agruparAno;
  btnGroup.textContent = agruparAno ? "Mostrar todos os meses" : "Agrupar por ano";
  btnGroup.setAttribute("aria-pressed", String(!agruparAno));
  if (lastResult) renderTable(lastResult);
});

btnCsv.addEventListener("click", () => {
  if (!lastResult) return;
  const blob = new Blob(["\ufeff" + gerarCsv(lastResult)], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "simulacao-juros-compostos.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

btnPdf.addEventListener("click", () => window.print());

// Defaults on first visit
if (!valorInicialEl.value) valorInicialEl.value = "1000";
if (!aporteMensalEl.value) aporteMensalEl.value = "200";
if (!prazoEl.value) prazoEl.value = "10";
if (!taxaEl.value) taxaEl.value = "10,5";
prazoSeg.set(true);
taxaSeg.set(true);
update();

