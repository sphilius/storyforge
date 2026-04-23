import test from 'node:test';
import assert from 'node:assert';

test('QuotaExceededError handling in sessionStorage', async () => {
  let setItemCalled = 0;
  let removeItemCalled = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalWindow = (global as any).window;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          setItemCalled++;
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {
          removeItemCalled++;
        }
      }
    };

    const { useStoryState } = await import('./useStoryState.ts');

    // Trigger a state change to invoke the subscribe callback
    useStoryState.getState().addTrace({
      id: 'test-1',
      type: 'error',
      message: 'test trace',
      timestamp: Date.now()
    });

    assert.strictEqual(setItemCalled, 1);
    assert.strictEqual(removeItemCalled, 1);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = originalWindow;
  }
});
