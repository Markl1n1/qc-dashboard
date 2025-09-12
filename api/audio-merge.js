import handler from '../server/audio-merge-node/index.js';

export default async function (req, res) {
  // Delegate to the Node ffmpeg handler
  try {
    // handler may be CommonJS or ESM; ensure invocation works
    if (typeof handler === 'function') {
      return await handler(req, res);
    }
    // if default exported
    const fn = handler.default || handler;
    return await fn(req, res);
  } catch (err) {
    console.error('api/audio-merge wrapper error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
