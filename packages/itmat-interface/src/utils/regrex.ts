// operation that rely on spaces will not be checked
const spaceWhiteListForOperation = [
    'login'
];

// fields in white list would not be checked and corrected
const spaceWhiteListForField = [
    'password', // from CreateUserInput, EditUserInput
    'newPassword', // from resetPassword
];

// By default, only one space is allowed between adjacent letters
// this function only format the parameters, other requirement, such as duplicate check
// relies on the resolver functions
export function spaceFixing(operation, actionData) {
    if (spaceWhiteListForOperation.includes(operation)) {
        return actionData;
    }
    recursiveFix(actionData);
    return actionData;
}

export function recursiveFix(obj: any) {
    if (obj !== null && obj !== undefined) {
        // keep it original if it is a promise
        if (obj instanceof Promise) {
            return;
        } else {
            for (const key in obj) {
                switch(typeof(obj[key])) {
                    case 'object': {
                        return recursiveFix(obj[key]);
                    }
                    case 'string': {
                        if (!spaceWhiteListForField.includes(key)) {
                            obj[key] = obj[key].replace(/\s+/g, ' ').trim();
                        }
                        break;
                    }
                    default: {
                        return;
                    }
                }
            }
        }
    }
    return;
}
