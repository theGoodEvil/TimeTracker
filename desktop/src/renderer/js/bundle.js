(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/renderer/js/utils/helpers.js
  var require_helpers = __commonJS({
    "src/renderer/js/utils/helpers.js"(exports, module) {
      function formatDuration2(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        const secs = seconds % 60;
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }
        return `${minutes}m ${secs}s`;
      }
      function formatDurationLong2(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      function formatDate(date) {
        if (typeof date === "string") {
          date = new Date(date);
        }
        return date.toLocaleDateString();
      }
      function formatDateTime2(date) {
        if (typeof date === "string") {
          date = new Date(date);
        }
        return date.toLocaleString();
      }
      function parseISODate(dateString) {
        return new Date(dateString);
      }
      function isValidUrl2(string) {
        try {
          const url = new URL(string);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
          return false;
        }
      }
      function normalizeServerUrlInput2(input) {
        const trimmed = String(input || "").trim();
        if (!trimmed) return trimmed;
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return "https://" + trimmed;
      }
      function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
          const later = () => {
            clearTimeout(timeout);
            func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = {
          formatDuration: formatDuration2,
          formatDurationLong: formatDurationLong2,
          formatDate,
          formatDateTime: formatDateTime2,
          parseISODate,
          isValidUrl: isValidUrl2,
          normalizeServerUrlInput: normalizeServerUrlInput2,
          debounce
        };
      }
      if (typeof window !== "undefined") {
        window.Helpers = {
          formatDuration: formatDuration2,
          formatDurationLong: formatDurationLong2,
          formatDate,
          formatDateTime: formatDateTime2,
          parseISODate,
          isValidUrl: isValidUrl2,
          normalizeServerUrlInput: normalizeServerUrlInput2,
          debounce
        };
      }
    }
  });

  // node_modules/axios/dist/browser/axios.cjs
  var require_axios = __commonJS({
    "node_modules/axios/dist/browser/axios.cjs"(exports, module) {
      "use strict";
      function bind(fn, thisArg) {
        return function wrap() {
          return fn.apply(thisArg, arguments);
        };
      }
      var { toString } = Object.prototype;
      var { getPrototypeOf } = Object;
      var { iterator, toStringTag } = Symbol;
      var kindOf = /* @__PURE__ */ ((cache) => (thing) => {
        const str = toString.call(thing);
        return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
      })(/* @__PURE__ */ Object.create(null));
      var kindOfTest = (type) => {
        type = type.toLowerCase();
        return (thing) => kindOf(thing) === type;
      };
      var typeOfTest = (type) => (thing) => typeof thing === type;
      var { isArray } = Array;
      var isUndefined = typeOfTest("undefined");
      function isBuffer(val) {
        return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction$1(val.constructor.isBuffer) && val.constructor.isBuffer(val);
      }
      var isArrayBuffer = kindOfTest("ArrayBuffer");
      function isArrayBufferView(val) {
        let result;
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
          result = ArrayBuffer.isView(val);
        } else {
          result = val && val.buffer && isArrayBuffer(val.buffer);
        }
        return result;
      }
      var isString = typeOfTest("string");
      var isFunction$1 = typeOfTest("function");
      var isNumber = typeOfTest("number");
      var isObject = (thing) => thing !== null && typeof thing === "object";
      var isBoolean = (thing) => thing === true || thing === false;
      var isPlainObject = (val) => {
        if (kindOf(val) !== "object") {
          return false;
        }
        const prototype2 = getPrototypeOf(val);
        return (prototype2 === null || prototype2 === Object.prototype || Object.getPrototypeOf(prototype2) === null) && !(toStringTag in val) && !(iterator in val);
      };
      var isEmptyObject = (val) => {
        if (!isObject(val) || isBuffer(val)) {
          return false;
        }
        try {
          return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
        } catch (e) {
          return false;
        }
      };
      var isDate = kindOfTest("Date");
      var isFile = kindOfTest("File");
      var isReactNativeBlob = (value) => {
        return !!(value && typeof value.uri !== "undefined");
      };
      var isReactNative = (formData) => formData && typeof formData.getParts !== "undefined";
      var isBlob = kindOfTest("Blob");
      var isFileList = kindOfTest("FileList");
      var isStream = (val) => isObject(val) && isFunction$1(val.pipe);
      function getGlobal() {
        if (typeof globalThis !== "undefined") return globalThis;
        if (typeof self !== "undefined") return self;
        if (typeof window !== "undefined") return window;
        if (typeof global !== "undefined") return global;
        return {};
      }
      var G = getGlobal();
      var FormDataCtor = typeof G.FormData !== "undefined" ? G.FormData : void 0;
      var isFormData = (thing) => {
        let kind;
        return thing && (FormDataCtor && thing instanceof FormDataCtor || isFunction$1(thing.append) && ((kind = kindOf(thing)) === "formdata" || // detect form-data instance
        kind === "object" && isFunction$1(thing.toString) && thing.toString() === "[object FormData]"));
      };
      var isURLSearchParams = kindOfTest("URLSearchParams");
      var [isReadableStream, isRequest, isResponse, isHeaders] = [
        "ReadableStream",
        "Request",
        "Response",
        "Headers"
      ].map(kindOfTest);
      var trim = (str) => {
        return str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
      };
      function forEach(obj, fn, { allOwnKeys = false } = {}) {
        if (obj === null || typeof obj === "undefined") {
          return;
        }
        let i;
        let l;
        if (typeof obj !== "object") {
          obj = [obj];
        }
        if (isArray(obj)) {
          for (i = 0, l = obj.length; i < l; i++) {
            fn.call(null, obj[i], i, obj);
          }
        } else {
          if (isBuffer(obj)) {
            return;
          }
          const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
          const len = keys.length;
          let key;
          for (i = 0; i < len; i++) {
            key = keys[i];
            fn.call(null, obj[key], key, obj);
          }
        }
      }
      function findKey(obj, key) {
        if (isBuffer(obj)) {
          return null;
        }
        key = key.toLowerCase();
        const keys = Object.keys(obj);
        let i = keys.length;
        let _key;
        while (i-- > 0) {
          _key = keys[i];
          if (key === _key.toLowerCase()) {
            return _key;
          }
        }
        return null;
      }
      var _global = (() => {
        if (typeof globalThis !== "undefined") return globalThis;
        return typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
      })();
      var isContextDefined = (context) => !isUndefined(context) && context !== _global;
      function merge() {
        const { caseless, skipUndefined } = isContextDefined(this) && this || {};
        const result = {};
        const assignValue = (val, key) => {
          if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return;
          }
          const targetKey = caseless && findKey(result, key) || key;
          if (isPlainObject(result[targetKey]) && isPlainObject(val)) {
            result[targetKey] = merge(result[targetKey], val);
          } else if (isPlainObject(val)) {
            result[targetKey] = merge({}, val);
          } else if (isArray(val)) {
            result[targetKey] = val.slice();
          } else if (!skipUndefined || !isUndefined(val)) {
            result[targetKey] = val;
          }
        };
        for (let i = 0, l = arguments.length; i < l; i++) {
          arguments[i] && forEach(arguments[i], assignValue);
        }
        return result;
      }
      var extend = (a, b, thisArg, { allOwnKeys } = {}) => {
        forEach(
          b,
          (val, key) => {
            if (thisArg && isFunction$1(val)) {
              Object.defineProperty(a, key, {
                value: bind(val, thisArg),
                writable: true,
                enumerable: true,
                configurable: true
              });
            } else {
              Object.defineProperty(a, key, {
                value: val,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          },
          { allOwnKeys }
        );
        return a;
      };
      var stripBOM = (content) => {
        if (content.charCodeAt(0) === 65279) {
          content = content.slice(1);
        }
        return content;
      };
      var inherits = (constructor, superConstructor, props, descriptors) => {
        constructor.prototype = Object.create(superConstructor.prototype, descriptors);
        Object.defineProperty(constructor.prototype, "constructor", {
          value: constructor,
          writable: true,
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(constructor, "super", {
          value: superConstructor.prototype
        });
        props && Object.assign(constructor.prototype, props);
      };
      var toFlatObject = (sourceObj, destObj, filter, propFilter) => {
        let props;
        let i;
        let prop;
        const merged = {};
        destObj = destObj || {};
        if (sourceObj == null) return destObj;
        do {
          props = Object.getOwnPropertyNames(sourceObj);
          i = props.length;
          while (i-- > 0) {
            prop = props[i];
            if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
              destObj[prop] = sourceObj[prop];
              merged[prop] = true;
            }
          }
          sourceObj = filter !== false && getPrototypeOf(sourceObj);
        } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);
        return destObj;
      };
      var endsWith = (str, searchString, position) => {
        str = String(str);
        if (position === void 0 || position > str.length) {
          position = str.length;
        }
        position -= searchString.length;
        const lastIndex = str.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
      };
      var toArray = (thing) => {
        if (!thing) return null;
        if (isArray(thing)) return thing;
        let i = thing.length;
        if (!isNumber(i)) return null;
        const arr = new Array(i);
        while (i-- > 0) {
          arr[i] = thing[i];
        }
        return arr;
      };
      var isTypedArray = /* @__PURE__ */ ((TypedArray) => {
        return (thing) => {
          return TypedArray && thing instanceof TypedArray;
        };
      })(typeof Uint8Array !== "undefined" && getPrototypeOf(Uint8Array));
      var forEachEntry = (obj, fn) => {
        const generator = obj && obj[iterator];
        const _iterator = generator.call(obj);
        let result;
        while ((result = _iterator.next()) && !result.done) {
          const pair = result.value;
          fn.call(obj, pair[0], pair[1]);
        }
      };
      var matchAll = (regExp, str) => {
        let matches;
        const arr = [];
        while ((matches = regExp.exec(str)) !== null) {
          arr.push(matches);
        }
        return arr;
      };
      var isHTMLForm = kindOfTest("HTMLFormElement");
      var toCamelCase = (str) => {
        return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function replacer(m, p1, p2) {
          return p1.toUpperCase() + p2;
        });
      };
      var hasOwnProperty = (({ hasOwnProperty: hasOwnProperty2 }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype);
      var isRegExp = kindOfTest("RegExp");
      var reduceDescriptors = (obj, reducer) => {
        const descriptors = Object.getOwnPropertyDescriptors(obj);
        const reducedDescriptors = {};
        forEach(descriptors, (descriptor, name) => {
          let ret;
          if ((ret = reducer(descriptor, name, obj)) !== false) {
            reducedDescriptors[name] = ret || descriptor;
          }
        });
        Object.defineProperties(obj, reducedDescriptors);
      };
      var freezeMethods = (obj) => {
        reduceDescriptors(obj, (descriptor, name) => {
          if (isFunction$1(obj) && ["arguments", "caller", "callee"].indexOf(name) !== -1) {
            return false;
          }
          const value = obj[name];
          if (!isFunction$1(value)) return;
          descriptor.enumerable = false;
          if ("writable" in descriptor) {
            descriptor.writable = false;
            return;
          }
          if (!descriptor.set) {
            descriptor.set = () => {
              throw Error("Can not rewrite read-only method '" + name + "'");
            };
          }
        });
      };
      var toObjectSet = (arrayOrString, delimiter) => {
        const obj = {};
        const define = (arr) => {
          arr.forEach((value) => {
            obj[value] = true;
          });
        };
        isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));
        return obj;
      };
      var noop = () => {
      };
      var toFiniteNumber = (value, defaultValue) => {
        return value != null && Number.isFinite(value = +value) ? value : defaultValue;
      };
      function isSpecCompliantForm(thing) {
        return !!(thing && isFunction$1(thing.append) && thing[toStringTag] === "FormData" && thing[iterator]);
      }
      var toJSONObject = (obj) => {
        const stack = new Array(10);
        const visit = (source, i) => {
          if (isObject(source)) {
            if (stack.indexOf(source) >= 0) {
              return;
            }
            if (isBuffer(source)) {
              return source;
            }
            if (!("toJSON" in source)) {
              stack[i] = source;
              const target = isArray(source) ? [] : {};
              forEach(source, (value, key) => {
                const reducedValue = visit(value, i + 1);
                !isUndefined(reducedValue) && (target[key] = reducedValue);
              });
              stack[i] = void 0;
              return target;
            }
          }
          return source;
        };
        return visit(obj, 0);
      };
      var isAsyncFn = kindOfTest("AsyncFunction");
      var isThenable = (thing) => thing && (isObject(thing) || isFunction$1(thing)) && isFunction$1(thing.then) && isFunction$1(thing.catch);
      var _setImmediate = ((setImmediateSupported, postMessageSupported) => {
        if (setImmediateSupported) {
          return setImmediate;
        }
        return postMessageSupported ? ((token, callbacks) => {
          _global.addEventListener(
            "message",
            ({ source, data }) => {
              if (source === _global && data === token) {
                callbacks.length && callbacks.shift()();
              }
            },
            false
          );
          return (cb) => {
            callbacks.push(cb);
            _global.postMessage(token, "*");
          };
        })(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb);
      })(typeof setImmediate === "function", isFunction$1(_global.postMessage));
      var asap = typeof queueMicrotask !== "undefined" ? queueMicrotask.bind(_global) : typeof process !== "undefined" && process.nextTick || _setImmediate;
      var isIterable = (thing) => thing != null && isFunction$1(thing[iterator]);
      var utils$1 = {
        isArray,
        isArrayBuffer,
        isBuffer,
        isFormData,
        isArrayBufferView,
        isString,
        isNumber,
        isBoolean,
        isObject,
        isPlainObject,
        isEmptyObject,
        isReadableStream,
        isRequest,
        isResponse,
        isHeaders,
        isUndefined,
        isDate,
        isFile,
        isReactNativeBlob,
        isReactNative,
        isBlob,
        isRegExp,
        isFunction: isFunction$1,
        isStream,
        isURLSearchParams,
        isTypedArray,
        isFileList,
        forEach,
        merge,
        extend,
        trim,
        stripBOM,
        inherits,
        toFlatObject,
        kindOf,
        kindOfTest,
        endsWith,
        toArray,
        forEachEntry,
        matchAll,
        isHTMLForm,
        hasOwnProperty,
        hasOwnProp: hasOwnProperty,
        // an alias to avoid ESLint no-prototype-builtins detection
        reduceDescriptors,
        freezeMethods,
        toObjectSet,
        toCamelCase,
        noop,
        toFiniteNumber,
        findKey,
        global: _global,
        isContextDefined,
        isSpecCompliantForm,
        toJSONObject,
        isAsyncFn,
        isThenable,
        setImmediate: _setImmediate,
        asap,
        isIterable
      };
      var AxiosError = class _AxiosError extends Error {
        static from(error, code, config, request, response, customProps) {
          const axiosError = new _AxiosError(error.message, code || error.code, config, request, response);
          axiosError.cause = error;
          axiosError.name = error.name;
          if (error.status != null && axiosError.status == null) {
            axiosError.status = error.status;
          }
          customProps && Object.assign(axiosError, customProps);
          return axiosError;
        }
        /**
         * Create an Error with the specified message, config, error code, request and response.
         *
         * @param {string} message The error message.
         * @param {string} [code] The error code (for example, 'ECONNABORTED').
         * @param {Object} [config] The config.
         * @param {Object} [request] The request.
         * @param {Object} [response] The response.
         *
         * @returns {Error} The created error.
         */
        constructor(message, code, config, request, response) {
          super(message);
          Object.defineProperty(this, "message", {
            value: message,
            enumerable: true,
            writable: true,
            configurable: true
          });
          this.name = "AxiosError";
          this.isAxiosError = true;
          code && (this.code = code);
          config && (this.config = config);
          request && (this.request = request);
          if (response) {
            this.response = response;
            this.status = response.status;
          }
        }
        toJSON() {
          return {
            // Standard
            message: this.message,
            name: this.name,
            // Microsoft
            description: this.description,
            number: this.number,
            // Mozilla
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            // Axios
            config: utils$1.toJSONObject(this.config),
            code: this.code,
            status: this.status
          };
        }
      };
      AxiosError.ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
      AxiosError.ERR_BAD_OPTION = "ERR_BAD_OPTION";
      AxiosError.ECONNABORTED = "ECONNABORTED";
      AxiosError.ETIMEDOUT = "ETIMEDOUT";
      AxiosError.ERR_NETWORK = "ERR_NETWORK";
      AxiosError.ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
      AxiosError.ERR_DEPRECATED = "ERR_DEPRECATED";
      AxiosError.ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
      AxiosError.ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
      AxiosError.ERR_CANCELED = "ERR_CANCELED";
      AxiosError.ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
      AxiosError.ERR_INVALID_URL = "ERR_INVALID_URL";
      var httpAdapter = null;
      function isVisitable(thing) {
        return utils$1.isPlainObject(thing) || utils$1.isArray(thing);
      }
      function removeBrackets(key) {
        return utils$1.endsWith(key, "[]") ? key.slice(0, -2) : key;
      }
      function renderKey(path, key, dots) {
        if (!path) return key;
        return path.concat(key).map(function each(token, i) {
          token = removeBrackets(token);
          return !dots && i ? "[" + token + "]" : token;
        }).join(dots ? "." : "");
      }
      function isFlatArray(arr) {
        return utils$1.isArray(arr) && !arr.some(isVisitable);
      }
      var predicates = utils$1.toFlatObject(utils$1, {}, null, function filter(prop) {
        return /^is[A-Z]/.test(prop);
      });
      function toFormData(obj, formData, options) {
        if (!utils$1.isObject(obj)) {
          throw new TypeError("target must be an object");
        }
        formData = formData || new FormData();
        options = utils$1.toFlatObject(
          options,
          {
            metaTokens: true,
            dots: false,
            indexes: false
          },
          false,
          function defined(option, source) {
            return !utils$1.isUndefined(source[option]);
          }
        );
        const metaTokens = options.metaTokens;
        const visitor = options.visitor || defaultVisitor;
        const dots = options.dots;
        const indexes = options.indexes;
        const _Blob = options.Blob || typeof Blob !== "undefined" && Blob;
        const useBlob = _Blob && utils$1.isSpecCompliantForm(formData);
        if (!utils$1.isFunction(visitor)) {
          throw new TypeError("visitor must be a function");
        }
        function convertValue(value) {
          if (value === null) return "";
          if (utils$1.isDate(value)) {
            return value.toISOString();
          }
          if (utils$1.isBoolean(value)) {
            return value.toString();
          }
          if (!useBlob && utils$1.isBlob(value)) {
            throw new AxiosError("Blob is not supported. Use a Buffer instead.");
          }
          if (utils$1.isArrayBuffer(value) || utils$1.isTypedArray(value)) {
            return useBlob && typeof Blob === "function" ? new Blob([value]) : Buffer.from(value);
          }
          return value;
        }
        function defaultVisitor(value, key, path) {
          let arr = value;
          if (utils$1.isReactNative(formData) && utils$1.isReactNativeBlob(value)) {
            formData.append(renderKey(path, key, dots), convertValue(value));
            return false;
          }
          if (value && !path && typeof value === "object") {
            if (utils$1.endsWith(key, "{}")) {
              key = metaTokens ? key : key.slice(0, -2);
              value = JSON.stringify(value);
            } else if (utils$1.isArray(value) && isFlatArray(value) || (utils$1.isFileList(value) || utils$1.endsWith(key, "[]")) && (arr = utils$1.toArray(value))) {
              key = removeBrackets(key);
              arr.forEach(function each(el, index) {
                !(utils$1.isUndefined(el) || el === null) && formData.append(
                  // eslint-disable-next-line no-nested-ternary
                  indexes === true ? renderKey([key], index, dots) : indexes === null ? key : key + "[]",
                  convertValue(el)
                );
              });
              return false;
            }
          }
          if (isVisitable(value)) {
            return true;
          }
          formData.append(renderKey(path, key, dots), convertValue(value));
          return false;
        }
        const stack = [];
        const exposedHelpers = Object.assign(predicates, {
          defaultVisitor,
          convertValue,
          isVisitable
        });
        function build(value, path) {
          if (utils$1.isUndefined(value)) return;
          if (stack.indexOf(value) !== -1) {
            throw Error("Circular reference detected in " + path.join("."));
          }
          stack.push(value);
          utils$1.forEach(value, function each(el, key) {
            const result = !(utils$1.isUndefined(el) || el === null) && visitor.call(formData, el, utils$1.isString(key) ? key.trim() : key, path, exposedHelpers);
            if (result === true) {
              build(el, path ? path.concat(key) : [key]);
            }
          });
          stack.pop();
        }
        if (!utils$1.isObject(obj)) {
          throw new TypeError("data must be an object");
        }
        build(obj);
        return formData;
      }
      function encode$1(str) {
        const charMap = {
          "!": "%21",
          "'": "%27",
          "(": "%28",
          ")": "%29",
          "~": "%7E",
          "%20": "+",
          "%00": "\0"
        };
        return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
          return charMap[match];
        });
      }
      function AxiosURLSearchParams(params, options) {
        this._pairs = [];
        params && toFormData(params, this, options);
      }
      var prototype = AxiosURLSearchParams.prototype;
      prototype.append = function append(name, value) {
        this._pairs.push([name, value]);
      };
      prototype.toString = function toString2(encoder) {
        const _encode = encoder ? function(value) {
          return encoder.call(this, value, encode$1);
        } : encode$1;
        return this._pairs.map(function each(pair) {
          return _encode(pair[0]) + "=" + _encode(pair[1]);
        }, "").join("&");
      };
      function encode(val) {
        return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
      }
      function buildURL(url, params, options) {
        if (!params) {
          return url;
        }
        const _encode = options && options.encode || encode;
        const _options = utils$1.isFunction(options) ? {
          serialize: options
        } : options;
        const serializeFn = _options && _options.serialize;
        let serializedParams;
        if (serializeFn) {
          serializedParams = serializeFn(params, _options);
        } else {
          serializedParams = utils$1.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams(params, _options).toString(_encode);
        }
        if (serializedParams) {
          const hashmarkIndex = url.indexOf("#");
          if (hashmarkIndex !== -1) {
            url = url.slice(0, hashmarkIndex);
          }
          url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
        }
        return url;
      }
      var InterceptorManager = class {
        constructor() {
          this.handlers = [];
        }
        /**
         * Add a new interceptor to the stack
         *
         * @param {Function} fulfilled The function to handle `then` for a `Promise`
         * @param {Function} rejected The function to handle `reject` for a `Promise`
         * @param {Object} options The options for the interceptor, synchronous and runWhen
         *
         * @return {Number} An ID used to remove interceptor later
         */
        use(fulfilled, rejected, options) {
          this.handlers.push({
            fulfilled,
            rejected,
            synchronous: options ? options.synchronous : false,
            runWhen: options ? options.runWhen : null
          });
          return this.handlers.length - 1;
        }
        /**
         * Remove an interceptor from the stack
         *
         * @param {Number} id The ID that was returned by `use`
         *
         * @returns {void}
         */
        eject(id) {
          if (this.handlers[id]) {
            this.handlers[id] = null;
          }
        }
        /**
         * Clear all interceptors from the stack
         *
         * @returns {void}
         */
        clear() {
          if (this.handlers) {
            this.handlers = [];
          }
        }
        /**
         * Iterate over all the registered interceptors
         *
         * This method is particularly useful for skipping over any
         * interceptors that may have become `null` calling `eject`.
         *
         * @param {Function} fn The function to call for each interceptor
         *
         * @returns {void}
         */
        forEach(fn) {
          utils$1.forEach(this.handlers, function forEachHandler(h) {
            if (h !== null) {
              fn(h);
            }
          });
        }
      };
      var transitionalDefaults = {
        silentJSONParsing: true,
        forcedJSONParsing: true,
        clarifyTimeoutError: false,
        legacyInterceptorReqResOrdering: true
      };
      var URLSearchParams$1 = typeof URLSearchParams !== "undefined" ? URLSearchParams : AxiosURLSearchParams;
      var FormData$1 = typeof FormData !== "undefined" ? FormData : null;
      var Blob$1 = typeof Blob !== "undefined" ? Blob : null;
      var platform$1 = {
        isBrowser: true,
        classes: {
          URLSearchParams: URLSearchParams$1,
          FormData: FormData$1,
          Blob: Blob$1
        },
        protocols: ["http", "https", "file", "blob", "url", "data"]
      };
      var hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
      var _navigator = typeof navigator === "object" && navigator || void 0;
      var hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || ["ReactNative", "NativeScript", "NS"].indexOf(_navigator.product) < 0);
      var hasStandardBrowserWebWorkerEnv = (() => {
        return typeof WorkerGlobalScope !== "undefined" && // eslint-disable-next-line no-undef
        self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
      })();
      var origin = hasBrowserEnv && window.location.href || "http://localhost";
      var utils = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        hasBrowserEnv,
        hasStandardBrowserEnv,
        hasStandardBrowserWebWorkerEnv,
        navigator: _navigator,
        origin
      });
      var platform = {
        ...utils,
        ...platform$1
      };
      function toURLEncodedForm(data, options) {
        return toFormData(data, new platform.classes.URLSearchParams(), {
          visitor: function(value, key, path, helpers) {
            if (platform.isNode && utils$1.isBuffer(value)) {
              this.append(key, value.toString("base64"));
              return false;
            }
            return helpers.defaultVisitor.apply(this, arguments);
          },
          ...options
        });
      }
      function parsePropPath(name) {
        return utils$1.matchAll(/\w+|\[(\w*)]/g, name).map((match) => {
          return match[0] === "[]" ? "" : match[1] || match[0];
        });
      }
      function arrayToObject(arr) {
        const obj = {};
        const keys = Object.keys(arr);
        let i;
        const len = keys.length;
        let key;
        for (i = 0; i < len; i++) {
          key = keys[i];
          obj[key] = arr[key];
        }
        return obj;
      }
      function formDataToJSON(formData) {
        function buildPath(path, value, target, index) {
          let name = path[index++];
          if (name === "__proto__") return true;
          const isNumericKey = Number.isFinite(+name);
          const isLast = index >= path.length;
          name = !name && utils$1.isArray(target) ? target.length : name;
          if (isLast) {
            if (utils$1.hasOwnProp(target, name)) {
              target[name] = [target[name], value];
            } else {
              target[name] = value;
            }
            return !isNumericKey;
          }
          if (!target[name] || !utils$1.isObject(target[name])) {
            target[name] = [];
          }
          const result = buildPath(path, value, target[name], index);
          if (result && utils$1.isArray(target[name])) {
            target[name] = arrayToObject(target[name]);
          }
          return !isNumericKey;
        }
        if (utils$1.isFormData(formData) && utils$1.isFunction(formData.entries)) {
          const obj = {};
          utils$1.forEachEntry(formData, (name, value) => {
            buildPath(parsePropPath(name), value, obj, 0);
          });
          return obj;
        }
        return null;
      }
      function stringifySafely(rawValue, parser, encoder) {
        if (utils$1.isString(rawValue)) {
          try {
            (parser || JSON.parse)(rawValue);
            return utils$1.trim(rawValue);
          } catch (e) {
            if (e.name !== "SyntaxError") {
              throw e;
            }
          }
        }
        return (encoder || JSON.stringify)(rawValue);
      }
      var defaults = {
        transitional: transitionalDefaults,
        adapter: ["xhr", "http", "fetch"],
        transformRequest: [
          function transformRequest(data, headers) {
            const contentType = headers.getContentType() || "";
            const hasJSONContentType = contentType.indexOf("application/json") > -1;
            const isObjectPayload = utils$1.isObject(data);
            if (isObjectPayload && utils$1.isHTMLForm(data)) {
              data = new FormData(data);
            }
            const isFormData2 = utils$1.isFormData(data);
            if (isFormData2) {
              return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
            }
            if (utils$1.isArrayBuffer(data) || utils$1.isBuffer(data) || utils$1.isStream(data) || utils$1.isFile(data) || utils$1.isBlob(data) || utils$1.isReadableStream(data)) {
              return data;
            }
            if (utils$1.isArrayBufferView(data)) {
              return data.buffer;
            }
            if (utils$1.isURLSearchParams(data)) {
              headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", false);
              return data.toString();
            }
            let isFileList2;
            if (isObjectPayload) {
              if (contentType.indexOf("application/x-www-form-urlencoded") > -1) {
                return toURLEncodedForm(data, this.formSerializer).toString();
              }
              if ((isFileList2 = utils$1.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
                const _FormData = this.env && this.env.FormData;
                return toFormData(
                  isFileList2 ? { "files[]": data } : data,
                  _FormData && new _FormData(),
                  this.formSerializer
                );
              }
            }
            if (isObjectPayload || hasJSONContentType) {
              headers.setContentType("application/json", false);
              return stringifySafely(data);
            }
            return data;
          }
        ],
        transformResponse: [
          function transformResponse(data) {
            const transitional = this.transitional || defaults.transitional;
            const forcedJSONParsing = transitional && transitional.forcedJSONParsing;
            const JSONRequested = this.responseType === "json";
            if (utils$1.isResponse(data) || utils$1.isReadableStream(data)) {
              return data;
            }
            if (data && utils$1.isString(data) && (forcedJSONParsing && !this.responseType || JSONRequested)) {
              const silentJSONParsing = transitional && transitional.silentJSONParsing;
              const strictJSONParsing = !silentJSONParsing && JSONRequested;
              try {
                return JSON.parse(data, this.parseReviver);
              } catch (e) {
                if (strictJSONParsing) {
                  if (e.name === "SyntaxError") {
                    throw AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
                  }
                  throw e;
                }
              }
            }
            return data;
          }
        ],
        /**
         * A timeout in milliseconds to abort a request. If set to 0 (default) a
         * timeout is not created.
         */
        timeout: 0,
        xsrfCookieName: "XSRF-TOKEN",
        xsrfHeaderName: "X-XSRF-TOKEN",
        maxContentLength: -1,
        maxBodyLength: -1,
        env: {
          FormData: platform.classes.FormData,
          Blob: platform.classes.Blob
        },
        validateStatus: function validateStatus(status) {
          return status >= 200 && status < 300;
        },
        headers: {
          common: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": void 0
          }
        }
      };
      utils$1.forEach(["delete", "get", "head", "post", "put", "patch"], (method) => {
        defaults.headers[method] = {};
      });
      var ignoreDuplicateOf = utils$1.toObjectSet([
        "age",
        "authorization",
        "content-length",
        "content-type",
        "etag",
        "expires",
        "from",
        "host",
        "if-modified-since",
        "if-unmodified-since",
        "last-modified",
        "location",
        "max-forwards",
        "proxy-authorization",
        "referer",
        "retry-after",
        "user-agent"
      ]);
      var parseHeaders = (rawHeaders) => {
        const parsed = {};
        let key;
        let val;
        let i;
        rawHeaders && rawHeaders.split("\n").forEach(function parser(line) {
          i = line.indexOf(":");
          key = line.substring(0, i).trim().toLowerCase();
          val = line.substring(i + 1).trim();
          if (!key || parsed[key] && ignoreDuplicateOf[key]) {
            return;
          }
          if (key === "set-cookie") {
            if (parsed[key]) {
              parsed[key].push(val);
            } else {
              parsed[key] = [val];
            }
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
          }
        });
        return parsed;
      };
      var $internals = /* @__PURE__ */ Symbol("internals");
      var isValidHeaderValue = (value) => !/[\r\n]/.test(value);
      function assertValidHeaderValue(value, header) {
        if (value === false || value == null) {
          return;
        }
        if (utils$1.isArray(value)) {
          value.forEach((v) => assertValidHeaderValue(v, header));
          return;
        }
        if (!isValidHeaderValue(String(value))) {
          throw new Error(`Invalid character in header content ["${header}"]`);
        }
      }
      function normalizeHeader(header) {
        return header && String(header).trim().toLowerCase();
      }
      function stripTrailingCRLF(str) {
        let end = str.length;
        while (end > 0) {
          const charCode = str.charCodeAt(end - 1);
          if (charCode !== 10 && charCode !== 13) {
            break;
          }
          end -= 1;
        }
        return end === str.length ? str : str.slice(0, end);
      }
      function normalizeValue(value) {
        if (value === false || value == null) {
          return value;
        }
        return utils$1.isArray(value) ? value.map(normalizeValue) : stripTrailingCRLF(String(value));
      }
      function parseTokens(str) {
        const tokens = /* @__PURE__ */ Object.create(null);
        const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
        let match;
        while (match = tokensRE.exec(str)) {
          tokens[match[1]] = match[2];
        }
        return tokens;
      }
      var isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());
      function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
        if (utils$1.isFunction(filter)) {
          return filter.call(this, value, header);
        }
        if (isHeaderNameFilter) {
          value = header;
        }
        if (!utils$1.isString(value)) return;
        if (utils$1.isString(filter)) {
          return value.indexOf(filter) !== -1;
        }
        if (utils$1.isRegExp(filter)) {
          return filter.test(value);
        }
      }
      function formatHeader(header) {
        return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
          return char.toUpperCase() + str;
        });
      }
      function buildAccessors(obj, header) {
        const accessorName = utils$1.toCamelCase(" " + header);
        ["get", "set", "has"].forEach((methodName) => {
          Object.defineProperty(obj, methodName + accessorName, {
            value: function(arg1, arg2, arg3) {
              return this[methodName].call(this, header, arg1, arg2, arg3);
            },
            configurable: true
          });
        });
      }
      var AxiosHeaders = class {
        constructor(headers) {
          headers && this.set(headers);
        }
        set(header, valueOrRewrite, rewrite) {
          const self2 = this;
          function setHeader(_value, _header, _rewrite) {
            const lHeader = normalizeHeader(_header);
            if (!lHeader) {
              throw new Error("header name must be a non-empty string");
            }
            const key = utils$1.findKey(self2, lHeader);
            if (!key || self2[key] === void 0 || _rewrite === true || _rewrite === void 0 && self2[key] !== false) {
              assertValidHeaderValue(_value, _header);
              self2[key || _header] = normalizeValue(_value);
            }
          }
          const setHeaders = (headers, _rewrite) => utils$1.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));
          if (utils$1.isPlainObject(header) || header instanceof this.constructor) {
            setHeaders(header, valueOrRewrite);
          } else if (utils$1.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
            setHeaders(parseHeaders(header), valueOrRewrite);
          } else if (utils$1.isObject(header) && utils$1.isIterable(header)) {
            let obj = {}, dest, key;
            for (const entry of header) {
              if (!utils$1.isArray(entry)) {
                throw TypeError("Object iterator must return a key-value pair");
              }
              obj[key = entry[0]] = (dest = obj[key]) ? utils$1.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]] : entry[1];
            }
            setHeaders(obj, valueOrRewrite);
          } else {
            header != null && setHeader(valueOrRewrite, header, rewrite);
          }
          return this;
        }
        get(header, parser) {
          header = normalizeHeader(header);
          if (header) {
            const key = utils$1.findKey(this, header);
            if (key) {
              const value = this[key];
              if (!parser) {
                return value;
              }
              if (parser === true) {
                return parseTokens(value);
              }
              if (utils$1.isFunction(parser)) {
                return parser.call(this, value, key);
              }
              if (utils$1.isRegExp(parser)) {
                return parser.exec(value);
              }
              throw new TypeError("parser must be boolean|regexp|function");
            }
          }
        }
        has(header, matcher) {
          header = normalizeHeader(header);
          if (header) {
            const key = utils$1.findKey(this, header);
            return !!(key && this[key] !== void 0 && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
          }
          return false;
        }
        delete(header, matcher) {
          const self2 = this;
          let deleted = false;
          function deleteHeader(_header) {
            _header = normalizeHeader(_header);
            if (_header) {
              const key = utils$1.findKey(self2, _header);
              if (key && (!matcher || matchHeaderValue(self2, self2[key], key, matcher))) {
                delete self2[key];
                deleted = true;
              }
            }
          }
          if (utils$1.isArray(header)) {
            header.forEach(deleteHeader);
          } else {
            deleteHeader(header);
          }
          return deleted;
        }
        clear(matcher) {
          const keys = Object.keys(this);
          let i = keys.length;
          let deleted = false;
          while (i--) {
            const key = keys[i];
            if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
              delete this[key];
              deleted = true;
            }
          }
          return deleted;
        }
        normalize(format) {
          const self2 = this;
          const headers = {};
          utils$1.forEach(this, (value, header) => {
            const key = utils$1.findKey(headers, header);
            if (key) {
              self2[key] = normalizeValue(value);
              delete self2[header];
              return;
            }
            const normalized = format ? formatHeader(header) : String(header).trim();
            if (normalized !== header) {
              delete self2[header];
            }
            self2[normalized] = normalizeValue(value);
            headers[normalized] = true;
          });
          return this;
        }
        concat(...targets) {
          return this.constructor.concat(this, ...targets);
        }
        toJSON(asStrings) {
          const obj = /* @__PURE__ */ Object.create(null);
          utils$1.forEach(this, (value, header) => {
            value != null && value !== false && (obj[header] = asStrings && utils$1.isArray(value) ? value.join(", ") : value);
          });
          return obj;
        }
        [Symbol.iterator]() {
          return Object.entries(this.toJSON())[Symbol.iterator]();
        }
        toString() {
          return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join("\n");
        }
        getSetCookie() {
          return this.get("set-cookie") || [];
        }
        get [Symbol.toStringTag]() {
          return "AxiosHeaders";
        }
        static from(thing) {
          return thing instanceof this ? thing : new this(thing);
        }
        static concat(first, ...targets) {
          const computed = new this(first);
          targets.forEach((target) => computed.set(target));
          return computed;
        }
        static accessor(header) {
          const internals = this[$internals] = this[$internals] = {
            accessors: {}
          };
          const accessors = internals.accessors;
          const prototype2 = this.prototype;
          function defineAccessor(_header) {
            const lHeader = normalizeHeader(_header);
            if (!accessors[lHeader]) {
              buildAccessors(prototype2, _header);
              accessors[lHeader] = true;
            }
          }
          utils$1.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);
          return this;
        }
      };
      AxiosHeaders.accessor([
        "Content-Type",
        "Content-Length",
        "Accept",
        "Accept-Encoding",
        "User-Agent",
        "Authorization"
      ]);
      utils$1.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
        let mapped = key[0].toUpperCase() + key.slice(1);
        return {
          get: () => value,
          set(headerValue) {
            this[mapped] = headerValue;
          }
        };
      });
      utils$1.freezeMethods(AxiosHeaders);
      function transformData(fns, response) {
        const config = this || defaults;
        const context = response || config;
        const headers = AxiosHeaders.from(context.headers);
        let data = context.data;
        utils$1.forEach(fns, function transform(fn) {
          data = fn.call(config, data, headers.normalize(), response ? response.status : void 0);
        });
        headers.normalize();
        return data;
      }
      function isCancel(value) {
        return !!(value && value.__CANCEL__);
      }
      var CanceledError = class extends AxiosError {
        /**
         * A `CanceledError` is an object that is thrown when an operation is canceled.
         *
         * @param {string=} message The message.
         * @param {Object=} config The config.
         * @param {Object=} request The request.
         *
         * @returns {CanceledError} The created error.
         */
        constructor(message, config, request) {
          super(message == null ? "canceled" : message, AxiosError.ERR_CANCELED, config, request);
          this.name = "CanceledError";
          this.__CANCEL__ = true;
        }
      };
      function settle(resolve, reject, response) {
        const validateStatus = response.config.validateStatus;
        if (!response.status || !validateStatus || validateStatus(response.status)) {
          resolve(response);
        } else {
          reject(
            new AxiosError(
              "Request failed with status code " + response.status,
              [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
              response.config,
              response.request,
              response
            )
          );
        }
      }
      function parseProtocol(url) {
        const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
        return match && match[1] || "";
      }
      function speedometer(samplesCount, min) {
        samplesCount = samplesCount || 10;
        const bytes = new Array(samplesCount);
        const timestamps = new Array(samplesCount);
        let head = 0;
        let tail = 0;
        let firstSampleTS;
        min = min !== void 0 ? min : 1e3;
        return function push(chunkLength) {
          const now = Date.now();
          const startedAt = timestamps[tail];
          if (!firstSampleTS) {
            firstSampleTS = now;
          }
          bytes[head] = chunkLength;
          timestamps[head] = now;
          let i = tail;
          let bytesCount = 0;
          while (i !== head) {
            bytesCount += bytes[i++];
            i = i % samplesCount;
          }
          head = (head + 1) % samplesCount;
          if (head === tail) {
            tail = (tail + 1) % samplesCount;
          }
          if (now - firstSampleTS < min) {
            return;
          }
          const passed = startedAt && now - startedAt;
          return passed ? Math.round(bytesCount * 1e3 / passed) : void 0;
        };
      }
      function throttle(fn, freq) {
        let timestamp = 0;
        let threshold = 1e3 / freq;
        let lastArgs;
        let timer;
        const invoke = (args, now = Date.now()) => {
          timestamp = now;
          lastArgs = null;
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          fn(...args);
        };
        const throttled = (...args) => {
          const now = Date.now();
          const passed = now - timestamp;
          if (passed >= threshold) {
            invoke(args, now);
          } else {
            lastArgs = args;
            if (!timer) {
              timer = setTimeout(() => {
                timer = null;
                invoke(lastArgs);
              }, threshold - passed);
            }
          }
        };
        const flush = () => lastArgs && invoke(lastArgs);
        return [throttled, flush];
      }
      var progressEventReducer = (listener, isDownloadStream, freq = 3) => {
        let bytesNotified = 0;
        const _speedometer = speedometer(50, 250);
        return throttle((e) => {
          const loaded = e.loaded;
          const total = e.lengthComputable ? e.total : void 0;
          const progressBytes = loaded - bytesNotified;
          const rate = _speedometer(progressBytes);
          const inRange = loaded <= total;
          bytesNotified = loaded;
          const data = {
            loaded,
            total,
            progress: total ? loaded / total : void 0,
            bytes: progressBytes,
            rate: rate ? rate : void 0,
            estimated: rate && total && inRange ? (total - loaded) / rate : void 0,
            event: e,
            lengthComputable: total != null,
            [isDownloadStream ? "download" : "upload"]: true
          };
          listener(data);
        }, freq);
      };
      var progressEventDecorator = (total, throttled) => {
        const lengthComputable = total != null;
        return [
          (loaded) => throttled[0]({
            lengthComputable,
            total,
            loaded
          }),
          throttled[1]
        ];
      };
      var asyncDecorator = (fn) => (...args) => utils$1.asap(() => fn(...args));
      var isURLSameOrigin = platform.hasStandardBrowserEnv ? /* @__PURE__ */ ((origin2, isMSIE) => (url) => {
        url = new URL(url, platform.origin);
        return origin2.protocol === url.protocol && origin2.host === url.host && (isMSIE || origin2.port === url.port);
      })(
        new URL(platform.origin),
        platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)
      ) : () => true;
      var cookies = platform.hasStandardBrowserEnv ? (
        // Standard browser envs support document.cookie
        {
          write(name, value, expires, path, domain, secure, sameSite) {
            if (typeof document === "undefined") return;
            const cookie = [`${name}=${encodeURIComponent(value)}`];
            if (utils$1.isNumber(expires)) {
              cookie.push(`expires=${new Date(expires).toUTCString()}`);
            }
            if (utils$1.isString(path)) {
              cookie.push(`path=${path}`);
            }
            if (utils$1.isString(domain)) {
              cookie.push(`domain=${domain}`);
            }
            if (secure === true) {
              cookie.push("secure");
            }
            if (utils$1.isString(sameSite)) {
              cookie.push(`SameSite=${sameSite}`);
            }
            document.cookie = cookie.join("; ");
          },
          read(name) {
            if (typeof document === "undefined") return null;
            const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
            return match ? decodeURIComponent(match[1]) : null;
          },
          remove(name) {
            this.write(name, "", Date.now() - 864e5, "/");
          }
        }
      ) : (
        // Non-standard browser env (web workers, react-native) lack needed support.
        {
          write() {
          },
          read() {
            return null;
          },
          remove() {
          }
        }
      );
      function isAbsoluteURL(url) {
        if (typeof url !== "string") {
          return false;
        }
        return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
      }
      function combineURLs(baseURL, relativeURL) {
        return relativeURL ? baseURL.replace(/\/?\/$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
      }
      function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
        let isRelativeUrl = !isAbsoluteURL(requestedURL);
        if (baseURL && (isRelativeUrl || allowAbsoluteUrls == false)) {
          return combineURLs(baseURL, requestedURL);
        }
        return requestedURL;
      }
      var headersToObject = (thing) => thing instanceof AxiosHeaders ? { ...thing } : thing;
      function mergeConfig(config1, config2) {
        config2 = config2 || {};
        const config = {};
        function getMergedValue(target, source, prop, caseless) {
          if (utils$1.isPlainObject(target) && utils$1.isPlainObject(source)) {
            return utils$1.merge.call({ caseless }, target, source);
          } else if (utils$1.isPlainObject(source)) {
            return utils$1.merge({}, source);
          } else if (utils$1.isArray(source)) {
            return source.slice();
          }
          return source;
        }
        function mergeDeepProperties(a, b, prop, caseless) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(a, b, prop, caseless);
          } else if (!utils$1.isUndefined(a)) {
            return getMergedValue(void 0, a, prop, caseless);
          }
        }
        function valueFromConfig2(a, b) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(void 0, b);
          }
        }
        function defaultToConfig2(a, b) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(void 0, b);
          } else if (!utils$1.isUndefined(a)) {
            return getMergedValue(void 0, a);
          }
        }
        function mergeDirectKeys(a, b, prop) {
          if (prop in config2) {
            return getMergedValue(a, b);
          } else if (prop in config1) {
            return getMergedValue(void 0, a);
          }
        }
        const mergeMap = {
          url: valueFromConfig2,
          method: valueFromConfig2,
          data: valueFromConfig2,
          baseURL: defaultToConfig2,
          transformRequest: defaultToConfig2,
          transformResponse: defaultToConfig2,
          paramsSerializer: defaultToConfig2,
          timeout: defaultToConfig2,
          timeoutMessage: defaultToConfig2,
          withCredentials: defaultToConfig2,
          withXSRFToken: defaultToConfig2,
          adapter: defaultToConfig2,
          responseType: defaultToConfig2,
          xsrfCookieName: defaultToConfig2,
          xsrfHeaderName: defaultToConfig2,
          onUploadProgress: defaultToConfig2,
          onDownloadProgress: defaultToConfig2,
          decompress: defaultToConfig2,
          maxContentLength: defaultToConfig2,
          maxBodyLength: defaultToConfig2,
          beforeRedirect: defaultToConfig2,
          transport: defaultToConfig2,
          httpAgent: defaultToConfig2,
          httpsAgent: defaultToConfig2,
          cancelToken: defaultToConfig2,
          socketPath: defaultToConfig2,
          responseEncoding: defaultToConfig2,
          validateStatus: mergeDirectKeys,
          headers: (a, b, prop) => mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true)
        };
        utils$1.forEach(Object.keys({ ...config1, ...config2 }), function computeConfigValue(prop) {
          if (prop === "__proto__" || prop === "constructor" || prop === "prototype") return;
          const merge2 = utils$1.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
          const configValue = merge2(config1[prop], config2[prop], prop);
          utils$1.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config[prop] = configValue);
        });
        return config;
      }
      var resolveConfig = (config) => {
        const newConfig = mergeConfig({}, config);
        let { data, withXSRFToken, xsrfHeaderName, xsrfCookieName, headers, auth } = newConfig;
        newConfig.headers = headers = AxiosHeaders.from(headers);
        newConfig.url = buildURL(
          buildFullPath(newConfig.baseURL, newConfig.url, newConfig.allowAbsoluteUrls),
          config.params,
          config.paramsSerializer
        );
        if (auth) {
          headers.set(
            "Authorization",
            "Basic " + btoa(
              (auth.username || "") + ":" + (auth.password ? unescape(encodeURIComponent(auth.password)) : "")
            )
          );
        }
        if (utils$1.isFormData(data)) {
          if (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv) {
            headers.setContentType(void 0);
          } else if (utils$1.isFunction(data.getHeaders)) {
            const formHeaders = data.getHeaders();
            const allowedHeaders = ["content-type", "content-length"];
            Object.entries(formHeaders).forEach(([key, val]) => {
              if (allowedHeaders.includes(key.toLowerCase())) {
                headers.set(key, val);
              }
            });
          }
        }
        if (platform.hasStandardBrowserEnv) {
          withXSRFToken && utils$1.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig));
          if (withXSRFToken || withXSRFToken !== false && isURLSameOrigin(newConfig.url)) {
            const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);
            if (xsrfValue) {
              headers.set(xsrfHeaderName, xsrfValue);
            }
          }
        }
        return newConfig;
      };
      var isXHRAdapterSupported = typeof XMLHttpRequest !== "undefined";
      var xhrAdapter = isXHRAdapterSupported && function(config) {
        return new Promise(function dispatchXhrRequest(resolve, reject) {
          const _config = resolveConfig(config);
          let requestData = _config.data;
          const requestHeaders = AxiosHeaders.from(_config.headers).normalize();
          let { responseType, onUploadProgress, onDownloadProgress } = _config;
          let onCanceled;
          let uploadThrottled, downloadThrottled;
          let flushUpload, flushDownload;
          function done() {
            flushUpload && flushUpload();
            flushDownload && flushDownload();
            _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);
            _config.signal && _config.signal.removeEventListener("abort", onCanceled);
          }
          let request = new XMLHttpRequest();
          request.open(_config.method.toUpperCase(), _config.url, true);
          request.timeout = _config.timeout;
          function onloadend() {
            if (!request) {
              return;
            }
            const responseHeaders = AxiosHeaders.from(
              "getAllResponseHeaders" in request && request.getAllResponseHeaders()
            );
            const responseData = !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response;
            const response = {
              data: responseData,
              status: request.status,
              statusText: request.statusText,
              headers: responseHeaders,
              config,
              request
            };
            settle(
              function _resolve(value) {
                resolve(value);
                done();
              },
              function _reject(err) {
                reject(err);
                done();
              },
              response
            );
            request = null;
          }
          if ("onloadend" in request) {
            request.onloadend = onloadend;
          } else {
            request.onreadystatechange = function handleLoad() {
              if (!request || request.readyState !== 4) {
                return;
              }
              if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf("file:") === 0)) {
                return;
              }
              setTimeout(onloadend);
            };
          }
          request.onabort = function handleAbort() {
            if (!request) {
              return;
            }
            reject(new AxiosError("Request aborted", AxiosError.ECONNABORTED, config, request));
            request = null;
          };
          request.onerror = function handleError(event) {
            const msg = event && event.message ? event.message : "Network Error";
            const err = new AxiosError(msg, AxiosError.ERR_NETWORK, config, request);
            err.event = event || null;
            reject(err);
            request = null;
          };
          request.ontimeout = function handleTimeout() {
            let timeoutErrorMessage = _config.timeout ? "timeout of " + _config.timeout + "ms exceeded" : "timeout exceeded";
            const transitional = _config.transitional || transitionalDefaults;
            if (_config.timeoutErrorMessage) {
              timeoutErrorMessage = _config.timeoutErrorMessage;
            }
            reject(
              new AxiosError(
                timeoutErrorMessage,
                transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
                config,
                request
              )
            );
            request = null;
          };
          requestData === void 0 && requestHeaders.setContentType(null);
          if ("setRequestHeader" in request) {
            utils$1.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
              request.setRequestHeader(key, val);
            });
          }
          if (!utils$1.isUndefined(_config.withCredentials)) {
            request.withCredentials = !!_config.withCredentials;
          }
          if (responseType && responseType !== "json") {
            request.responseType = _config.responseType;
          }
          if (onDownloadProgress) {
            [downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true);
            request.addEventListener("progress", downloadThrottled);
          }
          if (onUploadProgress && request.upload) {
            [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);
            request.upload.addEventListener("progress", uploadThrottled);
            request.upload.addEventListener("loadend", flushUpload);
          }
          if (_config.cancelToken || _config.signal) {
            onCanceled = (cancel) => {
              if (!request) {
                return;
              }
              reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
              request.abort();
              request = null;
            };
            _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
            if (_config.signal) {
              _config.signal.aborted ? onCanceled() : _config.signal.addEventListener("abort", onCanceled);
            }
          }
          const protocol = parseProtocol(_config.url);
          if (protocol && platform.protocols.indexOf(protocol) === -1) {
            reject(
              new AxiosError(
                "Unsupported protocol " + protocol + ":",
                AxiosError.ERR_BAD_REQUEST,
                config
              )
            );
            return;
          }
          request.send(requestData || null);
        });
      };
      var composeSignals = (signals, timeout) => {
        const { length } = signals = signals ? signals.filter(Boolean) : [];
        if (timeout || length) {
          let controller = new AbortController();
          let aborted;
          const onabort = function(reason) {
            if (!aborted) {
              aborted = true;
              unsubscribe();
              const err = reason instanceof Error ? reason : this.reason;
              controller.abort(
                err instanceof AxiosError ? err : new CanceledError(err instanceof Error ? err.message : err)
              );
            }
          };
          let timer = timeout && setTimeout(() => {
            timer = null;
            onabort(new AxiosError(`timeout of ${timeout}ms exceeded`, AxiosError.ETIMEDOUT));
          }, timeout);
          const unsubscribe = () => {
            if (signals) {
              timer && clearTimeout(timer);
              timer = null;
              signals.forEach((signal2) => {
                signal2.unsubscribe ? signal2.unsubscribe(onabort) : signal2.removeEventListener("abort", onabort);
              });
              signals = null;
            }
          };
          signals.forEach((signal2) => signal2.addEventListener("abort", onabort));
          const { signal } = controller;
          signal.unsubscribe = () => utils$1.asap(unsubscribe);
          return signal;
        }
      };
      var streamChunk = function* (chunk, chunkSize) {
        let len = chunk.byteLength;
        if (len < chunkSize) {
          yield chunk;
          return;
        }
        let pos = 0;
        let end;
        while (pos < len) {
          end = pos + chunkSize;
          yield chunk.slice(pos, end);
          pos = end;
        }
      };
      var readBytes = async function* (iterable, chunkSize) {
        for await (const chunk of readStream(iterable)) {
          yield* streamChunk(chunk, chunkSize);
        }
      };
      var readStream = async function* (stream) {
        if (stream[Symbol.asyncIterator]) {
          yield* stream;
          return;
        }
        const reader = stream.getReader();
        try {
          for (; ; ) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            yield value;
          }
        } finally {
          await reader.cancel();
        }
      };
      var trackStream = (stream, chunkSize, onProgress, onFinish) => {
        const iterator2 = readBytes(stream, chunkSize);
        let bytes = 0;
        let done;
        let _onFinish = (e) => {
          if (!done) {
            done = true;
            onFinish && onFinish(e);
          }
        };
        return new ReadableStream(
          {
            async pull(controller) {
              try {
                const { done: done2, value } = await iterator2.next();
                if (done2) {
                  _onFinish();
                  controller.close();
                  return;
                }
                let len = value.byteLength;
                if (onProgress) {
                  let loadedBytes = bytes += len;
                  onProgress(loadedBytes);
                }
                controller.enqueue(new Uint8Array(value));
              } catch (err) {
                _onFinish(err);
                throw err;
              }
            },
            cancel(reason) {
              _onFinish(reason);
              return iterator2.return();
            }
          },
          {
            highWaterMark: 2
          }
        );
      };
      var DEFAULT_CHUNK_SIZE = 64 * 1024;
      var { isFunction } = utils$1;
      var globalFetchAPI = (({ Request, Response }) => ({
        Request,
        Response
      }))(utils$1.global);
      var { ReadableStream: ReadableStream$1, TextEncoder } = utils$1.global;
      var test = (fn, ...args) => {
        try {
          return !!fn(...args);
        } catch (e) {
          return false;
        }
      };
      var factory = (env) => {
        env = utils$1.merge.call(
          {
            skipUndefined: true
          },
          globalFetchAPI,
          env
        );
        const { fetch: envFetch, Request, Response } = env;
        const isFetchSupported = envFetch ? isFunction(envFetch) : typeof fetch === "function";
        const isRequestSupported = isFunction(Request);
        const isResponseSupported = isFunction(Response);
        if (!isFetchSupported) {
          return false;
        }
        const isReadableStreamSupported = isFetchSupported && isFunction(ReadableStream$1);
        const encodeText = isFetchSupported && (typeof TextEncoder === "function" ? /* @__PURE__ */ ((encoder) => (str) => encoder.encode(str))(new TextEncoder()) : async (str) => new Uint8Array(await new Request(str).arrayBuffer()));
        const supportsRequestStream = isRequestSupported && isReadableStreamSupported && test(() => {
          let duplexAccessed = false;
          const body = new ReadableStream$1();
          const hasContentType = new Request(platform.origin, {
            body,
            method: "POST",
            get duplex() {
              duplexAccessed = true;
              return "half";
            }
          }).headers.has("Content-Type");
          body.cancel();
          return duplexAccessed && !hasContentType;
        });
        const supportsResponseStream = isResponseSupported && isReadableStreamSupported && test(() => utils$1.isReadableStream(new Response("").body));
        const resolvers = {
          stream: supportsResponseStream && ((res) => res.body)
        };
        isFetchSupported && (() => {
          ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((type) => {
            !resolvers[type] && (resolvers[type] = (res, config) => {
              let method = res && res[type];
              if (method) {
                return method.call(res);
              }
              throw new AxiosError(
                `Response type '${type}' is not supported`,
                AxiosError.ERR_NOT_SUPPORT,
                config
              );
            });
          });
        })();
        const getBodyLength = async (body) => {
          if (body == null) {
            return 0;
          }
          if (utils$1.isBlob(body)) {
            return body.size;
          }
          if (utils$1.isSpecCompliantForm(body)) {
            const _request = new Request(platform.origin, {
              method: "POST",
              body
            });
            return (await _request.arrayBuffer()).byteLength;
          }
          if (utils$1.isArrayBufferView(body) || utils$1.isArrayBuffer(body)) {
            return body.byteLength;
          }
          if (utils$1.isURLSearchParams(body)) {
            body = body + "";
          }
          if (utils$1.isString(body)) {
            return (await encodeText(body)).byteLength;
          }
        };
        const resolveBodyLength = async (headers, body) => {
          const length = utils$1.toFiniteNumber(headers.getContentLength());
          return length == null ? getBodyLength(body) : length;
        };
        return async (config) => {
          let {
            url,
            method,
            data,
            signal,
            cancelToken,
            timeout,
            onDownloadProgress,
            onUploadProgress,
            responseType,
            headers,
            withCredentials = "same-origin",
            fetchOptions
          } = resolveConfig(config);
          let _fetch = envFetch || fetch;
          responseType = responseType ? (responseType + "").toLowerCase() : "text";
          let composedSignal = composeSignals(
            [signal, cancelToken && cancelToken.toAbortSignal()],
            timeout
          );
          let request = null;
          const unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
            composedSignal.unsubscribe();
          });
          let requestContentLength;
          try {
            if (onUploadProgress && supportsRequestStream && method !== "get" && method !== "head" && (requestContentLength = await resolveBodyLength(headers, data)) !== 0) {
              let _request = new Request(url, {
                method: "POST",
                body: data,
                duplex: "half"
              });
              let contentTypeHeader;
              if (utils$1.isFormData(data) && (contentTypeHeader = _request.headers.get("content-type"))) {
                headers.setContentType(contentTypeHeader);
              }
              if (_request.body) {
                const [onProgress, flush] = progressEventDecorator(
                  requestContentLength,
                  progressEventReducer(asyncDecorator(onUploadProgress))
                );
                data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, onProgress, flush);
              }
            }
            if (!utils$1.isString(withCredentials)) {
              withCredentials = withCredentials ? "include" : "omit";
            }
            const isCredentialsSupported = isRequestSupported && "credentials" in Request.prototype;
            const resolvedOptions = {
              ...fetchOptions,
              signal: composedSignal,
              method: method.toUpperCase(),
              headers: headers.normalize().toJSON(),
              body: data,
              duplex: "half",
              credentials: isCredentialsSupported ? withCredentials : void 0
            };
            request = isRequestSupported && new Request(url, resolvedOptions);
            let response = await (isRequestSupported ? _fetch(request, fetchOptions) : _fetch(url, resolvedOptions));
            const isStreamResponse = supportsResponseStream && (responseType === "stream" || responseType === "response");
            if (supportsResponseStream && (onDownloadProgress || isStreamResponse && unsubscribe)) {
              const options = {};
              ["status", "statusText", "headers"].forEach((prop) => {
                options[prop] = response[prop];
              });
              const responseContentLength = utils$1.toFiniteNumber(response.headers.get("content-length"));
              const [onProgress, flush] = onDownloadProgress && progressEventDecorator(
                responseContentLength,
                progressEventReducer(asyncDecorator(onDownloadProgress), true)
              ) || [];
              response = new Response(
                trackStream(response.body, DEFAULT_CHUNK_SIZE, onProgress, () => {
                  flush && flush();
                  unsubscribe && unsubscribe();
                }),
                options
              );
            }
            responseType = responseType || "text";
            let responseData = await resolvers[utils$1.findKey(resolvers, responseType) || "text"](
              response,
              config
            );
            !isStreamResponse && unsubscribe && unsubscribe();
            return await new Promise((resolve, reject) => {
              settle(resolve, reject, {
                data: responseData,
                headers: AxiosHeaders.from(response.headers),
                status: response.status,
                statusText: response.statusText,
                config,
                request
              });
            });
          } catch (err) {
            unsubscribe && unsubscribe();
            if (err && err.name === "TypeError" && /Load failed|fetch/i.test(err.message)) {
              throw Object.assign(
                new AxiosError(
                  "Network Error",
                  AxiosError.ERR_NETWORK,
                  config,
                  request,
                  err && err.response
                ),
                {
                  cause: err.cause || err
                }
              );
            }
            throw AxiosError.from(err, err && err.code, config, request, err && err.response);
          }
        };
      };
      var seedCache = /* @__PURE__ */ new Map();
      var getFetch = (config) => {
        let env = config && config.env || {};
        const { fetch: fetch2, Request, Response } = env;
        const seeds = [Request, Response, fetch2];
        let len = seeds.length, i = len, seed, target, map = seedCache;
        while (i--) {
          seed = seeds[i];
          target = map.get(seed);
          target === void 0 && map.set(seed, target = i ? /* @__PURE__ */ new Map() : factory(env));
          map = target;
        }
        return target;
      };
      getFetch();
      var knownAdapters = {
        http: httpAdapter,
        xhr: xhrAdapter,
        fetch: {
          get: getFetch
        }
      };
      utils$1.forEach(knownAdapters, (fn, value) => {
        if (fn) {
          try {
            Object.defineProperty(fn, "name", { value });
          } catch (e) {
          }
          Object.defineProperty(fn, "adapterName", { value });
        }
      });
      var renderReason = (reason) => `- ${reason}`;
      var isResolvedHandle = (adapter) => utils$1.isFunction(adapter) || adapter === null || adapter === false;
      function getAdapter(adapters2, config) {
        adapters2 = utils$1.isArray(adapters2) ? adapters2 : [adapters2];
        const { length } = adapters2;
        let nameOrAdapter;
        let adapter;
        const rejectedReasons = {};
        for (let i = 0; i < length; i++) {
          nameOrAdapter = adapters2[i];
          let id;
          adapter = nameOrAdapter;
          if (!isResolvedHandle(nameOrAdapter)) {
            adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];
            if (adapter === void 0) {
              throw new AxiosError(`Unknown adapter '${id}'`);
            }
          }
          if (adapter && (utils$1.isFunction(adapter) || (adapter = adapter.get(config)))) {
            break;
          }
          rejectedReasons[id || "#" + i] = adapter;
        }
        if (!adapter) {
          const reasons = Object.entries(rejectedReasons).map(
            ([id, state2]) => `adapter ${id} ` + (state2 === false ? "is not supported by the environment" : "is not available in the build")
          );
          let s = length ? reasons.length > 1 ? "since :\n" + reasons.map(renderReason).join("\n") : " " + renderReason(reasons[0]) : "as no adapter specified";
          throw new AxiosError(
            `There is no suitable adapter to dispatch the request ` + s,
            "ERR_NOT_SUPPORT"
          );
        }
        return adapter;
      }
      var adapters = {
        /**
         * Resolve an adapter from a list of adapter names or functions.
         * @type {Function}
         */
        getAdapter,
        /**
         * Exposes all known adapters
         * @type {Object<string, Function|Object>}
         */
        adapters: knownAdapters
      };
      function throwIfCancellationRequested(config) {
        if (config.cancelToken) {
          config.cancelToken.throwIfRequested();
        }
        if (config.signal && config.signal.aborted) {
          throw new CanceledError(null, config);
        }
      }
      function dispatchRequest(config) {
        throwIfCancellationRequested(config);
        config.headers = AxiosHeaders.from(config.headers);
        config.data = transformData.call(config, config.transformRequest);
        if (["post", "put", "patch"].indexOf(config.method) !== -1) {
          config.headers.setContentType("application/x-www-form-urlencoded", false);
        }
        const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);
        return adapter(config).then(
          function onAdapterResolution(response) {
            throwIfCancellationRequested(config);
            response.data = transformData.call(config, config.transformResponse, response);
            response.headers = AxiosHeaders.from(response.headers);
            return response;
          },
          function onAdapterRejection(reason) {
            if (!isCancel(reason)) {
              throwIfCancellationRequested(config);
              if (reason && reason.response) {
                reason.response.data = transformData.call(
                  config,
                  config.transformResponse,
                  reason.response
                );
                reason.response.headers = AxiosHeaders.from(reason.response.headers);
              }
            }
            return Promise.reject(reason);
          }
        );
      }
      var VERSION = "1.15.0";
      var validators$1 = {};
      ["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
        validators$1[type] = function validator2(thing) {
          return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
        };
      });
      var deprecatedWarnings = {};
      validators$1.transitional = function transitional(validator2, version, message) {
        function formatMessage(opt, desc) {
          return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
        }
        return (value, opt, opts) => {
          if (validator2 === false) {
            throw new AxiosError(
              formatMessage(opt, " has been removed" + (version ? " in " + version : "")),
              AxiosError.ERR_DEPRECATED
            );
          }
          if (version && !deprecatedWarnings[opt]) {
            deprecatedWarnings[opt] = true;
            console.warn(
              formatMessage(
                opt,
                " has been deprecated since v" + version + " and will be removed in the near future"
              )
            );
          }
          return validator2 ? validator2(value, opt, opts) : true;
        };
      };
      validators$1.spelling = function spelling(correctSpelling) {
        return (value, opt) => {
          console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
          return true;
        };
      };
      function assertOptions(options, schema, allowUnknown) {
        if (typeof options !== "object") {
          throw new AxiosError("options must be an object", AxiosError.ERR_BAD_OPTION_VALUE);
        }
        const keys = Object.keys(options);
        let i = keys.length;
        while (i-- > 0) {
          const opt = keys[i];
          const validator2 = schema[opt];
          if (validator2) {
            const value = options[opt];
            const result = value === void 0 || validator2(value, opt, options);
            if (result !== true) {
              throw new AxiosError(
                "option " + opt + " must be " + result,
                AxiosError.ERR_BAD_OPTION_VALUE
              );
            }
            continue;
          }
          if (allowUnknown !== true) {
            throw new AxiosError("Unknown option " + opt, AxiosError.ERR_BAD_OPTION);
          }
        }
      }
      var validator = {
        assertOptions,
        validators: validators$1
      };
      var validators = validator.validators;
      var Axios = class {
        constructor(instanceConfig) {
          this.defaults = instanceConfig || {};
          this.interceptors = {
            request: new InterceptorManager(),
            response: new InterceptorManager()
          };
        }
        /**
         * Dispatch a request
         *
         * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
         * @param {?Object} config
         *
         * @returns {Promise} The Promise to be fulfilled
         */
        async request(configOrUrl, config) {
          try {
            return await this._request(configOrUrl, config);
          } catch (err) {
            if (err instanceof Error) {
              let dummy = {};
              Error.captureStackTrace ? Error.captureStackTrace(dummy) : dummy = new Error();
              const stack = (() => {
                if (!dummy.stack) {
                  return "";
                }
                const firstNewlineIndex = dummy.stack.indexOf("\n");
                return firstNewlineIndex === -1 ? "" : dummy.stack.slice(firstNewlineIndex + 1);
              })();
              try {
                if (!err.stack) {
                  err.stack = stack;
                } else if (stack) {
                  const firstNewlineIndex = stack.indexOf("\n");
                  const secondNewlineIndex = firstNewlineIndex === -1 ? -1 : stack.indexOf("\n", firstNewlineIndex + 1);
                  const stackWithoutTwoTopLines = secondNewlineIndex === -1 ? "" : stack.slice(secondNewlineIndex + 1);
                  if (!String(err.stack).endsWith(stackWithoutTwoTopLines)) {
                    err.stack += "\n" + stack;
                  }
                }
              } catch (e) {
              }
            }
            throw err;
          }
        }
        _request(configOrUrl, config) {
          if (typeof configOrUrl === "string") {
            config = config || {};
            config.url = configOrUrl;
          } else {
            config = configOrUrl || {};
          }
          config = mergeConfig(this.defaults, config);
          const { transitional, paramsSerializer, headers } = config;
          if (transitional !== void 0) {
            validator.assertOptions(
              transitional,
              {
                silentJSONParsing: validators.transitional(validators.boolean),
                forcedJSONParsing: validators.transitional(validators.boolean),
                clarifyTimeoutError: validators.transitional(validators.boolean),
                legacyInterceptorReqResOrdering: validators.transitional(validators.boolean)
              },
              false
            );
          }
          if (paramsSerializer != null) {
            if (utils$1.isFunction(paramsSerializer)) {
              config.paramsSerializer = {
                serialize: paramsSerializer
              };
            } else {
              validator.assertOptions(
                paramsSerializer,
                {
                  encode: validators.function,
                  serialize: validators.function
                },
                true
              );
            }
          }
          if (config.allowAbsoluteUrls !== void 0) ;
          else if (this.defaults.allowAbsoluteUrls !== void 0) {
            config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
          } else {
            config.allowAbsoluteUrls = true;
          }
          validator.assertOptions(
            config,
            {
              baseUrl: validators.spelling("baseURL"),
              withXsrfToken: validators.spelling("withXSRFToken")
            },
            true
          );
          config.method = (config.method || this.defaults.method || "get").toLowerCase();
          let contextHeaders = headers && utils$1.merge(headers.common, headers[config.method]);
          headers && utils$1.forEach(["delete", "get", "head", "post", "put", "patch", "common"], (method) => {
            delete headers[method];
          });
          config.headers = AxiosHeaders.concat(contextHeaders, headers);
          const requestInterceptorChain = [];
          let synchronousRequestInterceptors = true;
          this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
            if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config) === false) {
              return;
            }
            synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
            const transitional2 = config.transitional || transitionalDefaults;
            const legacyInterceptorReqResOrdering = transitional2 && transitional2.legacyInterceptorReqResOrdering;
            if (legacyInterceptorReqResOrdering) {
              requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
            } else {
              requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
            }
          });
          const responseInterceptorChain = [];
          this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
            responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
          });
          let promise;
          let i = 0;
          let len;
          if (!synchronousRequestInterceptors) {
            const chain = [dispatchRequest.bind(this), void 0];
            chain.unshift(...requestInterceptorChain);
            chain.push(...responseInterceptorChain);
            len = chain.length;
            promise = Promise.resolve(config);
            while (i < len) {
              promise = promise.then(chain[i++], chain[i++]);
            }
            return promise;
          }
          len = requestInterceptorChain.length;
          let newConfig = config;
          while (i < len) {
            const onFulfilled = requestInterceptorChain[i++];
            const onRejected = requestInterceptorChain[i++];
            try {
              newConfig = onFulfilled(newConfig);
            } catch (error) {
              onRejected.call(this, error);
              break;
            }
          }
          try {
            promise = dispatchRequest.call(this, newConfig);
          } catch (error) {
            return Promise.reject(error);
          }
          i = 0;
          len = responseInterceptorChain.length;
          while (i < len) {
            promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
          }
          return promise;
        }
        getUri(config) {
          config = mergeConfig(this.defaults, config);
          const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
          return buildURL(fullPath, config.params, config.paramsSerializer);
        }
      };
      utils$1.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
        Axios.prototype[method] = function(url, config) {
          return this.request(
            mergeConfig(config || {}, {
              method,
              url,
              data: (config || {}).data
            })
          );
        };
      });
      utils$1.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
        function generateHTTPMethod(isForm) {
          return function httpMethod(url, data, config) {
            return this.request(
              mergeConfig(config || {}, {
                method,
                headers: isForm ? {
                  "Content-Type": "multipart/form-data"
                } : {},
                url,
                data
              })
            );
          };
        }
        Axios.prototype[method] = generateHTTPMethod();
        Axios.prototype[method + "Form"] = generateHTTPMethod(true);
      });
      var CancelToken = class _CancelToken {
        constructor(executor) {
          if (typeof executor !== "function") {
            throw new TypeError("executor must be a function.");
          }
          let resolvePromise;
          this.promise = new Promise(function promiseExecutor(resolve) {
            resolvePromise = resolve;
          });
          const token = this;
          this.promise.then((cancel) => {
            if (!token._listeners) return;
            let i = token._listeners.length;
            while (i-- > 0) {
              token._listeners[i](cancel);
            }
            token._listeners = null;
          });
          this.promise.then = (onfulfilled) => {
            let _resolve;
            const promise = new Promise((resolve) => {
              token.subscribe(resolve);
              _resolve = resolve;
            }).then(onfulfilled);
            promise.cancel = function reject() {
              token.unsubscribe(_resolve);
            };
            return promise;
          };
          executor(function cancel(message, config, request) {
            if (token.reason) {
              return;
            }
            token.reason = new CanceledError(message, config, request);
            resolvePromise(token.reason);
          });
        }
        /**
         * Throws a `CanceledError` if cancellation has been requested.
         */
        throwIfRequested() {
          if (this.reason) {
            throw this.reason;
          }
        }
        /**
         * Subscribe to the cancel signal
         */
        subscribe(listener) {
          if (this.reason) {
            listener(this.reason);
            return;
          }
          if (this._listeners) {
            this._listeners.push(listener);
          } else {
            this._listeners = [listener];
          }
        }
        /**
         * Unsubscribe from the cancel signal
         */
        unsubscribe(listener) {
          if (!this._listeners) {
            return;
          }
          const index = this._listeners.indexOf(listener);
          if (index !== -1) {
            this._listeners.splice(index, 1);
          }
        }
        toAbortSignal() {
          const controller = new AbortController();
          const abort = (err) => {
            controller.abort(err);
          };
          this.subscribe(abort);
          controller.signal.unsubscribe = () => this.unsubscribe(abort);
          return controller.signal;
        }
        /**
         * Returns an object that contains a new `CancelToken` and a function that, when called,
         * cancels the `CancelToken`.
         */
        static source() {
          let cancel;
          const token = new _CancelToken(function executor(c) {
            cancel = c;
          });
          return {
            token,
            cancel
          };
        }
      };
      function spread(callback) {
        return function wrap(arr) {
          return callback.apply(null, arr);
        };
      }
      function isAxiosError(payload) {
        return utils$1.isObject(payload) && payload.isAxiosError === true;
      }
      var HttpStatusCode = {
        Continue: 100,
        SwitchingProtocols: 101,
        Processing: 102,
        EarlyHints: 103,
        Ok: 200,
        Created: 201,
        Accepted: 202,
        NonAuthoritativeInformation: 203,
        NoContent: 204,
        ResetContent: 205,
        PartialContent: 206,
        MultiStatus: 207,
        AlreadyReported: 208,
        ImUsed: 226,
        MultipleChoices: 300,
        MovedPermanently: 301,
        Found: 302,
        SeeOther: 303,
        NotModified: 304,
        UseProxy: 305,
        Unused: 306,
        TemporaryRedirect: 307,
        PermanentRedirect: 308,
        BadRequest: 400,
        Unauthorized: 401,
        PaymentRequired: 402,
        Forbidden: 403,
        NotFound: 404,
        MethodNotAllowed: 405,
        NotAcceptable: 406,
        ProxyAuthenticationRequired: 407,
        RequestTimeout: 408,
        Conflict: 409,
        Gone: 410,
        LengthRequired: 411,
        PreconditionFailed: 412,
        PayloadTooLarge: 413,
        UriTooLong: 414,
        UnsupportedMediaType: 415,
        RangeNotSatisfiable: 416,
        ExpectationFailed: 417,
        ImATeapot: 418,
        MisdirectedRequest: 421,
        UnprocessableEntity: 422,
        Locked: 423,
        FailedDependency: 424,
        TooEarly: 425,
        UpgradeRequired: 426,
        PreconditionRequired: 428,
        TooManyRequests: 429,
        RequestHeaderFieldsTooLarge: 431,
        UnavailableForLegalReasons: 451,
        InternalServerError: 500,
        NotImplemented: 501,
        BadGateway: 502,
        ServiceUnavailable: 503,
        GatewayTimeout: 504,
        HttpVersionNotSupported: 505,
        VariantAlsoNegotiates: 506,
        InsufficientStorage: 507,
        LoopDetected: 508,
        NotExtended: 510,
        NetworkAuthenticationRequired: 511,
        WebServerIsDown: 521,
        ConnectionTimedOut: 522,
        OriginIsUnreachable: 523,
        TimeoutOccurred: 524,
        SslHandshakeFailed: 525,
        InvalidSslCertificate: 526
      };
      Object.entries(HttpStatusCode).forEach(([key, value]) => {
        HttpStatusCode[value] = key;
      });
      function createInstance(defaultConfig) {
        const context = new Axios(defaultConfig);
        const instance = bind(Axios.prototype.request, context);
        utils$1.extend(instance, Axios.prototype, context, { allOwnKeys: true });
        utils$1.extend(instance, context, null, { allOwnKeys: true });
        instance.create = function create(instanceConfig) {
          return createInstance(mergeConfig(defaultConfig, instanceConfig));
        };
        return instance;
      }
      var axios = createInstance(defaults);
      axios.Axios = Axios;
      axios.CanceledError = CanceledError;
      axios.CancelToken = CancelToken;
      axios.isCancel = isCancel;
      axios.VERSION = VERSION;
      axios.toFormData = toFormData;
      axios.AxiosError = AxiosError;
      axios.Cancel = axios.CanceledError;
      axios.all = function all(promises) {
        return Promise.all(promises);
      };
      axios.spread = spread;
      axios.isAxiosError = isAxiosError;
      axios.mergeConfig = mergeConfig;
      axios.AxiosHeaders = AxiosHeaders;
      axios.formToJSON = (thing) => formDataToJSON(utils$1.isHTMLForm(thing) ? new FormData(thing) : thing);
      axios.getAdapter = adapters.getAdapter;
      axios.HttpStatusCode = HttpStatusCode;
      axios.default = axios;
      module.exports = axios;
    }
  });

  // src/shared/config.js
  var require_config = __commonJS({
    "src/shared/config.js"(exports, module) {
      function readLocalStorageJson(key) {
        const value = localStorage.getItem(key);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch (e) {
          console.warn(`Ignoring corrupt local setting "${key}":`, e);
          localStorage.removeItem(key);
          return null;
        }
      }
      var storeGet2 = async (key) => {
        if (window.electronAPI) {
          return await window.electronAPI.storeGet(key);
        }
        return readLocalStorageJson(key);
      };
      var storeSet2 = async (key, value) => {
        if (window.electronAPI) {
          return await window.electronAPI.storeSet(key, value);
        }
        localStorage.setItem(key, JSON.stringify(value));
      };
      var storeDelete2 = async (key) => {
        if (window.electronAPI) {
          return await window.electronAPI.storeDelete(key);
        }
        localStorage.removeItem(key);
      };
      var storeClear2 = async () => {
        if (window.electronAPI) {
          return await window.electronAPI.storeClear();
        }
        localStorage.clear();
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { storeGet: storeGet2, storeSet: storeSet2, storeDelete: storeDelete2, storeClear: storeClear2 };
      }
      if (typeof window !== "undefined") {
        window.config = { storeGet: storeGet2, storeSet: storeSet2, storeDelete: storeDelete2, storeClear: storeClear2 };
      }
    }
  });

  // src/renderer/js/connection/request_policy.js
  var require_request_policy = __commonJS({
    "src/renderer/js/connection/request_policy.js"(exports, module) {
      var SAFE_METHODS = /* @__PURE__ */ new Set(["get", "head"]);
      function isRetryableTransportOrServer(error) {
        if (!error || !error.config) return false;
        if (error.code === "ECONNABORTED") return true;
        if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") return true;
        if (!error.response) return true;
        const s = error.response.status;
        return s === 502 || s === 503 || s === 504;
      }
      function attachIdempotentRetryInterceptors(axiosInstance, options = {}) {
        const maxRetries = options.maxRetries ?? 3;
        const baseDelayMs = options.baseDelayMs ?? 400;
        axiosInstance.interceptors.response.use(
          (response) => response,
          async (error) => {
            const config = error.config;
            if (!config) return Promise.reject(error);
            const method = String(config.method || "get").toLowerCase();
            if (!SAFE_METHODS.has(method)) return Promise.reject(error);
            const count = config.__retryCount || 0;
            if (count >= maxRetries) return Promise.reject(error);
            if (!isRetryableTransportOrServer(error)) return Promise.reject(error);
            config.__retryCount = count + 1;
            const backoff = baseDelayMs * 2 ** (config.__retryCount - 1);
            const jitter = Math.random() * 250;
            await new Promise((r) => setTimeout(r, backoff + jitter));
            return axiosInstance(config);
          }
        );
      }
      module.exports = { attachIdempotentRetryInterceptors, isRetryableTransportOrServer, SAFE_METHODS };
    }
  });

  // src/renderer/js/api/client.js
  var require_client = __commonJS({
    "src/renderer/js/api/client.js"(exports, module) {
      var axios = require_axios();
      var cfg = typeof window !== "undefined" && window.config ? window.config : (function() {
        try {
          return require_config();
        } catch (_) {
          return {};
        }
      })();
      var storeGet2 = cfg.storeGet || (async (k) => null);
      var storeSet2 = cfg.storeSet || (async (k, v) => {
      });
      function isTlsRelatedError(error) {
        const code = error && error.code;
        const msg = error && error.message || "";
        const tlsCodes = /* @__PURE__ */ new Set([
          "DEPTH_ZERO_SELF_SIGNED_CERT",
          "CERT_HAS_EXPIRED",
          "CERT_NOT_YET_VALID",
          "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
          "ERR_TLS_CERT_ALTNAME_INVALID",
          "SELF_SIGNED_CERT_IN_CHAIN",
          "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
        ]);
        if (code && tlsCodes.has(code)) return true;
        if (/certificate|ssl|tls|UNABLE_TO_VERIFY/i.test(msg)) return true;
        return false;
      }
      function classifyAxiosError2(error) {
        if (isTlsRelatedError(error)) {
          return {
            code: "TLS",
            message: "SSL/TLS certificate could not be verified. If the server uses a self-signed certificate, install a trusted CA or use http:// only on trusted networks."
          };
        }
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          if (status === 401) {
            return {
              code: "UNAUTHORIZED",
              message: "Authentication failed. Sign in again."
            };
          }
          if (status === 403) {
            return {
              code: "FORBIDDEN",
              message: "Access denied. Your token may not have the required permissions (e.g. read:users)."
            };
          }
          if (status === 404) {
            return {
              code: "NOT_FOUND",
              message: data?.error || "Resource not found. Is the base URL correct (no extra path)?"
            };
          }
          if (status >= 500) {
            return { code: "SERVER_ERROR", message: "Server error. Please try again later." };
          }
          if (data && typeof data === "object" && data.error) {
            return { code: "HTTP_" + status, message: String(data.error) };
          }
          return { code: "HTTP_" + status, message: `Server returned HTTP ${status}.` };
        }
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
          return {
            code: "TIMEOUT",
            message: "Request timed out. Check the server URL, firewall, and network."
          };
        }
        if (error.code === "ENOTFOUND") {
          return {
            code: "DNS",
            message: "Host not found (DNS). Check the hostname in your server URL."
          };
        }
        if (error.code === "ECONNREFUSED") {
          return {
            code: "REFUSED",
            message: "Connection refused. Check the host, port, and that the EvilTime server is running."
          };
        }
        if (error.code === "ENETUNREACH" || error.code === "EHOSTUNREACH") {
          return {
            code: "UNREACHABLE",
            message: "Network unreachable. Check your connection and server address."
          };
        }
        const msg = error.message || "Unknown error";
        if (!error.response) {
          return {
            code: "UNKNOWN",
            message: "Server not reachable. Check the URL, VPN, firewall, and that the EvilTime server is running."
          };
        }
        return { code: "UNKNOWN", message: msg };
      }
      function isEvilTimeInfoPayload(data) {
        return data !== null && typeof data === "object" && !Array.isArray(data) && data.api_version === "v1" && typeof data.endpoints === "object";
      }
      var { attachIdempotentRetryInterceptors } = require_request_policy();
      var ApiClient2 = class _ApiClient {
        /**
         * @param {string} baseUrl
         * @param {{ enableIdempotentRetry?: boolean, timeoutMs?: number }} [options]
         */
        constructor(baseUrl, options = {}) {
          const normalized = _ApiClient.normalizeBaseUrl(baseUrl);
          this.baseUrl = normalized;
          this.client = axios.create({
            baseURL: normalized,
            timeout: options.timeoutMs ?? 1e4,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            }
          });
          this.setupInterceptors();
          if (options.enableIdempotentRetry !== false) {
            attachIdempotentRetryInterceptors(this.client);
          }
        }
        setupInterceptors() {
          this.client.interceptors.request.use(async (config) => {
            const token = await storeGet2("api_token");
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
          });
          this.client.interceptors.response.use(
            (response) => response,
            (error) => {
              if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                if (status === 401) {
                  error.message = "Authentication failed. Please sign in again.";
                } else if (status === 403) {
                  error.message = "Access denied. Your token may not have the required permissions.";
                } else if (status === 404) {
                  error.message = data?.error || "Resource not found.";
                } else if (status >= 500) {
                  error.message = "Server error. Please try again later.";
                } else if (data?.error) {
                  error.message = data.error;
                }
              } else if (error.code === "ECONNABORTED") {
                error.message = "Request timeout. Please check your internet connection.";
              } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
                error.message = "Unable to connect to server. Please check the server URL and your internet connection.";
              } else if (isTlsRelatedError(error)) {
                error.message = "SSL/TLS error: certificate could not be verified. Use a trusted certificate or verify the server URL.";
              }
              return Promise.reject(error);
            }
          );
        }
        static normalizeBaseUrl(url) {
          let u = String(url || "").trim();
          if (!u) return u;
          u = u.replace(/\/+$/, "");
          return u;
        }
        /**
         * Unauthenticated check: reachable EvilTime JSON at GET /api/v1/info.
         * @param {string} baseUrl
         * @returns {Promise<ValidationResult>}
         */
        static async testPublicServerInfo(baseUrl) {
          const normalized = _ApiClient.normalizeBaseUrl(baseUrl);
          if (!normalized) {
            return { ok: false, code: "NO_URL", message: "Please enter a server URL." };
          }
          let parsed;
          try {
            parsed = new URL(normalized);
          } catch (_) {
            return { ok: false, code: "BAD_URL", message: "Server URL is not valid." };
          }
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return { ok: false, code: "BAD_URL", message: "Server URL must start with http:// or https://." };
          }
          const plain = axios.create({
            baseURL: normalized,
            timeout: 1e4,
            headers: { Accept: "application/json" }
          });
          try {
            const response = await plain.get("/api/v1/info");
            if (response.status !== 200) {
              return {
                ok: false,
                code: "HTTP_" + response.status,
                message: `Server returned HTTP ${response.status}. Check the URL and port.`
              };
            }
            const data = response.data;
            if (!isEvilTimeInfoPayload(data)) {
              return {
                ok: false,
                code: "NOT_TIMETRACKER",
                message: "This address did not return a EvilTime API response. Check the URL (base URL only, no path) and port."
              };
            }
            if (data.setup_required === true) {
              return {
                ok: false,
                code: "SETUP_REQUIRED",
                message: "EvilTime is not fully set up yet. Open this server URL in a browser, complete initial setup, then try again."
              };
            }
            const appVersion = typeof data.app_version === "string" ? data.app_version : null;
            return { ok: true, app_version: appVersion };
          } catch (error) {
            const { code, message } = classifyAxiosError2(error);
            return { ok: false, code, message };
          }
        }
        /**
         * Login with the same username/password flow used by the mobile app.
         * The server returns an API token, which the desktop stores internally.
         * @param {string} baseUrl
         * @param {string} username
         * @param {string} password
         * @returns {Promise<{ ok: true, token: string } | ValidationResult>}
         */
        static async loginWithPassword(baseUrl, username, password) {
          const normalized = _ApiClient.normalizeBaseUrl(baseUrl);
          const plain = axios.create({
            baseURL: normalized,
            timeout: 15e3,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            }
          });
          try {
            const response = await plain.post("/api/v1/auth/login", {
              username,
              password
            });
            const token = response.data && response.data.token;
            if (response.status !== 200 || typeof token !== "string" || !token.startsWith("tt_")) {
              return {
                ok: false,
                code: "INVALID_RESPONSE",
                message: "Server login response did not include a valid app token."
              };
            }
            return { ok: true, token };
          } catch (error) {
            const { code, message } = classifyAxiosError2(error);
            return { ok: false, code, message };
          }
        }
        async setAuthToken(token) {
          await storeSet2("api_token", token);
        }
        /**
         * Authenticated session check: prefers GET /api/v1/users/me (read:users).
         * Falls back to GET /api/v1/timer/status (read:time_entries) for narrower tokens.
         * @returns {Promise<ValidationResult>}
         */
        async validateSession() {
          try {
            const response = await this.client.get("/api/v1/users/me");
            if (response.status !== 200) {
              return {
                ok: false,
                code: "HTTP_" + response.status,
                message: `Unexpected HTTP ${response.status} from the server.`
              };
            }
            const data = response.data;
            if (!data || typeof data !== "object" || !data.user) {
              return {
                ok: false,
                code: "INVALID_RESPONSE",
                message: "Server response was not a valid EvilTime user payload."
              };
            }
            return { ok: true };
          } catch (error) {
            const status = error.response && error.response.status;
            if (status === 401) {
              const { code: code2, message: message2 } = classifyAxiosError2(error);
              return { ok: false, code: code2, message: message2 };
            }
            if (status === 403) {
              try {
                const res2 = await this.client.get("/api/v1/timer/status");
                if (res2.status === 200 && res2.data && typeof res2.data.active === "boolean") {
                  return { ok: true };
                }
              } catch (e2) {
                const { code: code2, message: message2 } = classifyAxiosError2(e2);
                return { ok: false, code: code2, message: message2 };
              }
              return {
                ok: false,
                code: "FORBIDDEN",
                message: "This signed-in account cannot access your profile or timer."
              };
            }
            const { code, message } = classifyAxiosError2(error);
            return { ok: false, code, message };
          }
        }
        /** @deprecated Prefer validateSession() for correct auth + error detail */
        async validateToken() {
          const r = await this.validateSession();
          return r.ok;
        }
        async getUsersMe() {
          const response = await this.client.get("/api/v1/users/me");
          return response.data;
        }
        async getTimerStatus() {
          return await this.client.get("/api/v1/timer/status");
        }
        async startTimer({ projectId, taskId, notes }) {
          return await this.client.post("/api/v1/timer/start", {
            project_id: projectId,
            task_id: taskId,
            notes
          });
        }
        async stopTimer() {
          return await this.client.post("/api/v1/timer/stop");
        }
        async getTimeEntries({ projectId, startDate, endDate, billable, page, perPage }) {
          const params = {};
          if (projectId) params.project_id = projectId;
          if (startDate) params.start_date = startDate;
          if (endDate) params.end_date = endDate;
          if (billable !== void 0) params.billable = billable;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/time-entries", { params });
        }
        async createTimeEntry(data) {
          return await this.client.post("/api/v1/time-entries", data);
        }
        async updateTimeEntry(id, data) {
          return await this.client.put(`/api/v1/time-entries/${id}`, data);
        }
        async deleteTimeEntry(id) {
          return await this.client.delete(`/api/v1/time-entries/${id}`);
        }
        async getProjects({ status, clientId, page, perPage }) {
          const params = {};
          if (status) params.status = status;
          if (clientId) params.client_id = clientId;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/projects", { params });
        }
        async getProject(id) {
          return await this.client.get(`/api/v1/projects/${id}`);
        }
        async getClients({ status, page, perPage }) {
          const params = {};
          if (status) params.status = status;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/clients", { params });
        }
        async getTasks({ projectId, status, page, perPage }) {
          const params = {};
          if (projectId) params.project_id = projectId;
          if (status) params.status = status;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/tasks", { params });
        }
        async getTask(id) {
          return await this.client.get(`/api/v1/tasks/${id}`);
        }
        async getTimeEntry(id) {
          return await this.client.get(`/api/v1/time-entries/${id}`);
        }
        async getInvoices({ status, clientId, projectId, page, perPage }) {
          const params = {};
          if (status) params.status = status;
          if (clientId) params.client_id = clientId;
          if (projectId) params.project_id = projectId;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/invoices", { params });
        }
        async getInvoice(id) {
          return await this.client.get(`/api/v1/invoices/${id}`);
        }
        async createInvoice(data) {
          return await this.client.post("/api/v1/invoices", data);
        }
        async updateInvoice(id, data) {
          return await this.client.put(`/api/v1/invoices/${id}`, data);
        }
        async getExpenses({ projectId, category, startDate, endDate, page, perPage }) {
          const params = {};
          if (projectId) params.project_id = projectId;
          if (category) params.category = category;
          if (startDate) params.start_date = startDate;
          if (endDate) params.end_date = endDate;
          if (page) params.page = page;
          if (perPage) params.per_page = perPage;
          return await this.client.get("/api/v1/expenses", { params });
        }
        async createExpense(data) {
          return await this.client.post("/api/v1/expenses", data);
        }
        async getCapacityReport({ startDate, endDate }) {
          return await this.client.get("/api/v1/reports/capacity", {
            params: { start_date: startDate, end_date: endDate }
          });
        }
        async getTimesheetPeriods({ status, startDate, endDate }) {
          const params = {};
          if (status) params.status = status;
          if (startDate) params.start_date = startDate;
          if (endDate) params.end_date = endDate;
          return await this.client.get("/api/v1/timesheet-periods", { params });
        }
        async submitTimesheetPeriod(periodId) {
          return await this.client.post(`/api/v1/timesheet-periods/${periodId}/submit`);
        }
        async approveTimesheetPeriod(periodId, { comment } = {}) {
          const data = {};
          if (comment) data.comment = comment;
          return await this.client.post(`/api/v1/timesheet-periods/${periodId}/approve`, data);
        }
        async rejectTimesheetPeriod(periodId, { reason } = {}) {
          const data = {};
          if (reason) data.reason = reason;
          return await this.client.post(`/api/v1/timesheet-periods/${periodId}/reject`, data);
        }
        async deleteTimesheetPeriod(periodId) {
          return await this.client.delete(`/api/v1/timesheet-periods/${periodId}`);
        }
        async getLeaveTypes() {
          return await this.client.get("/api/v1/time-off/leave-types");
        }
        async getTimeOffRequests({ status, startDate, endDate }) {
          const params = {};
          if (status) params.status = status;
          if (startDate) params.start_date = startDate;
          if (endDate) params.end_date = endDate;
          return await this.client.get("/api/v1/time-off/requests", { params });
        }
        async createTimeOffRequest({ leaveTypeId, startDate, endDate, requestedHours, comment, submit }) {
          const data = {
            leave_type_id: leaveTypeId,
            start_date: startDate,
            end_date: endDate,
            submit: submit !== void 0 ? submit : true
          };
          if (requestedHours !== void 0 && requestedHours !== null) data.requested_hours = requestedHours;
          if (comment) data.comment = comment;
          return await this.client.post("/api/v1/time-off/requests", data);
        }
        async getTimeOffBalances({ userId } = {}) {
          const params = {};
          if (userId) params.user_id = userId;
          return await this.client.get("/api/v1/time-off/balances", { params });
        }
        async approveTimeOffRequest(requestId, { comment } = {}) {
          const data = {};
          if (comment) data.comment = comment;
          return await this.client.post(`/api/v1/time-off/requests/${requestId}/approve`, data);
        }
        async rejectTimeOffRequest(requestId, { comment } = {}) {
          const data = {};
          if (comment) data.comment = comment;
          return await this.client.post(`/api/v1/time-off/requests/${requestId}/reject`, data);
        }
        async deleteTimeOffRequest(requestId) {
          return await this.client.delete(`/api/v1/time-off/requests/${requestId}`);
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = ApiClient2;
        module.exports.classifyAxiosError = classifyAxiosError2;
        module.exports.isEvilTimeInfoPayload = isEvilTimeInfoPayload;
      }
    }
  });

  // src/renderer/js/connection/connection_state.js
  var require_connection_state = __commonJS({
    "src/renderer/js/connection/connection_state.js"(exports, module) {
      var CONNECTION_STATE2 = {
        NOT_CONFIGURED: "NOT_CONFIGURED",
        CONNECTING: "CONNECTING",
        CONNECTED: "CONNECTED",
        ERROR: "ERROR",
        OFFLINE: "OFFLINE"
      };
      module.exports = { CONNECTION_STATE: CONNECTION_STATE2 };
    }
  });

  // src/renderer/js/connection/connection_manager.js
  var require_connection_manager = __commonJS({
    "src/renderer/js/connection/connection_manager.js"(exports, module) {
      var ApiClient2 = require_client();
      var { CONNECTION_STATE: CONNECTION_STATE2 } = require_connection_state();
      var STORE_SERVER = "server_url";
      var STORE_TOKEN = "api_token";
      var STORE_TOKEN_SERVER = "api_token_server_url";
      var STORE_USERNAME = "username";
      function createConnectionManager2(deps) {
        const storeGet2 = deps.storeGet;
        const storeSet2 = deps.storeSet;
        const storeDelete2 = deps.storeDelete;
        const storeClear2 = deps.storeClear;
        const onCacheClear = deps.onCacheClear || (() => {
        });
        let apiClient = null;
        const listeners = /* @__PURE__ */ new Set();
        let offlineListenerBound = false;
        let snapshot = {
          state: CONNECTION_STATE2.NOT_CONFIGURED,
          serverUrl: null,
          lastError: null,
          lastConnectedAt: null,
          serverVersion: null
        };
        function getSnapshot() {
          return { ...snapshot };
        }
        function getClient() {
          return apiClient;
        }
        function notify() {
          const s = getSnapshot();
          for (const fn of listeners) {
            try {
              fn(s);
            } catch (e) {
              console.error("ConnectionManager listener error:", e);
            }
          }
        }
        function setSnap(partial) {
          snapshot = { ...snapshot, ...partial };
          notify();
        }
        function tearDownClient() {
          apiClient = null;
        }
        function isTransportSessionError(code) {
          return [
            "TIMEOUT",
            "REFUSED",
            "UNREACHABLE",
            "DNS",
            "TLS",
            "UNKNOWN"
          ].includes(code);
        }
        function attachWindowListeners() {
          if (typeof window === "undefined" || offlineListenerBound) return;
          offlineListenerBound = true;
          window.addEventListener("online", () => {
            if (snapshot.state === CONNECTION_STATE2.OFFLINE && apiClient) {
              setSnap({ state: CONNECTION_STATE2.CONNECTING, lastError: null });
            }
          });
          window.addEventListener("offline", () => {
            setSnap({
              state: CONNECTION_STATE2.OFFLINE,
              lastError: "Network offline."
            });
          });
        }
        async function testServer(baseUrl) {
          const normalized = ApiClient2.normalizeBaseUrl(String(baseUrl || "").trim());
          if (!normalized) {
            return { ok: false, code: "NO_URL", message: "Please enter a server URL." };
          }
          return ApiClient2.testPublicServerInfo(normalized);
        }
        async function bootstrapFromStore() {
          attachWindowListeners();
          const serverRaw = await storeGet2(STORE_SERVER);
          const token = await storeGet2(STORE_TOKEN);
          const serverUrlEarly = serverRaw ? ApiClient2.normalizeBaseUrl(String(serverRaw)) : null;
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            tearDownClient();
            setSnap({
              state: CONNECTION_STATE2.OFFLINE,
              serverUrl: serverUrlEarly,
              lastError: "Network offline."
            });
            return {
              ok: false,
              reason: "offline",
              hadCredentials: Boolean(serverUrlEarly && token)
            };
          }
          const tokenServer = await storeGet2(STORE_TOKEN_SERVER);
          let serverUrl = serverRaw ? ApiClient2.normalizeBaseUrl(String(serverRaw)) : null;
          if (serverUrl && serverRaw && serverUrl !== String(serverRaw).trim()) {
            await storeSet2(STORE_SERVER, serverUrl);
          }
          if (!serverUrl) {
            tearDownClient();
            setSnap({
              state: CONNECTION_STATE2.NOT_CONFIGURED,
              serverUrl: null,
              lastError: null,
              serverVersion: null
            });
            return { ok: false, reason: "no_server" };
          }
          if (!token) {
            tearDownClient();
            setSnap({
              state: CONNECTION_STATE2.NOT_CONFIGURED,
              serverUrl,
              lastError: null,
              serverVersion: null
            });
            return { ok: false, reason: "no_token" };
          }
          const tokenNorm = tokenServer ? ApiClient2.normalizeBaseUrl(String(tokenServer)) : null;
          if (tokenNorm && tokenNorm !== serverUrl) {
            await storeDelete2(STORE_TOKEN);
            await storeDelete2(STORE_TOKEN_SERVER);
            tearDownClient();
            onCacheClear();
            setSnap({
              state: CONNECTION_STATE2.NOT_CONFIGURED,
              serverUrl,
              lastError: "This saved sign-in was for a different server. Please sign in again.",
              serverVersion: null
            });
            return { ok: false, reason: "token_server_mismatch" };
          }
          apiClient = new ApiClient2(serverUrl, {
            enableIdempotentRetry: false,
            timeoutMs: 15e3
          });
          await apiClient.setAuthToken(String(token));
          setSnap({
            state: CONNECTION_STATE2.CONNECTING,
            serverUrl,
            lastError: null
          });
          const session = await apiClient.validateSession();
          if (session.ok) {
            if (!tokenNorm) {
              await storeSet2(STORE_TOKEN_SERVER, serverUrl);
            }
            const now = Date.now();
            setSnap({
              state: CONNECTION_STATE2.CONNECTED,
              serverUrl,
              lastError: null,
              lastConnectedAt: now,
              serverVersion: null
            });
            return { ok: true, session };
          }
          if (isTransportSessionError(session.code)) {
            tearDownClient();
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              serverUrl,
              lastError: session.message || "Server not reachable.",
              serverVersion: null
            });
            return { ok: false, reason: "session_unreachable", session, message: session.message };
          }
          tearDownClient();
          await storeDelete2(STORE_TOKEN);
          await storeDelete2(STORE_TOKEN_SERVER);
          onCacheClear();
          setSnap({
            state: CONNECTION_STATE2.ERROR,
            serverUrl,
            lastError: session.message || "Session invalid",
            serverVersion: null
          });
          return { ok: false, reason: "session", session };
        }
        async function login(serverUrl, username, password) {
          const normalized = ApiClient2.normalizeBaseUrl(String(serverUrl || "").trim());
          const pub = await ApiClient2.testPublicServerInfo(normalized);
          if (!pub.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              serverUrl: normalized,
              lastError: pub.message
            });
            return { ok: false, step: "server", ...pub };
          }
          const auth = await ApiClient2.loginWithPassword(normalized, username, password);
          if (!auth.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              serverUrl: normalized,
              lastError: auth.message || "Login failed",
              serverVersion: pub.app_version || null
            });
            return { ok: false, step: "auth", session: auth };
          }
          const probe = new ApiClient2(normalized);
          await probe.setAuthToken(auth.token);
          const session = await probe.validateSession();
          if (!session.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              serverUrl: normalized,
              lastError: session.message || "Login failed",
              serverVersion: null
            });
            return { ok: false, step: "auth", session };
          }
          await storeSet2(STORE_SERVER, normalized);
          await storeSet2(STORE_TOKEN, auth.token);
          await storeSet2(STORE_TOKEN_SERVER, normalized);
          await storeSet2(STORE_USERNAME, String(username || "").trim());
          apiClient = probe;
          const now = Date.now();
          setSnap({
            state: CONNECTION_STATE2.CONNECTED,
            serverUrl: normalized,
            lastError: null,
            lastConnectedAt: now,
            serverVersion: pub.app_version || null
          });
          return { ok: true, session, app_version: pub.app_version || null };
        }
        async function logoutKeepServer() {
          await storeDelete2(STORE_TOKEN);
          await storeDelete2(STORE_TOKEN_SERVER);
          tearDownClient();
          onCacheClear();
          const serverRaw = await storeGet2(STORE_SERVER);
          const serverUrl = serverRaw ? ApiClient2.normalizeBaseUrl(String(serverRaw)) : null;
          setSnap({
            state: CONNECTION_STATE2.NOT_CONFIGURED,
            serverUrl,
            lastError: null,
            serverVersion: null
          });
        }
        async function fullStoreReset() {
          await storeClear2();
          tearDownClient();
          onCacheClear();
          snapshot = {
            state: CONNECTION_STATE2.NOT_CONFIGURED,
            serverUrl: null,
            lastError: null,
            lastConnectedAt: null,
            serverVersion: null
          };
          notify();
        }
        async function validateSessionRefresh() {
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            setSnap({
              state: CONNECTION_STATE2.OFFLINE,
              lastError: "Network offline."
            });
            return { ok: false, code: "OFFLINE", message: "Network offline." };
          }
          if (!apiClient) {
            setSnap({
              state: CONNECTION_STATE2.NOT_CONFIGURED,
              lastError: null
            });
            return { ok: false, code: "NO_CLIENT", message: "Not connected." };
          }
          const session = await apiClient.validateSession();
          if (session.ok) {
            const now = Date.now();
            setSnap({
              state: CONNECTION_STATE2.CONNECTED,
              lastError: null,
              lastConnectedAt: now
            });
            return session;
          }
          if (session.code === "UNAUTHORIZED") {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              lastError: session.message || "Unauthorized"
            });
            return session;
          }
          const transportish = session.code === "TIMEOUT" || session.code === "REFUSED" || session.code === "UNREACHABLE" || session.code === "DNS" || session.code === "TLS" || session.code === "UNKNOWN";
          if (transportish) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              lastError: session.message || "Server not reachable"
            });
            return session;
          }
          setSnap({
            state: CONNECTION_STATE2.ERROR,
            lastError: session.message || "Connection error"
          });
          return session;
        }
        async function saveServerAndCredentials(serverUrl, username, password, syncExtras) {
          const normalized = ApiClient2.normalizeBaseUrl(String(serverUrl || "").trim());
          const pub = await ApiClient2.testPublicServerInfo(normalized);
          if (!pub.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              lastError: pub.message
            });
            return { ok: false, step: "server", ...pub };
          }
          const auth = await ApiClient2.loginWithPassword(normalized, username, password);
          if (!auth.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              lastError: auth.message || "Login failed. Settings were not saved."
            });
            return { ok: false, step: "auth", session: auth };
          }
          const probe = new ApiClient2(normalized);
          await probe.setAuthToken(auth.token);
          const session = await probe.validateSession();
          if (!session.ok) {
            setSnap({
              state: CONNECTION_STATE2.ERROR,
              lastError: session.message || "Session check failed. Settings were not saved."
            });
            return { ok: false, step: "auth", session };
          }
          if (syncExtras) {
            if (syncExtras.auto_sync !== void 0) await storeSet2("auto_sync", syncExtras.auto_sync);
            if (syncExtras.sync_interval !== void 0) await storeSet2("sync_interval", syncExtras.sync_interval);
          }
          await storeSet2(STORE_SERVER, normalized);
          await storeSet2(STORE_TOKEN, auth.token);
          await storeSet2(STORE_TOKEN_SERVER, normalized);
          await storeSet2(STORE_USERNAME, String(username || "").trim());
          apiClient = probe;
          const now = Date.now();
          setSnap({
            state: CONNECTION_STATE2.CONNECTED,
            serverUrl: normalized,
            lastError: null,
            lastConnectedAt: now,
            serverVersion: pub.app_version || null
          });
          return { ok: true, session };
        }
        async function testServerAndCredentials(serverUrl, username, password) {
          const normalized = ApiClient2.normalizeBaseUrl(String(serverUrl || "").trim());
          const pub = await ApiClient2.testPublicServerInfo(normalized);
          if (!pub.ok) return pub;
          const auth = await ApiClient2.loginWithPassword(normalized, username, password);
          if (!auth.ok) return auth;
          const probe = new ApiClient2(normalized);
          await probe.setAuthToken(auth.token);
          const session = await probe.validateSession();
          if (!session.ok) return session;
          return { ok: true, app_version: pub.app_version || null };
        }
        function subscribe(fn) {
          listeners.add(fn);
          try {
            fn(getSnapshot());
          } catch (e) {
            console.error("ConnectionManager subscribe initial error:", e);
          }
          return () => listeners.delete(fn);
        }
        function signalError(message) {
          if (!apiClient) return;
          setSnap({
            state: CONNECTION_STATE2.ERROR,
            lastError: message || "Connection error"
          });
        }
        return {
          CONNECTION_STATE: CONNECTION_STATE2,
          getSnapshot,
          getClient,
          subscribe,
          testServer,
          testServerAndCredentials,
          bootstrapFromStore,
          login,
          logoutKeepServer,
          fullStoreReset,
          validateSessionRefresh,
          saveServerAndCredentials,
          tearDownClient,
          signalError,
          /** Expose for tests */
          _setSnapForTest: setSnap
        };
      }
      module.exports = { createConnectionManager: createConnectionManager2, STORE_SERVER, STORE_TOKEN, STORE_TOKEN_SERVER };
    }
  });

  // src/renderer/js/connection/timer_operations.js
  var require_timer_operations = __commonJS({
    "src/renderer/js/connection/timer_operations.js"(exports, module) {
      var _startFlight = null;
      var _stopFlight = null;
      async function startTimerWithReconcile2(apiClient, payload) {
        if (_startFlight) return _startFlight;
        _startFlight = (async () => {
          try {
            return await apiClient.startTimer(payload);
          } catch (err) {
            const ambiguous = !err.response || err.code === "ECONNABORTED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT";
            if (!ambiguous) throw err;
            try {
              const status = await apiClient.getTimerStatus();
              if (status.data && status.data.active && status.data.timer) {
                return { data: { message: "Timer already running", timer: status.data.timer }, _reconciled: true };
              }
            } catch (reconcileErr) {
              console.error("startTimer reconcile failed:", reconcileErr);
            }
            throw err;
          }
        })();
        try {
          return await _startFlight;
        } finally {
          _startFlight = null;
        }
      }
      async function stopTimerWithReconcile2(apiClient) {
        if (_stopFlight) return _stopFlight;
        _stopFlight = (async () => {
          try {
            return await apiClient.stopTimer();
          } catch (err) {
            const statusCode = err.response && err.response.status;
            if (statusCode === 400 && err.response.data && err.response.data.error_code === "no_active_timer") {
              return { data: err.response.data, _reconciled: true };
            }
            const ambiguous = !err.response || err.code === "ECONNABORTED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT";
            if (!ambiguous) throw err;
            try {
              const status = await apiClient.getTimerStatus();
              if (status.data && !status.data.active) {
                return { data: { message: "Timer already stopped" }, _reconciled: true };
              }
            } catch (reconcileErr) {
              console.error("stopTimer reconcile failed:", reconcileErr);
            }
            throw err;
          }
        })();
        try {
          return await _stopFlight;
        } finally {
          _stopFlight = null;
        }
      }
      module.exports = { startTimerWithReconcile: startTimerWithReconcile2, stopTimerWithReconcile: stopTimerWithReconcile2 };
    }
  });

  // src/renderer/js/ui/notifications.js
  var require_notifications = __commonJS({
    "src/renderer/js/ui/notifications.js"(exports, module) {
      function showError2(message) {
        let errorDiv = document.getElementById("error-notification");
        if (!errorDiv) {
          errorDiv = document.createElement("div");
          errorDiv.id = "error-notification";
          errorDiv.className = "notification notification-error";
          errorDiv.setAttribute("role", "alert");
          errorDiv.setAttribute("aria-live", "assertive");
          document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        setTimeout(() => {
          errorDiv.style.display = "none";
        }, 5e3);
      }
      function showSuccess2(message) {
        let successDiv = document.getElementById("success-notification");
        if (!successDiv) {
          successDiv = document.createElement("div");
          successDiv.id = "success-notification";
          successDiv.className = "notification notification-success";
          successDiv.setAttribute("role", "status");
          successDiv.setAttribute("aria-live", "polite");
          document.body.appendChild(successDiv);
        }
        successDiv.textContent = message;
        successDiv.style.display = "block";
        setTimeout(() => {
          successDiv.style.display = "none";
        }, 3e3);
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { showError: showError2, showSuccess: showSuccess2 };
      }
    }
  });

  // src/renderer/js/state.js
  var require_state = __commonJS({
    "src/renderer/js/state.js"(exports, module) {
      var state2 = {
        apiClient: null,
        /** Count consecutive background checks that failed with auth (401) while on main UI */
        authFailureStreak: 0,
        /** Last timer poll error shown to user (avoid spam) */
        lastTimerPollUserMessageAt: 0,
        currentView: "dashboard",
        timerInterval: null,
        isTimerRunning: false,
        connectionCheckInterval: null,
        currentUserProfile: { is_admin: false, can_approve: false },
        cachedInvoices: [],
        cachedExpenses: [],
        cachedWorkforce: { periods: [], capacity: [], timeOffRequests: [], balances: [] },
        viewFilters: { invoiceQuery: "", expenseQuery: "", timeoffQuery: "" },
        viewLimits: { invoices: 20, expenses: 20, timeoff: 20 },
        pagination: {
          invoices: { page: 1, perPage: 20, totalPages: 1, total: 0 },
          expenses: { page: 1, perPage: 20, totalPages: 1, total: 0 }
        }
      };
      function clearViewCaches() {
        state2.cachedInvoices = [];
        state2.cachedExpenses = [];
        state2.cachedWorkforce = { periods: [], capacity: [], timeOffRequests: [], balances: [] };
      }
      state2.clearViewCaches = clearViewCaches;
      module.exports = state2;
    }
  });

  // src/renderer/js/app.js
  require_helpers();
  var ApiClient = require_client();
  var { createConnectionManager } = require_connection_manager();
  var { CONNECTION_STATE } = require_connection_state();
  var { startTimerWithReconcile, stopTimerWithReconcile } = require_timer_operations();
  var { classifyAxiosError } = require_client();
  var { showError, showSuccess } = require_notifications();
  var state = require_state();
  var {
    formatDuration,
    formatDurationLong,
    formatDateTime,
    isValidUrl,
    normalizeServerUrlInput
  } = window.Helpers || {};
  var { storeGet, storeSet, storeDelete, storeClear } = window.config || {};
  var connectionManager = null;
  var loginWizardStep = "welcome";
  function truncateUrl(url, maxLen) {
    const s = String(url || "");
    const m = maxLen || 42;
    if (s.length <= m) return s;
    return s.slice(0, m - 1) + "\u2026";
  }
  async function initApp() {
    if (typeof storeGet !== "function" || typeof storeSet !== "function" || typeof storeDelete !== "function" || typeof storeClear !== "function") {
      throw new Error("Desktop configuration bridge is unavailable.");
    }
    connectionManager = createConnectionManager({
      storeGet,
      storeSet,
      storeDelete,
      storeClear,
      onCacheClear: () => {
        if (typeof state.clearViewCaches === "function") state.clearViewCaches();
      }
    });
    connectionManager.subscribe(() => {
      state.apiClient = connectionManager.getClient();
      updateConnectionFromManager();
    });
    setupEventListeners();
    setupTrayListeners();
    const boot = await connectionManager.bootstrapFromStore();
    if (boot.ok) {
      state.authFailureStreak = 0;
      showMainScreen();
      await loadInitialData();
    } else if (boot.reason === "offline" && boot.hadCredentials) {
      showLoginScreen({
        prefillServerUrl: connectionManager.getSnapshot().serverUrl || "",
        openTokenStep: true,
        bannerMessage: "You appear to be offline. Reconnect to the network, then use Log in."
      });
    } else if (boot.reason === "session" && boot.session) {
      showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || "", sessionError: boot.session });
    } else if (boot.reason === "token_server_mismatch") {
      showLoginScreen({
        prefillServerUrl: connectionManager.getSnapshot().serverUrl || "",
        bannerMessage: connectionManager.getSnapshot().lastError || "Please sign in again."
      });
    } else if (boot.reason === "no_server") {
      showLoginScreen({ prefillServerUrl: "", startAtServer: true });
    } else if (boot.reason === "no_token") {
      showLoginScreen({
        prefillServerUrl: connectionManager.getSnapshot().serverUrl || "",
        openTokenStep: true
      });
    } else if (boot.reason === "bootstrap_timeout") {
      showLoginScreen({
        prefillServerUrl: connectionManager.getSnapshot().serverUrl || "",
        openTokenStep: true,
        bannerMessage: boot.message || "Server did not respond in time. Check the URL or network, then try signing in again."
      });
    } else if (boot.reason === "session_unreachable") {
      showLoginScreen({
        prefillServerUrl: connectionManager.getSnapshot().serverUrl || "",
        openTokenStep: true,
        bannerMessage: boot.message || "Server is not reachable. Check the URL or network, then try signing in again."
      });
    } else {
      showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || "" });
    }
    startConnectionCheck();
    window.addEventListener("online", async () => {
      if (!connectionManager.getClient()) {
        const retry = await connectionManager.bootstrapFromStore();
        if (retry.ok && document.getElementById("main-screen")?.classList.contains("active")) {
          state.authFailureStreak = 0;
          await loadInitialData();
        }
      }
      await checkConnection();
    });
  }
  async function loadInitialData() {
    try {
      await loadCurrentUserProfile();
    } catch (err) {
      console.error("Initial profile load failed:", err);
    }
    try {
      await loadDashboard();
    } catch (err) {
      console.error("Initial dashboard load failed:", err);
    }
  }
  function setupTrayListeners() {
    if (window.electronAPI && window.electronAPI.onTrayAction) {
      window.electronAPI.onTrayAction((action) => {
        if (action === "start-timer" && !state.isTimerRunning) {
          handleStartTimer();
        } else if (action === "stop-timer" && state.isTimerRunning) {
          handleStopTimer();
        }
      });
    }
  }
  function startConnectionCheck() {
    state.connectionCheckInterval = setInterval(async () => {
      await checkConnection();
    }, 3e4);
    checkConnection();
  }
  async function checkConnection() {
    if (typeof navigator !== "undefined" && navigator.onLine && !connectionManager.getClient()) {
      const snap = connectionManager.getSnapshot();
      if (snap.serverUrl && await storeGet("api_token")) {
        const boot = await connectionManager.bootstrapFromStore();
        if (boot.ok && document.getElementById("main-screen")?.classList.contains("active")) {
          state.authFailureStreak = 0;
          await loadCurrentUserProfile();
        }
      }
    }
    if (!state.apiClient) {
      updateConnectionFromManager();
      return;
    }
    const session = await connectionManager.validateSessionRefresh();
    if (session.ok) {
      state.authFailureStreak = 0;
      updateConnectionFromManager();
      return;
    }
    updateConnectionFromManager();
    if (session.code === "UNAUTHORIZED") {
      state.authFailureStreak = (state.authFailureStreak || 0) + 1;
      if (state.authFailureStreak >= 2 && document.getElementById("main-screen")?.classList.contains("active")) {
        await forceRelogin(session.message || "Your session is no longer valid. Please sign in again.");
      }
    } else {
      state.authFailureStreak = 0;
    }
  }
  async function loadCurrentUserProfile() {
    if (!state.apiClient) return;
    try {
      const me = await state.apiClient.getUsersMe();
      const user = me.user || {};
      const role = String(user.role || "").toLowerCase();
      const roleCanApprove = ["admin", "owner", "manager", "approver"].includes(role);
      state.currentUserProfile = {
        id: user.id,
        is_admin: Boolean(user.is_admin),
        can_approve: Boolean(user.is_admin) || roleCanApprove
      };
    } catch (err) {
      console.error("loadCurrentUserProfile failed:", err);
      if (err && err.stack) console.error(err.stack);
      state.currentUserProfile = { id: null, is_admin: false, can_approve: false };
      const { message } = classifyAxiosError(err);
      showError(message || "Could not load your user profile. Some actions may be unavailable until the connection improves.");
    }
  }
  function updateConnectionFromManager() {
    if (!connectionManager) return;
    const snap = connectionManager.getSnapshot();
    const statusEl = document.getElementById("connection-status");
    const urlEl = document.getElementById("connection-url-label");
    const timeEl = document.getElementById("connection-last-ok");
    if (!statusEl) return;
    let cssSuffix = "disconnected";
    let title = "";
    let label = "Connection status: ";
    switch (snap.state) {
      case CONNECTION_STATE.CONNECTED:
        cssSuffix = "connected";
        title = snap.serverUrl || "Connected";
        label += "Connected";
        statusEl.textContent = "\u25CF";
        break;
      case CONNECTION_STATE.OFFLINE:
        cssSuffix = "offline";
        title = snap.lastError || "Offline";
        label += "Offline";
        statusEl.textContent = "\u25CF";
        break;
      case CONNECTION_STATE.CONNECTING:
        cssSuffix = "connecting";
        title = snap.lastError || "Connecting\u2026";
        label += "Connecting";
        statusEl.textContent = "\u25D0";
        break;
      case CONNECTION_STATE.ERROR:
        cssSuffix = "error";
        title = snap.lastError || "Connection error";
        label += "Error";
        statusEl.textContent = "\u25CF";
        break;
      default:
        title = snap.serverUrl || "Not configured";
        label += "Not configured";
        statusEl.textContent = "\u25CB";
    }
    statusEl.className = "connection-status connection-" + cssSuffix;
    statusEl.title = title;
    statusEl.setAttribute("aria-label", label);
    if (urlEl) {
      urlEl.textContent = snap.serverUrl ? truncateUrl(snap.serverUrl) : "\u2014";
      urlEl.title = snap.serverUrl || "";
    }
    if (timeEl) {
      timeEl.textContent = snap.lastConnectedAt ? formatDateTime(new Date(snap.lastConnectedAt)) : "\u2014";
    }
  }
  async function forceRelogin(message) {
    state.authFailureStreak = 0;
    const url = await storeGet("server_url");
    if (state.isTimerRunning) {
      state.isTimerRunning = false;
      stopTimerPolling();
    }
    await connectionManager.logoutKeepServer();
    showLoginScreen({
      prefillServerUrl: url ? ApiClient.normalizeBaseUrl(String(url)) : "",
      openTokenStep: true,
      bannerMessage: message
    });
  }
  function showWizardWelcomeStep() {
    loginWizardStep = "welcome";
    const w = document.getElementById("wizard-step-welcome");
    const s1 = document.getElementById("wizard-step-server");
    const s2 = document.getElementById("wizard-step-token");
    if (w) w.style.display = "";
    if (s1) s1.style.display = "none";
    if (s2) s2.style.display = "none";
  }
  function showWizardServerStep() {
    loginWizardStep = "server";
    const w = document.getElementById("wizard-step-welcome");
    const s1 = document.getElementById("wizard-step-server");
    const s2 = document.getElementById("wizard-step-token");
    if (w) w.style.display = "none";
    if (s1) s1.style.display = "";
    if (s2) s2.style.display = "none";
  }
  function showWizardTokenStep() {
    loginWizardStep = "token";
    const w = document.getElementById("wizard-step-welcome");
    const s1 = document.getElementById("wizard-step-server");
    const s2 = document.getElementById("wizard-step-token");
    if (w) w.style.display = "none";
    if (s1) s1.style.display = "none";
    if (s2) s2.style.display = "";
  }
  function resetLoginWizard() {
    showWizardWelcomeStep();
    const contServer = document.getElementById("login-wizard-continue-server");
    if (contServer) contServer.disabled = true;
    const testBtn = document.getElementById("login-test-server-btn");
    if (testBtn) testBtn.disabled = false;
    clearLoginError();
  }
  function clearLoginError() {
    showLoginError("");
  }
  function setupEventListeners() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", handleLogin);
    }
    const loginTestServerBtn = document.getElementById("login-test-server-btn");
    const loginWizardContinue = document.getElementById("login-wizard-continue");
    const loginWizardContinueServer = document.getElementById("login-wizard-continue-server");
    const loginWizardBack = document.getElementById("login-wizard-back");
    if (loginTestServerBtn) loginTestServerBtn.addEventListener("click", handleLoginTestServer);
    if (loginWizardContinue) loginWizardContinue.addEventListener("click", handleLoginWizardContinue);
    if (loginWizardContinueServer) loginWizardContinueServer.addEventListener("click", handleLoginWizardContinue);
    if (loginWizardBack) loginWizardBack.addEventListener("click", handleLoginWizardBack);
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const view = e.target.dataset.view;
        switchView(view);
      });
    });
    const minimizeBtn = document.getElementById("minimize-btn");
    const maximizeBtn = document.getElementById("maximize-btn");
    const closeBtn = document.getElementById("close-btn");
    if (minimizeBtn) minimizeBtn.addEventListener("click", () => window.electronAPI?.minimizeWindow());
    if (maximizeBtn) maximizeBtn.addEventListener("click", () => window.electronAPI?.maximizeWindow());
    if (closeBtn) closeBtn.addEventListener("click", () => window.electronAPI?.closeWindow());
    const startTimerBtn = document.getElementById("start-timer-btn");
    const stopTimerBtn = document.getElementById("stop-timer-btn");
    if (startTimerBtn) startTimerBtn.addEventListener("click", handleStartTimer);
    if (stopTimerBtn) stopTimerBtn.addEventListener("click", handleStopTimer);
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const testConnectionBtn = document.getElementById("test-connection-btn");
    const autoSyncInput = document.getElementById("auto-sync");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", handleSaveSettings);
    if (testConnectionBtn) testConnectionBtn.addEventListener("click", handleTestConnection);
    const resetConfigBtn = document.getElementById("reset-configuration-btn");
    if (resetConfigBtn) resetConfigBtn.addEventListener("click", handleResetConfiguration);
    if (autoSyncInput) {
      autoSyncInput.addEventListener("change", () => updateSyncIntervalState());
    }
    const addEntryBtn = document.getElementById("add-entry-btn");
    const filterEntriesBtn = document.getElementById("filter-entries-btn");
    const applyFilterBtn = document.getElementById("apply-filter-btn");
    const clearFilterBtn = document.getElementById("clear-filter-btn");
    const addExpenseBtn = document.getElementById("add-expense-btn");
    const refreshPeriodsBtn = document.getElementById("refresh-periods-btn");
    const addInvoiceBtn = document.getElementById("add-invoice-btn");
    const addTimeoffBtn = document.getElementById("add-timeoff-btn");
    const invoiceSearchInput = document.getElementById("invoice-search");
    const expenseSearchInput = document.getElementById("expense-search");
    const timeoffSearchInput = document.getElementById("timeoff-search");
    const invoicePrevPageBtn = document.getElementById("invoice-prev-page-btn");
    const invoiceNextPageBtn = document.getElementById("invoice-next-page-btn");
    const expensePrevPageBtn = document.getElementById("expense-prev-page-btn");
    const expenseNextPageBtn = document.getElementById("expense-next-page-btn");
    if (addEntryBtn) addEntryBtn.addEventListener("click", () => showTimeEntryForm());
    if (filterEntriesBtn) filterEntriesBtn.addEventListener("click", toggleFilters);
    if (applyFilterBtn) applyFilterBtn.addEventListener("click", applyFilters);
    if (clearFilterBtn) clearFilterBtn.addEventListener("click", clearFilters);
    if (addExpenseBtn) addExpenseBtn.addEventListener("click", () => showCreateExpenseDialog());
    if (refreshPeriodsBtn) refreshPeriodsBtn.addEventListener("click", () => loadWorkforce());
    if (addInvoiceBtn) addInvoiceBtn.addEventListener("click", () => showCreateInvoiceDialog());
    if (addTimeoffBtn) addTimeoffBtn.addEventListener("click", () => showCreateTimeOffDialog());
    if (invoiceSearchInput) {
      invoiceSearchInput.addEventListener("input", (e) => {
        state.viewFilters.invoiceQuery = String(e.target.value || "").trim().toLowerCase();
        renderInvoices();
      });
    }
    if (expenseSearchInput) {
      expenseSearchInput.addEventListener("input", (e) => {
        state.viewFilters.expenseQuery = String(e.target.value || "").trim().toLowerCase();
        renderExpenses();
      });
    }
    if (timeoffSearchInput) {
      timeoffSearchInput.addEventListener("input", (e) => {
        state.viewFilters.timeoffQuery = String(e.target.value || "").trim().toLowerCase();
        renderTimeOffRequests();
      });
    }
    if (invoicePrevPageBtn) invoicePrevPageBtn.addEventListener("click", () => changeInvoicePage(-1));
    if (invoiceNextPageBtn) invoiceNextPageBtn.addEventListener("click", () => changeInvoicePage(1));
    if (expensePrevPageBtn) expensePrevPageBtn.addEventListener("click", () => changeExpensePage(-1));
    if (expenseNextPageBtn) expenseNextPageBtn.addEventListener("click", () => changeExpensePage(1));
  }
  async function handleLoginTestServer() {
    clearLoginError();
    const raw = document.getElementById("server-url")?.value.trim() || "";
    const normalizedInput = normalizeServerUrlInput(raw);
    if (!normalizedInput || !isValidUrl(normalizedInput)) {
      showLoginError("Enter a valid server URL (e.g. https://your-server.com or http://192.168.1.10:5000)");
      return;
    }
    const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
    const testBtn = document.getElementById("login-test-server-btn");
    const contServer = document.getElementById("login-wizard-continue-server");
    if (testBtn) testBtn.disabled = true;
    if (contServer) contServer.disabled = true;
    const pub = await connectionManager.testServer(serverUrl);
    if (testBtn) testBtn.disabled = false;
    if (contServer) contServer.disabled = true;
    if (!pub.ok) {
      showLoginError(pub.message);
      return;
    }
    const ver = pub.app_version ? ` (server version ${pub.app_version})` : "";
    showSuccess(`EvilTime server detected${ver}. Continue to sign in.`);
    if (contServer) contServer.disabled = false;
  }
  async function handleLoginWizardContinue() {
    clearLoginError();
    if (loginWizardStep === "welcome") {
      showWizardServerStep();
      return;
    }
    const raw = document.getElementById("server-url")?.value.trim() || "";
    const normalizedInput = normalizeServerUrlInput(raw);
    if (!normalizedInput || !isValidUrl(normalizedInput)) {
      showLoginError("Enter a valid server URL");
      return;
    }
    const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
    const contServer = document.getElementById("login-wizard-continue-server");
    if (contServer) contServer.disabled = true;
    const pub = await connectionManager.testServer(serverUrl);
    if (!pub.ok) {
      if (contServer) contServer.disabled = true;
      showLoginError(pub.message);
      return;
    }
    if (contServer) contServer.disabled = false;
    showWizardTokenStep();
  }
  function handleLoginWizardBack() {
    clearLoginError();
    if (loginWizardStep === "token") {
      showWizardServerStep();
      return;
    }
    if (loginWizardStep === "server") {
      showWizardWelcomeStep();
      return;
    }
    showWizardWelcomeStep();
  }
  async function handleLogin(e) {
    e.preventDefault();
    const raw = document.getElementById("server-url")?.value.trim() || "";
    const normalizedInput = normalizeServerUrlInput(raw);
    if (!normalizedInput || !isValidUrl(normalizedInput)) {
      showLoginError("Please enter a valid server URL");
      return;
    }
    const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
    const username = document.getElementById("login-username")?.value.trim() || "";
    const password = document.getElementById("login-password")?.value || "";
    if (!username || !password) {
      showLoginError("Please enter your username and password");
      return;
    }
    const result = await connectionManager.login(serverUrl, username, password);
    if (result.ok) {
      state.authFailureStreak = 0;
      showMainScreen();
      await loadInitialData();
    } else {
      const msg = result.session?.message || result.message || "Login failed";
      showLoginError(msg);
      if (result.step === "auth" && (result.session?.code === "UNAUTHORIZED" || result.session?.code === "FORBIDDEN")) {
        const contServer = document.getElementById("login-wizard-continue-server");
        if (contServer) contServer.disabled = false;
        showWizardTokenStep();
      } else if (result.step === "server") {
        showWizardServerStep();
      } else {
        showWizardServerStep();
      }
    }
  }
  function showLoginError(message) {
    const errorDiv = document.getElementById("login-error");
    if (!errorDiv) return;
    errorDiv.textContent = message || "";
    if (message) {
      errorDiv.classList.add("show");
    } else {
      errorDiv.classList.remove("show");
    }
  }
  function showLoginScreen(options = {}) {
    document.getElementById("loading-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("active");
    document.getElementById("main-screen").classList.remove("active");
    state.authFailureStreak = 0;
    const su = document.getElementById("server-url");
    if (su && options.prefillServerUrl !== void 0 && options.prefillServerUrl !== null) {
      su.value = String(options.prefillServerUrl || "");
    }
    if (options.openTokenStep) {
      const contServer = document.getElementById("login-wizard-continue-server");
      if (contServer) contServer.disabled = false;
      showWizardTokenStep();
      if (options.bannerMessage) {
        showLoginError(options.bannerMessage);
      } else {
        clearLoginError();
      }
      return;
    }
    if (options.startAtServer) {
      showWizardServerStep();
      if (options.bannerMessage) {
        showLoginError(options.bannerMessage);
      } else {
        clearLoginError();
      }
      return;
    }
    if (options.bannerMessage && !options.sessionError) {
      resetLoginWizard();
      showLoginError(options.bannerMessage);
      return;
    }
    if (options.sessionError) {
      const se = options.sessionError;
      if (se.code === "UNAUTHORIZED" || se.code === "FORBIDDEN") {
        const contServer = document.getElementById("login-wizard-continue-server");
        if (contServer) contServer.disabled = false;
        showWizardTokenStep();
        showLoginError(se.message || "Authentication failed");
        return;
      }
      resetLoginWizard();
      showLoginError(se.message || "Could not reach the server");
      return;
    }
    resetLoginWizard();
  }
  function showMainScreen() {
    document.getElementById("loading-screen").classList.remove("active");
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("main-screen").classList.add("active");
  }
  function switchView(view) {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-view="${view}"]`).classList.add("active");
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.remove("active");
    });
    document.getElementById(`${view}-view`).classList.add("active");
    state.currentView = view;
    if (view === "dashboard") {
      loadDashboard();
    } else if (view === "projects") {
      loadProjects();
    } else if (view === "entries") {
      loadTimeEntries();
      loadProjectsForFilter();
    } else if (view === "invoices") {
      loadInvoices();
    } else if (view === "expenses") {
      loadExpenses();
    } else if (view === "workforce") {
      loadWorkforce();
    } else if (view === "settings") {
      loadSettings();
    }
  }
  async function loadDashboard() {
    if (!state.apiClient) return;
    try {
      const timerResponse = await state.apiClient.getTimerStatus();
      if (timerResponse.data.active) {
        state.isTimerRunning = true;
        updateTimerDisplay(timerResponse.data.timer);
        startTimerPolling();
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const entriesResponse = await state.apiClient.getTimeEntries({ startDate: today, endDate: today });
      const totalSeconds = entriesResponse.data.time_entries?.reduce((sum, entry) => {
        return sum + (entry.duration_seconds || 0);
      }, 0) || 0;
      document.getElementById("today-summary").textContent = formatDuration(totalSeconds);
      loadRecentEntries();
    } catch (error) {
      console.error("Error loading dashboard:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Could not load the dashboard.");
    }
  }
  async function loadRecentEntries() {
    if (!state.apiClient) return;
    try {
      const response = await state.apiClient.getTimeEntries({ perPage: 5 });
      const entries = response.data.time_entries || [];
      const entriesList = document.getElementById("recent-entries");
      if (entries.length === 0) {
        entriesList.innerHTML = '<p class="empty-state">No recent entries</p>';
        return;
      }
      entriesList.innerHTML = entries.map((entry) => `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${entry.project?.name || "Unknown Project"}</h3>
          <p>${formatDateTime(entry.start_time)}</p>
        </div>
        <div class="entry-time">${formatDuration(entry.duration_seconds || 0)}</div>
      </div>
    `).join("");
    } catch (error) {
      console.error("Error loading recent entries:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Could not load recent entries.");
    }
  }
  async function loadProjects() {
    if (!state.apiClient) return;
    try {
      const response = await state.apiClient.getProjects({ status: "active" });
      const projects = response.data.projects || [];
      const projectsList = document.getElementById("projects-list");
      if (projects.length === 0) {
        projectsList.innerHTML = '<p class="empty-state">No projects found</p>';
        return;
      }
      projectsList.innerHTML = projects.map((project) => `
      <div class="project-card" onclick="selectProject(${project.id})">
        <h3>${project.name}</h3>
        <p>${project.client || "No client"}</p>
      </div>
    `).join("");
    } catch (error) {
      console.error("Error loading projects:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Could not load projects.");
    }
  }
  var currentFilters = {
    startDate: null,
    endDate: null,
    projectId: null
  };
  async function loadTimeEntries() {
    if (!state.apiClient) return;
    try {
      const params = { perPage: 50 };
      if (currentFilters.startDate) params.startDate = currentFilters.startDate;
      if (currentFilters.endDate) params.endDate = currentFilters.endDate;
      if (currentFilters.projectId) params.projectId = currentFilters.projectId;
      const response = await state.apiClient.getTimeEntries(params);
      const entries = response.data.time_entries || [];
      const entriesList = document.getElementById("entries-list");
      if (entries.length === 0) {
        entriesList.innerHTML = '<p class="empty-state">No time entries</p>';
        return;
      }
      entriesList.innerHTML = entries.map((entry) => `
      <div class="entry-item" data-entry-id="${entry.id}">
        <div class="entry-info">
          <h3>${entry.project?.name || "Unknown Project"}</h3>
          ${entry.task ? `<p class="entry-task">${entry.task.name}</p>` : ""}
          <p class="entry-time-range">
            ${formatDateTime(entry.start_time)} - ${entry.end_time ? formatDateTime(entry.end_time) : "Running"}
          </p>
          ${entry.notes ? `<p class="entry-notes">${entry.notes}</p>` : ""}
          ${entry.tags ? `<p class="entry-tags">Tags: ${entry.tags}</p>` : ""}
          ${entry.billable ? '<span class="badge badge-success">Billable</span>' : ""}
        </div>
        <div class="entry-actions">
          <div class="entry-time">${formatDuration(entry.duration_seconds || 0)}</div>
          <button class="btn btn-sm btn-secondary" onclick="editTimeEntry(${entry.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTimeEntry(${entry.id})">Delete</button>
        </div>
      </div>
    `).join("");
    } catch (error) {
      console.error("Error loading time entries:", error);
      showError("Failed to load time entries: " + (error.response?.data?.error || error.message));
    }
  }
  async function handleStartTimer() {
    if (!state.apiClient) return;
    const result = await showStartTimerDialog();
    if (!result) return;
    try {
      const response = await startTimerWithReconcile(state.apiClient, {
        projectId: result.projectId,
        taskId: result.taskId,
        notes: result.notes
      });
      if (response.data && response.data.timer) {
        state.isTimerRunning = true;
        updateTimerDisplay(response.data.timer);
        startTimerPolling();
        document.getElementById("start-timer-btn").style.display = "none";
        document.getElementById("stop-timer-btn").style.display = "block";
      }
    } catch (error) {
      console.error("Failed to start timer:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Failed to start timer: " + (error.response?.data?.error || error.message));
    }
  }
  async function showStartTimerDialog() {
    return new Promise(async (resolve) => {
      let projects = [];
      let requirements = { require_task: false, require_description: false, description_min_length: 20 };
      try {
        const projectsResponse = await state.apiClient.getProjects({ status: "active" });
        projects = projectsResponse.data.projects || [];
        try {
          const usersMeResponse = await state.apiClient.getUsersMe();
          if (usersMeResponse && usersMeResponse.time_entry_requirements) {
            requirements = usersMeResponse.time_entry_requirements;
          }
        } catch (meErr) {
          console.error("getUsersMe for timer dialog:", meErr);
          if (meErr && meErr.stack) console.error(meErr.stack);
          const { message } = classifyAxiosError(meErr);
          showError(message || "Could not load time entry rules; using defaults.");
        }
      } catch (error) {
        console.error("Failed to load projects for timer dialog:", error);
        if (error && error.stack) console.error(error.stack);
        const { message } = classifyAxiosError(error);
        showError(message || "Failed to load projects");
        resolve(null);
        return;
      }
      if (projects.length === 0) {
        showError("No active projects found");
        resolve(null);
        return;
      }
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Start Timer</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">\xD7</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="timer-project-select">Project *</label>
            <select id="timer-project-select" class="form-control" required>
              <option value="">Select a project...</option>
              ${projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="timer-task-select">${requirements.require_task ? "Task *" : "Task (Optional)"}</label>
            <select id="timer-task-select" class="form-control">
              <option value="">No task</option>
            </select>
          </div>
          <div class="form-group">
            <label for="timer-notes-input">${requirements.require_description ? "Notes *" : "Notes (Optional)"}</label>
            <textarea id="timer-notes-input" class="form-control" rows="3" placeholder="What are you working on?"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="start-timer-confirm">Start</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
      const projectSelect = modal.querySelector("#timer-project-select");
      const taskSelect = modal.querySelector("#timer-task-select");
      const notesInput = modal.querySelector("#timer-notes-input");
      const confirmBtn = modal.querySelector("#start-timer-confirm");
      projectSelect.addEventListener("change", async (e) => {
        const projectId = parseInt(e.target.value);
        if (!projectId) {
          taskSelect.innerHTML = '<option value="">No task</option>';
          return;
        }
        try {
          const tasksResponse = await state.apiClient.getTasks({ projectId });
          const tasks = tasksResponse.data.tasks || [];
          taskSelect.innerHTML = '<option value="">No task</option>' + tasks.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
        } catch (error) {
          console.error("Failed to load tasks:", error);
        }
      });
      confirmBtn.addEventListener("click", () => {
        const projectId = parseInt(projectSelect.value);
        if (!projectId) {
          showError("Please select a project");
          return;
        }
        const taskId = taskSelect.value ? parseInt(taskSelect.value) : null;
        if (requirements.require_task && !taskId) {
          showError("A task must be selected when logging time for a project");
          return;
        }
        const notes = notesInput.value.trim();
        if (requirements.require_description) {
          if (!notes) {
            showError("A description is required when logging time");
            return;
          }
          const minLen = requirements.description_min_length || 20;
          if (notes.length < minLen) {
            showError(`Description must be at least ${minLen} characters`);
            return;
          }
        }
        modal.remove();
        resolve({ projectId, taskId, notes: notes || null });
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(null);
        }
      });
    });
  }
  async function handleStopTimer() {
    if (!state.apiClient) return;
    try {
      await stopTimerWithReconcile(state.apiClient);
      state.isTimerRunning = false;
      stopTimerPolling();
      document.getElementById("timer-display").textContent = "00:00:00";
      document.getElementById("timer-project").textContent = "No active timer";
      document.getElementById("timer-task").style.display = "none";
      document.getElementById("timer-notes").style.display = "none";
      document.getElementById("start-timer-btn").style.display = "block";
      document.getElementById("stop-timer-btn").style.display = "none";
      updateTimerDisplay(null);
      loadTimeEntries();
      loadRecentEntries();
    } catch (error) {
      console.error("Error stopping timer:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Failed to stop timer: " + (error.response?.data?.error || error.message));
    }
  }
  function startTimerPolling() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(async () => {
      if (!state.apiClient || !state.isTimerRunning) return;
      try {
        const response = await state.apiClient.getTimerStatus();
        if (response.data.active) {
          updateTimerDisplay(response.data.timer);
        } else {
          state.isTimerRunning = false;
          stopTimerPolling();
        }
      } catch (error) {
        console.error("Error polling timer:", error);
        if (error && error.stack) console.error(error.stack);
        const { message } = classifyAxiosError(error);
        connectionManager.signalError(message || "Lost connection while syncing the active timer.");
        updateConnectionFromManager();
        const now = Date.now();
        if (!state.lastTimerPollUserMessageAt || now - state.lastTimerPollUserMessageAt > 6e4) {
          state.lastTimerPollUserMessageAt = now;
          showError(
            "Lost connection while syncing the active timer. Check the connection indicator; polling will retry."
          );
        }
      }
    }, 5e3);
  }
  function stopTimerPolling() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }
  function updateTimerDisplay(timer) {
    if (!timer) {
      if (window.electronAPI && window.electronAPI.sendTimerStatus) {
        window.electronAPI.sendTimerStatus({ active: false });
      }
      return;
    }
    const startTime = new Date(timer.start_time);
    const now = /* @__PURE__ */ new Date();
    const seconds = Math.floor((now - startTime) / 1e3);
    document.getElementById("timer-display").textContent = formatDurationLong(seconds);
    document.getElementById("timer-project").textContent = timer.project?.name || "Unknown Project";
    const taskEl = document.getElementById("timer-task");
    if (timer.task) {
      taskEl.textContent = timer.task.name;
      taskEl.style.display = "block";
    } else {
      taskEl.style.display = "none";
    }
    const notesEl = document.getElementById("timer-notes");
    if (timer.notes) {
      notesEl.textContent = timer.notes;
      notesEl.style.display = "block";
    } else {
      notesEl.style.display = "none";
    }
    if (window.electronAPI && window.electronAPI.sendTimerStatus) {
      window.electronAPI.sendTimerStatus({ active: true, timer });
    }
  }
  async function loadInvoices() {
    if (!state.apiClient) return;
    try {
      const response = await state.apiClient.getInvoices({
        page: state.pagination.invoices.page,
        perPage: state.pagination.invoices.perPage
      });
      state.cachedInvoices = response.data.invoices || [];
      state.viewLimits.invoices = 20;
      const pagination = response.data.pagination || {};
      state.pagination.invoices.totalPages = Number(pagination.pages || pagination.total_pages || 1) || 1;
      state.pagination.invoices.total = Number(pagination.total || state.cachedInvoices.length) || state.cachedInvoices.length;
      renderInvoices();
      renderInvoicePager();
    } catch (error) {
      console.error("Error loading invoices:", error);
      showError("Failed to load invoices: " + (error.response?.data?.error || error.message));
    }
  }
  function renderInvoicePager() {
    const indicator = document.getElementById("invoice-page-indicator");
    const prevBtn = document.getElementById("invoice-prev-page-btn");
    const nextBtn = document.getElementById("invoice-next-page-btn");
    if (indicator) {
      indicator.textContent = `Page ${state.pagination.invoices.page}/${state.pagination.invoices.totalPages}`;
    }
    if (prevBtn) {
      prevBtn.disabled = state.pagination.invoices.page <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = state.pagination.invoices.page >= state.pagination.invoices.totalPages;
    }
  }
  async function changeInvoicePage(delta) {
    const nextPage = state.pagination.invoices.page + delta;
    if (nextPage < 1 || nextPage > state.pagination.invoices.totalPages) {
      return;
    }
    state.pagination.invoices.page = nextPage;
    await loadInvoices();
  }
  function renderInvoices() {
    const list = document.getElementById("invoices-list");
    if (!list) return;
    const filtered = state.cachedInvoices.filter((invoice) => {
      const q = state.viewFilters.invoiceQuery;
      if (!q) return true;
      const haystack = `${invoice.invoice_number || ""} ${invoice.client_name || ""} ${invoice.status || ""}`.toLowerCase();
      return haystack.includes(q);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">No invoices</p>';
      return;
    }
    const limited = filtered.slice(0, state.viewLimits.invoices);
    const rowsHtml = limited.map((invoice) => {
      const number = invoice.invoice_number || invoice.id || "N/A";
      const status = invoice.status || "unknown";
      const total = invoice.total_amount ?? invoice.total ?? "-";
      const totalNumber = Number(invoice.total_amount ?? invoice.total ?? 0) || 0;
      return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>Invoice ${number}</h3>
          <p>Status: ${status}</p>
        </div>
        <div class="entry-actions">
          <div class="entry-time">${total}</div>
          <button class="btn btn-sm btn-secondary" onclick="updateInvoiceStatusAction(${invoice.id}, 'sent')">Mark Sent</button>
          <button class="btn btn-sm btn-secondary" onclick="markInvoicePaidAction(${invoice.id}, ${totalNumber})">Mark Paid</button>
          <button class="btn btn-sm btn-danger" onclick="updateInvoiceStatusAction(${invoice.id}, 'cancelled')">Cancel</button>
        </div>
      </div>
    `;
    }).join("");
    const hasMore = filtered.length > limited.length;
    list.innerHTML = rowsHtml + (hasMore ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreInvoices()">Load More</button></div>` : "");
  }
  async function loadExpenses() {
    if (!state.apiClient) return;
    try {
      const response = await state.apiClient.getExpenses({
        page: state.pagination.expenses.page,
        perPage: state.pagination.expenses.perPage
      });
      state.cachedExpenses = response.data.expenses || [];
      state.viewLimits.expenses = 20;
      const pagination = response.data.pagination || {};
      state.pagination.expenses.totalPages = Number(pagination.pages || pagination.total_pages || 1) || 1;
      state.pagination.expenses.total = Number(pagination.total || state.cachedExpenses.length) || state.cachedExpenses.length;
      renderExpenses();
      renderExpensePager();
    } catch (error) {
      console.error("Error loading expenses:", error);
      showError("Failed to load expenses: " + (error.response?.data?.error || error.message));
    }
  }
  function renderExpensePager() {
    const indicator = document.getElementById("expense-page-indicator");
    const prevBtn = document.getElementById("expense-prev-page-btn");
    const nextBtn = document.getElementById("expense-next-page-btn");
    if (indicator) {
      indicator.textContent = `Page ${state.pagination.expenses.page}/${state.pagination.expenses.totalPages}`;
    }
    if (prevBtn) {
      prevBtn.disabled = state.pagination.expenses.page <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = state.pagination.expenses.page >= state.pagination.expenses.totalPages;
    }
  }
  async function changeExpensePage(delta) {
    const nextPage = state.pagination.expenses.page + delta;
    if (nextPage < 1 || nextPage > state.pagination.expenses.totalPages) {
      return;
    }
    state.pagination.expenses.page = nextPage;
    await loadExpenses();
  }
  function renderExpenses() {
    const list = document.getElementById("expenses-list");
    if (!list) return;
    const filtered = state.cachedExpenses.filter((expense) => {
      const q = state.viewFilters.expenseQuery;
      if (!q) return true;
      const haystack = `${expense.title || ""} ${expense.category || ""} ${expense.expense_date || ""}`.toLowerCase();
      return haystack.includes(q);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">No expenses</p>';
      return;
    }
    const limited = filtered.slice(0, state.viewLimits.expenses);
    const rowsHtml = limited.map((expense) => {
      const category = expense.category || "General";
      const amount = expense.amount ?? "-";
      const date = expense.expense_date || expense.date || "";
      return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${category}</h3>
          <p>${date}</p>
        </div>
        <div class="entry-time">${amount}</div>
      </div>
    `;
    }).join("");
    const hasMore = filtered.length > limited.length;
    list.innerHTML = rowsHtml + (hasMore ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreExpenses()">Load More</button></div>` : "");
  }
  async function loadWorkforce() {
    if (!state.apiClient) return;
    try {
      const start = /* @__PURE__ */ new Date();
      start.setDate(start.getDate() - start.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startDate = start.toISOString().split("T")[0];
      const endDate = end.toISOString().split("T")[0];
      const [periodsResponse, capacityResponse, requestsResponse, balancesResponse] = await Promise.all([
        state.apiClient.getTimesheetPeriods({ startDate, endDate }),
        state.apiClient.getCapacityReport({ startDate, endDate }),
        state.apiClient.getTimeOffRequests({}),
        state.apiClient.getTimeOffBalances({})
      ]);
      state.cachedWorkforce = {
        periods: periodsResponse.data.timesheet_periods || [],
        capacity: capacityResponse.data.capacity || [],
        timeOffRequests: requestsResponse.data.time_off_requests || [],
        balances: balancesResponse.data.balances || []
      };
      state.viewLimits.timeoff = 20;
      renderWorkforce();
    } catch (error) {
      console.error("Error loading workforce view:", error);
      showError("Failed to load workforce data: " + (error.response?.data?.error || error.message));
    }
  }
  function renderWorkforce() {
    renderPeriods();
    renderCapacity();
    renderTimeOffRequests();
    renderBalances();
  }
  function renderPeriods() {
    const periods = state.cachedWorkforce.periods || [];
    const periodsList = document.getElementById("periods-list");
    if (!periodsList) return;
    if (periods.length === 0) {
      periodsList.innerHTML = '<p class="empty-state">No periods</p>';
      return;
    }
    periodsList.innerHTML = periods.map((period) => `
    <div class="entry-item">
      <div class="entry-info">
        <h3>${period.period_start} - ${period.period_end}</h3>
        <p>Status: ${period.status}</p>
      </div>
      <div class="entry-actions">
        ${String(period.status || "").toLowerCase() === "draft" ? `<button class="btn btn-sm btn-primary" onclick="submitTimesheetPeriodAction(${period.id})">Submit</button>` : ""}
        ${String(period.status || "").toLowerCase() === "submitted" && state.currentUserProfile.can_approve ? `<button class="btn btn-sm btn-primary" onclick="reviewTimesheetPeriodAction(${period.id}, true)">Approve</button>` : ""}
        ${String(period.status || "").toLowerCase() === "submitted" && state.currentUserProfile.can_approve ? `<button class="btn btn-sm btn-danger" onclick="reviewTimesheetPeriodAction(${period.id}, false)">Reject</button>` : ""}
        ${["draft", "rejected"].includes(String(period.status || "").toLowerCase()) ? `<button class="btn btn-sm btn-danger" onclick="deleteTimesheetPeriodAction(${period.id})">Delete</button>` : ""}
      </div>
    </div>
  `).join("");
  }
  function renderCapacity() {
    const capacity = state.cachedWorkforce.capacity || [];
    const capacityList = document.getElementById("capacity-list");
    if (!capacityList) return;
    if (capacity.length === 0) {
      capacityList.innerHTML = '<p class="empty-state">No capacity rows</p>';
      return;
    }
    capacityList.innerHTML = capacity.map((row) => {
      const username = row.username || row.user_id || "User";
      const expected = row.expected_hours ?? 0;
      const allocated = row.allocated_hours ?? 0;
      const util = row.utilization_pct ?? 0;
      return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${username}</h3>
          <p>Expected ${expected}h | Allocated ${allocated}h</p>
        </div>
        <div class="entry-time">${util}%</div>
      </div>
    `;
    }).join("");
  }
  function renderTimeOffRequests() {
    const requests = state.cachedWorkforce.timeOffRequests || [];
    const timeoffList = document.getElementById("timeoff-list");
    if (!timeoffList) return;
    const filtered = requests.filter((req) => {
      const q = state.viewFilters.timeoffQuery;
      if (!q) return true;
      const haystack = `${req.leave_type_name || ""} ${req.status || ""} ${req.start_date || ""} ${req.end_date || ""}`.toLowerCase();
      return haystack.includes(q);
    });
    if (filtered.length === 0) {
      timeoffList.innerHTML = '<p class="empty-state">No time-off requests</p>';
      return;
    }
    const limited = filtered.slice(0, state.viewLimits.timeoff);
    const rowsHtml = limited.map((req) => {
      const leaveType = req.leave_type_name || "Leave";
      const status = req.status || "";
      const pending = String(status).toLowerCase() === "submitted";
      const canReview = pending && state.currentUserProfile.can_approve;
      return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${leaveType}</h3>
          <p>${req.start_date} - ${req.end_date}</p>
        </div>
        <div class="entry-actions">
          <div class="entry-time">${status}</div>
          ${canReview ? `<button class="btn btn-sm btn-primary" onclick="reviewTimeOffRequestAction(${req.id}, true)">Approve</button>` : ""}
          ${canReview ? `<button class="btn btn-sm btn-danger" onclick="reviewTimeOffRequestAction(${req.id}, false)">Reject</button>` : ""}
          ${["draft", "submitted", "cancelled"].includes(String(status).toLowerCase()) && (req.user_id === state.currentUserProfile.id || state.currentUserProfile.can_approve) ? `<button class="btn btn-sm btn-danger" onclick="deleteTimeOffRequestAction(${req.id})">Delete</button>` : ""}
        </div>
      </div>
    `;
    }).join("");
    const hasMore = filtered.length > limited.length;
    timeoffList.innerHTML = rowsHtml + (hasMore ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreTimeOffRequests()">Load More</button></div>` : "");
  }
  function renderBalances() {
    const balances = state.cachedWorkforce.balances || [];
    const balancesList = document.getElementById("balances-list");
    if (!balancesList) return;
    if (balances.length === 0) {
      balancesList.innerHTML = '<p class="empty-state">No leave balances</p>';
      return;
    }
    balancesList.innerHTML = balances.map((bal) => {
      const leaveType = bal.leave_type_name || "Leave";
      const remaining = bal.remaining_hours ?? bal.balance_hours ?? 0;
      return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${leaveType}</h3>
        </div>
        <div class="entry-time">${remaining}h</div>
      </div>
    `;
    }).join("");
  }
  async function showCreateInvoiceDialog() {
    if (!state.apiClient) return;
    try {
      const [projectsResponse, clientsResponse] = await Promise.all([
        state.apiClient.getProjects({ status: "active", perPage: 100 }),
        state.apiClient.getClients({ status: "active", perPage: 100 })
      ]);
      const projects = projectsResponse.data.projects || [];
      const clients = clientsResponse.data.clients || [];
      if (projects.length === 0 || clients.length === 0) {
        showError("Need at least one active project and client to create an invoice");
        return;
      }
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Invoice</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">\xD7</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="invoice-project-select">Project *</label>
            <select id="invoice-project-select" class="form-control">
              ${projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="invoice-client-select">Client *</label>
            <select id="invoice-client-select" class="form-control">
              ${clients.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="invoice-due-date">Due date *</label>
            <input type="date" id="invoice-due-date" class="form-control" value="${new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0]}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="invoice-create-btn">Create</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
      const createBtn = modal.querySelector("#invoice-create-btn");
      createBtn.addEventListener("click", async () => {
        const projectId = Number(modal.querySelector("#invoice-project-select").value);
        const clientId = Number(modal.querySelector("#invoice-client-select").value);
        const dueDate = modal.querySelector("#invoice-due-date").value;
        const client = clients.find((c) => Number(c.id) === clientId);
        if (!projectId || !clientId || !client || !dueDate) {
          showError("Please provide all required fields");
          return;
        }
        await state.apiClient.createInvoice({
          project_id: projectId,
          client_id: clientId,
          client_name: client.name,
          due_date: dueDate
        });
        modal.remove();
        showSuccess("Invoice created successfully");
        await loadInvoices();
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (error) {
      showError("Failed to create invoice: " + (error.response?.data?.error || error.message));
    }
  }
  async function showCreateTimeOffDialog() {
    if (!state.apiClient) return;
    try {
      const leaveTypesResponse = await state.apiClient.getLeaveTypes();
      const leaveTypes = leaveTypesResponse.data.leave_types || [];
      if (leaveTypes.length === 0) {
        showError("No leave types available");
        return;
      }
      const modal = document.createElement("div");
      modal.className = "modal";
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Time-Off Request</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">\xD7</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="timeoff-leave-type">Leave type *</label>
            <select id="timeoff-leave-type" class="form-control">
              ${leaveTypes.map((lt) => `<option value="${lt.id}">${lt.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="timeoff-start-date">Start date *</label>
            <input type="date" id="timeoff-start-date" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label for="timeoff-end-date">End date *</label>
            <input type="date" id="timeoff-end-date" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label for="timeoff-hours">Requested hours (optional)</label>
            <input type="number" step="0.25" id="timeoff-hours" class="form-control">
          </div>
          <div class="form-group">
            <label for="timeoff-comment">Comment (optional)</label>
            <textarea id="timeoff-comment" class="form-control" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="timeoff-create-btn">Create</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
      modal.querySelector("#timeoff-create-btn").addEventListener("click", async () => {
        const leaveTypeId = Number(modal.querySelector("#timeoff-leave-type").value);
        const startDate = modal.querySelector("#timeoff-start-date").value;
        const endDate = modal.querySelector("#timeoff-end-date").value;
        const hoursValue = modal.querySelector("#timeoff-hours").value.trim();
        const requestedHours = hoursValue ? Number(hoursValue) : null;
        const comment = modal.querySelector("#timeoff-comment").value.trim();
        if (!leaveTypeId || !startDate || !endDate) {
          showError("Please provide leave type and dates");
          return;
        }
        if (hoursValue && !Number.isFinite(requestedHours)) {
          showError("requested_hours must be numeric");
          return;
        }
        await state.apiClient.createTimeOffRequest({
          leaveTypeId,
          startDate,
          endDate,
          requestedHours,
          comment,
          submit: true
        });
        modal.remove();
        showSuccess("Time-off request created");
        await loadWorkforce();
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (error) {
      showError("Failed to create time-off request: " + (error.response?.data?.error || error.message));
    }
  }
  async function showCreateExpenseDialog() {
    if (!state.apiClient) return;
    try {
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Expense</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">\xD7</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="expense-title">Title *</label>
            <input type="text" id="expense-title" class="form-control" placeholder="Taxi to client office">
          </div>
          <div class="form-group">
            <label for="expense-category">Category *</label>
            <input type="text" id="expense-category" class="form-control" value="travel">
          </div>
          <div class="form-group">
            <label for="expense-amount">Amount *</label>
            <input type="number" step="0.01" id="expense-amount" class="form-control">
          </div>
          <div class="form-group">
            <label for="expense-date">Expense date *</label>
            <input type="date" id="expense-date" class="form-control" value="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="expense-create-btn">Create</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
      modal.querySelector("#expense-create-btn").addEventListener("click", async () => {
        const title = modal.querySelector("#expense-title").value.trim();
        const category = modal.querySelector("#expense-category").value.trim();
        const amount = Number(modal.querySelector("#expense-amount").value);
        const expenseDate = modal.querySelector("#expense-date").value;
        if (!title || !category || !expenseDate || !Number.isFinite(amount) || amount <= 0) {
          showError("Please provide valid title/category/amount/date");
          return;
        }
        await state.apiClient.createExpense({
          title,
          category,
          amount,
          expense_date: expenseDate
        });
        modal.remove();
        showSuccess("Expense created successfully");
        await loadExpenses();
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (error) {
      showError("Failed to create expense: " + (error.response?.data?.error || error.message));
    }
  }
  async function loadSettings() {
    const serverUrl = await storeGet("server_url") || "";
    const username = await storeGet("username") || "";
    const autoSync = await storeGet("auto_sync");
    const syncInterval = await storeGet("sync_interval");
    const serverUrlInput = document.getElementById("settings-server-url");
    const usernameInput = document.getElementById("settings-username");
    const passwordInput = document.getElementById("settings-password");
    const autoSyncInput = document.getElementById("auto-sync");
    const syncIntervalInput = document.getElementById("sync-interval");
    if (serverUrlInput) {
      serverUrlInput.value = serverUrl ? ApiClient.normalizeBaseUrl(String(serverUrl)) : "";
    }
    if (usernameInput) {
      usernameInput.value = username ? String(username) : "";
    }
    if (passwordInput) {
      passwordInput.value = "";
    }
    if (autoSyncInput) {
      autoSyncInput.checked = autoSync !== null ? Boolean(autoSync) : true;
    }
    if (syncIntervalInput) {
      syncIntervalInput.value = (syncInterval || 60).toString();
    }
    updateSyncIntervalState();
  }
  function updateSyncIntervalState() {
    const autoSyncInput = document.getElementById("auto-sync");
    const syncIntervalInput = document.getElementById("sync-interval");
    if (!autoSyncInput || !syncIntervalInput) return;
    syncIntervalInput.disabled = !autoSyncInput.checked;
  }
  async function handleSaveSettings() {
    const serverUrlInput = document.getElementById("settings-server-url");
    const usernameInput = document.getElementById("settings-username");
    const passwordInput = document.getElementById("settings-password");
    const autoSyncInput = document.getElementById("auto-sync");
    const syncIntervalInput = document.getElementById("sync-interval");
    const messageDiv = document.getElementById("settings-message");
    if (!serverUrlInput || !usernameInput || !passwordInput || !autoSyncInput || !syncIntervalInput) return;
    const rawServer = serverUrlInput.value.trim();
    const normalizedInput = normalizeServerUrlInput(rawServer);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const autoSync = autoSyncInput.checked;
    const syncInterval = parseInt(syncIntervalInput.value, 10);
    if (!normalizedInput || !isValidUrl(normalizedInput)) {
      showSettingsMessage("Please enter a valid server URL", "error");
      return;
    }
    const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
    if (!username || !password) {
      showSettingsMessage("Please enter your username and password to save settings", "error");
      return;
    }
    if (Number.isNaN(syncInterval) || syncInterval < 10) {
      showSettingsMessage("Sync interval must be at least 10 seconds", "error");
      return;
    }
    try {
      const saved = await connectionManager.saveServerAndCredentials(serverUrl, username, password, {
        auto_sync: autoSync,
        sync_interval: syncInterval
      });
      if (!saved.ok) {
        showSettingsMessage(saved.message || saved.session?.message || "Could not save settings.", "error");
        updateConnectionFromManager();
        return;
      }
      state.authFailureStreak = 0;
      await loadCurrentUserProfile();
      updateConnectionFromManager();
      showSettingsMessage("Settings saved successfully!", "success");
      passwordInput.value = "";
      serverUrlInput.value = serverUrl;
    } catch (error) {
      console.error("Error saving settings:", error);
      if (error && error.stack) console.error(error.stack);
      showSettingsMessage("Error saving settings: " + (error.message || String(error)), "error");
    }
  }
  async function handleTestConnection() {
    const serverUrlInput = document.getElementById("settings-server-url");
    const usernameInput = document.getElementById("settings-username");
    const passwordInput = document.getElementById("settings-password");
    const messageDiv = document.getElementById("settings-message");
    if (!serverUrlInput || !usernameInput || !passwordInput) return;
    const rawServer = serverUrlInput.value.trim();
    const normalizedInput = normalizeServerUrlInput(rawServer);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!normalizedInput || !isValidUrl(normalizedInput)) {
      showSettingsMessage("Please enter a valid server URL", "error");
      return;
    }
    const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
    if (!username || !password) {
      showSettingsMessage("Please enter your username and password to test connection", "error");
      return;
    }
    try {
      showSettingsMessage("Testing connection...", "info");
      const r = await connectionManager.testServerAndCredentials(serverUrl, username, password);
      if (!r.ok) {
        showSettingsMessage(r.message || "Connection test failed.", "error");
        updateConnectionFromManager();
        return;
      }
      const snap = connectionManager.getSnapshot();
      if (snap.serverUrl === serverUrl && connectionManager.getClient()) {
        await connectionManager.validateSessionRefresh();
      }
      updateConnectionFromManager();
      const ver = r.app_version ? ` (${r.app_version})` : "";
      showSettingsMessage(`Connection successful: credentials are valid${ver}.`, "success");
    } catch (error) {
      console.error("Error testing connection:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showSettingsMessage(message || "Connection error: " + error.message, "error");
    }
  }
  function showSettingsMessage(message, type = "info") {
    const messageDiv = document.getElementById("settings-message");
    if (!messageDiv) return;
    messageDiv.textContent = message;
    messageDiv.className = `message message-${type}`;
    messageDiv.style.display = "block";
    if (type === "success" || type === "info") {
      setTimeout(() => {
        messageDiv.style.display = "none";
      }, 5e3);
    }
  }
  async function handleLogout() {
    if (!confirm("Sign out of this desktop app? Your server URL will be kept.")) return;
    if (state.isTimerRunning) {
      state.isTimerRunning = false;
      stopTimerPolling();
    }
    await connectionManager.logoutKeepServer();
    showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || "" });
  }
  async function handleResetConfiguration() {
    if (!confirm(
      "Reset all app configuration (server URL, token, sync settings)? This cannot be undone."
    )) {
      return;
    }
    if (state.isTimerRunning) {
      state.isTimerRunning = false;
      stopTimerPolling();
    }
    await connectionManager.fullStoreReset();
    showLoginScreen({ prefillServerUrl: "", startAtServer: true });
  }
  async function safeInitApp() {
    try {
      await initApp();
    } catch (err) {
      console.error("initApp failed:", err);
      try {
        showLoginScreen({
          prefillServerUrl: "",
          startAtServer: true,
          bannerMessage: "Startup failed. Please re-enter your server URL and sign in again."
        });
      } catch (e) {
        console.error("Failed to show login screen after init failure:", e);
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInitApp);
  } else {
    safeInitApp();
  }
  function toggleFilters() {
    const filtersEl = document.getElementById("entries-filters");
    if (filtersEl) {
      filtersEl.style.display = filtersEl.style.display === "none" ? "block" : "none";
    }
  }
  async function applyFilters() {
    const startDate = document.getElementById("filter-start-date")?.value || null;
    const endDate = document.getElementById("filter-end-date")?.value || null;
    const projectId = document.getElementById("filter-project")?.value ? parseInt(document.getElementById("filter-project").value) : null;
    currentFilters = { startDate, endDate, projectId };
    await loadTimeEntries();
  }
  function clearFilters() {
    currentFilters = { startDate: null, endDate: null, projectId: null };
    document.getElementById("filter-start-date").value = "";
    document.getElementById("filter-end-date").value = "";
    document.getElementById("filter-project").value = "";
    loadTimeEntries();
  }
  async function loadProjectsForFilter() {
    if (!state.apiClient) return;
    try {
      const response = await state.apiClient.getProjects({ status: "active" });
      const projects = response.data.projects || [];
      const select = document.getElementById("filter-project");
      if (select) {
        select.innerHTML = '<option value="">All Projects</option>' + projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
        if (currentFilters.projectId) {
          select.value = String(currentFilters.projectId);
        }
      }
    } catch (error) {
      console.error("Error loading projects for filter:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Could not load projects for filter.");
    }
  }
  async function showTimeEntryForm(entryId = null) {
    if (!state.apiClient) return;
    let projects = [];
    let requirements = { require_task: false, require_description: false, description_min_length: 20 };
    try {
      const projectsResponse = await state.apiClient.getProjects({ status: "active" });
      projects = projectsResponse.data.projects || [];
      try {
        const usersMeResponse = await state.apiClient.getUsersMe();
        if (usersMeResponse && usersMeResponse.time_entry_requirements) {
          requirements = usersMeResponse.time_entry_requirements;
        }
      } catch (meErr) {
        console.error("getUsersMe for time entry form:", meErr);
        if (meErr && meErr.stack) console.error(meErr.stack);
        const { message } = classifyAxiosError(meErr);
        showError(message || "Could not load time entry rules; using defaults.");
      }
    } catch (error) {
      console.error("Failed to load projects for time entry form:", error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || "Failed to load projects");
      return;
    }
    let entry = null;
    if (entryId) {
      try {
        const entryResponse = await state.apiClient.getTimeEntry(entryId);
        entry = entryResponse.data.time_entry;
      } catch (error) {
        showError("Failed to load time entry");
        return;
      }
    }
    let tasks = [];
    const projectId = entry ? entry.project_id : null;
    if (projectId) {
      try {
        const tasksResponse = await state.apiClient.getTasks({ projectId });
        tasks = tasksResponse.data.tasks || [];
      } catch (error) {
        console.error("Failed to load tasks:", error);
      }
    }
    const modal = document.createElement("div");
    modal.className = "modal";
    const startDate = entry ? new Date(entry.start_time).toISOString().split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const startTime = entry ? new Date(entry.start_time).toTimeString().slice(0, 5) : (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
    const endDate = entry && entry.end_time ? new Date(entry.end_time).toISOString().split("T")[0] : "";
    const endTime = entry && entry.end_time ? new Date(entry.end_time).toTimeString().slice(0, 5) : "";
    modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>${entryId ? "Edit" : "Add"} Time Entry</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">\xD7</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="entry-project-select">Project *</label>
          <select id="entry-project-select" class="form-control" required>
            <option value="">Select a project...</option>
            ${projects.map((p) => `<option value="${p.id}" ${entry && entry.project_id === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label for="entry-task-select">${requirements.require_task ? "Task *" : "Task (Optional)"}</label>
          <select id="entry-task-select" class="form-control">
            <option value="">No task</option>
            ${tasks.map((t) => `<option value="${t.id}" ${entry && entry.task_id === t.id ? "selected" : ""}>${t.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="entry-start-date">Start Date *</label>
            <input type="date" id="entry-start-date" class="form-control" value="${startDate}" required>
          </div>
          <div class="form-group">
            <label for="entry-start-time">Start Time *</label>
            <input type="time" id="entry-start-time" class="form-control" value="${startTime}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="entry-end-date">End Date (Optional)</label>
            <input type="date" id="entry-end-date" class="form-control" value="${endDate}">
          </div>
          <div class="form-group">
            <label for="entry-end-time">End Time (Optional)</label>
            <input type="time" id="entry-end-time" class="form-control" value="${endTime}">
          </div>
        </div>
        <div class="form-group">
          <label for="entry-notes">${requirements.require_description ? "Notes *" : "Notes"}</label>
          <textarea id="entry-notes" class="form-control" rows="3">${entry?.notes || ""}</textarea>
        </div>
        <div class="form-group">
          <label for="entry-tags">Tags (comma-separated)</label>
          <input type="text" id="entry-tags" class="form-control" value="${entry?.tags || ""}">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="entry-billable" ${entry ? entry.billable ? "checked" : "" : "checked"}>
            Billable
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="save-entry-btn">${entryId ? "Update" : "Create"}</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    const projectSelect = modal.querySelector("#entry-project-select");
    const taskSelect = modal.querySelector("#entry-task-select");
    const saveBtn = modal.querySelector("#save-entry-btn");
    projectSelect.addEventListener("change", async (e) => {
      const projectId2 = parseInt(e.target.value);
      if (!projectId2) {
        taskSelect.innerHTML = '<option value="">No task</option>';
        return;
      }
      try {
        const tasksResponse = await state.apiClient.getTasks({ projectId: projectId2 });
        const tasks2 = tasksResponse.data.tasks || [];
        taskSelect.innerHTML = '<option value="">No task</option>' + tasks2.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
      } catch (error) {
        console.error("Failed to load tasks:", error);
      }
    });
    saveBtn.addEventListener("click", async () => {
      const projectId2 = parseInt(projectSelect.value);
      if (!projectId2) {
        showError("Please select a project");
        return;
      }
      const taskId = taskSelect.value ? parseInt(taskSelect.value) : null;
      if (requirements.require_task && !taskId) {
        showError("A task must be selected when logging time for a project");
        return;
      }
      const notesEl = document.getElementById("entry-notes");
      const notes = notesEl ? notesEl.value.trim() : "";
      if (requirements.require_description) {
        if (!notes) {
          showError("A description is required when logging time");
          return;
        }
        const minLen = requirements.description_min_length || 20;
        if (notes.length < minLen) {
          showError(`Description must be at least ${minLen} characters`);
          return;
        }
      }
      const startDate2 = document.getElementById("entry-start-date").value;
      const startTime2 = document.getElementById("entry-start-time").value;
      const endDate2 = document.getElementById("entry-end-date").value;
      const endTime2 = document.getElementById("entry-end-time").value;
      const notesForApi = notes || null;
      const tags = document.getElementById("entry-tags").value.trim() || null;
      const billable = document.getElementById("entry-billable").checked;
      const startDateTime = (/* @__PURE__ */ new Date(`${startDate2}T${startTime2}`)).toISOString();
      const endDateTime = endDate2 && endTime2 ? (/* @__PURE__ */ new Date(`${endDate2}T${endTime2}`)).toISOString() : null;
      try {
        if (entryId) {
          await state.apiClient.updateTimeEntry(entryId, {
            project_id: projectId2,
            task_id: taskId,
            start_time: startDateTime,
            end_time: endDateTime,
            notes: notesForApi,
            tags,
            billable
          });
          showSuccess("Time entry updated successfully");
        } else {
          await state.apiClient.createTimeEntry({
            project_id: projectId2,
            task_id: taskId,
            start_time: startDateTime,
            end_time: endDateTime,
            notes: notesForApi,
            tags,
            billable
          });
          showSuccess("Time entry created successfully");
        }
        modal.remove();
        loadTimeEntries();
      } catch (error) {
        showError("Failed to save time entry: " + (error.response?.data?.error || error.message));
      }
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
})();
/*! Bundled license information:

axios/dist/browser/axios.cjs:
  (*! Axios v1.15.0 Copyright (c) 2026 Matt Zabriskie and contributors *)
*/
