/******/ (() => {
  // webpackBootstrap
  /******/ var __webpack_modules__ = [
    /* 0 */
    /***/ function (__unused_webpack_module, exports, __webpack_require__) {
      "use strict";

      var __createBinding =
        (this && this.__createBinding) ||
        (Object.create
          ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (
                !desc ||
                ("get" in desc
                  ? !m.__esModule
                  : desc.writable || desc.configurable)
              ) {
                desc = {
                  enumerable: true,
                  get: function () {
                    return m[k];
                  },
                };
              }
              Object.defineProperty(o, k2, desc);
            }
          : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
            });
      var __exportStar =
        (this && this.__exportStar) ||
        function (m, exports) {
          for (var p in m)
            if (
              p !== "default" &&
              !Object.prototype.hasOwnProperty.call(exports, p)
            )
              __createBinding(exports, m, p);
        };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.tableCreator =
        exports.schema =
        exports.db =
        exports.queryClient =
          void 0;
      __webpack_require__(1);
      const postgres_js_1 = __webpack_require__(10);
      const postgres_1 = __webpack_require__(12);
      const schema = __webpack_require__(26);
      exports.schema = schema;
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
      }
      exports.queryClient = (0, postgres_1.default)(process.env.DATABASE_URL);
      exports.db = (0, postgres_js_1.drizzle)(exports.queryClient, {
        schema,
      });
      __exportStar(__webpack_require__(30), exports);
      var table_1 = __webpack_require__(28);
      Object.defineProperty(exports, "tableCreator", {
        enumerable: true,
        get: function () {
          return table_1.pgTable;
        },
      });

      /***/
    },
    /* 1 */
    /***/ (
      __unused_webpack_module,
      __unused_webpack_exports,
      __webpack_require__
    ) => {
      (function () {
        __webpack_require__(2).config(
          Object.assign(
            {},
            __webpack_require__(8),
            __webpack_require__(9)(process.argv)
          )
        );
      })();

      /***/
    },
    /* 2 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      const fs = __webpack_require__(3);
      const path = __webpack_require__(4);
      const os = __webpack_require__(5);
      const crypto = __webpack_require__(6);
      const packageJson = __webpack_require__(7);

      const version = packageJson.version;

      const LINE =
        /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

      // Parse src into an Object
      function parse(src) {
        const obj = {};

        // Convert buffer to string
        let lines = src.toString();

        // Convert line breaks to same format
        lines = lines.replace(/\r\n?/gm, "\n");

        let match;
        while ((match = LINE.exec(lines)) != null) {
          const key = match[1];

          // Default undefined or null to empty string
          let value = match[2] || "";

          // Remove whitespace
          value = value.trim();

          // Check if double quoted
          const maybeQuote = value[0];

          // Remove surrounding quotes
          value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");

          // Expand newlines if double quoted
          if (maybeQuote === '"') {
            value = value.replace(/\\n/g, "\n");
            value = value.replace(/\\r/g, "\r");
          }

          // Add to object
          obj[key] = value;
        }

        return obj;
      }

      function _parseVault(options) {
        const vaultPath = _vaultPath(options);

        // Parse .env.vault
        const result = DotenvModule.configDotenv({ path: vaultPath });
        if (!result.parsed) {
          throw new Error(
            `MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`
          );
        }

        // handle scenario for comma separated keys - for use with key rotation
        // example: DOTENV_KEY="dotenv://:key_1234@dotenv.org/vault/.env.vault?environment=prod,dotenv://:key_7890@dotenv.org/vault/.env.vault?environment=prod"
        const keys = _dotenvKey(options).split(",");
        const length = keys.length;

        let decrypted;
        for (let i = 0; i < length; i++) {
          try {
            // Get full key
            const key = keys[i].trim();

            // Get instructions for decrypt
            const attrs = _instructions(result, key);

            // Decrypt
            decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);

            break;
          } catch (error) {
            // last key
            if (i + 1 >= length) {
              throw error;
            }
            // try next key
          }
        }

        // Parse decrypted .env string
        return DotenvModule.parse(decrypted);
      }

      function _log(message) {
        console.log(`[dotenv@${version}][INFO] ${message}`);
      }

      function _warn(message) {
        console.log(`[dotenv@${version}][WARN] ${message}`);
      }

      function _debug(message) {
        console.log(`[dotenv@${version}][DEBUG] ${message}`);
      }

      function _dotenvKey(options) {
        // prioritize developer directly setting options.DOTENV_KEY
        if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
          return options.DOTENV_KEY;
        }

        // secondary infra already contains a DOTENV_KEY environment variable
        if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
          return process.env.DOTENV_KEY;
        }

        // fallback to empty string
        return "";
      }

      function _instructions(result, dotenvKey) {
        // Parse DOTENV_KEY. Format is a URI
        let uri;
        try {
          uri = new URL(dotenvKey);
        } catch (error) {
          if (error.code === "ERR_INVALID_URL") {
            throw new Error(
              "INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenv.org/vault/.env.vault?environment=development"
            );
          }

          throw error;
        }

        // Get decrypt key
        const key = uri.password;
        if (!key) {
          throw new Error("INVALID_DOTENV_KEY: Missing key part");
        }

        // Get environment
        const environment = uri.searchParams.get("environment");
        if (!environment) {
          throw new Error("INVALID_DOTENV_KEY: Missing environment part");
        }

        // Get ciphertext payload
        const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
        const ciphertext = result.parsed[environmentKey]; // DOTENV_VAULT_PRODUCTION
        if (!ciphertext) {
          throw new Error(
            `NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`
          );
        }

        return { ciphertext, key };
      }

      function _vaultPath(options) {
        let dotenvPath = path.resolve(process.cwd(), ".env");

        if (options && options.path && options.path.length > 0) {
          dotenvPath = options.path;
        }

        // Locate .env.vault
        return dotenvPath.endsWith(".vault")
          ? dotenvPath
          : `${dotenvPath}.vault`;
      }

      function _resolveHome(envPath) {
        return envPath[0] === "~"
          ? path.join(os.homedir(), envPath.slice(1))
          : envPath;
      }

      function _configVault(options) {
        _log("Loading env from encrypted .env.vault");

        const parsed = DotenvModule._parseVault(options);

        let processEnv = process.env;
        if (options && options.processEnv != null) {
          processEnv = options.processEnv;
        }

        DotenvModule.populate(processEnv, parsed, options);

        return { parsed };
      }

      function configDotenv(options) {
        let dotenvPath = path.resolve(process.cwd(), ".env");
        let encoding = "utf8";
        const debug = Boolean(options && options.debug);

        if (options) {
          if (options.path != null) {
            dotenvPath = _resolveHome(options.path);
          }
          if (options.encoding != null) {
            encoding = options.encoding;
          }
        }

        try {
          // Specifying an encoding returns a string instead of a buffer
          const parsed = DotenvModule.parse(
            fs.readFileSync(dotenvPath, { encoding })
          );

          let processEnv = process.env;
          if (options && options.processEnv != null) {
            processEnv = options.processEnv;
          }

          DotenvModule.populate(processEnv, parsed, options);

          return { parsed };
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${dotenvPath} ${e.message}`);
          }

          return { error: e };
        }
      }

      // Populates process.env from .env file
      function config(options) {
        const vaultPath = _vaultPath(options);

        // fallback to original dotenv if DOTENV_KEY is not set
        if (_dotenvKey(options).length === 0) {
          return DotenvModule.configDotenv(options);
        }

        // dotenvKey exists but .env.vault file does not exist
        if (!fs.existsSync(vaultPath)) {
          _warn(
            `You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`
          );

          return DotenvModule.configDotenv(options);
        }

        return DotenvModule._configVault(options);
      }

      function decrypt(encrypted, keyStr) {
        const key = Buffer.from(keyStr.slice(-64), "hex");
        let ciphertext = Buffer.from(encrypted, "base64");

        const nonce = ciphertext.slice(0, 12);
        const authTag = ciphertext.slice(-16);
        ciphertext = ciphertext.slice(12, -16);

        try {
          const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
          aesgcm.setAuthTag(authTag);
          return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
        } catch (error) {
          const isRange = error instanceof RangeError;
          const invalidKeyLength = error.message === "Invalid key length";
          const decryptionFailed =
            error.message ===
            "Unsupported state or unable to authenticate data";

          if (isRange || invalidKeyLength) {
            const msg =
              "INVALID_DOTENV_KEY: It must be 64 characters long (or more)";
            throw new Error(msg);
          } else if (decryptionFailed) {
            const msg = "DECRYPTION_FAILED: Please check your DOTENV_KEY";
            throw new Error(msg);
          } else {
            console.error("Error: ", error.code);
            console.error("Error: ", error.message);
            throw error;
          }
        }
      }

      // Populate process.env with parsed values
      function populate(processEnv, parsed, options = {}) {
        const debug = Boolean(options && options.debug);
        const override = Boolean(options && options.override);

        if (typeof parsed !== "object") {
          throw new Error(
            "OBJECT_REQUIRED: Please check the processEnv argument being passed to populate"
          );
        }

        // Set process.env
        for (const key of Object.keys(parsed)) {
          if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
            if (override === true) {
              processEnv[key] = parsed[key];
            }

            if (debug) {
              if (override === true) {
                _debug(`"${key}" is already defined and WAS overwritten`);
              } else {
                _debug(`"${key}" is already defined and was NOT overwritten`);
              }
            }
          } else {
            processEnv[key] = parsed[key];
          }
        }
      }

      const DotenvModule = {
        configDotenv,
        _configVault,
        _parseVault,
        config,
        decrypt,
        parse,
        populate,
      };

      module.exports.configDotenv = DotenvModule.configDotenv;
      module.exports._configVault = DotenvModule._configVault;
      module.exports._parseVault = DotenvModule._parseVault;
      module.exports.config = DotenvModule.config;
      module.exports.decrypt = DotenvModule.decrypt;
      module.exports.parse = DotenvModule.parse;
      module.exports.populate = DotenvModule.populate;

      module.exports = DotenvModule;

      /***/
    },
    /* 3 */
    /***/ (module) => {
      "use strict";
      module.exports = require("fs");

      /***/
    },
    /* 4 */
    /***/ (module) => {
      "use strict";
      module.exports = require("path");

      /***/
    },
    /* 5 */
    /***/ (module) => {
      "use strict";
      module.exports = require("os");

      /***/
    },
    /* 6 */
    /***/ (module) => {
      "use strict";
      module.exports = require("crypto");

      /***/
    },
    /* 7 */
    /***/ (module) => {
      "use strict";
      module.exports = JSON.parse(
        '{"name":"dotenv","version":"16.3.1","description":"Loads environment variables from .env file","main":"lib/main.js","types":"lib/main.d.ts","exports":{".":{"types":"./lib/main.d.ts","require":"./lib/main.js","default":"./lib/main.js"},"./config":"./config.js","./config.js":"./config.js","./lib/env-options":"./lib/env-options.js","./lib/env-options.js":"./lib/env-options.js","./lib/cli-options":"./lib/cli-options.js","./lib/cli-options.js":"./lib/cli-options.js","./package.json":"./package.json"},"scripts":{"dts-check":"tsc --project tests/types/tsconfig.json","lint":"standard","lint-readme":"standard-markdown","pretest":"npm run lint && npm run dts-check","test":"tap tests/*.js --100 -Rspec","prerelease":"npm test","release":"standard-version"},"repository":{"type":"git","url":"git://github.com/motdotla/dotenv.git"},"funding":"https://github.com/motdotla/dotenv?sponsor=1","keywords":["dotenv","env",".env","environment","variables","config","settings"],"readmeFilename":"README.md","license":"BSD-2-Clause","devDependencies":{"@definitelytyped/dtslint":"^0.0.133","@types/node":"^18.11.3","decache":"^4.6.1","sinon":"^14.0.1","standard":"^17.0.0","standard-markdown":"^7.1.0","standard-version":"^9.5.0","tap":"^16.3.0","tar":"^6.1.11","typescript":"^4.8.4"},"engines":{"node":">=12"},"browser":{"fs":false}}'
      );

      /***/
    },
    /* 8 */
    /***/ (module) => {
      // ../config.js accepts options via environment variables
      const options = {};

      if (process.env.DOTENV_CONFIG_ENCODING != null) {
        options.encoding = process.env.DOTENV_CONFIG_ENCODING;
      }

      if (process.env.DOTENV_CONFIG_PATH != null) {
        options.path = process.env.DOTENV_CONFIG_PATH;
      }

      if (process.env.DOTENV_CONFIG_DEBUG != null) {
        options.debug = process.env.DOTENV_CONFIG_DEBUG;
      }

      if (process.env.DOTENV_CONFIG_OVERRIDE != null) {
        options.override = process.env.DOTENV_CONFIG_OVERRIDE;
      }

      if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) {
        options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
      }

      module.exports = options;

      /***/
    },
    /* 9 */
    /***/ (module) => {
      const re =
        /^dotenv_config_(encoding|path|debug|override|DOTENV_KEY)=(.+)$/;

      module.exports = function optionMatcher(args) {
        return args.reduce(function (acc, cur) {
          const matches = cur.match(re);
          if (matches) {
            acc[matches[1]] = matches[2];
          }
          return acc;
        }, {});
      };

      /***/
    },
    /* 10 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      var index = __webpack_require__(11);

      var _a, _b, _c;
      class PostgresJsPreparedQuery extends index.PreparedQuery {
        constructor(client, query, params, logger, fields, customResultMapper) {
          super();
          this.client = client;
          this.query = query;
          this.params = params;
          this.logger = logger;
          this.fields = fields;
          this.customResultMapper = customResultMapper;
        }
        async execute(placeholderValues = {}) {
          return index.tracer.startActiveSpan(
            "drizzle.execute",
            async (span) => {
              const params = index.fillPlaceholders(
                this.params,
                placeholderValues
              );
              span?.setAttributes({
                "drizzle.query.text": this.query,
                "drizzle.query.params": JSON.stringify(params),
              });
              this.logger.logQuery(this.query, params);
              const {
                fields,
                query,
                client,
                joinsNotNullableMap,
                customResultMapper,
              } = this;
              if (!fields && !customResultMapper) {
                return index.tracer.startActiveSpan(
                  "drizzle.driver.execute",
                  () => {
                    return client.unsafe(query, params);
                  }
                );
              }
              const rows = await index.tracer.startActiveSpan(
                "drizzle.driver.execute",
                () => {
                  span?.setAttributes({
                    "drizzle.query.text": query,
                    "drizzle.query.params": JSON.stringify(params),
                  });
                  return client.unsafe(query, params).values();
                }
              );
              return index.tracer.startActiveSpan("drizzle.mapResponse", () => {
                return customResultMapper
                  ? customResultMapper(rows)
                  : rows.map((row) =>
                      index.mapResultRow(fields, row, joinsNotNullableMap)
                    );
              });
            }
          );
        }
        all(placeholderValues = {}) {
          return index.tracer.startActiveSpan(
            "drizzle.execute",
            async (span) => {
              const params = index.fillPlaceholders(
                this.params,
                placeholderValues
              );
              span?.setAttributes({
                "drizzle.query.text": this.query,
                "drizzle.query.params": JSON.stringify(params),
              });
              this.logger.logQuery(this.query, params);
              return index.tracer.startActiveSpan(
                "drizzle.driver.execute",
                () => {
                  span?.setAttributes({
                    "drizzle.query.text": this.query,
                    "drizzle.query.params": JSON.stringify(params),
                  });
                  return this.client.unsafe(this.query, params);
                }
              );
            }
          );
        }
      }
      _a = index.entityKind;
      PostgresJsPreparedQuery[_a] = "PostgresJsPreparedQuery";
      class PostgresJsSession extends index.PgSession {
        constructor(
          client,
          dialect,
          schema,
          /** @internal */
          options = {}
        ) {
          super(dialect);
          this.client = client;
          this.schema = schema;
          this.options = options;
          this.logger = options.logger ?? new index.NoopLogger();
        }
        prepareQuery(query, fields, name, customResultMapper) {
          return new PostgresJsPreparedQuery(
            this.client,
            query.sql,
            query.params,
            this.logger,
            fields,
            customResultMapper
          );
        }
        query(query, params) {
          this.logger.logQuery(query, params);
          return this.client.unsafe(query, params).values();
        }
        queryObjects(query, params) {
          return this.client.unsafe(query, params);
        }
        transaction(transaction, config) {
          return this.client.begin(async (client) => {
            const session = new PostgresJsSession(
              client,
              this.dialect,
              this.schema,
              this.options
            );
            const tx = new PostgresJsTransaction(
              this.dialect,
              session,
              this.schema
            );
            if (config) {
              await tx.setTransaction(config);
            }
            return transaction(tx);
          });
        }
      }
      _b = index.entityKind;
      PostgresJsSession[_b] = "PostgresJsSession";
      class PostgresJsTransaction extends index.PgTransaction {
        constructor(
          dialect,
          /** @internal */
          session,
          schema,
          nestedIndex = 0
        ) {
          super(dialect, session, schema, nestedIndex);
          this.session = session;
        }
        transaction(transaction) {
          return this.session.client.savepoint((client) => {
            const session = new PostgresJsSession(
              client,
              this.dialect,
              this.schema,
              this.session.options
            );
            const tx = new PostgresJsTransaction(
              this.dialect,
              session,
              this.schema
            );
            return transaction(tx);
          });
        }
      }
      _c = index.entityKind;
      PostgresJsTransaction[_c] = "PostgresJsTransaction";

      function drizzle(client, config = {}) {
        const dialect = new index.PgDialect();
        let logger;
        if (config.logger === true) {
          logger = new index.DefaultLogger();
        } else if (config.logger !== false) {
          logger = config.logger;
        }
        let schema;
        if (config.schema) {
          const tablesConfig = index.extractTablesRelationalConfig(
            config.schema,
            index.createTableRelationsHelpers
          );
          schema = {
            fullSchema: config.schema,
            schema: tablesConfig.tables,
            tableNamesMap: tablesConfig.tableNamesMap,
          };
        }
        const session = new PostgresJsSession(client, dialect, schema, {
          logger,
        });
        return new index.PgDatabase(dialect, session, schema);
      }

      exports.PostgresJsPreparedQuery = PostgresJsPreparedQuery;
      exports.PostgresJsSession = PostgresJsSession;
      exports.PostgresJsTransaction = PostgresJsTransaction;
      exports.drizzle = drizzle;
      //# sourceMappingURL=index.cjs.map

      /***/
    },
    /* 11 */
    /***/ (__unused_webpack_module, exports) => {
      "use strict";

      const entityKind = Symbol.for("drizzle:entityKind");
      const hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
      function is(value, type) {
        if (!value || typeof value !== "object") {
          return false;
        }
        if (value instanceof type) {
          // eslint-disable-line no-instanceof/no-instanceof
          return true;
        }
        if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
          throw new Error(
            `Class "${
              type.name ?? "<unknown>"
            }" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
          );
        }
        let cls = value.constructor;
        if (cls) {
          // Traverse the prototype chain to find the entityKind
          while (cls) {
            if (entityKind in cls && cls[entityKind] === type[entityKind]) {
              return true;
            }
            cls = Object.getPrototypeOf(cls);
          }
        }
        return false;
      }

      var _a$W;
      /*
    `Column` only accepts a full `ColumnConfig` as its generic.
    To infer parts of the config, use `AnyColumn` that accepts a partial config.
    See `GetColumnData` for example usage of inferring.
*/
      class Column {
        constructor(table, config) {
          this.table = table;
          this.enumValues = undefined;
          this.config = config;
          this.name = config.name;
          this.notNull = config.notNull;
          this.default = config.default;
          this.defaultFn = config.defaultFn;
          this.hasDefault = config.hasDefault;
          this.primary = config.primaryKey;
          this.isUnique = config.isUnique;
          this.uniqueName = config.uniqueName;
          this.uniqueType = config.uniqueType;
          this.dataType = config.dataType;
          this.columnType = config.columnType;
        }
        mapFromDriverValue(value) {
          return value;
        }
        mapToDriverValue(value) {
          return value;
        }
      }
      _a$W = entityKind;
      Column[_a$W] = "Column";

      var _a$V, _b$L, _c$f;
      class ConsoleLogWriter {
        write(message) {
          console.log(message);
        }
      }
      _a$V = entityKind;
      ConsoleLogWriter[_a$V] = "ConsoleLogWriter";
      class DefaultLogger {
        constructor(config) {
          this.writer = config?.writer ?? new ConsoleLogWriter();
        }
        logQuery(query, params) {
          const stringifiedParams = params.map((p) => {
            try {
              return JSON.stringify(p);
            } catch {
              return String(p);
            }
          });
          const paramsStr = stringifiedParams.length
            ? ` -- params: [${stringifiedParams.join(", ")}]`
            : "";
          this.writer.write(`Query: ${query}${paramsStr}`);
        }
      }
      _b$L = entityKind;
      DefaultLogger[_b$L] = "DefaultLogger";
      class NoopLogger {
        logQuery() {
          // noop
        }
      }
      _c$f = entityKind;
      NoopLogger[_c$f] = "NoopLogger";

      var _a$U;
      const ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");
      class View {
        constructor({ name, schema, selectedFields, query }) {
          this[ViewBaseConfig] = {
            name,
            originalName: name,
            schema,
            selectedFields,
            query: query,
            isExisting: !query,
            isAlias: false,
          };
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _a$U = entityKind;
      View[_a$U] = "View";

      var _a$T, _b$K, _c$e;
      const SubqueryConfig = Symbol.for("drizzle:SubqueryConfig");
      class Subquery {
        constructor(sql, selection, alias, isWith = false) {
          this[SubqueryConfig] = {
            sql,
            selection,
            alias,
            isWith,
          };
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _a$T = entityKind;
      Subquery[_a$T] = "Subquery";
      class WithSubquery extends Subquery {}
      _b$K = entityKind;
      WithSubquery[_b$K] = "WithSubquery";
      class SelectionProxyHandler {
        constructor(config) {
          this.config = { ...config };
        }
        get(subquery, prop) {
          if (prop === SubqueryConfig) {
            return {
              ...subquery[SubqueryConfig],
              selection: new Proxy(subquery[SubqueryConfig].selection, this),
            };
          }
          if (prop === ViewBaseConfig) {
            return {
              ...subquery[ViewBaseConfig],
              selectedFields: new Proxy(
                subquery[ViewBaseConfig].selectedFields,
                this
              ),
            };
          }
          if (typeof prop === "symbol") {
            return subquery[prop];
          }
          const columns = is(subquery, Subquery)
            ? subquery[SubqueryConfig].selection
            : is(subquery, View)
              ? subquery[ViewBaseConfig].selectedFields
              : subquery;
          const value = columns[prop];
          if (is(value, SQL.Aliased)) {
            // Never return the underlying SQL expression for a field previously selected in a subquery
            if (
              this.config.sqlAliasedBehavior === "sql" &&
              !value.isSelectionField
            ) {
              return value.sql;
            }
            const newValue = value.clone();
            newValue.isSelectionField = true;
            return newValue;
          }
          if (is(value, SQL)) {
            if (this.config.sqlBehavior === "sql") {
              return value;
            }
            throw new Error(
              `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
            );
          }
          if (is(value, Column)) {
            if (this.config.alias) {
              return new Proxy(
                value,
                new ColumnAliasProxyHandler(
                  new Proxy(
                    value.table,
                    new TableAliasProxyHandler(
                      this.config.alias,
                      this.config.replaceOriginalName ?? false
                    )
                  )
                )
              );
            }
            return value;
          }
          if (typeof value !== "object" || value === null) {
            return value;
          }
          return new Proxy(value, new SelectionProxyHandler(this.config));
        }
      }
      _c$e = entityKind;
      SelectionProxyHandler[_c$e] = "SelectionProxyHandler";

      /** @internal */
      function mapResultRow(columns, row, joinsNotNullableMap) {
        // Key -> nested object key, value -> table name if all fields in the nested object are from the same table, false otherwise
        const nullifyMap = {};
        const result = columns.reduce(
          (result, { path, field }, columnIndex) => {
            let decoder;
            if (is(field, Column)) {
              decoder = field;
            } else if (is(field, SQL)) {
              decoder = field.decoder;
            } else {
              decoder = field.sql.decoder;
            }
            let node = result;
            for (const [pathChunkIndex, pathChunk] of path.entries()) {
              if (pathChunkIndex < path.length - 1) {
                if (!(pathChunk in node)) {
                  node[pathChunk] = {};
                }
                node = node[pathChunk];
              } else {
                const rawValue = row[columnIndex];
                const value = (node[pathChunk] =
                  rawValue === null
                    ? null
                    : decoder.mapFromDriverValue(rawValue));
                if (
                  joinsNotNullableMap &&
                  is(field, Column) &&
                  path.length === 2
                ) {
                  const objectName = path[0];
                  if (!(objectName in nullifyMap)) {
                    nullifyMap[objectName] =
                      value === null ? getTableName(field.table) : false;
                  } else if (
                    typeof nullifyMap[objectName] === "string" &&
                    nullifyMap[objectName] !== getTableName(field.table)
                  ) {
                    nullifyMap[objectName] = false;
                  }
                }
              }
            }
            return result;
          },
          {}
        );
        // Nullify all nested objects from nullifyMap that are nullable
        if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
          for (const [objectName, tableName] of Object.entries(nullifyMap)) {
            if (
              typeof tableName === "string" &&
              !joinsNotNullableMap[tableName]
            ) {
              result[objectName] = null;
            }
          }
        }
        return result;
      }
      /** @internal */
      function orderSelectedFields(fields, pathPrefix) {
        return Object.entries(fields).reduce((result, [name, field]) => {
          if (typeof name !== "string") {
            return result;
          }
          const newPath = pathPrefix ? [...pathPrefix, name] : [name];
          if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
            result.push({ path: newPath, field });
          } else if (is(field, Table)) {
            result.push(
              ...orderSelectedFields(field[Table.Symbol.Columns], newPath)
            );
          } else {
            result.push(...orderSelectedFields(field, newPath));
          }
          return result;
        }, []);
      }
      /** @internal */
      function mapUpdateSet(table, values) {
        const entries = Object.entries(values)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => {
            // eslint-disable-next-line unicorn/prefer-ternary
            if (is(value, SQL)) {
              return [key, value];
            } else {
              return [key, new Param(value, table[Table.Symbol.Columns][key])];
            }
          });
        if (entries.length === 0) {
          throw new Error("No values to set");
        }
        return Object.fromEntries(entries);
      }
      /** @internal */
      function applyMixins(baseClass, extendedClasses) {
        for (const extendedClass of extendedClasses) {
          for (const name of Object.getOwnPropertyNames(
            extendedClass.prototype
          )) {
            Object.defineProperty(
              baseClass.prototype,
              name,
              Object.getOwnPropertyDescriptor(extendedClass.prototype, name) ||
                Object.create(null)
            );
          }
        }
      }
      function getTableColumns(table) {
        return table[Table.Symbol.Columns];
      }
      /** @internal */
      function getTableLikeName(table) {
        return is(table, Subquery)
          ? table[SubqueryConfig].alias
          : is(table, View)
            ? table[ViewBaseConfig].name
            : is(table, SQL)
              ? undefined
              : table[Table.Symbol.IsAlias]
                ? table[Table.Symbol.Name]
                : table[Table.Symbol.BaseName];
      }
      function iife(fn, ...args) {
        return fn(...args);
      }

      var _a$S, _b$J, _c$d, _d$7;
      /** @internal */
      const TableName = Symbol.for("drizzle:Name");
      /** @internal */
      const Schema = Symbol.for("drizzle:Schema");
      /** @internal */
      const Columns = Symbol.for("drizzle:Columns");
      /** @internal */
      const OriginalName = Symbol.for("drizzle:OriginalName");
      /** @internal */
      const BaseName = Symbol.for("drizzle:BaseName");
      /** @internal */
      const IsAlias = Symbol.for("drizzle:IsAlias");
      /** @internal */
      const ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
      const IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
      class Table {
        constructor(name, schema, baseName) {
          /** @internal */
          this[_b$J] = false;
          /** @internal */
          this[_c$d] = undefined;
          this[_d$7] = true;
          this[TableName] = this[OriginalName] = name;
          this[Schema] = schema;
          this[BaseName] = baseName;
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      (_a$S = entityKind),
        (_b$J = IsAlias),
        (_c$d = ExtraConfigBuilder),
        (_d$7 = IsDrizzleTable);
      Table[_a$S] = "Table";
      /** @internal */
      Table.Symbol = {
        Name: TableName,
        Schema: Schema,
        OriginalName: OriginalName,
        Columns: Columns,
        BaseName: BaseName,
        IsAlias: IsAlias,
        ExtraConfigBuilder: ExtraConfigBuilder,
      };
      function isTable(table) {
        return (
          typeof table === "object" && table !== null && IsDrizzleTable in table
        );
      }
      function getTableName(table) {
        return table[TableName];
      }

      var _a$R, _b$I;
      class QueryPromise {
        constructor() {
          this[_b$I] = "QueryPromise";
        }
        catch(onRejected) {
          return this.then(undefined, onRejected);
        }
        finally(onFinally) {
          return this.then(
            (value) => {
              onFinally?.();
              return value;
            },
            (reason) => {
              onFinally?.();
              throw reason;
            }
          );
        }
        then(onFulfilled, onRejected) {
          return this.execute().then(onFulfilled, onRejected);
        }
      }
      (_a$R = entityKind), (_b$I = Symbol.toStringTag);
      QueryPromise[_a$R] = "QueryPromise";

      /** @internal */
      const tracer = {
        startActiveSpan(name, fn) {
          {
            return fn();
          }
        },
      };

      var _a$Q;
      class PgDelete extends QueryPromise {
        constructor(table, session, dialect) {
          super();
          this.session = session;
          this.dialect = dialect;
          this.execute = (placeholderValues) => {
            return tracer.startActiveSpan("drizzle.operation", () => {
              return this._prepare().execute(placeholderValues);
            });
          };
          this.config = { table };
        }
        where(where) {
          this.config.where = where;
          return this;
        }
        returning(fields = this.config.table[Table.Symbol.Columns]) {
          this.config.returning = orderSelectedFields(fields);
          return this;
        }
        /** @internal */
        getSQL() {
          return this.dialect.buildDeleteQuery(this.config);
        }
        toSQL() {
          const { typings: _typings, ...rest } = this.dialect.sqlToQuery(
            this.getSQL()
          );
          return rest;
        }
        _prepare(name) {
          return tracer.startActiveSpan("drizzle.prepareQuery", () => {
            return this.session.prepareQuery(
              this.dialect.sqlToQuery(this.getSQL()),
              this.config.returning,
              name
            );
          });
        }
        prepare(name) {
          return this._prepare(name);
        }
      }
      _a$Q = entityKind;
      PgDelete[_a$Q] = "PgDelete";

      var _a$P, _b$H;
      class PgInsertBuilder {
        constructor(table, session, dialect) {
          this.table = table;
          this.session = session;
          this.dialect = dialect;
        }
        values(values) {
          values = Array.isArray(values) ? values : [values];
          if (values.length === 0) {
            throw new Error("values() must be called with at least one value");
          }
          const mappedValues = values.map((entry) => {
            const result = {};
            const cols = this.table[Table.Symbol.Columns];
            for (const colKey of Object.keys(entry)) {
              const colValue = entry[colKey];
              result[colKey] = is(colValue, SQL)
                ? colValue
                : new Param(colValue, cols[colKey]);
            }
            return result;
          });
          return new PgInsert(
            this.table,
            mappedValues,
            this.session,
            this.dialect
          );
        }
      }
      _a$P = entityKind;
      PgInsertBuilder[_a$P] = "PgInsertBuilder";
      class PgInsert extends QueryPromise {
        constructor(table, values, session, dialect) {
          super();
          this.session = session;
          this.dialect = dialect;
          this.execute = (placeholderValues) => {
            return tracer.startActiveSpan("drizzle.operation", () => {
              return this._prepare().execute(placeholderValues);
            });
          };
          this.config = { table, values };
        }
        returning(fields = this.config.table[Table.Symbol.Columns]) {
          this.config.returning = orderSelectedFields(fields);
          return this;
        }
        onConflictDoNothing(config = {}) {
          if (config.target === undefined) {
            this.config.onConflict = sql`do nothing`;
          } else {
            let targetColumn = "";
            targetColumn = Array.isArray(config.target)
              ? config.target
                  .map((it) => this.dialect.escapeName(it.name))
                  .join(",")
              : this.dialect.escapeName(config.target.name);
            const whereSql = config.where
              ? sql` where ${config.where}`
              : undefined;
            this.config.onConflict = sql`(${sql.raw(
              targetColumn
            )}) do nothing${whereSql}`;
          }
          return this;
        }
        onConflictDoUpdate(config) {
          const whereSql = config.where
            ? sql` where ${config.where}`
            : undefined;
          const setSql = this.dialect.buildUpdateSet(
            this.config.table,
            mapUpdateSet(this.config.table, config.set)
          );
          let targetColumn = "";
          targetColumn = Array.isArray(config.target)
            ? config.target
                .map((it) => this.dialect.escapeName(it.name))
                .join(",")
            : this.dialect.escapeName(config.target.name);
          this.config.onConflict = sql`(${sql.raw(
            targetColumn
          )}) do update set ${setSql}${whereSql}`;
          return this;
        }
        /** @internal */
        getSQL() {
          return this.dialect.buildInsertQuery(this.config);
        }
        toSQL() {
          const { typings: _typings, ...rest } = this.dialect.sqlToQuery(
            this.getSQL()
          );
          return rest;
        }
        _prepare(name) {
          return tracer.startActiveSpan("drizzle.prepareQuery", () => {
            return this.session.prepareQuery(
              this.dialect.sqlToQuery(this.getSQL()),
              this.config.returning,
              name
            );
          });
        }
        prepare(name) {
          return this._prepare(name);
        }
      }
      _b$H = entityKind;
      PgInsert[_b$H] = "PgInsert";

      var _a$O, _b$G;
      class DrizzleError extends Error {
        constructor(message) {
          super(message);
          this.name = "DrizzleError";
        }
        static wrap(error, message) {
          return error instanceof Error // eslint-disable-line no-instanceof/no-instanceof
            ? new DrizzleError(
                message ? `${message}: ${error.message}` : error.message
              )
            : new DrizzleError(message ?? String(error));
        }
      }
      _a$O = entityKind;
      DrizzleError[_a$O] = "DrizzleError";
      class TransactionRollbackError extends DrizzleError {
        constructor() {
          super("Rollback");
        }
      }
      _b$G = entityKind;
      TransactionRollbackError[_b$G] = "TransactionRollbackError";

      var _a$N, _b$F, _c$c;
      /** @internal */
      const InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
      class PgTable extends Table {
        constructor() {
          super(...arguments);
          /**@internal */
          this[_b$F] = [];
          /** @internal */
          this[_c$c] = undefined;
        }
      }
      (_a$N = entityKind),
        (_b$F = InlineForeignKeys),
        (_c$c = Table.Symbol.ExtraConfigBuilder);
      PgTable[_a$N] = "PgTable";
      /** @internal */
      PgTable.Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys: InlineForeignKeys,
      });
      /** @internal */
      function pgTableWithSchema(
        name,
        columns,
        extraConfig,
        schema,
        baseName = name
      ) {
        const rawTable = new PgTable(name, schema, baseName);
        const builtColumns = Object.fromEntries(
          Object.entries(columns).map(([name, colBuilderBase]) => {
            const colBuilder = colBuilderBase;
            const column = colBuilder.build(rawTable);
            rawTable[InlineForeignKeys].push(
              ...colBuilder.buildForeignKeys(column, rawTable)
            );
            return [name, column];
          })
        );
        const table = Object.assign(rawTable, builtColumns);
        table[Table.Symbol.Columns] = builtColumns;
        if (extraConfig) {
          table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
        }
        return table;
      }
      const pgTable = (name, columns, extraConfig) => {
        return pgTableWithSchema(name, columns, extraConfig, undefined);
      };
      function pgTableCreator(customizeTableName) {
        return (name, columns, extraConfig) => {
          return pgTableWithSchema(
            customizeTableName(name),
            columns,
            extraConfig,
            undefined,
            name
          );
        };
      }

      var _a$M, _b$E;
      class CheckBuilder {
        constructor(name, value) {
          this.name = name;
          this.value = value;
        }
        /** @internal */
        build(table) {
          return new Check(table, this);
        }
      }
      _a$M = entityKind;
      CheckBuilder[_a$M] = "PgCheckBuilder";
      class Check {
        constructor(table, builder) {
          this.table = table;
          this.name = builder.name;
          this.value = builder.value;
        }
      }
      _b$E = entityKind;
      Check[_b$E] = "PgCheck";
      function check(name, value) {
        return new CheckBuilder(name, value);
      }

      var _a$L, _b$D;
      class ForeignKeyBuilder {
        constructor(config, actions) {
          /** @internal */
          this._onUpdate = "no action";
          /** @internal */
          this._onDelete = "no action";
          this.reference = () => {
            const { columns, foreignColumns } = config();
            return {
              columns,
              foreignTable: foreignColumns[0].table,
              foreignColumns,
            };
          };
          if (actions) {
            this._onUpdate = actions.onUpdate;
            this._onDelete = actions.onDelete;
          }
        }
        onUpdate(action) {
          this._onUpdate = action === undefined ? "no action" : action;
          return this;
        }
        onDelete(action) {
          this._onDelete = action === undefined ? "no action" : action;
          return this;
        }
        /** @internal */
        build(table) {
          return new ForeignKey(table, this);
        }
      }
      _a$L = entityKind;
      ForeignKeyBuilder[_a$L] = "PgForeignKeyBuilder";
      class ForeignKey {
        constructor(table, builder) {
          this.table = table;
          this.reference = builder.reference;
          this.onUpdate = builder._onUpdate;
          this.onDelete = builder._onDelete;
        }
        getName() {
          const { columns, foreignColumns } = this.reference();
          const columnNames = columns.map((column) => column.name);
          const foreignColumnNames = foreignColumns.map(
            (column) => column.name
          );
          const chunks = [
            this.table[PgTable.Symbol.Name],
            ...columnNames,
            foreignColumns[0].table[PgTable.Symbol.Name],
            ...foreignColumnNames,
          ];
          return `${chunks.join("_")}_fk`;
        }
      }
      _b$D = entityKind;
      ForeignKey[_b$D] = "PgForeignKey";
      function foreignKey(config) {
        function mappedConfig() {
          const { columns, foreignColumns } = config;
          return {
            columns,
            foreignColumns,
          };
        }
        return new ForeignKeyBuilder(mappedConfig);
      }

      var _a$K, _b$C, _c$b;
      class IndexBuilderOn {
        constructor(unique, name) {
          this.unique = unique;
          this.name = name;
        }
        on(...columns) {
          return new IndexBuilder(columns, this.unique, false, this.name);
        }
        onOnly(...columns) {
          return new IndexBuilder(columns, this.unique, true, this.name);
        }
      }
      _a$K = entityKind;
      IndexBuilderOn[_a$K] = "PgIndexBuilderOn";
      class IndexBuilder {
        constructor(columns, unique, only, name) {
          this.config = {
            name,
            columns,
            unique,
            only,
          };
        }
        concurrently() {
          this.config.concurrently = true;
          return this;
        }
        using(method) {
          this.config.using = method;
          return this;
        }
        asc() {
          this.config.order = "asc";
          return this;
        }
        desc() {
          this.config.order = "desc";
          return this;
        }
        nullsFirst() {
          this.config.nulls = "first";
          return this;
        }
        nullsLast() {
          this.config.nulls = "last";
          return this;
        }
        where(condition) {
          this.config.where = condition;
          return this;
        }
        /** @internal */
        build(table) {
          return new Index(this.config, table);
        }
      }
      _b$C = entityKind;
      IndexBuilder[_b$C] = "PgIndexBuilder";
      class Index {
        constructor(config, table) {
          this.config = { ...config, table };
        }
      }
      _c$b = entityKind;
      Index[_c$b] = "PgIndex";
      function index(name) {
        return new IndexBuilderOn(false, name);
      }
      function uniqueIndex(name) {
        return new IndexBuilderOn(true, name);
      }

      var _a$J, _b$B;
      function primaryKey(...columns) {
        return new PrimaryKeyBuilder(columns);
      }
      class PrimaryKeyBuilder {
        constructor(columns) {
          this.columns = columns;
        }
        /** @internal */
        build(table) {
          return new PrimaryKey(table, this.columns);
        }
      }
      _a$J = entityKind;
      PrimaryKeyBuilder[_a$J] = "PgPrimaryKeyBuilder";
      class PrimaryKey {
        constructor(table, columns) {
          this.table = table;
          this.columns = columns;
        }
        getName() {
          return `${this.table[PgTable.Symbol.Name]}_${this.columns
            .map((column) => column.name)
            .join("_")}_pk`;
        }
      }
      _b$B = entityKind;
      PrimaryKey[_b$B] = "PgPrimaryKey";

      var _a$I, _b$A, _c$a;
      function unique(name) {
        return new UniqueOnConstraintBuilder(name);
      }
      function uniqueKeyName(table, columns) {
        return `${table[PgTable.Symbol.Name]}_${columns.join("_")}_unique`;
      }
      class UniqueConstraintBuilder {
        constructor(columns, name) {
          this.name = name;
          /** @internal */
          this.nullsNotDistinctConfig = false;
          this.columns = columns;
        }
        nullsNotDistinct() {
          this.nullsNotDistinctConfig = true;
          return this;
        }
        /** @internal */
        build(table) {
          return new UniqueConstraint(
            table,
            this.columns,
            this.nullsNotDistinctConfig,
            this.name
          );
        }
      }
      _a$I = entityKind;
      UniqueConstraintBuilder[_a$I] = "PgUniqueConstraintBuilder";
      class UniqueOnConstraintBuilder {
        constructor(name) {
          this.name = name;
        }
        on(...columns) {
          return new UniqueConstraintBuilder(columns, this.name);
        }
      }
      _b$A = entityKind;
      UniqueOnConstraintBuilder[_b$A] = "PgUniqueOnConstraintBuilder";
      class UniqueConstraint {
        constructor(table, columns, nullsNotDistinct, name) {
          this.table = table;
          this.nullsNotDistinct = false;
          this.columns = columns;
          this.name =
            name ??
            uniqueKeyName(
              this.table,
              this.columns.map((column) => column.name)
            );
          this.nullsNotDistinct = nullsNotDistinct;
        }
        getName() {
          return this.name;
        }
      }
      _c$a = entityKind;
      UniqueConstraint[_c$a] = "PgUniqueConstraint";

      function getTableConfig(table) {
        const columns = Object.values(table[Table.Symbol.Columns]);
        const indexes = [];
        const checks = [];
        const primaryKeys = [];
        const foreignKeys = Object.values(
          table[PgTable.Symbol.InlineForeignKeys]
        );
        const uniqueConstraints = [];
        const name = table[Table.Symbol.Name];
        const schema = table[Table.Symbol.Schema];
        const extraConfigBuilder = table[PgTable.Symbol.ExtraConfigBuilder];
        if (extraConfigBuilder !== undefined) {
          const extraConfig = extraConfigBuilder(table[Table.Symbol.Columns]);
          for (const builder of Object.values(extraConfig)) {
            if (is(builder, IndexBuilder)) {
              indexes.push(builder.build(table));
            } else if (is(builder, CheckBuilder)) {
              checks.push(builder.build(table));
            } else if (is(builder, UniqueConstraintBuilder)) {
              uniqueConstraints.push(builder.build(table));
            } else if (is(builder, PrimaryKeyBuilder)) {
              primaryKeys.push(builder.build(table));
            } else if (is(builder, ForeignKeyBuilder)) {
              foreignKeys.push(builder.build(table));
            }
          }
        }
        return {
          columns,
          indexes,
          foreignKeys,
          checks,
          primaryKeys,
          uniqueConstraints,
          name,
          schema,
        };
      }
      function getViewConfig(view) {
        return {
          ...view[ViewBaseConfig],
          ...view[PgViewConfig],
        };
      }
      function getMaterializedViewConfig(view) {
        return {
          ...view[ViewBaseConfig],
          ...view[PgMaterializedViewConfig],
        };
      }
      function parsePgArrayValue(arrayString, startFrom, inQuotes) {
        for (let i = startFrom; i < arrayString.length; i++) {
          const char = arrayString[i];
          if (char === "\\") {
            i++;
            continue;
          }
          if (char === '"') {
            return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
          }
          if (inQuotes) {
            continue;
          }
          if (char === "," || char === "}") {
            return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
          }
        }
        return [
          arrayString.slice(startFrom).replace(/\\/g, ""),
          arrayString.length,
        ];
      }
      function parsePgNestedArray(arrayString, startFrom = 0) {
        const result = [];
        let i = startFrom;
        let lastCharIsComma = false;
        while (i < arrayString.length) {
          const char = arrayString[i];
          if (char === ",") {
            if (lastCharIsComma || i === startFrom) {
              result.push("");
            }
            lastCharIsComma = true;
            i++;
            continue;
          }
          lastCharIsComma = false;
          if (char === "\\") {
            i += 2;
            continue;
          }
          if (char === '"') {
            const [value, startFrom] = parsePgArrayValue(
              arrayString,
              i + 1,
              true
            );
            result.push(value);
            i = startFrom;
            continue;
          }
          if (char === "}") {
            return [result, i + 1];
          }
          if (char === "{") {
            const [value, startFrom] = parsePgNestedArray(arrayString, i + 1);
            result.push(value);
            i = startFrom;
            continue;
          }
          const [value, newStartFrom] = parsePgArrayValue(
            arrayString,
            i,
            false
          );
          result.push(value);
          i = newStartFrom;
        }
        return [result, i];
      }
      function parsePgArray(arrayString) {
        const [result] = parsePgNestedArray(arrayString, 1);
        return result;
      }
      function makePgArray(array) {
        return `{${array
          .map((item) => {
            if (Array.isArray(item)) {
              return makePgArray(item);
            }
            if (typeof item === "string" && item.includes(",")) {
              return `"${item.replace(/"/g, '\\"')}"`;
            }
            return `${item}`;
          })
          .join(",")}}`;
      }

      var _a$H;
      // To understand how to use `ColumnBuilder` and `AnyColumnBuilder`, see `Column` and `AnyColumn` documentation.
      class ColumnBuilder {
        constructor(name, dataType, columnType) {
          /**
           * Alias for {@link $defaultFn}.
           */
          this.$default = this.$defaultFn;
          this.config = {
            name,
            notNull: false,
            default: undefined,
            hasDefault: false,
            primaryKey: false,
            isUnique: false,
            uniqueName: undefined,
            uniqueType: undefined,
            dataType,
            columnType,
          };
        }
        /**
         * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
         *
         * @example
         * ```ts
         * const users = pgTable('users', {
         * 	id: integer('id').$type<UserId>().primaryKey(),
         * 	details: json('details').$type<UserDetails>().notNull(),
         * });
         * ```
         */
        $type() {
          return this;
        }
        /**
         * Adds a `not null` clause to the column definition.
         *
         * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
         */
        notNull() {
          this.config.notNull = true;
          return this;
        }
        /**
         * Adds a `default <value>` clause to the column definition.
         *
         * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
         *
         * If you need to set a dynamic default value, use {@link $defaultFn} instead.
         */
        default(value) {
          this.config.default = value;
          this.config.hasDefault = true;
          return this;
        }
        /**
         * Adds a dynamic default value to the column.
         * The function will be called when the row is inserted, and the returned value will be used as the column value.
         *
         * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
         */
        $defaultFn(fn) {
          this.config.defaultFn = fn;
          this.config.hasDefault = true;
          return this;
        }
        /**
         * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
         *
         * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
         */
        primaryKey() {
          this.config.primaryKey = true;
          this.config.notNull = true;
          return this;
        }
      }
      _a$H = entityKind;
      ColumnBuilder[_a$H] = "ColumnBuilder";

      var _a$G, _b$z;
      class PgColumnBuilder extends ColumnBuilder {
        constructor() {
          super(...arguments);
          this.foreignKeyConfigs = [];
        }
        array(size) {
          return new PgArrayBuilder(this.config.name, this, size);
        }
        references(ref, actions = {}) {
          this.foreignKeyConfigs.push({ ref, actions });
          return this;
        }
        unique(name, config) {
          this.config.isUnique = true;
          this.config.uniqueName = name;
          this.config.uniqueType = config?.nulls;
          return this;
        }
        /** @internal */
        buildForeignKeys(column, table) {
          return this.foreignKeyConfigs.map(({ ref, actions }) => {
            return iife(
              (ref, actions) => {
                const builder = new ForeignKeyBuilder(() => {
                  const foreignColumn = ref();
                  return { columns: [column], foreignColumns: [foreignColumn] };
                });
                if (actions.onUpdate) {
                  builder.onUpdate(actions.onUpdate);
                }
                if (actions.onDelete) {
                  builder.onDelete(actions.onDelete);
                }
                return builder.build(table);
              },
              ref,
              actions
            );
          });
        }
      }
      _a$G = entityKind;
      PgColumnBuilder[_a$G] = "PgColumnBuilder";
      // To understand how to use `PgColumn` and `PgColumn`, see `Column` and `AnyColumn` documentation.
      class PgColumn extends Column {
        constructor(table, config) {
          if (!config.uniqueName) {
            config.uniqueName = uniqueKeyName(table, [config.name]);
          }
          super(table, config);
          this.table = table;
        }
      }
      _b$z = entityKind;
      PgColumn[_b$z] = "PgColumn";

      var _a$F, _b$y;
      class PgArrayBuilder extends PgColumnBuilder {
        constructor(name, baseBuilder, size) {
          super(name, "array", "PgArray");
          this.config.baseBuilder = baseBuilder;
          this.config.size = size;
        }
        /** @internal */
        build(table) {
          const baseColumn = this.config.baseBuilder.build(table);
          return new PgArray(table, this.config, baseColumn);
        }
      }
      _a$F = entityKind;
      PgArrayBuilder[_a$F] = "PgArrayBuilder";
      class PgArray extends PgColumn {
        constructor(table, config, baseColumn, range) {
          super(table, config);
          this.baseColumn = baseColumn;
          this.range = range;
          this.size = config.size;
        }
        getSQLType() {
          return `${this.baseColumn.getSQLType()}[${
            typeof this.size === "number" ? this.size : ""
          }]`;
        }
        mapFromDriverValue(value) {
          if (typeof value === "string") {
            // Thank you node-postgres for not parsing enum arrays
            value = parsePgArray(value);
          }
          return value.map((v) => this.baseColumn.mapFromDriverValue(v));
        }
        mapToDriverValue(value, isNestedArray = false) {
          const a = value.map((v) =>
            v === null
              ? null
              : is(this.baseColumn, PgArray)
                ? this.baseColumn.mapToDriverValue(v, true)
                : this.baseColumn.mapToDriverValue(v)
          );
          if (isNestedArray) return a;
          return makePgArray(a);
        }
      }
      _b$y = entityKind;
      PgArray[_b$y] = "PgArray";

      var _a$E, _b$x, _c$9, _d$6;
      class PgBigInt53Builder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgBigInt53");
        }
        /** @internal */
        build(table) {
          return new PgBigInt53(table, this.config);
        }
      }
      _a$E = entityKind;
      PgBigInt53Builder[_a$E] = "PgBigInt53Builder";
      class PgBigInt53 extends PgColumn {
        getSQLType() {
          return "bigint";
        }
        mapFromDriverValue(value) {
          if (typeof value === "number") {
            return value;
          }
          return Number(value);
        }
      }
      _b$x = entityKind;
      PgBigInt53[_b$x] = "PgBigInt53";
      class PgBigInt64Builder extends PgColumnBuilder {
        constructor(name) {
          super(name, "bigint", "PgBigInt64");
        }
        /** @internal */
        build(table) {
          return new PgBigInt64(table, this.config);
        }
      }
      _c$9 = entityKind;
      PgBigInt64Builder[_c$9] = "PgBigInt64Builder";
      class PgBigInt64 extends PgColumn {
        getSQLType() {
          return "bigint";
        }
        // eslint-disable-next-line unicorn/prefer-native-coercion-functions
        mapFromDriverValue(value) {
          return BigInt(value);
        }
      }
      _d$6 = entityKind;
      PgBigInt64[_d$6] = "PgBigInt64";
      function bigint(name, config) {
        if (config.mode === "number") {
          return new PgBigInt53Builder(name);
        }
        return new PgBigInt64Builder(name);
      }

      var _a$D, _b$w, _c$8, _d$5;
      class PgBigSerial53Builder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgBigSerial53");
          this.config.hasDefault = true;
          this.config.notNull = true;
        }
        /** @internal */
        build(table) {
          return new PgBigSerial53(table, this.config);
        }
      }
      _a$D = entityKind;
      PgBigSerial53Builder[_a$D] = "PgBigSerial53Builder";
      class PgBigSerial53 extends PgColumn {
        getSQLType() {
          return "bigserial";
        }
        mapFromDriverValue(value) {
          if (typeof value === "number") {
            return value;
          }
          return Number(value);
        }
      }
      _b$w = entityKind;
      PgBigSerial53[_b$w] = "PgBigSerial53";
      class PgBigSerial64Builder extends PgColumnBuilder {
        constructor(name) {
          super(name, "bigint", "PgBigSerial64");
          this.config.hasDefault = true;
        }
        /** @internal */
        build(table) {
          return new PgBigSerial64(table, this.config);
        }
      }
      _c$8 = entityKind;
      PgBigSerial64Builder[_c$8] = "PgBigSerial64Builder";
      class PgBigSerial64 extends PgColumn {
        getSQLType() {
          return "bigserial";
        }
        // eslint-disable-next-line unicorn/prefer-native-coercion-functions
        mapFromDriverValue(value) {
          return BigInt(value);
        }
      }
      _d$5 = entityKind;
      PgBigSerial64[_d$5] = "PgBigSerial64";
      function bigserial(name, { mode }) {
        if (mode === "number") {
          return new PgBigSerial53Builder(name);
        }
        return new PgBigSerial64Builder(name);
      }

      var _a$C, _b$v;
      class PgBooleanBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "boolean", "PgBoolean");
        }
        /** @internal */
        build(table) {
          return new PgBoolean(table, this.config);
        }
      }
      _a$C = entityKind;
      PgBooleanBuilder[_a$C] = "PgBooleanBuilder";
      class PgBoolean extends PgColumn {
        getSQLType() {
          return "boolean";
        }
      }
      _b$v = entityKind;
      PgBoolean[_b$v] = "PgBoolean";
      function boolean(name) {
        return new PgBooleanBuilder(name);
      }

      var _a$B, _b$u;
      class PgCharBuilder extends PgColumnBuilder {
        constructor(name, config) {
          super(name, "string", "PgChar");
          this.config.length = config.length;
          this.config.enumValues = config.enum;
        }
        /** @internal */
        build(table) {
          return new PgChar(table, this.config);
        }
      }
      _a$B = entityKind;
      PgCharBuilder[_a$B] = "PgCharBuilder";
      class PgChar extends PgColumn {
        constructor() {
          super(...arguments);
          this.length = this.config.length;
          this.enumValues = this.config.enumValues;
        }
        getSQLType() {
          return this.length === undefined ? `char` : `char(${this.length})`;
        }
      }
      _b$u = entityKind;
      PgChar[_b$u] = "PgChar";
      function char(name, config = {}) {
        return new PgCharBuilder(name, config);
      }

      var _a$A, _b$t;
      class PgCidrBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "string", "PgCidr");
        }
        /** @internal */
        build(table) {
          return new PgCidr(table, this.config);
        }
      }
      _a$A = entityKind;
      PgCidrBuilder[_a$A] = "PgCidrBuilder";
      class PgCidr extends PgColumn {
        getSQLType() {
          return "cidr";
        }
      }
      _b$t = entityKind;
      PgCidr[_b$t] = "PgCidr";
      function cidr(name) {
        return new PgCidrBuilder(name);
      }

      var _a$z, _b$s;
      class PgCustomColumnBuilder extends PgColumnBuilder {
        constructor(name, fieldConfig, customTypeParams) {
          super(name, "custom", "PgCustomColumn");
          this.config.fieldConfig = fieldConfig;
          this.config.customTypeParams = customTypeParams;
        }
        /** @internal */
        build(table) {
          return new PgCustomColumn(table, this.config);
        }
      }
      _a$z = entityKind;
      PgCustomColumnBuilder[_a$z] = "PgCustomColumnBuilder";
      class PgCustomColumn extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
          this.mapTo = config.customTypeParams.toDriver;
          this.mapFrom = config.customTypeParams.fromDriver;
        }
        getSQLType() {
          return this.sqlName;
        }
        mapFromDriverValue(value) {
          return typeof this.mapFrom === "function"
            ? this.mapFrom(value)
            : value;
        }
        mapToDriverValue(value) {
          return typeof this.mapTo === "function" ? this.mapTo(value) : value;
        }
      }
      _b$s = entityKind;
      PgCustomColumn[_b$s] = "PgCustomColumn";
      /**
       * Custom pg database data type generator
       */
      function customType(customTypeParams) {
        return (dbName, fieldConfig) => {
          return new PgCustomColumnBuilder(
            dbName,
            fieldConfig,
            customTypeParams
          );
        };
      }

      var _a$y;
      class PgDateColumnBaseBuilder extends PgColumnBuilder {
        defaultNow() {
          return this.default(sql`now()`);
        }
      }
      _a$y = entityKind;
      PgDateColumnBaseBuilder[_a$y] = "PgDateColumnBaseBuilder";

      var _a$x, _b$r, _c$7, _d$4;
      class PgDateBuilder extends PgDateColumnBaseBuilder {
        constructor(name) {
          super(name, "date", "PgDate");
        }
        /** @internal */
        build(table) {
          return new PgDate(table, this.config);
        }
      }
      _a$x = entityKind;
      PgDateBuilder[_a$x] = "PgDateBuilder";
      class PgDate extends PgColumn {
        getSQLType() {
          return "date";
        }
        mapFromDriverValue(value) {
          return new Date(value);
        }
        mapToDriverValue(value) {
          return value.toISOString();
        }
      }
      _b$r = entityKind;
      PgDate[_b$r] = "PgDate";
      class PgDateStringBuilder extends PgDateColumnBaseBuilder {
        constructor(name) {
          super(name, "string", "PgDateString");
        }
        /** @internal */
        build(table) {
          return new PgDateString(table, this.config);
        }
      }
      _c$7 = entityKind;
      PgDateStringBuilder[_c$7] = "PgDateStringBuilder";
      class PgDateString extends PgColumn {
        getSQLType() {
          return "date";
        }
      }
      _d$4 = entityKind;
      PgDateString[_d$4] = "PgDateString";
      function date(name, config) {
        if (config?.mode === "date") {
          return new PgDateBuilder(name);
        }
        return new PgDateStringBuilder(name);
      }

      var _a$w, _b$q;
      class PgDoublePrecisionBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgDoublePrecision");
        }
        /** @internal */
        build(table) {
          return new PgDoublePrecision(table, this.config);
        }
      }
      _a$w = entityKind;
      PgDoublePrecisionBuilder[_a$w] = "PgDoublePrecisionBuilder";
      class PgDoublePrecision extends PgColumn {
        getSQLType() {
          return "double precision";
        }
        mapFromDriverValue(value) {
          if (typeof value === "string") {
            return Number.parseFloat(value);
          }
          return value;
        }
      }
      _b$q = entityKind;
      PgDoublePrecision[_b$q] = "PgDoublePrecision";
      function doublePrecision(name) {
        return new PgDoublePrecisionBuilder(name);
      }

      var _a$v, _b$p;
      const isPgEnumSym = Symbol.for("drizzle:isPgEnum");
      function isPgEnum(obj) {
        return (
          !!obj &&
          typeof obj === "function" &&
          isPgEnumSym in obj &&
          obj[isPgEnumSym] === true
        );
      }
      class PgEnumColumnBuilder extends PgColumnBuilder {
        constructor(name, enumInstance) {
          super(name, "string", "PgEnumColumn");
          this.config.enum = enumInstance;
        }
        /** @internal */
        build(table) {
          return new PgEnumColumn(table, this.config);
        }
      }
      _a$v = entityKind;
      PgEnumColumnBuilder[_a$v] = "PgEnumColumnBuilder";
      class PgEnumColumn extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.enum = this.config.enum;
          this.enumValues = this.config.enum.enumValues;
          this.enum = config.enum;
        }
        getSQLType() {
          return this.enum.enumName;
        }
      }
      _b$p = entityKind;
      PgEnumColumn[_b$p] = "PgEnumColumn";
      // Gratitude to zod for the enum function types
      function pgEnum(enumName, values) {
        const enumInstance = Object.assign(
          (name) => new PgEnumColumnBuilder(name, enumInstance),
          {
            enumName,
            enumValues: values,
            [isPgEnumSym]: true,
          }
        );
        return enumInstance;
      }

      var _a$u, _b$o;
      class PgInetBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "string", "PgInet");
        }
        /** @internal */
        build(table) {
          return new PgInet(table, this.config);
        }
      }
      _a$u = entityKind;
      PgInetBuilder[_a$u] = "PgInetBuilder";
      class PgInet extends PgColumn {
        getSQLType() {
          return "inet";
        }
      }
      _b$o = entityKind;
      PgInet[_b$o] = "PgInet";
      function inet(name) {
        return new PgInetBuilder(name);
      }

      var _a$t, _b$n;
      class PgIntegerBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgInteger");
        }
        /** @internal */
        build(table) {
          return new PgInteger(table, this.config);
        }
      }
      _a$t = entityKind;
      PgIntegerBuilder[_a$t] = "PgIntegerBuilder";
      class PgInteger extends PgColumn {
        getSQLType() {
          return "integer";
        }
        mapFromDriverValue(value) {
          if (typeof value === "string") {
            return Number.parseInt(value);
          }
          return value;
        }
      }
      _b$n = entityKind;
      PgInteger[_b$n] = "PgInteger";
      function integer(name) {
        return new PgIntegerBuilder(name);
      }

      var _a$s, _b$m;
      class PgIntervalBuilder extends PgColumnBuilder {
        constructor(name, intervalConfig) {
          super(name, "string", "PgInterval");
          this.config.intervalConfig = intervalConfig;
        }
        /** @internal */
        build(table) {
          return new PgInterval(table, this.config);
        }
      }
      _a$s = entityKind;
      PgIntervalBuilder[_a$s] = "PgIntervalBuilder";
      class PgInterval extends PgColumn {
        constructor() {
          super(...arguments);
          this.fields = this.config.intervalConfig.fields;
          this.precision = this.config.intervalConfig.precision;
        }
        getSQLType() {
          const fields = this.fields ? ` ${this.fields}` : "";
          const precision = this.precision ? `(${this.precision})` : "";
          return `interval${fields}${precision}`;
        }
      }
      _b$m = entityKind;
      PgInterval[_b$m] = "PgInterval";
      function interval(name, config = {}) {
        return new PgIntervalBuilder(name, config);
      }

      var _a$r, _b$l;
      class PgJsonBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "json", "PgJson");
        }
        /** @internal */
        build(table) {
          return new PgJson(table, this.config);
        }
      }
      _a$r = entityKind;
      PgJsonBuilder[_a$r] = "PgJsonBuilder";
      class PgJson extends PgColumn {
        constructor(table, config) {
          super(table, config);
        }
        getSQLType() {
          return "json";
        }
        mapToDriverValue(value) {
          return JSON.stringify(value);
        }
        mapFromDriverValue(value) {
          if (typeof value === "string") {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        }
      }
      _b$l = entityKind;
      PgJson[_b$l] = "PgJson";
      function json(name) {
        return new PgJsonBuilder(name);
      }

      var _a$q, _b$k;
      class PgJsonbBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "json", "PgJsonb");
        }
        /** @internal */
        build(table) {
          return new PgJsonb(table, this.config);
        }
      }
      _a$q = entityKind;
      PgJsonbBuilder[_a$q] = "PgJsonbBuilder";
      class PgJsonb extends PgColumn {
        constructor(table, config) {
          super(table, config);
        }
        getSQLType() {
          return "jsonb";
        }
        mapToDriverValue(value) {
          return JSON.stringify(value);
        }
        mapFromDriverValue(value) {
          if (typeof value === "string") {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        }
      }
      _b$k = entityKind;
      PgJsonb[_b$k] = "PgJsonb";
      function jsonb(name) {
        return new PgJsonbBuilder(name);
      }

      var _a$p, _b$j;
      class PgMacaddrBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "string", "PgMacaddr");
        }
        /** @internal */
        build(table) {
          return new PgMacaddr(table, this.config);
        }
      }
      _a$p = entityKind;
      PgMacaddrBuilder[_a$p] = "PgMacaddrBuilder";
      class PgMacaddr extends PgColumn {
        getSQLType() {
          return "macaddr";
        }
      }
      _b$j = entityKind;
      PgMacaddr[_b$j] = "PgMacaddr";
      function macaddr(name) {
        return new PgMacaddrBuilder(name);
      }

      var _a$o, _b$i;
      class PgMacaddr8Builder extends PgColumnBuilder {
        constructor(name) {
          super(name, "string", "PgMacaddr8");
        }
        /** @internal */
        build(table) {
          return new PgMacaddr8(table, this.config);
        }
      }
      _a$o = entityKind;
      PgMacaddr8Builder[_a$o] = "PgMacaddr8Builder";
      class PgMacaddr8 extends PgColumn {
        getSQLType() {
          return "macaddr8";
        }
      }
      _b$i = entityKind;
      PgMacaddr8[_b$i] = "PgMacaddr8";
      function macaddr8(name) {
        return new PgMacaddr8Builder(name);
      }

      var _a$n, _b$h;
      class PgNumericBuilder extends PgColumnBuilder {
        constructor(name, precision, scale) {
          super(name, "string", "PgNumeric");
          this.config.precision = precision;
          this.config.scale = scale;
        }
        /** @internal */
        build(table) {
          return new PgNumeric(table, this.config);
        }
      }
      _a$n = entityKind;
      PgNumericBuilder[_a$n] = "PgNumericBuilder";
      class PgNumeric extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.precision = config.precision;
          this.scale = config.scale;
        }
        getSQLType() {
          if (this.precision !== undefined && this.scale !== undefined) {
            return `numeric(${this.precision}, ${this.scale})`;
          } else if (this.precision === undefined) {
            return "numeric";
          } else {
            return `numeric(${this.precision})`;
          }
        }
      }
      _b$h = entityKind;
      PgNumeric[_b$h] = "PgNumeric";
      function numeric(name, config) {
        return new PgNumericBuilder(name, config?.precision, config?.scale);
      }
      const decimal = numeric;

      var _a$m, _b$g;
      class PgRealBuilder extends PgColumnBuilder {
        constructor(name, length) {
          super(name, "number", "PgReal");
          this.config.length = length;
        }
        /** @internal */
        build(table) {
          return new PgReal(table, this.config);
        }
      }
      _a$m = entityKind;
      PgRealBuilder[_a$m] = "PgRealBuilder";
      class PgReal extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.mapFromDriverValue = (value) => {
            if (typeof value === "string") {
              return Number.parseFloat(value);
            }
            return value;
          };
        }
        getSQLType() {
          return "real";
        }
      }
      _b$g = entityKind;
      PgReal[_b$g] = "PgReal";
      function real(name) {
        return new PgRealBuilder(name);
      }

      var _a$l, _b$f;
      class PgSerialBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgSerial");
          this.config.hasDefault = true;
          this.config.notNull = true;
        }
        /** @internal */
        build(table) {
          return new PgSerial(table, this.config);
        }
      }
      _a$l = entityKind;
      PgSerialBuilder[_a$l] = "PgSerialBuilder";
      class PgSerial extends PgColumn {
        getSQLType() {
          return "serial";
        }
      }
      _b$f = entityKind;
      PgSerial[_b$f] = "PgSerial";
      function serial(name) {
        return new PgSerialBuilder(name);
      }

      var _a$k, _b$e;
      class PgSmallIntBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgSmallInt");
        }
        /** @internal */
        build(table) {
          return new PgSmallInt(table, this.config);
        }
      }
      _a$k = entityKind;
      PgSmallIntBuilder[_a$k] = "PgSmallIntBuilder";
      class PgSmallInt extends PgColumn {
        constructor() {
          super(...arguments);
          this.mapFromDriverValue = (value) => {
            if (typeof value === "string") {
              return Number(value);
            }
            return value;
          };
        }
        getSQLType() {
          return "smallint";
        }
      }
      _b$e = entityKind;
      PgSmallInt[_b$e] = "PgSmallInt";
      function smallint(name) {
        return new PgSmallIntBuilder(name);
      }

      var _a$j, _b$d;
      class PgSmallSerialBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "number", "PgSmallSerial");
          this.config.hasDefault = true;
          this.config.notNull = true;
        }
        /** @internal */
        build(table) {
          return new PgSmallSerial(table, this.config);
        }
      }
      _a$j = entityKind;
      PgSmallSerialBuilder[_a$j] = "PgSmallSerialBuilder";
      class PgSmallSerial extends PgColumn {
        getSQLType() {
          return "smallserial";
        }
      }
      _b$d = entityKind;
      PgSmallSerial[_b$d] = "PgSmallSerial";
      function smallserial(name) {
        return new PgSmallSerialBuilder(name);
      }

      var _a$i, _b$c;
      class PgTextBuilder extends PgColumnBuilder {
        constructor(name, config) {
          super(name, "string", "PgText");
          this.config.enumValues = config.enum;
        }
        /** @internal */
        build(table) {
          return new PgText(table, this.config);
        }
      }
      _a$i = entityKind;
      PgTextBuilder[_a$i] = "PgTextBuilder";
      class PgText extends PgColumn {
        constructor() {
          super(...arguments);
          this.enumValues = this.config.enumValues;
        }
        getSQLType() {
          return "text";
        }
      }
      _b$c = entityKind;
      PgText[_b$c] = "PgText";
      function text(name, config = {}) {
        return new PgTextBuilder(name, config);
      }

      var _a$h, _b$b;
      class PgTimeBuilder extends PgDateColumnBaseBuilder {
        constructor(name, withTimezone, precision) {
          super(name, "string", "PgTime");
          this.withTimezone = withTimezone;
          this.precision = precision;
          this.config.withTimezone = withTimezone;
          this.config.precision = precision;
        }
        /** @internal */
        build(table) {
          return new PgTime(table, this.config);
        }
      }
      _a$h = entityKind;
      PgTimeBuilder[_a$h] = "PgTimeBuilder";
      class PgTime extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.withTimezone = config.withTimezone;
          this.precision = config.precision;
        }
        getSQLType() {
          const precision =
            this.precision === undefined ? "" : `(${this.precision})`;
          return `time${precision}${
            this.withTimezone ? " with time zone" : ""
          }`;
        }
      }
      _b$b = entityKind;
      PgTime[_b$b] = "PgTime";
      function time(name, config = {}) {
        return new PgTimeBuilder(
          name,
          config.withTimezone ?? false,
          config.precision
        );
      }

      var _a$g, _b$a, _c$6, _d$3;
      class PgTimestampBuilder extends PgDateColumnBaseBuilder {
        constructor(name, withTimezone, precision) {
          super(name, "date", "PgTimestamp");
          this.config.withTimezone = withTimezone;
          this.config.precision = precision;
        }
        /** @internal */
        build(table) {
          return new PgTimestamp(table, this.config);
        }
      }
      _a$g = entityKind;
      PgTimestampBuilder[_a$g] = "PgTimestampBuilder";
      class PgTimestamp extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.mapFromDriverValue = (value) => {
            return new Date(this.withTimezone ? value : value + "+0000");
          };
          this.mapToDriverValue = (value) => {
            return this.withTimezone
              ? value.toUTCString()
              : value.toISOString();
          };
          this.withTimezone = config.withTimezone;
          this.precision = config.precision;
        }
        getSQLType() {
          const precision =
            this.precision === undefined ? "" : ` (${this.precision})`;
          return `timestamp${precision}${
            this.withTimezone ? " with time zone" : ""
          }`;
        }
      }
      _b$a = entityKind;
      PgTimestamp[_b$a] = "PgTimestamp";
      class PgTimestampStringBuilder extends PgDateColumnBaseBuilder {
        constructor(name, withTimezone, precision) {
          super(name, "string", "PgTimestampString");
          this.config.withTimezone = withTimezone;
          this.config.precision = precision;
        }
        /** @internal */
        build(table) {
          return new PgTimestampString(table, this.config);
        }
      }
      _c$6 = entityKind;
      PgTimestampStringBuilder[_c$6] = "PgTimestampStringBuilder";
      class PgTimestampString extends PgColumn {
        constructor(table, config) {
          super(table, config);
          this.withTimezone = config.withTimezone;
          this.precision = config.precision;
        }
        getSQLType() {
          const precision =
            this.precision === undefined ? "" : `(${this.precision})`;
          return `timestamp${precision}${
            this.withTimezone ? " with time zone" : ""
          }`;
        }
      }
      _d$3 = entityKind;
      PgTimestampString[_d$3] = "PgTimestampString";
      function timestamp(name, config = {}) {
        if (config.mode === "string") {
          return new PgTimestampStringBuilder(
            name,
            config.withTimezone ?? false,
            config.precision
          );
        }
        return new PgTimestampBuilder(
          name,
          config.withTimezone ?? false,
          config.precision
        );
      }

      var _a$f, _b$9;
      class PgUUIDBuilder extends PgColumnBuilder {
        constructor(name) {
          super(name, "string", "PgUUID");
        }
        /**
         * Adds `default gen_random_uuid()` to the column definition.
         */
        defaultRandom() {
          return this.default(sql`gen_random_uuid()`);
        }
        /** @internal */
        build(table) {
          return new PgUUID(table, this.config);
        }
      }
      _a$f = entityKind;
      PgUUIDBuilder[_a$f] = "PgUUIDBuilder";
      class PgUUID extends PgColumn {
        getSQLType() {
          return "uuid";
        }
      }
      _b$9 = entityKind;
      PgUUID[_b$9] = "PgUUID";
      function uuid(name) {
        return new PgUUIDBuilder(name);
      }

      var _a$e, _b$8;
      class PgVarcharBuilder extends PgColumnBuilder {
        constructor(name, config) {
          super(name, "string", "PgVarchar");
          this.config.length = config.length;
          this.config.enumValues = config.enum;
        }
        /** @internal */
        build(table) {
          return new PgVarchar(table, this.config);
        }
      }
      _a$e = entityKind;
      PgVarcharBuilder[_a$e] = "PgVarcharBuilder";
      class PgVarchar extends PgColumn {
        constructor() {
          super(...arguments);
          this.length = this.config.length;
          this.enumValues = this.config.enumValues;
        }
        getSQLType() {
          return this.length === undefined
            ? `varchar`
            : `varchar(${this.length})`;
        }
      }
      _b$8 = entityKind;
      PgVarchar[_b$8] = "PgVarchar";
      function varchar(name, config = {}) {
        return new PgVarcharBuilder(name, config);
      }

      var _a$d;
      class PgDialect {
        async migrate(migrations, session) {
          const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
          await session.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
          await session.execute(migrationTableCreate);
          const dbMigrations = await session.all(
            sql`select id, hash, created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1`
          );
          const lastDbMigration = dbMigrations[0];
          await session.transaction(async (tx) => {
            for await (const migration of migrations) {
              if (
                !lastDbMigration ||
                Number(lastDbMigration.created_at) < migration.folderMillis
              ) {
                for (const stmt of migration.sql) {
                  await tx.execute(sql.raw(stmt));
                }
                await tx.execute(
                  sql`insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
                );
              }
            }
          });
        }
        escapeName(name) {
          return `"${name}"`;
        }
        escapeParam(num) {
          return `$${num + 1}`;
        }
        escapeString(str) {
          return `'${str.replace(/'/g, "''")}'`;
        }
        buildDeleteQuery({ table, where, returning }) {
          const returningSql = returning
            ? sql` returning ${this.buildSelection(returning, {
                isSingleTable: true,
              })}`
            : undefined;
          const whereSql = where ? sql` where ${where}` : undefined;
          return sql`delete from ${table}${whereSql}${returningSql}`;
        }
        buildUpdateSet(table, set) {
          const setEntries = Object.entries(set);
          const setSize = setEntries.length;
          return sql.join(
            setEntries.flatMap(([colName, value], i) => {
              const col = table[Table.Symbol.Columns][colName];
              const res = sql`${sql.identifier(col.name)} = ${value}`;
              if (i < setSize - 1) {
                return [res, sql.raw(", ")];
              }
              return [res];
            })
          );
        }
        buildUpdateQuery({ table, set, where, returning }) {
          const setSql = this.buildUpdateSet(table, set);
          const returningSql = returning
            ? sql` returning ${this.buildSelection(returning, {
                isSingleTable: true,
              })}`
            : undefined;
          const whereSql = where ? sql` where ${where}` : undefined;
          return sql`update ${table} set ${setSql}${whereSql}${returningSql}`;
        }
        /**
         * Builds selection SQL with provided fields/expressions
         *
         * Examples:
         *
         * `select <selection> from`
         *
         * `insert ... returning <selection>`
         *
         * If `isSingleTable` is true, then columns won't be prefixed with table name
         */
        buildSelection(fields, { isSingleTable = false } = {}) {
          const columnsLen = fields.length;
          const chunks = fields.flatMap(({ field }, i) => {
            const chunk = [];
            if (is(field, SQL.Aliased) && field.isSelectionField) {
              chunk.push(sql.identifier(field.fieldAlias));
            } else if (is(field, SQL.Aliased) || is(field, SQL)) {
              const query = is(field, SQL.Aliased) ? field.sql : field;
              if (isSingleTable) {
                chunk.push(
                  new SQL(
                    query.queryChunks.map((c) => {
                      if (is(c, PgColumn)) {
                        return sql.identifier(c.name);
                      }
                      return c;
                    })
                  )
                );
              } else {
                chunk.push(query);
              }
              if (is(field, SQL.Aliased)) {
                chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
              }
            } else if (is(field, Column)) {
              if (isSingleTable) {
                chunk.push(sql.identifier(field.name));
              } else {
                chunk.push(field);
              }
            }
            if (i < columnsLen - 1) {
              chunk.push(sql`, `);
            }
            return chunk;
          });
          return sql.join(chunks);
        }
        buildSelectQuery({
          withList,
          fields,
          fieldsFlat,
          where,
          having,
          table,
          joins,
          orderBy,
          groupBy,
          limit,
          offset,
          lockingClauses,
          distinct,
        }) {
          const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
          for (const f of fieldsList) {
            if (
              is(f.field, Column) &&
              getTableName(f.field.table) !==
                (is(table, Subquery)
                  ? table[SubqueryConfig].alias
                  : is(table, PgViewBase)
                    ? table[ViewBaseConfig].name
                    : is(table, SQL)
                      ? undefined
                      : getTableName(table)) &&
              !((table) =>
                joins?.some(
                  ({ alias }) =>
                    alias ===
                    (table[Table.Symbol.IsAlias]
                      ? getTableName(table)
                      : table[Table.Symbol.BaseName])
                ))(f.field.table)
            ) {
              const tableName = getTableName(f.field.table);
              throw new Error(
                `Your "${f.path.join(
                  "->"
                )}" field references a column "${tableName}"."${
                  f.field.name
                }", but the table "${tableName}" is not part of the query! Did you forget to join it?`
              );
            }
          }
          const isSingleTable = !joins || joins.length === 0;
          let withSql;
          if (withList?.length) {
            const withSqlChunks = [sql`with `];
            for (const [i, w] of withList.entries()) {
              withSqlChunks.push(
                sql`${sql.identifier(w[SubqueryConfig].alias)} as (${
                  w[SubqueryConfig].sql
                })`
              );
              if (i < withList.length - 1) {
                withSqlChunks.push(sql`, `);
              }
            }
            withSqlChunks.push(sql` `);
            withSql = sql.join(withSqlChunks);
          }
          let distinctSql;
          if (distinct) {
            distinctSql =
              distinct === true
                ? sql` distinct`
                : sql` distinct on (${sql.join(distinct.on, ", ")})`;
          }
          const selection = this.buildSelection(fieldsList, { isSingleTable });
          const tableSql = (() => {
            if (
              is(table, Table) &&
              table[Table.Symbol.OriginalName] !== table[Table.Symbol.Name]
            ) {
              let fullName = sql`${sql.identifier(
                table[Table.Symbol.OriginalName]
              )}`;
              if (table[Table.Symbol.Schema]) {
                fullName = sql`${sql.identifier(
                  table[Table.Symbol.Schema]
                )}.${fullName}`;
              }
              return sql`${fullName} ${sql.identifier(
                table[Table.Symbol.Name]
              )}`;
            }
            return table;
          })();
          const joinsArray = [];
          if (joins) {
            for (const [index, joinMeta] of joins.entries()) {
              if (index === 0) {
                joinsArray.push(sql` `);
              }
              const table = joinMeta.table;
              const lateralSql = joinMeta.lateral ? sql` lateral` : undefined;
              if (is(table, PgTable)) {
                const tableName = table[PgTable.Symbol.Name];
                const tableSchema = table[PgTable.Symbol.Schema];
                const origTableName = table[PgTable.Symbol.OriginalName];
                const alias =
                  tableName === origTableName ? undefined : joinMeta.alias;
                joinsArray.push(
                  sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${
                    tableSchema
                      ? sql`${sql.identifier(tableSchema)}.`
                      : undefined
                  }${sql.identifier(origTableName)}${
                    alias && sql` ${sql.identifier(alias)}`
                  } on ${joinMeta.on}`
                );
              } else if (is(table, View)) {
                const viewName = table[ViewBaseConfig].name;
                const viewSchema = table[ViewBaseConfig].schema;
                const origViewName = table[ViewBaseConfig].originalName;
                const alias =
                  viewName === origViewName ? undefined : joinMeta.alias;
                joinsArray.push(
                  sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${
                    viewSchema ? sql`${sql.identifier(viewSchema)}.` : undefined
                  }${sql.identifier(origViewName)}${
                    alias && sql` ${sql.identifier(alias)}`
                  } on ${joinMeta.on}`
                );
              } else {
                joinsArray.push(
                  sql`${sql.raw(
                    joinMeta.joinType
                  )} join${lateralSql} ${table} on ${joinMeta.on}`
                );
              }
              if (index < joins.length - 1) {
                joinsArray.push(sql` `);
              }
            }
          }
          const joinsSql = sql.join(joinsArray);
          const whereSql = where ? sql` where ${where}` : undefined;
          const havingSql = having ? sql` having ${having}` : undefined;
          let orderBySql;
          if (orderBy && orderBy.length > 0) {
            orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
          }
          let groupBySql;
          if (groupBy && groupBy.length > 0) {
            groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
          }
          const limitSql = limit ? sql` limit ${limit}` : undefined;
          const offsetSql = offset ? sql` offset ${offset}` : undefined;
          const lockingClausesSql = sql.empty();
          if (lockingClauses) {
            for (const { strength, config } of lockingClauses) {
              const clauseSql = sql` for ${sql.raw(strength)}`;
              if (config.of) {
                clauseSql.append(sql` of ${config.of}`);
              }
              if (config.noWait) {
                clauseSql.append(sql` no wait`);
              } else if (config.skipLocked) {
                clauseSql.append(sql` skip locked`);
              }
              lockingClausesSql.append(clauseSql);
            }
          }
          return sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClausesSql}`;
        }
        buildInsertQuery({ table, values, onConflict, returning }) {
          const valuesSqlList = [];
          const columns = table[Table.Symbol.Columns];
          const colEntries = Object.entries(columns);
          const insertOrder = colEntries.map(([, column]) =>
            sql.identifier(column.name)
          );
          for (const [valueIndex, value] of values.entries()) {
            const valueList = [];
            for (const [fieldName, col] of colEntries) {
              const colValue = value[fieldName];
              if (
                colValue === undefined ||
                (is(colValue, Param) && colValue.value === undefined)
              ) {
                // eslint-disable-next-line unicorn/no-negated-condition
                if (col.defaultFn !== undefined) {
                  const defaultFnResult = col.defaultFn();
                  const defaultValue = is(defaultFnResult, SQL)
                    ? defaultFnResult
                    : sql.param(defaultFnResult, col);
                  valueList.push(defaultValue);
                } else {
                  valueList.push(sql`default`);
                }
              } else {
                valueList.push(colValue);
              }
            }
            valuesSqlList.push(valueList);
            if (valueIndex < values.length - 1) {
              valuesSqlList.push(sql`, `);
            }
          }
          const valuesSql = sql.join(valuesSqlList);
          const returningSql = returning
            ? sql` returning ${this.buildSelection(returning, {
                isSingleTable: true,
              })}`
            : undefined;
          const onConflictSql = onConflict
            ? sql` on conflict ${onConflict}`
            : undefined;
          return sql`insert into ${table} ${insertOrder} values ${valuesSql}${onConflictSql}${returningSql}`;
        }
        buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
          const concurrentlySql = concurrently ? sql` concurrently` : undefined;
          const withNoDataSql = withNoData ? sql` with no data` : undefined;
          return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
        }
        prepareTyping(encoder) {
          if (is(encoder, PgJsonb) || is(encoder, PgJson)) {
            return "json";
          } else if (is(encoder, PgNumeric)) {
            return "decimal";
          } else if (is(encoder, PgTime)) {
            return "time";
          } else if (is(encoder, PgTimestamp)) {
            return "timestamp";
          } else if (is(encoder, PgDate)) {
            return "date";
          } else if (is(encoder, PgUUID)) {
            return "uuid";
          } else {
            return "none";
          }
        }
        sqlToQuery(sql) {
          return sql.toQuery({
            escapeName: this.escapeName,
            escapeParam: this.escapeParam,
            escapeString: this.escapeString,
            prepareTyping: this.prepareTyping,
          });
        }
        // buildRelationalQueryWithPK({
        // 	fullSchema,
        // 	schema,
        // 	tableNamesMap,
        // 	table,
        // 	tableConfig,
        // 	queryConfig: config,
        // 	tableAlias,
        // 	isRoot = false,
        // 	joinOn,
        // }: {
        // 	fullSchema: Record<string, unknown>;
        // 	schema: TablesRelationalConfig;
        // 	tableNamesMap: Record<string, string>;
        // 	table: PgTable;
        // 	tableConfig: TableRelationalConfig;
        // 	queryConfig: true | DBQueryConfig<'many', true>;
        // 	tableAlias: string;
        // 	isRoot?: boolean;
        // 	joinOn?: SQL;
        // }): BuildRelationalQueryResult<PgTable, PgColumn> {
        // 	// For { "<relation>": true }, return a table with selection of all columns
        // 	if (config === true) {
        // 		const selectionEntries = Object.entries(tableConfig.columns);
        // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
        // 			[key, value],
        // 		) => ({
        // 			dbKey: value.name,
        // 			tsKey: key,
        // 			field: value as PgColumn,
        // 			relationTableTsKey: undefined,
        // 			isJson: false,
        // 			selection: [],
        // 		}));
        // 		return {
        // 			tableTsKey: tableConfig.tsName,
        // 			sql: table,
        // 			selection,
        // 		};
        // 	}
        // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
        // 	// let selectionForBuild = selection;
        // 	const aliasedColumns = Object.fromEntries(
        // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
        // 	);
        // 	const aliasedRelations = Object.fromEntries(
        // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
        // 	);
        // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
        // 	let where, hasUserDefinedWhere;
        // 	if (config.where) {
        // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
        // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
        // 		hasUserDefinedWhere = !!where;
        // 	}
        // 	where = and(joinOn, where);
        // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
        // 	let joins: Join[] = [];
        // 	let selectedColumns: string[] = [];
        // 	// Figure out which columns to select
        // 	if (config.columns) {
        // 		let isIncludeMode = false;
        // 		for (const [field, value] of Object.entries(config.columns)) {
        // 			if (value === undefined) {
        // 				continue;
        // 			}
        // 			if (field in tableConfig.columns) {
        // 				if (!isIncludeMode && value === true) {
        // 					isIncludeMode = true;
        // 				}
        // 				selectedColumns.push(field);
        // 			}
        // 		}
        // 		if (selectedColumns.length > 0) {
        // 			selectedColumns = isIncludeMode
        // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
        // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        // 		}
        // 	} else {
        // 		// Select all columns if selection is not specified
        // 		selectedColumns = Object.keys(tableConfig.columns);
        // 	}
        // 	// for (const field of selectedColumns) {
        // 	// 	const column = tableConfig.columns[field]! as PgColumn;
        // 	// 	fieldsSelection.push({ tsKey: field, value: column });
        // 	// }
        // 	let initiallySelectedRelations: {
        // 		tsKey: string;
        // 		queryConfig: true | DBQueryConfig<'many', false>;
        // 		relation: Relation;
        // 	}[] = [];
        // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
        // 	// Figure out which relations to select
        // 	if (config.with) {
        // 		initiallySelectedRelations = Object.entries(config.with)
        // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
        // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
        // 	}
        // 	const manyRelations = initiallySelectedRelations.filter((r) =>
        // 		is(r.relation, Many)
        // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
        // 	);
        // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
        // 	const isInnermostQuery = manyRelations.length < 2;
        // 	const selectedExtras: {
        // 		tsKey: string;
        // 		value: SQL.Aliased;
        // 	}[] = [];
        // 	// Figure out which extras to select
        // 	if (isInnermostQuery && config.extras) {
        // 		const extras = typeof config.extras === 'function'
        // 			? config.extras(aliasedFields, { sql })
        // 			: config.extras;
        // 		for (const [tsKey, value] of Object.entries(extras)) {
        // 			selectedExtras.push({
        // 				tsKey,
        // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
        // 			});
        // 		}
        // 	}
        // 	// Transform `fieldsSelection` into `selection`
        // 	// `fieldsSelection` shouldn't be used after this point
        // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
        // 	// 	selection.push({
        // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
        // 	// 		tsKey,
        // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
        // 	// 		relationTableTsKey: undefined,
        // 	// 		isJson: false,
        // 	// 		isExtra,
        // 	// 		selection: [],
        // 	// 	});
        // 	// }
        // 	let orderByOrig = typeof config.orderBy === 'function'
        // 		? config.orderBy(aliasedFields, orderByOperators)
        // 		: config.orderBy ?? [];
        // 	if (!Array.isArray(orderByOrig)) {
        // 		orderByOrig = [orderByOrig];
        // 	}
        // 	const orderBy = orderByOrig.map((orderByValue) => {
        // 		if (is(orderByValue, Column)) {
        // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
        // 		}
        // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
        // 	});
        // 	const limit = isInnermostQuery ? config.limit : undefined;
        // 	const offset = isInnermostQuery ? config.offset : undefined;
        // 	// For non-root queries without additional config except columns, return a table with selection
        // 	if (
        // 		!isRoot
        // 		&& initiallySelectedRelations.length === 0
        // 		&& selectedExtras.length === 0
        // 		&& !where
        // 		&& orderBy.length === 0
        // 		&& limit === undefined
        // 		&& offset === undefined
        // 	) {
        // 		return {
        // 			tableTsKey: tableConfig.tsName,
        // 			sql: table,
        // 			selection: selectedColumns.map((key) => ({
        // 				dbKey: tableConfig.columns[key]!.name,
        // 				tsKey: key,
        // 				field: tableConfig.columns[key] as PgColumn,
        // 				relationTableTsKey: undefined,
        // 				isJson: false,
        // 				selection: [],
        // 			})),
        // 		};
        // 	}
        // 	const selectedRelationsWithoutPK:
        // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
        // 	for (
        // 		const {
        // 			tsKey: selectedRelationTsKey,
        // 			queryConfig: selectedRelationConfigValue,
        // 			relation,
        // 		} of initiallySelectedRelations
        // 	) {
        // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
        // 		const relationTableTsName = tableNamesMap[relationTableName]!;
        // 		const relationTable = schema[relationTableTsName]!;
        // 		if (relationTable.primaryKey.length > 0) {
        // 			continue;
        // 		}
        // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        // 		const joinOn = and(
        // 			...normalizedRelation.fields.map((field, i) =>
        // 				eq(
        // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
        // 					aliasedTableColumn(field, tableAlias),
        // 				)
        // 			),
        // 		);
        // 		const builtRelation = this.buildRelationalQueryWithoutPK({
        // 			fullSchema,
        // 			schema,
        // 			tableNamesMap,
        // 			table: fullSchema[relationTableTsName] as PgTable,
        // 			tableConfig: schema[relationTableTsName]!,
        // 			queryConfig: selectedRelationConfigValue,
        // 			tableAlias: relationTableAlias,
        // 			joinOn,
        // 			nestedQueryRelation: relation,
        // 		});
        // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
        // 		joins.push({
        // 			on: sql`true`,
        // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
        // 			alias: relationTableAlias,
        // 			joinType: 'left',
        // 			lateral: true,
        // 		});
        // 		selectedRelations.push({
        // 			dbKey: selectedRelationTsKey,
        // 			tsKey: selectedRelationTsKey,
        // 			field,
        // 			relationTableTsKey: relationTableTsName,
        // 			isJson: true,
        // 			selection: builtRelation.selection,
        // 		});
        // 	}
        // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
        // 		is(r.relation, One)
        // 	);
        // 	// Process all One relations with PKs, because they can all be joined on the same level
        // 	for (
        // 		const {
        // 			tsKey: selectedRelationTsKey,
        // 			queryConfig: selectedRelationConfigValue,
        // 			relation,
        // 		} of oneRelations
        // 	) {
        // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
        // 		const relationTableTsName = tableNamesMap[relationTableName]!;
        // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        // 		const relationTable = schema[relationTableTsName]!;
        // 		if (relationTable.primaryKey.length === 0) {
        // 			continue;
        // 		}
        // 		const joinOn = and(
        // 			...normalizedRelation.fields.map((field, i) =>
        // 				eq(
        // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
        // 					aliasedTableColumn(field, tableAlias),
        // 				)
        // 			),
        // 		);
        // 		const builtRelation = this.buildRelationalQueryWithPK({
        // 			fullSchema,
        // 			schema,
        // 			tableNamesMap,
        // 			table: fullSchema[relationTableTsName] as PgTable,
        // 			tableConfig: schema[relationTableTsName]!,
        // 			queryConfig: selectedRelationConfigValue,
        // 			tableAlias: relationTableAlias,
        // 			joinOn,
        // 		});
        // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
        // 			sql.join(
        // 				builtRelation.selection.map(({ field }) =>
        // 					is(field, SQL.Aliased)
        // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
        // 						: is(field, Column)
        // 						? aliasedTableColumn(field, relationTableAlias)
        // 						: field
        // 				),
        // 				sql`, `,
        // 			)
        // 		}) end`.as(selectedRelationTsKey);
        // 		const isLateralJoin = is(builtRelation.sql, SQL);
        // 		joins.push({
        // 			on: isLateralJoin ? sql`true` : joinOn,
        // 			table: is(builtRelation.sql, SQL)
        // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
        // 				: aliasedTable(builtRelation.sql, relationTableAlias),
        // 			alias: relationTableAlias,
        // 			joinType: 'left',
        // 			lateral: is(builtRelation.sql, SQL),
        // 		});
        // 		selectedRelations.push({
        // 			dbKey: selectedRelationTsKey,
        // 			tsKey: selectedRelationTsKey,
        // 			field,
        // 			relationTableTsKey: relationTableTsName,
        // 			isJson: true,
        // 			selection: builtRelation.selection,
        // 		});
        // 	}
        // 	let distinct: PgSelectConfig['distinct'];
        // 	let tableFrom: PgTable | Subquery = table;
        // 	// Process first Many relation - each one requires a nested subquery
        // 	const manyRelation = manyRelations[0];
        // 	if (manyRelation) {
        // 		const {
        // 			tsKey: selectedRelationTsKey,
        // 			queryConfig: selectedRelationQueryConfig,
        // 			relation,
        // 		} = manyRelation;
        // 		distinct = {
        // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
        // 		};
        // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
        // 		const relationTableTsName = tableNamesMap[relationTableName]!;
        // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        // 		const joinOn = and(
        // 			...normalizedRelation.fields.map((field, i) =>
        // 				eq(
        // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
        // 					aliasedTableColumn(field, tableAlias),
        // 				)
        // 			),
        // 		);
        // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
        // 			fullSchema,
        // 			schema,
        // 			tableNamesMap,
        // 			table: fullSchema[relationTableTsName] as PgTable,
        // 			tableConfig: schema[relationTableTsName]!,
        // 			queryConfig: selectedRelationQueryConfig,
        // 			tableAlias: relationTableAlias,
        // 			joinOn,
        // 		});
        // 		const builtRelationSelectionField = sql`case when ${
        // 			sql.identifier(relationTableAlias)
        // 		} is null then '[]' else json_agg(json_build_array(${
        // 			sql.join(
        // 				builtRelationJoin.selection.map(({ field }) =>
        // 					is(field, SQL.Aliased)
        // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
        // 						: is(field, Column)
        // 						? aliasedTableColumn(field, relationTableAlias)
        // 						: field
        // 				),
        // 				sql`, `,
        // 			)
        // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
        // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
        // 		joins.push({
        // 			on: isLateralJoin ? sql`true` : joinOn,
        // 			table: isLateralJoin
        // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
        // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
        // 			alias: relationTableAlias,
        // 			joinType: 'left',
        // 			lateral: isLateralJoin,
        // 		});
        // 		// Build the "from" subquery with the remaining Many relations
        // 		const builtTableFrom = this.buildRelationalQueryWithPK({
        // 			fullSchema,
        // 			schema,
        // 			tableNamesMap,
        // 			table,
        // 			tableConfig,
        // 			queryConfig: {
        // 				...config,
        // 				where: undefined,
        // 				orderBy: undefined,
        // 				limit: undefined,
        // 				offset: undefined,
        // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
        // 					(result, { tsKey, queryConfig: configValue }) => {
        // 						result[tsKey] = configValue;
        // 						return result;
        // 					},
        // 					{},
        // 				),
        // 			},
        // 			tableAlias,
        // 		});
        // 		selectedRelations.push({
        // 			dbKey: selectedRelationTsKey,
        // 			tsKey: selectedRelationTsKey,
        // 			field: builtRelationSelectionField,
        // 			relationTableTsKey: relationTableTsName,
        // 			isJson: true,
        // 			selection: builtRelationJoin.selection,
        // 		});
        // 		// selection = builtTableFrom.selection.map((item) =>
        // 		// 	is(item.field, SQL.Aliased)
        // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
        // 		// 		: item
        // 		// );
        // 		// selectionForBuild = [{
        // 		// 	dbKey: '*',
        // 		// 	tsKey: '*',
        // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
        // 		// 	selection: [],
        // 		// 	isJson: false,
        // 		// 	relationTableTsKey: undefined,
        // 		// }];
        // 		// const newSelectionItem: (typeof selection)[number] = {
        // 		// 	dbKey: selectedRelationTsKey,
        // 		// 	tsKey: selectedRelationTsKey,
        // 		// 	field,
        // 		// 	relationTableTsKey: relationTableTsName,
        // 		// 	isJson: true,
        // 		// 	selection: builtRelationJoin.selection,
        // 		// };
        // 		// selection.push(newSelectionItem);
        // 		// selectionForBuild.push(newSelectionItem);
        // 		tableFrom = is(builtTableFrom.sql, PgTable)
        // 			? builtTableFrom.sql
        // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
        // 	}
        // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
        // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
        // 	}
        // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
        // 	function prepareSelectedColumns() {
        // 		return selectedColumns.map((key) => ({
        // 			dbKey: tableConfig.columns[key]!.name,
        // 			tsKey: key,
        // 			field: tableConfig.columns[key] as PgColumn,
        // 			relationTableTsKey: undefined,
        // 			isJson: false,
        // 			selection: [],
        // 		}));
        // 	}
        // 	function prepareSelectedExtras() {
        // 		return selectedExtras.map((item) => ({
        // 			dbKey: item.value.fieldAlias,
        // 			tsKey: item.tsKey,
        // 			field: item.value,
        // 			relationTableTsKey: undefined,
        // 			isJson: false,
        // 			selection: [],
        // 		}));
        // 	}
        // 	if (isRoot) {
        // 		selection = [
        // 			...prepareSelectedColumns(),
        // 			...prepareSelectedExtras(),
        // 		];
        // 	}
        // 	if (hasUserDefinedWhere || orderBy.length > 0) {
        // 		tableFrom = new Subquery(
        // 			this.buildSelectQuery({
        // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
        // 				fields: {},
        // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
        // 					path: [],
        // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
        // 				})),
        // 				joins,
        // 				distinct,
        // 			}),
        // 			{},
        // 			tableAlias,
        // 		);
        // 		selectionForBuild = selection.map((item) =>
        // 			is(item.field, SQL.Aliased)
        // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
        // 				: item
        // 		);
        // 		joins = [];
        // 		distinct = undefined;
        // 	}
        // 	const result = this.buildSelectQuery({
        // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
        // 		fields: {},
        // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
        // 			path: [],
        // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
        // 		})),
        // 		where,
        // 		limit,
        // 		offset,
        // 		joins,
        // 		orderBy,
        // 		distinct,
        // 	});
        // 	return {
        // 		tableTsKey: tableConfig.tsName,
        // 		sql: result,
        // 		selection,
        // 	};
        // }
        buildRelationalQueryWithoutPK({
          fullSchema,
          schema,
          tableNamesMap,
          table,
          tableConfig,
          queryConfig: config,
          tableAlias,
          nestedQueryRelation,
          joinOn,
        }) {
          let selection = [];
          let limit,
            offset,
            orderBy = [],
            where;
          const joins = [];
          if (config === true) {
            const selectionEntries = Object.entries(tableConfig.columns);
            selection = selectionEntries.map(([key, value]) => ({
              dbKey: value.name,
              tsKey: key,
              field: aliasedTableColumn(value, tableAlias),
              relationTableTsKey: undefined,
              isJson: false,
              selection: [],
            }));
          } else {
            const aliasedColumns = Object.fromEntries(
              Object.entries(tableConfig.columns).map(([key, value]) => [
                key,
                aliasedTableColumn(value, tableAlias),
              ])
            );
            if (config.where) {
              const whereSql =
                typeof config.where === "function"
                  ? config.where(aliasedColumns, getOperators())
                  : config.where;
              where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
            }
            const fieldsSelection = [];
            let selectedColumns = [];
            // Figure out which columns to select
            if (config.columns) {
              let isIncludeMode = false;
              for (const [field, value] of Object.entries(config.columns)) {
                if (value === undefined) {
                  continue;
                }
                if (field in tableConfig.columns) {
                  if (!isIncludeMode && value === true) {
                    isIncludeMode = true;
                  }
                  selectedColumns.push(field);
                }
              }
              if (selectedColumns.length > 0) {
                selectedColumns = isIncludeMode
                  ? selectedColumns.filter((c) => config.columns?.[c] === true)
                  : Object.keys(tableConfig.columns).filter(
                      (key) => !selectedColumns.includes(key)
                    );
              }
            } else {
              // Select all columns if selection is not specified
              selectedColumns = Object.keys(tableConfig.columns);
            }
            for (const field of selectedColumns) {
              const column = tableConfig.columns[field];
              fieldsSelection.push({ tsKey: field, value: column });
            }
            let selectedRelations = [];
            // Figure out which relations to select
            if (config.with) {
              selectedRelations = Object.entries(config.with)
                .filter((entry) => !!entry[1])
                .map(([tsKey, queryConfig]) => ({
                  tsKey,
                  queryConfig,
                  relation: tableConfig.relations[tsKey],
                }));
            }
            let extras;
            // Figure out which extras to select
            if (config.extras) {
              extras =
                typeof config.extras === "function"
                  ? config.extras(aliasedColumns, { sql })
                  : config.extras;
              for (const [tsKey, value] of Object.entries(extras)) {
                fieldsSelection.push({
                  tsKey,
                  value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
                });
              }
            }
            // Transform `fieldsSelection` into `selection`
            // `fieldsSelection` shouldn't be used after this point
            for (const { tsKey, value } of fieldsSelection) {
              selection.push({
                dbKey: is(value, SQL.Aliased)
                  ? value.fieldAlias
                  : tableConfig.columns[tsKey].name,
                tsKey,
                field: is(value, Column)
                  ? aliasedTableColumn(value, tableAlias)
                  : value,
                relationTableTsKey: undefined,
                isJson: false,
                selection: [],
              });
            }
            let orderByOrig =
              typeof config.orderBy === "function"
                ? config.orderBy(aliasedColumns, getOrderByOperators())
                : config.orderBy ?? [];
            if (!Array.isArray(orderByOrig)) {
              orderByOrig = [orderByOrig];
            }
            orderBy = orderByOrig.map((orderByValue) => {
              if (is(orderByValue, Column)) {
                return aliasedTableColumn(orderByValue, tableAlias);
              }
              return mapColumnsInSQLToAlias(orderByValue, tableAlias);
            });
            limit = config.limit;
            offset = config.offset;
            // Process all relations
            for (const {
              tsKey: selectedRelationTsKey,
              queryConfig: selectedRelationConfigValue,
              relation,
            } of selectedRelations) {
              const normalizedRelation = normalizeRelation(
                schema,
                tableNamesMap,
                relation
              );
              const relationTableName =
                relation.referencedTable[Table.Symbol.Name];
              const relationTableTsName = tableNamesMap[relationTableName];
              const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
              const joinOn = and(
                ...normalizedRelation.fields.map((field, i) =>
                  eq(
                    aliasedTableColumn(
                      normalizedRelation.references[i],
                      relationTableAlias
                    ),
                    aliasedTableColumn(field, tableAlias)
                  )
                )
              );
              const builtRelation = this.buildRelationalQueryWithoutPK({
                fullSchema,
                schema,
                tableNamesMap,
                table: fullSchema[relationTableTsName],
                tableConfig: schema[relationTableTsName],
                queryConfig: is(relation, One)
                  ? selectedRelationConfigValue === true
                    ? { limit: 1 }
                    : { ...selectedRelationConfigValue, limit: 1 }
                  : selectedRelationConfigValue,
                tableAlias: relationTableAlias,
                joinOn,
                nestedQueryRelation: relation,
              });
              const field = sql`${sql.identifier(
                relationTableAlias
              )}.${sql.identifier("data")}`.as(selectedRelationTsKey);
              joins.push({
                on: sql`true`,
                table: new Subquery(builtRelation.sql, {}, relationTableAlias),
                alias: relationTableAlias,
                joinType: "left",
                lateral: true,
              });
              selection.push({
                dbKey: selectedRelationTsKey,
                tsKey: selectedRelationTsKey,
                field,
                relationTableTsKey: relationTableTsName,
                isJson: true,
                selection: builtRelation.selection,
              });
            }
          }
          if (selection.length === 0) {
            throw new DrizzleError(
              `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`
            );
          }
          let result;
          where = and(joinOn, where);
          if (nestedQueryRelation) {
            let field = sql`json_build_array(${sql.join(
              selection.map(({ field, tsKey, isJson }) =>
                isJson
                  ? sql`${sql.identifier(
                      `${tableAlias}_${tsKey}`
                    )}.${sql.identifier("data")}`
                  : is(field, SQL.Aliased)
                    ? field.sql
                    : field
              ),
              sql`, `
            )})`;
            if (is(nestedQueryRelation, Many)) {
              field = sql`coalesce(json_agg(${field}${
                orderBy.length > 0
                  ? sql` order by ${sql.join(orderBy, sql`, `)}`
                  : undefined
              }), '[]'::json)`;
              // orderBy = [];
            }
            const nestedSelection = [
              {
                dbKey: "data",
                tsKey: "data",
                field: field.as("data"),
                isJson: true,
                relationTableTsKey: tableConfig.tsName,
                selection,
              },
            ];
            const needsSubquery =
              limit !== undefined || offset !== undefined || orderBy.length > 0;
            if (needsSubquery) {
              result = this.buildSelectQuery({
                table: aliasedTable(table, tableAlias),
                fields: {},
                fieldsFlat: [
                  {
                    path: [],
                    field: sql.raw("*"),
                  },
                ],
                where,
                limit,
                offset,
                orderBy,
              });
              where = undefined;
              limit = undefined;
              offset = undefined;
              orderBy = [];
            } else {
              result = aliasedTable(table, tableAlias);
            }
            result = this.buildSelectQuery({
              table: is(result, PgTable)
                ? result
                : new Subquery(result, {}, tableAlias),
              fields: {},
              fieldsFlat: nestedSelection.map(({ field }) => ({
                path: [],
                field: is(field, Column)
                  ? aliasedTableColumn(field, tableAlias)
                  : field,
              })),
              joins,
              where,
              limit,
              offset,
              orderBy,
            });
          } else {
            result = this.buildSelectQuery({
              table: aliasedTable(table, tableAlias),
              fields: {},
              fieldsFlat: selection.map(({ field }) => ({
                path: [],
                field: is(field, Column)
                  ? aliasedTableColumn(field, tableAlias)
                  : field,
              })),
              joins,
              where,
              limit,
              offset,
              orderBy,
            });
          }
          return {
            tableTsKey: tableConfig.tsName,
            sql: result,
            selection,
          };
        }
      }
      _a$d = entityKind;
      PgDialect[_a$d] = "PgDialect";

      var _a$c;
      class TypedQueryBuilder {
        /** @internal */
        getSelectedFields() {
          return this._.selectedFields;
        }
      }
      _a$c = entityKind;
      TypedQueryBuilder[_a$c] = "TypedQueryBuilder";

      var _a$b, _b$7, _c$5;
      class PgSelectBuilder {
        constructor(config) {
          this.withList = [];
          this.fields = config.fields;
          this.session = config.session;
          this.dialect = config.dialect;
          if (config.withList) {
            this.withList = config.withList;
          }
          this.distinct = config.distinct;
        }
        /**
         * Specify the table, subquery, or other target that you're
         * building a select query against.
         *
         * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM|Postgres from documentation}
         */
        from(source) {
          const isPartialSelect = !!this.fields;
          let fields;
          if (this.fields) {
            fields = this.fields;
          } else if (is(source, Subquery)) {
            // This is required to use the proxy handler to get the correct field values from the subquery
            fields = Object.fromEntries(
              Object.keys(source[SubqueryConfig].selection).map((key) => [
                key,
                source[key],
              ])
            );
          } else if (is(source, PgViewBase)) {
            fields = source[ViewBaseConfig].selectedFields;
          } else if (is(source, SQL)) {
            fields = {};
          } else {
            fields = getTableColumns(source);
          }
          return new PgSelect({
            table: source,
            fields,
            isPartialSelect,
            session: this.session,
            dialect: this.dialect,
            withList: this.withList,
            distinct: this.distinct,
          });
        }
      }
      _a$b = entityKind;
      PgSelectBuilder[_a$b] = "PgSelectBuilder";
      class PgSelectQueryBuilder extends TypedQueryBuilder {
        constructor({
          table,
          fields,
          isPartialSelect,
          session,
          dialect,
          withList,
          distinct,
        }) {
          super();
          /**
           * For each row of the table, include
           * values from a matching row of the joined
           * table, if there is a matching row. If not,
           * all of the columns of the joined table
           * will be set to null.
           */
          this.leftJoin = this.createJoin("left");
          /**
           * Includes all of the rows of the joined table.
           * If there is no matching row in the main table,
           * all the columns of the main table will be
           * set to null.
           */
          this.rightJoin = this.createJoin("right");
          /**
           * This is the default type of join.
           *
           * For each row of the table, the joined table
           * needs to have a matching row, or it will
           * be excluded from results.
           */
          this.innerJoin = this.createJoin("inner");
          /**
           * Rows from both the main & joined are included,
           * regardless of whether or not they have matching
           * rows in the other table.
           */
          this.fullJoin = this.createJoin("full");
          this.config = {
            withList,
            table,
            fields: { ...fields },
            distinct,
          };
          this.isPartialSelect = isPartialSelect;
          this.session = session;
          this.dialect = dialect;
          this._ = {
            selectedFields: fields,
          };
          this.tableName = getTableLikeName(table);
          this.joinsNotNullableMap =
            typeof this.tableName === "string"
              ? { [this.tableName]: true }
              : {};
        }
        createJoin(joinType) {
          return (table, on) => {
            const baseTableName = this.tableName;
            const tableName = getTableLikeName(table);
            if (
              typeof tableName === "string" &&
              this.config.joins?.some((join) => join.alias === tableName)
            ) {
              throw new Error(
                `Alias "${tableName}" is already used in this query`
              );
            }
            if (!this.isPartialSelect) {
              // If this is the first join and this is not a partial select and we're not selecting from raw SQL, "move" the fields from the main table to the nested object
              if (
                Object.keys(this.joinsNotNullableMap).length === 1 &&
                typeof baseTableName === "string"
              ) {
                this.config.fields = {
                  [baseTableName]: this.config.fields,
                };
              }
              if (typeof tableName === "string" && !is(table, SQL)) {
                const selection = is(table, Subquery)
                  ? table[SubqueryConfig].selection
                  : is(table, View)
                    ? table[ViewBaseConfig].selectedFields
                    : table[Table.Symbol.Columns];
                this.config.fields[tableName] = selection;
              }
            }
            if (typeof on === "function") {
              on = on(
                new Proxy(
                  this.config.fields,
                  new SelectionProxyHandler({
                    sqlAliasedBehavior: "sql",
                    sqlBehavior: "sql",
                  })
                )
              );
            }
            if (!this.config.joins) {
              this.config.joins = [];
            }
            this.config.joins.push({ on, table, joinType, alias: tableName });
            if (typeof tableName === "string") {
              switch (joinType) {
                case "left": {
                  this.joinsNotNullableMap[tableName] = false;
                  break;
                }
                case "right": {
                  this.joinsNotNullableMap = Object.fromEntries(
                    Object.entries(this.joinsNotNullableMap).map(([key]) => [
                      key,
                      false,
                    ])
                  );
                  this.joinsNotNullableMap[tableName] = true;
                  break;
                }
                case "inner": {
                  this.joinsNotNullableMap[tableName] = true;
                  break;
                }
                case "full": {
                  this.joinsNotNullableMap = Object.fromEntries(
                    Object.entries(this.joinsNotNullableMap).map(([key]) => [
                      key,
                      false,
                    ])
                  );
                  this.joinsNotNullableMap[tableName] = false;
                  break;
                }
              }
            }
            return this;
          };
        }
        /**
         * Specify a condition to narrow the result set. Multiple
         * conditions can be combined with the `and` and `or`
         * functions.
         *
         * ## Examples
         *
         * ```ts
         * // Find cars made in the year 2000
         * db.select().from(cars).where(eq(cars.year, 2000));
         * ```
         */
        where(where) {
          if (typeof where === "function") {
            where = where(
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({
                  sqlAliasedBehavior: "sql",
                  sqlBehavior: "sql",
                })
              )
            );
          }
          this.config.where = where;
          return this;
        }
        /**
         * Sets the HAVING clause of this query, which often
         * used with GROUP BY and filters rows after they've been
         * grouped together and combined.
         *
         * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-HAVING|Postgres having clause documentation}
         */
        having(having) {
          if (typeof having === "function") {
            having = having(
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({
                  sqlAliasedBehavior: "sql",
                  sqlBehavior: "sql",
                })
              )
            );
          }
          this.config.having = having;
          return this;
        }
        groupBy(...columns) {
          if (typeof columns[0] === "function") {
            const groupBy = columns[0](
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({
                  sqlAliasedBehavior: "alias",
                  sqlBehavior: "sql",
                })
              )
            );
            this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
          } else {
            this.config.groupBy = columns;
          }
          return this;
        }
        orderBy(...columns) {
          if (typeof columns[0] === "function") {
            const orderBy = columns[0](
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({
                  sqlAliasedBehavior: "alias",
                  sqlBehavior: "sql",
                })
              )
            );
            this.config.orderBy = Array.isArray(orderBy) ? orderBy : [orderBy];
          } else {
            this.config.orderBy = columns;
          }
          return this;
        }
        /**
         * Set the maximum number of rows that will be
         * returned by this query.
         *
         * ## Examples
         *
         * ```ts
         * // Get the first 10 people from this query.
         * db.select().from(people).limit(10);
         * ```
         *
         * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-LIMIT|Postgres LIMIT documentation}
         */
        limit(limit) {
          this.config.limit = limit;
          return this;
        }
        /**
         * Skip a number of rows when returning results
         * from this query.
         *
         * ## Examples
         *
         * ```ts
         * // Get the 10th-20th people from this query.
         * db.select().from(people).offset(10).limit(10);
         * ```
         */
        offset(offset) {
          this.config.offset = offset;
          return this;
        }
        /**
         * The FOR clause specifies a lock strength for this query
         * that controls how strictly it acquires exclusive access to
         * the rows being queried.
         *
         * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE|Postgres locking clause documentation}
         */
        for(strength, config = {}) {
          if (!this.config.lockingClauses) {
            this.config.lockingClauses = [];
          }
          this.config.lockingClauses.push({ strength, config });
          return this;
        }
        /** @internal */
        getSQL() {
          return this.dialect.buildSelectQuery(this.config);
        }
        toSQL() {
          const { typings: _typings, ...rest } = this.dialect.sqlToQuery(
            this.getSQL()
          );
          return rest;
        }
        as(alias) {
          return new Proxy(
            new Subquery(this.getSQL(), this.config.fields, alias),
            new SelectionProxyHandler({
              alias,
              sqlAliasedBehavior: "alias",
              sqlBehavior: "error",
            })
          );
        }
      }
      _b$7 = entityKind;
      PgSelectQueryBuilder[_b$7] = "PgSelectQueryBuilder";
      class PgSelect extends PgSelectQueryBuilder {
        constructor() {
          super(...arguments);
          this.execute = (placeholderValues) => {
            return tracer.startActiveSpan("drizzle.operation", () => {
              return this._prepare().execute(placeholderValues);
            });
          };
        }
        _prepare(name) {
          const { session, config, dialect, joinsNotNullableMap } = this;
          if (!session) {
            throw new Error(
              "Cannot execute a query on a query builder. Please use a database instance instead."
            );
          }
          return tracer.startActiveSpan("drizzle.prepareQuery", () => {
            const fieldsList = orderSelectedFields(config.fields);
            const query = session.prepareQuery(
              dialect.sqlToQuery(this.getSQL()),
              fieldsList,
              name
            );
            query.joinsNotNullableMap = joinsNotNullableMap;
            return query;
          });
        }
        /**
         * Create a prepared statement for this query. This allows
         * the database to remember this query for the given session
         * and call it by name, rather than specifying the full query.
         *
         * {@link https://www.postgresql.org/docs/current/sql-prepare.html|Postgres prepare documentation}
         */
        prepare(name) {
          return this._prepare(name);
        }
      }
      _c$5 = entityKind;
      PgSelect[_c$5] = "PgSelect";
      applyMixins(PgSelect, [QueryPromise]);

      var _a$a;
      class QueryBuilder {
        $with(alias) {
          const queryBuilder = this;
          return {
            as(qb) {
              if (typeof qb === "function") {
                qb = qb(queryBuilder);
              }
              return new Proxy(
                new WithSubquery(
                  qb.getSQL(),
                  qb.getSelectedFields(),
                  alias,
                  true
                ),
                new SelectionProxyHandler({
                  alias,
                  sqlAliasedBehavior: "alias",
                  sqlBehavior: "error",
                })
              );
            },
          };
        }
        with(...queries) {
          const self = this;
          function select(fields) {
            return new PgSelectBuilder({
              fields: fields ?? undefined,
              session: undefined,
              dialect: self.getDialect(),
              withList: queries,
            });
          }
          function selectDistinct(fields) {
            return new PgSelectBuilder({
              fields: fields ?? undefined,
              session: undefined,
              dialect: self.getDialect(),
              distinct: true,
            });
          }
          function selectDistinctOn(on, fields) {
            return new PgSelectBuilder({
              fields: fields ?? undefined,
              session: undefined,
              dialect: self.getDialect(),
              distinct: { on },
            });
          }
          return { select, selectDistinct, selectDistinctOn };
        }
        select(fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: undefined,
            dialect: this.getDialect(),
          });
        }
        selectDistinct(fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: undefined,
            dialect: this.getDialect(),
            distinct: true,
          });
        }
        selectDistinctOn(on, fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: undefined,
            dialect: this.getDialect(),
            distinct: { on },
          });
        }
        // Lazy load dialect to avoid circular dependency
        getDialect() {
          if (!this.dialect) {
            this.dialect = new PgDialect();
          }
          return this.dialect;
        }
      }
      _a$a = entityKind;
      QueryBuilder[_a$a] = "PgQueryBuilder";

      var _a$9;
      class PgRefreshMaterializedView extends QueryPromise {
        constructor(view, session, dialect) {
          super();
          this.session = session;
          this.dialect = dialect;
          this.execute = (placeholderValues) => {
            return tracer.startActiveSpan("drizzle.operation", () => {
              return this._prepare().execute(placeholderValues);
            });
          };
          this.config = { view };
        }
        concurrently() {
          if (this.config.withNoData !== undefined) {
            throw new Error("Cannot use concurrently and withNoData together");
          }
          this.config.concurrently = true;
          return this;
        }
        withNoData() {
          if (this.config.concurrently !== undefined) {
            throw new Error("Cannot use concurrently and withNoData together");
          }
          this.config.withNoData = true;
          return this;
        }
        /** @internal */
        getSQL() {
          return this.dialect.buildRefreshMaterializedViewQuery(this.config);
        }
        toSQL() {
          const { typings: _typings, ...rest } = this.dialect.sqlToQuery(
            this.getSQL()
          );
          return rest;
        }
        _prepare(name) {
          return tracer.startActiveSpan("drizzle.prepareQuery", () => {
            return this.session.prepareQuery(
              this.dialect.sqlToQuery(this.getSQL()),
              undefined,
              name
            );
          });
        }
        prepare(name) {
          return this._prepare(name);
        }
      }
      _a$9 = entityKind;
      PgRefreshMaterializedView[_a$9] = "PgRefreshMaterializedView";

      var _a$8, _b$6;
      class PgUpdateBuilder {
        constructor(table, session, dialect) {
          this.table = table;
          this.session = session;
          this.dialect = dialect;
        }
        set(values) {
          return new PgUpdate(
            this.table,
            mapUpdateSet(this.table, values),
            this.session,
            this.dialect
          );
        }
      }
      _a$8 = entityKind;
      PgUpdateBuilder[_a$8] = "PgUpdateBuilder";
      class PgUpdate extends QueryPromise {
        constructor(table, set, session, dialect) {
          super();
          this.session = session;
          this.dialect = dialect;
          this.execute = (placeholderValues) => {
            return this._prepare().execute(placeholderValues);
          };
          this.config = { set, table };
        }
        where(where) {
          this.config.where = where;
          return this;
        }
        returning(fields = this.config.table[Table.Symbol.Columns]) {
          this.config.returning = orderSelectedFields(fields);
          return this;
        }
        /** @internal */
        getSQL() {
          return this.dialect.buildUpdateQuery(this.config);
        }
        toSQL() {
          const { typings: _typings, ...rest } = this.dialect.sqlToQuery(
            this.getSQL()
          );
          return rest;
        }
        _prepare(name) {
          return this.session.prepareQuery(
            this.dialect.sqlToQuery(this.getSQL()),
            this.config.returning,
            name
          );
        }
        prepare(name) {
          return this._prepare(name);
        }
      }
      _b$6 = entityKind;
      PgUpdate[_b$6] = "PgUpdate";

      var _a$7, _b$5, _c$4, _d$2, _e$1, _f$1, _g, _h, _j;
      class DefaultViewBuilderCore {
        constructor(name, schema) {
          this.name = name;
          this.schema = schema;
          this.config = {};
        }
        with(config) {
          this.config.with = config;
          return this;
        }
      }
      _a$7 = entityKind;
      DefaultViewBuilderCore[_a$7] = "PgDefaultViewBuilderCore";
      class ViewBuilder extends DefaultViewBuilderCore {
        as(qb) {
          if (typeof qb === "function") {
            qb = qb(new QueryBuilder());
          }
          const selectionProxy = new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true,
          });
          const aliasedSelection = new Proxy(
            qb.getSelectedFields(),
            selectionProxy
          );
          return new Proxy(
            new PgView({
              pgConfig: this.config,
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: aliasedSelection,
                query: qb.getSQL().inlineParams(),
              },
            }),
            selectionProxy
          );
        }
      }
      _b$5 = entityKind;
      ViewBuilder[_b$5] = "PgViewBuilder";
      class ManualViewBuilder extends DefaultViewBuilderCore {
        constructor(name, columns, schema) {
          super(name, schema);
          this.columns = getTableColumns(pgTable(name, columns));
        }
        existing() {
          return new Proxy(
            new PgView({
              pgConfig: undefined,
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: this.columns,
                query: undefined,
              },
            }),
            new SelectionProxyHandler({
              alias: this.name,
              sqlBehavior: "error",
              sqlAliasedBehavior: "alias",
              replaceOriginalName: true,
            })
          );
        }
        as(query) {
          return new Proxy(
            new PgView({
              pgConfig: this.config,
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: this.columns,
                query: query.inlineParams(),
              },
            }),
            new SelectionProxyHandler({
              alias: this.name,
              sqlBehavior: "error",
              sqlAliasedBehavior: "alias",
              replaceOriginalName: true,
            })
          );
        }
      }
      _c$4 = entityKind;
      ManualViewBuilder[_c$4] = "PgManualViewBuilder";
      class MaterializedViewBuilderCore {
        constructor(name, schema) {
          this.name = name;
          this.schema = schema;
          this.config = {};
        }
        using(using) {
          this.config.using = using;
          return this;
        }
        with(config) {
          this.config.with = config;
          return this;
        }
        tablespace(tablespace) {
          this.config.tablespace = tablespace;
          return this;
        }
        withNoData() {
          this.config.withNoData = true;
          return this;
        }
      }
      _d$2 = entityKind;
      MaterializedViewBuilderCore[_d$2] = "PgMaterializedViewBuilderCore";
      class MaterializedViewBuilder extends MaterializedViewBuilderCore {
        as(qb) {
          if (typeof qb === "function") {
            qb = qb(new QueryBuilder());
          }
          const selectionProxy = new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true,
          });
          const aliasedSelection = new Proxy(
            qb.getSelectedFields(),
            selectionProxy
          );
          return new Proxy(
            new PgMaterializedView({
              pgConfig: {
                with: this.config.with,
                using: this.config.using,
                tablespace: this.config.tablespace,
                withNoData: this.config.withNoData,
              },
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: aliasedSelection,
                query: qb.getSQL().inlineParams(),
              },
            }),
            selectionProxy
          );
        }
      }
      _e$1 = entityKind;
      MaterializedViewBuilder[_e$1] = "PgMaterializedViewBuilder";
      class ManualMaterializedViewBuilder extends MaterializedViewBuilderCore {
        constructor(name, columns, schema) {
          super(name, schema);
          this.columns = getTableColumns(pgTable(name, columns));
        }
        existing() {
          return new Proxy(
            new PgMaterializedView({
              pgConfig: undefined,
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: this.columns,
                query: undefined,
              },
            }),
            new SelectionProxyHandler({
              alias: this.name,
              sqlBehavior: "error",
              sqlAliasedBehavior: "alias",
              replaceOriginalName: true,
            })
          );
        }
        as(query) {
          return new Proxy(
            new PgMaterializedView({
              pgConfig: undefined,
              config: {
                name: this.name,
                schema: this.schema,
                selectedFields: this.columns,
                query: query.inlineParams(),
              },
            }),
            new SelectionProxyHandler({
              alias: this.name,
              sqlBehavior: "error",
              sqlAliasedBehavior: "alias",
              replaceOriginalName: true,
            })
          );
        }
      }
      _f$1 = entityKind;
      ManualMaterializedViewBuilder[_f$1] = "PgManualMaterializedViewBuilder";
      class PgViewBase extends View {}
      _g = entityKind;
      PgViewBase[_g] = "PgViewBase";
      const PgViewConfig = Symbol.for("drizzle:PgViewConfig");
      class PgView extends PgViewBase {
        constructor({ pgConfig, config }) {
          super(config);
          if (pgConfig) {
            this[PgViewConfig] = {
              with: pgConfig.with,
            };
          }
        }
      }
      _h = entityKind;
      PgView[_h] = "PgView";
      const PgMaterializedViewConfig = Symbol.for(
        "drizzle:PgMaterializedViewConfig"
      );
      class PgMaterializedView extends PgViewBase {
        constructor({ pgConfig, config }) {
          super(config);
          this[PgMaterializedViewConfig] = {
            with: pgConfig?.with,
            using: pgConfig?.using,
            tablespace: pgConfig?.tablespace,
            withNoData: pgConfig?.withNoData,
          };
        }
      }
      _j = entityKind;
      PgMaterializedView[_j] = "PgMaterializedView";
      /** @internal */
      function pgViewWithSchema(name, selection, schema) {
        if (selection) {
          return new ManualViewBuilder(name, selection, schema);
        }
        return new ViewBuilder(name, schema);
      }
      /** @internal */
      function pgMaterializedViewWithSchema(name, selection, schema) {
        if (selection) {
          return new ManualMaterializedViewBuilder(name, selection, schema);
        }
        return new MaterializedViewBuilder(name, schema);
      }
      function pgView(name, columns) {
        return pgViewWithSchema(name, columns, undefined);
      }
      function pgMaterializedView(name, columns) {
        return pgMaterializedViewWithSchema(name, columns, undefined);
      }

      var _a$6, _b$4;
      class RelationalQueryBuilder {
        constructor(
          fullSchema,
          schema,
          tableNamesMap,
          table,
          tableConfig,
          dialect,
          session
        ) {
          this.fullSchema = fullSchema;
          this.schema = schema;
          this.tableNamesMap = tableNamesMap;
          this.table = table;
          this.tableConfig = tableConfig;
          this.dialect = dialect;
          this.session = session;
        }
        findMany(config) {
          return new PgRelationalQuery(
            this.fullSchema,
            this.schema,
            this.tableNamesMap,
            this.table,
            this.tableConfig,
            this.dialect,
            this.session,
            config ? config : {},
            "many"
          );
        }
        findFirst(config) {
          return new PgRelationalQuery(
            this.fullSchema,
            this.schema,
            this.tableNamesMap,
            this.table,
            this.tableConfig,
            this.dialect,
            this.session,
            config ? { ...config, limit: 1 } : { limit: 1 },
            "first"
          );
        }
      }
      _a$6 = entityKind;
      RelationalQueryBuilder[_a$6] = "PgRelationalQueryBuilder";
      class PgRelationalQuery extends QueryPromise {
        constructor(
          fullSchema,
          schema,
          tableNamesMap,
          table,
          tableConfig,
          dialect,
          session,
          config,
          mode
        ) {
          super();
          this.fullSchema = fullSchema;
          this.schema = schema;
          this.tableNamesMap = tableNamesMap;
          this.table = table;
          this.tableConfig = tableConfig;
          this.dialect = dialect;
          this.session = session;
          this.config = config;
          this.mode = mode;
        }
        _prepare(name) {
          return tracer.startActiveSpan("drizzle.prepareQuery", () => {
            const { query, builtQuery } = this._toSQL();
            return this.session.prepareQuery(
              builtQuery,
              undefined,
              name,
              (rawRows, mapColumnValue) => {
                const rows = rawRows.map((row) =>
                  mapRelationalRow(
                    this.schema,
                    this.tableConfig,
                    row,
                    query.selection,
                    mapColumnValue
                  )
                );
                if (this.mode === "first") {
                  return rows[0];
                }
                return rows;
              }
            );
          });
        }
        prepare(name) {
          return this._prepare(name);
        }
        _toSQL() {
          const query = this.dialect.buildRelationalQueryWithoutPK({
            fullSchema: this.fullSchema,
            schema: this.schema,
            tableNamesMap: this.tableNamesMap,
            table: this.table,
            tableConfig: this.tableConfig,
            queryConfig: this.config,
            tableAlias: this.tableConfig.tsName,
          });
          const builtQuery = this.dialect.sqlToQuery(query.sql);
          return { query, builtQuery };
        }
        toSQL() {
          return this._toSQL().builtQuery;
        }
        execute() {
          return tracer.startActiveSpan("drizzle.operation", () => {
            return this._prepare().execute();
          });
        }
      }
      _b$4 = entityKind;
      PgRelationalQuery[_b$4] = "PgRelationalQuery";

      var _a$5;
      class PgDatabase {
        constructor(
          /** @internal */
          dialect,
          /** @internal */
          session,
          schema
        ) {
          this.dialect = dialect;
          this.session = session;
          this._ = schema
            ? { schema: schema.schema, tableNamesMap: schema.tableNamesMap }
            : { schema: undefined, tableNamesMap: {} };
          this.query = {};
          if (this._.schema) {
            for (const [tableName, columns] of Object.entries(this._.schema)) {
              this.query[tableName] = new RelationalQueryBuilder(
                schema.fullSchema,
                this._.schema,
                this._.tableNamesMap,
                schema.fullSchema[tableName],
                columns,
                dialect,
                session
              );
            }
          }
        }
        $with(alias) {
          return {
            as(qb) {
              if (typeof qb === "function") {
                qb = qb(new QueryBuilder());
              }
              return new Proxy(
                new WithSubquery(
                  qb.getSQL(),
                  qb.getSelectedFields(),
                  alias,
                  true
                ),
                new SelectionProxyHandler({
                  alias,
                  sqlAliasedBehavior: "alias",
                  sqlBehavior: "error",
                })
              );
            },
          };
        }
        with(...queries) {
          const self = this;
          function select(fields) {
            return new PgSelectBuilder({
              fields: fields ?? undefined,
              session: self.session,
              dialect: self.dialect,
              withList: queries,
            });
          }
          return { select };
        }
        select(fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: this.session,
            dialect: this.dialect,
          });
        }
        selectDistinct(fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: this.session,
            dialect: this.dialect,
            distinct: true,
          });
        }
        selectDistinctOn(on, fields) {
          return new PgSelectBuilder({
            fields: fields ?? undefined,
            session: this.session,
            dialect: this.dialect,
            distinct: { on },
          });
        }
        update(table) {
          return new PgUpdateBuilder(table, this.session, this.dialect);
        }
        insert(table) {
          return new PgInsertBuilder(table, this.session, this.dialect);
        }
        delete(table) {
          return new PgDelete(table, this.session, this.dialect);
        }
        refreshMaterializedView(view) {
          return new PgRefreshMaterializedView(
            view,
            this.session,
            this.dialect
          );
        }
        execute(query) {
          return this.session.execute(query.getSQL());
        }
        transaction(transaction, config) {
          return this.session.transaction(transaction, config);
        }
      }
      _a$5 = entityKind;
      PgDatabase[_a$5] = "PgDatabase";

      var _a$4;
      class PgSchema {
        constructor(schemaName) {
          this.schemaName = schemaName;
          this.table = (name, columns, extraConfig) => {
            return pgTableWithSchema(
              name,
              columns,
              extraConfig,
              this.schemaName
            );
          };
          this.view = (name, columns) => {
            return pgViewWithSchema(name, columns, this.schemaName);
          };
          this.materializedView = (name, columns) => {
            return pgMaterializedViewWithSchema(name, columns, this.schemaName);
          };
        }
      }
      _a$4 = entityKind;
      PgSchema[_a$4] = "PgSchema";
      function isPgSchema(obj) {
        return is(obj, PgSchema);
      }
      function pgSchema(name) {
        if (name === "public") {
          throw new Error(
            `You can't specify 'public' as schema name. Postgres is using public schema by default. If you want to use 'public' schema, just use pgTable() instead of creating a schema`
          );
        }
        return new PgSchema(name);
      }

      var _a$3, _b$3, _c$3;
      class PreparedQuery {}
      _a$3 = entityKind;
      PreparedQuery[_a$3] = "PgPreparedQuery";
      class PgSession {
        constructor(dialect) {
          this.dialect = dialect;
        }
        execute(query) {
          return tracer.startActiveSpan("drizzle.operation", () => {
            const prepared = tracer.startActiveSpan(
              "drizzle.prepareQuery",
              () => {
                return this.prepareQuery(
                  this.dialect.sqlToQuery(query),
                  undefined,
                  undefined
                );
              }
            );
            return prepared.execute();
          });
        }
        all(query) {
          return this.prepareQuery(
            this.dialect.sqlToQuery(query),
            undefined,
            undefined
          ).all();
        }
      }
      _b$3 = entityKind;
      PgSession[_b$3] = "PgSession";
      class PgTransaction extends PgDatabase {
        constructor(dialect, session, schema, nestedIndex = 0) {
          super(dialect, session, schema);
          this.schema = schema;
          this.nestedIndex = nestedIndex;
        }
        rollback() {
          throw new TransactionRollbackError();
        }
        /** @internal */
        getTransactionConfigSQL(config) {
          const chunks = [];
          if (config.isolationLevel) {
            chunks.push(`isolation level ${config.isolationLevel}`);
          }
          if (config.accessMode) {
            chunks.push(config.accessMode);
          }
          if (typeof config.deferrable === "boolean") {
            chunks.push(config.deferrable ? "deferrable" : "not deferrable");
          }
          return sql.raw(chunks.join(" "));
        }
        setTransaction(config) {
          return this.session.execute(
            sql`set transaction ${this.getTransactionConfigSQL(config)}`
          );
        }
      }
      _c$3 = entityKind;
      PgTransaction[_c$3] = "PgTransaction";

      var _a$2, _b$2, _c$2, _d$1;
      class Relation {
        constructor(sourceTable, referencedTable, relationName) {
          this.sourceTable = sourceTable;
          this.referencedTable = referencedTable;
          this.relationName = relationName;
          this.referencedTableName = referencedTable[Table.Symbol.Name];
        }
      }
      _a$2 = entityKind;
      Relation[_a$2] = "Relation";
      class Relations {
        constructor(table, config) {
          this.table = table;
          this.config = config;
        }
      }
      _b$2 = entityKind;
      Relations[_b$2] = "Relations";
      class One extends Relation {
        constructor(sourceTable, referencedTable, config, isNullable) {
          super(sourceTable, referencedTable, config?.relationName);
          this.config = config;
          this.isNullable = isNullable;
        }
        withFieldName(fieldName) {
          const relation = new One(
            this.sourceTable,
            this.referencedTable,
            this.config,
            this.isNullable
          );
          relation.fieldName = fieldName;
          return relation;
        }
      }
      _c$2 = entityKind;
      One[_c$2] = "One";
      class Many extends Relation {
        constructor(sourceTable, referencedTable, config) {
          super(sourceTable, referencedTable, config?.relationName);
          this.config = config;
        }
        withFieldName(fieldName) {
          const relation = new Many(
            this.sourceTable,
            this.referencedTable,
            this.config
          );
          relation.fieldName = fieldName;
          return relation;
        }
      }
      _d$1 = entityKind;
      Many[_d$1] = "Many";
      function getOperators() {
        return {
          and,
          between,
          eq,
          exists,
          gt,
          gte,
          ilike,
          inArray,
          isNull,
          isNotNull,
          like,
          lt,
          lte,
          ne,
          not,
          notBetween,
          notExists,
          notLike,
          notIlike,
          notInArray,
          or,
          sql,
        };
      }
      function getOrderByOperators() {
        return {
          sql,
          asc,
          desc,
        };
      }
      function extractTablesRelationalConfig(schema, configHelpers) {
        if (
          Object.keys(schema).length === 1 &&
          "default" in schema &&
          !is(schema["default"], Table)
        ) {
          schema = schema["default"];
        }
        // table DB name -> schema table key
        const tableNamesMap = {};
        // Table relations found before their tables - need to buffer them until we know the schema table key
        const relationsBuffer = {};
        const tablesConfig = {};
        for (const [key, value] of Object.entries(schema)) {
          if (isTable(value)) {
            const dbName = value[Table.Symbol.Name];
            const bufferedRelations = relationsBuffer[dbName];
            tableNamesMap[dbName] = key;
            tablesConfig[key] = {
              tsName: key,
              dbName: value[Table.Symbol.Name],
              columns: value[Table.Symbol.Columns],
              relations: bufferedRelations?.relations ?? {},
              primaryKey: bufferedRelations?.primaryKey ?? [],
            };
            // Fill in primary keys
            for (const column of Object.values(value[Table.Symbol.Columns])) {
              if (column.primary) {
                tablesConfig[key].primaryKey.push(column);
              }
            }
            const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value);
            if (extraConfig) {
              for (const configEntry of Object.values(extraConfig)) {
                if (is(configEntry, PrimaryKeyBuilder)) {
                  tablesConfig[key].primaryKey.push(...configEntry.columns);
                }
              }
            }
          } else if (is(value, Relations)) {
            const dbName = value.table[Table.Symbol.Name];
            const tableName = tableNamesMap[dbName];
            const relations = value.config(configHelpers(value.table));
            let primaryKey;
            for (const [relationName, relation] of Object.entries(relations)) {
              if (tableName) {
                const tableConfig = tablesConfig[tableName];
                tableConfig.relations[relationName] = relation;
              } else {
                if (!(dbName in relationsBuffer)) {
                  relationsBuffer[dbName] = {
                    relations: {},
                    primaryKey,
                  };
                }
                relationsBuffer[dbName].relations[relationName] = relation;
              }
            }
          }
        }
        return { tables: tablesConfig, tableNamesMap };
      }
      function relations(table, relations) {
        return new Relations(table, (helpers) =>
          Object.fromEntries(
            Object.entries(relations(helpers)).map(([key, value]) => [
              key,
              value.withFieldName(key),
            ])
          )
        );
      }
      function createOne(sourceTable) {
        return function one(table, config) {
          return new One(
            sourceTable,
            table,
            config,
            config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
          );
        };
      }
      function createMany(sourceTable) {
        return function many(referencedTable, config) {
          return new Many(sourceTable, referencedTable, config);
        };
      }
      function normalizeRelation(schema, tableNamesMap, relation) {
        if (is(relation, One) && relation.config) {
          return {
            fields: relation.config.fields,
            references: relation.config.references,
          };
        }
        const referencedTableTsName =
          tableNamesMap[relation.referencedTable[Table.Symbol.Name]];
        if (!referencedTableTsName) {
          throw new Error(
            `Table "${
              relation.referencedTable[Table.Symbol.Name]
            }" not found in schema`
          );
        }
        const referencedTableConfig = schema[referencedTableTsName];
        if (!referencedTableConfig) {
          throw new Error(
            `Table "${referencedTableTsName}" not found in schema`
          );
        }
        const sourceTable = relation.sourceTable;
        const sourceTableTsName = tableNamesMap[sourceTable[Table.Symbol.Name]];
        if (!sourceTableTsName) {
          throw new Error(
            `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
          );
        }
        const reverseRelations = [];
        for (const referencedTableRelation of Object.values(
          referencedTableConfig.relations
        )) {
          if (
            (relation.relationName &&
              relation !== referencedTableRelation &&
              referencedTableRelation.relationName === relation.relationName) ||
            (!relation.relationName &&
              referencedTableRelation.referencedTable === relation.sourceTable)
          ) {
            reverseRelations.push(referencedTableRelation);
          }
        }
        if (reverseRelations.length > 1) {
          throw relation.relationName
            ? new Error(
                `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
              )
            : new Error(
                `There are multiple relations between "${referencedTableTsName}" and "${
                  relation.sourceTable[Table.Symbol.Name]
                }". Please specify relation name`
              );
        }
        if (
          reverseRelations[0] &&
          is(reverseRelations[0], One) &&
          reverseRelations[0].config
        ) {
          return {
            fields: reverseRelations[0].config.references,
            references: reverseRelations[0].config.fields,
          };
        }
        throw new Error(
          `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
        );
      }
      function createTableRelationsHelpers(sourceTable) {
        return {
          one: createOne(sourceTable),
          many: createMany(sourceTable),
        };
      }
      function mapRelationalRow(
        tablesConfig,
        tableConfig,
        row,
        buildQueryResultSelection,
        mapColumnValue = (value) => value
      ) {
        const result = {};
        for (const [
          selectionItemIndex,
          selectionItem,
        ] of buildQueryResultSelection.entries()) {
          if (selectionItem.isJson) {
            const relation = tableConfig.relations[selectionItem.tsKey];
            const rawSubRows = row[selectionItemIndex];
            const subRows =
              typeof rawSubRows === "string"
                ? JSON.parse(rawSubRows)
                : rawSubRows;
            result[selectionItem.tsKey] = is(relation, One)
              ? subRows &&
                mapRelationalRow(
                  tablesConfig,
                  tablesConfig[selectionItem.relationTableTsKey],
                  subRows,
                  selectionItem.selection,
                  mapColumnValue
                )
              : subRows.map((subRow) =>
                  mapRelationalRow(
                    tablesConfig,
                    tablesConfig[selectionItem.relationTableTsKey],
                    subRow,
                    selectionItem.selection,
                    mapColumnValue
                  )
                );
          } else {
            const value = mapColumnValue(row[selectionItemIndex]);
            const field = selectionItem.field;
            let decoder;
            if (is(field, Column)) {
              decoder = field;
            } else if (is(field, SQL)) {
              decoder = field.decoder;
            } else {
              decoder = field.sql.decoder;
            }
            result[selectionItem.tsKey] =
              value === null ? null : decoder.mapFromDriverValue(value);
          }
        }
        return result;
      }

      function bindIfParam(value, column) {
        if (
          isDriverValueEncoder(column) &&
          !isSQLWrapper(value) &&
          !is(value, Param) &&
          !is(value, Placeholder) &&
          !is(value, Column) &&
          !is(value, Table) &&
          !is(value, View)
        ) {
          return new Param(value, column);
        }
        return value;
      }
      /**
       * Test that two values are equal.
       *
       * Remember that the SQL standard dictates that
       * two NULL values are not equal, so if you want to test
       * whether a value is null, you may want to use
       * `isNull` instead.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars made by Ford
       * db.select().from(cars)
       *   .where(eq(cars.make, 'Ford'))
       * ```
       *
       * @see isNull for a way to test equality to NULL.
       */
      const eq = (left, right) => {
        return sql`${left} = ${bindIfParam(right, left)}`;
      };
      /**
       * Test that two values are not equal.
       *
       * Remember that the SQL standard dictates that
       * two NULL values are not equal, so if you want to test
       * whether a value is not null, you may want to use
       * `isNotNull` instead.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars not made by Ford
       * db.select().from(cars)
       *   .where(ne(cars.make, 'Ford'))
       * ```
       *
       * @see isNotNull for a way to test whether a value is not null.
       */
      const ne = (left, right) => {
        return sql`${left} <> ${bindIfParam(right, left)}`;
      };
      function and(...unfilteredConditions) {
        const conditions = unfilteredConditions.filter((c) => c !== undefined);
        if (conditions.length === 0) {
          return undefined;
        }
        if (conditions.length === 1) {
          return new SQL(conditions);
        }
        return new SQL([
          new StringChunk("("),
          sql.join(conditions, new StringChunk(" and ")),
          new StringChunk(")"),
        ]);
      }
      function or(...unfilteredConditions) {
        const conditions = unfilteredConditions.filter((c) => c !== undefined);
        if (conditions.length === 0) {
          return undefined;
        }
        if (conditions.length === 1) {
          return new SQL(conditions);
        }
        return new SQL([
          new StringChunk("("),
          sql.join(conditions, new StringChunk(" or ")),
          new StringChunk(")"),
        ]);
      }
      /**
       * Negate the meaning of an expression using the `not` keyword.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars _not_ made by GM or Ford.
       * db.select().from(cars)
       *   .where(not(inArray(cars.make, ['GM', 'Ford'])))
       * ```
       */
      function not(condition) {
        return sql`not ${condition}`;
      }
      /**
       * Test that the first expression passed is greater than
       * the second expression.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars made after 2000.
       * db.select().from(cars)
       *   .where(gt(cars.year, 2000))
       * ```
       *
       * @see gte for greater-than-or-equal
       */
      const gt = (left, right) => {
        return sql`${left} > ${bindIfParam(right, left)}`;
      };
      /**
       * Test that the first expression passed is greater than
       * or equal to the second expression. Use `gt` to
       * test whether an expression is strictly greater
       * than another.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars made on or after 2000.
       * db.select().from(cars)
       *   .where(gte(cars.year, 2000))
       * ```
       *
       * @see gt for a strictly greater-than condition
       */
      const gte = (left, right) => {
        return sql`${left} >= ${bindIfParam(right, left)}`;
      };
      /**
       * Test that the first expression passed is less than
       * the second expression.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars made before 2000.
       * db.select().from(cars)
       *   .where(lt(cars.year, 2000))
       * ```
       *
       * @see lte for greater-than-or-equal
       */
      const lt = (left, right) => {
        return sql`${left} < ${bindIfParam(right, left)}`;
      };
      /**
       * Test that the first expression passed is less than
       * or equal to the second expression.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars made before 2000.
       * db.select().from(cars)
       *   .where(lte(cars.year, 2000))
       * ```
       *
       * @see lt for a strictly less-than condition
       */
      const lte = (left, right) => {
        return sql`${left} <= ${bindIfParam(right, left)}`;
      };
      function inArray(column, values) {
        if (Array.isArray(values)) {
          if (values.length === 0) {
            throw new Error("inArray requires at least one value");
          }
          return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
        }
        return sql`${column} in ${bindIfParam(values, column)}`;
      }
      function notInArray(column, values) {
        if (Array.isArray(values)) {
          if (values.length === 0) {
            throw new Error("notInArray requires at least one value");
          }
          return sql`${column} not in ${values.map((v) =>
            bindIfParam(v, column)
          )}`;
        }
        return sql`${column} not in ${bindIfParam(values, column)}`;
      }
      /**
       * Test whether an expression is NULL. By the SQL standard,
       * NULL is neither equal nor not equal to itself, so
       * it's recommended to use `isNull` and `notIsNull` for
       * comparisons to NULL.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars that have no discontinuedAt date.
       * db.select().from(cars)
       *   .where(isNull(cars.discontinuedAt))
       * ```
       *
       * @see isNotNull for the inverse of this test
       */
      function isNull(value) {
        return sql`${value} is null`;
      }
      /**
       * Test whether an expression is not NULL. By the SQL standard,
       * NULL is neither equal nor not equal to itself, so
       * it's recommended to use `isNull` and `notIsNull` for
       * comparisons to NULL.
       *
       * ## Examples
       *
       * ```ts
       * // Select cars that have been discontinued.
       * db.select().from(cars)
       *   .where(isNotNull(cars.discontinuedAt))
       * ```
       *
       * @see isNull for the inverse of this test
       */
      function isNotNull(value) {
        return sql`${value} is not null`;
      }
      /**
       * Test whether a subquery evaluates to have any rows.
       *
       * ## Examples
       *
       * ```ts
       * // Users whose `homeCity` column has a match in a cities
       * // table.
       * db
       *   .select()
       *   .from(users)
       *   .where(
       *     exists(db.select()
       *       .from(cities)
       *       .where(eq(users.homeCity, cities.id))),
       *   );
       * ```
       *
       * @see notExists for the inverse of this test
       */
      function exists(subquery) {
        return sql`exists (${subquery})`;
      }
      /**
       * Test whether a subquery doesn't include any result
       * rows.
       *
       * ## Examples
       *
       * ```ts
       * // Users whose `homeCity` column doesn't match
       * // a row in the cities table.
       * db
       *   .select()
       *   .from(users)
       *   .where(
       *     notExists(db.select()
       *       .from(cities)
       *       .where(eq(users.homeCity, cities.id))),
       *   );
       * ```
       *
       * @see exists for the inverse of this test
       */
      function notExists(subquery) {
        return sql`not exists (${subquery})`;
      }
      function between(column, min, max) {
        return sql`${column} between ${bindIfParam(
          min,
          column
        )} and ${bindIfParam(max, column)}`;
      }
      function notBetween(column, min, max) {
        return sql`${column} not between ${bindIfParam(
          min,
          column
        )} and ${bindIfParam(max, column)}`;
      }
      /**
       * Compare a column to a pattern, which can include `%` and `_`
       * characters to match multiple variations. Including `%`
       * in the pattern matches zero or more characters, and including
       * `_` will match a single character.
       *
       * ## Examples
       *
       * ```ts
       * // Select all cars with 'Turbo' in their names.
       * db.select().from(cars)
       *   .where(like(cars.name, '%Turbo%'))
       * ```
       *
       * @see ilike for a case-insensitive version of this condition
       */
      function like(column, value) {
        return sql`${column} like ${value}`;
      }
      /**
       * The inverse of like - this tests that a given column
       * does not match a pattern, which can include `%` and `_`
       * characters to match multiple variations. Including `%`
       * in the pattern matches zero or more characters, and including
       * `_` will match a single character.
       *
       * ## Examples
       *
       * ```ts
       * // Select all cars that don't have "ROver" in their name.
       * db.select().from(cars)
       *   .where(notLike(cars.name, '%Rover%'))
       * ```
       *
       * @see like for the inverse condition
       * @see notIlike for a case-insensitive version of this condition
       */
      function notLike(column, value) {
        return sql`${column} not like ${value}`;
      }
      /**
       * Case-insensitively compare a column to a pattern,
       * which can include `%` and `_`
       * characters to match multiple variations. Including `%`
       * in the pattern matches zero or more characters, and including
       * `_` will match a single character.
       *
       * Unlike like, this performs a case-insensitive comparison.
       *
       * ## Examples
       *
       * ```ts
       * // Select all cars with 'Turbo' in their names.
       * db.select().from(cars)
       *   .where(ilike(cars.name, '%Turbo%'))
       * ```
       *
       * @see like for a case-sensitive version of this condition
       */
      function ilike(column, value) {
        return sql`${column} ilike ${value}`;
      }
      /**
       * The inverse of ilike - this case-insensitively tests that a given column
       * does not match a pattern, which can include `%` and `_`
       * characters to match multiple variations. Including `%`
       * in the pattern matches zero or more characters, and including
       * `_` will match a single character.
       *
       * ## Examples
       *
       * ```ts
       * // Select all cars that don't have "Rover" in their name.
       * db.select().from(cars)
       *   .where(notLike(cars.name, '%Rover%'))
       * ```
       *
       * @see ilike for the inverse condition
       * @see notLike for a case-sensitive version of this condition
       */
      function notIlike(column, value) {
        return sql`${column} not ilike ${value}`;
      }
      function arrayContains(column, values) {
        if (Array.isArray(values)) {
          if (values.length === 0) {
            throw new Error("arrayContains requires at least one value");
          }
          const array = sql`${bindIfParam(values, column)}`;
          return sql`${column} @> ${array}`;
        }
        return sql`${column} @> ${bindIfParam(values, column)}`;
      }
      function arrayContained(column, values) {
        if (Array.isArray(values)) {
          if (values.length === 0) {
            throw new Error("arrayContained requires at least one value");
          }
          const array = sql`${bindIfParam(values, column)}`;
          return sql`${column} <@ ${array}`;
        }
        return sql`${column} <@ ${bindIfParam(values, column)}`;
      }
      function arrayOverlaps(column, values) {
        if (Array.isArray(values)) {
          if (values.length === 0) {
            throw new Error("arrayOverlaps requires at least one value");
          }
          const array = sql`${bindIfParam(values, column)}`;
          return sql`${column} && ${array}`;
        }
        return sql`${column} && ${bindIfParam(values, column)}`;
      }

      /**
       * Used in sorting, this specifies that the given
       * column or expression should be sorted in ascending
       * order. By the SQL standard, ascending order is the
       * default, so it is not usually necessary to specify
       * ascending sort order.
       *
       * ## Examples
       *
       * ```ts
       * // Return cars, starting with the oldest models
       * // and going in ascending order to the newest.
       * db.select().from(cars)
       *   .orderBy(asc(cars.year));
       * ```
       *
       * @see desc to sort in descending order
       */
      function asc(column) {
        return sql`${column} asc`;
      }
      /**
       * Used in sorting, this specifies that the given
       * column or expression should be sorted in descending
       * order.
       *
       * ## Examples
       *
       * ```ts
       * // Select users, with the most recently created
       * // records coming first.
       * db.select().from(users)
       *   .orderBy(desc(users.createdAt));
       * ```
       *
       * @see asc to sort in ascending order
       */
      function desc(column) {
        return sql`${column} desc`;
      }

      var _a$1, _b$1, _c$1, _d, _e, _f;
      /**
       * This class is used to indicate a primitive param value that is used in `sql` tag.
       * It is only used on type level and is never instantiated at runtime.
       * If you see a value of this type in the code, its runtime value is actually the primitive param value.
       */
      class FakePrimitiveParam {}
      _a$1 = entityKind;
      FakePrimitiveParam[_a$1] = "FakePrimitiveParam";
      function isSQLWrapper(value) {
        return (
          typeof value === "object" &&
          value !== null &&
          "getSQL" in value &&
          typeof value.getSQL === "function"
        );
      }
      function mergeQueries(queries) {
        const result = { sql: "", params: [] };
        for (const query of queries) {
          result.sql += query.sql;
          result.params.push(...query.params);
          if (query.typings?.length) {
            if (!result.typings) {
              result.typings = [];
            }
            result.typings.push(...query.typings);
          }
        }
        return result;
      }
      class StringChunk {
        constructor(value) {
          this.value = Array.isArray(value) ? value : [value];
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _b$1 = entityKind;
      StringChunk[_b$1] = "StringChunk";
      class SQL {
        constructor(queryChunks) {
          this.queryChunks = queryChunks;
          /** @internal */
          this.decoder = noopDecoder;
          this.shouldInlineParams = false;
        }
        append(query) {
          this.queryChunks.push(...query.queryChunks);
          return this;
        }
        toQuery(config) {
          return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
            const query = this.buildQueryFromSourceParams(
              this.queryChunks,
              config
            );
            span?.setAttributes({
              "drizzle.query.text": query.sql,
              "drizzle.query.params": JSON.stringify(query.params),
            });
            return query;
          });
        }
        buildQueryFromSourceParams(chunks, _config) {
          const config = Object.assign({}, _config, {
            inlineParams: _config.inlineParams || this.shouldInlineParams,
            paramStartIndex: _config.paramStartIndex || { value: 0 },
          });
          const {
            escapeName,
            escapeParam,
            prepareTyping,
            inlineParams,
            paramStartIndex,
          } = config;
          return mergeQueries(
            chunks.map((chunk) => {
              if (is(chunk, StringChunk)) {
                return { sql: chunk.value.join(""), params: [] };
              }
              if (is(chunk, Name)) {
                return { sql: escapeName(chunk.value), params: [] };
              }
              if (chunk === undefined) {
                return { sql: "", params: [] };
              }
              if (Array.isArray(chunk)) {
                const result = [new StringChunk("(")];
                for (const [i, p] of chunk.entries()) {
                  result.push(p);
                  if (i < chunk.length - 1) {
                    result.push(new StringChunk(", "));
                  }
                }
                result.push(new StringChunk(")"));
                return this.buildQueryFromSourceParams(result, config);
              }
              if (is(chunk, SQL)) {
                return this.buildQueryFromSourceParams(chunk.queryChunks, {
                  ...config,
                  inlineParams: inlineParams || chunk.shouldInlineParams,
                });
              }
              if (is(chunk, Table)) {
                const schemaName = chunk[Table.Symbol.Schema];
                const tableName = chunk[Table.Symbol.Name];
                return {
                  sql:
                    schemaName === undefined
                      ? escapeName(tableName)
                      : escapeName(schemaName) + "." + escapeName(tableName),
                  params: [],
                };
              }
              if (is(chunk, Column)) {
                return {
                  sql:
                    escapeName(chunk.table[Table.Symbol.Name]) +
                    "." +
                    escapeName(chunk.name),
                  params: [],
                };
              }
              if (is(chunk, View)) {
                const schemaName = chunk[ViewBaseConfig].schema;
                const viewName = chunk[ViewBaseConfig].name;
                return {
                  sql:
                    schemaName === undefined
                      ? escapeName(viewName)
                      : escapeName(schemaName) + "." + escapeName(viewName),
                  params: [],
                };
              }
              if (is(chunk, Param)) {
                const mappedValue =
                  chunk.value === null
                    ? null
                    : chunk.encoder.mapToDriverValue(chunk.value);
                if (is(mappedValue, SQL)) {
                  return this.buildQueryFromSourceParams([mappedValue], config);
                }
                if (inlineParams) {
                  return {
                    sql: this.mapInlineParam(mappedValue, config),
                    params: [],
                  };
                }
                let typings;
                if (prepareTyping !== undefined) {
                  typings = [prepareTyping(chunk.encoder)];
                }
                return {
                  sql: escapeParam(paramStartIndex.value++, mappedValue),
                  params: [mappedValue],
                  typings,
                };
              }
              if (is(chunk, Placeholder)) {
                return {
                  sql: escapeParam(paramStartIndex.value++, chunk),
                  params: [chunk],
                };
              }
              if (is(chunk, SQL.Aliased) && chunk.fieldAlias !== undefined) {
                return { sql: escapeName(chunk.fieldAlias), params: [] };
              }
              if (is(chunk, Subquery)) {
                if (chunk[SubqueryConfig].isWith) {
                  return {
                    sql: escapeName(chunk[SubqueryConfig].alias),
                    params: [],
                  };
                }
                return this.buildQueryFromSourceParams(
                  [
                    new StringChunk("("),
                    chunk[SubqueryConfig].sql,
                    new StringChunk(") "),
                    new Name(chunk[SubqueryConfig].alias),
                  ],
                  config
                );
              }
              // if (is(chunk, Placeholder)) {
              // 	return {sql: escapeParam}
              if (isSQLWrapper(chunk)) {
                return this.buildQueryFromSourceParams(
                  [new StringChunk("("), chunk.getSQL(), new StringChunk(")")],
                  config
                );
              }
              if (is(chunk, Relation)) {
                return this.buildQueryFromSourceParams(
                  [
                    chunk.sourceTable,
                    new StringChunk("."),
                    sql.identifier(chunk.fieldName),
                  ],
                  config
                );
              }
              if (inlineParams) {
                return { sql: this.mapInlineParam(chunk, config), params: [] };
              }
              return {
                sql: escapeParam(paramStartIndex.value++, chunk),
                params: [chunk],
              };
            })
          );
        }
        mapInlineParam(chunk, { escapeString }) {
          if (chunk === null) {
            return "null";
          }
          if (typeof chunk === "number" || typeof chunk === "boolean") {
            return chunk.toString();
          }
          if (typeof chunk === "string") {
            return escapeString(chunk);
          }
          if (typeof chunk === "object") {
            const mappedValueAsString = chunk.toString();
            if (mappedValueAsString === "[object Object]") {
              return escapeString(JSON.stringify(chunk));
            }
            return escapeString(mappedValueAsString);
          }
          throw new Error("Unexpected param value: " + chunk);
        }
        getSQL() {
          return this;
        }
        as(alias) {
          // TODO: remove with deprecated overloads
          if (alias === undefined) {
            return this;
          }
          return new SQL.Aliased(this, alias);
        }
        mapWith(decoder) {
          this.decoder =
            typeof decoder === "function"
              ? { mapFromDriverValue: decoder }
              : decoder;
          return this;
        }
        inlineParams() {
          this.shouldInlineParams = true;
          return this;
        }
      }
      _c$1 = entityKind;
      SQL[_c$1] = "SQL";
      /**
       * Any DB name (table, column, index etc.)
       */
      class Name {
        constructor(value) {
          this.value = value;
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _d = entityKind;
      Name[_d] = "Name";
      /**
       * Any DB name (table, column, index etc.)
       * @deprecated Use `sql.identifier` instead.
       */
      function name(value) {
        return new Name(value);
      }
      function isDriverValueEncoder(value) {
        return (
          typeof value === "object" &&
          value !== null &&
          "mapToDriverValue" in value &&
          typeof value.mapToDriverValue === "function"
        );
      }
      const noopDecoder = {
        mapFromDriverValue: (value) => value,
      };
      const noopEncoder = {
        mapToDriverValue: (value) => value,
      };
      const noopMapper = {
        ...noopDecoder,
        ...noopEncoder,
      };
      /** Parameter value that is optionally bound to an encoder (for example, a column). */
      class Param {
        /**
         * @param value - Parameter value
         * @param encoder - Encoder to convert the value to a driver parameter
         */
        constructor(value, encoder = noopEncoder) {
          this.value = value;
          this.encoder = encoder;
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _e = entityKind;
      Param[_e] = "Param";
      /** @deprecated Use `sql.param` instead. */
      function param(value, encoder) {
        return new Param(value, encoder);
      }
      /*
    The type of `params` is specified as `SQLSourceParam[]`, but that's slightly incorrect -
    in runtime, users won't pass `FakePrimitiveParam` instances as `params` - they will pass primitive values
    which will be wrapped in `Param` using `buildChunksFromParam(...)`. That's why the overload
    specify `params` as `any[]` and not as `SQLSourceParam[]`. This type is used to make our lives easier and
    the type checker happy.
*/
      function sql(strings, ...params) {
        const queryChunks = [];
        if (params.length > 0 || (strings.length > 0 && strings[0] !== "")) {
          queryChunks.push(new StringChunk(strings[0]));
        }
        for (const [paramIndex, param] of params.entries()) {
          queryChunks.push(param, new StringChunk(strings[paramIndex + 1]));
        }
        return new SQL(queryChunks);
      }
      (function (sql) {
        function empty() {
          return new SQL([]);
        }
        sql.empty = empty;
        /** @deprecated - use `sql.join()` */
        function fromList(list) {
          return new SQL(list);
        }
        sql.fromList = fromList;
        /**
         * Convenience function to create an SQL query from a raw string.
         * @param str The raw SQL query string.
         */
        function raw(str) {
          return new SQL([new StringChunk(str)]);
        }
        sql.raw = raw;
        /**
         * Join a list of SQL chunks with a separator.
         * @example
         * ```ts
         * const query = sql.join([sql`a`, sql`b`, sql`c`]);
         * // sql`abc`
         * ```
         * @example
         * ```ts
         * const query = sql.join([sql`a`, sql`b`, sql`c`], sql`, `);
         * // sql`a, b, c`
         * ```
         */
        function join(chunks, separator) {
          const result = [];
          for (const [i, chunk] of chunks.entries()) {
            if (i > 0 && separator !== undefined) {
              result.push(separator);
            }
            result.push(chunk);
          }
          return new SQL(result);
        }
        sql.join = join;
        /**
         * Create a SQL chunk that represents a DB identifier (table, column, index etc.).
         * When used in a query, the identifier will be escaped based on the DB engine.
         * For example, in PostgreSQL, identifiers are escaped with double quotes.
         *
         * **WARNING: This function does not offer any protection against SQL injections, so you must validate any user input beforehand.**
         *
         * @example ```ts
         * const query = sql`SELECT * FROM ${sql.identifier('my-table')}`;
         * // 'SELECT * FROM "my-table"'
         * ```
         */
        function identifier(value) {
          return new Name(value);
        }
        sql.identifier = identifier;
        function placeholder(name) {
          return new Placeholder(name);
        }
        sql.placeholder = placeholder;
        function param(value, encoder) {
          return new Param(value, encoder);
        }
        sql.param = param;
      })(sql || (sql = {}));
      (function (SQL) {
        var _g;
        class Aliased {
          constructor(sql, fieldAlias) {
            this.sql = sql;
            this.fieldAlias = fieldAlias;
            /** @internal */
            this.isSelectionField = false;
          }
          getSQL() {
            return this.sql;
          }
          /** @internal */
          clone() {
            return new Aliased(this.sql, this.fieldAlias);
          }
        }
        _g = entityKind;
        Aliased[_g] = "SQL.Aliased";
        SQL.Aliased = Aliased;
      })(SQL || (SQL = {}));
      class Placeholder {
        constructor(name) {
          this.name = name;
        }
        getSQL() {
          return new SQL([this]);
        }
      }
      _f = entityKind;
      Placeholder[_f] = "Placeholder";
      /** @deprecated Use `sql.placeholder` instead. */
      function placeholder(name) {
        return new Placeholder(name);
      }
      function fillPlaceholders(params, values) {
        return params.map((p) => {
          if (is(p, Placeholder)) {
            if (!(p.name in values)) {
              throw new Error(
                `No value for placeholder "${p.name}" was provided`
              );
            }
            return values[p.name];
          }
          return p;
        });
      }
      // Defined separately from the Column class to resolve circular dependency
      Column.prototype.getSQL = function () {
        return new SQL([this]);
      };

      var _a, _b, _c;
      class ColumnAliasProxyHandler {
        constructor(table) {
          this.table = table;
        }
        get(columnObj, prop) {
          if (prop === "table") {
            return this.table;
          }
          return columnObj[prop];
        }
      }
      _a = entityKind;
      ColumnAliasProxyHandler[_a] = "ColumnAliasProxyHandler";
      class TableAliasProxyHandler {
        constructor(alias, replaceOriginalName) {
          this.alias = alias;
          this.replaceOriginalName = replaceOriginalName;
        }
        get(target, prop) {
          if (prop === Table.Symbol.IsAlias) {
            return true;
          }
          if (prop === Table.Symbol.Name) {
            return this.alias;
          }
          if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
            return this.alias;
          }
          if (prop === ViewBaseConfig) {
            return {
              ...target[ViewBaseConfig],
              name: this.alias,
              isAlias: true,
            };
          }
          if (prop === Table.Symbol.Columns) {
            const columns = target[Table.Symbol.Columns];
            if (!columns) {
              return columns;
            }
            const proxiedColumns = {};
            Object.keys(columns).map((key) => {
              proxiedColumns[key] = new Proxy(
                columns[key],
                new ColumnAliasProxyHandler(new Proxy(target, this))
              );
            });
            return proxiedColumns;
          }
          const value = target[prop];
          if (is(value, Column)) {
            return new Proxy(
              value,
              new ColumnAliasProxyHandler(new Proxy(target, this))
            );
          }
          return value;
        }
      }
      _b = entityKind;
      TableAliasProxyHandler[_b] = "TableAliasProxyHandler";
      class RelationTableAliasProxyHandler {
        constructor(alias) {
          this.alias = alias;
        }
        get(target, prop) {
          if (prop === "sourceTable") {
            return aliasedTable(target.sourceTable, this.alias);
          }
          return target[prop];
        }
      }
      _c = entityKind;
      RelationTableAliasProxyHandler[_c] = "RelationTableAliasProxyHandler";
      function aliasedTable(table, tableAlias) {
        return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
      }
      function aliasedRelation(relation, tableAlias) {
        return new Proxy(
          relation,
          new RelationTableAliasProxyHandler(tableAlias)
        );
      }
      function aliasedTableColumn(column, tableAlias) {
        return new Proxy(
          column,
          new ColumnAliasProxyHandler(
            new Proxy(
              column.table,
              new TableAliasProxyHandler(tableAlias, false)
            )
          )
        );
      }
      function mapColumnsInAliasedSQLToAlias(query, alias) {
        return new SQL.Aliased(
          mapColumnsInSQLToAlias(query.sql, alias),
          query.fieldAlias
        );
      }
      function mapColumnsInSQLToAlias(query, alias) {
        return sql.join(
          query.queryChunks.map((c) => {
            if (is(c, Column)) {
              return aliasedTableColumn(c, alias);
            }
            if (is(c, SQL)) {
              return mapColumnsInSQLToAlias(c, alias);
            }
            if (is(c, SQL.Aliased)) {
              return mapColumnsInAliasedSQLToAlias(c, alias);
            }
            return c;
          })
        );
      }

      exports.BaseName = BaseName;
      exports.Check = Check;
      exports.CheckBuilder = CheckBuilder;
      exports.Column = Column;
      exports.ColumnAliasProxyHandler = ColumnAliasProxyHandler;
      exports.ColumnBuilder = ColumnBuilder;
      exports.Columns = Columns;
      exports.ConsoleLogWriter = ConsoleLogWriter;
      exports.DefaultLogger = DefaultLogger;
      exports.DefaultViewBuilderCore = DefaultViewBuilderCore;
      exports.DrizzleError = DrizzleError;
      exports.ExtraConfigBuilder = ExtraConfigBuilder;
      exports.FakePrimitiveParam = FakePrimitiveParam;
      exports.ForeignKey = ForeignKey;
      exports.ForeignKeyBuilder = ForeignKeyBuilder;
      exports.Index = Index;
      exports.IndexBuilder = IndexBuilder;
      exports.IndexBuilderOn = IndexBuilderOn;
      exports.InlineForeignKeys = InlineForeignKeys;
      exports.IsAlias = IsAlias;
      exports.ManualMaterializedViewBuilder = ManualMaterializedViewBuilder;
      exports.ManualViewBuilder = ManualViewBuilder;
      exports.Many = Many;
      exports.MaterializedViewBuilder = MaterializedViewBuilder;
      exports.MaterializedViewBuilderCore = MaterializedViewBuilderCore;
      exports.Name = Name;
      exports.NoopLogger = NoopLogger;
      exports.One = One;
      exports.OriginalName = OriginalName;
      exports.Param = Param;
      exports.PgArray = PgArray;
      exports.PgArrayBuilder = PgArrayBuilder;
      exports.PgBigInt53 = PgBigInt53;
      exports.PgBigInt53Builder = PgBigInt53Builder;
      exports.PgBigInt64 = PgBigInt64;
      exports.PgBigInt64Builder = PgBigInt64Builder;
      exports.PgBigSerial53 = PgBigSerial53;
      exports.PgBigSerial53Builder = PgBigSerial53Builder;
      exports.PgBigSerial64 = PgBigSerial64;
      exports.PgBigSerial64Builder = PgBigSerial64Builder;
      exports.PgBoolean = PgBoolean;
      exports.PgBooleanBuilder = PgBooleanBuilder;
      exports.PgChar = PgChar;
      exports.PgCharBuilder = PgCharBuilder;
      exports.PgCidr = PgCidr;
      exports.PgCidrBuilder = PgCidrBuilder;
      exports.PgColumn = PgColumn;
      exports.PgColumnBuilder = PgColumnBuilder;
      exports.PgCustomColumn = PgCustomColumn;
      exports.PgCustomColumnBuilder = PgCustomColumnBuilder;
      exports.PgDatabase = PgDatabase;
      exports.PgDate = PgDate;
      exports.PgDateBuilder = PgDateBuilder;
      exports.PgDateString = PgDateString;
      exports.PgDateStringBuilder = PgDateStringBuilder;
      exports.PgDelete = PgDelete;
      exports.PgDialect = PgDialect;
      exports.PgDoublePrecision = PgDoublePrecision;
      exports.PgDoublePrecisionBuilder = PgDoublePrecisionBuilder;
      exports.PgEnumColumn = PgEnumColumn;
      exports.PgEnumColumnBuilder = PgEnumColumnBuilder;
      exports.PgInet = PgInet;
      exports.PgInetBuilder = PgInetBuilder;
      exports.PgInsert = PgInsert;
      exports.PgInsertBuilder = PgInsertBuilder;
      exports.PgInteger = PgInteger;
      exports.PgIntegerBuilder = PgIntegerBuilder;
      exports.PgInterval = PgInterval;
      exports.PgIntervalBuilder = PgIntervalBuilder;
      exports.PgJson = PgJson;
      exports.PgJsonBuilder = PgJsonBuilder;
      exports.PgJsonb = PgJsonb;
      exports.PgJsonbBuilder = PgJsonbBuilder;
      exports.PgMacaddr = PgMacaddr;
      exports.PgMacaddr8 = PgMacaddr8;
      exports.PgMacaddr8Builder = PgMacaddr8Builder;
      exports.PgMacaddrBuilder = PgMacaddrBuilder;
      exports.PgMaterializedView = PgMaterializedView;
      exports.PgMaterializedViewConfig = PgMaterializedViewConfig;
      exports.PgNumeric = PgNumeric;
      exports.PgNumericBuilder = PgNumericBuilder;
      exports.PgReal = PgReal;
      exports.PgRealBuilder = PgRealBuilder;
      exports.PgRefreshMaterializedView = PgRefreshMaterializedView;
      exports.PgSchema = PgSchema;
      exports.PgSelect = PgSelect;
      exports.PgSelectBuilder = PgSelectBuilder;
      exports.PgSelectQueryBuilder = PgSelectQueryBuilder;
      exports.PgSerial = PgSerial;
      exports.PgSerialBuilder = PgSerialBuilder;
      exports.PgSession = PgSession;
      exports.PgSmallInt = PgSmallInt;
      exports.PgSmallIntBuilder = PgSmallIntBuilder;
      exports.PgSmallSerial = PgSmallSerial;
      exports.PgSmallSerialBuilder = PgSmallSerialBuilder;
      exports.PgTable = PgTable;
      exports.PgText = PgText;
      exports.PgTextBuilder = PgTextBuilder;
      exports.PgTime = PgTime;
      exports.PgTimeBuilder = PgTimeBuilder;
      exports.PgTimestamp = PgTimestamp;
      exports.PgTimestampBuilder = PgTimestampBuilder;
      exports.PgTimestampString = PgTimestampString;
      exports.PgTimestampStringBuilder = PgTimestampStringBuilder;
      exports.PgTransaction = PgTransaction;
      exports.PgUUID = PgUUID;
      exports.PgUUIDBuilder = PgUUIDBuilder;
      exports.PgUpdate = PgUpdate;
      exports.PgUpdateBuilder = PgUpdateBuilder;
      exports.PgVarchar = PgVarchar;
      exports.PgVarcharBuilder = PgVarcharBuilder;
      exports.PgView = PgView;
      exports.PgViewBase = PgViewBase;
      exports.PgViewConfig = PgViewConfig;
      exports.Placeholder = Placeholder;
      exports.PreparedQuery = PreparedQuery;
      exports.PrimaryKey = PrimaryKey;
      exports.PrimaryKeyBuilder = PrimaryKeyBuilder;
      exports.QueryBuilder = QueryBuilder;
      exports.QueryPromise = QueryPromise;
      exports.Relation = Relation;
      exports.RelationTableAliasProxyHandler = RelationTableAliasProxyHandler;
      exports.Relations = Relations;
      exports.SQL = SQL;
      exports.Schema = Schema;
      exports.SelectionProxyHandler = SelectionProxyHandler;
      exports.StringChunk = StringChunk;
      exports.Subquery = Subquery;
      exports.SubqueryConfig = SubqueryConfig;
      exports.Table = Table;
      exports.TableAliasProxyHandler = TableAliasProxyHandler;
      exports.TableName = TableName;
      exports.TransactionRollbackError = TransactionRollbackError;
      exports.TypedQueryBuilder = TypedQueryBuilder;
      exports.UniqueConstraint = UniqueConstraint;
      exports.UniqueConstraintBuilder = UniqueConstraintBuilder;
      exports.UniqueOnConstraintBuilder = UniqueOnConstraintBuilder;
      exports.View = View;
      exports.ViewBaseConfig = ViewBaseConfig;
      exports.ViewBuilder = ViewBuilder;
      exports.WithSubquery = WithSubquery;
      exports.aliasedRelation = aliasedRelation;
      exports.aliasedTable = aliasedTable;
      exports.aliasedTableColumn = aliasedTableColumn;
      exports.and = and;
      exports.applyMixins = applyMixins;
      exports.arrayContained = arrayContained;
      exports.arrayContains = arrayContains;
      exports.arrayOverlaps = arrayOverlaps;
      exports.asc = asc;
      exports.between = between;
      exports.bigint = bigint;
      exports.bigserial = bigserial;
      exports.bindIfParam = bindIfParam;
      exports.boolean = boolean;
      exports.char = char;
      exports.check = check;
      exports.cidr = cidr;
      exports.createMany = createMany;
      exports.createOne = createOne;
      exports.createTableRelationsHelpers = createTableRelationsHelpers;
      exports.customType = customType;
      exports.date = date;
      exports.decimal = decimal;
      exports.desc = desc;
      exports.doublePrecision = doublePrecision;
      exports.entityKind = entityKind;
      exports.eq = eq;
      exports.exists = exists;
      exports.extractTablesRelationalConfig = extractTablesRelationalConfig;
      exports.fillPlaceholders = fillPlaceholders;
      exports.foreignKey = foreignKey;
      exports.getMaterializedViewConfig = getMaterializedViewConfig;
      exports.getOperators = getOperators;
      exports.getOrderByOperators = getOrderByOperators;
      exports.getTableColumns = getTableColumns;
      exports.getTableConfig = getTableConfig;
      exports.getTableLikeName = getTableLikeName;
      exports.getTableName = getTableName;
      exports.getViewConfig = getViewConfig;
      exports.gt = gt;
      exports.gte = gte;
      exports.hasOwnEntityKind = hasOwnEntityKind;
      exports.iife = iife;
      exports.ilike = ilike;
      exports.inArray = inArray;
      exports.index = index;
      exports.inet = inet;
      exports.integer = integer;
      exports.interval = interval;
      exports.is = is;
      exports.isDriverValueEncoder = isDriverValueEncoder;
      exports.isNotNull = isNotNull;
      exports.isNull = isNull;
      exports.isPgEnum = isPgEnum;
      exports.isPgSchema = isPgSchema;
      exports.isSQLWrapper = isSQLWrapper;
      exports.isTable = isTable;
      exports.json = json;
      exports.jsonb = jsonb;
      exports.like = like;
      exports.lt = lt;
      exports.lte = lte;
      exports.macaddr = macaddr;
      exports.macaddr8 = macaddr8;
      exports.makePgArray = makePgArray;
      exports.mapColumnsInAliasedSQLToAlias = mapColumnsInAliasedSQLToAlias;
      exports.mapColumnsInSQLToAlias = mapColumnsInSQLToAlias;
      exports.mapRelationalRow = mapRelationalRow;
      exports.mapResultRow = mapResultRow;
      exports.mapUpdateSet = mapUpdateSet;
      exports.name = name;
      exports.ne = ne;
      exports.noopDecoder = noopDecoder;
      exports.noopEncoder = noopEncoder;
      exports.noopMapper = noopMapper;
      exports.normalizeRelation = normalizeRelation;
      exports.not = not;
      exports.notBetween = notBetween;
      exports.notExists = notExists;
      exports.notIlike = notIlike;
      exports.notInArray = notInArray;
      exports.notLike = notLike;
      exports.numeric = numeric;
      exports.or = or;
      exports.orderSelectedFields = orderSelectedFields;
      exports.param = param;
      exports.parsePgArray = parsePgArray;
      exports.parsePgNestedArray = parsePgNestedArray;
      exports.pgEnum = pgEnum;
      exports.pgMaterializedView = pgMaterializedView;
      exports.pgMaterializedViewWithSchema = pgMaterializedViewWithSchema;
      exports.pgSchema = pgSchema;
      exports.pgTable = pgTable;
      exports.pgTableCreator = pgTableCreator;
      exports.pgTableWithSchema = pgTableWithSchema;
      exports.pgView = pgView;
      exports.pgViewWithSchema = pgViewWithSchema;
      exports.placeholder = placeholder;
      exports.primaryKey = primaryKey;
      exports.real = real;
      exports.relations = relations;
      exports.serial = serial;
      exports.smallint = smallint;
      exports.smallserial = smallserial;
      exports.sql = sql;
      exports.text = text;
      exports.time = time;
      exports.timestamp = timestamp;
      exports.tracer = tracer;
      exports.unique = unique;
      exports.uniqueIndex = uniqueIndex;
      exports.uniqueKeyName = uniqueKeyName;
      exports.uuid = uuid;
      exports.varchar = varchar;
      //# sourceMappingURL=index-1899b9ae.cjs.map

      /***/
    },
    /* 12 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      const os = __webpack_require__(5);
      const fs = __webpack_require__(3);

      const {
        mergeUserTypes,
        inferType,
        Parameter,
        Identifier,
        Builder,
        toPascal,
        pascal,
        toCamel,
        camel,
        toKebab,
        kebab,
        fromPascal,
        fromCamel,
        fromKebab,
      } = __webpack_require__(13);

      const Connection = __webpack_require__(16);
      const { Query, CLOSE } = __webpack_require__(14);
      const Queue = __webpack_require__(22);
      const { Errors, PostgresError } = __webpack_require__(15);
      const Subscribe = __webpack_require__(24);
      const largeObject = __webpack_require__(25);

      Object.assign(Postgres, {
        PostgresError,
        toPascal,
        pascal,
        toCamel,
        camel,
        toKebab,
        kebab,
        fromPascal,
        fromCamel,
        fromKebab,
        BigInt: {
          to: 20,
          from: [20],
          parse: (x) => BigInt(x), // eslint-disable-line
          serialize: (x) => x.toString(),
        },
      });

      module.exports = Postgres;

      function Postgres(a, b) {
        const options = parseOptions(a, b),
          subscribe =
            options.no_subscribe || Subscribe(Postgres, { ...options });

        let ending = false;

        const queries = Queue(),
          connecting = Queue(),
          reserved = Queue(),
          closed = Queue(),
          ended = Queue(),
          open = Queue(),
          busy = Queue(),
          full = Queue(),
          queues = { connecting, reserved, closed, ended, open, busy, full };

        const connections = [...Array(options.max)].map(() =>
          Connection(options, queues, { onopen, onend, onclose })
        );

        const sql = Sql(handler);

        Object.assign(sql, {
          get parameters() {
            return options.parameters;
          },
          largeObject: largeObject.bind(null, sql),
          subscribe,
          CLOSE,
          END: CLOSE,
          PostgresError,
          options,
          reserve,
          listen,
          begin,
          close,
          end,
        });

        return sql;

        function Sql(handler) {
          handler.debug = options.debug;

          Object.entries(options.types).reduce((acc, [name, type]) => {
            acc[name] = (x) => new Parameter(x, type.to);
            return acc;
          }, typed);

          Object.assign(sql, {
            types: typed,
            typed,
            unsafe,
            notify,
            array,
            json,
            file,
          });

          return sql;

          function typed(value, type) {
            return new Parameter(value, type);
          }

          function sql(strings, ...args) {
            const query =
              strings && Array.isArray(strings.raw)
                ? new Query(strings, args, handler, cancel)
                : typeof strings === "string" && !args.length
                  ? new Identifier(
                      options.transform.column.to
                        ? options.transform.column.to(strings)
                        : strings
                    )
                  : new Builder(strings, args);
            return query;
          }

          function unsafe(string, args = [], options = {}) {
            arguments.length === 2 &&
              !Array.isArray(args) &&
              ((options = args), (args = []));
            const query = new Query([string], args, handler, cancel, {
              prepare: false,
              ...options,
              simple: "simple" in options ? options.simple : args.length === 0,
            });
            return query;
          }

          function file(path, args = [], options = {}) {
            arguments.length === 2 &&
              !Array.isArray(args) &&
              ((options = args), (args = []));
            const query = new Query(
              [],
              args,
              (query) => {
                fs.readFile(path, "utf8", (err, string) => {
                  if (err) return query.reject(err);

                  query.strings = [string];
                  handler(query);
                });
              },
              cancel,
              {
                ...options,
                simple:
                  "simple" in options ? options.simple : args.length === 0,
              }
            );
            return query;
          }
        }

        async function listen(name, fn, onlisten) {
          const listener = { fn, onlisten };

          const sql =
            listen.sql ||
            (listen.sql = Postgres({
              ...options,
              max: 1,
              idle_timeout: null,
              max_lifetime: null,
              fetch_types: false,
              onclose() {
                Object.entries(listen.channels).forEach(
                  ([name, { listeners }]) => {
                    delete listen.channels[name];
                    Promise.all(
                      listeners.map((l) =>
                        listen(name, l.fn, l.onlisten).catch(() => {
                          /* noop */
                        })
                      )
                    );
                  }
                );
              },
              onnotify(c, x) {
                c in listen.channels &&
                  listen.channels[c].listeners.forEach((l) => l.fn(x));
              },
            }));

          const channels = listen.channels || (listen.channels = {}),
            exists = name in channels;

          if (exists) {
            channels[name].listeners.push(listener);
            const result = await channels[name].result;
            listener.onlisten && listener.onlisten();
            return { state: result.state, unlisten };
          }

          channels[name] = {
            result: sql`listen ${sql.unsafe(
              '"' + name.replace(/"/g, '""') + '"'
            )}`,
            listeners: [listener],
          };
          const result = await channels[name].result;
          listener.onlisten && listener.onlisten();
          return { state: result.state, unlisten };

          async function unlisten() {
            if (name in channels === false) return;

            channels[name].listeners = channels[name].listeners.filter(
              (x) => x !== listener
            );
            if (channels[name].listeners.length) return;

            delete channels[name];
            return sql`unlisten ${sql.unsafe(
              '"' + name.replace(/"/g, '""') + '"'
            )}`;
          }
        }

        async function notify(channel, payload) {
          return await sql`select pg_notify(${channel}, ${"" + payload})`;
        }

        async function reserve() {
          const queue = Queue();
          const c = open.length
            ? open.shift()
            : await new Promise((r) => {
                queries.push({ reserve: r });
                closed.length && connect(closed.shift());
              });

          move(c, reserved);
          c.reserved = () =>
            queue.length ? c.execute(queue.shift()) : move(c, reserved);
          c.reserved.release = true;

          const sql = Sql(handler);
          sql.release = () => {
            c.reserved = null;
            onopen(c);
          };

          return sql;

          function handler(q) {
            c.queue === full ? queue.push(q) : c.execute(q) || move(c, full);
          }
        }

        async function begin(options, fn) {
          !fn && ((fn = options), (options = ""));
          const queries = Queue();
          let savepoints = 0,
            connection,
            prepare = null;

          try {
            await sql
              .unsafe("begin " + options.replace(/[^a-z ]/gi, ""), [], {
                onexecute,
              })
              .execute();
            return await Promise.race([
              scope(connection, fn),
              new Promise((_, reject) => (connection.onclose = reject)),
            ]);
          } catch (error) {
            throw error;
          }

          async function scope(c, fn, name) {
            const sql = Sql(handler);
            sql.savepoint = savepoint;
            sql.prepare = (x) => (prepare = x.replace(/[^a-z0-9$-_. ]/gi));
            let uncaughtError, result;

            name && (await sql`savepoint ${sql(name)}`);
            try {
              result = await new Promise((resolve, reject) => {
                const x = fn(sql);
                Promise.resolve(Array.isArray(x) ? Promise.all(x) : x).then(
                  resolve,
                  reject
                );
              });

              if (uncaughtError) throw uncaughtError;
            } catch (e) {
              await (name ? sql`rollback to ${sql(name)}` : sql`rollback`);
              throw (
                (e instanceof PostgresError &&
                  e.code === "25P02" &&
                  uncaughtError) ||
                e
              );
            }

            if (!name) {
              prepare
                ? await sql`prepare transaction '${sql.unsafe(prepare)}'`
                : await sql`commit`;
            }

            return result;

            function savepoint(name, fn) {
              if (name && Array.isArray(name.raw))
                return savepoint((sql) => sql.apply(sql, arguments));

              arguments.length === 1 && ((fn = name), (name = null));
              return scope(
                c,
                fn,
                "s" + savepoints++ + (name ? "_" + name : "")
              );
            }

            function handler(q) {
              q.catch((e) => uncaughtError || (uncaughtError = e));
              c.queue === full
                ? queries.push(q)
                : c.execute(q) || move(c, full);
            }
          }

          function onexecute(c) {
            connection = c;
            move(c, reserved);
            c.reserved = () =>
              queries.length ? c.execute(queries.shift()) : move(c, reserved);
          }
        }

        function move(c, queue) {
          c.queue.remove(c);
          queue.push(c);
          c.queue = queue;
          queue === open ? c.idleTimer.start() : c.idleTimer.cancel();
          return c;
        }

        function json(x) {
          return new Parameter(x, 3802);
        }

        function array(x, type) {
          if (!Array.isArray(x)) return array(Array.from(arguments));

          return new Parameter(
            x,
            type || (x.length ? inferType(x) || 25 : 0),
            options.shared.typeArrayMap
          );
        }

        function handler(query) {
          if (ending)
            return query.reject(
              Errors.connection("CONNECTION_ENDED", options, options)
            );

          if (open.length) return go(open.shift(), query);

          if (closed.length) return connect(closed.shift(), query);

          busy.length ? go(busy.shift(), query) : queries.push(query);
        }

        function go(c, query) {
          return c.execute(query) ? move(c, busy) : move(c, full);
        }

        function cancel(query) {
          return new Promise((resolve, reject) => {
            query.state
              ? query.active
                ? Connection(options).cancel(query.state, resolve, reject)
                : (query.cancelled = { resolve, reject })
              : (queries.remove(query),
                (query.cancelled = true),
                query.reject(
                  Errors.generic(
                    "57014",
                    "canceling statement due to user request"
                  )
                ),
                resolve());
          });
        }

        async function end({ timeout = null } = {}) {
          if (ending) return ending;

          await 1;
          let timer;
          return (ending = Promise.race([
            new Promise(
              (r) =>
                timeout !== null &&
                (timer = setTimeout(destroy, timeout * 1000, r))
            ),
            Promise.all(
              connections
                .map((c) => c.end())
                .concat(
                  listen.sql ? listen.sql.end({ timeout: 0 }) : [],
                  subscribe.sql ? subscribe.sql.end({ timeout: 0 }) : []
                )
            ),
          ]).then(() => clearTimeout(timer)));
        }

        async function close() {
          await Promise.all(connections.map((c) => c.end()));
        }

        async function destroy(resolve) {
          await Promise.all(connections.map((c) => c.terminate()));
          while (queries.length)
            queries
              .shift()
              .reject(Errors.connection("CONNECTION_DESTROYED", options));
          resolve();
        }

        function connect(c, query) {
          move(c, connecting);
          c.connect(query);
          return c;
        }

        function onend(c) {
          move(c, ended);
        }

        function onopen(c) {
          if (queries.length === 0) return move(c, open);

          let max = Math.ceil(queries.length / (connecting.length + 1)),
            ready = true;

          while (ready && queries.length && max-- > 0) {
            const query = queries.shift();
            if (query.reserve) return query.reserve(c);

            ready = c.execute(query);
          }

          ready ? move(c, busy) : move(c, full);
        }

        function onclose(c, e) {
          move(c, closed);
          c.reserved = null;
          c.onclose && (c.onclose(e), (c.onclose = null));
          options.onclose && options.onclose(c.id);
          queries.length && connect(c, queries.shift());
        }
      }

      function parseOptions(a, b) {
        if (a && a.shared) return a;

        const env = process.env, // eslint-disable-line
          o = (!a || typeof a === "string" ? b : a) || {},
          { url, multihost } = parseUrl(a),
          query = [...url.searchParams].reduce(
            (a, [b, c]) => ((a[b] = c), a),
            {}
          ),
          host =
            o.hostname ||
            o.host ||
            multihost ||
            url.hostname ||
            env.PGHOST ||
            "localhost",
          port = o.port || url.port || env.PGPORT || 5432,
          user =
            o.user ||
            o.username ||
            url.username ||
            env.PGUSERNAME ||
            env.PGUSER ||
            osUsername();

        o.no_prepare && (o.prepare = false);
        query.sslmode && ((query.ssl = query.sslmode), delete query.sslmode);
        "timeout" in o &&
          (console.log(
            "The timeout option is deprecated, use idle_timeout instead"
          ),
          (o.idle_timeout = o.timeout)); // eslint-disable-line
        query.sslrootcert === "system" && (query.ssl = "verify-full");

        const ints = [
          "idle_timeout",
          "connect_timeout",
          "max_lifetime",
          "max_pipeline",
          "backoff",
          "keep_alive",
        ];
        const defaults = {
          max: 10,
          ssl: false,
          idle_timeout: null,
          connect_timeout: 30,
          max_lifetime: max_lifetime,
          max_pipeline: 100,
          backoff: backoff,
          keep_alive: 60,
          prepare: true,
          debug: false,
          fetch_types: true,
          publications: "alltables",
          target_session_attrs: null,
        };

        return {
          host: Array.isArray(host)
            ? host
            : host.split(",").map((x) => x.split(":")[0]),
          port: Array.isArray(port)
            ? port
            : host.split(",").map((x) => parseInt(x.split(":")[1] || port)),
          path:
            o.path || (host.indexOf("/") > -1 && host + "/.s.PGSQL." + port),
          database:
            o.database ||
            o.db ||
            (url.pathname || "").slice(1) ||
            env.PGDATABASE ||
            user,
          user: user,
          pass: o.pass || o.password || url.password || env.PGPASSWORD || "",
          ...Object.entries(defaults).reduce((acc, [k, d]) => {
            const value =
              k in o
                ? o[k]
                : k in query
                  ? query[k] === "disable" || query[k] === "false"
                    ? false
                    : query[k]
                  : env["PG" + k.toUpperCase()] || d;
            acc[k] =
              typeof value === "string" && ints.includes(k) ? +value : value;
            return acc;
          }, {}),
          connection: {
            application_name: "postgres.js",
            ...o.connection,
            ...Object.entries(query).reduce(
              (acc, [k, v]) => (k in defaults || (acc[k] = v), acc),
              {}
            ),
          },
          types: o.types || {},
          target_session_attrs: tsa(o, url, env),
          onnotice: o.onnotice,
          onnotify: o.onnotify,
          onclose: o.onclose,
          onparameter: o.onparameter,
          socket: o.socket,
          transform: parseTransform(o.transform || { undefined: undefined }),
          parameters: {},
          shared: { retries: 0, typeArrayMap: {} },
          ...mergeUserTypes(o.types),
        };
      }

      function tsa(o, url, env) {
        const x =
          o.target_session_attrs ||
          url.searchParams.get("target_session_attrs") ||
          env.PGTARGETSESSIONATTRS;
        if (
          !x ||
          [
            "read-write",
            "read-only",
            "primary",
            "standby",
            "prefer-standby",
          ].includes(x)
        )
          return x;

        throw new Error("target_session_attrs " + x + " is not supported");
      }

      function backoff(retries) {
        return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
      }

      function max_lifetime() {
        return 60 * (30 + Math.random() * 30);
      }

      function parseTransform(x) {
        return {
          undefined: x.undefined,
          column: {
            from:
              typeof x.column === "function"
                ? x.column
                : x.column && x.column.from,
            to: x.column && x.column.to,
          },
          value: {
            from:
              typeof x.value === "function" ? x.value : x.value && x.value.from,
            to: x.value && x.value.to,
          },
          row: {
            from: typeof x.row === "function" ? x.row : x.row && x.row.from,
            to: x.row && x.row.to,
          },
        };
      }

      function parseUrl(url) {
        if (!url || typeof url !== "string")
          return { url: { searchParams: new Map() } };

        let host = url;
        host = host.slice(host.indexOf("://") + 3).split(/[?/]/)[0];
        host = decodeURIComponent(host.slice(host.indexOf("@") + 1));

        const urlObj = new URL(url.replace(host, host.split(",")[0]));

        return {
          url: {
            username: decodeURIComponent(urlObj.username),
            password: decodeURIComponent(urlObj.password),
            host: urlObj.host,
            hostname: urlObj.hostname,
            port: urlObj.port,
            pathname: urlObj.pathname,
            searchParams: urlObj.searchParams,
          },
          multihost: host.indexOf(",") > -1 && host,
        };
      }

      function osUsername() {
        try {
          return os.userInfo().username; // eslint-disable-line
        } catch (_) {
          return (
            process.env.USERNAME || process.env.USER || process.env.LOGNAME
          ); // eslint-disable-line
        }
      }

      /***/
    },
    /* 13 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      const { Query } = __webpack_require__(14);
      const { Errors } = __webpack_require__(15);

      const types = (module.exports.types = {
        string: {
          to: 25,
          from: null, // defaults to string
          serialize: (x) => "" + x,
        },
        number: {
          to: 0,
          from: [21, 23, 26, 700, 701],
          serialize: (x) => "" + x,
          parse: (x) => +x,
        },
        json: {
          to: 114,
          from: [114, 3802],
          serialize: (x) => JSON.stringify(x),
          parse: (x) => JSON.parse(x),
        },
        boolean: {
          to: 16,
          from: 16,
          serialize: (x) => (x === true ? "t" : "f"),
          parse: (x) => x === "t",
        },
        date: {
          to: 1184,
          from: [1082, 1114, 1184],
          serialize: (x) => (x instanceof Date ? x : new Date(x)).toISOString(),
          parse: (x) => new Date(x),
        },
        bytea: {
          to: 17,
          from: 17,
          serialize: (x) => "\\x" + Buffer.from(x).toString("hex"),
          parse: (x) => Buffer.from(x.slice(2), "hex"),
        },
      });

      class NotTagged {
        then() {
          notTagged();
        }
        catch() {
          notTagged();
        }
        finally() {
          notTagged();
        }
      }

      const Identifier = (module.exports.Identifier = class Identifier extends (
        NotTagged
      ) {
        constructor(value) {
          super();
          this.value = escapeIdentifier(value);
        }
      });

      const Parameter = (module.exports.Parameter = class Parameter extends (
        NotTagged
      ) {
        constructor(value, type, array) {
          super();
          this.value = value;
          this.type = type;
          this.array = array;
        }
      });

      const Builder = (module.exports.Builder = class Builder extends (
        NotTagged
      ) {
        constructor(first, rest) {
          super();
          this.first = first;
          this.rest = rest;
        }

        build(before, parameters, types, options) {
          const keyword = builders
            .map(([x, fn]) => ({ fn, i: before.search(x) }))
            .sort((a, b) => a.i - b.i)
            .pop();
          return keyword.i === -1
            ? escapeIdentifiers(this.first, options)
            : keyword.fn(this.first, this.rest, parameters, types, options);
        }
      });

      module.exports.handleValue = handleValue;
      function handleValue(x, parameters, types, options) {
        let value = x instanceof Parameter ? x.value : x;
        if (value === undefined) {
          x instanceof Parameter
            ? (x.value = options.transform.undefined)
            : (value = x = options.transform.undefined);

          if (value === undefined)
            throw Errors.generic(
              "UNDEFINED_VALUE",
              "Undefined values are not allowed"
            );
        }

        return (
          "$" +
          types.push(
            x instanceof Parameter
              ? (parameters.push(x.value),
                x.array
                  ? x.array[x.type || inferType(x.value)] ||
                    x.type ||
                    firstIsString(x.value)
                  : x.type)
              : (parameters.push(x), inferType(x))
          )
        );
      }

      const defaultHandlers = typeHandlers(types);

      module.exports.stringify = stringify;
      function stringify(q, string, value, parameters, types, options) {
        // eslint-disable-line
        for (let i = 1; i < q.strings.length; i++) {
          string +=
            stringifyValue(string, value, parameters, types, options) +
            q.strings[i];
          value = q.args[i];
        }

        return string;
      }

      function stringifyValue(string, value, parameters, types, o) {
        return value instanceof Builder
          ? value.build(string, parameters, types, o)
          : value instanceof Query
            ? fragment(value, parameters, types, o)
            : value instanceof Identifier
              ? value.value
              : value && value[0] instanceof Query
                ? value.reduce(
                    (acc, x) => acc + " " + fragment(x, parameters, types, o),
                    ""
                  )
                : handleValue(value, parameters, types, o);
      }

      function fragment(q, parameters, types, options) {
        q.fragment = true;
        return stringify(
          q,
          q.strings[0],
          q.args[0],
          parameters,
          types,
          options
        );
      }

      function valuesBuilder(first, parameters, types, columns, options) {
        return first
          .map(
            (row) =>
              "(" +
              columns
                .map((column) =>
                  stringifyValue(
                    "values",
                    row[column],
                    parameters,
                    types,
                    options
                  )
                )
                .join(",") +
              ")"
          )
          .join(",");
      }

      function values(first, rest, parameters, types, options) {
        const multi = Array.isArray(first[0]);
        const columns = rest.length
          ? rest.flat()
          : Object.keys(multi ? first[0] : first);
        return valuesBuilder(
          multi ? first : [first],
          parameters,
          types,
          columns,
          options
        );
      }

      function select(first, rest, parameters, types, options) {
        typeof first === "string" && (first = [first].concat(rest));
        if (Array.isArray(first)) return escapeIdentifiers(first, options);

        let value;
        const columns = rest.length ? rest.flat() : Object.keys(first);
        return columns
          .map((x) => {
            value = first[x];
            return (
              (value instanceof Query
                ? fragment(value, parameters, types, options)
                : value instanceof Identifier
                  ? value.value
                  : handleValue(value, parameters, types, options)) +
              " as " +
              escapeIdentifier(
                options.transform.column.to ? options.transform.column.to(x) : x
              )
            );
          })
          .join(",");
      }

      const builders = Object.entries({
        values,
        in: (...xs) => {
          const x = values(...xs);
          return x === "()" ? "(null)" : x;
        },
        select,
        as: select,
        returning: select,
        "\\(": select,

        update(first, rest, parameters, types, options) {
          return (rest.length ? rest.flat() : Object.keys(first)).map(
            (x) =>
              escapeIdentifier(
                options.transform.column.to ? options.transform.column.to(x) : x
              ) +
              "=" +
              stringifyValue("values", first[x], parameters, types, options)
          );
        },

        insert(first, rest, parameters, types, options) {
          const columns = rest.length
            ? rest.flat()
            : Object.keys(Array.isArray(first) ? first[0] : first);
          return (
            "(" +
            escapeIdentifiers(columns, options) +
            ")values" +
            valuesBuilder(
              Array.isArray(first) ? first : [first],
              parameters,
              types,
              columns,
              options
            )
          );
        },
      }).map(([x, fn]) => [
        new RegExp("((?:^|[\\s(])" + x + "(?:$|[\\s(]))(?![\\s\\S]*\\1)", "i"),
        fn,
      ]);

      function notTagged() {
        throw Errors.generic(
          "NOT_TAGGED_CALL",
          "Query not called as a tagged template literal"
        );
      }

      const serializers = (module.exports.serializers =
        defaultHandlers.serializers);
      const parsers = (module.exports.parsers = defaultHandlers.parsers);

      const END = (module.exports.END = {});

      function firstIsString(x) {
        if (Array.isArray(x)) return firstIsString(x[0]);
        return typeof x === "string" ? 1009 : 0;
      }

      const mergeUserTypes = (module.exports.mergeUserTypes = function (types) {
        const user = typeHandlers(types || {});
        return {
          serializers: Object.assign({}, serializers, user.serializers),
          parsers: Object.assign({}, parsers, user.parsers),
        };
      });

      function typeHandlers(types) {
        return Object.keys(types).reduce(
          (acc, k) => {
            types[k].from &&
              []
                .concat(types[k].from)
                .forEach((x) => (acc.parsers[x] = types[k].parse));
            if (types[k].serialize) {
              acc.serializers[types[k].to] = types[k].serialize;
              types[k].from &&
                []
                  .concat(types[k].from)
                  .forEach((x) => (acc.serializers[x] = types[k].serialize));
            }
            return acc;
          },
          { parsers: {}, serializers: {} }
        );
      }

      function escapeIdentifiers(xs, { transform: { column } }) {
        return xs
          .map((x) => escapeIdentifier(column.to ? column.to(x) : x))
          .join(",");
      }

      const escapeIdentifier = (module.exports.escapeIdentifier =
        function escape(str) {
          return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"';
        });

      const inferType = (module.exports.inferType = function inferType(x) {
        return x instanceof Parameter
          ? x.type
          : x instanceof Date
            ? 1184
            : x instanceof Uint8Array
              ? 17
              : x === true || x === false
                ? 16
                : typeof x === "bigint"
                  ? 20
                  : Array.isArray(x)
                    ? inferType(x[0])
                    : 0;
      });

      const escapeBackslash = /\\/g;
      const escapeQuote = /"/g;

      function arrayEscape(x) {
        return x.replace(escapeBackslash, "\\\\").replace(escapeQuote, '\\"');
      }

      const arraySerializer = (module.exports.arraySerializer =
        function arraySerializer(xs, serializer, options, typarray) {
          if (Array.isArray(xs) === false) return xs;

          if (!xs.length) return "{}";

          const first = xs[0];
          // Only _box (1020) has the ';' delimiter for arrays, all other types use the ',' delimiter
          const delimiter = typarray === 1020 ? ";" : ",";

          if (Array.isArray(first) && !first.type)
            return (
              "{" +
              xs
                .map((x) => arraySerializer(x, serializer, options, typarray))
                .join(delimiter) +
              "}"
            );

          return (
            "{" +
            xs
              .map((x) => {
                if (x === undefined) {
                  x = options.transform.undefined;
                  if (x === undefined)
                    throw Errors.generic(
                      "UNDEFINED_VALUE",
                      "Undefined values are not allowed"
                    );
                }

                return x === null
                  ? "null"
                  : '"' +
                      arrayEscape(
                        serializer ? serializer(x.type ? x.value : x) : "" + x
                      ) +
                      '"';
              })
              .join(delimiter) +
            "}"
          );
        });

      const arrayParserState = {
        i: 0,
        char: null,
        str: "",
        quoted: false,
        last: 0,
      };

      const arrayParser = (module.exports.arrayParser = function arrayParser(
        x,
        parser,
        typarray
      ) {
        arrayParserState.i = arrayParserState.last = 0;
        return arrayParserLoop(arrayParserState, x, parser, typarray);
      });

      function arrayParserLoop(s, x, parser, typarray) {
        const xs = [];
        // Only _box (1020) has the ';' delimiter for arrays, all other types use the ',' delimiter
        const delimiter = typarray === 1020 ? ";" : ",";
        for (; s.i < x.length; s.i++) {
          s.char = x[s.i];
          if (s.quoted) {
            if (s.char === "\\") {
              s.str += x[++s.i];
            } else if (s.char === '"') {
              xs.push(parser ? parser(s.str) : s.str);
              s.str = "";
              s.quoted = x[s.i + 1] === '"';
              s.last = s.i + 2;
            } else {
              s.str += s.char;
            }
          } else if (s.char === '"') {
            s.quoted = true;
          } else if (s.char === "{") {
            s.last = ++s.i;
            xs.push(arrayParserLoop(s, x, parser, typarray));
          } else if (s.char === "}") {
            s.quoted = false;
            s.last < s.i &&
              xs.push(
                parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i)
              );
            s.last = s.i + 1;
            break;
          } else if (s.char === delimiter && s.p !== "}" && s.p !== '"') {
            xs.push(
              parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i)
            );
            s.last = s.i + 1;
          }
          s.p = s.char;
        }
        s.last < s.i &&
          xs.push(
            parser ? parser(x.slice(s.last, s.i + 1)) : x.slice(s.last, s.i + 1)
          );
        return xs;
      }

      const toCamel = (module.exports.toCamel = (x) => {
        let str = x[0];
        for (let i = 1; i < x.length; i++)
          str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
        return str;
      });

      const toPascal = (module.exports.toPascal = (x) => {
        let str = x[0].toUpperCase();
        for (let i = 1; i < x.length; i++)
          str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
        return str;
      });

      const toKebab = (module.exports.toKebab = (x) => x.replace(/_/g, "-"));

      const fromCamel = (module.exports.fromCamel = (x) =>
        x.replace(/([A-Z])/g, "_$1").toLowerCase());
      const fromPascal = (module.exports.fromPascal = (x) =>
        (x.slice(0, 1) + x.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase());
      const fromKebab = (module.exports.fromKebab = (x) =>
        x.replace(/-/g, "_"));

      function createJsonTransform(fn) {
        return function jsonTransform(x, column) {
          return typeof x === "object" &&
            x !== null &&
            (column.type === 114 || column.type === 3802)
            ? Array.isArray(x)
              ? x.map((x) => jsonTransform(x, column))
              : Object.entries(x).reduce(
                  (acc, [k, v]) =>
                    Object.assign(acc, { [fn(k)]: jsonTransform(v, column) }),
                  {}
                )
            : x;
        };
      }

      toCamel.column = { from: toCamel };
      toCamel.value = { from: createJsonTransform(toCamel) };
      fromCamel.column = { to: fromCamel };

      const camel = (module.exports.camel = { ...toCamel });
      camel.column.to = fromCamel;

      toPascal.column = { from: toPascal };
      toPascal.value = { from: createJsonTransform(toPascal) };
      fromPascal.column = { to: fromPascal };

      const pascal = (module.exports.pascal = { ...toPascal });
      pascal.column.to = fromPascal;

      toKebab.column = { from: toKebab };
      toKebab.value = { from: createJsonTransform(toKebab) };
      fromKebab.column = { to: fromKebab };

      const kebab = (module.exports.kebab = { ...toKebab });
      kebab.column.to = fromKebab;

      /***/
    },
    /* 14 */
    /***/ (module) => {
      const originCache = new Map(),
        originStackCache = new Map(),
        originError = Symbol("OriginError");

      const CLOSE = (module.exports.CLOSE = {});
      const Query = (module.exports.Query = class Query extends Promise {
        constructor(strings, args, handler, canceller, options = {}) {
          let resolve, reject;

          super((a, b) => {
            resolve = a;
            reject = b;
          });

          this.tagged = Array.isArray(strings.raw);
          this.strings = strings;
          this.args = args;
          this.handler = handler;
          this.canceller = canceller;
          this.options = options;

          this.state = null;
          this.statement = null;

          this.resolve = (x) => ((this.active = false), resolve(x));
          this.reject = (x) => ((this.active = false), reject(x));

          this.active = false;
          this.cancelled = null;
          this.executed = false;
          this.signature = "";

          this[originError] = this.handler.debug
            ? new Error()
            : this.tagged && cachedError(this.strings);
        }

        get origin() {
          return (
            (this.handler.debug
              ? this[originError].stack
              : this.tagged && originStackCache.has(this.strings)
                ? originStackCache.get(this.strings)
                : originStackCache
                    .set(this.strings, this[originError].stack)
                    .get(this.strings)) || ""
          );
        }

        static get [Symbol.species]() {
          return Promise;
        }

        cancel() {
          return (
            this.canceller && (this.canceller(this), (this.canceller = null))
          );
        }

        simple() {
          this.options.simple = true;
          this.options.prepare = false;
          return this;
        }

        async readable() {
          this.simple();
          this.streaming = true;
          return this;
        }

        async writable() {
          this.simple();
          this.streaming = true;
          return this;
        }

        cursor(rows = 1, fn) {
          this.options.simple = false;
          if (typeof rows === "function") {
            fn = rows;
            rows = 1;
          }

          this.cursorRows = rows;

          if (typeof fn === "function") return (this.cursorFn = fn), this;

          let prev;
          return {
            [Symbol.asyncIterator]: () => ({
              next: () => {
                if (this.executed && !this.active) return { done: true };

                prev && prev();
                const promise = new Promise((resolve, reject) => {
                  this.cursorFn = (value) => {
                    resolve({ value, done: false });
                    return new Promise((r) => (prev = r));
                  };
                  this.resolve = () => (
                    (this.active = false), resolve({ done: true })
                  );
                  this.reject = (x) => ((this.active = false), reject(x));
                });
                this.execute();
                return promise;
              },
              return() {
                prev && prev(CLOSE);
                return { done: true };
              },
            }),
          };
        }

        describe() {
          this.options.simple = false;
          this.onlyDescribe = this.options.prepare = true;
          return this;
        }

        stream() {
          throw new Error(".stream has been renamed to .forEach");
        }

        forEach(fn) {
          this.forEachFn = fn;
          this.handle();
          return this;
        }

        raw() {
          this.isRaw = true;
          return this;
        }

        values() {
          this.isRaw = "values";
          return this;
        }

        async handle() {
          !this.executed &&
            (this.executed = true) &&
            (await 1) &&
            this.handler(this);
        }

        execute() {
          this.handle();
          return this;
        }

        then() {
          this.handle();
          return super.then.apply(this, arguments);
        }

        catch() {
          this.handle();
          return super.catch.apply(this, arguments);
        }

        finally() {
          this.handle();
          return super.finally.apply(this, arguments);
        }
      });

      function cachedError(xs) {
        if (originCache.has(xs)) return originCache.get(xs);

        const x = Error.stackTraceLimit;
        Error.stackTraceLimit = 4;
        originCache.set(xs, new Error());
        Error.stackTraceLimit = x;
        return originCache.get(xs);
      }

      /***/
    },
    /* 15 */
    /***/ (module) => {
      const PostgresError =
        (module.exports.PostgresError = class PostgresError extends Error {
          constructor(x) {
            super(x.message);
            this.name = this.constructor.name;
            Object.assign(this, x);
          }
        });

      const Errors = (module.exports.Errors = {
        connection,
        postgres,
        generic,
        notSupported,
      });

      function connection(x, options, socket) {
        const { host, port } = socket || options;
        const error = Object.assign(
          new Error("write " + x + " " + (options.path || host + ":" + port)),
          {
            code: x,
            errno: x,
            address: options.path || host,
          },
          options.path ? {} : { port: port }
        );
        Error.captureStackTrace(error, connection);
        return error;
      }

      function postgres(x) {
        const error = new PostgresError(x);
        Error.captureStackTrace(error, postgres);
        return error;
      }

      function generic(code, message) {
        const error = Object.assign(new Error(code + ": " + message), { code });
        Error.captureStackTrace(error, generic);
        return error;
      }

      /* c8 ignore next 10 */
      function notSupported(x) {
        const error = Object.assign(new Error(x + " (B) is not supported"), {
          code: "MESSAGE_NOT_SUPPORTED",
          name: x,
        });
        Error.captureStackTrace(error, notSupported);
        return error;
      }

      /***/
    },
    /* 16 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      const net = __webpack_require__(17);
      const tls = __webpack_require__(18);
      const crypto = __webpack_require__(6);
      const Stream = __webpack_require__(19);
      const { performance } = __webpack_require__(20);

      const { stringify, handleValue, arrayParser, arraySerializer } =
        __webpack_require__(13);
      const { Errors } = __webpack_require__(15);
      const Result = __webpack_require__(21);
      const Queue = __webpack_require__(22);
      const { Query, CLOSE } = __webpack_require__(14);
      const b = __webpack_require__(23);

      module.exports = Connection;

      let uid = 1;

      const Sync = b().S().end(),
        Flush = b().H().end(),
        SSLRequest = b().i32(8).i32(80877103).end(8),
        ExecuteUnnamed = Buffer.concat([b().E().str(b.N).i32(0).end(), Sync]),
        DescribeUnnamed = b().D().str("S").str(b.N).end(),
        noop = () => {
          /* noop */
        };

      const retryRoutines = new Set([
        "FetchPreparedStatement",
        "RevalidateCachedQuery",
        "transformAssignedExpr",
      ]);

      const errorFields = {
        83: "severity_local", // S
        86: "severity", // V
        67: "code", // C
        77: "message", // M
        68: "detail", // D
        72: "hint", // H
        80: "position", // P
        112: "internal_position", // p
        113: "internal_query", // q
        87: "where", // W
        115: "schema_name", // s
        116: "table_name", // t
        99: "column_name", // c
        100: "data type_name", // d
        110: "constraint_name", // n
        70: "file", // F
        76: "line", // L
        82: "routine", // R
      };

      function Connection(
        options,
        queues = {},
        { onopen = noop, onend = noop, onclose = noop } = {}
      ) {
        const {
          ssl,
          max,
          user,
          host,
          port,
          database,
          parsers,
          transform,
          onnotice,
          onnotify,
          onparameter,
          max_pipeline,
          keep_alive,
          backoff,
          target_session_attrs,
        } = options;

        const sent = Queue(),
          id = uid++,
          backend = { pid: null, secret: null },
          idleTimer = timer(end, options.idle_timeout),
          lifeTimer = timer(end, options.max_lifetime),
          connectTimer = timer(connectTimedOut, options.connect_timeout);

        let socket = null,
          cancelMessage,
          result = new Result(),
          incoming = Buffer.alloc(0),
          needsTypes = options.fetch_types,
          backendParameters = {},
          statements = {},
          statementId = Math.random().toString(36).slice(2),
          statementCount = 1,
          closedDate = 0,
          remaining = 0,
          hostIndex = 0,
          retries = 0,
          length = 0,
          delay = 0,
          rows = 0,
          serverSignature = null,
          nextWriteTimer = null,
          terminated = false,
          incomings = null,
          results = null,
          initial = null,
          ending = null,
          stream = null,
          chunk = null,
          ended = null,
          nonce = null,
          query = null,
          final = null;

        const connection = {
          queue: queues.closed,
          idleTimer,
          connect(query) {
            initial = query || true;
            reconnect();
          },
          terminate,
          execute,
          cancel,
          end,
          count: 0,
          id,
        };

        queues.closed && queues.closed.push(connection);

        return connection;

        async function createSocket() {
          let x;
          try {
            x = options.socket
              ? await Promise.resolve(options.socket(options))
              : new net.Socket();
          } catch (e) {
            error(e);
            return;
          }
          x.on("error", error);
          x.on("close", closed);
          x.on("drain", drain);
          return x;
        }

        async function cancel({ pid, secret }, resolve, reject) {
          try {
            cancelMessage = b()
              .i32(16)
              .i32(80877102)
              .i32(pid)
              .i32(secret)
              .end(16);
            await connect();
            socket.once("error", reject);
            socket.once("close", resolve);
          } catch (error) {
            reject(error);
          }
        }

        function execute(q) {
          if (terminated)
            return queryError(
              q,
              Errors.connection("CONNECTION_DESTROYED", options)
            );

          if (q.cancelled) return;

          try {
            q.state = backend;
            query ? sent.push(q) : ((query = q), (query.active = true));

            build(q);
            return (
              write(toBuffer(q)) &&
              !q.describeFirst &&
              !q.cursorFn &&
              sent.length < max_pipeline &&
              (!q.options.onexecute || q.options.onexecute(connection))
            );
          } catch (error) {
            sent.length === 0 && write(Sync);
            errored(error);
            return true;
          }
        }

        function toBuffer(q) {
          if (q.parameters.length >= 65534)
            throw Errors.generic(
              "MAX_PARAMETERS_EXCEEDED",
              "Max number of parameters (65534) exceeded"
            );

          return q.options.simple
            ? b()
                .Q()
                .str(q.statement.string + b.N)
                .end()
            : q.describeFirst
              ? Buffer.concat([describe(q), Flush])
              : q.prepare
                ? q.prepared
                  ? prepared(q)
                  : Buffer.concat([describe(q), prepared(q)])
                : unnamed(q);
        }

        function describe(q) {
          return Buffer.concat([
            Parse(
              q.statement.string,
              q.parameters,
              q.statement.types,
              q.statement.name
            ),
            Describe("S", q.statement.name),
          ]);
        }

        function prepared(q) {
          return Buffer.concat([
            Bind(
              q.parameters,
              q.statement.types,
              q.statement.name,
              q.cursorName
            ),
            q.cursorFn ? Execute("", q.cursorRows) : ExecuteUnnamed,
          ]);
        }

        function unnamed(q) {
          return Buffer.concat([
            Parse(q.statement.string, q.parameters, q.statement.types),
            DescribeUnnamed,
            prepared(q),
          ]);
        }

        function build(q) {
          const parameters = [],
            types = [];

          const string = stringify(
            q,
            q.strings[0],
            q.args[0],
            parameters,
            types,
            options
          );

          !q.tagged &&
            q.args.forEach((x) => handleValue(x, parameters, types, options));

          q.prepare =
            options.prepare &&
            ("prepare" in q.options ? q.options.prepare : true);
          q.string = string;
          q.signature = q.prepare && types + string;
          q.onlyDescribe && delete statements[q.signature];
          q.parameters = q.parameters || parameters;
          q.prepared = q.prepare && q.signature in statements;
          q.describeFirst =
            q.onlyDescribe || (parameters.length && !q.prepared);
          q.statement = q.prepared
            ? statements[q.signature]
            : {
                string,
                types,
                name: q.prepare ? statementId + statementCount++ : "",
              };

          typeof options.debug === "function" &&
            options.debug(id, string, parameters, types);
        }

        function write(x, fn) {
          chunk = chunk ? Buffer.concat([chunk, x]) : Buffer.from(x);
          if (fn || chunk.length >= 1024) return nextWrite(fn);
          nextWriteTimer === null && (nextWriteTimer = setImmediate(nextWrite));
          return true;
        }

        function nextWrite(fn) {
          const x = socket.write(chunk, fn);
          nextWriteTimer !== null && clearImmediate(nextWriteTimer);
          chunk = nextWriteTimer = null;
          return x;
        }

        function connectTimedOut() {
          errored(Errors.connection("CONNECT_TIMEOUT", options, socket));
          socket.destroy();
        }

        async function secure() {
          write(SSLRequest);
          const canSSL = await new Promise((r) =>
            socket.once("data", (x) => r(x[0] === 83))
          ); // S

          if (!canSSL && ssl === "prefer") return connected();

          socket.removeAllListeners();
          socket = tls.connect({
            socket,
            servername: net.isIP(socket.host) ? undefined : socket.host,
            ...(ssl === "require" || ssl === "allow" || ssl === "prefer"
              ? { rejectUnauthorized: false }
              : ssl === "verify-full"
                ? {}
                : typeof ssl === "object"
                  ? ssl
                  : {}),
          });
          socket.on("secureConnect", connected);
          socket.on("error", error);
          socket.on("close", closed);
          socket.on("drain", drain);
        }

        /* c8 ignore next 3 */
        function drain() {
          !query && onopen(connection);
        }

        function data(x) {
          if (incomings) {
            incomings.push(x);
            remaining -= x.length;
            if (remaining >= 0) return;
          }

          incoming = incomings
            ? Buffer.concat(incomings, length - remaining)
            : incoming.length === 0
              ? x
              : Buffer.concat([incoming, x], incoming.length + x.length);

          while (incoming.length > 4) {
            length = incoming.readUInt32BE(1);
            if (length >= incoming.length) {
              remaining = length - incoming.length;
              incomings = [incoming];
              break;
            }

            try {
              handle(incoming.subarray(0, length + 1));
            } catch (e) {
              query && (query.cursorFn || query.describeFirst) && write(Sync);
              errored(e);
            }
            incoming = incoming.subarray(length + 1);
            remaining = 0;
            incomings = null;
          }
        }

        async function connect() {
          terminated = false;
          backendParameters = {};
          socket || (socket = await createSocket());

          if (!socket) return;

          connectTimer.start();

          if (options.socket) return ssl ? secure() : connected();

          socket.on("connect", ssl ? secure : connected);

          if (options.path) return socket.connect(options.path);

          socket.ssl = ssl;
          socket.connect(port[hostIndex], host[hostIndex]);
          socket.host = host[hostIndex];
          socket.port = port[hostIndex];

          hostIndex = (hostIndex + 1) % port.length;
        }

        function reconnect() {
          setTimeout(
            connect,
            closedDate ? closedDate + delay - performance.now() : 0
          );
        }

        function connected() {
          try {
            statements = {};
            needsTypes = options.fetch_types;
            statementId = Math.random().toString(36).slice(2);
            statementCount = 1;
            lifeTimer.start();
            socket.on("data", data);
            keep_alive &&
              socket.setKeepAlive &&
              socket.setKeepAlive(true, 1000 * keep_alive);
            const s = StartupMessage();
            write(s);
          } catch (err) {
            error(err);
          }
        }

        function error(err) {
          if (
            connection.queue === queues.connecting &&
            options.host[retries + 1]
          )
            return;

          errored(err);
          while (sent.length) queryError(sent.shift(), err);
        }

        function errored(err) {
          stream && (stream.destroy(err), (stream = null));
          query && queryError(query, err);
          initial && (queryError(initial, err), (initial = null));
        }

        function queryError(query, err) {
          Object.defineProperties(err, {
            stack: {
              value: err.stack + query.origin.replace(/.*\n/, "\n"),
              enumerable: options.debug,
            },
            query: { value: query.string, enumerable: options.debug },
            parameters: { value: query.parameters, enumerable: options.debug },
            args: { value: query.args, enumerable: options.debug },
            types: {
              value: query.statement && query.statement.types,
              enumerable: options.debug,
            },
          });
          query.reject(err);
        }

        function end() {
          return (
            ending ||
            (!connection.reserved && onend(connection),
            !connection.reserved && !initial && !query && sent.length === 0
              ? (terminate(),
                new Promise((r) =>
                  socket && socket.readyState !== "closed"
                    ? socket.once("close", r)
                    : r()
                ))
              : (ending = new Promise((r) => (ended = r))))
          );
        }

        function terminate() {
          terminated = true;
          if (stream || query || initial || sent.length)
            error(Errors.connection("CONNECTION_DESTROYED", options));

          clearImmediate(nextWriteTimer);
          if (socket) {
            socket.removeListener("data", data);
            socket.removeListener("connect", connected);
            socket.readyState === "open" && socket.end(b().X().end());
          }
          ended && (ended(), (ending = ended = null));
        }

        async function closed(hadError) {
          incoming = Buffer.alloc(0);
          remaining = 0;
          incomings = null;
          clearImmediate(nextWriteTimer);
          socket.removeListener("data", data);
          socket.removeListener("connect", connected);
          idleTimer.cancel();
          lifeTimer.cancel();
          connectTimer.cancel();

          if (socket.encrypted) {
            socket.removeAllListeners();
            socket = null;
          }

          if (initial) return reconnect();

          !hadError &&
            (query || sent.length) &&
            error(Errors.connection("CONNECTION_CLOSED", options, socket));
          closedDate = performance.now();
          hadError && options.shared.retries++;
          delay =
            (typeof backoff === "function"
              ? backoff(options.shared.retries)
              : backoff) * 1000;
          onclose(
            connection,
            Errors.connection("CONNECTION_CLOSED", options, socket)
          );
        }

        /* Handlers */
        function handle(xs, x = xs[0]) {
          (x === 68
            ? DataRow // D
            : x === 100
              ? CopyData // d
              : x === 65
                ? NotificationResponse // A
                : x === 83
                  ? ParameterStatus // S
                  : x === 90
                    ? ReadyForQuery // Z
                    : x === 67
                      ? CommandComplete // C
                      : x === 50
                        ? BindComplete // 2
                        : x === 49
                          ? ParseComplete // 1
                          : x === 116
                            ? ParameterDescription // t
                            : x === 84
                              ? RowDescription // T
                              : x === 82
                                ? Authentication // R
                                : x === 110
                                  ? NoData // n
                                  : x === 75
                                    ? BackendKeyData // K
                                    : x === 69
                                      ? ErrorResponse // E
                                      : x === 115
                                        ? PortalSuspended // s
                                        : x === 51
                                          ? CloseComplete // 3
                                          : x === 71
                                            ? CopyInResponse // G
                                            : x === 78
                                              ? NoticeResponse // N
                                              : x === 72
                                                ? CopyOutResponse // H
                                                : x === 99
                                                  ? CopyDone // c
                                                  : x === 73
                                                    ? EmptyQueryResponse // I
                                                    : x === 86
                                                      ? FunctionCallResponse // V
                                                      : x === 118
                                                        ? NegotiateProtocolVersion // v
                                                        : x === 87
                                                          ? CopyBothResponse // W
                                                          : /* c8 ignore next */
                                                            UnknownMessage)(xs);
        }

        function DataRow(x) {
          let index = 7;
          let length;
          let column;
          let value;

          const row = query.isRaw
            ? new Array(query.statement.columns.length)
            : {};
          for (let i = 0; i < query.statement.columns.length; i++) {
            column = query.statement.columns[i];
            length = x.readInt32BE(index);
            index += 4;

            value =
              length === -1
                ? null
                : query.isRaw === true
                  ? x.subarray(index, (index += length))
                  : column.parser === undefined
                    ? x.toString("utf8", index, (index += length))
                    : column.parser.array === true
                      ? column.parser(
                          x.toString("utf8", index + 1, (index += length))
                        )
                      : column.parser(
                          x.toString("utf8", index, (index += length))
                        );

            query.isRaw
              ? (row[i] =
                  query.isRaw === true
                    ? value
                    : transform.value.from
                      ? transform.value.from(value, column)
                      : value)
              : (row[column.name] = transform.value.from
                  ? transform.value.from(value, column)
                  : value);
          }

          query.forEachFn
            ? query.forEachFn(
                transform.row.from ? transform.row.from(row) : row,
                result
              )
            : (result[rows++] = transform.row.from
                ? transform.row.from(row)
                : row);
        }

        function ParameterStatus(x) {
          const [k, v] = x.toString("utf8", 5, x.length - 1).split(b.N);
          backendParameters[k] = v;
          if (options.parameters[k] !== v) {
            options.parameters[k] = v;
            onparameter && onparameter(k, v);
          }
        }

        function ReadyForQuery(x) {
          query && query.options.simple && query.resolve(results || result);
          query = results = null;
          result = new Result();
          connectTimer.cancel();

          if (initial) {
            if (target_session_attrs) {
              if (
                !backendParameters.in_hot_standby ||
                !backendParameters.default_transaction_read_only
              )
                return fetchState();
              else if (tryNext(target_session_attrs, backendParameters))
                return terminate();
            }

            if (needsTypes) {
              initial === true && (initial = null);
              return fetchArrayTypes();
            }

            initial !== true && execute(initial);
            options.shared.retries = retries = 0;
            initial = null;
            return;
          }

          while (
            sent.length &&
            (query = sent.shift()) &&
            ((query.active = true), query.cancelled)
          )
            Connection(options).cancel(
              query.state,
              query.cancelled.resolve,
              query.cancelled.reject
            );

          if (query) return; // Consider opening if able and sent.length < 50

          connection.reserved
            ? !connection.reserved.release && x[5] === 73 // I
              ? ending
                ? terminate()
                : ((connection.reserved = null), onopen(connection))
              : connection.reserved()
            : ending
              ? terminate()
              : onopen(connection);
        }

        function CommandComplete(x) {
          rows = 0;

          for (let i = x.length - 1; i > 0; i--) {
            if (x[i] === 32 && x[i + 1] < 58 && result.count === null)
              result.count = +x.toString("utf8", i + 1, x.length - 1);
            if (x[i - 1] >= 65) {
              result.command = x.toString("utf8", 5, i);
              result.state = backend;
              break;
            }
          }

          final && (final(), (final = null));

          if (result.command === "BEGIN" && max !== 1 && !connection.reserved)
            return errored(
              Errors.generic(
                "UNSAFE_TRANSACTION",
                "Only use sql.begin, sql.reserved or max: 1"
              )
            );

          if (query.options.simple) return BindComplete();

          if (query.cursorFn) {
            result.count && query.cursorFn(result);
            write(Sync);
          }

          query.resolve(result);
        }

        function ParseComplete() {
          query.parsing = false;
        }

        function BindComplete() {
          !result.statement && (result.statement = query.statement);
          result.columns = query.statement.columns;
        }

        function ParameterDescription(x) {
          const length = x.readUInt16BE(5);

          for (let i = 0; i < length; ++i)
            !query.statement.types[i] &&
              (query.statement.types[i] = x.readUInt32BE(7 + i * 4));

          query.prepare && (statements[query.signature] = query.statement);
          query.describeFirst &&
            !query.onlyDescribe &&
            (write(prepared(query)), (query.describeFirst = false));
        }

        function RowDescription(x) {
          if (result.command) {
            results = results || [result];
            results.push((result = new Result()));
            result.count = null;
            query.statement.columns = null;
          }

          const length = x.readUInt16BE(5);
          let index = 7;
          let start;

          query.statement.columns = Array(length);

          for (let i = 0; i < length; ++i) {
            start = index;
            while (x[index++] !== 0);
            const table = x.readUInt32BE(index);
            const number = x.readUInt16BE(index + 4);
            const type = x.readUInt32BE(index + 6);
            query.statement.columns[i] = {
              name: transform.column.from
                ? transform.column.from(x.toString("utf8", start, index - 1))
                : x.toString("utf8", start, index - 1),
              parser: parsers[type],
              table,
              number,
              type,
            };
            index += 18;
          }

          result.statement = query.statement;
          if (query.onlyDescribe)
            return query.resolve(query.statement), write(Sync);
        }

        async function Authentication(x, type = x.readUInt32BE(5)) {
          (type === 3
            ? AuthenticationCleartextPassword
            : type === 5
              ? AuthenticationMD5Password
              : type === 10
                ? SASL
                : type === 11
                  ? SASLContinue
                  : type === 12
                    ? SASLFinal
                    : type !== 0
                      ? UnknownAuth
                      : noop)(x, type);
        }

        /* c8 ignore next 5 */
        async function AuthenticationCleartextPassword() {
          const payload = await Pass();
          write(b().p().str(payload).z(1).end());
        }

        async function AuthenticationMD5Password(x) {
          const payload =
            "md5" +
            (await md5(
              Buffer.concat([
                Buffer.from(await md5((await Pass()) + user)),
                x.subarray(9),
              ])
            ));
          write(b().p().str(payload).z(1).end());
        }

        async function SASL() {
          nonce = (await crypto.randomBytes(18)).toString("base64");
          b()
            .p()
            .str("SCRAM-SHA-256" + b.N);
          const i = b.i;
          write(
            b
              .inc(4)
              .str("n,,n=*,r=" + nonce)
              .i32(b.i - i - 4, i)
              .end()
          );
        }

        async function SASLContinue(x) {
          const res = x
            .toString("utf8", 9)
            .split(",")
            .reduce((acc, x) => ((acc[x[0]] = x.slice(2)), acc), {});

          const saltedPassword = await crypto.pbkdf2Sync(
            await Pass(),
            Buffer.from(res.s, "base64"),
            parseInt(res.i),
            32,
            "sha256"
          );

          const clientKey = await hmac(saltedPassword, "Client Key");

          const auth =
            "n=*,r=" +
            nonce +
            "," +
            "r=" +
            res.r +
            ",s=" +
            res.s +
            ",i=" +
            res.i +
            ",c=biws,r=" +
            res.r;

          serverSignature = (
            await hmac(await hmac(saltedPassword, "Server Key"), auth)
          ).toString("base64");

          const payload =
            "c=biws,r=" +
            res.r +
            ",p=" +
            xor(
              clientKey,
              Buffer.from(await hmac(await sha256(clientKey), auth))
            ).toString("base64");

          write(b().p().str(payload).end());
        }

        function SASLFinal(x) {
          if (
            x.toString("utf8", 9).split(b.N, 1)[0].slice(2) === serverSignature
          )
            return;
          /* c8 ignore next 5 */
          errored(
            Errors.generic(
              "SASL_SIGNATURE_MISMATCH",
              "The server did not return the correct signature"
            )
          );
          socket.destroy();
        }

        function Pass() {
          return Promise.resolve(
            typeof options.pass === "function" ? options.pass() : options.pass
          );
        }

        function NoData() {
          result.statement = query.statement;
          result.statement.columns = [];
          if (query.onlyDescribe)
            return query.resolve(query.statement), write(Sync);
        }

        function BackendKeyData(x) {
          backend.pid = x.readUInt32BE(5);
          backend.secret = x.readUInt32BE(9);
        }

        async function fetchArrayTypes() {
          needsTypes = false;
          const types = await new Query(
            [
              `
      select b.oid, b.typarray
      from pg_catalog.pg_type a
      left join pg_catalog.pg_type b on b.oid = a.typelem
      where a.typcategory = 'A'
      group by b.oid, b.typarray
      order by b.oid
    `,
            ],
            [],
            execute
          );
          types.forEach(({ oid, typarray }) => addArrayType(oid, typarray));
        }

        function addArrayType(oid, typarray) {
          if (!!options.parsers[typarray] && !!options.serializers[typarray])
            return;
          const parser = options.parsers[oid];
          options.shared.typeArrayMap[oid] = typarray;
          options.parsers[typarray] = (xs) => arrayParser(xs, parser, typarray);
          options.parsers[typarray].array = true;
          options.serializers[typarray] = (xs) =>
            arraySerializer(xs, options.serializers[oid], options, typarray);
        }

        function tryNext(x, xs) {
          return (
            (x === "read-write" && xs.default_transaction_read_only === "on") ||
            (x === "read-only" && xs.default_transaction_read_only === "off") ||
            (x === "primary" && xs.in_hot_standby === "on") ||
            (x === "standby" && xs.in_hot_standby === "off") ||
            (x === "prefer-standby" &&
              xs.in_hot_standby === "off" &&
              options.host[retries])
          );
        }

        function fetchState() {
          const query = new Query(
            [
              `
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `,
            ],
            [],
            execute,
            null,
            { simple: true }
          );
          query.resolve = ([[a], [b]]) => {
            backendParameters.default_transaction_read_only =
              a.transaction_read_only;
            backendParameters.in_hot_standby = b.pg_is_in_recovery
              ? "on"
              : "off";
          };
          query.execute();
        }

        function ErrorResponse(x) {
          query && (query.cursorFn || query.describeFirst) && write(Sync);
          const error = Errors.postgres(parseError(x));
          query && query.retried
            ? errored(query.retried)
            : query && retryRoutines.has(error.routine)
              ? retry(query, error)
              : errored(error);
        }

        function retry(q, error) {
          delete statements[q.signature];
          q.retried = error;
          execute(q);
        }

        function NotificationResponse(x) {
          if (!onnotify) return;

          let index = 9;
          while (x[index++] !== 0);
          onnotify(
            x.toString("utf8", 9, index - 1),
            x.toString("utf8", index, x.length - 1)
          );
        }

        async function PortalSuspended() {
          try {
            const x = await Promise.resolve(query.cursorFn(result));
            rows = 0;
            x === CLOSE
              ? write(Close(query.portal))
              : ((result = new Result()), write(Execute("", query.cursorRows)));
          } catch (err) {
            write(Sync);
            query.reject(err);
          }
        }

        function CloseComplete() {
          result.count && query.cursorFn(result);
          query.resolve(result);
        }

        function CopyInResponse() {
          stream = new Stream.Writable({
            autoDestroy: true,
            write(chunk, encoding, callback) {
              socket.write(b().d().raw(chunk).end(), callback);
            },
            destroy(error, callback) {
              callback(error);
              socket.write(
                b()
                  .f()
                  .str(error + b.N)
                  .end()
              );
              stream = null;
            },
            final(callback) {
              socket.write(b().c().end());
              final = callback;
            },
          });
          query.resolve(stream);
        }

        function CopyOutResponse() {
          stream = new Stream.Readable({
            read() {
              socket.resume();
            },
          });
          query.resolve(stream);
        }

        /* c8 ignore next 3 */
        function CopyBothResponse() {
          stream = new Stream.Duplex({
            autoDestroy: true,
            read() {
              socket.resume();
            },
            /* c8 ignore next 11 */
            write(chunk, encoding, callback) {
              socket.write(b().d().raw(chunk).end(), callback);
            },
            destroy(error, callback) {
              callback(error);
              socket.write(
                b()
                  .f()
                  .str(error + b.N)
                  .end()
              );
              stream = null;
            },
            final(callback) {
              socket.write(b().c().end());
              final = callback;
            },
          });
          query.resolve(stream);
        }

        function CopyData(x) {
          stream && (stream.push(x.subarray(5)) || socket.pause());
        }

        function CopyDone() {
          stream && stream.push(null);
          stream = null;
        }

        function NoticeResponse(x) {
          onnotice ? onnotice(parseError(x)) : console.log(parseError(x)); // eslint-disable-line
        }

        /* c8 ignore next 3 */
        function EmptyQueryResponse() {
          /* noop */
        }

        /* c8 ignore next 3 */
        function FunctionCallResponse() {
          errored(Errors.notSupported("FunctionCallResponse"));
        }

        /* c8 ignore next 3 */
        function NegotiateProtocolVersion() {
          errored(Errors.notSupported("NegotiateProtocolVersion"));
        }

        /* c8 ignore next 3 */
        function UnknownMessage(x) {
          console.error("Postgres.js : Unknown Message:", x[0]); // eslint-disable-line
        }

        /* c8 ignore next 3 */
        function UnknownAuth(x, type) {
          console.error("Postgres.js : Unknown Auth:", type); // eslint-disable-line
        }

        /* Messages */
        function Bind(parameters, types, statement = "", portal = "") {
          let prev, type;

          b()
            .B()
            .str(portal + b.N)
            .str(statement + b.N)
            .i16(0)
            .i16(parameters.length);

          parameters.forEach((x, i) => {
            if (x === null) return b.i32(0xffffffff);

            type = types[i];
            parameters[i] = x =
              type in options.serializers
                ? options.serializers[type](x)
                : "" + x;

            prev = b.i;
            b.inc(4)
              .str(x)
              .i32(b.i - prev - 4, prev);
          });

          b.i16(0);

          return b.end();
        }

        function Parse(str, parameters, types, name = "") {
          b()
            .P()
            .str(name + b.N)
            .str(str + b.N)
            .i16(parameters.length);
          parameters.forEach((x, i) => b.i32(types[i] || 0));
          return b.end();
        }

        function Describe(x, name = "") {
          return b()
            .D()
            .str(x)
            .str(name + b.N)
            .end();
        }

        function Execute(portal = "", rows = 0) {
          return Buffer.concat([
            b()
              .E()
              .str(portal + b.N)
              .i32(rows)
              .end(),
            Flush,
          ]);
        }

        function Close(portal = "") {
          return Buffer.concat([
            b()
              .C()
              .str("P")
              .str(portal + b.N)
              .end(),
            b().S().end(),
          ]);
        }

        function StartupMessage() {
          return (
            cancelMessage ||
            b()
              .inc(4)
              .i16(3)
              .z(2)
              .str(
                Object.entries(
                  Object.assign(
                    {
                      user,
                      database,
                      client_encoding: "UTF8",
                    },
                    options.connection
                  )
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => k + b.N + v)
                  .join(b.N)
              )
              .z(2)
              .end(0)
          );
        }
      }

      function parseError(x) {
        const error = {};
        let start = 5;
        for (let i = 5; i < x.length - 1; i++) {
          if (x[i] === 0) {
            error[errorFields[x[start]]] = x.toString("utf8", start + 1, i);
            start = i + 1;
          }
        }
        return error;
      }

      function md5(x) {
        return crypto.createHash("md5").update(x).digest("hex");
      }

      function hmac(key, x) {
        return crypto.createHmac("sha256", key).update(x).digest();
      }

      function sha256(x) {
        return crypto.createHash("sha256").update(x).digest();
      }

      function xor(a, b) {
        const length = Math.max(a.length, b.length);
        const buffer = Buffer.allocUnsafe(length);
        for (let i = 0; i < length; i++) buffer[i] = a[i] ^ b[i];
        return buffer;
      }

      function timer(fn, seconds) {
        seconds = typeof seconds === "function" ? seconds() : seconds;
        if (!seconds) return { cancel: noop, start: noop };

        let timer;
        return {
          cancel() {
            timer && (clearTimeout(timer), (timer = null));
          },
          start() {
            timer && clearTimeout(timer);
            timer = setTimeout(done, seconds * 1000, arguments);
          },
        };

        function done(args) {
          fn.apply(null, args);
          timer = null;
        }
      }

      /***/
    },
    /* 17 */
    /***/ (module) => {
      "use strict";
      module.exports = require("net");

      /***/
    },
    /* 18 */
    /***/ (module) => {
      "use strict";
      module.exports = require("tls");

      /***/
    },
    /* 19 */
    /***/ (module) => {
      "use strict";
      module.exports = require("stream");

      /***/
    },
    /* 20 */
    /***/ (module) => {
      "use strict";
      module.exports = require("perf_hooks");

      /***/
    },
    /* 21 */
    /***/ (module) => {
      module.exports = class Result extends Array {
        constructor() {
          super();
          Object.defineProperties(this, {
            count: { value: null, writable: true },
            state: { value: null, writable: true },
            command: { value: null, writable: true },
            columns: { value: null, writable: true },
            statement: { value: null, writable: true },
          });
        }

        static get [Symbol.species]() {
          return Array;
        }
      };

      /***/
    },
    /* 22 */
    /***/ (module) => {
      module.exports = Queue;

      function Queue(initial = []) {
        let xs = initial.slice();
        let index = 0;

        return {
          get length() {
            return xs.length - index;
          },
          remove: (x) => {
            const index = xs.indexOf(x);
            return index === -1 ? null : (xs.splice(index, 1), x);
          },
          push: (x) => (xs.push(x), x),
          shift: () => {
            const out = xs[index++];

            if (index === xs.length) {
              index = 0;
              xs = [];
            } else {
              xs[index - 1] = undefined;
            }

            return out;
          },
        };
      }

      /***/
    },
    /* 23 */
    /***/ (module) => {
      const size = 256;
      let buffer = Buffer.allocUnsafe(size);

      const messages = "BCcDdEFfHPpQSX".split("").reduce((acc, x) => {
        const v = x.charCodeAt(0);
        acc[x] = () => {
          buffer[0] = v;
          b.i = 5;
          return b;
        };
        return acc;
      }, {});

      const b = Object.assign(reset, messages, {
        N: String.fromCharCode(0),
        i: 0,
        inc(x) {
          b.i += x;
          return b;
        },
        str(x) {
          const length = Buffer.byteLength(x);
          fit(length);
          b.i += buffer.write(x, b.i, length, "utf8");
          return b;
        },
        i16(x) {
          fit(2);
          buffer.writeUInt16BE(x, b.i);
          b.i += 2;
          return b;
        },
        i32(x, i) {
          if (i || i === 0) {
            buffer.writeUInt32BE(x, i);
            return b;
          }
          fit(4);
          buffer.writeUInt32BE(x, b.i);
          b.i += 4;
          return b;
        },
        z(x) {
          fit(x);
          buffer.fill(0, b.i, b.i + x);
          b.i += x;
          return b;
        },
        raw(x) {
          buffer = Buffer.concat([buffer.subarray(0, b.i), x]);
          b.i = buffer.length;
          return b;
        },
        end(at = 1) {
          buffer.writeUInt32BE(b.i - at, at);
          const out = buffer.subarray(0, b.i);
          b.i = 0;
          buffer = Buffer.allocUnsafe(size);
          return out;
        },
      });

      module.exports = b;

      function fit(x) {
        if (buffer.length - b.i < x) {
          const prev = buffer,
            length = prev.length;

          buffer = Buffer.allocUnsafe(length + (length >> 1) + x);
          prev.copy(buffer);
        }
      }

      function reset() {
        b.i = 0;
        return b;
      }

      /***/
    },
    /* 24 */
    /***/ (module) => {
      const noop = () => {
        /* noop */
      };

      module.exports = Subscribe;
      function Subscribe(postgres, options) {
        const subscribers = new Map(),
          slot = "postgresjs_" + Math.random().toString(36).slice(2),
          state = {};

        let connection,
          stream,
          ended = false;

        const sql = (subscribe.sql = postgres({
          ...options,
          transform: { column: {}, value: {}, row: {} },
          max: 1,
          fetch_types: false,
          idle_timeout: null,
          max_lifetime: null,
          connection: {
            ...options.connection,
            replication: "database",
          },
          onclose: async function () {
            if (ended) return;
            stream = null;
            state.pid = state.secret = undefined;
            connected(await init(sql, slot, options.publications));
            subscribers.forEach((event) =>
              event.forEach(({ onsubscribe }) => onsubscribe())
            );
          },
          no_subscribe: true,
        }));

        const end = sql.end,
          close = sql.close;

        sql.end = async () => {
          ended = true;
          stream &&
            (await new Promise((r) => (stream.once("close", r), stream.end())));
          return end();
        };

        sql.close = async () => {
          stream &&
            (await new Promise((r) => (stream.once("close", r), stream.end())));
          return close();
        };

        return subscribe;

        async function subscribe(event, fn, onsubscribe = noop) {
          event = parseEvent(event);

          if (!connection) connection = init(sql, slot, options.publications);

          const subscriber = { fn, onsubscribe };
          const fns = subscribers.has(event)
            ? subscribers.get(event).add(subscriber)
            : subscribers.set(event, new Set([subscriber])).get(event);

          const unsubscribe = () => {
            fns.delete(subscriber);
            fns.size === 0 && subscribers.delete(event);
          };

          return connection.then((x) => {
            connected(x);
            onsubscribe();
            return { unsubscribe, state, sql };
          });
        }

        function connected(x) {
          stream = x.stream;
          state.pid = x.state.pid;
          state.secret = x.state.secret;
        }

        async function init(sql, slot, publications) {
          if (!publications) throw new Error("Missing publication names");

          const xs = await sql.unsafe(
            `CREATE_REPLICATION_SLOT ${slot} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`
          );

          const [x] = xs;

          const stream = await sql
            .unsafe(
              `START_REPLICATION SLOT ${slot} LOGICAL ${x.consistent_point} (proto_version '1', publication_names '${publications}')`
            )
            .writable();

          const state = {
            lsn: Buffer.concat(
              x.consistent_point
                .split("/")
                .map((x) => Buffer.from(("00000000" + x).slice(-8), "hex"))
            ),
          };

          stream.on("data", data);
          stream.on("error", error);
          stream.on("close", sql.close);

          return { stream, state: xs.state };

          function error(e) {
            console.error(
              "Unexpected error during logical streaming - reconnecting",
              e
            );
          }

          function data(x) {
            if (x[0] === 0x77)
              parse(
                x.subarray(25),
                state,
                sql.options.parsers,
                handle,
                options.transform
              );
            else if (x[0] === 0x6b && x[17]) pong();
          }

          function handle(a, b) {
            const path = b.relation.schema + "." + b.relation.table;
            call("*", a, b);
            call("*:" + path, a, b);
            b.relation.keys.length &&
              call(
                "*:" + path + "=" + b.relation.keys.map((x) => a[x.name]),
                a,
                b
              );
            call(b.command, a, b);
            call(b.command + ":" + path, a, b);
            b.relation.keys.length &&
              call(
                b.command +
                  ":" +
                  path +
                  "=" +
                  b.relation.keys.map((x) => a[x.name]),
                a,
                b
              );
          }

          function pong() {
            const x = Buffer.alloc(34);
            x[0] = "r".charCodeAt(0);
            x.fill(state.lsn, 1);
            x.writeBigInt64BE(
              BigInt(Date.now() - Date.UTC(2000, 0, 1)) * BigInt(1000),
              25
            );
            stream.write(x);
          }
        }

        function call(x, a, b) {
          subscribers.has(x) &&
            subscribers.get(x).forEach(({ fn }) => fn(a, b, x));
        }
      }

      function Time(x) {
        return new Date(Date.UTC(2000, 0, 1) + Number(x / BigInt(1000)));
      }

      function parse(x, state, parsers, handle, transform) {
        const char = (acc, [k, v]) => ((acc[k.charCodeAt(0)] = v), acc);

        Object.entries({
          R: (x) => {
            // Relation
            let i = 1;
            const r = (state[x.readUInt32BE(i)] = {
              schema:
                x.toString("utf8", (i += 4), (i = x.indexOf(0, i))) ||
                "pg_catalog",
              table: x.toString("utf8", i + 1, (i = x.indexOf(0, i + 1))),
              columns: Array(x.readUInt16BE((i += 2))),
              keys: [],
            });
            i += 2;

            let columnIndex = 0,
              column;

            while (i < x.length) {
              column = r.columns[columnIndex++] = {
                key: x[i++],
                name: transform.column.from
                  ? transform.column.from(
                      x.toString("utf8", i, (i = x.indexOf(0, i)))
                    )
                  : x.toString("utf8", i, (i = x.indexOf(0, i))),
                type: x.readUInt32BE((i += 1)),
                parser: parsers[x.readUInt32BE(i)],
                atttypmod: x.readUInt32BE((i += 4)),
              };

              column.key && r.keys.push(column);
              i += 4;
            }
          },
          Y: () => {
            /* noop */
          }, // Type
          O: () => {
            /* noop */
          }, // Origin
          B: (x) => {
            // Begin
            state.date = Time(x.readBigInt64BE(9));
            state.lsn = x.subarray(1, 9);
          },
          I: (x) => {
            // Insert
            let i = 1;
            const relation = state[x.readUInt32BE(i)];
            const { row } = tuples(x, relation.columns, (i += 7), transform);

            handle(row, {
              command: "insert",
              relation,
            });
          },
          D: (x) => {
            // Delete
            let i = 1;
            const relation = state[x.readUInt32BE(i)];
            i += 4;
            const key = x[i] === 75;
            handle(
              key || x[i] === 79
                ? tuples(x, relation.columns, (i += 3), transform).row
                : null,
              {
                command: "delete",
                relation,
                key,
              }
            );
          },
          U: (x) => {
            // Update
            let i = 1;
            const relation = state[x.readUInt32BE(i)];
            i += 4;
            const key = x[i] === 75;
            const xs =
              key || x[i] === 79
                ? tuples(x, relation.columns, (i += 3), transform)
                : null;

            xs && (i = xs.i);

            const { row } = tuples(x, relation.columns, i + 3, transform);

            handle(row, {
              command: "update",
              relation,
              key,
              old: xs && xs.row,
            });
          },
          T: () => {
            /* noop */
          }, // Truncate,
          C: () => {
            /* noop */
          }, // Commit
        })
          .reduce(char, {})
          [x[0]](x);
      }

      function tuples(x, columns, xi, transform) {
        let type, column, value;

        const row = transform.raw ? new Array(columns.length) : {};
        for (let i = 0; i < columns.length; i++) {
          type = x[xi++];
          column = columns[i];
          value =
            type === 110 // n
              ? null
              : type === 117 // u
                ? undefined
                : column.parser === undefined
                  ? x.toString("utf8", xi + 4, (xi += 4 + x.readUInt32BE(xi)))
                  : column.parser.array === true
                    ? column.parser(
                        x.toString(
                          "utf8",
                          xi + 5,
                          (xi += 4 + x.readUInt32BE(xi))
                        )
                      )
                    : column.parser(
                        x.toString(
                          "utf8",
                          xi + 4,
                          (xi += 4 + x.readUInt32BE(xi))
                        )
                      );

          transform.raw
            ? (row[i] =
                transform.raw === true
                  ? value
                  : transform.value.from
                    ? transform.value.from(value, column)
                    : value)
            : (row[column.name] = transform.value.from
                ? transform.value.from(value, column)
                : value);
        }

        return {
          i: xi,
          row: transform.row.from ? transform.row.from(row) : row,
        };
      }

      function parseEvent(x) {
        const xs =
          x.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i) ||
          [];

        if (!xs) throw new Error("Malformed subscribe pattern: " + x);

        const [, command, path, key] = xs;

        return (
          (command || "*") +
          (path
            ? ":" + (path.indexOf(".") === -1 ? "public." + path : path)
            : "") +
          (key ? "=" + key : "")
        );
      }

      /***/
    },
    /* 25 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      const Stream = __webpack_require__(19);

      module.exports = largeObject;
      function largeObject(sql, oid, mode = 0x00020000 | 0x00040000) {
        return new Promise(async (resolve, reject) => {
          await sql
            .begin(async (sql) => {
              let finish;
              !oid && ([{ oid }] = await sql`select lo_creat(-1) as oid`);
              const [{ fd }] = await sql`select lo_open(${oid}, ${mode}) as fd`;

              const lo = {
                writable,
                readable,
                close: () => sql`select lo_close(${fd})`.then(finish),
                tell: () => sql`select lo_tell64(${fd})`,
                read: (x) => sql`select loread(${fd}, ${x}) as data`,
                write: (x) => sql`select lowrite(${fd}, ${x})`,
                truncate: (x) => sql`select lo_truncate64(${fd}, ${x})`,
                seek: (x, whence = 0) =>
                  sql`select lo_lseek64(${fd}, ${x}, ${whence})`,
                size: () => sql`
          select
            lo_lseek64(${fd}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `,
              };

              resolve(lo);

              return new Promise(async (r) => (finish = r));

              async function readable({
                highWaterMark = 2048 * 8,
                start = 0,
                end = Infinity,
              } = {}) {
                let max = end - start;
                start && (await lo.seek(start));
                return new Stream.Readable({
                  highWaterMark,
                  async read(size) {
                    const l = size > max ? size - max : size;
                    max -= size;
                    const [{ data }] = await lo.read(l);
                    this.push(data);
                    if (data.length < size) this.push(null);
                  },
                });
              }

              async function writable({
                highWaterMark = 2048 * 8,
                start = 0,
              } = {}) {
                start && (await lo.seek(start));
                return new Stream.Writable({
                  highWaterMark,
                  write(chunk, encoding, callback) {
                    lo.write(chunk).then(() => callback(), callback);
                  },
                });
              }
            })
            .catch(reject);
        });
      }

      /***/
    },
    /* 26 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      Object.defineProperty(exports, "__esModule", { value: true });
      exports.notesRelations =
        exports.postsRelations =
        exports.assetsRelations =
        exports.feedsRelations =
        exports.usersRelations =
        exports.notes =
        exports.posts =
        exports.feeds =
        exports.assets =
        exports.verificationTokens =
        exports.sessions =
        exports.accounts =
        exports.users =
          void 0;
      const pg_core_1 = __webpack_require__(27);
      const table_1 = __webpack_require__(28);
      const enums_1 = __webpack_require__(29);
      const drizzle_orm_1 = __webpack_require__(30);
      exports.users = (0, table_1.pgTable)("user", {
        id: (0, pg_core_1.text)("id").notNull().primaryKey(),
        name: (0, pg_core_1.text)("name"),
        email: (0, pg_core_1.text)("email").notNull(),
        emailVerified: (0, pg_core_1.timestamp)("emailVerified", {
          mode: "date",
        }),
        image: (0, pg_core_1.text)("image"),
        role: (0, enums_1.roles)("role").default("user").notNull(),
      });
      exports.accounts = (0, table_1.pgTable)(
        "account",
        {
          userId: (0, pg_core_1.text)("userId")
            .notNull()
            .references(() => exports.users.id, { onDelete: "cascade" }),
          type: (0, pg_core_1.text)("type").$type().notNull(),
          provider: (0, pg_core_1.text)("provider").notNull(),
          providerAccountId: (0, pg_core_1.text)("providerAccountId").notNull(),
          refresh_token: (0, pg_core_1.text)("refresh_token"),
          access_token: (0, pg_core_1.text)("access_token"),
          expires_at: (0, pg_core_1.integer)("expires_at"),
          token_type: (0, pg_core_1.text)("token_type"),
          scope: (0, pg_core_1.text)("scope"),
          id_token: (0, pg_core_1.text)("id_token"),
          session_state: (0, pg_core_1.text)("session_state"),
        },
        (account) => ({
          compoundKey: (0, pg_core_1.primaryKey)(
            account.provider,
            account.providerAccountId
          ),
        })
      );
      exports.sessions = (0, table_1.pgTable)("session", {
        sessionToken: (0, pg_core_1.text)("sessionToken")
          .notNull()
          .primaryKey(),
        userId: (0, pg_core_1.text)("userId")
          .notNull()
          .references(() => exports.users.id, { onDelete: "cascade" }),
        expires: (0, pg_core_1.timestamp)("expires", {
          mode: "date",
        }).notNull(),
      });
      exports.verificationTokens = (0, table_1.pgTable)(
        "verificationToken",
        {
          identifier: (0, pg_core_1.text)("identifier").notNull(),
          token: (0, pg_core_1.text)("token").notNull(),
          expires: (0, pg_core_1.timestamp)("expires", {
            mode: "date",
          }).notNull(),
        },
        (vt) => ({
          compoundKey: (0, pg_core_1.primaryKey)(vt.identifier, vt.token),
        })
      );
      exports.assets = (0, table_1.pgTable)("asset", {
        id: (0, pg_core_1.serial)("id").primaryKey(),
        createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" })
          .default((0, drizzle_orm_1.sql)`CURRENT_TIMESTAMP`)
          .notNull(),
        updatedAt: (0, pg_core_1.timestamp)("updatedAt", { mode: "date" })
          .default((0, drizzle_orm_1.sql)`CURRENT_TIMESTAMP`)
          .notNull(),
        name: (0, pg_core_1.text)("name").notNull(),
        extention: (0, pg_core_1.text)("extention"),
        url: (0, pg_core_1.text)("url").notNull(),
        userId: (0, pg_core_1.text)("userId")
          .notNull()
          .references(() => exports.users.id),
      });
      exports.feeds = (0, table_1.pgTable)("feed", {
        id: (0, pg_core_1.serial)("id").primaryKey(),
        slug: (0, pg_core_1.text)("slug").notNull().unique(),
        type: (0, enums_1.feed_type)("type").notNull(),
        title: (0, pg_core_1.text)("title").notNull(),
        expert: (0, pg_core_1.text)("expert"),
        description: (0, pg_core_1.text)("description"),
        createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" })
          .default((0, drizzle_orm_1.sql)`CURRENT_TIMESTAMP`)
          .notNull(),
        updatedAt: (0, pg_core_1.timestamp)("updatedAt", { mode: "date" })
          .default((0, drizzle_orm_1.sql)`CURRENT_TIMESTAMP`)
          .notNull(),
        readTime: (0, pg_core_1.integer)("readTime"),
        userId: (0, pg_core_1.text)("userId")
          .notNull()
          .references(() => exports.users.id),
      });
      exports.posts = (0, table_1.pgTable)("post", {
        id: (0, pg_core_1.serial)("id").primaryKey(),
        feedId: (0, pg_core_1.integer)("feedId")
          .notNull()
          .references(() => exports.feeds.id, { onDelete: "cascade" }),
        content: (0, pg_core_1.text)("content"),
      });
      exports.notes = (0, table_1.pgTable)("note", {
        id: (0, pg_core_1.serial)("id").primaryKey(),
        feedId: (0, pg_core_1.integer)("feedId")
          .notNull()
          .references(() => exports.feeds.id, { onDelete: "cascade" }),
        content: (0, pg_core_1.text)("content"),
      });
      exports.usersRelations = (0, drizzle_orm_1.relations)(
        exports.users,
        ({ many }) => ({
          feeds: many(exports.feeds),
          assets: many(exports.assets),
        })
      );
      exports.feedsRelations = (0, drizzle_orm_1.relations)(
        exports.feeds,
        ({ one }) => ({
          post: one(exports.posts),
          note: one(exports.notes),
          user: one(exports.users, {
            fields: [exports.feeds.userId],
            references: [exports.users.id],
          }),
        })
      );
      exports.assetsRelations = (0, drizzle_orm_1.relations)(
        exports.assets,
        ({ one }) => ({
          user: one(exports.users, {
            fields: [exports.assets.userId],
            references: [exports.users.id],
          }),
        })
      );
      exports.postsRelations = (0, drizzle_orm_1.relations)(
        exports.posts,
        ({ one }) => ({
          feed: one(exports.feeds, {
            fields: [exports.posts.feedId],
            references: [exports.feeds.id],
          }),
        })
      );
      exports.notesRelations = (0, drizzle_orm_1.relations)(
        exports.notes,
        ({ one }) => ({
          feeds: one(exports.feeds, {
            fields: [exports.notes.feedId],
            references: [exports.feeds.id],
          }),
        })
      );

      /***/
    },
    /* 27 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      var index = __webpack_require__(11);

      function alias(table, alias) {
        return new Proxy(table, new index.TableAliasProxyHandler(alias, false));
      }

      exports.Check = index.Check;
      exports.CheckBuilder = index.CheckBuilder;
      exports.DefaultViewBuilderCore = index.DefaultViewBuilderCore;
      exports.ForeignKey = index.ForeignKey;
      exports.ForeignKeyBuilder = index.ForeignKeyBuilder;
      exports.Index = index.Index;
      exports.IndexBuilder = index.IndexBuilder;
      exports.IndexBuilderOn = index.IndexBuilderOn;
      exports.InlineForeignKeys = index.InlineForeignKeys;
      exports.ManualMaterializedViewBuilder =
        index.ManualMaterializedViewBuilder;
      exports.ManualViewBuilder = index.ManualViewBuilder;
      exports.MaterializedViewBuilder = index.MaterializedViewBuilder;
      exports.MaterializedViewBuilderCore = index.MaterializedViewBuilderCore;
      exports.PgArray = index.PgArray;
      exports.PgArrayBuilder = index.PgArrayBuilder;
      exports.PgBigInt53 = index.PgBigInt53;
      exports.PgBigInt53Builder = index.PgBigInt53Builder;
      exports.PgBigInt64 = index.PgBigInt64;
      exports.PgBigInt64Builder = index.PgBigInt64Builder;
      exports.PgBigSerial53 = index.PgBigSerial53;
      exports.PgBigSerial53Builder = index.PgBigSerial53Builder;
      exports.PgBigSerial64 = index.PgBigSerial64;
      exports.PgBigSerial64Builder = index.PgBigSerial64Builder;
      exports.PgBoolean = index.PgBoolean;
      exports.PgBooleanBuilder = index.PgBooleanBuilder;
      exports.PgChar = index.PgChar;
      exports.PgCharBuilder = index.PgCharBuilder;
      exports.PgCidr = index.PgCidr;
      exports.PgCidrBuilder = index.PgCidrBuilder;
      exports.PgColumn = index.PgColumn;
      exports.PgColumnBuilder = index.PgColumnBuilder;
      exports.PgCustomColumn = index.PgCustomColumn;
      exports.PgCustomColumnBuilder = index.PgCustomColumnBuilder;
      exports.PgDatabase = index.PgDatabase;
      exports.PgDate = index.PgDate;
      exports.PgDateBuilder = index.PgDateBuilder;
      exports.PgDateString = index.PgDateString;
      exports.PgDateStringBuilder = index.PgDateStringBuilder;
      exports.PgDelete = index.PgDelete;
      exports.PgDialect = index.PgDialect;
      exports.PgDoublePrecision = index.PgDoublePrecision;
      exports.PgDoublePrecisionBuilder = index.PgDoublePrecisionBuilder;
      exports.PgEnumColumn = index.PgEnumColumn;
      exports.PgEnumColumnBuilder = index.PgEnumColumnBuilder;
      exports.PgInet = index.PgInet;
      exports.PgInetBuilder = index.PgInetBuilder;
      exports.PgInsert = index.PgInsert;
      exports.PgInsertBuilder = index.PgInsertBuilder;
      exports.PgInteger = index.PgInteger;
      exports.PgIntegerBuilder = index.PgIntegerBuilder;
      exports.PgInterval = index.PgInterval;
      exports.PgIntervalBuilder = index.PgIntervalBuilder;
      exports.PgJson = index.PgJson;
      exports.PgJsonBuilder = index.PgJsonBuilder;
      exports.PgJsonb = index.PgJsonb;
      exports.PgJsonbBuilder = index.PgJsonbBuilder;
      exports.PgMacaddr = index.PgMacaddr;
      exports.PgMacaddr8 = index.PgMacaddr8;
      exports.PgMacaddr8Builder = index.PgMacaddr8Builder;
      exports.PgMacaddrBuilder = index.PgMacaddrBuilder;
      exports.PgMaterializedView = index.PgMaterializedView;
      exports.PgMaterializedViewConfig = index.PgMaterializedViewConfig;
      exports.PgNumeric = index.PgNumeric;
      exports.PgNumericBuilder = index.PgNumericBuilder;
      exports.PgReal = index.PgReal;
      exports.PgRealBuilder = index.PgRealBuilder;
      exports.PgRefreshMaterializedView = index.PgRefreshMaterializedView;
      exports.PgSchema = index.PgSchema;
      exports.PgSelect = index.PgSelect;
      exports.PgSelectBuilder = index.PgSelectBuilder;
      exports.PgSelectQueryBuilder = index.PgSelectQueryBuilder;
      exports.PgSerial = index.PgSerial;
      exports.PgSerialBuilder = index.PgSerialBuilder;
      exports.PgSession = index.PgSession;
      exports.PgSmallInt = index.PgSmallInt;
      exports.PgSmallIntBuilder = index.PgSmallIntBuilder;
      exports.PgSmallSerial = index.PgSmallSerial;
      exports.PgSmallSerialBuilder = index.PgSmallSerialBuilder;
      exports.PgTable = index.PgTable;
      exports.PgText = index.PgText;
      exports.PgTextBuilder = index.PgTextBuilder;
      exports.PgTime = index.PgTime;
      exports.PgTimeBuilder = index.PgTimeBuilder;
      exports.PgTimestamp = index.PgTimestamp;
      exports.PgTimestampBuilder = index.PgTimestampBuilder;
      exports.PgTimestampString = index.PgTimestampString;
      exports.PgTimestampStringBuilder = index.PgTimestampStringBuilder;
      exports.PgTransaction = index.PgTransaction;
      exports.PgUUID = index.PgUUID;
      exports.PgUUIDBuilder = index.PgUUIDBuilder;
      exports.PgUpdate = index.PgUpdate;
      exports.PgUpdateBuilder = index.PgUpdateBuilder;
      exports.PgVarchar = index.PgVarchar;
      exports.PgVarcharBuilder = index.PgVarcharBuilder;
      exports.PgView = index.PgView;
      exports.PgViewBase = index.PgViewBase;
      exports.PgViewConfig = index.PgViewConfig;
      exports.PreparedQuery = index.PreparedQuery;
      exports.PrimaryKey = index.PrimaryKey;
      exports.PrimaryKeyBuilder = index.PrimaryKeyBuilder;
      exports.QueryBuilder = index.QueryBuilder;
      exports.UniqueConstraint = index.UniqueConstraint;
      exports.UniqueConstraintBuilder = index.UniqueConstraintBuilder;
      exports.UniqueOnConstraintBuilder = index.UniqueOnConstraintBuilder;
      exports.ViewBuilder = index.ViewBuilder;
      exports.bigint = index.bigint;
      exports.bigserial = index.bigserial;
      exports.boolean = index.boolean;
      exports.char = index.char;
      exports.check = index.check;
      exports.cidr = index.cidr;
      exports.customType = index.customType;
      exports.date = index.date;
      exports.decimal = index.decimal;
      exports.doublePrecision = index.doublePrecision;
      exports.foreignKey = index.foreignKey;
      exports.getMaterializedViewConfig = index.getMaterializedViewConfig;
      exports.getTableConfig = index.getTableConfig;
      exports.getViewConfig = index.getViewConfig;
      exports.index = index.index;
      exports.inet = index.inet;
      exports.integer = index.integer;
      exports.interval = index.interval;
      exports.isPgEnum = index.isPgEnum;
      exports.isPgSchema = index.isPgSchema;
      exports.json = index.json;
      exports.jsonb = index.jsonb;
      exports.macaddr = index.macaddr;
      exports.macaddr8 = index.macaddr8;
      exports.makePgArray = index.makePgArray;
      exports.numeric = index.numeric;
      exports.parsePgArray = index.parsePgArray;
      exports.parsePgNestedArray = index.parsePgNestedArray;
      exports.pgEnum = index.pgEnum;
      exports.pgMaterializedView = index.pgMaterializedView;
      exports.pgMaterializedViewWithSchema = index.pgMaterializedViewWithSchema;
      exports.pgSchema = index.pgSchema;
      exports.pgTable = index.pgTable;
      exports.pgTableCreator = index.pgTableCreator;
      exports.pgTableWithSchema = index.pgTableWithSchema;
      exports.pgView = index.pgView;
      exports.pgViewWithSchema = index.pgViewWithSchema;
      exports.primaryKey = index.primaryKey;
      exports.real = index.real;
      exports.serial = index.serial;
      exports.smallint = index.smallint;
      exports.smallserial = index.smallserial;
      exports.text = index.text;
      exports.time = index.time;
      exports.timestamp = index.timestamp;
      exports.unique = index.unique;
      exports.uniqueIndex = index.uniqueIndex;
      exports.uniqueKeyName = index.uniqueKeyName;
      exports.uuid = index.uuid;
      exports.varchar = index.varchar;
      exports.alias = alias;
      //# sourceMappingURL=index.cjs.map

      /***/
    },
    /* 28 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      Object.defineProperty(exports, "__esModule", { value: true });
      exports.pgTable = void 0;
      const pg_core_1 = __webpack_require__(27);
      exports.pgTable = (0, pg_core_1.pgTableCreator)((name) => `chia_${name}`);

      /***/
    },
    /* 29 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      Object.defineProperty(exports, "__esModule", { value: true });
      exports.feed_type = exports.roles = void 0;
      const pg_core_1 = __webpack_require__(27);
      exports.roles = (0, pg_core_1.pgEnum)("role", ["admin", "user"]);
      exports.feed_type = (0, pg_core_1.pgEnum)("feed_type", ["post", "note"]);

      /***/
    },
    /* 30 */
    /***/ (__unused_webpack_module, exports, __webpack_require__) => {
      "use strict";

      var index = __webpack_require__(11);

      exports.BaseName = index.BaseName;
      exports.Column = index.Column;
      exports.ColumnAliasProxyHandler = index.ColumnAliasProxyHandler;
      exports.ColumnBuilder = index.ColumnBuilder;
      exports.Columns = index.Columns;
      exports.ConsoleLogWriter = index.ConsoleLogWriter;
      exports.DefaultLogger = index.DefaultLogger;
      exports.DrizzleError = index.DrizzleError;
      exports.ExtraConfigBuilder = index.ExtraConfigBuilder;
      exports.FakePrimitiveParam = index.FakePrimitiveParam;
      exports.IsAlias = index.IsAlias;
      exports.Many = index.Many;
      exports.Name = index.Name;
      exports.NoopLogger = index.NoopLogger;
      exports.One = index.One;
      exports.OriginalName = index.OriginalName;
      exports.Param = index.Param;
      exports.Placeholder = index.Placeholder;
      exports.QueryPromise = index.QueryPromise;
      exports.Relation = index.Relation;
      exports.RelationTableAliasProxyHandler =
        index.RelationTableAliasProxyHandler;
      exports.Relations = index.Relations;
      Object.defineProperty(exports, "SQL", {
        enumerable: true,
        get: function () {
          return index.SQL;
        },
      });
      exports.Schema = index.Schema;
      exports.SelectionProxyHandler = index.SelectionProxyHandler;
      exports.StringChunk = index.StringChunk;
      exports.Subquery = index.Subquery;
      exports.SubqueryConfig = index.SubqueryConfig;
      exports.Table = index.Table;
      exports.TableAliasProxyHandler = index.TableAliasProxyHandler;
      exports.TableName = index.TableName;
      exports.TransactionRollbackError = index.TransactionRollbackError;
      exports.View = index.View;
      exports.ViewBaseConfig = index.ViewBaseConfig;
      exports.WithSubquery = index.WithSubquery;
      exports.aliasedRelation = index.aliasedRelation;
      exports.aliasedTable = index.aliasedTable;
      exports.aliasedTableColumn = index.aliasedTableColumn;
      exports.and = index.and;
      exports.applyMixins = index.applyMixins;
      exports.arrayContained = index.arrayContained;
      exports.arrayContains = index.arrayContains;
      exports.arrayOverlaps = index.arrayOverlaps;
      exports.asc = index.asc;
      exports.between = index.between;
      exports.bindIfParam = index.bindIfParam;
      exports.createMany = index.createMany;
      exports.createOne = index.createOne;
      exports.createTableRelationsHelpers = index.createTableRelationsHelpers;
      exports.desc = index.desc;
      exports.entityKind = index.entityKind;
      exports.eq = index.eq;
      exports.exists = index.exists;
      exports.extractTablesRelationalConfig =
        index.extractTablesRelationalConfig;
      exports.fillPlaceholders = index.fillPlaceholders;
      exports.getOperators = index.getOperators;
      exports.getOrderByOperators = index.getOrderByOperators;
      exports.getTableColumns = index.getTableColumns;
      exports.getTableLikeName = index.getTableLikeName;
      exports.getTableName = index.getTableName;
      exports.gt = index.gt;
      exports.gte = index.gte;
      exports.hasOwnEntityKind = index.hasOwnEntityKind;
      exports.iife = index.iife;
      exports.ilike = index.ilike;
      exports.inArray = index.inArray;
      exports.is = index.is;
      exports.isDriverValueEncoder = index.isDriverValueEncoder;
      exports.isNotNull = index.isNotNull;
      exports.isNull = index.isNull;
      exports.isSQLWrapper = index.isSQLWrapper;
      exports.isTable = index.isTable;
      exports.like = index.like;
      exports.lt = index.lt;
      exports.lte = index.lte;
      exports.mapColumnsInAliasedSQLToAlias =
        index.mapColumnsInAliasedSQLToAlias;
      exports.mapColumnsInSQLToAlias = index.mapColumnsInSQLToAlias;
      exports.mapRelationalRow = index.mapRelationalRow;
      exports.mapResultRow = index.mapResultRow;
      exports.mapUpdateSet = index.mapUpdateSet;
      exports.name = index.name;
      exports.ne = index.ne;
      exports.noopDecoder = index.noopDecoder;
      exports.noopEncoder = index.noopEncoder;
      exports.noopMapper = index.noopMapper;
      exports.normalizeRelation = index.normalizeRelation;
      exports.not = index.not;
      exports.notBetween = index.notBetween;
      exports.notExists = index.notExists;
      exports.notIlike = index.notIlike;
      exports.notInArray = index.notInArray;
      exports.notLike = index.notLike;
      exports.or = index.or;
      exports.orderSelectedFields = index.orderSelectedFields;
      exports.param = index.param;
      exports.placeholder = index.placeholder;
      exports.relations = index.relations;
      Object.defineProperty(exports, "sql", {
        enumerable: true,
        get: function () {
          return index.sql;
        },
      });
      //# sourceMappingURL=index.cjs.map

      /***/
    },
    /******/
  ];
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId].call(
      module.exports,
      module,
      module.exports,
      __webpack_require__
    );
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/
  /******/ // startup
  /******/ // Load entry module and return exports
  /******/ // This entry module is referenced by other modules so it can't be inlined
  /******/ var __webpack_exports__ = __webpack_require__(0);
  /******/
  /******/
})();
