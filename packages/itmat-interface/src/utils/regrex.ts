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
    const modifiedData = {};
    if (actionData !== undefined) {
        for (const key in actionData) {
            if (typeof(actionData[key]) === 'string' && spaceWhiteListForField.includes(key)) {
                modifiedData[key] = actionData[key].replace(/\s+/g,' ').trim();
            } else {
                modifiedData[key] = actionData[key];
            }
        }
    }
    return modifiedData;
}
