import {z} from 'zod';

// Zod 4.6.7 reads this at object construction, before its eval capability probe.
// App schemas must import this module: ESM evaluates this body before importers.
// Keep this dependency leaf free of app imports to preserve that order on both
// client and server. z.config is an alias of the same core config function.
z.core.config({jitless:true});

export {z};
