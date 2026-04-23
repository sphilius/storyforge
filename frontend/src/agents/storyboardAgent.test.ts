import { test, describe, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { generateStoryboard } from "./storyboardAgent.ts";

describe("Storyboard Agent", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalDateNow = Date.now;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalDateNow;
    mock.restoreAll();
  });

  test("successfully generates an image", async () => {
    Date.now = () => 1000;

    const mockResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: "base64data",
                  }
                }
              ]
            }
          }
        ]
      })
    } as Response;
    globalThis.fetch = mock.fn(async () => mockResponse);

    const mockActions = {
      updateScene: mock.fn(),
      addTrace: mock.fn(),
    };

    await generateStoryboard("s1", "Title", "prompt", "key", mockActions as any);

    assert.strictEqual(mockActions.updateScene.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[0].arguments, ["s1", { imageLoading: true }]);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[1].arguments, ["s1", { imageUrl: "data:image/jpeg;base64,base64data", imageLoading: false }]);

    assert.strictEqual(mockActions.addTrace.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.addTrace.mock.calls[0].arguments, [{
      id: `trace-sb-1000`,
      type: "storyboard_queued",
      message: `🖼️ Storyboard Agent: generating "Title"...`,
      timestamp: 1000,
    }]);
    assert.deepStrictEqual(mockActions.addTrace.mock.calls[1].arguments, [{
      id: `trace-sb-done-1000`,
      type: "storyboard_complete",
      message: `✅ Storyboard Agent: "Title" complete`,
      timestamp: 1000,
    }]);
  });

  test("handles fetch error gracefully", async () => {
    Date.now = () => 2000;

    const mockResponse = {
      ok: false,
      status: 400,
      text: async () => "Bad Request Error"
    } as Response;
    globalThis.fetch = mock.fn(async () => mockResponse);

    const mockActions = {
      updateScene: mock.fn(),
      addTrace: mock.fn(),
    };

    await generateStoryboard("s1", "Title", "prompt", "key", mockActions as any);

    assert.strictEqual(mockActions.updateScene.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[0].arguments, ["s1", { imageLoading: true }]);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[1].arguments, ["s1", { imageLoading: false }]);

    assert.strictEqual(mockActions.addTrace.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.addTrace.mock.calls[1].arguments, [{
      id: `trace-sb-err-2000`,
      type: "error",
      message: `❌ Storyboard Agent: Image API 400: Bad Request Error`,
      timestamp: 2000,
    }]);
  });

  test("handles empty candidates array gracefully", async () => {
    Date.now = () => 3000;

    const mockResponse = {
      ok: true,
      json: async () => ({ candidates: [] })
    } as Response;
    globalThis.fetch = mock.fn(async () => mockResponse);

    const mockActions = {
      updateScene: mock.fn(),
      addTrace: mock.fn(),
    };

    await generateStoryboard("s1", "Title", "prompt", "key", mockActions as any);

    assert.strictEqual(mockActions.updateScene.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[0].arguments, ["s1", { imageLoading: true }]);
    assert.deepStrictEqual(mockActions.updateScene.mock.calls[1].arguments, ["s1", { imageLoading: false }]);

    assert.strictEqual(mockActions.addTrace.mock.callCount(), 2);
    assert.deepStrictEqual(mockActions.addTrace.mock.calls[1].arguments, [{
      id: `trace-sb-noimg-3000`,
      type: "storyboard_queued",
      message: `⚠️ Storyboard Agent: no image returned for "Title"`,
      timestamp: 3000,
    }]);
  });
});
