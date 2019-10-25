import { IToken, tokenClass } from '../lexer/tokenClass';

export class Parser {
    private currentPosition: number = -1;

    constructor(private readonly tokenArr: IToken[]) {}

    public advancePosition() {
        this.currentPosition += 1;
    }

    public nextToken(): IToken {
        return this.tokenArr[this.currentPosition + 1];
    }

    public reportSyntaxError(e: string): void {
        throw Error(`${e} at ${this.currentPosition + 1}`);
    }

    public parse(): any {
        return this.CONDITION_GROUP();
    }

    public CONDITION_GROUP() {
        // <CONDITION_GROUP> -> <CONDITION> <CONDITION_GROUP'>
        return (
            {
                type: 'CONDITION_GROUP',
                children: [this.CONDITION(), this.CONDITION_GROUP_PRIME()]
            }
        );
    }

    public CONDITION(): any {
        // <CONDITION> -> ( <CONDITION_GROUP> )
        //     | expr ( <EXPRESSION> ) <OP> number
        //     | imageExistsFor <FIELD_DESCRIPTION>
        //     | value ( <FIELD_DESCRIPTION> ) <OP> <TARGET_VALUE>
        //     | e if (and / or / eof);
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.OPEN_PARENTHESIS:
                return (
                    { type: 'CONDITION', children: [
                        this._openParenthesis(),
                        this.CONDITION_GROUP(),
                        this._closeParenthesis()
                    ]}
                );
            case tokenClass.EXPRESSION:
                return (
                    { type: 'CONDITION', children: [
                        this._expression(),
                        this._openParenthesis(),
                        this.EXPRESSION(),
                        this._closeParenthesis(),
                        this._comparison_operator(),
                        this._number()
                    ]}
                );
            case tokenClass.IMAGE:
                return (
                    { type: 'CONDITION', children: [
                        this._imageExistsFor(),
                        this.FIELD_DESCRIPTION()
                    ]}
                );
            case tokenClass.VALUE_OF:
                return (
                    { type: 'CONDITION', children: [
                        this._value(),
                        this._openParenthesis(),
                        this.FIELD_DESCRIPTION(),
                        this._closeParenthesis(),
                        this._comparison_operator(),
                        this.TARGET_VALUE()
                    ]}
                );
            case tokenClass.AND_OR:
            case tokenClass.END_OF_INPUT:
                return this._epsilon();
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }

    }

    public CONDITION_GROUP_PRIME(): any {
        // <CONDITION_GROUP'> -> and <CONDITION> <CONDITION_GROUP'>
        //             | or <CONDITION> <CONDITION_GROUP'>
        //             | e if eof
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.AND_OR:
                return (
                    { type: 'CONDITION_GROUP_PRIME', children: [
                        this._and_or(),
                        this.CONDITION(),
                        this.CONDITION_GROUP_PRIME()
                    ]}
                );
            case tokenClass.END_OF_INPUT:
                return (
                    { type: 'CONDITION_GROUP_PRIME', children: [
                        this._epsilon()
                    ]}
                );
            case tokenClass.CLOSE_PARENTHESIS:
                return (
                    { type: 'CONDITION_GROUP_PRIME', children: [
                        this._epsilon()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public EXPRESSION(): any {
        // <EXPRESSION> -> <TERM> <EXPRESSION'>
        return (
            {
                type: 'EXPRESSION',
                children: [this.TERM(), this.EXPRESSION_PRIME()]
            }
        );
    }

    public FIELD_DESCRIPTION() {
        // <FIELD_DESCRIPTION> -> <FIELD> <INSTANCE_ARRAY>
        return (
            {
                type: 'FIELD_DESCRIPTION',
                children: [this.FIELD(), this.INSTANCE_ARRAY()]
            }
        );
    }

    public TARGET_VALUE(): any {
        // <TARGET_VALUE> -> number
        //                 | name
        //                 | value ( <FIELD_DESCRIPTION> )
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.NUMBER:
                return (
                    { type: 'TARGET_VALUE', children: [
                        this._number()
                    ]}
                );
            case tokenClass.NAME:
                return (
                    { type: 'TARGET_VALUE', children: [
                        this._name()
                    ]}
                );
            case tokenClass.VALUE_OF:
                return (
                    { type: 'TARGET_VALUE', children: [
                        this._value(),
                        this._openParenthesis(),
                        this.FIELD_DESCRIPTION(),
                        this._closeParenthesis()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }

    }

    public FIELD() {
        // <FIELD> -> field <FIELD_IDENTIFIER>
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.FIELD:
                return (
                    { type: 'FIELD', children: [
                        this._field(),
                        this.FIELD_IDENTIFIER()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public FIELD_IDENTIFIER(): any {
        // <FIELD_IDENTIFIER> -> number
        //                      | name
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.NUMBER:
                return (
                    { type: 'FIELD_IDENTIFIER', children: [
                        this._number()
                    ]}
                );
            case tokenClass.NAME:
                return (
                    { type: 'FIELD_IDENTIFIER', children: [
                        this._name()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public INSTANCE_ARRAY() {
        // <INSTANCE_ARRAY> -> instance <INSTANCE_ARRAY_IDENTIFIER>
        //                  | e if eof, ), and_or, epilosn
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.INSTANCE:
                return (
                    { type: 'INSTANCE_ARRAY', children: [
                        this._instance(),
                        this.INSTANCE_ARRAY_IDENTIFIER()
                    ]}
                );
            case tokenClass.CLOSE_PARENTHESIS:
                return (
                    { type: 'INSTANCE_ARRAY', children: [
                        this._epsilon()
                    ]}
                );
            case tokenClass.END_OF_INPUT:
            case tokenClass.AND_OR:
                return (
                    { type: 'INSTANCE_ARRAY', children: [
                        this._epsilon()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public INSTANCE_ARRAY_IDENTIFIER() {
        // <INSTANCE_ARRAY_IDENTIFIER> -> number <ARRAY>
        //                             | any
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.NUMBER:
                return (
                    { type: 'INSTANCE_ARRAY_IDENTIFIER', children: [
                        this._number(),
                        this.ARRAY()
                    ]}
                );
            case tokenClass.WILDCARD:
                return (
                    { type: 'INSTANCE_ARRAY_IDENTIFIER', children: [
                        this._wildcard()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public ARRAY(): any {
        // <ARRAY> -> array <ARRAY_IDENTIFIER>
        //         | e
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.INSTANCE:
                return (
                    { type: 'ARRAY', children: [
                        this._array(),
                        this.ARRAY_IDENTIFIER()
                    ]}
                );
            case tokenClass.CLOSE_PARENTHESIS:
                return (
                    { type: 'ARRAY', children: [
                        this._epsilon()
                    ]}
                );
            case tokenClass.END_OF_INPUT:
            case tokenClass.AND_OR:
                return (
                    { type: 'ARRAY', children: [
                        this._epsilon()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public ARRAY_IDENTIFIER() {
        // <ARRAY_IDENTIFIER> -> any
        //                     | number
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.NUMBER:
                return (
                    { type: 'INSTANCE_ARRAY_IDENTIFIER', children: [
                        this._number(),
                        this.ARRAY()
                    ]}
                );
            case tokenClass.WILDCARD:
                return (
                    { type: 'INSTANCE_ARRAY_IDENTIFIER', children: [
                        this._wildcard()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public EXPRESSION_PRIME(): any {
        // <EXPRESSION'> -> + <TERM> <EXPRESSION'>
        //                 |  - <TERM> <EXPRESSION'>
        //                 |  e
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.ARITHMETIC_OPERATOR:
                if (nexttoken.value === '+' || nexttoken.value === '-') {
                    return (
                        { type: 'EXPRESSION_PRIME', children: [
                            this._arithmetic_operator(),
                            this.TERM(),
                            this.EXPRESSION_PRIME()
                        ]}
                    );
                } else {
                    this.reportSyntaxError(JSON.stringify(nexttoken));
                }
            case tokenClass.CLOSE_PARENTHESIS:
                return (
                    { type: 'EXPRESSION_PRIME', children: [
                        this._epsilon()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public TERM() {
        // <TERM> -> <FACTOR> <TERM'>
        return (
            {
                type: 'TERM',
                value: [this.FACTOR(), this.TERM_PRIME()]
            }
        );
    }

    public FACTOR() {
        // <FACTOR> -> ( EXPRESSION )
        //           | number
        //           | value ( <FIELD_DESCRIPTION> )
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.OPEN_PARENTHESIS:
                return (
                    { type: 'FACTOR', children: [
                        this._openParenthesis(),
                        this.EXPRESSION(),
                        this._closeParenthesis()
                    ]}
                );
            case tokenClass.NUMBER:
                return (
                    { type: 'FACTOR', children: [
                        this._number()
                    ]}
                );
            case tokenClass.VALUE_OF:
                return (
                    { type: 'FACTOR', children: [
                        this._value(),
                        this._openParenthesis(),
                        this.FIELD_DESCRIPTION(),
                        this._closeParenthesis()
                    ]}
                );
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }
    }

    public TERM_PRIME(): any {
        // <TERM'> -> x <FACTOR> <TERM'>
        //     |  / <FACTOR> <TERM'>
        //     | e if eof,+,-,)
        const nexttoken = this.nextToken();
        switch (nexttoken.class) {
            case tokenClass.ARITHMETIC_OPERATOR:
                if (nexttoken.value === '/' || nexttoken.value === '*') {
                    return (
                        { type: 'TERM_PRIME', children: [
                            this._arithmetic_operator(),
                            this.FACTOR(),
                            this.TERM_PRIME()
                        ]}
                    );
                }
            case tokenClass.END_OF_INPUT:
                return (
                    { type: 'FACTOR', children: [
                        this._epsilon()
                    ]}
                );
            case tokenClass.CLOSE_PARENTHESIS:
                return (
                    { type: 'FACTOR', children: [
                        this._epsilon()
                    ]}
                );
            case tokenClass.ARITHMETIC_OPERATOR:
                if (nexttoken.value === '+' || nexttoken.value === '-') {
                    return (
                        { type: 'FACTOR', children: [
                            this._epsilon()
                        ]}
                    );
                }
            default:
                this.reportSyntaxError(JSON.stringify(nexttoken));
        }

    }

    public _number() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.NUMBER) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.NUMBER,
            token: true,
            value: nextToken.value
        });
    }

    public _imageExistsFor() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.IMAGE) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.IMAGE,
            token: true,
            value: nextToken.value
        });
    }

    public _name() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.NAME) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.NAME,
            token: true,
            value: nextToken.value
        });
    }

    public _wildcard() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.WILDCARD) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.WILDCARD,
            token: true,
            value: nextToken.value
        });
    }

    public _comparison_operator() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.COMPARISON_OPERATOR) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.COMPARISON_OPERATOR,
            token: true,
            value: nextToken.value
        });
    }

    public _arithmetic_operator() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.ARITHMETIC_OPERATOR) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.ARITHMETIC_OPERATOR,
            token: true,
            value: nextToken.value
        });
    }

    public _value() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.VALUE_OF) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.VALUE_OF,
            token: true,
            value: nextToken.value
        });
    }

    public _openParenthesis() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.OPEN_PARENTHESIS) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.OPEN_PARENTHESIS,
            token: true,
            value: nextToken.value
        });
    }

    public _closeParenthesis() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.CLOSE_PARENTHESIS) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.CLOSE_PARENTHESIS,
            token: true,
            value: nextToken.value
        });
    }

    public _expression() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.EXPRESSION) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        // expression token
        return ({
            type: tokenClass.EXPRESSION,
            token: true,
            value: nextToken.value
        });
    }

    public _and_or() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.AND_OR) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.AND_OR,
            token: true,
            value: nextToken.value
        });
    }

    public _epsilon() {
        // this.advancePosition();
        return ({
            type: 'epsilon',
            token: true,
            value: null
        });
    }

    public _field() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.FIELD) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.FIELD,
            token: true,
            value: nextToken.value
        });
    }

    public _instance() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.INSTANCE) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.INSTANCE,
            token: true,
            value: nextToken.value
        });
    }

    public _array() {
        const nextToken = this.nextToken();
        if (nextToken.class !== tokenClass.ARRAY) {
            this.reportSyntaxError(JSON.stringify(nextToken));
        }
        this.advancePosition();
        return ({
            type: tokenClass.ARRAY,
            token: true,
            value: nextToken.value
        });
    }



}
