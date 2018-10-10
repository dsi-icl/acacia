export const Errors = {
    notLoggedIn: 'Unauthorised! You are not logged in',
    entryNotFound: (entryName: string) => `Entry for ${entryName} not found.`,
    invalidDataType: (name: string, type: string) => `${name} must be of type ${type}`,
    resultBiggerThanOne: 'Weird things do happen. Server error.Contact admin referencing the error ID if given.',
    authorised: 'You are not authorised to be doing this request.',
    missingQueryString: (queryParams: string[]) => `You must provide the following query parameters '${queryParams.join(',')}'.`,
    duplicateQueryString: (queryParam: TemplateStringsArray) => `You must provide only one instance of this query parameter: '${queryParam}'.`,
    invalidUKBFieldIDQueryString: 'fieldId must be a number; if you are copying the id from UK Biobank csv file, provide the only fieldId before \'-\'.',
    missingRequestKey: (object: string, missingKeys: string[]) => `A ${object} object with key(s) '${missingKeys.join(',')}' are expected. Please check API doc.`,
    invalidReqKeyValue: (key: string, validValues: any[]) => `Invalid value for key '${key}'. ${validValues.length !== 0 ? `Valid value(s): ${validValues.join(',')}` : '' }`
};