export type IQueryEntry = {
    id: string;
    queryString: {
        data_requested: string[];
        cohort: ICohortSelection[][];
        new_fields: INewFieldSelection[];
        table_requested?: string;
    };
    studyId: string;
    projectId?: string;
    requester: string;
    claimedBy?: string;
    lastClaimed?: number;
    status: string;
    error: null | string;
    cancelled: boolean;
    cancelledTime?: number;
    queryResult?: string;
    data_requested: string[];
    cohort: ICohortSelection[][];
    new_fields: INewFieldSelection[];
}

// we do not reuse the cohort types directly to avoid conflicts
export type IMetadataSelection = {
    key: string;
    op: enumMetadataSelectionOp;
    parameter: string;
}

enum enumMetadataSelectionOp {
    '=' = '=',
    '!=' = '!=',
    '>' = '>',
    '<' = '<',
    'exists' = 'exists', // not null nor undefined
}

export type ICohortSelection = {
    field: string;
    value: string;
    op: enumCohortSelectionOp;
}

export enum enumCohortSelectionOp {
    '=' = '=',
    '!=' = '!=',
    '>' = '>',
    '<' = '<',
    'derived' = 'derived',
    'exists' = 'exists',
    'count' = 'count'
}

export type IEquationDescription = {
    left: string | IEquationDescription;
    right: string | IEquationDescription;
    op: enumEquationOp;
}

export enum enumEquationOp {
    '+' = '+',
    '-' = '-',
    '*' = '*',
    '/' = '/',
    '^' = '^',
    'field' = 'field',
    'val' = 'val'
}

export type INewFieldSelection = {
    name: string;
    value: IEquationDescription;
    op: 'derived';
}
