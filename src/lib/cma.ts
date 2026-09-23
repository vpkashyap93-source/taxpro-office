/**
 * CMA (Credit Monitoring Arrangement) calculations.
 *
 * Every formula is a small named function with its definition documented in FORMULAS, so the
 * report can show exactly how each figure was derived. Inputs are in rupees (not paise).
 * These are standard analytical ratios used by practitioners; banks may apply their own norms.
 */

export const CMA_INPUT_FIELDS = [
  { key: "sales", label: "Sales / Turnover", group: "Profit & Loss" },
  { key: "purchases", label: "Purchases", group: "Profit & Loss" },
  { key: "openingStock", label: "Opening Stock", group: "Profit & Loss" },
  { key: "closingStock", label: "Closing Stock", group: "Profit & Loss" },
  { key: "directExpenses", label: "Direct Expenses", group: "Profit & Loss" },
  { key: "indirectExpenses", label: "Indirect Expenses", group: "Profit & Loss" },
  { key: "depreciation", label: "Depreciation", group: "Profit & Loss" },
  { key: "interest", label: "Interest on Loans", group: "Profit & Loss" },
  { key: "tax", label: "Income Tax", group: "Profit & Loss" },
  { key: "capital", label: "Capital / Net Worth", group: "Balance Sheet" },
  { key: "termLoans", label: "Term Loans", group: "Balance Sheet" },
  { key: "workingCapitalLoans", label: "Working Capital (CC/OD) Loans", group: "Balance Sheet" },
  { key: "creditors", label: "Sundry Creditors", group: "Balance Sheet" },
  { key: "otherCurrentLiabilities", label: "Other Current Liabilities", group: "Balance Sheet" },
  { key: "fixedAssets", label: "Net Fixed Assets", group: "Balance Sheet" },
  { key: "debtors", label: "Sundry Debtors", group: "Balance Sheet" },
  { key: "cash", label: "Cash in Hand", group: "Balance Sheet" },
  { key: "bank", label: "Bank Balance", group: "Balance Sheet" },
  { key: "otherCurrentAssets", label: "Other Current Assets", group: "Balance Sheet" },
  { key: "principalRepayment", label: "Term Loan Principal Repayment (year)", group: "Debt Service" },
  { key: "projectedSales", label: "Projected Sales (next year)", group: "Projections" },
  { key: "projectedNetProfit", label: "Projected Net Profit (next year)", group: "Projections" },
] as const;

export type CmaInputKey = (typeof CMA_INPUT_FIELDS)[number]["key"];
export type CmaInputs = Partial<Record<CmaInputKey, number>>;

const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

export const costOfGoodsSold = (i: CmaInputs) =>
  n(i.openingStock) + n(i.purchases) + n(i.directExpenses) - n(i.closingStock);
export const grossProfit = (i: CmaInputs) => n(i.sales) - costOfGoodsSold(i);
export const netProfitBeforeTax = (i: CmaInputs) =>
  grossProfit(i) - n(i.indirectExpenses) - n(i.depreciation) - n(i.interest);
export const netProfit = (i: CmaInputs) => netProfitBeforeTax(i) - n(i.tax);
export const currentAssets = (i: CmaInputs) =>
  n(i.closingStock) + n(i.debtors) + n(i.cash) + n(i.bank) + n(i.otherCurrentAssets);
export const currentLiabilities = (i: CmaInputs) =>
  n(i.creditors) + n(i.workingCapitalLoans) + n(i.otherCurrentLiabilities);
export const workingCapital = (i: CmaInputs) => currentAssets(i) - currentLiabilities(i);
export const totalOutsideLiabilities = (i: CmaInputs) => n(i.termLoans) + currentLiabilities(i);
export const totalDebt = (i: CmaInputs) => n(i.termLoans) + n(i.workingCapitalLoans);

export const currentRatio = (i: CmaInputs) => ratio(currentAssets(i), currentLiabilities(i));
export const quickRatio = (i: CmaInputs) => ratio(currentAssets(i) - n(i.closingStock), currentLiabilities(i));
export const debtEquity = (i: CmaInputs) => ratio(totalDebt(i), n(i.capital));
export const tolTnw = (i: CmaInputs) => ratio(totalOutsideLiabilities(i), n(i.capital));
export const dscr = (i: CmaInputs) =>
  ratio(netProfit(i) + n(i.depreciation) + n(i.interest), n(i.interest) + n(i.principalRepayment));
export const interestCoverage = (i: CmaInputs) => ratio(netProfitBeforeTax(i) + n(i.interest), n(i.interest));
export const grossMargin = (i: CmaInputs) => ratio(grossProfit(i) * 100, n(i.sales));
export const netMargin = (i: CmaInputs) => ratio(netProfit(i) * 100, n(i.sales));
export const inventoryDays = (i: CmaInputs) => ratio(n(i.closingStock) * 365, costOfGoodsSold(i));
export const debtorDays = (i: CmaInputs) => ratio(n(i.debtors) * 365, n(i.sales));
export const creditorDays = (i: CmaInputs) => ratio(n(i.creditors) * 365, n(i.purchases));
/** Tandon Committee, Method II: MPBF = 75% of current assets − current liabilities (excluding bank borrowings). */
export const mpbfMethod2 = (i: CmaInputs) =>
  0.75 * currentAssets(i) - (n(i.creditors) + n(i.otherCurrentLiabilities));
export const salesGrowth = (i: CmaInputs) => ratio((n(i.projectedSales) - n(i.sales)) * 100, n(i.sales));

export type MetricFormat = "currency" | "ratio" | "percent" | "days";

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  formula: string;
  group: "Profitability" | "Liquidity" | "Leverage" | "Efficiency" | "Projection";
  /** Optional benchmark hint shown in the report (practitioner rule-of-thumb, not a bank norm). */
  benchmark?: { min?: number; max?: number; hint: string };
}

export function computeCma(i: CmaInputs): Metric[] {
  return [
    { key: "grossProfit", label: "Gross Profit", value: grossProfit(i), format: "currency", group: "Profitability", formula: "Sales − (Opening Stock + Purchases + Direct Expenses − Closing Stock)" },
    { key: "netProfit", label: "Net Profit (after tax)", value: netProfit(i), format: "currency", group: "Profitability", formula: "Gross Profit − Indirect Expenses − Depreciation − Interest − Tax" },
    { key: "grossMargin", label: "Gross Margin", value: grossMargin(i), format: "percent", group: "Profitability", formula: "Gross Profit ÷ Sales × 100" },
    { key: "netMargin", label: "Net Margin", value: netMargin(i), format: "percent", group: "Profitability", formula: "Net Profit ÷ Sales × 100" },
    { key: "currentAssets", label: "Current Assets", value: currentAssets(i), format: "currency", group: "Liquidity", formula: "Closing Stock + Debtors + Cash + Bank + Other Current Assets" },
    { key: "currentLiabilities", label: "Current Liabilities", value: currentLiabilities(i), format: "currency", group: "Liquidity", formula: "Creditors + CC/OD Loans + Other Current Liabilities" },
    { key: "workingCapital", label: "Net Working Capital", value: workingCapital(i), format: "currency", group: "Liquidity", formula: "Current Assets − Current Liabilities" },
    { key: "currentRatio", label: "Current Ratio", value: currentRatio(i), format: "ratio", group: "Liquidity", formula: "Current Assets ÷ Current Liabilities", benchmark: { min: 1.33, hint: "≥ 1.33 commonly expected" } },
    { key: "quickRatio", label: "Quick Ratio", value: quickRatio(i), format: "ratio", group: "Liquidity", formula: "(Current Assets − Stock) ÷ Current Liabilities", benchmark: { min: 1, hint: "≥ 1.0 indicates comfortable liquidity" } },
    { key: "mpbf", label: "MPBF (Method II)", value: mpbfMethod2(i), format: "currency", group: "Liquidity", formula: "75% × Current Assets − (Creditors + Other Current Liabilities)" },
    { key: "debtEquity", label: "Debt / Equity", value: debtEquity(i), format: "ratio", group: "Leverage", formula: "(Term Loans + CC/OD Loans) ÷ Capital", benchmark: { max: 2, hint: "≤ 2.0 commonly expected" } },
    { key: "tolTnw", label: "TOL / TNW", value: tolTnw(i), format: "ratio", group: "Leverage", formula: "(Term Loans + Current Liabilities) ÷ Capital", benchmark: { max: 3, hint: "≤ 3.0 commonly expected" } },
    { key: "dscr", label: "DSCR", value: dscr(i), format: "ratio", group: "Leverage", formula: "(Net Profit + Depreciation + Interest) ÷ (Interest + Principal Repayment)", benchmark: { min: 1.5, hint: "≥ 1.5 commonly expected" } },
    { key: "interestCoverage", label: "Interest Coverage", value: interestCoverage(i), format: "ratio", group: "Leverage", formula: "(Net Profit before Tax + Interest) ÷ Interest" },
    { key: "inventoryDays", label: "Inventory Holding", value: inventoryDays(i), format: "days", group: "Efficiency", formula: "Closing Stock ÷ Cost of Goods Sold × 365" },
    { key: "debtorDays", label: "Debtor Collection Period", value: debtorDays(i), format: "days", group: "Efficiency", formula: "Debtors ÷ Sales × 365" },
    { key: "creditorDays", label: "Creditor Payment Period", value: creditorDays(i), format: "days", group: "Efficiency", formula: "Creditors ÷ Purchases × 365" },
    { key: "projectedSales", label: "Projected Sales", value: n(i.projectedSales) || null, format: "currency", group: "Projection", formula: "As entered" },
    { key: "salesGrowth", label: "Projected Sales Growth", value: salesGrowth(i), format: "percent", group: "Projection", formula: "(Projected Sales − Sales) ÷ Sales × 100" },
    { key: "projectedNetProfit", label: "Projected Net Profit", value: n(i.projectedNetProfit) || null, format: "currency", group: "Projection", formula: "As entered" },
  ];
}

export function parseCmaInputs(json: string | null | undefined): CmaInputs {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: CmaInputs = {};
    for (const f of CMA_INPUT_FIELDS) {
      const v = raw[f.key];
      if (typeof v === "number" && Number.isFinite(v)) out[f.key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function benchmarkState(m: Metric): "ok" | "warn" | null {
  if (!m.benchmark || m.value === null) return null;
  if (m.benchmark.min !== undefined && m.value < m.benchmark.min) return "warn";
  if (m.benchmark.max !== undefined && m.value > m.benchmark.max) return "warn";
  return "ok";
}
