import { successSubmission } from './scenarios/successSubmission';
import { missingCsrf } from './scenarios/missingCsrf';
import { idempotencyConflict } from './scenarios/idempotencyConflict';
import { invalidAttachmentType } from './scenarios/invalidAttachmentType';
import type { Scenario } from './types';

const scenarios: Scenario[] = [
  successSubmission,
  missingCsrf,
  idempotencyConflict,
  invalidAttachmentType,
];

async function main() {
  console.log('Running BFF mail API scenarios...');

  let failures = 0;

  for (const scenario of scenarios) {
    process.stdout.write(`- ${scenario.name}... `);
    const start = Date.now();
    try {
      await scenario.run();
      const duration = Date.now() - start;
      console.log(`ok (${duration}ms)`);
    } catch (error) {
      failures += 1;
      console.log('FAILED');
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} scenario(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll scenarios passed.');
  }
}

void main();
