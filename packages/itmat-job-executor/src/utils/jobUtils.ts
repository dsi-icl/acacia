import { Models } from 'itmat-commons';

/* validate a field string */
export function fieldValidator(field: string): boolean {
    if (/^\d+@\d+.\d+(:[cidbt])?$/.test(field)) {
        return true;
    }
    return false;
}

/* decompose a field string */
export function fieldParser(field: string): Models.Data.IFieldDescriptionObject {
    const fieldId = parseInt(field.substring(0, field.indexOf('@')), 10);
    const timepoint = parseInt(field.substring(field.indexOf('@') + 1, field.indexOf('.')), 10);
    const measurement = parseInt(field.substring(field.indexOf('.') + 1, field.indexOf(':') === -1 ? field.length : field.indexOf(':')), 10);
    const datatype: 'c' | 'i' | 'd' | 'b' | 't' = field.indexOf(':') === -1 ? 'c' : field.substring(field.indexOf(':') + 1, field.length) as ('c' | 'i' | 'd' | 'b');
    return {
        fieldId,
        timepoint,
        measurement,
        datatype
    };
}
