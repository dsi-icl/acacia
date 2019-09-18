import { alphabetTypes, alphabetToTypeTable} from './alphabet';

export const acceptingStates = [1, 2, 4, 5, 7, 9, 6, 10, 11];

export const stateTransitionTable: {
    [key: number]: {
        [key: number]: number
    }
} = {
    0: {
        [alphabetTypes.arithmeticOperator]: 2,
        [alphabetTypes.openParenthesis]: 1,
        [alphabetTypes.closeParenthesis]: 11,
        [alphabetTypes.digit]: 7,
        [alphabetTypes.whitespace]: 5,
        [alphabetTypes.letter]: 6,
        [alphabetTypes.quote]: 3,
        [alphabetTypes.comparisonOperator]: 10
    },
    1: {},
    2: {},
    3: {
        [alphabetTypes.quote]: 4,
        // all -> 3
    },
    4: {},
    5: {
        [alphabetTypes.whitespace]: 5
    },
    6: {
        [alphabetTypes.letter]: 6
    },
    7: {
        [alphabetTypes.digit]: 7,
        [alphabetTypes.dot]: 8
    },
    8: {
        [alphabetTypes.digit]: 9
    },
    9: {
        [alphabetTypes.digit]: 9
    },
    10: {},
    11: {}
}