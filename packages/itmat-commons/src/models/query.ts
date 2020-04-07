export enum enumCohortSelectionOp {
    EQ = '=',
    NE = '!=',
    GT = '>',
    LOT = '<',
    DERIVED = 'derived',
    EXISTS = 'exists',
    COUNT = 'count'
}

export interface ICohortSelection {
    field: string;
    value: string;
    op: enumCohortSelectionOp;
}

export enum enumEquationOp {
    P = '+',
    S = '-',
    M = '*',
    D = '/',
    I = '^',
    FIELD = 'field',
    VAL = 'val'
}

export interface IEquationDescription {
    left: string | IEquationDescription;
    right: string | IEquationDescription;
    op: enumEquationOp;
}

export interface INewFieldSelection {
    name: string;
    value: IEquationDescription;
    op: 'derived';
}

export interface IQueryEntry {
    id: string;
    queryString: string;
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
