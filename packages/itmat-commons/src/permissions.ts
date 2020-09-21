export const permissions = {
    dataset_specific: {
        files: {
            upload_files: 'dataset_specific@files@upload_files',
            download_files: 'dataset_specific@files@download_files',
            delete_files: 'dataset_specific@files@delete_files',
            edit_files: 'dataset_specific@files@edit_files'
        },
        roles: {
            create_dataset_roles: 'dataset_specific@roles@create_dataset_roles',
            add_users_to_dataset_roles: 'dataset_specific@roles@add_users_to_dataset_roles',
            edit_dataset_role_permissions: 'dataset_specific@roles@edit_dataset_role_permissions',
            delete_dataset_roles: 'dataset_specific@roles@delete_dataset_roles'
        },
        data: {
            upload_new_clinical_data: 'dataset_specific@data@upload_new_clinical_data',
            select_current_dataversion: 'dataset_specific@data@select_current_dataversion',
            edit_staging_dataversion: 'dataset_specific@data@edit_staging_dataversion',
            commit_staging_dataversion_to_production: 'dataset_specific@data@commit_staging_dataversion_to_production'
        },
        projects: {
            create_new_projects: 'dataset_specific@projects@create_new_projects',
            delete_projects: 'dataset_specific@projects@delete_projects'
        }
    },
    project_specific: {
        files: {
            download_files: 'project_specific@files@download_files'
        },
        data: {
            view_data: 'project_specific@data@view_data'
        },
        roles: {
            create_project_roles: 'project_specific@roles@create_project_roles',
            add_users_to_project_roles: 'project_specific@roles@add_users_to_project_roles',
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

class UserPermissions {
    private _permissions: string[];
    constructor() {
        this._permissions = [];
    }

    public static newFromSerialisedString(str: string): UserPermissions {
        const allPermissions = str.split('|');
        const userPermissions = new UserPermissions();
        userPermissions.add(allPermissions);
        return userPermissions;
    }
    
    public serialisePermissionsForMongo(): string {
        return this._permissions.join('|');
    }

    add(permissions: string | string[]): UserPermissions {
        if (permissions instanceof Array) {
            const set = new Set(this._permissions);
            for (const each of permissions) {
                set.add(each);
            }
            this._permissions = Array.from(set);
            return this;
        } else {
            if (!this._permissions.includes(permissions)) {
                this._permissions.push(permissions);
            }
            return this;
        }
    }

    remove(permissions: string | string[]): UserPermissions {
        const set = new Set(this._permissions);
        if (permissions instanceof Array) {
            for (const each of permissions) {
                set.delete(each);
            }
        } else {
            set.delete(permissions);
        }
        this._permissions = Array.from(set);
        return this;
    }

    userHasTheNeccessaryPermissionFor(neededPermission: string): boolean {
        return this._permissions.includes(neededPermission);
    }
}
