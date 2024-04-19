export interface IDataEntry {
    id: string;
    m_studyId: string;
    m_subjectId: string; // patient Id
    m_visitId: string; // visit Id
    m_versionId: string | null; // data version Id
    m_fieldId: string;
    metadata?: Record<string, unknown>;
    value: unknown;
    uploadedBy?: string;
    uploadedAt: number;
}

export interface IFieldDescriptionObject {
    fieldId: string;
    timepoint: number;
    measurement: number;
    datatype: 'c' | 'i' | 'd' | 'b' | 't';
}
