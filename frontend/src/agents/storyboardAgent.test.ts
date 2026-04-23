import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { generateStoryboard } from "./storyboardAgent.ts";
import type { StoryState } from "../hooks/useStoryState.ts";

describe("Storyboard Agent", () => {
  let originalFetch: typeof global.fetch;
  let originalDateNow: typeof Date.now;
  let updateSceneMock: ReturnType<typeof mock.fn>;
  let addTraceMock: ReturnType<typeof mock.fn>;
  let actions: Pick<StoryState, "updateScene" | "addTrace">;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalDateNow = Date.now;

    // Mock Date.now() for deterministic trace IDs
    Date.now = mock.fn(() => 1234567890);

    updateSceneMock = mock.fn();
    addTraceMock = mock.fn();

    actions = {
      updateScene: updateSceneMock,
      addTrace: addTraceMock,
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Date.now = originalDateNow;
    mock.restoreAll();
  });

  it("handles missing/failing image API gracefully", async () => {
    // Mock global fetch to return a 500 status response
    global.fetch = mock.fn(async () => {
      return new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });
    });

    try {
      await generateStoryboard(
        "scene-123",
        "Test Scene",
        "A dramatic test scene",
        "test-api-key",
        actions
      );

      // Verify updateScene was called to turn off loading state
      assert.strictEqual(updateSceneMock.mock.calls.length, 2);

      // First call should be { imageLoading: true }
      assert.deepStrictEqual(updateSceneMock.mock.calls[0].arguments, [
        "scene-123",
        { imageLoading: true },
      ]);

      // Second call should be { imageLoading: false }
      assert.deepStrictEqual(updateSceneMock.mock.calls[1].arguments, [
        "scene-123",
        { imageLoading: false },
      ]);

      // Verify addTrace was called 2 times (queued, error)
      assert.strictEqual(addTraceMock.mock.calls.length, 2);

      // First call should be 'storyboard_queued'
      assert.deepStrictEqual(addTraceMock.mock.calls[0].arguments[0], {
        id: "trace-sb-1234567890",
        type: "storyboard_queued",
        message: '🖼️ Storyboard Agent: generating "Test Scene"...',
        timestamp: 1234567890,
      });

      // Second call should be 'error' containing the correct error message
      assert.deepStrictEqual(addTraceMock.mock.calls[1].arguments[0], {
        id: "trace-sb-err-1234567890",
        type: "error",
        message: '❌ Storyboard Agent: Image API 500: Internal Server Error',
        timestamp: 1234567890,
      });

    } finally {
      // Ensure global state is restored even if assertions fail
      global.fetch = originalFetch;
      Date.now = originalDateNow;
    }
  });

  it("handles empty image API response gracefully", async () => {
    // Mock global fetch to return a 200 status response with empty candidates
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await generateStoryboard(
        "scene-123",
        "Test Scene Empty",
        "A scene with no generated image",
        "test-api-key",
        actions
      );

      // Verify updateScene was called to turn off loading state
      assert.strictEqual(updateSceneMock.mock.calls.length, 2);
      assert.deepStrictEqual(updateSceneMock.mock.calls[1].arguments, [
        "scene-123",
        { imageLoading: false },
      ]);

      // Verify addTrace was called 2 times (queued, no image warning)
      assert.strictEqual(addTraceMock.mock.calls.length, 2);

      // Second call should be 'warning' no image returned
      assert.deepStrictEqual(addTraceMock.mock.calls[1].arguments[0], {
        id: "trace-sb-noimg-1234567890",
        type: "storyboard_queued",
        message: '⚠️ Storyboard Agent: no image returned for "Test Scene Empty"',
        timestamp: 1234567890,
      });
    } finally {
      global.fetch = originalFetch;
      Date.now = originalDateNow;
    }
  });

  it("handles successful image API response", async () => {
    // Mock global fetch to return a 200 status response with an image candidate
    global.fetch = mock.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: "base64data123",
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    try {
      await generateStoryboard(
        "scene-123",
        "Test Scene Success",
        "A successfully generated image scene",
        "test-api-key",
        actions
      );

      // Verify updateScene was called to turn off loading state and update image URL
      assert.strictEqual(updateSceneMock.mock.calls.length, 2);
      assert.deepStrictEqual(updateSceneMock.mock.calls[1].arguments, [
        "scene-123",
        { imageUrl: "data:image/jpeg;base64,base64data123", imageLoading: false },
      ]);

      // Verify addTrace was called 2 times (queued, complete)
      assert.strictEqual(addTraceMock.mock.calls.length, 2);

      // Second call should be 'complete'
      assert.deepStrictEqual(addTraceMock.mock.calls[1].arguments[0], {
        id: "trace-sb-done-1234567890",
        type: "storyboard_complete",
        message: '✅ Storyboard Agent: "Test Scene Success" complete',
        timestamp: 1234567890,
      });
    } finally {
      global.fetch = originalFetch;
      Date.now = originalDateNow;
    }
  });

});
