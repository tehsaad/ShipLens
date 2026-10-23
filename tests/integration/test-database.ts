import "dotenv/config";

/**
 * Returns TEST_DATABASE_URL after checking it points at a disposable database.
 * Integration tests drop and recreate the schema, so they refuse to run against any
 * database whose name does not end in "_test".
 */
export function getTestDatabaseUrl(): string {
  const raw = process.env["TEST_DATABASE_URL"];
  if (!raw) {
    throw new Error("TEST_DATABASE_URL is not set; integration tests need a disposable database");
  }
  const databaseName = new URL(raw).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to use database "${databaseName}": the test database name must end in "_test"`,
    );
  }
  return raw;
}
