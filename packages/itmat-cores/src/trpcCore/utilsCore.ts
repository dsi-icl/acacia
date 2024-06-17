import { IValueVerifier, IAST, enumASTNodeTypes, enumMathOps, enumConditionOps, CoreError, enumCoreErrors } from '@itmat-broker/itmat-types';
import crypto from 'crypto';

type IDataTransformationClip = Record<string, unknown>;

export class TRPCUtilsCore {
    /**
     * This function checks scalar data only.
     *
     * @param value - The input value.
     * @param verifier - The input IAST.
     * @returns If the value pass the verifier.
     */
    public validValueWithVerifier(value: number | string | IDataTransformationClip, verifier: IValueVerifier): boolean {
        const calculatedValue = this.IASTHelper(verifier.formula, value);
        if (verifier.condition === enumConditionOps.NUMERICALEQUAL) {
            return calculatedValue === this.parseInputToNumber(verifier.value);
        } else if (verifier.condition === enumConditionOps.NUMERICALNOTEQUAL) {
            return calculatedValue !== verifier.value;
        } else if (verifier.condition === enumConditionOps.NUMERICALLESSTHAN) {
            return calculatedValue < verifier.value;
        } else if (verifier.condition === enumConditionOps.NUMERICALGREATERTHAN) {
            return calculatedValue > verifier.value;
        } else if (verifier.condition === enumConditionOps.NUMERICALNOTLESSTHAN) {
            return calculatedValue >= verifier.value;
        } else if (verifier.condition === enumConditionOps.NUMERICALNOTGREATERTHAN) {
            return calculatedValue <= verifier.value;
        } else if (verifier.condition === enumConditionOps.STRINGREGEXMATCH) {
            return new RegExp(verifier.value.toString()).test(calculatedValue.toString());
        } else if (verifier.condition === enumConditionOps.STRINGEQUAL) {
            return calculatedValue === verifier.value;
        } else if (verifier.condition === enumConditionOps.GENERALISNOTNULL) {
            return calculatedValue !== null;
        } else if (verifier.condition === enumConditionOps.GENERALISNULL) {
            return calculatedValue === null;
        }
        return false;
    }

    public parseInputToNumber(input: number | string): number {
        // If the input is already a number, return it
        if (typeof input === 'number') {
            return input;
        }

        // If the input is a string
        if (typeof input === 'string') {
            // If the string contains a decimal point, use parseFloat
            if (input.includes('.')) {
                return parseFloat(input);
            }
            // Otherwise, use parseInt
            return parseInt(input, 10);
        }

        // If the input is neither a number nor a string, throw an error
        throw new Error('Input must be a number or a string');
    }

    public IASTHelper(root: IAST, data: number | string | IDataTransformationClip) {
        if (root.type === enumASTNodeTypes.VALUE) {
            return root.value;
        }
        if (root.type === enumASTNodeTypes.SELF) {
            return data;
        }
        if (typeof data === 'string' && root.type === enumASTNodeTypes.MAP) {
            return root.parameters[data] ?? data;
        }
        // in this case, the data should be a json
        if (root.type === enumASTNodeTypes.VARIABLE) {
            if (root.value) {
                const keys = (root.value as string).split('.');
                let current = data;

                for (const k of keys) {
                    if (current[k] !== undefined) {
                        current = current[k];
                    } else {
                        return undefined;
                    }
                }

                return current;
            }
        }
        if ((typeof data === 'number' || typeof data === 'string') && root.type === enumASTNodeTypes.OPERATION) {
            if (!root.operator) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'OPEARTION node must have an operator'
                );
            }
            if (root.operator === enumMathOps.NUMERICALADD && root.children && root.children.length === 2) {
                return this.IASTHelper(root.children[0], this.parseInputToNumber(data)) + this.IASTHelper(root.children[1], this.parseInputToNumber(data));
            } else if (root.operator === enumMathOps.NUMERICALMINUS && root.children && root.children.length === 2) {
                return this.IASTHelper(root.children[0], this.parseInputToNumber(data)) - this.IASTHelper(root.children[1], this.parseInputToNumber(data));
            } else if (root.operator === enumMathOps.NUMERICALMULTIPLY && root.children && root.children.length === 2) {
                return this.IASTHelper(root.children[0], this.parseInputToNumber(data)) * this.IASTHelper(root.children[1], this.parseInputToNumber(data));
            } else if (root.operator === enumMathOps.NUMERICALDIVIDE && root.children && root.children.length === 2) {
                return this.IASTHelper(root.children[0], this.parseInputToNumber(data)) / this.IASTHelper(root.children[1], this.parseInputToNumber(data));
            } else if (root.operator === enumMathOps.NUMERICALPOW && root.children && root.children.length === 2) {
                return Math.pow(this.IASTHelper(root.children[0], this.parseInputToNumber(data)), this.IASTHelper(root.children[1], this.parseInputToNumber(data)));
            } else if (root.operator === enumMathOps.STRINGCONCAT && root.children && root.children.length) {
                return root.children.reduce((a, c) => {
                    return a + this.IASTHelper(c, data).toString();
                }, '');
            } else if (root.operator === enumMathOps.STRINGSUBSTR && root.children && root.children.length === 3) {
                return (this.IASTHelper(root.children[0], data).toString()).substr(this.IASTHelper(root.children[1], data), this.IASTHelper(root.children[2], data.toString()));
            } else if (root.operator === enumMathOps.TYPECONVERSION && root.children && root.children.length === 2) {
                const newType = this.IASTHelper(root.children[0], data);
                if (newType === 'INT') {
                    return Math.floor(Number(this.IASTHelper(root.children[0], data)));
                } else if (newType === 'FLOAT') {
                    return parseFloat((this.IASTHelper(root.children[0], data) as string | number).toString());
                } else if (newType === 'STRING') {
                    return this.IASTHelper(root.children[0], data).toString();
                } else {
                    throw new CoreError(
                        enumCoreErrors.CLIENT_MALFORMED_INPUT,
                        'Type converstion only supports INT, FLOAT and STRING.'
                    );
                }
            } else {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Operator and children does not match.'
                );
            }
        }
        throw new CoreError(
            enumCoreErrors.CLIENT_MALFORMED_INPUT,
            'Node type must be OPERATION,, SELF or VALUE'
        );
    }

    public normalize(obj) {
        if (Array.isArray(obj)) {
            return obj.map(this.normalize.bind(this)).sort();
        } else if (typeof obj === 'object' && obj !== null) {
            const sortedObj: { [key: string]: unknown } = {};
            Object.keys(obj).sort().forEach(key => {
                sortedObj[key] = this.normalize.bind(this)(obj[key]);
            });
            return sortedObj;
        } else {
            return obj;
        }
    }

    public computeHash(inputObject): string {
        const normalizedObj = this.normalize.bind(this)(inputObject);
        const str = JSON.stringify(normalizedObj);
        return crypto.createHash('sha256').update(str).digest('hex');
    }

}
