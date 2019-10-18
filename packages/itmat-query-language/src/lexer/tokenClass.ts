export interface IToken {
    class: string;
    value: string;
}

export const stateToTokenClassMap: {
    [key: number]: tokenClass
} = {
    1: tokenClass.OPEN_PARENTHESIS,
    2: tokenClass.ARITHMETIC_OPERATOR,
    4: tokenClass.NAME,
    5: tokenClass.WHITE_SPACE,
    6: tokenClass.KEYWORD,
    7: tokenClass.NUMBER,
    9: tokenClass.NUMBER,
    10: tokenClass.COMPARISON_OPERATOR,
    11: tokenClass.CLOSE_PARENTHESIS
};


export const enum tokenClass {
    WHITE_SPACE = 'WHITE_SPACE',
    OPEN_PARENTHESIS = 'OPEN_PARENTHESIS',
    CLOSE_PARENTHESIS = 'CLOSE_PARENTHESIS',
    KEYWORD = 'KEYWORD',
    FIELD = 'FIELD',
    INSTANCE = 'INSTANCE',
    ARRAY = 'ARRAY',
    ARITHMETIC_OPERATOR = 'ARITHMETIC_OPERATOR',
    COMPARISON_OPERATOR = 'COMPARISON_OPERATOR',
    AND_OR = 'AND_OR',
    NAME = 'NAME',
    NUMBER = 'NUMBER',
    WILDCARD = 'WILDCARD',
    IMAGE = 'IMAGE',
    EXPRESSION = 'EXPRESSION',
    NUMBER_OF = 'NUMBER_OF',
    END_OF_INPUT = 'END_OF_INPUT',
    VALUE_OF = 'VALUE_OF'
}

export const unquotedStringToClassMap: {
    [key: string]: tokenClass
} = {
    field: tokenClass.FIELD,
    instance: tokenClass.INSTANCE,
    array: tokenClass.ARRAY,
    AND: tokenClass.AND_OR,
    OR: tokenClass.AND_OR,
    any: tokenClass.WILDCARD,
    imageExistsFor: tokenClass.IMAGE,
    expr: tokenClass.EXPRESSION,
    numberOf: tokenClass.NUMBER_OF,
    value: tokenClass.VALUE_OF
};
