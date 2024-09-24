import { createTRPCReact } from '@trpc/react-query';

// eslint-disable-next-line @nx/enforce-module-boundaries
import type { APPTRPCRouter } from '@itmat-broker/itmat-apis';

export const trpc = createTRPCReact<APPTRPCRouter>();

