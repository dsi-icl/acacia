export const permissions_new = {
    dataset_specific: {
        files: {
            upload_files: 'upload_files',
            download_files: 'download_files',
            delete_files: 'delete_files',
            delete_own_files: 'delete_own_files',
            edit_files: 'edit_files'
        },
        roles: {
            create_dataset_roles: 'create_dataset_roles',
            add_users_to_dataset_roles: 'add_users_to_dataset_roles',
            edit_dataset_role_permissions: 'edit_dataset_role_permissions',
            delete_dataset_roles: 'delete_dataset_roles'
        },
        organisations: {
            add_associated_organisation_to_dataset: 'add_associated_organisation_to_dataset',
            remove_associated_organisation_to_dataset: 'remove_associated_organisation_to_dataset',
        },
        data: {
            upload_new_clinical_data: 'upload_new_clinical_data',
            select_current_dataversion: 'select_current_dataversion',
            edit_staging_dataversion: 'edit_staging_dataversion',
            commit_staging_dataversion_to_production: 'commit_staging_dataversion_to_production'
        },
        projects: {
            create_new_projects: 'create_new_projects',
            delete_projects: 'delete_projects'
        }
    },
    project_specific: {
        files: {
            download_files: 'download_files'
        },
        data: {
            view_data: 'view_data'
        },
        roles: {
            create_project_roles: 'create_project_roles',
            add_users_to_project_roles: 'add_users_to_project_roles',
            edit_project_role_permissions: 'edit_project_role_permissions',
            delete_project_roles: 'delete_project_roles'
        }
    },
    app_wide: {
        users: {
            delete_users: 'delete_users',
            edit_users: 'edit_users'
        },
        datasets: {
            create_new_datasets: 'create_new_datasets',
            delete_datasets: 'delete_datasets'
        },
        organisations: {
            create_new_organisations: 'create_new_organisations',
            delete_organisations: 'delete_organisations',
            add_users_to_organisations: 'add_users_to_organisations'
        }
    }
};

class UserPermissions {
    constructor() {

    }

    static public newFromSerialisedString(str: string): UserPermissions {
    }

    public serialisePermissionsForMongo(): string {

    }

    add(permissions: string | string[]): UserPermissions {
        if (permissions instanceof Array) {

        } else {

        }
    }

    remove(): UserPermissions {
        if (permissions instanceof Array) {

        } else {

        }
    }

    userHasTheNeccessaryPermissionFor(neededPermission: string): boolean {

    }
}

export const permissions = {
    all_user: {
        systemwide_user_management: 'systemwide_user_management' // create, delete, edit all users
    },
    all_study: {
        systemwide_study_existence_management: 'systemwide_study_existence_management', // create, delete, edit study
        all_studies_user_management: 'all_studies_user_management', // add or delete users from all studies
        all_studies_data_access: 'all_studies_data_access', // query data from all studies
        all_studies_data_management: 'all_studies_data_management', // upload data from all studies
        all_studies_role_management: 'all_studies_role_management', // create, edit and delete roles and manage permissions and users in those roles
        all_studies_manage_projects: 'all_studies_manage_projects', // allows to create, delete, edit projects within a specific study
        all_projects_data_access: 'all_projects_data_access', // query data from all projects (eid is mapped, fields and patients subset)
        all_projects_role_management: 'all_projects_role_management' // create, edit and delete roles and manage permissions and users in those roles
    },
    specific_study: {
        specific_study_readonly_access: 'specific_study_readonly_access',
        specific_study_data_management: 'specific_study_data_management', // allows to upload / edit data
        specific_study_role_management: 'specific_study_role_management', // create, edit and delete roles and manage permissions and users in those roles
        specific_study_projects_management: 'specific_study_projects_management' // allows to create, delete, edit projects within a specific study
    },
    specific_project: {
        specific_project_readonly_access: 'specific_project_readonly_access',
        specific_project_role_management: 'specific_project_role_management' // create, edit and delete roles and manage permissions and users in those roles
    }
};

export const permissionLabels = {
    systemwide_user_management: 'User management',
    systemwide_study_existence_management: 'Study management',
    all_studies_user_management: 'Studies user management',
    all_studies_data_access: 'Studies data access',
    all_studies_data_management: 'Studies data management',
    all_studies_role_management: 'Studies role management',
    all_studies_manage_projects: 'Studies projects management',
    all_projects_data_access: 'Projects data_access',
    all_projects_role_management: 'Projects role management',
    specific_study_readonly_access: 'This study readonly access',
    specific_study_data_management: 'This study data management',
    specific_study_role_management: 'This study role management',
    specific_study_projects_management: 'This study projects management',
    specific_project_readonly_access: 'This project readonly access',
    specific_project_role_management: 'This project role management'
};

export const task_required_permissions = {
    create_new_study: [
        permissions.all_study.systemwide_study_existence_management
    ],
    delete_study: [
        permissions.all_study.systemwide_study_existence_management
    ],
    manage_study_roles: [
        permissions.all_study.all_studies_role_management,
        permissions.specific_study.specific_study_role_management
    ],
    manage_study_data: [
        permissions.all_study.all_studies_data_management,
        permissions.specific_study.specific_study_data_management
    ],
    manage_study_projects: [
        permissions.all_study.all_studies_manage_projects,
        permissions.specific_study.specific_study_projects_management
    ],
    access_study_data: [
        permissions.all_study.all_studies_data_management,
        permissions.specific_study.specific_study_projects_management,
        permissions.specific_study.specific_study_data_management,
        permissions.specific_study.specific_study_readonly_access
    ],
    access_project_data: [
        permissions.all_study.all_studies_data_management,
        permissions.specific_study.specific_study_readonly_access,
        permissions.specific_study.specific_study_projects_management,
        permissions.specific_study.specific_study_data_management,
        permissions.specific_project.specific_project_readonly_access
    ],
    manage_project_roles: [
        permissions.all_study.all_projects_role_management,
        permissions.specific_study.specific_study_role_management,
        permissions.specific_project.specific_project_role_management
    ]
};
