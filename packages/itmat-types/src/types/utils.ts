// Value verifier
export interface IValueVerifier {
    formula: IAST;
    condition: enumConditionOps;
    value: string | number;
    parameters: Record<string, unknown>;
}

export enum enumConditionOps {
    NUMERICALEQUAL = 'numerical:=',
    NUMERICALNOTEQUAL = 'numerical:!=',
    NUMERICALLESSTHAN = 'numerical:<',
    NUMERICALGREATERTHAN = 'numerical:>',
    NUMERICALNOTLESSTHAN = 'numerical:>=',
    NUMERICALNOTGREATERTHAN = 'numerical:<=',
    STRINGREGEXMATCH = 'string:=regex=',
    STRINGEQUAL = 'string:=',
    GENERALISNULL = 'general:=null',
    GENERALISNOTNULL = 'general:!=null'
}

export interface IAST {
    type: enumASTNodeTypes;
    operator: enumMathOps | null,
    value: string | number | null;
    parameters: Record<string, unknown>;
    children: IAST[] | null; // null for lead node; OPERATION type should not be a lead node.
}

export enum enumASTNodeTypes {
    OPERATION = 'OPERATION',
    VARIABLE = 'VARIABLE',
    SELF = 'SELF', // the input value
    VALUE = 'VALUE',
    MAP = 'MAP'
}

export enum enumMathOps {
    NUMERICALADD = 'numerical:+',
    NUMERICALMINUS = 'numerical:-',
    NUMERICALMULTIPLY = 'numerical:*',
    NUMERICALDIVIDE = 'numerical:/',
    NUMERICALPOW = 'numerical:^',
    STRINGCONCAT = 'string:+',
    STRINGSUBSTR = 'string:substr',
    TYPECONVERSION = 'string:=>'
}