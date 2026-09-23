import { describe, expect, it } from "vitest";
import { computeCma, currentRatio, dscr, grossProfit, netProfit, workingCapital, parseCmaInputs } from "@/lib/cma";

const inputs = {
  sales: 1000, purchases: 600, openingStock: 100, closingStock: 150, directExpenses: 50,
  indirectExpenses: 100, depreciation: 20, interest: 30, tax: 25,
  capital: 500, termLoans: 200, workingCapitalLoans: 100, creditors: 80, otherCurrentLiabilities: 20,
  debtors: 200, cash: 10, bank: 40, otherCurrentAssets: 0, principalRepayment: 50,
};

describe("CMA formulas", () => {
  it("computes profit lines transparently", () => {
    expect(grossProfit(inputs)).toBe(1000 - (100 + 600 + 50 - 150)); // 400
    expect(netProfit(inputs)).toBe(400 - 100 - 20 - 30 - 25); // 225
  });

  it("computes liquidity and debt service ratios", () => {
    // CA = 150+200+10+40 = 400, CL = 80+100+20 = 200
    expect(workingCapital(inputs)).toBe(200);
    expect(currentRatio(inputs)).toBe(2);
    // DSCR = (225 + 20 + 30) / (30 + 50) = 3.4375
    expect(dscr(inputs)).toBeCloseTo(3.4375);
  });

  it("returns null instead of dividing by zero", () => {
    expect(currentRatio({})).toBeNull();
    const m = computeCma({});
    expect(m.find((x) => x.key === "dscr")?.value).toBeNull();
  });

  it("ignores unknown or non-numeric stored inputs", () => {
    expect(parseCmaInputs('{"sales": 10, "evil": 1, "cash": "x"}')).toEqual({ sales: 10 });
    expect(parseCmaInputs("not json")).toEqual({});
  });
});
