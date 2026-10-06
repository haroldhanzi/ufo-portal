import { describe, expect, it } from "vitest";
import { validatePartnerName } from "./nameValidation";

describe("partner name validation", () => {
  it.each(["UFO Guest", "you-network", "FOUR Seasons", "Network 4"])(
    "rejects reserved name %s",
    (name) => expect(validatePartnerName(name)).toEqual(expect.any(String)),
  );

  it("allows ordinary partner-defined names", () => {
    expect(validatePartnerName("Lobby Guest WiFi")).toBe(true);
  });
});
