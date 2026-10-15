// Runs every test and writes the coverage SonarQube reads: lcov.info (JavaScript) and coverage.xml (Python).
// Usage: npm run coverage
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
run(process.execPath, ["--test", "--experimental-test-coverage", "--test-reporter=spec", "--test-reporter=lcov",
  "--test-reporter-destination=stdout", "--test-reporter-destination=lcov.info", "test/worker.test.mjs", "test/app.test.mjs"]);
// the scanner runs on Linux: worker\worker.js -> worker/worker.js
writeFileSync("lcov.info", readFileSync("lcov.info", "utf8").replaceAll(/^SF:.*$/gm, l => l.replaceAll("\\", "/")));
run("python", ["-m", "coverage", "run", "-m", "unittest", "discover", "-s", "test", "-p", "test_*.py"]);
run("python", ["-m", "coverage", "xml", "-o", "coverage.xml"]);
