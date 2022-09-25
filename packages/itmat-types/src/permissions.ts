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
        specific_study_projects_management: 'specific_study_projects_management', // allows to create, delete, edit projects within a specific study
        specific_study_data_own_organisation_only: 'specific_study_data_own_organisation_only' // user with this will access data from own organisaiton, for both readonly and management
    },
    specific_project: {
        specific_project_readonly_access: 'specific_project_readonly_access',
        specific_project_role_management: 'specific_project_role_management', // create, edit and delete roles and manage permissions and users in those roles
        specific_project_data_own_organisation_only: 'specific_project_data_own_organisation_only' // user with this will access data from own organisaiton, for both readonly and management
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
    specific_study_data_own_organisation_only: 'This study self organisation readonly access',
    specific_project_readonly_access: 'This project readonly access',
    specific_project_role_management: 'This project role management',
    specific_project_data_own_organisation_only: 'This project self organisation readonly access'
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
