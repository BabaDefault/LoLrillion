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
    yordles: ["champion:Teemo", "champion:Lulu", "champion:Gnar"],
    bandle: ["champion:Teemo", "champion:Yuumi"],
    mr: ["item:1057"],
  };

  it("leaves out Templates whose Answer Set is unchanged since approval, in any order", () => {
    const queue = reviewQueue(current, { yordles: approved("yordles", ["champion:Gnar", "champion:Teemo", "champion:Lulu"]) });
    expect(queue.map((e) => e.templateId)).not.toContain("yordles");
  });

  it("lists a Template whose Answer Set changed, with the Entities added and removed", () => {
    const queue = reviewQueue(current, {
      yordles: approved("yordles", ["champion:Gnar", "champion:Teemo", "champion:Lulu"]),
      bandle: approved("bandle", ["champion:Teemo", "champion:Tristana"]),
    });
    expect(queue).toEqual([
      { templateId: "bandle", status: "changed", added: ["champion:Yuumi"], removed: ["champion:Tristana"] },
      { templateId: "mr", status: "unreviewed", added: ["item:1057"], removed: [] },
    ]);
  });

  it("lists Templates that have never been approved", () => {
    const queue = reviewQueue(current, {});
    expect(queue.map((e) => [e.templateId, e.status])).toEqual([
      ["bandle", "unreviewed"],
      ["mr", "unreviewed"],
      ["yordles", "unreviewed"],
    ]);
  });
});
