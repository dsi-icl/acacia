export interface IDataEntry {
    id: string;
    m_studyId: string;
    m_subjectId: string; // patient Id
    m_visitId: string; // visit Id
    m_versionId: string | null; // data version Id
    metadata?: JSON;
    [field: string]: any
}

export interface IFieldDescriptionObject {
    fieldId: string;
    timepoint: number;
    measurement: number;
    datatype: 'c' | 'i' | 'd' | 'b' | 't';
}
