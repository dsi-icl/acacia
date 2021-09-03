export interface IDataEntry {
    m_jobId: string; // the id of the job that causes this upload
    m_eid: string; // patient Id
    m_study: string; // study Id
    m_versionId: string; // data version Id
    [field: string]: {
        [instance: string]: {
            [array: number]: number | string
        }
    } | string | boolean | string[];
}

export interface IFieldDescriptionObject {
    fieldId: number;
    timepoint: number;
    measurement: number;
    datatype: 'c' | 'i' | 'd' | 'b' | 't';
}
