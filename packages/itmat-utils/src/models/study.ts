export interface IStudy {
    name: string,
    createdBy: string,
    dataAdmins: string[],
    dataUsers: string[]
}

export const enum STUDY_USER_TYPE {
    dataAdmins = 'DATA_ADMIN',
    dataUsers = 'DATA_USER'
}