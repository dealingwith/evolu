import {
  Bip39,
  DbWorker,
  DbWorkerFactory,
  EvoluFactory,
  InvalidMnemonicError,
  Mnemonic,
  NanoIdGenerator,
  notSupportedPlatformWorker,
} from "@evolu/common";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AppStateLive, Bip39Live } from "./PlatformLive.js";
import { wrap } from "./ProxyWorker.js";

const DbWorkerFactoryLive = Layer.succeed(DbWorkerFactory, {
  createDbWorker: Effect.sync(() => {
    if (typeof document === "undefined") {
      return notSupportedPlatformWorker;
    }
    const worker = new Worker(new URL("DbWorker.worker.js", import.meta.url), {
      type: "module",
    });
    return wrap<DbWorker>(worker);
  }),
});

export const EvoluFactoryWeb = Layer.provide(
  EvoluFactory.Common,
  Layer.mergeAll(DbWorkerFactoryLive, NanoIdGenerator.Live, AppStateLive),
);

/**
 * Parse a string to {@link Mnemonic}.
 *
 * This function is async because Bip39 is imported dynamically.
 */
export const parseMnemonic: (
  mnemonic: string,
) => Effect.Effect<Mnemonic, InvalidMnemonicError> = Bip39.pipe(
  Effect.provide(Bip39Live),
  Effect.runSync,
).parse;

// JSDoc doesn't support destructured parameters, so we must copy-paste
// createEvolu docs from `evolu-common/src/Evolu.ts`.
// https://github.com/microsoft/TypeScript/issues/11859
export const {
  /**
   * Create Evolu from the database schema.
   *
   * Tables with a name prefixed with `_` are local-only, which means they are
   * never synced. It's useful for device-specific or temporal data.
   *
   * @example
   *   import * as S from "@effect/schema/Schema";
   *   import * as E from "@evolu/common-web";
   *
   *   const TodoId = E.id("Todo");
   *   type TodoId = S.Schema.Type<typeof TodoId>;
   *
   *   const TodoTable = E.table({
   *     id: TodoId,
   *     title: E.NonEmptyString1000,
   *   });
   *   type TodoTable = S.Schema.Type<typeof TodoTable>;
   *
   *   const Database = E.database({
   *     todo: TodoTable,
   *
   *     // Prefix `_` makes the table local-only (it will not sync)
   *     _todo: TodoTable,
   *   });
   *   type Database = S.Schema.Type<typeof Database>;
   *
   *   const evolu = E.createEvolu(Database);
   */
  createEvolu,
} = EvoluFactory.pipe(Effect.provide(EvoluFactoryWeb), Effect.runSync);
