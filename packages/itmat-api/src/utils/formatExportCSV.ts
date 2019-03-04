import { db } from '../database/database';

export interface IDataEntry {
    m_jobId: string,
    m_eid: string,
    m_study: string,
    m_in_qc: boolean,
    [field: string]: {
        [instance: string]: {
            [array: number]: number | string
        }
    } | string | boolean | string []
}

export interface IField {
    
        [instance: string]: {
            [array: number]: number | string }
        
}

const data = [{
    m_jobId: 'fsa',
    m_eid: 'fdsaf',
    m_study: 'fdsafdsaf',
    m_in_qc: true,
    field1: {
        0: {
            0: 'fsaff',
            1: 435325
        },
        1: {
            0: 'r2e',
            1: 'dfssdafs'
        }
    },
    field2: {
        0: {
            0: 'fsfsdfaadsfaff',
            1: 43533425
        },
        1: {
            0: 'r2fsdafsde',
            1: 'dfssfdsfasdafs'
        }
    }
},{
    m_jobId: 'fsdsfaa',
    m_eid: 'fdsfdsafdaf',
    m_study: 'fdsafdsafdsfsdafsdafdsaf',
    m_in_qc: true,
    field1: {
        0: {
            0: 'fsafdsafsf',
            1: 'fdsfas'
        },
        1: {
            0: 'r2e',
            1: 'dfssdafs'
        }
    },
    field3: {
        0: {
            0: 'fsfsdfaadsfaff',
            1: 43533425
        },
        1: {
            0: 'r2fsdafsde',
            1: 'dfssfdsfasdafs'
        }
    }
}]




export class DataExportCSV {
    private readonly existingFields: Set<string>;
    constructor(private readonly data: IDataEntry[]) {
        this.existingFields = new Set();
    }

    public formatCSV() {
        this.flattenDocument();
        this.fillInMissingData();
        return this.data;
    }

    private fillInMissingData() {
        const nullLine = Array.from(this.existingFields).reduce((a, e) => { a[e] =  null; return a }, {} as any);
        for (let i = 0, length = this.data.length; i < length; i++) {
            this.data[i] = { ...nullLine, ...this.data[i] };
        }
    }

    private unwindField(document: IDataEntry, field: IField, fieldId: string) {  //mutation
        for (let instancekey in field) {
            for (let arraykey in field[instancekey]) {
                const newKey = `${fieldId}.${instancekey}.${arraykey}`;
                this.existingFields.add(newKey);
                document[newKey] = field[instancekey][arraykey] as any;
            }
        }
        delete document[fieldId];
    }

    private flattenDocument() {
        for (let each of this.data) {
            const { m_eid } = each;
            delete each.m_eid;   // mutation
            delete each.m_in_qc;
            delete each.m_jobId;
            delete each.m_study;
            for (let key in each) {
                this.unwindField(each, each[key] as any, key);
            }
            each.m_eid = m_eid;
        }
    }
}

