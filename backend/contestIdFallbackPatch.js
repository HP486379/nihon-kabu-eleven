import express from 'express';

const DEV_CONTEST_ID = String(process.env.DEV_CONTEST_ID || '5345b8eb-e9ec-4b4b-9549-35b3c4135003').trim();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeContestId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return UUID_PATTERN.test(text) ? text : DEV_CONTEST_ID;
}

function normalizeRequestContestId(req) {
  const raw = req?.query?.contestId
    ?? req?.query?.contest_id
    ?? req?.body?.contestId
    ?? req?.body?.contest_id
    ?? '';

  const normalized = normalizeContestId(raw);

  req.query = {
    ...(req.query || {}),
    contestId: normalized,
    contest_id: normalized,
  };

  if (req.body && typeof req.body === 'object') {
    req.body.contestId = normalized;
    req.body.contest_id = normalized;
  }
}

function shouldWrapRoute(path) {
  return path === '/api/entries' || path === '/api/results/calculate';
}

function wrapHandlers(handlers) {
  return handlers.map((handler) => {
    if (typeof handler !== 'function') return handler;

    return function contestIdFallbackHandler(req, res, next) {
      normalizeRequestContestId(req);
      return handler.call(this, req, res, next);
    };
  });
}

function patchRouteMethod(methodName) {
  const original = express.application[methodName];
  if (typeof original !== 'function') return;

  express.application[methodName] = function contestIdFallbackRoute(path, ...handlers) {
    if (shouldWrapRoute(path)) {
      return original.call(this, path, ...wrapHandlers(handlers));
    }

    return original.call(this, path, ...handlers);
  };
}

patchRouteMethod('get');
patchRouteMethod('post');
