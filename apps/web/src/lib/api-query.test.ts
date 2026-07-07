import { describe, expect, it } from "vitest";
import { pageInfo, parsePagination } from "./api-query";

describe("api pagination helpers", () => {
  it("caps invalid limits to the safe default", () => {
    const request = new Request("https://example.test/api/v1/records?limit=100000");

    expect(parsePagination(request)).toEqual({ limit: 25, cursor: undefined });
  });

  it("returns a next cursor when a page has more rows", () => {
    const page = pageInfo([{ id: "a" }, { id: "b" }, { id: "c" }], 2);

    expect(page).toEqual({
      items: [{ id: "a" }, { id: "b" }],
      nextCursor: "b"
    });
  });
});
