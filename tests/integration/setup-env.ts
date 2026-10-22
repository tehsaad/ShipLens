import { getTestDatabaseUrl } from "./test-database";

// Application code reads DATABASE_URL; point it at the test database for every test file.
process.env["DATABASE_URL"] = getTestDatabaseUrl();
