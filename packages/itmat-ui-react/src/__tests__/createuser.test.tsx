import React from 'react';
import { CreateNewUser } from '../components/users/createNewUser';
import { mount } from 'enzyme';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router';

describe('Create new users', () => {
    it('mounts', () => {
        const wrapper = mount(
            <MemoryRouter initialEntries={['/']}>
                <MockedProvider mocks={[]}>
                    <CreateNewUser />
                </MockedProvider>
            </MemoryRouter>
        );
        expect(wrapper.find('input')).toHaveLength(3);
    });

});
