import { describe, expect, it } from "vitest";
import { reviewQueue, type ApprovedReview } from "./index";

const approved = (templateId: string, answerSet: string[]): ApprovedReview => ({
  templateId,
  dataVersion: "16.22.1",
  answerSet,
  typicality: {},
  tooClever: [],
  gem: answerSet[0],
});

describe("review queue (Answer Set diff)", () => {
  const current = {
    stuns: ["champion:Yasuo", "champion:Riven", "champion:Kindred"],
    knockups: ["champion:Yasuo", "champion:Thresh"],
    mr: ["item:1057"],
  };

  it("leaves out Templates whose Answer Set is unchanged since approval, in any order", () => {
    const queue = reviewQueue(current, { stuns: approved("stuns", ["champion:Kindred", "champion:Yasuo", "champion:Riven"]) });
    expect(queue.map((e) => e.templateId)).not.toContain("stuns");
  });

  it("lists a Template whose Answer Set changed, with the Entities added and removed", () => {
    const queue = reviewQueue(current, {
      stuns: approved("stuns", ["champion:Kindred", "champion:Yasuo", "champion:Riven"]),
      knockups: approved("knockups", ["champion:Yasuo", "champion:Ahri"]),
    });
    expect(queue).toEqual([
      { templateId: "knockups", status: "changed", added: ["champion:Thresh"], removed: ["champion:Ahri"] },
      { templateId: "mr", status: "unreviewed", added: ["item:1057"], removed: [] },
    ]);
  });

  it("lists Templates that have never been approved", () => {
    const queue = reviewQueue(current, {});
    expect(queue.map((e) => [e.templateId, e.status])).toEqual([
      ["knockups", "unreviewed"],
      ["mr", "unreviewed"],
      ["stuns", "unreviewed"],
    ]);
  });
});
