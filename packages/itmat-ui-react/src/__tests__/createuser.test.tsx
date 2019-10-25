import React from 'react';
import { CreateNewUser } from '../components/users/createNewUser';
import { shallow, mount } from 'enzyme';
import ReactDOM from 'react-dom';

describe('Create new users', () => {
    it('mounts', () => {
        const wrapper = mount(<CreateNewUser/>);
        console.log(wrapper.text());
        wrapper.unmount();

    });
});