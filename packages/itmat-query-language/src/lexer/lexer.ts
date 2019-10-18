import { alphabetToTypeTable, alphabetTypes } from './alphabet';
import { acceptingStates, stateTransitionTable } from './stateTable';
import { IToken, stateToTokenClassMap, tokenClass, unquotedStringToClassMap } from './tokenClass';

export class Lexer {
    private currentPosition: number;

    constructor(
        private readonly inputString: string
    ) {
        this.currentPosition = 0;
    }

    public tokenize(removeWhiteSpace: boolean = false) {
        let tokens = [];

        let nextToken: IToken;
        while (nextToken = this.nextToken()) {
            tokens.push(nextToken);
            if (nextToken.class === tokenClass.END_OF_INPUT) {
                break;
            }
        }
        if (removeWhiteSpace) {
            tokens = tokens.filter((el) => el.class !== tokenClass.WHITE_SPACE);
        }
        return tokens;
    }

    private nextToken(): IToken {
        if (this.currentPosition >= this.inputString.length) {
            return ({ value: '', class: tokenClass.END_OF_INPUT });
        }

        const transversedStates: number[] = [];

        let tmpPosition = this.currentPosition;
        let currentState: number = 0;
        let inputCharType: alphabetTypes = alphabetToTypeTable[this.inputString[tmpPosition]] || alphabetTypes.others;
        let nextState;
        while (nextState = this.nextState(currentState, inputCharType)) {
            tmpPosition += 1;
            currentState = nextState;
            inputCharType = alphabetToTypeTable[this.inputString[tmpPosition]] || alphabetTypes.others;
            transversedStates.push(nextState);
        }

        for (let i = transversedStates.length - 1; i >= 0; i--) {
            if (acceptingStates.includes(transversedStates[i])) {
                const value = this.inputString.slice(this.currentPosition, this.currentPosition + i + 1);
                let tokenClass;
                if (transversedStates[i] === 6) {
                    if (unquotedStringToClassMap[value] !== undefined) {
                        tokenClass = unquotedStringToClassMap[value];
                    } else {
                        throw Error(`"${value}" does not exist in available words. Did you mean to put the name in quotes?`);
                    }
                } else {
                    tokenClass = stateToTokenClassMap[transversedStates[i]];
                }
                this.currentPosition += i + 1;
                return ({ value, class: tokenClass });
            }
        }
        throw Error(`Unexpected character '${this.inputString[this.currentPosition]}' at position ${this.currentPosition}.`);
    }

    private nextState(currentState: number, inputCharType: alphabetTypes): undefined | number {
        if (currentState === 3 && inputCharType !== alphabetTypes.quote) {
            return 3;   // inside quote everything goes
        }

        const transitions = stateTransitionTable[currentState];

        return transitions[inputCharType];
    }
}
