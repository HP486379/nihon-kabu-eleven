import express from 'express';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isResultCalculationEnabled() {
  return ENABLED_VALUES.has(String(process.env.RESULTS_CALC_ENABLED || '').trim().toLowerCase());
}

function disabledResponse(res) {
  return res.status(403).json({
    ok: false,
    error: 'Result calculation is disabled',
    details: 'Set RESULTS_CALC_ENABLED=true on the backend to enable manual result calculation.',
    tsServer: new Date().toISOString(),
  });
}

const originalPost = express.application.post;

express.application.post = function guardedPost(path, ...handlers) {
  if (path !== '/api/results/calculate') {
    return originalPost.call(this, path, ...handlers);
  }

  const guardedHandlers = handlers.map((handler) => {
    if (typeof handler !== 'function') return handler;

    return function resultCalculationGuard(req, res, next) {
      if (!isResultCalculationEnabled()) {
        return disabledResponse(res);
      }

      return handler.call(this, req, res, next);
    };
  });

  return originalPost.call(this, path, ...guardedHandlers);
};

await import('./entryResultsFormalPatch.js');
