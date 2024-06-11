// whether passwords can contain spaces remains to be determined by the resolver functions
// the format doesnt allow extra spaces for any kinds of names, but whether spaces are not allowed is

import { VariableValues } from '@apollo/server/dist/esm/externalTypes/graphql';

// determined by the resolver functions
const omitOperationsAndFields = {
    login: [],
    CreateUser: ['password'],
    EditUser: ['password'],
    resetPassword: ['newPassword']
};

// By default, only one space is allowed between adjacent letters
// this function only format the parameters, other requirement, such as duplicate check
// relies on the resolver functions
export function spaceFixing(operation: string, actionData: VariableValues | undefined) {
    if (Object.keys(omitOperationsAndFields).includes(operation)) {
        if (!omitOperationsAndFields[operation].length) {
            return actionData;
        }
    }
    recursiveFix(operation, actionData);
    return actionData;
}

export function recursiveFix(operation: string, obj: VariableValues | undefined): void {
    if (obj !== null && obj !== undefined) {
        // keep it original if it is a promise
        if (obj instanceof Promise) {
            return;
        } else {
            const fields = Object.keys(omitOperationsAndFields).includes(operation) ? omitOperationsAndFields[operation] : [];
            for (const key in obj) {
                switch (typeof (obj[key])) {
                    case 'object': {
                        return recursiveFix(operation, obj[key]);
                    }
                    case 'string': {
                        if (!fields.includes(key)) {
                            obj[key] = obj[key].replace(/\s+/g, ' ').trim();
                        }
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        }
    }
    return;
}
