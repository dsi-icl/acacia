export const Store = require('./store.js');
export const Account = require('./account.js');
export const Container = require('./container.js');
export const Segment = require('./segment.js');
export const DLO = require('./dlo.js');
export const SLO = require('./slo.js');

export default {
    Store: Store,
    Account: Account,
    Container: Container,
    Segment: Segment,
    DynamicLargeObject: DLO,
    StaticLargeObject: SLO
};