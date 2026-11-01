import { HealedInStrictModeError } from '../../clients/healPolicy';
import { expect, test } from '../../fixtures/selfHeal';

test('strict mode heals but then fails, naming the trigger', async ({ stub, stubClient, exchanges }) => {
  stub.script('GET', '/flaky', [{ status: 503 }, { status: 200 }]);

  const request = stubClient({ mode: 'strict' }).get('/flaky');

  await expect(request).rejects.toThrow(HealedInStrictModeError);
  await expect(request).rejects.toThrow(/Healed in strict mode: GET \/flaky needed 503/);
  // The heal still ran, so the log shows both attempts.
  expect(exchanges.map((e) => e.status)).toEqual([503, 200]);
});
