/** One-off run, e.g. from cron: `npm run reminders -w server` */
import { createDeps } from '../deps';
import { runReminders } from './reminders';

const { deps, close } = await createDeps();
const sent = await runReminders(deps);
console.log(`Sent ${sent} renewal reminder${sent === 1 ? '' : 's'}`);
await close();
