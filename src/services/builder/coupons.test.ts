import { describe, it, expect } from "vitest";
import { applyCoupon, type Coupon } from "./coupons";
import { buildPaymentSummary } from "./payments";
import { makePart, LOJA_KABUM, LOJA_PICHAU } from "./test-fixtures";

const gpu = makePart({ slug: "gpu", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1000 });
const ram = makePart({ slug: "ram", category: "ram", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 300 });
const resumo = buildPaymentSummary([gpu, ram]); // Pix: Kabum 1000 + Pichau 300 = 1300

const CUPONS: Coupon[] = [
  { code: "KABUM10", storeId: "kabum", percent: 10 },
  { code: "GERAL50", amount: 50 },
  { code: "MINIMO", amount: 100, minTotal: 5000 },
  { code: "VENCIDO", percent: 5, expiresAt: "2026-01-01" },
  { code: "GIGANTE", storeId: "pichau", amount: 1000 },
];
const HOJE = new Date("2026-11-04T12:00:00Z");

describe("applyCoupon", () => {
  it("desconto percentual vale só para a loja do cupom", () => {
    const r = applyCoupon(resumo, "KABUM10", CUPONS, HOJE);
    expect(r).toMatchObject({ ok: true, discount: 100, pixTotal: 1200 });
  });

  it("ignora maiúsculas/minúsculas e espaços no código", () => {
    expect(applyCoupon(resumo, "  kabum10 ", CUPONS, HOJE).ok).toBe(true);
  });

  it("desconto fixo sem loja vale para o total", () => {
    expect(applyCoupon(resumo, "GERAL50", CUPONS, HOJE)).toMatchObject({ ok: true, discount: 50, pixTotal: 1250 });
  });

  it("o desconto nunca passa do valor da loja", () => {
    expect(applyCoupon(resumo, "GIGANTE", CUPONS, HOJE)).toMatchObject({ ok: true, discount: 300, pixTotal: 1000 });
  });

  it("cupom inexistente, vencido, abaixo do mínimo ou de loja fora da montagem é recusado", () => {
    expect(applyCoupon(resumo, "NADA", CUPONS, HOJE)).toEqual({ ok: false, reason: "Cupom não encontrado." });
    expect(applyCoupon(resumo, "VENCIDO", CUPONS, HOJE)).toEqual({ ok: false, reason: "Este cupom venceu." });
    expect(applyCoupon(resumo, "MINIMO", CUPONS, HOJE).ok).toBe(false);
    const soPichau = buildPaymentSummary([ram]);
    expect(applyCoupon(soPichau, "KABUM10", CUPONS, HOJE).ok).toBe(false);
  });

  // LOG-13: a validade é contada no horário de Brasília, não em UTC.
  it("cupom vale até o fim do dia no horário de Brasília", () => {
    // 2026-01-02 01:00 UTC = 2026-01-01 22:00 em Brasília: ainda é o último dia.
    expect(applyCoupon(resumo, "VENCIDO", CUPONS, new Date("2026-01-02T01:00:00Z")).ok).toBe(true);
    // 2026-01-02 03:30 UTC = 2026-01-02 00:30 em Brasília: venceu.
    expect(applyCoupon(resumo, "VENCIDO", CUPONS, new Date("2026-01-02T03:30:00Z"))).toEqual({ ok: false, reason: "Este cupom venceu." });
  });
});
