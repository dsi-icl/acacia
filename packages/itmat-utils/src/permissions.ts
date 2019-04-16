export const permissions = {
    all_user: {
        systemwide_user_management: 'systemwide_user_management', // create, delete, edit all users
    },
    all_study: {
        systemwide_study_existence_management: 'systemwide_study_existence_management', // create, delete, edit study
        all_studies_user_management: 'all_studies_user_management', // add or delete users from all studies
        all_studies_data_access: 'all_studies_data_access', // query data from all studies
        all_studies_data_upload: 'all_studies_data_upload', // upload data from all studies
        all_studies_role_management: 'all_studies_role_management', // create, edit and delete roles and manage permissions and users in those roles
        all_studies_manage_projects: 'all_studies_manage_projects', // allows to create, delete, edit projects within a specific study
        all_projects_data_access: 'all_projects_data_access', // query data from all projects (eid is mapped, fields and patients subset)
        all_projects_user_management: 'all_projects_user_management', // add or delete users from access list to all projects
        all_projects_role_management: 'all_projects_role_management', // create, edit and delete roles and manage permissions and users in those roles
    },
    specific_study: {
        specific_study_user_access_management: 'specific_study_user_access_management', // allows to add or
        specific_study_data_access: 'specific_study_data_access', // allows to query data
        specific_study_data_upload: 'specific_study_data_upload', // allows to upload / edit data
        specific_study_role_management: 'specific_study_role_management', // create, edit and delete roles and manage permissions and users in those roles
        specific_study_projects_existence_management: 'specific_study_projects_existence_management', // allows to create, delete, edit projects within a specific study
        specific_study_data_access_to_all_projects: 'specific_study_data_access_to_all_projects', // query data from all projects in this study (eid is mapped, fields and patients subset)
        specific_study_user_management_to_all_projects: 'specific_study_user_management_to_all_projects', // add or delete users from access list to all projects in this study
    },
    specific_project: {
        specific_project_role_management: 'specific_project_role_management', // create, edit and delete roles and manage permissions and users in those roles
        specific_project_data_access: 'specific_project_data_access', // query data from project (eid is mapped, fields and patients subset)
        specific_project_user_management: 'specific_project_user_management' // add or delete users from access list to this project
    }
}