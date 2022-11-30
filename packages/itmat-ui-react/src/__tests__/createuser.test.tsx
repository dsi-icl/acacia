import React from 'react';
import { RegisterNewUser } from '../components/login/register';
import { mount } from 'enzyme';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router';

describe('Create new users', () => {
    it('mounts', () => {
        const wrapper = mount(
            <MemoryRouter initialEntries={['/']}>
                <MockedProvider mocks={[]}>
                    <RegisterNewUser />
                </MockedProvider>
            </MemoryRouter>
        );
        expect(wrapper).toBeTruthy();
    });

});
