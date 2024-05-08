import { Database as DatabaseBase, IDatabaseBaseConfig } from '@itmat-broker/itmat-commons';
import { IDatabaseCollectionConfig } from '@itmat-broker/itmat-cores';

export const db = new DatabaseBase<IDatabaseBaseConfig, IDatabaseCollectionConfig>();
