import { FunctionComponent } from 'react';
import { ProfileManagementSection } from './profile';
import css from './profile.module.css';
import { MyKeys } from './keys';
import { MyWebauthn } from './webauthn';

export const ProfilePage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <ProfileManagementSection />
            <MyKeys />
            <MyWebauthn />
        </div>
    );
};
