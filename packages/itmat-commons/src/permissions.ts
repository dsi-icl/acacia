export const permissions = {
    dataset_specific: {
        // in the future, if needed
        //view_dataset: {
        //    view_files: 'dataset_specific@view_dataset@view_files',
        //    view_roles: 'dataset_specific@view_dataset@view_roles',
        //    view_data: 'dataset_specific@view_dataset@view_data',
        //    view_fields: 'dataset_specific@view_dataset@view_fields',
        //    view_projects: 'dataset_specific@view_dataset@view_projects'
        //},
        view_dataset: 'view_dataset',
        files: {
            upload_files: 'dataset_specific@files@upload_files',
            download_files: 'dataset_specific@files@download_files',
            delete_files: 'dataset_specific@files@delete_files',
            edit_files: 'dataset_specific@files@edit_files'
        },
        roles: {
            create_dataset_roles: 'dataset_specific@roles@create_dataset_roles',
            edit_dataset_role_name: 'dataset_specific@roles@edit_dataset_role_name',
            edit_dataset_role_users: 'dataset_specific@roles@edit_dataset_role_users',
            edit_dataset_role_permissions: 'dataset_specific@roles@edit_dataset_role_permissions',
            delete_dataset_roles: 'dataset_specific@roles@delete_dataset_roles',
        },
        data: {
            upload_new_clinical_data: 'dataset_specific@data@upload_new_clinical_data',
            select_current_dataversion: 'dataset_specific@data@select_current_dataversion',
            edit_staging_dataversion: 'dataset_specific@data@edit_staging_dataversion',
            commit_staging_dataversion_to_production: 'dataset_specific@data@commit_staging_dataversion_to_production'
        },
        fields: {
            upload_new_fields: 'dataset_specific@fields@upload_new_fields'
        },
        projects: {
            create_new_projects: 'dataset_specific@projects@create_new_projects',
            delete_projects: 'dataset_specific@projects@delete_projects',
            manage_project_approved_files: 'dataset_specific@projects@manage_project_approved_files',
            manage_project_approved_fields: 'dataset_specific@projects@manage_project_approved_fields',
        }
    },
    project_specific: {
        view_project: 'view_project',
        files: {
            download_files: 'project_specific@files@download_files'
        },
        roles: {
            create_project_roles: 'project_specific@roles@create_project_roles',
            edit_project_role_name: 'project_specific@roles@edit_project_role_name',
            edit_project_role_users: 'project_specific@roles@edit_project_role_users',
            edit_project_role_permissions: 'project_specific@roles@edit_project_role_permissions',
            delete_project_roles: 'project_specific@roles@delete_project_roles'
        }
    },
    app_wide: {
        users: {
            delete_users: 'app_wide@users@delete_users',
            edit_users: 'app_wide@users@edit_users'
        },
        datasets: {
            create_new_datasets: 'app_wide@datasets@create_new_datasets',
            delete_datasets: 'app_wide@datasets@delete_datasets'
        }
    }
};
<<<<<<< HEAD
=======

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
>>>>>>> develop
