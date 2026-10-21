import { askOwly, isOwlyAvailable, subscribeOwly } from "@/lib/owly-bus";

describe("owly bus", () => {
  it("reports that nobody is listening before the assistant mounts", () => {
    expect(isOwlyAvailable()).toBe(false);
    expect(askOwly({ kind: "guide", guideId: "fees" })).toBe(false);
  });

  it("delivers a request to every listener and can be unsubscribed", () => {
    const first = jest.fn();
    const second = jest.fn();
    const offFirst = subscribeOwly(first);
    const offSecond = subscribeOwly(second);

    expect(askOwly({ kind: "guide", guideId: "fees" })).toBe(true);
    expect(first).toHaveBeenCalledWith({ kind: "guide", guideId: "fees" });
    expect(second).toHaveBeenCalledWith({ kind: "guide", guideId: "fees" });

    offFirst();
    offSecond();
    expect(isOwlyAvailable()).toBe(false);
  });

  it("keeps delivering when one listener throws", () => {
    const broken = () => {
      throw new Error("boom");
    };
    const healthy = jest.fn();
    const offBroken = subscribeOwly(broken);
    const offHealthy = subscribeOwly(healthy);

    expect(askOwly({ kind: "ask", question: "hello" })).toBe(true);
    expect(healthy).toHaveBeenCalledTimes(1);

    offBroken();
    offHealthy();
  });
});
