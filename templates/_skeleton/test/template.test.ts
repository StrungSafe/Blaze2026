/**
 * Starting point for a system's template tests. See revenue-split/test/template.test.ts for a complete example.
 * The _skeleton folder is excluded from `npm test`; these become real tests once the folder is copied.
 */
import { describe, it } from 'vitest';

describe('<System name> template', () => {
    it.todo('parses, and has a stable canonical identifier');
    it.todo('builds exactly the CashScript contract (redeem script and locking bytecode match)');
    it.todo('builds spends the VM accepts, for every contract function');
    it.todo('builds no spend the VM should reject (wrong amount, recipient, order, missing output)');
    it.todo('refuses parameters that would lock coins forever');
    it.todo('passes every automated registry audit check with no failures');
});
