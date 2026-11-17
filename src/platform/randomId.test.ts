import { describe, expect, it } from "vitest";
import { z } from "zod";

import { randomUuid, uuidFromBytes } from "./randomId";

describe("randomUuid", () => {
  it("geçerli v4 UUID üretir", () => {
    expect(z.uuidv4().safeParse(randomUuid()).success).toBe(true);
  });

  it("randomUUID olmayan bağlamdaki yedek de geçerli v4 üretir", () => {
    for (const fill of [0x00, 0xff, 0x5a]) {
      const id = uuidFromBytes(new Uint8Array(16).fill(fill));
      expect(z.uuidv4().safeParse(id).success).toBe(true);
    }
  });
});
