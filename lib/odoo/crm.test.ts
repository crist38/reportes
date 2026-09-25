import { describe, expect, it } from "vitest";
import { parseStageMap, tecnicoDesdeCrm } from "./crm";

const map = parseStageMap(undefined);

describe("estado técnico desde el CRM", () => {
  it("etapa ganada = liberado, sin importar el nombre", () => {
    expect(tecnicoDesdeCrm({ name: "Won", isWon: true }, true, map)).toBe("liberado");
    expect(tecnicoDesdeCrm({ name: "Ganado", isWon: true }, true, map)).toBe("liberado");
  });

  it("etapas de tu CRM", () => {
    expect(tecnicoDesdeCrm({ name: "New", isWon: false }, true, map)).toBe("sin_medir");
    expect(tecnicoDesdeCrm({ name: "Proposition", isWon: false }, true, map)).toBe("en_revision");
    expect(tecnicoDesdeCrm({ name: "Perdidos o no califica", isWon: false }, true, map)).toBeNull();
  });

  it("oportunidad archivada/perdida no aporta estado", () => {
    expect(tecnicoDesdeCrm({ name: "Proposition", isWon: false }, false, map)).toBeNull();
  });

  it("etapas desconocidas cuentan como en revisión; se pueden mapear por entorno", () => {
    expect(tecnicoDesdeCrm({ name: "Visita a obra", isWon: false }, true, map)).toBe("en_revision");
    const custom = parseStageMap("Visita a obra:medido, Aprobado cliente:aprobado");
    expect(tecnicoDesdeCrm({ name: "Visita a obra", isWon: false }, true, custom)).toBe("medido");
    expect(tecnicoDesdeCrm({ name: "aprobado cliente", isWon: false }, true, custom)).toBe("aprobado");
  });
});
