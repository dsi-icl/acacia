export interface IQueryEntry {
    id: string,
    queryString: string,
    study: string,
    application: string,
    requester: string,
    claimedBy?: string,
    lastClaimed?: number,
    status: string,
    error: null | object,
    cancelled: boolean,
    cancelledTime?: number,
    queryResult?: string,
    data_requested: string[],
    cohort: ICohortSelection[][],
    new_fields: INewFieldSelection[]
}

export interface ICohortSelection {
    field: string,
    value: string,
    op: enumCohortSelectionOp
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

export interface IEquationDescription {
    left: string | IEquationDescription,
    right: string | IEquationDescription,
    op: enumEquationOp
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

export interface INewFieldSelection {
    name: string,
    value: IEquationDescription,
    op: 'derived'
}