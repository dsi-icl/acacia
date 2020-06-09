export enum fileTypes {
    STUDY_REPO_OBJ_STORE_FILE = 'STUDY_REPO_OBJ_STORE_FILE',
    STUDY_REPO_SCRIPT_FILE = 'STUDY_REPO_SCRIPT_FILE',
    STUDY_REPO_DIR = 'STUDY_REPO_DIR',
    USER_PERSONAL_FILE = 'USER_PERSONAL_FILE ',
    USER_PERSONAL_DIR = 'USER_PERSONAL_DIR'
}

export const fileTypesDirs = [
    fileTypes.STUDY_REPO_DIR,
    fileTypes.USER_PERSONAL_DIR
];

export const fileTypesFiles = [
    fileTypes.STUDY_REPO_OBJ_STORE_FILE,
    fileTypes.STUDY_REPO_SCRIPT_FILE,
    fileTypes.USER_PERSONAL_FILE
];

export const fileTypesStudy = [
    fileTypes.STUDY_REPO_DIR,
    fileTypes.STUDY_REPO_OBJ_STORE_FILE,
    fileTypes.STUDY_REPO_SCRIPT_FILE
];

export const fileTypesPersonal = [
    fileTypes.USER_PERSONAL_DIR,
    fileTypes.USER_PERSONAL_FILE
];

export const fileTypesScript = [
    fileTypes.STUDY_REPO_SCRIPT_FILE,
    fileTypes.USER_PERSONAL_FILE
];

export const fileTypesObjStore = [
    fileTypes.STUDY_REPO_OBJ_STORE_FILE
];
