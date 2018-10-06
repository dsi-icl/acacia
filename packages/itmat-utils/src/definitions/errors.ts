export const APIErrorTypes = {
    entryNotFound: (entryName: TemplateStringsArray) => `Entry for ${entryName} not found.`,
    authorised: 'You are not authorised to be doing this request.',
    missingQueryString: (queryParam: TemplateStringsArray) => `You must provide a query parameter '${queryParam}'.`,
    duplicateQueryString: (queryParam: TemplateStringsArray) => `You must provide only one instance of this query parameter: '${queryParam}'.`,
    invalidUKBFieldIDQueryString: 'fieldId must be a number; if you are copying the id from UK Biobank csv file, provide the only fieldId before \'-\'.',
    missingRequestKey: (object: string, missingKeys: string[]) => `A ${object} object with key(s) '${missingKeys.join(',')}' are expected. Please check API doc.`,
    invalidReqKeyValue: (key: string, ...rest: string[]) => `Invalid value for key '${key}'. ${rest.length !== 0 ? `Valid value: ${rest.join(',')}` : '' }`
};