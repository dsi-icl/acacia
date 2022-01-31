export type IQueryEntry = {
    id: string;
    queryString: any;
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
