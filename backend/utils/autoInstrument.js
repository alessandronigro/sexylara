const Module = require('module');
const path = require('path');
const util = require('util');
const http = require('http');

// Install once and reuse if already loaded
if (global.__AUTO_FUNCTION_LOGGER__) {
  module.exports = global.__AUTO_FUNCTION_LOGGER__;
} else {
  // Disabled by default; set FN_LOGS_ENABLED=1 to turn on
  const instrumentationState = { enabled: process.env.FN_LOGS_ENABLED === '1' };
  global.__AUTO_FUNCTION_LOGGER__ = instrumentationState;
  module.exports = instrumentationState;

  const disabled =
    process.env.FUNCTION_LOGS_DISABLED === '1' ||
    process.env.FN_LOGS_DISABLED === '1';

  if (disabled || !instrumentationState.enabled) {
    instrumentationState.enabled = false;
    console.log('[fn-log] Function logging disabled.');
  } else {
    const backendRoot = path.resolve(__dirname, '..');
    const suppressedLabels = new Set([
      'ai/learning/MemoryConsolidationEngine.js::getQueueSize',
      'ai/memory/npcRepository.js::updateNpcProfile',
      'ai/scheduler/NpcInitiativeEngine.js::checkForInitiative',
      'routes/group.js::default', // suppress noisy group route logs
    ]);
    const suppressedPrefixes = [
      'routes/group.js', // mute all group route function logs
    ];
    const wrappedFns = new WeakSet();
    const wrappedExports = new WeakSet();

    function formatArgs(args) {
      return args
        .map((arg) => {
          try {
            // Compact logging for HTTP/Express req/res/next to avoid noisy dumps
            const isReq =
              arg instanceof http.IncomingMessage ||
              (arg &&
                arg._readableState &&
                arg.headers &&
                arg.method &&
                typeof arg.url === 'string');
            if (isReq) return `req:${arg.method} ${arg.url}`;

            const isRes =
              arg instanceof http.ServerResponse ||
              (arg &&
                typeof arg.setHeader === 'function' &&
                typeof arg.end === 'function' &&
                typeof arg.writeHead === 'function');
            if (isRes) return 'res';

            if (typeof arg === 'function') {
              return `fn:${arg.name || 'anonymous'}`;
            }

            if (arg && typeof arg === 'object') {
              const json = JSON.stringify(arg, null, 0);
              return json.length > 200 ? `${json.slice(0, 200)}...` : json;
            }

            const inspected = util.inspect(arg, { depth: 1, maxArrayLength: 3 });
            return inspected.length > 200 ? `${inspected.slice(0, 200)}...` : inspected;
          } catch (err) {
            return `[unserializable:${err.message}]`;
          }
        })
        .join(', ');
    }

    function wrapFunction(fn, label) {
      if (wrappedFns.has(fn)) return fn;
      const wrapped = new Proxy(fn, {
        apply(target, thisArg, argArray) {
          try {
            if (!instrumentationState.enabled) {
              return Reflect.apply(target, thisArg, argArray);
            }
            const isSuppressed =
              suppressedLabels.has(label) ||
              suppressedPrefixes.some((p) => label.startsWith(p));
            if (!isSuppressed) {
              console.log(`[fn] ${label}(${formatArgs(argArray)})`);
            }
          } catch (err) {
            // best-effort logging; never break the app
          }
          return Reflect.apply(target, thisArg, argArray);
        },
        construct(target, argArray, newTarget) {
          try {
            if (!instrumentationState.enabled) {
              return Reflect.construct(target, argArray, newTarget);
            }
            if (
              !suppressedLabels.has(label) &&
              !suppressedPrefixes.some((p) => label.startsWith(p))
            ) {
              console.log(`[fn:new] ${label}(${formatArgs(argArray)})`);
            }
          } catch (err) {
            // best-effort logging; never break the app
          }
          return Reflect.construct(target, argArray, newTarget);
        }
      });
      wrappedFns.add(wrapped);
      return wrapped;
    }

    function instrumentExports(exports, label) {
      if (!exports || wrappedExports.has(exports)) return exports;

      if (typeof exports === 'function') {
        const wrapped = wrapFunction(exports, `${label}::default`);
        wrappedExports.add(wrapped);
        return wrapped;
      }

      if (typeof exports === 'object') {
        Object.keys(exports).forEach((key) => {
          const val = exports[key];
          if (typeof val === 'function') {
            exports[key] = wrapFunction(val, `${label}::${val.name || key}`);
          }
        });
        wrappedExports.add(exports);
      }

      return exports;
    }

    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
      const loaded = originalLoad.apply(this, arguments);

      try {
        const resolved = Module._resolveFilename(request, parent, isMain);
        if (!resolved.startsWith(backendRoot)) return loaded;
        if (resolved.includes(`${path.sep}node_modules${path.sep}`)) return loaded;
        if (resolved.includes(`${path.sep}utils${path.sep}autoInstrument.js`)) return loaded;

        const label = path.relative(backendRoot, resolved);
        return instrumentExports(loaded, label);
      } catch (err) {
        // In case of resolution issues, fall back to the original export
        return loaded;
      }
    };
  }
}
