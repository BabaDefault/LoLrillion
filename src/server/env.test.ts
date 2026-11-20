import { describe, expect, it } from "vitest";
import { supabaseEnv } from "./env";

describe("choosing Supabase from environment variables", () => {
  it("uses Supabase when both the URL and the service-role key are set", () => {
    expect(supabaseEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" })).toEqual({
      url: "https://x.supabase.co",
      serviceRoleKey: "k",
    });
  });

  it("falls back to in-memory (null) when neither is set", () => {
    expect(supabaseEnv({})).toBeNull();
    expect(supabaseEnv({ SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" })).toBeNull();
  });

  it("refuses a half-configured setup rather than silently losing plays", () => {
    expect(() => supabaseEnv({ SUPABASE_URL: "https://x.supabase.co" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => supabaseEnv({ SUPABASE_SERVICE_ROLE_KEY: "k" })).toThrow(/SUPABASE_URL/);
  });
});
