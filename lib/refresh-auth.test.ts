import { afterEach, describe, expect, it } from "vitest";

import { checkRefreshSecret } from "./refresh-auth";

describe("checkRefreshSecret", () => {
  const ORIGINAL = process.env.REFRESH_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.REFRESH_SECRET;
    else process.env.REFRESH_SECRET = ORIGINAL;
  });

  it("returns a 500 (not 401) when REFRESH_SECRET is not configured", () => {
    delete process.env.REFRESH_SECRET;
    const result = checkRefreshSecret("whatever");
    expect(result).toMatchObject({ ok: false, status: 500 });
  });

  it("returns 401 when the supplied secret is missing", () => {
    process.env.REFRESH_SECRET = "s3cret";
    expect(checkRefreshSecret(null)).toMatchObject({ ok: false, status: 401 });
  });

  it("returns 401 when the supplied secret is wrong", () => {
    process.env.REFRESH_SECRET = "s3cret";
    expect(checkRefreshSecret("nope")).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("allows the request when the secret matches", () => {
    process.env.REFRESH_SECRET = "s3cret";
    expect(checkRefreshSecret("s3cret")).toEqual({ ok: true });
  });

  it("never echoes the secret back in the result", () => {
    process.env.REFRESH_SECRET = "s3cret";
    expect(JSON.stringify(checkRefreshSecret("nope"))).not.toContain("s3cret");
  });
});
