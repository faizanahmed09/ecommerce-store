/*
 * ---------------------------------------------------------
 * RPC HELPERS
 * ---------------------------------------------------------
 *
 * Several features are reached through a database function
 * that ships as a migration - order tracking, discount codes.
 * Until that migration is applied the function is simply
 * absent, and the difference between "not set up yet" and "not
 * working" is what the shopper gets told.
 *
 * Both call sites had their own copy of the two error codes
 * that mean the same thing.
 */

/**
 * True when the error is "that function does not exist".
 *
 * PostgREST answers with its own PGRST202 over the REST API;
 * Postgres' 42883 is what surfaces if the call ever runs closer
 * to the database. Both mean the migration has not been run.
 */
export function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/**
 * A feature whose migration has not been applied.
 *
 * Subclassed rather than thrown directly so a call site can
 * tell which feature is missing, and say something useful
 * about that one.
 */
export class FeatureUnavailableError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}
