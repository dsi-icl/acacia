import { Select } from 'antd';
import 'antd/lib/select/style/css';
import { IUser } from 'itmat-commons';
import * as React from 'react';
import css from './genericUserList.module.css';

const User: React.FunctionComponent<{ user: IUser; onClickCross: (user: IUser) => void }> = ({ user, onClickCross }) => {
    return (
        <div className={css.userSpan}>
            <span>{`${user.realName} (${user.organisation})`}</span>
            <div className={css.deleteButton} onClick={() => onClickCross(user)}>x</div>
        </div>
    );
};

const UserList: React.FunctionComponent<{
    studyId: string;
    projectId?: string;
    submitButtonString: string;
    children: Array<typeof User>;
    availableUserList: IUser[];
    onClickAddButton: (studyId: string, projectId: string | undefined, user: IUser) => void;
}> = ({ submitButtonString, onClickAddButton, studyId, projectId, children, availableUserList }) => {

    const [addUserInput, setAddUserInput] = React.useState<string | undefined>(undefined);
    const selectedUser = availableUserList.filter((el) => el.id === addUserInput)[0] || null;

    return <div>
        {children || <span>There is no user added currently.</span>}

        <div className={css.addUserSectionWrapper}>
            <div className={css.selectionWrapper}>
                <Select
                    showSearch
                    getPopupContainer={(ev) => ev!.parentElement!}
                    dropdownStyle={{ maxHeight: 250, overflow: 'auto' }}
                    style={{ width: '100%' }}
                    value={addUserInput}
                    onChange={(e) => { setAddUserInput(e); }}
                    notFoundContent='No user matches your search'
                >
                    {availableUserList.map((el: IUser) => <Select.Option key={el.id} value={el.id}>{`${el.realName} (${el.organisation || 'unknown organisation'})`}</Select.Option>)}
                </Select>
            </div>
            <div className={css.button} onClick={selectedUser ? () => { onClickAddButton(studyId, projectId, selectedUser); setAddUserInput(undefined); } : () => { return; }}>
                {submitButtonString}
            </div>
        </div>
    </div>;
};

export const UserListPicker = {
    UserList,
    User
};
