/**
 * Stub for jibo-singletons. The real package wraps a class so all `new Foo()`
 * calls share a single instance globally. We approximate it cleanly enough by
 * memoizing the first instance keyed by `name`. Compatible with ES6 classes
 * (which require `new`).
 */

'use strict';

const cache = Object.create(null);

function enforceSingleton(Class, name) {
  const key = name || Class.name || 'unnamed';
  function Wrapped(...args) {
    if (cache[key]) return cache[key];
    cache[key] = new Class(...args);
    return cache[key];
  }
  Wrapped.prototype = Class.prototype;
  Object.assign(Wrapped, Class);
  return Wrapped;
}

module.exports = { enforceSingleton, default: { enforceSingleton } };
module.exports.default.default = module.exports.default;
