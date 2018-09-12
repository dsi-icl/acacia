import { Collection } from 'mongodb'; 

interface FieldEntry {
    Path: string,
    Category: number,
    FieldID: number,
    Field: string,
    Participants?: number,
    Items?: number,
    Stability?: string,
    ValueType: string,
    Units?: string | null,
    ItemType?: string,
    Strata?: string
    Sexed?: string,
    Instances: number,
    Array: number,
    Coding?: number | null,
    Notes?: string | null,
    Link?: string
}

export class UKBFields {
    private dbcollection: Collection;

    constructor(fieldCollection: Collection) {
        this.dbcollection = fieldCollection;
    }

    async queryFieldInfo(fieldId: number) {
        const result = await this.dbcollection.findOne({ FieldID: fieldId });
        return result;
    }

    async insertFieldEntry(fieldEntry: FieldEntry) {
        const result = await this.dbcollection.insert(fieldEntry);
    }

}